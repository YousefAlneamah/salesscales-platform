import React, { useState, useRef } from 'react';
import axios from 'axios';

const ACCEPTED = 'audio/*,.mp3,.mp4,.wav,.m4a,.ogg,.webm,.flac';

const fmtBytes = (b) => {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
};

export default function Transcribe() {
  const [file, setFile] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleFile = (f) => {
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) {
      setError('File too large — Whisper API limit is 25 MB.');
      return;
    }
    setFile(f);
    setError('');
    setTranscription('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const transcribe = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setTranscription('');
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data } = await axios.post('http://localhost:3001/whisper/transcribe', {
        audio_base64: base64,
        filename: file.name,
        mime_type: file.type || 'audio/mpeg',
      });
      setTranscription(data.text || '');
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const copyText = () => {
    navigator.clipboard.writeText(transcription).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = transcription;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div>
      {/* HEADER */}
      <div style={{ marginBottom: '20px' }}>
        <div className="section-label">Whisper AI</div>
        <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>Sales Call Transcription</div>
        <div style={{ fontSize: '11px', color: '#8896a8', marginTop: '4px' }}>
          Upload a sales call recording to transcribe it with OpenAI Whisper. Use transcriptions to train Ali or add to the Knowledge Base.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>

        {/* UPLOAD PANEL */}
        <div>
          {/* DROP ZONE */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? '#c9a84c' : file ? '#10b981' : '#e4e9f0'}`,
              borderRadius: '12px',
              padding: '40px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragging ? 'rgba(201,168,76,0.04)' : file ? 'rgba(16,185,129,0.03)' : 'white',
              transition: 'all 0.15s',
              marginBottom: '12px',
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files[0])}
            />
            <i
              className={`ti ${file ? 'ti-circle-check' : 'ti-upload'}`}
              style={{ fontSize: '32px', color: file ? '#10b981' : dragging ? '#c9a84c' : '#e4e9f0', display: 'block', marginBottom: '12px' }}
            />
            {file ? (
              <>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628', marginBottom: '4px' }}>{file.name}</div>
                <div style={{ fontSize: '11px', color: '#8896a8' }}>{fmtBytes(file.size)} · click to change</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628', marginBottom: '4px' }}>
                  {dragging ? 'Drop to upload' : 'Drop audio file here'}
                </div>
                <div style={{ fontSize: '11px', color: '#8896a8' }}>or click to browse · MP3, WAV, M4A, OGG, FLAC · max 25 MB</div>
              </>
            )}
          </div>

          {/* TRANSCRIBE BUTTON */}
          <button
            onClick={transcribe}
            disabled={!file || loading}
            className="btn btn-navy"
            style={{ width: '100%', padding: '11px', fontSize: '12px', opacity: !file || loading ? 0.6 : 1 }}
          >
            {loading ? (
              <>
                <i className="ti ti-loader" style={{ marginRight: '7px', fontSize: '13px' }} />
                Transcribing...
              </>
            ) : (
              <>
                <i className="ti ti-microphone-2" style={{ marginRight: '7px', fontSize: '13px' }} />
                Transcribe with Whisper
              </>
            )}
          </button>

          {/* ERROR */}
          {error && (
            <div style={{ marginTop: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 14px', fontSize: '11px', color: '#dc2626' }}>
              <i className="ti ti-alert-circle" style={{ marginRight: '6px' }} />{error}
            </div>
          )}

          {/* INFO CARD */}
          <div className="card" style={{ marginTop: '14px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#0a1628', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>How to use this</div>
            {[
              { icon: 'ti-phone', text: 'Record a sales call with Ali or an outbound prospect call' },
              { icon: 'ti-upload', text: 'Upload the audio file here (MP3, M4A, WAV, etc.)' },
              { icon: 'ti-file-text', text: 'Get the full transcript in seconds with Whisper AI' },
              { icon: 'ti-brain', text: 'Add the transcript to Knowledge Base to train Ali' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: i < 3 ? '10px' : '0' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={`ti ${item.icon}`} style={{ fontSize: '12px', color: '#c9a84c' }} />
                </div>
                <div style={{ fontSize: '11px', color: '#4a5568', lineHeight: '1.6', paddingTop: '4px' }}>{item.text}</div>
              </div>
            ))}
          </div>
        </div>

        {/* TRANSCRIPTION OUTPUT */}
        <div>
          <div className="card" style={{ minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0a1628', textTransform: 'uppercase', letterSpacing: '1px' }}>Transcription</div>
              {transcription && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ fontSize: '10px', color: '#8896a8', alignSelf: 'center' }}>
                    {transcription.split(/\s+/).filter(Boolean).length} words
                  </span>
                  <button
                    onClick={copyText}
                    className="btn btn-outline"
                    style={{ fontSize: '10px', padding: '5px 12px' }}
                  >
                    <i className={`ti ${copied ? 'ti-check' : 'ti-copy'}`} style={{ marginRight: '4px' }} />
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </div>

            {loading && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                <i className="ti ti-wave-sine" style={{ fontSize: '32px', color: '#c9a84c' }} />
                <div style={{ fontSize: '12px', color: '#8896a8' }}>Sending to OpenAI Whisper...</div>
                <div style={{ fontSize: '10px', color: '#c4c9d4' }}>This may take 15–60 seconds for long recordings</div>
              </div>
            )}

            {!loading && !transcription && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#8896a8' }}>
                <i className="ti ti-file-text" style={{ fontSize: '32px', color: '#e4e9f0' }} />
                <div style={{ fontSize: '12px' }}>Transcription will appear here</div>
                <div style={{ fontSize: '10px', color: '#c4c9d4' }}>Upload a file and click Transcribe</div>
              </div>
            )}

            {!loading && transcription && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: '#0a1628', lineHeight: '1.85', whiteSpace: 'pre-wrap', background: '#f8fafc', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '16px', maxHeight: '500px', overflowY: 'auto' }}>
                  {transcription}
                </div>
                <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '8px', fontSize: '10px', color: '#92400e' }}>
                  <i className="ti ti-bulb" style={{ marginRight: '5px', color: '#c9a84c' }} />
                  Tip: Copy this transcript and add it to <strong>Knowledge Base → Ali</strong> to improve his sales responses.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
