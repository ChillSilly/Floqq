import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { 
  Activity, Zap, Crosshair, BarChart2, Info, RefreshCcw, 
  Target, TrendingUp, ChevronRight 
} from 'lucide-react';
import type { GexResult } from '../lib/gexEngine';
import { TICKERS } from '../lib/blackScholes';
import { GexMetricsTicker } from './GexMetricsTicker';
import { useGexMetrics } from '../hooks/useGexMetrics';

const C = {
  bg: 'var(--bg-app)', bg1: 'var(--bg-card)', bg2: 'var(--accent-surface)', bg3: 'var(--accent-surface)',
  line: 'var(--border-main)', line2: 'var(--border-main)',
  t1: 'var(--text-main)', t2: 'var(--text-secondary)', t3: 'var(--text-tertiary)',
  green: 'var(--success)', pink: 'var(--danger)', amber: 'var(--warning)', blue: 'var(--accent-main)', violet: 'var(--accent-secondary)',
};

function fmt(v: number, d = 2) { return v.toFixed(d); }
function fmtB(v: number) { return `${v >= 0 ? '+' : ''}${v.toFixed(3)}B`; }
function fmtFlow(v: number) {
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}

// ── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color, icon: Icon }: { 
  label: string; value: string; sub?: string; color: string; icon: any 
}) {
  return (
    <div className="flex-1 min-w-[160px] bg-card-primary border border-main-primary rounded-2xl p-5 relative overflow-hidden group hover:border-accent-primary/30 transition-all duration-300">
      <div className="absolute top-0 right-0 p-3 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
        <Icon size={48} style={{ color }} />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
        <div className="text-[10px] font-mono font-bold tracking-[0.2em] text-main-primary opacity-40 uppercase">{label}</div>
      </div>
      <div className="text-2xl font-mono font-bold tracking-tighter mb-1" style={{ color, textShadow: `0 0 20px ${color}22` }}>{value}</div>
      {sub && <div className="text-[10px] text-main-primary opacity-30 font-medium">{sub}</div>}
    </div>
  );
}

