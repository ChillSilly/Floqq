import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { 
  Activity, Zap, Crosshair, BarChart2, Info, RefreshCcw, 
  Target, TrendingUp, TrendingDown, ChevronRight 
} from 'lucide-react';
import type { GexResult } from '../lib/gexEngine';
import { TICKERS } from '../lib/blackScholes';
import { GexMetricsTicker } from './GexMetricsTicker';
import { useGexMetrics } from '../hooks/useGexMetrics';
import { CboeMarketStatistics } from './CboeMarketStatistics';
import { UnusualOptionsActivity } from './UnusualOptionsActivity';

const C = {
  bg: 'var(--bg-app)', bg1: 'var(--bg-card)', bg2: 'var(--accent-surface)', bg3: 'var(--accent-surface)',
  line: 'var(--border-main)', line2: 'var(--border-main)',
  t1: 'var(--text-main)', t2: 'var(--text-secondary)', t3: 'var(--text-tertiary)',
  green: 'var(--success)', pink: 'var(--danger)', amber: 'var(--warning)', blue: 'var(--accent-main)', violet: 'var(--accent-secondary)', accent: 'var(--accent-main)',
};

function fmt(v: number, d = 2) { return v.toFixed(d); }
function fmtB(v: number) { return `${v >= 0 ? '+' : ''}${v.toFixed(3)}B`; }
function fmtExp(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${v >= 0 ? '+' : ''}${(v / 1e9).toFixed(3)}B`;
  if (abs >= 1e6) return `${v >= 0 ? '+' : ''}${(v / 1e6).toFixed(3)}M`;
  if (abs >= 1e3) return `${v >= 0 ? '+' : ''}${(v / 1e3).toFixed(1)}K`;
  return `${v >= 0 ? '+' : ''}${v.toFixed(0)}`;
}
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
    <div className="flex-1 min-w-0 bg-card-primary rounded-2xl p-4 sm:p-5 relative overflow-hidden group transition-all duration-500 shadow-lg shadow-black/20">
      <div className="absolute -top-4 -right-4 p-3 opacity-[0.03] group-hover:opacity-[0.1] transition-all duration-700 group-hover:scale-110">
        <Icon size={80} style={{ color }} />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 15px ${color}` }} />
        <div className="text-[9px] font-mono font-bold tracking-[0.25em] text-main-primary opacity-40 uppercase">{label}</div>
      </div>
      <div className="text-2xl font-mono font-bold tracking-tighter mb-1.5" style={{ color, textShadow: `0 0 25px ${color}11` }}>{value}</div>
      {sub && <div className="text-[9px] text-main-primary opacity-20 font-semibold tracking-wide uppercase">{sub}</div>}
      
      {/* Interactive scanline effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent h-1/2 w-full -translate-y-full group-hover:translate-y-[200%] transition-transform duration-1000 pointer-events-none" />
    </div>
  );
}

// ── Exposure Card ────────────────────────────────────────────────────────────
function ExpoCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="flex-1 min-w-0 bg-accent-surface/30 backdrop-blur-sm rounded-xl p-3 sm:p-4 transition-all duration-300 group">
      <div className="text-[8px] font-mono font-black text-main-primary opacity-20 uppercase tracking-[0.2em] mb-3 group-hover:opacity-40 transition-opacity">{label}</div>
      <div className="text-lg font-mono font-bold mb-1.5" style={{ color, textShadow: `0 0 15px ${color}11` }}>{value}</div>
      <div className="text-[8px] text-main-primary/30 font-bold truncate uppercase tracking-tighter group-hover:text-main-primary/50 transition-colors">{sub}</div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export function GexDashboard() {
  const [ticker, setTicker] = useState('SPY');
  const [exps, setExps] = useState(99);
  const { data, loading, error } = useGexMetrics(ticker, exps, 15 * 60 * 1000);
  const [countdown, setCountdown] = useState(900);
  const [marketStatus, setMarketStatus] = useState<any>(null);

  const fetchMarketStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/market-status');
      if (res.ok) {
        const d = await res.json();
        setMarketStatus(d);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchMarketStatus();
    const id = setInterval(fetchMarketStatus, 30000);
    return () => clearInterval(id);
  }, [fetchMarketStatus]);

  useEffect(() => {
    setCountdown(900);
  }, [data]);
  
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(p => (p <= 1 ? 900 : p - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const d = data;

  if (error) {
    return (
      <div className="p-8 bg-pink-500/10 rounded-2xl text-pink-500 font-mono text-sm">
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
      <div className="pb-6 relative overflow-hidden">
        {/* Ambient glow behind header */}
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-accent-primary/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="space-y-6 relative z-10">
          <div className="flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-accent-primary shadow-[0_0_15px_var(--accent-glow)] animate-pulse" />
             <span className="text-[8px] font-mono font-black tracking-[0.4em] text-accent-primary uppercase">Alpha Terminal — Institutional</span>
             <div className="h-[1px] w-12 bg-accent-primary/20" />
             {marketStatus && (
               <div 
                 className="flex items-center gap-2 px-2.5 py-0.5 rounded-full border text-[8px] font-mono font-black uppercase tracking-widest transition-all duration-500"
                 style={{ 
                   borderColor: `${marketStatus.color}44`, 
                   color: marketStatus.color,
                   backgroundColor: `${marketStatus.color}11`
                 }}
               >
                 <div className={`w-1 h-1 rounded-full ${marketStatus.isLive ? 'animate-pulse' : ''}`} style={{ backgroundColor: marketStatus.color }} />
                 {marketStatus.label} ({marketStatus.nyTime})
               </div>
             )}
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-x-10 gap-y-6">
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="space-y-0.5">
                <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tighter text-main-primary drop-shadow-md uppercase italic leading-none">
                  GEX <span className="text-accent-primary">Terminal</span>
                </h1>
                <div className="flex items-center gap-2 text-[8px] sm:text-[9px] font-bold text-main-primary/20 uppercase tracking-[0.2em] ml-1">
                  <Target size={10} className="opacity-50 shrink-0" />
                  <span className="truncate">Intraday Liquidity Analytics & Exposure Mapping</span>
                </div>
              </div>

              <div className="px-3 py-1.5 bg-brand-amber/5 border border-brand-amber/10 rounded-lg flex items-center gap-2 self-start group hover:bg-brand-amber/10 transition-all duration-300 shadow-lg">
                 <div className="relative">
                   <RefreshCcw size={8} className="text-brand-amber animate-spin-slow group-hover:rotate-180 transition-transform" />
                   <div className="absolute inset-0 bg-brand-amber/30 blur-[4px] rounded-full animate-pulse" />
                 </div>
                 <div className="flex items-center gap-2">
                   <span className="text-[8px] font-mono font-black text-brand-amber/60 leading-none tracking-widest uppercase">SYNC</span>
                   <span className="text-[10px] font-mono font-bold text-brand-amber tracking-tighter">
                    {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                  </span>
                 </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 relative z-10">
              {/* Refined Exps */}
              <div className="flex flex-col gap-1 w-full sm:w-auto">
                <span className="text-[7px] font-mono font-black text-main-primary/20 uppercase tracking-widest ml-1">Expiration</span>
                <div className="flex bg-accent-surface/30 backdrop-blur-xl rounded-lg p-1 shadow-xl border border-white/5 w-full sm:w-auto overflow-x-auto no-scrollbar">
                  {[0, 1, 2, 4, 8, 99].map(n => (
                    <button 
                      key={n} 
                      onClick={() => setExps(n)}
                      className={`flex-1 sm:flex-none px-2.5 py-1 text-[9px] font-mono font-bold rounded-md transition-all duration-400 whitespace-nowrap ${
                        exps === n 
                         ? 'bg-accent-primary text-app-primary shadow-lg scale-105' 
                         : 'text-main-primary opacity-30 hover:opacity-80 hover:bg-main-primary/5'
                      }`}
                    >
                      {n === 0 ? '0D' : n === 99 ? 'ALL' : `${n}E`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1 w-full sm:w-auto">
                <span className="text-[7px] font-mono font-black text-main-primary/20 uppercase tracking-widest ml-1">Ticker</span>
                <div className="flex items-center gap-1 p-1 bg-accent-surface/50 backdrop-blur-xl rounded-xl shadow-xl w-full sm:w-auto border border-white/5 overflow-x-auto no-scrollbar">
                   {['SPY', 'QQQ', 'DIA', 'IWM', 'GLD'].map(t => (
                     <button 
                       key={t}
                       onClick={() => setTicker(t)}
                       className={`flex-1 sm:flex-none px-4 sm:px-5 py-1.5 text-[9px] sm:text-[10px] font-mono font-bold rounded-lg transition-all duration-500 whitespace-nowrap ${
                         ticker === t 
                          ? 'bg-accent-primary text-app-primary shadow-[0_5px_15px_rgba(var(--color-accent-primary),0.3)] scale-105' 
                          : 'text-main-primary opacity-30 hover:opacity-100 hover:bg-main-primary/5'
                       }`}
                     >
                       {t}
                     </button>
                   ))}
                   <div className="w-[1px] h-4 bg-white/5 mx-2" />
                   <select 
                     value={ticker} 
                     onChange={e => setTicker(e.target.value)}
                     className="bg-transparent text-[10px] font-mono font-bold text-main-primary opacity-50 outline-none px-3 cursor-pointer hover:text-accent-primary transition-colors pr-1"
                   >
                     {TICKERS.filter(t => !['SPY', 'QQQ', 'DIA', 'IWM', 'GLD'].includes(t)).map(t => (
                       <option key={t} value={t} className="bg-app-primary text-main-primary">{t}</option>
                     ))}
                   </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <GexMetricsTicker data={d} />
      
      {loading && !d ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 animate-pulse">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-32 bg-white/5 rounded-2xl" />)}
        </div>
      ) : d && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Main Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
             <div className="sm:col-span-2 bg-accent-surface rounded-2xl p-4 sm:p-5 relative overflow-hidden group transition-all duration-300 shadow-[0_0_20px_rgba(var(--color-accent-primary),0.05)]">
               <div className="absolute top-0 right-0 p-3 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity">
                 <Crosshair size={64} style={{ color: C.t1 }} />
               </div>
               <div className="flex justify-between items-start mb-2">
                 <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: C.accent, boxShadow: `0 0 10px ${C.accent}` }} />
                   <div className="text-[11px] font-mono font-bold tracking-[0.2em] text-accent-primary uppercase">Spot Price</div>
                 </div>
                 <div className="px-2 py-0.5 bg-card-primary rounded text-[10px] font-bold text-main-primary opacity-60 flex items-center gap-2">
                   <span>🔴 15-MIN DELAY</span>
                   <span className="text-accent-primary">{ticker}</span>
                 </div>
               </div>
               <div className="flex items-baseline gap-3 mt-2">
                  <div className="text-3xl font-mono font-black tracking-tighter text-main-primary drop-shadow-md">
                    ${fmt(d.spot)}
                  </div>
                  {d.summary?.price_change_percent !== undefined && (
                    <div className={`text-sm font-bold font-mono tracking-tighter ${d.summary.price_change >= 0 ? 'text-brand-emerald' : 'text-rose-500'}`}>
                      {d.summary.price_change >= 0 ? '+' : ''}{fmt(d.summary.price_change)} ({d.summary.price_change >= 0 ? '+' : ''}{fmt(d.summary.price_change_percent)}%)
                    </div>
                  )}
               </div>
               
               {/* Detail Summary Grid */}
               {d.summary && (
                  <div className="grid grid-cols-4 gap-2 mt-4 pt-3">
                    <div>
                      <div className="text-[8px] font-mono font-bold text-main-primary/40 uppercase">High</div>
                      <div className="text-xs font-mono font-bold text-main-primary/80">{fmt(d.summary.high)}</div>
                    </div>
                    <div>
                      <div className="text-[8px] font-mono font-bold text-main-primary/40 uppercase">Low</div>
                      <div className="text-xs font-mono font-bold text-main-primary/80">{fmt(d.summary.low)}</div>
                    </div>
                    <div>
                      <div className="text-[8px] font-mono font-bold text-main-primary/40 uppercase">IV30</div>
                      <div className="text-xs font-mono font-bold text-main-primary/80">{fmt(d.summary.iv30)}%</div>
                    </div>
                    <div>
                      <div className="text-[8px] font-mono font-bold text-main-primary/40 uppercase">Volume</div>
                      <div className="text-xs font-mono font-bold text-main-primary/80">{fmtFlow(d.summary.volume)}</div>
                    </div>
                  </div>
               )}
             </div>
             
             <MetricCard label="Net GEX" value={fmtExp(d.totals.net_gex * 1e9)} sub="Gamma Exposure" color={d.totals.net_gex >= 0 ? C.green : C.pink} icon={Activity} />
             <MetricCard label="Net DEX" value={fmtExp(d.totals.dex)} sub="Delta Exposure" color={d.totals.dex >= 0 ? C.green : C.pink} icon={Activity} />
             <MetricCard label="Net Vanna" value={fmtExp(d.totals.vanna * 1e6)} sub="Vanna Exposure" color={d.totals.vanna >= 0 ? C.amber : C.pink} icon={Activity} />
             <MetricCard label="Net Charm" value={fmtExp(d.totals.cex * 1e6)} sub="Charm Exposure" color={d.totals.cex >= 0 ? C.amber : C.pink} icon={Activity} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             <MetricCard label="Gamma Flip" value={`$${fmt(d.levels.gamma_flip)}`} sub="Regime Pivot" color={C.amber} icon={Zap} />
             <MetricCard label="Call Wall" value={`$${fmt(d.levels.call_wall)}`} sub="Structural Resistance" color={C.green} icon={TrendingUp} />
             <MetricCard label="Put Wall" value={`$${fmt(d.levels.put_wall)}`} sub="Structural Support" color={C.pink} icon={TrendingDown} />
          </div>

          {/* Regime Banner */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
             <div className="lg:col-span-8 bg-card-primary shadow-2xl rounded-3xl p-6 sm:p-8 relative overflow-hidden group">
                <div className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r ${d.regime.is_long_gamma ? 'from-brand-emerald via-brand-emerald/50' : 'from-rose-500 via-rose-500/50'} to-transparent opacity-80`} />
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-10 relative z-10">
                  <div>
                    <div className="text-[9px] font-mono font-bold text-main-primary opacity-20 uppercase tracking-[0.4em] mb-3">Structural Market Regime</div>
                    <div className={`text-3xl sm:text-4xl md:text-5xl font-black italic uppercase tracking-tighter ${d.regime.is_long_gamma ? 'text-brand-emerald' : 'text-rose-500'} drop-shadow-[0_0_20px_currentColor]`}>
                      {d.regime.label}
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <div className="text-[9px] font-mono font-bold text-main-primary opacity-20 uppercase tracking-[0.2em] mb-3">Institutional Alpha Bias</div>
                    <div className="text-2xl sm:text-3xl font-black italic uppercase text-main-primary tracking-widest leading-none" style={{ color: d.regime.bias_color, textShadow: `0 0 30px ${d.regime.bias_color}44` }}>
                      {d.regime.bias}
                    </div>
                  </div>
                </div>
                <div className="mt-8 pt-8 grid grid-cols-2 sm:grid-cols-4 gap-6 md:gap-10 relative z-10">
                  {[
                    { label: 'ATM IV', val: `${d.totals.atm_iv.toFixed(1)}%`, color: 'text-main-primary' },
                    { label: 'IV-RV Spread', val: `${d.iv_rv_spread >= 0 ? '+' : ''}${d.iv_rv_spread}pp`, color: d.iv_rv_spread >= 0 ? 'text-brand-emerald' : 'text-rose-500' },
                    { label: 'Bullish Flow', val: `${(d.flow.ratio * 100).toFixed(1)}%`, color: d.flow.ratio >= 0.5 ? 'text-brand-emerald' : 'text-rose-500' },
                    { label: 'GEX Ratio', val: d.totals.gex_ratio.toFixed(2), color: 'text-main-primary' }
                  ].map((stat, i) => (
                    <div key={i}>
                      <div className="text-[8px] font-mono font-black text-main-primary opacity-20 uppercase tracking-widest mb-3">{stat.label}</div>
                      <div className={`text-2xl font-bold tracking-tight opacity-90 ${stat.color}`}>{stat.val}</div>
                    </div>
                  ))}
                </div>
             </div>

             <div className="lg:col-span-4 space-y-4">
                <div className="bg-card-primary shadow-2xl rounded-[2rem] p-8 h-full flex flex-col justify-between relative overflow-hidden group">
                   <div className="absolute inset-0 bg-gradient-to-tr from-accent-primary/5 to-transparent pointer-events-none" />
                   <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-8">
                        <div className="p-2 bg-accent-primary/10 rounded-lg">
                          <BarChart2 size={16} className="text-accent-primary" />
                        </div>
                        <span className="text-[10px] font-mono font-black text-main-primary opacity-30 uppercase tracking-[0.2em]">Exposure Greek Delta</span>
                      </div>
                      <div className="space-y-8">
                        {[
                          { label: 'VEX (Vega Exp)', val: fmtExp(d.totals.vex * 1e6), color: d.totals.vex >= 0 ? 'text-brand-emerald' : 'text-rose-500' },
                          { label: 'DEX (Delta Exp)', val: fmtExp(d.totals.dex), color: d.totals.dex >= 0 ? 'text-brand-emerald' : 'text-rose-500' },
                          { label: 'CEX (Charm Exp)', val: fmtExp(d.totals.cex * 1e6), color: 'text-brand-purple' }
                        ].map((greek, i) => (
                          <div key={i} className="flex justify-between items-center group/greek">
                            <span className="text-[11px] text-main-primary opacity-40 font-bold tracking-wide uppercase group-hover/greek:opacity-60 transition-opacity">{greek.label}</span>
                            <span className={`text-sm font-mono font-bold ${greek.color} drop-shadow-sm`}>{greek.val}</span>
                          </div>
                        ))}
                      </div>
                   </div>
                   <div className="mt-10 p-5 bg-accent-surface/30 backdrop-blur-md rounded-2xl relative z-10">
                      <div className="flex items-center gap-2 mb-3">
                         <div className="w-1 h-1 rounded-full bg-accent-primary animate-pulse" />
                         <span className="text-[8px] font-mono font-black text-main-primary opacity-20 uppercase tracking-widest">Global Intel Stream</span>
                      </div>
                      <p className="text-[10px] text-main-primary/40 font-medium leading-relaxed italic">
                        Real-time CBOE liquidity feeds synchronized. Mathematical cross-validation active.
                      </p>
                   </div>
                </div>
             </div>
          </div>

          {/* Profiles Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             <div className="bg-card-primary shadow-2xl rounded-[2.5rem] p-8 group">
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-brand-emerald/10 rounded-xl">
                       <TrendingUp size={18} className="text-brand-emerald" />
                    </div>
                    <div>
                      <span className="text-[11px] font-mono font-black text-main-primary/30 uppercase tracking-[0.2em] block mb-1">Exposure Heatmap</span>
                      <span className="text-[14px] font-bold text-main-primary tracking-tight">Net Gamma Profile</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-mono font-bold text-main-primary/20 uppercase tracking-widest block">Unit: Capital (Billions)</span>
                    <span className="text-[10px] font-mono text-accent-primary font-bold">Δ Gamma Focus</span>
                  </div>
                </div>
                
                <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
                   {d.agg.map((a: any, i: number) => {
                     const closestObj = d.agg.length ? d.agg.reduce((prev: any, curr: any) => Math.abs(curr.strike - d.spot) < Math.abs(prev.strike - d.spot) ? curr : prev) : null;
                     const isSpot = a.strike === closestObj?.strike;
                     const isWall = a.strike === d.levels.call_wall || a.strike === d.levels.put_wall;
                     const maxGex = Math.max(...d.agg.map(x => Math.abs(x.gex_net)));
                     const pct = (a.gex_net / maxGex) * 100;

                     return (
                       <div key={i} className={`flex items-center gap-5 px-4 rounded-xl group transition-all duration-300 ${isSpot ? 'bg-accent-primary/10 py-2.5 my-3 z-10 relative shadow-2xl backdrop-blur-md' : 'h-7 hover:bg-white/[0.03]'}`}>
                         <span className={`w-14 text-[11px] font-mono font-bold flex items-center justify-end gap-2 ${isSpot ? 'text-[14px] text-accent-primary drop-shadow-[0_0_12px_rgba(var(--color-accent-primary),1)]' : isWall ? 'text-main-primary' : 'text-main-primary opacity-30 group-hover:opacity-100'} text-right transition-all`}>
                            {isSpot && <span className="animate-pulse">▶</span>}
                            {a.strike.toFixed(0)}
                         </span>
                         <div className="flex-1 flex h-3 gap-0.5 items-center">
                            <div className="flex-1 flex justify-end h-full">
                               {pct < 0 && <div className="h-full min-w-[3px] bg-rose-500 rounded-l-full shadow-[0_0_12px_rgba(239,68,68,0.4)] opacity-90 transition-all duration-500 group-hover:opacity-100" style={{ width: `${Math.max(Math.abs(pct), 0.5)}%` }} />}
                            </div>
                            <div className={`w-[2px] h-[18px] mx-1 rounded-full ${isSpot ? 'bg-accent-primary shadow-[0_0_12px_var(--accent-glow)] scale-y-125' : 'bg-main-primary opacity-10'}`} />
                            <div className="flex-1 h-full">
                               {pct > 0 && <div className="h-full min-w-[3px] bg-brand-emerald rounded-r-full shadow-[0_0_12px_rgba(16,185,129,0.4)] opacity-90 transition-all duration-500 group-hover:opacity-100" style={{ width: `${Math.max(pct, 0.5)}%` }} />}
                            </div>
                         </div>
                         <span className={`w-16 text-[10px] font-mono text-right transition-all tracking-tighter ${isSpot ? 'text-[12px] font-black' : ''} ${a.gex_net >= 0 ? 'text-brand-emerald' : 'text-rose-500'}`}>{a.gex_net >= 0 ? '+' : ''}{a.gex_net.toFixed(3)}</span>
                       </div>
                     );
                   })}
                </div>
             </div>

             <div className="bg-card-primary shadow-2xl rounded-[2.5rem] overflow-hidden flex flex-col group">
                <div className="p-8 pb-6 bg-gradient-to-br from-white/[0.01] to-transparent">
                   <div className="flex items-center gap-4">
                     <div className="p-2.5 bg-accent-primary/10 rounded-xl">
                        <Activity size={18} className="text-accent-primary" />
                     </div>
                     <div>
                       <span className="text-[11px] font-mono font-black text-main-primary/30 uppercase tracking-[0.2em] block mb-1">Algorithmic Anchors</span>
                       <span className="text-[14px] font-bold text-main-primary tracking-tight">Institutional Alpha Benchmarks</span>
                     </div>
                   </div>
                </div>
               <div className="flex-1 flex flex-col">
                  <div className="grid grid-cols-2 px-8 py-4 text-[9px] font-black font-mono text-main-primary opacity-20 uppercase tracking-[0.3em]">
                     <div>Structural Indicator</div>
                     <div className="text-right">Coordinate / Price</div>
                  </div>
                  <div className="flex-1 overflow-auto custom-scrollbar">
                     {[
                       { name: 'Gamma Flip', val: d.levels.gamma_flip, color: C.amber, icon: Zap },
                       { name: 'Call Wall', val: d.levels.call_wall, color: C.green, icon: TrendingUp },
                       { name: 'Put Wall', val: d.levels.put_wall, color: C.pink, icon: TrendingUp },
                       { name: 'Max Pain', val: d.levels.max_pain, color: C.blue, icon: Target },
                       { name: 'Vol Trigger', val: d.levels.vol_trigger, color: C.amber, icon: RefreshCcw },
                       { name: 'Momentum Wall', val: d.levels.mom_wall, color: C.violet, icon: Activity },
                     ].map((item, i) => {
                       if (!item.val) return null;
                       return (
                         <div key={i} className="grid grid-cols-2 px-8 py-5 hover:bg-white/[0.02] transition-all duration-300 items-center group/row">
                            <div className="flex items-center gap-4">
                               <div className="w-1.5 h-1.5 rounded-full shadow-[0_0_10px_currentColor]" style={{ background: item.color, color: item.color }} />
                               <span className="font-mono font-bold text-[13px] tracking-tight group-hover/row:translate-x-1 transition-transform" style={{ color: item.color }}>{item.name}</span>
                            </div>
                            <div className="text-right">
                               <span className="text-[15px] font-mono font-black tracking-tighter" style={{ color: item.color, textShadow: `0 0 15px ${item.color}33` }}>${fmt(item.val)}</span>
                            </div>
                         </div>
                       )
                     })}
                  </div>
                  <div className="p-8 mt-auto bg-black/20">
                     <div className="text-[10px] font-mono text-main-primary/30 leading-relaxed italic rounded-2xl p-5 bg-white/[0.01] backdrop-blur-sm">
                       <span className="text-accent-primary font-bold not-italic font-mono uppercase mr-2 tracking-widest text-[9px] block mb-2">Quant Notes:</span>
                       Expected institutional reaction zones derived from open-interest concentration. Vol-Trigger identifies maximum volume-gamma density at current spot sensitivity.
                     </div>
                  </div>
               </div>
             </div>
          </div>
          
          <div className="mt-8">
             <UnusualOptionsActivity data={d} />
          </div>

          <div className="mt-8">
             <CboeMarketStatistics data={d} />
          </div>
          
          <div className="flex justify-between items-center text-[9px] font-mono text-main-primary pt-4 mt-8">
             <div className="opacity-20">Timestamp: {new Date(d.timestamp).toLocaleString()}</div>
             <div className="flex items-center gap-3">
                <span className="text-amber-500/70 bg-amber-500/10 px-2 py-0.5 rounded uppercase tracking-wider font-bold">15-Min Delayed (OPRA Free Tier Exemption)</span>
                <span className="text-purple-500/70 bg-purple-500/10 px-2 py-0.5 rounded uppercase tracking-wider font-bold">Kafka Pipeline</span>
                <span className="text-blue-500/70 bg-blue-500/10 px-2 py-0.5 rounded uppercase tracking-wider font-bold">ClickHouse OLAP</span>
                <span className="opacity-20">CBOE Stream</span>
                <span className="text-main-primary opacity-20">v1.2.0-QuantTerminal</span>
             </div>
          </div>
        </motion.div>
      )}

      {loading && d && (
        <div className="fixed bottom-12 right-12 flex items-center gap-3 px-4 py-2 bg-black/80 backdrop-blur rounded-full text-[10px] text-white/50 font-mono font-bold z-50">
           <RefreshCcw size={14} className="animate-spin text-[#00ffa3]" /> 
           Refreshing Engine Pipeline...
        </div>
      )}
    </div>
  );
}
