const express = require('express');
const crypto = require('crypto');

// In-memory store for channel import jobs (owned by this module)
const importJobs = new Map();

const resolveChannelId = async (channelUrl, axios) => {
  const directMatch = channelUrl.match(/youtube\.com\/channel\/(UC[\w-]+)/);
  if (directMatch) return directMatch[1];

  const handleMatch = channelUrl.match(/youtube\.com\/@([\w.-]+)/);
  if (handleMatch) {
    const res = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: { part: 'id', forHandle: handleMatch[1], key: process.env.YOUTUBE_API_KEY }
    });
    return res.data.items?.[0]?.id || null;
  }
  const customMatch = channelUrl.match(/youtube\.com\/(?:c|user)\/([\w.-]+)/);
  if (customMatch) {
    const res = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: { part: 'id', forUsername: customMatch[1], key: process.env.YOUTUBE_API_KEY }
    });
    return res.data.items?.[0]?.id || null;
  }
  return null;
};

const fetchChannelVideos = async (channelId, axios) => {
  const chRes = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
    params: { part: 'contentDetails', id: channelId, key: process.env.YOUTUBE_API_KEY }
  });
  const uploadsId = chRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) return [];

  const videos = [];
  let nextPageToken = null;
  do {
    const params = { part: 'snippet', playlistId: uploadsId, maxResults: 50, key: process.env.YOUTUBE_API_KEY };
    if (nextPageToken) params.pageToken = nextPageToken;
    const res = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', { params });
    for (const item of res.data.items || []) {
      const vid = item.snippet.resourceId?.videoId;
      if (vid) videos.push({
        videoId: vid,
        title: item.snippet.title,
        description: (item.snippet.description || '').substring(0, 400),
        publishedAt: item.snippet.publishedAt,
      });
    }
    nextPageToken = res.data.nextPageToken || null;
  } while (nextPageToken && videos.length < 10000);

  return videos;
};

const scoreVideosWithClaude = async (videos, axios) => {
  const BATCH = 15;
  const scored = [];
  for (let i = 0; i < videos.length; i += BATCH) {
    const batch = videos.slice(i, i + BATCH);
    const list = batch.map((v, idx) =>
      `${idx + 1}. "${v.title}" — ${v.description.substring(0, 150)}`
    ).join('\n');
    try {
      const res = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          system: 'You are a content relevance scorer for an ecommerce sales agency. Return ONLY a JSON array of integers (1-10), one per video, in order. No explanation.',
          messages: [{ role: 'user', content: `Score each video 1-10 for relevance to ecommerce sales, email/SMS marketing, paid ads, copywriting, customer retention, or business growth. Return ONLY a JSON array like [8,3,9,...] — ${batch.length} numbers:\n\n${list}` }]
        },
        { headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' } }
      );
      const text = res.data.content[0].text.trim();
      const arrMatch = text.match(/\[[\d\s,]+\]/);
      const scores = arrMatch ? JSON.parse(arrMatch[0]) : [];
      batch.forEach((v, idx) => scored.push({ ...v, score: scores[idx] ?? 0 }));
    } catch (e) {
      batch.forEach(v => scored.push({ ...v, score: 0 }));
    }
    await new Promise(r => setTimeout(r, 400));
  }
  return scored;
};

