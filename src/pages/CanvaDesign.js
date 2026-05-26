import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import axios from 'axios';
import { supabase } from '../supabase';

const DESIGN_TYPES = [
  { value: 'social_post',  label: 'Social Post',   sub: '1080×1080', icon: 'ti-photo' },
  { value: 'email_header', label: 'Email Header',  sub: '600×200',   icon: 'ti-mail' },
  { value: 'ad_banner',    label: 'Ad Banner',     sub: '1200×628',  icon: 'ti-ad' },
];

const DEFAULT_COLORS = ['#0a1628', '#c9a84c', '#ffffff'];

export default function CanvaDesign() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [designType, setDesignType] = useState('social_post');
  const [brandColors, setBrandColors] = useState(DEFAULT_COLORS);
  const [colorInput, setColorInput] = useState(DEFAULT_COLORS.join(', '));
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

  const handleColorBlur = () => {
    const colors = colorInput.split(',').map(c => c.trim()).filter(Boolean);
    setBrandColors(colors.length > 0 ? colors : DEFAULT_COLORS);
  };

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const { data } = await axios.post(`${API_BASE}/canva/create-design`, {
        client_id: selectedClient || null,
        design_type: designType,
        brand_colors: brandColors,
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

  const selectedType = DESIGN_TYPES.find(d => d.value === designType);

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div className="section-label">Canva MCP</div>
          <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>AI Design Brief Generator</div>
          <div style={{ fontSize: '11px', color: '#8896a8', marginTop: '3px' }}>
            Mahdi generates a production-ready brief — open Canva and execute immediately.
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

          {/* DESIGN TYPE */}
          <div className="card">
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Design Type</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {DESIGN_TYPES.map(dt => (
                <div
                  key={dt.value}
                  onClick={() => setDesignType(dt.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                    border: `1px solid ${designType === dt.value ? '#c9a84c' : '#e4e9f0'}`,
                    background: designType === dt.value ? 'rgba(201,168,76,0.06)' : 'white',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: designType === dt.value ? 'rgba(201,168,76,0.12)' : '#f8fafc', border: `1px solid ${designType === dt.value ? 'rgba(201,168,76,0.3)' : '#e4e9f0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`ti ${dt.icon}`} style={{ fontSize: '14px', color: designType === dt.value ? '#c9a84c' : '#8896a8' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>{dt.label}</div>
                    <div style={{ fontSize: '10px', color: '#8896a8' }}>{dt.sub}</div>
                  </div>
                  {designType === dt.value && (
                    <i className="ti ti-circle-check" style={{ fontSize: '16px', color: '#c9a84c' }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* BRAND COLORS */}
          <div className="card">
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Brand Colors</div>
            <input
              type="text"
              value={colorInput}
              onChange={e => setColorInput(e.target.value)}
              onBlur={handleColorBlur}
              placeholder="#0a1628, #c9a84c, #ffffff"
              style={{ width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', color: '#0a1628', outline: 'none', background: 'white', boxSizing: 'border-box', fontFamily: 'DM Mono, monospace' }}
            />
            {brandColors.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                {brandColors.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#f8fafc', border: '1px solid #e4e9f0', borderRadius: '6px', padding: '3px 8px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: c, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
                    <span style={{ fontSize: '10px', color: '#4a5568', fontFamily: 'DM Mono, monospace' }}>{c}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PROMPT */}
          <div className="card">
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Design Request</div>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={`e.g. A ${selectedType?.label.toLowerCase()} promoting our summer sale — 30% off all products. Fun, energetic tone. Feature a product image placeholder in the centre.`}
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
              <><i className="ti ti-sparkles" style={{ marginRight: '8px' }} />Generate Design Brief</>
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
              <i className="ti ti-palette" style={{ fontSize: '40px', color: '#e4e9f0', display: 'block', marginBottom: '14px' }} />
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>Your brief will appear here</div>
              <div style={{ fontSize: '11px', color: '#8896a8', lineHeight: '1.7' }}>
                Fill in the design request on the left and click Generate.<br />
                Mahdi will write a complete, production-ready Canva brief.
              </div>
            </div>
          )}

          {loading && (
            <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
              <i className="ti ti-brush" style={{ fontSize: '32px', color: '#c9a84c', display: 'block', marginBottom: '14px' }} />
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>Mahdi is writing your design brief...</div>
              <div style={{ fontSize: '11px', color: '#8896a8' }}>Pulling brand context and crafting the creative direction</div>
            </div>
          )}

          {result && !loading && (
            <>
              {/* LAUNCH BAR */}
              <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', borderRadius: '12px', padding: '16px 20px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(201,168,76,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <i className="ti ti-palette" style={{ fontSize: '20px', color: '#c9a84c' }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>{result.design_label}</div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                      Brief ready · {result.brief?.split(/\s+/).filter(Boolean).length} words
                      {result.canva_brand_kit_id && ' · Brand Kit linked'}
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
                    href={result.canva_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ background: '#c9a84c', border: 'none', borderRadius: '7px', padding: '7px 16px', fontSize: '11px', fontWeight: 700, color: '#0a1628', cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <i className="ti ti-external-link" style={{ fontSize: '12px' }} />
                    Launch in Canva
                  </a>
                </div>
              </div>

              {/* BRIEF */}
              <div className="card">
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}>Design Brief — by Mahdi</div>
                <div style={{ fontSize: '12px', color: '#0a1628', lineHeight: '1.9', whiteSpace: 'pre-wrap' }}>
                  {result.brief}
                </div>

                {result.canva_brand_kit_id && (
                  <div style={{ marginTop: '16px', padding: '10px 14px', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '8px', fontSize: '10px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="ti ti-palette" style={{ color: '#c9a84c', fontSize: '13px' }} />
                    Brand Kit ID <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, color: '#c9a84c' }}>{result.canva_brand_kit_id}</span> — apply this in Canva to auto-fill brand colors and fonts.
                  </div>
                )}

                <div style={{ marginTop: '12px', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e4e9f0', borderRadius: '8px', fontSize: '10px', color: '#8896a8', lineHeight: '1.6' }}>
                  <i className="ti ti-info-circle" style={{ marginRight: '5px' }} />
                  Open Canva, create a new <strong>{result.design_label}</strong>, then use this brief as your creative guide. Copy the text elements directly into your design.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
