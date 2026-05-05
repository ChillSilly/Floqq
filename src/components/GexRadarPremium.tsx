import React, { useState, useEffect, useCallback } from 'react';
import { Download, Copy } from 'lucide-react';
import { downloadCSV, copyToClipboard } from '../lib/exportUtils';
import { HeatmapChart } from './HeatmapChart';
import { Landscape3DChart } from './Landscape3DChart';

import { useGexMetrics } from '../hooks/useGexMetrics';

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
      flex: '1 1 140px', background: 'var(--bg-card)',
      borderRadius: 10, padding: '16px 20px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    }} className="hover:scale-[1.02] hover:shadow-lg">
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 8, opacity: 0.8 }}>{label}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color, letterSpacing: -1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4, fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}

function ExpoCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ 
      flex: 1, minWidth: 120, background: 'var(--bg-card)', 
      borderRadius: 10, padding: '14px 16px',
      transition: 'all 0.2s ease',
    }} className="hover:bg-white/5 transition-colors">
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 600, color }}>{value}</div>
      <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 4, fontWeight: 500 }}>{sub}</div>
    </div>
  );
}

function GexChart({ agg, spot, levels }: { agg: any; spot: number; levels: any }) {
  if (!agg.length) return null;
  const maxAbs = Math.max(...agg.map((a: any) => Math.abs(a.gex_net)), 0.0001);
  const closestObj = agg.reduce((prev: any, curr: any) => Math.abs(curr.strike - spot) < Math.abs(prev.strike - spot) ? curr : prev);
  const closestStrike = closestObj?.strike;

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="w-1.5 h-4 bg-accent-primary rounded-full" />
        GEX Profile — Net Exposure per Strike
      </div>
      <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 500, overflowY: 'auto' }}>
        {agg.map((a: any, i: number) => {
          const pct = (a.gex_net / maxAbs) * 100;
          const isSpot = a.strike === closestStrike;
          const isLevel = a.strike === levels.call_wall || a.strike === levels.put_wall || a.strike === levels.gamma_flip;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12, height: isSpot ? 28 : 20,
              background: isSpot ? 'var(--accent-surface)' : isLevel ? 'rgba(255,255,255,0.02)' : 'transparent',
              borderRadius: 6, padding: '0 10px',
              transition: 'background 0.2s ease',
            }} className="group hover:bg-white/5">
              <span style={{
                width: 60, fontSize: isSpot ? 12 : 11, fontFamily: "'JetBrains Mono', monospace",
                color: isSpot ? 'var(--accent-main)' : a.strike === levels.call_wall ? 'var(--success)' : a.strike === levels.put_wall ? 'var(--danger)' : 'var(--text-secondary)',
                fontWeight: isSpot || isLevel ? 800 : 500, textAlign: 'right' as const, flexShrink: 0,
              }}>
                {isSpot && <span className="mr-2 inline-block animate-pulse text-accent-primary">▶</span>}
                {a.strike.toFixed(0)}
              </span>
              <div style={{ flex: 1, display: 'flex', height: 14, alignItems: 'center' }}>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', minWidth: 2 }}>
                  {pct < 0 && <div style={{
                    height: '8px',
                    width: `${Math.max(Math.min(Math.abs(pct), 100), 1)}%`, background: 'var(--danger)', borderRadius: 2,
                    opacity: isSpot ? 1 : 0.7, minWidth: 2,
                    boxShadow: Math.abs(pct) > 50 ? '0 0 8px var(--danger)' : 'none',
                  }} />}
                </div>
                <div style={{ width: 1, height: '18px', background: 'var(--border-main)', flexShrink: 0, margin: '0 4px', opacity: 0.5 }} />
                <div style={{ flex: 1, display: 'flex', minWidth: 2 }}>
                  {pct > 0 && <div style={{
                    height: '8px',
                    width: `${Math.max(Math.min(pct, 100), 1)}%`, background: 'var(--success)', borderRadius: 2,
                    opacity: isSpot ? 1 : 0.7, minWidth: 2,
                    boxShadow: pct > 50 ? '0 0 8px var(--success)' : 'none',
                  }} />}
                </div>
              </div>
              <span style={{
                width: 70, fontSize: isSpot ? 11 : 10, fontFamily: "'JetBrains Mono', monospace",
                color: a.gex_net >= 0 ? 'var(--success)' : 'var(--danger)', textAlign: 'right' as const, flexShrink: 0,
                fontWeight: isSpot ? 700 : 400, opacity: isSpot ? 1 : 0.8
              }}>
                {a.gex_net >= 0 ? '+' : ''}{a.gex_net.toFixed(3)}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 20, marginTop: 16, fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div className="w-2 h-2 rounded-full bg-accent-primary shadow-[0_0_8px_var(--accent-glow)]" /> SPOT</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div className="w-2 h-2 rounded-full bg-success" /> CALL WALL</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div className="w-2 h-2 rounded-full bg-danger" /> PUT WALL</span>
        <div style={{ flex: 1 }} />
        <span style={{ opacity: 0.6, fontStyle: 'italic' }}>Values in $Billions</span>
      </div>
    </div>
  );
}

