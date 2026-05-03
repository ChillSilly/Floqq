import React, { useState, useEffect, useCallback } from 'react';
import { Download, Copy } from 'lucide-react';
import { downloadCSV, copyToClipboard } from '../lib/exportUtils';
import { HeatmapChart } from './HeatmapChart';
import { Landscape3DChart } from './Landscape3DChart';

const TICKERS = ["SPY", "QQQ", "DIA", "GLD", "IWM"];

type RadarMode = 'GEX' | 'HEATMAP' | '3D' | 'REPLAY';

const C = {
  bg: 'var(--bg-app)', bg1: 'var(--bg-surface)', bg2: 'var(--bg-card)', bg3: 'var(--border-main)',
  line: 'var(--border-main)', line2: 'var(--border-strong)',
  t1: 'var(--text-main)', t2: 'var(--text-secondary)', t3: 'var(--text-tertiary)',
  green: 'var(--success)', red: 'var(--danger)', amber: 'var(--warning)', blue: 'var(--accent-main)', violet: 'var(--accent-secondary)',
  glass: 'var(--glass)', accentGlow: 'var(--accent-surface)'
};

function fmt(v: number, d = 2) { return v.toFixed(d); }
function fmtB(v: number) { return `${v >= 0 ? '+' : ''}${v.toFixed(3)}B`; }
function fmtFlow(v: number) {
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{
      flex: '1 1 140px', background: C.bg1, border: `1px solid ${C.line2}`,
      borderRadius: 8, padding: '14px 16px', borderTop: `2px solid ${color}`,
    }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: C.t3, letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 600, color, letterSpacing: -0.5 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: C.t3, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function ExpoCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ flex: 1, minWidth: 100, background: C.bg1, border: `1px solid ${C.line2}`, borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ fontSize: 8, fontWeight: 600, color: C.t3, letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 5 }}>{label}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 500, color }}>{value}</div>
      <div style={{ fontSize: 8, color: C.t3, marginTop: 3 }}>{sub}</div>
    </div>
  );
}

function GexChart({ agg, spot, levels }: { agg: any; spot: number; levels: any }) {
  if (!agg.length) return null;
  const maxAbs = Math.max(...agg.map((a: any) => Math.abs(a.gex_net)), 0.0001);
  const closestObj = agg.reduce((prev: any, curr: any) => Math.abs(curr.strike - spot) < Math.abs(prev.strike - spot) ? curr : prev);
  const closestStrike = closestObj?.strike;

  return (
    <div style={{ background: C.bg1, border: `1px solid ${C.line2}`, borderRadius: 8, padding: 16 }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: C.t3, letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 12 }}>
        GEX Profile — Net OI-GEX por Strike
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 500, overflowY: 'auto', position: 'relative' }}>
        {agg.map((a: any, i: number) => {
          const pct = (a.gex_net / maxAbs) * 100;
          const isSpot = a.strike === closestStrike;
          const isLevel = a.strike === levels.call_wall || a.strike === levels.put_wall || a.strike === levels.gamma_flip;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, height: isSpot ? 24 : 18,
              background: isSpot ? 'rgba(var(--color-accent-main), 0.1)' : isLevel ? C.glass : 'transparent',
              border: isSpot ? `1px dashed ${C.blue}` : 'none',
              borderRadius: 4, padding: '0 6px',
              position: isSpot ? 'sticky' : 'relative',
              top: isSpot ? 0 : 'auto',
              bottom: isSpot ? 0 : 'auto',
              zIndex: isSpot ? 10 : 1,
            }}>
              <span style={{
                width: 52, fontSize: isSpot ? 11 : 10, fontFamily: "'JetBrains Mono', monospace",
                color: isSpot ? C.blue : a.strike === levels.call_wall ? C.green : a.strike === levels.put_wall ? C.red : C.t2,
                fontWeight: isSpot || isLevel ? 800 : 400, textAlign: 'right' as const, flexShrink: 0,
              }}>
                {isSpot && <span style={{ marginRight: 4, color: C.blue, animation: 'pulse 2s infinite' }}>▶</span>}
                {a.strike.toFixed(0)}
              </span>
              <div style={{ flex: 1, display: 'flex', height: 12, alignItems: 'center' }}>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', minWidth: 2 }}>
                  {pct < 0 && <div style={{
                    height: '10px',
                    width: `${Math.max(Math.min(Math.abs(pct), 100), 1)}%`, background: C.red, borderRadius: '2px 0 0 2px',
                    opacity: 0.85, minWidth: 2,
                  }} />}
                </div>
                <div style={{ width: 1, height: '14px', background: C.line2, flexShrink: 0, margin: '0 2px' }} />
                <div style={{ flex: 1, display: 'flex', minWidth: 2 }}>
                  {pct > 0 && <div style={{
                    height: '10px',
                    width: `${Math.max(Math.min(pct, 100), 1)}%`, background: C.green, borderRadius: '0 2px 2px 0',
                    opacity: 0.85, minWidth: 2,
                  }} />}
                </div>
              </div>
              <span style={{
                width: 60, fontSize: isSpot ? 10 : 9, fontFamily: "'JetBrains Mono', monospace",
                color: a.gex_net >= 0 ? C.green : C.red, textAlign: 'right' as const, flexShrink: 0,
                fontWeight: isSpot ? 800 : 400
              }}>
                {a.gex_net >= 0 ? '+' : ''}{a.gex_net.toFixed(4)}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 9, color: C.t3 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{width: 8, height: 8, background: C.blue, borderRadius: '50%'}}/> SPOT</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{width: 8, height: 8, background: C.green, borderRadius: '50%'}}/> Call Wall</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{width: 8, height: 8, background: C.red, borderRadius: '50%'}}/> Put Wall</span>
        <span style={{ opacity: 0.5 }}>Valores en $Billions</span>
      </div>
    </div>
  );
}