// ── Exposure Card ────────────────────────────────────────────────────────────
function ExpoCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="flex-1 min-w-[120px] bg-accent-surface border border-main-primary rounded-xl p-4 hover:border-accent-primary/20 transition-colors">
      <div className="text-[9px] font-mono font-bold text-main-primary opacity-20 uppercase tracking-widest mb-3">{label}</div>
      <div className="text-lg font-mono font-bold mb-1" style={{ color }}>{value}</div>
      <div className="text-[9px] text-main-primary opacity-30 truncate uppercase tracking-tighter">{sub}</div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export function GexDashboard() {
  const [ticker, setTicker] = useState('SPY');
  const [exps, setExps] = useState(1);
  const { data, loading, error } = useGexMetrics(ticker, exps, 60000);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    setCountdown(60);
  }, [data]);
  
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(p => (p <= 1 ? 60 : p - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const d = data;

  if (error) {
    return (
      <div className="p-8 bg-pink-500/10 border border-pink-500/20 rounded-2xl text-pink-500 font-mono text-sm">
        <div className="flex items-center gap-3 mb-2 font-bold uppercase tracking-widest">
           <Activity size={16} /> Error Relay
        </div>
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls & Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 pb-6 border-b border-main-primary">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-accent-primary shadow-[0_0_12px_var(--accent-glow)] animate-pulse" />
             <span className="text-[10px] font-mono font-bold tracking-[0.3em] text-accent-primary uppercase italic">System: Live Gex Engine</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <h1 className="text-4xl font-black tracking-tighter text-main-primary drop-shadow-[0_0_15px_var(--accent-glow)] uppercase italic">
              GEX <span className="text-transparent bg-clip-text bg-gradient-to-r from-main-primary to-main-primary/40">Terminal</span>
            </h1>
            <div className="flex items-center gap-2 p-1.5 bg-accent-surface rounded-xl border border-main-primary">
               {['SPY', 'QQQ', 'DIA', 'IWM', 'GLD'].map(t => (
                 <button 
                   key={t}
                   onClick={() => setTicker(t)}
                   className={`px-4 py-1.5 text-xs font-mono font-bold rounded-lg transition-all ${
                     ticker === t ? 'bg-accent-primary text-app-primary shadow-lg scale-105' : 'text-main-primary opacity-40 hover:text-main-primary opacity-60'
                   }`}
                 >
                   {t}
                 </button>
               ))}
               <select 
                 value={ticker} 
                 onChange={e => setTicker(e.target.value)}
                 className="bg-transparent text-[10px] font-mono font-bold text-main-primary opacity-60 outline-none px-2 cursor-pointer"
               >
                 {TICKERS.filter(t => !['SPY', 'QQQ', 'DIA', 'IWM', 'GLD'].includes(t)).map(t => (
                   <option key={t} value={t} className="bg-card-primary">{t}</option>
                 ))}
               </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-accent-surface rounded-lg p-1 border border-main-primary">
            {[1, 2, 4].map(n => (
              <button 
                key={n} 
                onClick={() => setExps(n)}
                className={`px-3 py-1 text-[10px] font-mono font-bold rounded transition-all ${
                  exps === n ? 'bg-accent-primary text-app-primary shadow-inner' : 'text-main-primary opacity-30 hover:text-main-primary opacity-50'
                }`}
              >
                {n} EXP
              </button>
            ))}
          </div>
          <div className="px-4 py-2 bg-brand-amber/10 border border-brand-amber/20 rounded-xl flex items-center gap-3">
             <RefreshCcw size={12} className="text-brand-amber animate-spin-slow" />
             <span className="text-[10px] font-mono font-bold text-brand-amber">REF:{countdown}s</span>
          </div>
        </div>
      </div>

      <GexMetricsTicker data={d} />
      
      {loading && !d ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 animate-pulse">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-32 bg-white/5 rounded-2xl" />)}
        </div>
      ) : d && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Main Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
             <MetricCard label="Spot Price" value={`$${fmt(d.spot)}`} sub={ticker} color={C.t1} icon={Crosshair} />
             <MetricCard label="Net GEX" value={fmtB(d.totals.net_gex)} sub="Total Exposure" color={d.totals.net_gex >= 0 ? C.green : C.pink} icon={Activity} />
             <MetricCard label="Gamma Flip" value={`$${fmt(d.levels.gamma_flip)}`} sub="Regime Pivot" color={C.amber} icon={Zap} />
             <MetricCard label="Call Wall" value={`$${fmt(d.levels.call_wall)}`} sub="Structural Resistance" color={C.green} icon={TrendingUp} />
             <MetricCard label="Put Wall" value={`$${fmt(d.levels.put_wall)}`} sub="Structural Support" color={C.pink} icon={TrendingUp} />
             <MetricCard label="Max Pain" value={`$${fmt(d.levels.max_pain)}`} sub="Dealer Target" color={C.blue} icon={Target} />
          </div>

          {/* Regime Banner */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
             <div className="lg:col-span-8 bg-card-primary border border-main-primary rounded-3xl p-8 relative overflow-hidden group">
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${d.regime.is_long_gamma ? 'from-green-500' : 'from-rose-500'} to-transparent opacity-50`} />
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <div className="text-[10px] font-mono font-bold text-main-primary opacity-30 uppercase tracking-[0.4em] mb-3">Market Structural Regime</div>
                    <div className={`text-4xl font-black italic uppercase tracking-tighter ${d.regime.is_long_gamma ? 'text-brand-emerald' : 'text-rose-500'} drop-shadow-[0_0_15px_currentColor]`}>
                      {d.regime.label}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-mono font-bold text-main-primary opacity-30 uppercase tracking-[0.2em] mb-2">Institutional Bias</div>
                    <div className="text-2xl font-black italic uppercase text-main-primary tracking-widest" style={{ color: d.regime.bias_color }}>
                      {d.regime.bias}
                    </div>
                  </div>
                </div>
                <div className="mt-8 pt-8 border-t border-main-primary grid grid-cols-2 sm:grid-cols-4 gap-8">
                  <div>
                    <div className="text-[9px] font-mono font-bold text-main-primary opacity-20 uppercase mb-2">ATM IV</div>
                    <div className="text-xl font-bold text-main-primary opacity-90">{d.totals.atm_iv.toFixed(1)}%</div>
                  </div>
                   <div>
                    <div className="text-[9px] font-mono font-bold text-main-primary opacity-20 uppercase mb-2">IV-RV Spread</div>
                    <div className={`text-xl font-bold ${d.iv_rv_spread >= 0 ? 'text-brand-emerald' : 'text-rose-500'}`}>{d.iv_rv_spread >= 0 ? '+' : ''}{d.iv_rv_spread}pp</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-mono font-bold text-main-primary opacity-20 uppercase mb-2">Order Flow</div>
                    <div className={`text-xl font-bold ${d.flow.ratio >= 0.5 ? 'text-brand-emerald' : 'text-rose-500'}`}>{(d.flow.ratio * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-mono font-bold text-main-primary opacity-20 uppercase mb-2">GEX Ratio</div>
                    <div className="text-xl font-bold text-main-primary opacity-90">{d.totals.gex_ratio.toFixed(2)}</div>
                  </div>
                </div>
             </div>

             <div className="lg:col-span-4 space-y-4">
                <div className="bg-card-primary border border-main-primary rounded-2xl p-6 h-full flex flex-col justify-between">
                   <div>
                      <div className="flex items-center gap-2 mb-6">
                        <BarChart2 size={16} className="text-accent-primary" />
                        <span className="text-[10px] font-mono font-bold text-main-primary opacity-40 uppercase tracking-widest">Exposure Deltas</span>
                      </div>
                      <div className="space-y-6">
                        <div className="flex justify-between items-center group">
                          <span className="text-xs text-main-primary opacity-40 font-medium">VEX (Vega Exp)</span>
                          <span className={`text-sm font-mono font-bold ${d.totals.vex >= 0 ? 'text-brand-emerald' : 'text-rose-500'}`}>{d.totals.vex.toFixed(2)}M</span>
                        </div>
                        <div className="flex justify-between items-center group">
                          <span className="text-xs text-main-primary opacity-40 font-medium">DEX (Delta Exp)</span>
                          <span className={`text-sm font-mono font-bold ${d.totals.dex >= 0 ? 'text-brand-emerald' : 'text-rose-500'}`}>{fmtFlow(d.totals.dex)}</span>
                        </div>
                         <div className="flex justify-between items-center group">
                          <span className="text-xs text-main-primary opacity-40 font-medium">CEX (Charm Exp)</span>
                          <span className="text-sm font-mono font-bold text-brand-purple">{d.totals.cex.toFixed(2)}M</span>
                        </div>
                      </div>
                   </div>
                   <div className="mt-8 p-4 bg-accent-surface border border-main-primary rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                         <Info size={12} className="text-main-primary opacity-20" />
                         <span className="text-[9px] font-mono font-bold text-main-primary opacity-30 uppercase">Intel Relay</span>
                      </div>
                      <p className="text-[10px] text-main-primary opacity-40 leading-relaxed italic">
                        Real-time CBOE chain processing active. Vanna/Gamma synchronization confirmed.
                      </p>
                   </div>
                </div>
             </div>
          </div>

          {/* Profiles Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <div className="bg-card-primary dark:bg-card-primary border border-main-primary rounded-3xl p-6">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <TrendingUp size={16} className="text-brand-emerald" />
                    <span className="text-[10px] font-mono font-bold text-main-primary opacity-60 uppercase tracking-widest text-brand-purple">Net Gamma Profile</span>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-main-primary opacity-20 uppercase tracking-tighter">Value in $B</span>
                </div>
                
                <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                   {d.agg.map((a: any, i: number) => {
                     const closestObj = d.agg.length ? d.agg.reduce((prev: any, curr: any) => Math.abs(curr.strike - d.spot) < Math.abs(prev.strike - d.spot) ? curr : prev) : null;
                     const isSpot = a.strike === closestObj?.strike;
                     const isWall = a.strike === d.levels.call_wall || a.strike === d.levels.put_wall;
                     const maxGex = Math.max(...d.agg.map(x => Math.abs(x.gex_net)));
                     const pct = (a.gex_net / maxGex) * 100;

                     return (
                       <div key={i} className={`flex items-center gap-4 h-6 px-3 rounded ${isSpot ? 'bg-accent-main/20 border border-accent-primary border-dashed !h-8 shadow-inner z-10 relative backdrop-blur-sm' : ''} hover:bg-white/5 transition-colors`}>
                         <span className={`w-12 text-[10px] font-mono font-bold ${isSpot ? 'text-[11px] text-accent-primary animate-pulse shadow-accent-primary drop-shadow-md' : isWall ? 'text-main-primary' : 'text-main-primary opacity-30'} text-right`}>
                            {isSpot && <span className="mr-1">▶</span>}
                            {a.strike.toFixed(0)}
                         </span>
                         <div className="flex-1 flex h-2 gap-0.5">
                            <div className="flex-1 flex justify-end">
                               {pct < 0 && <div className="h-full min-w-[2px] bg-rose-500 rounded-l-full shadow-[0_0_8px_rgba(239,68,68,0.4)]" style={{ width: `${Math.max(Math.abs(pct), 0.5)}%` }} />}
                            </div>
                            <div className="w-[1px] bg-main-primary opacity-10" />
                            <div className="flex-1">
                               {pct > 0 && <div className="h-full min-w-[2px] bg-brand-emerald rounded-r-full shadow-[0_0_8px_rgba(16,185,129,0.4)]" style={{ width: `${Math.max(pct, 0.5)}%` }} />}
                            </div>
                         </div>
                         <span className={`w-14 text-[9px] font-mono text-right ${a.gex_net >= 0 ? 'text-brand-emerald' : 'text-rose-500'}`}>{a.gex_net >= 0 ? '+' : ''}{a.gex_net.toFixed(3)}</span>
                       </div>
                     );
                   })}
                </div>
             </div>

             <div className="bg-card-primary dark:bg-card-primary border border-main-primary rounded-3xl p-0 overflow-hidden">
                <div className="p-6 border-b border-main-primary">
                   <div className="flex items-center gap-3">
                     <BarChart2 size={16} className="text-accent-primary" />
                     <span className="text-[10px] font-mono font-bold text-main-primary opacity-60 uppercase tracking-widest text-accent-primary">Strategic Vol-Triggers</span>
                   </div>
                </div>
                <div className="p-0">
                   <table className="w-full text-left font-mono">
                      <thead className="text-[9px] text-main-primary opacity-20 uppercase tracking-widest bg-black/5 dark:bg-white/5">
                        <tr>
                           <th className="px-6 py-4 font-bold">Indicator</th>
                           <th className="px-6 py-4 font-bold text-right">Coordinate</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs text-main-primary opacity-60">
                         {[
                           { name: 'Gamma Flip', val: `$${fmt(d.levels.gamma_flip)}`, color: C.amber },
                           { name: 'Call Wall', val: `$${fmt(d.levels.call_wall)}`, color: C.green },
                           { name: 'Put Wall', val: `$${fmt(d.levels.put_wall)}`, color: C.pink },
                           { name: 'Max Pain', val: `$${fmt(d.levels.max_pain)}`, color: C.blue },
                           { name: 'Vol Trigger', val: `$${fmt(d.levels.vol_trigger)}`, color: C.amber },
                           { name: 'Momentum Wall', val: d.levels.mom_wall ? `$${fmt(d.levels.mom_wall)}` : 'N/A', color: C.violet },
                         ].map((item, i) => (
                           <tr key={i} className="border-b border-main-primary/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                   <div className="w-1 h-1 rounded-full" style={{ background: item.color }} />
                                   {item.name}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right font-bold" style={{ color: item.color }}>{item.val}</td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                   <div className="p-6 bg-black/5 dark:bg-white/5">
                      <div className="text-[9px] font-mono text-main-primary opacity-20 leading-relaxed">
                        * Values indicate the expected institutional reaction zones. Vol-Trigger identifies the strike with maximum absolute volume-gamma concentration.
                      </div>
                   </div>
                </div>
             </div>
          </div>
          
          <div className="flex justify-between items-center text-[9px] font-mono text-main-primary opacity-20 pt-4 border-t border-main-primary/10">
             <div>Timestamp: {new Date(d.timestamp).toLocaleString()}</div>
             <div className="flex items-center gap-3">
                <span>CBOE Real-time Stream</span>
                <span className="text-main-primary opacity-40">v1.2.0-QuantTerminal</span>
             </div>
          </div>
        </motion.div>
      )}

      {loading && d && (
        <div className="fixed bottom-12 right-12 flex items-center gap-3 px-4 py-2 bg-black/80 backdrop-blur border border-white/10 rounded-full text-[10px] text-white/50 font-mono font-bold z-50">
           <RefreshCcw size={14} className="animate-spin text-[#00ffa3]" /> 
           Refreshing Engine Pipeline...
        </div>
      )}
    </div>
  );
}