const runChannelImport = async (jobId, channelUrl, clientId, aiMember, supabase, axios, YoutubeTranscript) => {
  const job = importJobs.get(jobId);
  const log = (msg) => {
    job.log.push({ time: new Date().toISOString(), msg });
    console.log(`[Import ${jobId.slice(0, 6)}] ${msg}`);
  };

  try {
    log('Resolving channel URL...');
    const channelId = await resolveChannelId(channelUrl.trim(), axios);
    if (!channelId) throw new Error('Cannot resolve channel ID. Check URL format — try https://youtube.com/@ChannelName');
    log(`Channel resolved → ${channelId}`);

    log('Fetching video list from YouTube Data API...');
    const videos = await fetchChannelVideos(channelId, axios);
    if (videos.length === 0) throw new Error('No videos found on this channel. Check the API key and channel URL.');
    job.videosQueued = videos.length;
    log(`Found ${videos.length} videos. Scoring all for relevance with Claude Haiku...`);

    const scored = await scoreVideosWithClaude(videos, axios);
    const qualifying = scored.filter(v => v.score >= 7);
    job.videos = scored;
    log(`Scoring complete. ${qualifying.length} of ${scored.length} videos scored 7+ and will be imported.`);

    const TRANSCRIPT_BATCH = 10;
    const videoChunksMap = [];

    for (let i = 0; i < qualifying.length; i += TRANSCRIPT_BATCH) {
      const batch = qualifying.slice(i, i + TRANSCRIPT_BATCH);
      log(`Fetching transcripts ${i + 1}–${Math.min(i + TRANSCRIPT_BATCH, qualifying.length)} of ${qualifying.length}...`);

      const results = await Promise.all(batch.map(async (video) => {
        try {
          const transcript = await YoutubeTranscript.fetchTranscript(
            `https://www.youtube.com/watch?v=${video.videoId}`
          );
          const text = transcript.map(t => t.text).join(' ').trim();
          if (!text || text.length < 100) return { video, chunks: null };
          const chunkSize = 1000, overlap = 100;
          const chunks = [];
          for (let pos = 0; pos < text.length; pos += chunkSize - overlap) {
            const chunk = text.substring(pos, pos + chunkSize);
            if (chunk.trim().length > 50) chunks.push(chunk);
          }
          return { video, chunks };
        } catch (e) {
          return { video, chunks: null, error: e.message };
        }
      }));

      for (const r of results) {
        if (r.error) log(`  ↳ "${r.video.title}" — Error: ${r.error}`);
        else if (!r.chunks) log(`  ↳ "${r.video.title}" — No transcript`);
        else videoChunksMap.push(r);
        job.videosProcessed++;
      }
    }

    log(`Transcripts done. ${videoChunksMap.length} videos with content.`);

    const allChunks = [];
    for (const { video, chunks } of videoChunksMap) {
      for (let c = 0; c < chunks.length; c++) {
        allChunks.push({
          row: {
            title: `${video.title} — Part ${c + 1}`,
            content: chunks[c],
            type: 'video',
            source: 'YouTube Channel Import',
            client_id: clientId || null,
            status: 'trained',
            notes: aiMember || 'All Team',
          },
          content: chunks[c],
        });
      }
    }

    const INSERT_BATCH = 50;
    log(`Inserting ${allChunks.length} chunks in batches of ${INSERT_BATCH}...`);
    const insertedDocs = [];
    for (let i = 0; i < allChunks.length; i += INSERT_BATCH) {
      const batch = allChunks.slice(i, i + INSERT_BATCH);
      try {
        const { data: docs } = await supabase.from('knowledge_base').insert(batch.map(c => c.row)).select();
        if (docs) {
          docs.forEach((doc, idx) => insertedDocs.push({ id: doc.id, content: batch[idx].content }));
        }
      } catch (e) {
        console.error('Batch insert error:', e.message);
      }
    }

    const EMBED_BATCH = 20;
    log(`Generating embeddings for ${insertedDocs.length} chunks in batches of ${EMBED_BATCH}...`);
    for (let i = 0; i < insertedDocs.length; i += EMBED_BATCH) {
      const batch = insertedDocs.slice(i, i + EMBED_BATCH);
      try {
        const embRes = await axios.post(
          'https://api.openai.com/v1/embeddings',
          { input: batch.map(d => d.content.substring(0, 500)), model: 'text-embedding-3-small' },
          { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' } }
        );
        await Promise.all(batch.map((doc, idx) =>
          supabase.from('knowledge_base').update({ embedding: embRes.data.data[idx].embedding }).eq('id', doc.id)
        ));
        job.chunksAdded += batch.length;
        log(`  ↳ Embedded chunks ${i + 1}–${Math.min(i + EMBED_BATCH, insertedDocs.length)} of ${insertedDocs.length}`);
      } catch (e) {
        console.error('Batch embed error:', e.message);
      }
    }

    job.status = 'complete';
    log(`✅ Done — ${job.videosProcessed} videos processed, ${job.chunksAdded} chunks added to knowledge base.`);
    setTimeout(() => importJobs.delete(jobId), 3_600_000);
  } catch (e) {
    job.status = 'error';
    job.error = e.message;
    log(`❌ ${e.message}`);
  }
};

module.exports = ({ supabase, axios, importLimiter, upload, PDF2Json, YoutubeTranscript }) => {
  const router = express.Router();

  router.post('/upload-pdf', importLimiter, upload.single('pdf'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const { title, clientId, type, aiMember } = req.body;

      const pdfParser = new PDF2Json();

      pdfParser.on('pdfParser_dataError', () => {
        res.status(500).json({ error: 'Failed to parse PDF' });
      });

      pdfParser.on('pdfParser_dataReady', async (pdfData) => {
        try {
          const pages = pdfData.Pages || [];
          let text = '';
          pages.forEach(page => {
            if (!page.Texts) return;
            page.Texts.forEach(textItem => {
              if (!textItem.R) return;
              textItem.R.forEach(run => {
                let word = run.T || '';
                try { word = decodeURIComponent(word); } catch (e) {}
                text += word + ' ';
              });
              text += '\n';
            });
          });
          text = text.trim();

          if (!text || text.length < 50) {
            return res.json({ success: true, message: 'PDF parsed but no text extracted', chunks: 0 });
          }

          console.log(`PDF parsed: ${pages.length} pages, ${text.length} characters`);

          const chunkSize = 1000;
          const overlap = 100;
          const chunks = [];

          for (let i = 0; i < text.length; i += chunkSize - overlap) {
            const chunk = text.substring(i, i + chunkSize);
            if (chunk.trim().length > 50) chunks.push(chunk);
          }

          console.log(`Chunking into ${chunks.length} chunks for: ${title}`);

          res.json({
            success: true,
            message: `Processing ${chunks.length} chunks in background`,
            chunks: chunks.length,
            pageCount: pages.length
          });

          let embedded = 0;
          for (let i = 0; i < chunks.length; i++) {
            try {
              const { data: newDoc } = await supabase.from('knowledge_base').insert([{
                title: `${title} — Part ${i + 1}`,
                content: chunks[i],
                type: type || 'document',
                source: 'PDF Upload',
                client_id: clientId || null,
                status: 'trained',
                notes: aiMember || 'All Team'
              }]).select().single();

              if (newDoc) {
                const embeddingResponse = await axios.post(
                  'https://api.openai.com/v1/embeddings',
                  { input: chunks[i].substring(0, 500), model: 'text-embedding-3-small' },
                  { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' } }
                );
                const embedding = embeddingResponse.data.data[0].embedding;
                await supabase.from('knowledge_base').update({ embedding }).eq('id', newDoc.id);
                embedded++;
              }

              await new Promise(resolve => setTimeout(resolve, 150));
            } catch (e) {
              console.error(`Chunk ${i + 1} failed:`, e.message);
            }
          }

          console.log(`✅ Complete: ${embedded} of ${chunks.length} chunks embedded for: ${title}`);

        } catch (e) {
          console.error('PDF processing error:', e.message);
        }
      });

      pdfParser.parseBuffer(req.file.buffer);

    } catch (e) {
      res.status(500).json({ error: 'Failed to process PDF', details: e.message });
    }
  });

  router.get('/knowledge/documents', async (req, res) => {
    try {
      const { client_id } = req.query;
      const COLS = 'id, title, type, source, client_id, status, notes, created_at';
      let query = supabase.from('knowledge_base').select(COLS).order('created_at', { ascending: false }).limit(100);
      if (client_id) query = query.eq('client_id', client_id);
      const { data: documents, error } = await query;
      if (error) throw error;
      res.json({ documents: documents || [] });
    } catch (e) {
      console.error('Knowledge documents error:', e.message);
      res.status(500).json({ error: 'Failed to fetch documents', details: e.message });
    }
  });

  // Requires this function in Supabase SQL editor:
  // CREATE OR REPLACE FUNCTION knowledge_base_approx_count()
  // RETURNS bigint LANGUAGE sql STABLE AS $$
  //   SELECT reltuples::bigint FROM pg_class WHERE relname = 'knowledge_base';
  // $$;
  router.get('/knowledge/count', async (req, res) => {
    try {
      const { data, error } = await supabase.rpc('knowledge_base_approx_count');
      if (error) throw error;
      res.json({ count: Number(data) || 0 });
    } catch (e) {
      console.error('Knowledge count error:', e.message);
      res.status(500).json({ error: 'Failed to fetch count', details: e.message });
    }
  });

  router.post('/youtube-transcript', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'No URL provided' });
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(url);
      const text = transcript.map(t => t.text).join(' ').trim();
      res.json({ success: true, wordCount: text.split(/\s+/).length, text: text.substring(0, 1000000) });
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch transcript', details: e.message });
    }
  });

  router.post('/knowledge/import-channel', importLimiter, async (req, res) => {
    const { channelUrl, clientId, aiMember } = req.body;
    if (!channelUrl) return res.status(400).json({ error: 'Missing channelUrl' });
    if (!process.env.YOUTUBE_API_KEY) return res.status(500).json({ error: 'YOUTUBE_API_KEY not set in environment' });

    const jobId = crypto.randomBytes(8).toString('hex');
    importJobs.set(jobId, {
      status: 'running',
      log: [],
      videos: [],
      videosQueued: 0,
      videosProcessed: 0,
      chunksAdded: 0,
      error: null,
    });

    res.json({ jobId });

    runChannelImport(jobId, channelUrl, clientId, aiMember, supabase, axios, YoutubeTranscript).catch(e => {
      const job = importJobs.get(jobId);
      if (job) { job.status = 'error'; job.error = e.message; }
    });
  });

  router.get('/knowledge/import-channel/progress', (req, res) => {
    const { jobId } = req.query;
    const job = importJobs.get(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let lastLogIdx = 0;

    const push = () => {
      const newLogs = job.log.slice(lastLogIdx);
      lastLogIdx = job.log.length;
      res.write(`data: ${JSON.stringify({
        status: job.status,
        newLogs,
        videos: job.videos,
        videosQueued: job.videosQueued,
        videosProcessed: job.videosProcessed,
        chunksAdded: job.chunksAdded,
        error: job.error,
      })}\n\n`);
      if (job.status === 'complete' || job.status === 'error') {
        clearInterval(timer);
        res.end();
      }
    };

    push();
    const timer = setInterval(push, 1000);
    req.on('close', () => clearInterval(timer));
  });

  return router;
};