function KeyLevelsTable({ agg, spot, levels, hoveredRow, setHoveredRow }: { agg: any; spot: number; levels: any; hoveredRow: number | null; setHoveredRow: (i: number | null) => void }) {
  const top = [...agg].sort((a: any, b: any) => Math.abs(b.gex_net) - Math.abs(a.gex_net)).slice(0, 10);
  return (
    <div style={{ background: C.bg1, border: `1px solid ${C.line2}`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.line}`, fontSize: 9, fontWeight: 600, color: C.t3, letterSpacing: 2, textTransform: 'uppercase' as const }}>
        Top 10 Strikes por Abs GEX
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.line}` }}>
            {['Strike', 'Net GEX', 'Call GEX', 'Put GEX', 'OI', 'Dist %'].map(h => (
              <th key={h} style={{ padding: '8px 10px', fontSize: 8, fontWeight: 600, color: C.t3, letterSpacing: 1.5, textTransform: 'uppercase' as const, textAlign: 'right' as const }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {top.map((a, i) => (
            <tr 
              key={i} 
              onMouseEnter={() => setHoveredRow(i)} 
              onMouseLeave={() => setHoveredRow(null)}
              style={{ 
                borderBottom: `1px solid ${C.line}`,
                background: hoveredRow === i ? C.bg2 : 'transparent',
                transition: 'background 0.2s',
              }}
            >
              <td style={{ padding: '7px 10px', color: C.t1, fontWeight: 500, textAlign: 'right' as const }}>${a.strike.toFixed(1)}</td>
              <td style={{ padding: '7px 10px', color: a.gex_net >= 0 ? C.green : C.red, fontWeight: 600, textAlign: 'right' as const }}>{fmtB(a.gex_net)}</td>
              <td style={{ padding: '7px 10px', color: C.green, textAlign: 'right' as const }}>+{a.call_gex.toFixed(4)}</td>
              <td style={{ padding: '7px 10px', color: C.red, textAlign: 'right' as const }}>{a.put_gex.toFixed(4)}</td>
              <td style={{ padding: '7px 10px', color: C.t2, textAlign: 'right' as const }}>{a.oi.toLocaleString()}</td>
              <td style={{ padding: '7px 10px', color: C.t2, textAlign: 'right' as const }}>{a.dist_pct >= 0 ? '+' : ''}{a.dist_pct.toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Skeleton({ h = 80 }: { h?: number }) {
  return <div style={{ height: h, background: `linear-gradient(90deg, ${C.bg1} 25%, ${C.bg2} 50%, ${C.bg1} 75%)`, backgroundSize: '200% 100%', borderRadius: 8, animation: 'shimmer 1.5s infinite' }} />;
}

export function GexRadarPremium() {
  const [ticker, setTicker] = useState('SPY');
  const [exps, setExps] = useState(1);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [mode, setMode] = useState<RadarMode>('GEX');
  const [hoveredMode, setHoveredMode] = useState<RadarMode | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopy = async (data: any[]) => {
    await copyToClipboard(data);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/gex?ticker=${ticker}&exps=${exps}`);
      if (!res.ok) {
         let errMsg = 'Fetch failed';
         try {
           const j = await res.json();
           errMsg = j.error || errMsg;
         } catch(e) { }
         throw new Error(errMsg);
      }
      setData(await res.json());
      setCountdown(60);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [ticker, exps]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(p => {
        if (p <= 1) { fetchData(); return 60; }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [fetchData]);

  const d = data;

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.t1, fontFamily: "'Inter', system-ui, sans-serif", width: '100%', borderRadius: 12 }}>
      <style>{`@keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }`}</style>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 24px 40px' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <select value={ticker} onChange={e => setTicker(e.target.value)} style={{
            background: C.bg1, border: `1px solid ${C.line2}`, borderRadius: 6, padding: '8px 14px',
            color: C.t1, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600,
            letterSpacing: 1.5, cursor: 'pointer', outline: 'none',
          }}>
            {TICKERS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2, 3, 4].map(n => (
              <button key={n} onClick={() => setExps(n)} style={{
                padding: '7px 14px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${n === exps ? C.blue : C.line2}`,
                background: n === exps ? C.blue : 'transparent',
                opacity: n === exps ? 1 : 0.7,
                color: n === exps ? C.bg : C.t3, transition: 'all 0.15s',
              }}>{n} EXP</button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          <div style={{
            display: 'flex', alignItems: 'center', gap: 7, background: C.bg1,
            border: `1px solid ${C.line2}`, borderRadius: 20, padding: '5px 14px',
            fontSize: 10, fontWeight: 500, color: C.t3, letterSpacing: 1,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.amber, animation: 'pulse 1s ease-in-out infinite' }} />
            REFRESH <span style={{ color: C.amber, fontWeight: 600, fontFamily: "'JetBrains Mono'" }}>{countdown}</span>s
          </div>
          <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`}</style>
        </div>

        {error && <div style={{ padding: '12px 16px', background: C.glass, border: `1px solid ${C.red}`, borderRadius: 8, color: C.red, fontSize: 13, marginBottom: 16 }}>{error}</div>}

        {loading && !d ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton h={90} /><div style={{ display: 'flex', gap: 8 }}>{[1,2,3,4,5,6].map(i => <Skeleton key={i} h={80} />)}</div>
            <div style={{ display: 'flex', gap: 8 }}>{[1,2,3,4].map(i => <Skeleton key={i} h={70} />)}</div>
            <Skeleton h={400} />
          </div>
        ) : d ? (
          <>
            <div style={{
              background: C.bg1, border: `1px solid ${C.line2}`, borderRadius: 8,
              padding: '18px 28px', marginBottom: 16, display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, height: 2, width: '100%', background: `linear-gradient(90deg, ${d.regime.is_long_gamma ? C.green : C.red} 0%, transparent 60%)`, opacity: 0.6 }} />
              <div>
                <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono'", color: C.t3, letterSpacing: 1.5, textTransform: 'uppercase' as const, marginBottom: 6 }}>
                  {d.ticker} · ${fmt(d.spot)} · OI-GEX {fmtB(d.totals.net_gex)} · {exps} exp
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2, color: d.regime.is_long_gamma ? C.green : C.red, textTransform: 'uppercase' as const }}>
                  {d.regime.label}
                </div>
              </div>
              <div style={{ textAlign: 'right' as const }}>
                <div style={{ fontSize: 8.5, color: C.t3, letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 5 }}>Structural Bias</div>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 2, color: d.regime.bias_color, textTransform: 'uppercase' as const }}>{d.regime.bias}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <MetricCard label="Spot" value={`$${fmt(d.spot)}`} sub={d.ticker} color={C.t1} />
              <MetricCard label="Net GEX" value={fmtB(d.totals.net_gex)} sub="Total Exposure" color={d.totals.net_gex >= 0 ? C.green : C.red} />
              <MetricCard label="Zero Gamma" value={`$${fmt(d.levels.gamma_flip)}`} sub="Dealer Flip" color={C.t2} />
              <MetricCard label="Call Wall" value={`$${fmt(d.levels.call_wall)}`} sub="Resistance" color={C.green} />
              <MetricCard label="Put Wall" value={`$${fmt(d.levels.put_wall)}`} sub="Support" color={C.red} />
              <MetricCard label="Max Pain" value={`$${fmt(d.levels.max_pain)}`} sub="Option Pain Target" color={C.amber} />
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <ExpoCard label="ATM IV" value={`${d.totals.atm_iv.toFixed(1)}%`} sub="Implied vol nearest exp" color={C.amber} />
              <ExpoCard label="DEX" value={fmtFlow(d.totals.dex)} sub="Delta exposure $" color={d.totals.dex >= 0 ? C.green : C.red} />
              <ExpoCard label="VEX" value={`${d.totals.vex.toFixed(2)}M`} sub="Vega exp · EOD signal" color={d.totals.vex >= 0 ? C.green : C.red} />
              <ExpoCard label="CEX" value={`${d.totals.cex.toFixed(2)}M`} sub="Charm exp · events" color={d.totals.cex >= 0 ? C.blue : C.violet} />
              <ExpoCard label="IV-RV" value={`${d.iv_rv_spread >= 0 ? '+' : ''}${d.iv_rv_spread}pp`} sub="IV minus Realized Vol" color={d.iv_rv_spread >= 0 ? C.green : C.red} />
              <ExpoCard label="Flow" value={`${(d.flow.ratio * 100).toFixed(1)}%`} sub={`Net: ${fmtFlow(d.flow.net)}`} color={d.flow.ratio >= 0.5 ? C.green : C.red} />
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['GEX', 'HEATMAP', '3D', 'REPLAY'] as RadarMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  onMouseEnter={() => setHoveredMode(m)}
                  onMouseLeave={() => setHoveredMode(null)}
                  style={{
                    padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer',
                    background: mode === m ? C.blue : hoveredMode === m ? C.bg2 : C.bg1,
                    color: mode === m ? C.bg : C.t3,
                    border: `1px solid ${mode === m ? C.blue : hoveredMode === m ? C.blue : C.line2}`,
                    transition: 'all 0.2s',
                  }}
                >
                  {m === 'GEX' ? 'OI GEX' : m}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12, marginBottom: 16 }}>
              {mode === 'GEX' && <GexChart agg={d.agg} spot={d.spot} levels={d.levels} />}
              {mode === 'HEATMAP' && <div style={{gridColumn: '1 / -1'}}><HeatmapChart data={d.raw} spotPrice={d.spot} /></div>}
              {mode === '3D' && <div style={{gridColumn: '1 / -1'}}><Landscape3DChart data={d.raw} spotPrice={d.spot} /></div>}
              {mode === 'REPLAY' && <div style={{gridColumn: '1 / -1', padding: 40, textAlign: 'center', background: C.bg1, border: `1px solid ${C.line2}`, borderRadius: 8, color: C.t3}}>El modo replay requiere datos hist\u00f3ricos (base de datos o CBOE intrad\u00eda en tiempo real).</div>}
              
              {mode === 'GEX' && (
                <div style={{ background: C.bg1, border: `1px solid ${C.line2}`, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.line}`, fontSize: 9, fontWeight: 600, color: C.t3, letterSpacing: 2, textTransform: 'uppercase' as const, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 14, height: 1, background: C.t1 }} />Key Levels
                  </div>
                  {[
                    { label: 'Spot', value: `$${fmt(d.spot)}`, color: C.t1 },
                    { label: 'Zero Gamma', value: `$${fmt(d.levels.gamma_flip)}`, color: C.t2 },
                    { label: 'Call Wall', value: `$${fmt(d.levels.call_wall)}`, color: C.green },
                    { label: 'Put Wall', value: `$${fmt(d.levels.put_wall)}`, color: C.red },
                    { label: 'Max Pain', value: `$${fmt(d.levels.max_pain)}`, color: C.amber },
                    { label: 'Vol Trigger', value: `$${fmt(d.levels.vol_trigger)}`, color: C.amber },
                    { label: d.levels.mom_wall ? 'Momentum Wall' : 'Momentum', value: d.levels.mom_wall ? `$${fmt(d.levels.mom_wall)}` : '—', color: C.blue },
                    { label: 'GEX Ratio', value: d.totals.gex_ratio.toFixed(3), color: C.t1 },
                    { label: 'Vol-GEX', value: fmtB(d.totals.net_vol_gex), color: d.totals.net_vol_gex >= 0 ? C.green : C.red },
                  ].map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 14px', borderBottom: `1px solid ${C.line}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: item.color }} />
                        <span style={{ fontSize: 10, fontWeight: 500, color: item.color }}>{item.label}</span>
                      </div>
                      <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 12, fontWeight: 600, color: item.color }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <KeyLevelsTable agg={d.agg} spot={d.spot} levels={d.levels} hoveredRow={hoveredRow} setHoveredRow={setHoveredRow} />

            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button 
                onClick={() => downloadCSV(d.agg, `${d.ticker}_gex_levels.csv`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: C.bg2, border: `1px solid ${C.line2}`,
                  borderRadius: 6, fontSize: 12, color: C.t1, cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace"
                }}
              >
                <Download size={16} /> Export CSV
              </button>
              
              <button 
                onClick={() => handleCopy(d.agg)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', 
                  background: copySuccess ? 'rgba(16,185,129,0.1)' : C.bg2, 
                  border: `1px solid ${copySuccess ? C.green : C.line2}`,
                  borderRadius: 6, fontSize: 12, color: copySuccess ? C.green : C.t1, 
                  cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace",
                  transition: 'all 0.2s'
                }}
              >
                <Copy size={16} /> {copySuccess ? 'Copiado!' : 'Copiar Tabla'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, fontSize: 10, color: C.t3, padding: '12px 0', borderTop: `1px solid ${C.line}` }}>
              <span>Data: CBOE (15 min delay)</span>
              <span>GEX = Γ × OI × Spot² × 0.01 / 1e9</span>
              <span>{d.timestamp ? new Date(d.timestamp).toLocaleTimeString() : ''}</span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