function KeyLevelsTable({ agg, spot, levels, hoveredRow, setHoveredRow }: { agg: any; spot: number; levels: any; hoveredRow: number | null; setHoveredRow: (i: number | null) => void }) {
  const top = [...agg].sort((a: any, b: any) => Math.abs(b.gex_net) - Math.abs(a.gex_net)).slice(0, 10);
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
      <div style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 2, textTransform: 'uppercase' as const, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="w-1.5 h-4 bg-accent-secondary rounded-full" />
        Top 10 High-Impact GEX Strikes
      </div>
      <div className="overflow-x-auto">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
          <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
            <tr>
              {['Strike', 'Net GEX', 'Call GEX', 'Put GEX', 'OI', 'Dist %'].map(h => (
                <th key={h} style={{ padding: '12px 14px', fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 1.5, textTransform: 'uppercase' as const, textAlign: 'right' as const }}>{h}</th>
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
                  background: hoveredRow === i ? 'var(--bg-surface)' : 'transparent',
                  transition: 'all 0.2s ease',
                }}
                className="hover:text-accent-primary"
              >
                <td style={{ padding: '10px 14px', color: 'var(--text-main)', fontWeight: 600, textAlign: 'right' as const }}>${a.strike.toFixed(1)}</td>
                <td style={{ padding: '10px 14px', color: a.gex_net >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700, textAlign: 'right' as const }}>{fmtB(a.gex_net)}</td>
                <td style={{ padding: '10px 14px', color: 'var(--success)', textAlign: 'right' as const, opacity: 0.9 }}>+{a.call_gex.toFixed(3)}</td>
                <td style={{ padding: '10px 14px', color: 'var(--danger)', textAlign: 'right' as const, opacity: 0.9 }}>{a.put_gex.toFixed(3)}</td>
                <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', textAlign: 'right' as const, fontSize: 11 }}>{a.oi.toLocaleString()}</td>
                <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', textAlign: 'right' as const, fontSize: 11 }}>{a.dist_pct >= 0 ? '+' : ''}{a.dist_pct.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Skeleton({ h = 80 }: { h?: number }) {
  return <div style={{ height: h, background: `linear-gradient(90deg, ${C.bg1} 25%, ${C.bg2} 50%, ${C.bg1} 75%)`, backgroundSize: '200% 100%', borderRadius: 8, animation: 'shimmer 1.5s infinite' }} />;
}

export function GexRadarPremium() {
  const [ticker, setTicker] = useState('SPY');
  const [exps, setExps] = useState(1);
  const { data, loading, error, lastUpdated } = useGexMetrics(ticker, exps, 15000);
  const [countdown, setCountdown] = useState(15);
  const [mode, setMode] = useState<RadarMode>('GEX');
  const [hoveredMode, setHoveredMode] = useState<RadarMode | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopy = async (data: any[]) => {
    await copyToClipboard(data);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  useEffect(() => {
    setCountdown(15);
  }, [lastUpdated]);

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(p => (p <= 1 ? 15 : p - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const d = data;

  return (
    <div style={{ 
      background: 'var(--bg-app)', 
      minHeight: '100vh', 
      color: 'var(--text-main)', 
      fontFamily: "'Inter', system-ui, sans-serif", 
      width: '100%', 
      borderRadius: 12,
      position: 'relative'
    }}>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg-app/50 to-bg-app pointer-events-none" />
      <style>{`@keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }`}</style>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 24px 40px', position: 'relative', zIndex: 1 }}>

        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex items-center bg-card-primary rounded-lg overflow-hidden shadow-sm">
            <select 
              value={ticker} 
              onChange={e => setTicker(e.target.value)} 
              className="bg-transparent border-none py-2 px-4 text-xs font-bold font-mono tracking-widest outline-none cursor-pointer text-main-primary"
            >
              {TICKERS.map(t => <option key={t} value={t} className="bg-surface-primary">{t}</option>)}
            </select>
          </div>

          <div className="flex items-center bg-card-primary p-1 rounded-lg gap-1 shadow-sm">
            {[0, 1, 2, 3, 4].map(n => (
              <button 
                key={n} 
                onClick={() => setExps(n)} 
                className={`py-1.5 px-4 rounded-md text-[10px] font-bold font-mono transition-all duration-200 cursor-pointer ${
                  n === exps 
                    ? 'bg-accent-primary text-white shadow-md' 
                    : 'text-main-tertiary hover:text-main-primary hover:bg-surface-primary'
                }`}
              >
                {n === 0 ? '0 DTE' : `${n} EXP`}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-3 px-4 py-2 bg-card-primary rounded-full text-[10px] font-bold tracking-widest text-main-tertiary shadow-sm">
            <div className="relative flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
              <div className="absolute w-4 h-4 rounded-full bg-warning opacity-20 animate-ping" />
            </div>
            <span>INTEL UPDATING IN <span className="text-warning font-mono ml-1">{countdown}S</span></span>
          </div>
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
              background: 'var(--bg-card)', borderRadius: 12,
              padding: '24px 32px', marginBottom: 20, display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', position: 'relative', overflow: 'hidden',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, height: 4, width: '100%', background: `linear-gradient(90deg, ${d.regime.is_long_gamma ? 'var(--success)' : 'var(--danger)'} 0%, transparent 100%)`, opacity: 0.8 }} />
              <div>
                <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono'", color: 'var(--text-tertiary)', letterSpacing: 3, textTransform: 'uppercase' as const, marginBottom: 8, fontWeight: 600 }}>
                  {d.ticker} <span className="mx-2 text-main-tertiary/30">|</span> ${fmt(d.spot)} <span className="mx-2 text-main-tertiary/30">|</span> DI-GEX {fmtB(d.totals.net_gex)} <span className="mx-2 text-main-tertiary/30">|</span> {d.exps?.length ? d.exps.join(', ') : (exps === 0 ? '0 DTE' : `${exps} EXP`)}
                </div>
                <div style={{ fontWeight: 900, fontSize: '2.5rem', letterSpacing: 4, color: d.regime.is_long_gamma ? 'var(--success)' : 'var(--danger)', textTransform: 'uppercase' as const, filter: 'drop-shadow(0 0 8px currentColor)' }}>
                  {d.regime.label}
                </div>
              </div>
              <div style={{ textAlign: 'right' as const }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: 3, textTransform: 'uppercase' as const, marginBottom: 8, fontWeight: 600 }}>Structural Bias</div>
                <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 3, color: d.regime.bias_color, textTransform: 'uppercase' as const, padding: '4px 12px', borderRadius: 4, background: `${d.regime.bias_color}10` }}>{d.regime.bias}</div>
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
              {mode === 'REPLAY' && <div style={{gridColumn: '1 / -1', padding: 40, textAlign: 'center', background: C.bg1, borderRadius: 8, color: C.t3}}>El modo replay requiere datos hist\u00f3ricos (base de datos o CBOE intrad\u00eda en tiempo real).</div>}
              
              {mode === 'GEX' && (
                <div style={{ background: C.bg1, borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 2, textTransform: 'uppercase' as const, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.02)' }}>
                    <div className="w-4 h-0.5 bg-text-main" />Institutional Key Levels
                  </div>
                  <div className="p-0">
                    <table className="w-full text-left font-mono">
                      <thead className="text-[10px] uppercase tracking-widest" style={{color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.01)'}}>
                        <tr>
                          <th className="px-6 py-4 font-bold">Indicator</th>
                          <th className="px-6 py-4 font-bold text-right">Coordinate</th>
                        </tr>
                      </thead>
                      <tbody className="text-[11px]" style={{color: 'var(--text-main)'}}>
                        {[
                          { label: 'Spot', value: `$${fmt(d.spot)}`, color: 'var(--text-main)', glow: true },
                          { label: 'Zero Gamma', value: `$${fmt(d.levels.gamma_flip)}`, color: 'var(--text-secondary)', glow: false },
                          { label: 'Call Wall', value: `$${fmt(d.levels.call_wall)}`, color: 'var(--success)', glow: true },
                          { label: 'Put Wall', value: `$${fmt(d.levels.put_wall)}`, color: 'var(--danger)', glow: true },
                          { label: 'Max Pain', value: `$${fmt(d.levels.max_pain)}`, color: 'var(--warning)', glow: false },
                          { label: 'Vol Trigger', value: `$${fmt(d.levels.vol_trigger)}`, color: 'var(--warning)', glow: false },
                          { label: d.levels.mom_wall ? 'Momentum Wall' : 'Momentum', value: d.levels.mom_wall ? `$${fmt(d.levels.mom_wall)}` : '—', color: 'var(--accent-main)', glow: false },
                          { label: 'GEX Ratio', value: d.totals.gex_ratio.toFixed(3), color: 'var(--text-secondary)', glow: false },
                          { label: 'Vol-GEX', value: fmtB(d.totals.net_vol_gex), color: d.totals.net_vol_gex >= 0 ? 'var(--success)' : 'var(--danger)', glow: false },
                        ].map((item, i) => (
                          <tr key={i} className={`transition-colors hover:bg-white/[0.02] ${i === 8 ? '' : ''}`}>
                            <td className="px-6 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="w-1 h-1 rounded-full" style={{ background: item.color, boxShadow: item.glow ? `0 0 6px ${item.color}` : 'none' }} />
                                <span className="font-bold tracking-tight" style={{ color: item.color, opacity: item.glow ? 1 : 0.8 }}>{item.label}</span>
                              </div>
                            </td>
                            <td className="px-6 py-3.5 text-right font-bold" style={{ color: item.color, textShadow: item.glow ? `0 0 8px ${item.color}40` : 'none' }}>{item.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <KeyLevelsTable agg={d.agg} spot={d.spot} levels={d.levels} hoveredRow={hoveredRow} setHoveredRow={setHoveredRow} />

            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button 
                onClick={() => downloadCSV(d.agg, `${d.ticker}_gex_levels.csv`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: C.bg2,
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
                  borderRadius: 6, fontSize: 12, color: copySuccess ? C.green : C.t1, 
                  cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace",
                  transition: 'all 0.2s'
                }}
              >
                <Copy size={16} /> {copySuccess ? 'Copiado!' : 'Copiar Tabla'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, fontSize: 10, color: C.t3, padding: '12px 0' }}>
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
