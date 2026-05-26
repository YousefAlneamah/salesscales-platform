import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { supabase } from '../supabase';

const VIDEO_TYPES = [
  { value: 'product_showcase', label: 'Product Showcase', specs: '15–30s · 9:16 or 16:9', style: 'Cinematic product focus', icon: 'ti-box' },
  { value: 'ad_creative',      label: 'Ad Creative',      specs: '6–15s · 9:16',          style: 'High-impact, scroll-stopping', icon: 'ti-speakerphone' },
  { value: 'brand_story',      label: 'Brand Story',      specs: '30–60s · 16:9',          style: 'Narrative-driven, emotional', icon: 'ti-heart' },
];

export default function HiggsField() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [videoType, setVideoType] = useState('product_showcase');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.from('clients').select('id, name').order('name').then(({ data }) => {
      if (data) setClients(data);
    });
  }, []);

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const { data } = await axios.post('http://localhost:3001/higgsfield/create-video', {
        client_id: selectedClient || null,
        video_type: videoType,
        prompt: prompt.trim(),
      });
      setResult(data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const copyBrief = () => {
    if (!result?.brief) return;
    navigator.clipboard.writeText(result.brief).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = result.brief;
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

  const selectedType = VIDEO_TYPES.find(v => v.value === videoType);

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div className="section-label">Higgsfield MCP</div>
          <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>AI Video Brief Generator</div>
          <div style={{ fontSize: '11px', color: '#8896a8', marginTop: '3px' }}>
            Mahdi generates a production-ready brief — open Higgsfield.ai and execute immediately.
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '16px', alignItems: 'start' }}>

        {/* LEFT — CONTROLS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* CLIENT */}
          <div className="card">
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Client (optional)</div>
            <select
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
              style={{ width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', color: '#0a1628', outline: 'none', background: 'white', boxSizing: 'border-box' }}
            >
              <option value="">— No client selected —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {selectedClient && (
              <div style={{ fontSize: '10px', color: '#8896a8', marginTop: '6px' }}>
                Mahdi will pull brand knowledge from the knowledge base.
              </div>
            )}
          </div>

          {/* VIDEO TYPE */}
          <div className="card">
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Video Type</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {VIDEO_TYPES.map(vt => (
                <div
                  key={vt.value}
                  onClick={() => setVideoType(vt.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                    border: `1px solid ${videoType === vt.value ? '#c9a84c' : '#e4e9f0'}`,
                    background: videoType === vt.value ? 'rgba(201,168,76,0.06)' : 'white',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: videoType === vt.value ? 'rgba(201,168,76,0.12)' : '#f8fafc', border: `1px solid ${videoType === vt.value ? 'rgba(201,168,76,0.3)' : '#e4e9f0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`ti ${vt.icon}`} style={{ fontSize: '14px', color: videoType === vt.value ? '#c9a84c' : '#8896a8' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>{vt.label}</div>
                    <div style={{ fontSize: '10px', color: '#8896a8' }}>{vt.specs} · {vt.style}</div>
                  </div>
                  {videoType === vt.value && (
                    <i className="ti ti-circle-check" style={{ fontSize: '16px', color: '#c9a84c' }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* PROMPT */}
          <div className="card">
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Video Request</div>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={`e.g. A ${selectedType?.label.toLowerCase()} for our new protein powder — energetic gym lifestyle, bold colours, ends with our logo and website URL.`}
              rows={5}
              style={{ width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', color: '#0a1628', outline: 'none', background: 'white', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif', lineHeight: '1.6', resize: 'vertical' }}
            />
          </div>

          {/* GENERATE BUTTON */}
          <button
            onClick={generate}
            disabled={!prompt.trim() || loading}
            className="btn btn-gold"
            style={{ width: '100%', padding: '12px', fontSize: '13px', opacity: !prompt.trim() || loading ? 0.6 : 1 }}
          >
            {loading ? (
              <><i className="ti ti-loader" style={{ marginRight: '8px' }} />Mahdi is writing your brief...</>
            ) : (
              <><i className="ti ti-sparkles" style={{ marginRight: '8px' }} />Generate Video Brief</>
            )}
          </button>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 14px', fontSize: '11px', color: '#dc2626' }}>
              <i className="ti ti-alert-circle" style={{ marginRight: '6px' }} />{error}
            </div>
          )}
        </div>

        {/* RIGHT — OUTPUT */}
        <div>
          {!result && !loading && (
            <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
              <i className="ti ti-video" style={{ fontSize: '40px', color: '#e4e9f0', display: 'block', marginBottom: '14px' }} />
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>Your video brief will appear here</div>
              <div style={{ fontSize: '11px', color: '#8896a8', lineHeight: '1.7' }}>
                Fill in the video request on the left and click Generate.<br />
                Mahdi will write a complete, production-ready Higgsfield brief.
              </div>
            </div>
          )}

          {loading && (
            <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
              <i className="ti ti-video" style={{ fontSize: '32px', color: '#c9a84c', display: 'block', marginBottom: '14px' }} />
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>Mahdi is writing your video brief...</div>
              <div style={{ fontSize: '11px', color: '#8896a8' }}>Pulling brand context and crafting the creative direction</div>
            </div>
          )}

          {result && !loading && (
            <>
              {/* LAUNCH BAR */}
              <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', borderRadius: '12px', padding: '16px 20px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(201,168,76,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <i className="ti ti-video" style={{ fontSize: '20px', color: '#c9a84c' }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>{result.video_label}</div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                      Brief ready · {result.brief?.split(/\s+/).filter(Boolean).length} words · {result.specs}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={copyBrief}
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '7px', padding: '7px 14px', fontSize: '11px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                  >
                    <i className={`ti ${copied ? 'ti-check' : 'ti-copy'}`} style={{ marginRight: '5px' }} />
                    {copied ? 'Copied' : 'Copy Brief'}
                  </button>
                  <a
                    href={result.higgsfield_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ background: '#c9a84c', border: 'none', borderRadius: '7px', padding: '7px 16px', fontSize: '11px', fontWeight: 700, color: '#0a1628', cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <i className="ti ti-external-link" style={{ fontSize: '12px' }} />
                    Launch in Higgsfield
                  </a>
                </div>
              </div>

              {/* BRIEF */}
              <div className="card">
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}>Video Brief — by Mahdi</div>
                <div style={{ fontSize: '12px', color: '#0a1628', lineHeight: '1.9', whiteSpace: 'pre-wrap' }}>
                  {result.brief}
                </div>

                <div style={{ marginTop: '12px', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e4e9f0', borderRadius: '8px', fontSize: '10px', color: '#8896a8', lineHeight: '1.6' }}>
                  <i className="ti ti-info-circle" style={{ marginRight: '5px' }} />
                  Open Higgsfield.ai, create a new <strong>{result.video_label}</strong>, then use this brief as your creative guide. Paste sections directly into the prompt fields.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
