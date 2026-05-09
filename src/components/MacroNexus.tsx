import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, TrendingUp, TrendingDown, Clock, Shield, Globe, Cpu, Zap, Target, Search, RefreshCcw, Info, BarChart3, LineChart, PieChart, ShieldAlert, Binary, Layers, Book } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart as ReLineChart, Line, BarChart, Bar, Cell } from 'recharts';

interface MacroIndicator {
  name: string;
  status: string;
  value: string;
  implication: string;
  trend?: number[];
  change?: string;
  importance?: number;
}

interface MacroSynthesis {
  regime: string;
  regimeScore: number;
  narrative: string;
  statusMsg: string;
  detailedReport?: string;
  keyIndicators: MacroIndicator[];
  economicCalendar: {
    event: string;
    date: string;
    impact: string;
    forecast: string;
  }[];
  policyWatch: {
    fed: string;
    action: string;
    nextMeeting: string;
    quantTightening: string;
  };
  assetClassViews: {
    equities: string;
    fixed_income: string;
    commodities: string;
    forex_carry: string;
  };
  riskAudit: string[];
  sectors: {
    name: string;
    performance: number;
    status: string;
  }[];
  playbook: {
    direction: { summary: string; details: string; biasScore: number };
    volatility: { summary: string; details: string };
    positionSize: { summary: string; details: string };
    macroRange: { summary: string; details: string };
    optionsPricing: { label: string; val: string; sub: string }[];
    vixIntelligence: {
      actual: number;
      fair: number;
      status: string;
      details: string;
      signal: string;
    };
    recommendedStrategies: {
      name: string;
      confidence: string;
      details: string;
    }[];
    liquidityTrend: {
      date: string;
      value: number;
      description: string;
    }[];
  };
}

interface BenchmarkData {
  price: number;
  change: number;
  changePercent: number;
  symbol: string;
  error?: boolean;
}

import { TradingViewWidget } from './TradingViewWidget';
import Markdown from 'react-markdown';

interface MacroNexusProps {
  activeTicker: string;
  spotPrice: number;
  netGex: number;
  chartData: any[];
  isDarkTheme?: boolean;
}

export const MacroNexus: React.FC<MacroNexusProps> = ({ activeTicker, spotPrice, netGex, chartData, isDarkTheme = false }) => {
  const isDark = isDarkTheme;
  const [synthesis, setSynthesis] = useState<MacroSynthesis | null>(null);
  const [benchmarks, setBenchmarks] = useState<Record<string, BenchmarkData>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSynthesis, setIsLoadingSynthesis] = useState(false);
  const [activeTab, setActiveTab] = useState<'playbook' | 'synthesis' | 'technical' | 'indicators' | 'yields' | 'liquidity' | 'sectors'>('playbook');
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [chartInterval, setChartInterval] = useState('15');
  const [chartSymbol, setChartSymbol] = useState(activeTicker || 'NASDAQ:QQQ');
  const [symbolInput, setSymbolInput] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (symbolInput.trim()) {
      setChartSymbol(symbolInput.toUpperCase());
    }
  };

  useEffect(() => {
    if (activeTicker) {
      setChartSymbol(activeTicker);
    }
  }, [activeTicker]);

  useEffect(() => {
    const fetchBenchmarks = async () => {
      try {
        const benchRes = await fetch('/api/macro/benchmarks');
        if (benchRes.ok) setBenchmarks(await benchRes.json());
      } catch (e) { console.error(e); }
      finally { setIsLoading(false); }
    };
    fetchBenchmarks();
  }, []);

  useEffect(() => {
    const fetchSynthesis = async () => {
      setIsLoadingSynthesis(true);
      try {
        const synthRes = await fetch(`/api/macro/synthesis?symbol=${chartSymbol}`);
        if (synthRes.ok) {
          const data = await synthRes.json();
          setSynthesis(data);
        }
      } catch (error) {
        console.error('Fetch Synthesis Error:', error);
      } finally {
        setIsLoadingSynthesis(false);
      }
    };

    fetchSynthesis();
    const interval = setInterval(fetchSynthesis, 600000); // 10 mins
    return () => clearInterval(interval);
  }, [chartSymbol]);

  const getStatusColor = (status: string) => {
    if (!status) return 'text-main-primary opacity-40';
    const s = status.toLowerCase();
    if (['expansion', 'hot', 'bullish', 'strong', 'hawkish', 'accelerating', 'expanding', 'favorable', 'soft landing', 'stable', 'overweight', 'tightening', 'high conviction'].includes(s)) return 'text-brand-emerald';
    if (['recession', 'bearish', 'weak', 'dovish', 'declining', 'cooling', 'contracting', 'unfavorable', 'underweight', 'widening', 'low conviction'].includes(s)) return 'text-rose-500';
    return 'text-brand-amber';
  };

  const getRegimeIcon = (regime: string) => {
    switch (regime) {
      case 'Expansion': return <TrendingUp size={16} className="text-emerald-400" />;
      case 'Recession': return <TrendingDown size={16} className="text-rose-400" />;
      case 'Stagflation': return <ShieldAlert size={16} className="text-amber-400" />;
      case 'Soft Landing': return <Target size={16} className="text-emerald-400" />;
      default: return <Activity size={16} className="text-blue-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner: Macro Context - More compact */}
      <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: 'DXY INDEX', key: 'DXY', icon: Globe },
          { label: 'VIX INTENSITY', key: 'VIX', icon: Activity },
          { label: '10Y YIELD', key: 'US10Y', icon: Target },
          { label: 'HIGH YIELD (HYG)', key: 'HYG', icon: ShieldAlert },
          { label: 'BITCOIN SPOT', key: 'BTC', icon: Binary },
          { label: 'COPPER % GOLD', key: 'HG_GC_RATIO', icon: Zap },
        ].map((item) => (
          <div key={item.key} className="bg-black/20 border border-white/5 p-3 rounded-lg flex flex-col justify-between hover:border-accent-primary/40 transition-colors group">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-mono font-bold text-main-primary/40 tracking-wider group-hover:text-accent-primary transition-colors">{item.label}</span>
              <item.icon size={10} className="text-main-primary/20" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm sm:text-base font-mono font-bold text-main-primary truncate pr-1">
                {benchmarks[item.key]?.price ? benchmarks[item.key].price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---'}
              </span>
              <span className={`text-[10px] font-mono font-bold ${benchmarks[item.key]?.change >= 0 ? 'text-brand-emerald' : 'text-rose-500'}`}>
                {benchmarks[item.key]?.changePercent ? `${benchmarks[item.key].changePercent > 0 ? '▲' : '▼'}${Math.abs(benchmarks[item.key].changePercent).toFixed(2)}%` : ''}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Macro Pulse (lg:col-span-3) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-black/30 border border-white/10 rounded-xl overflow-hidden flex flex-col h-full shadow-2xl">
            <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-accent-primary animate-pulse shadow-[0_0_8px_var(--accent-glow)]" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-main-primary/60">Neural Pulse</span>
              </div>
              {isLoadingSynthesis ? (
                 <RefreshCcw size={12} className="text-accent-primary animate-spin" />
              ) : (
                 <div className="flex items-center gap-1.5 px-2 py-0.5 bg-accent-primary/10 rounded-md border border-accent-primary/20">
                    <span className="text-[8px] font-mono font-bold text-accent-primary uppercase tracking-tighter">{chartSymbol} ANALYSIS</span>
                 </div>
              )}
            </div>

            <div className="p-5 space-y-6 flex-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCcw size={24} className="text-accent-primary/20 animate-spin" />
                </div>
              ) : synthesis ? (
                <>
                  {/* Regime */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono font-bold text-main-primary/30 uppercase tracking-widest">Market Regime</span>
                      <span className="text-[9px] font-mono font-bold px-2 py-0.5 bg-accent-primary/10 text-accent-primary rounded-md ring-1 ring-accent-primary/30">CONF: {synthesis.regimeScore}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {getRegimeIcon(synthesis.regime)}
                      <h3 className={`text-2xl font-mono font-bold tracking-tighter uppercase ${getStatusColor(synthesis.regime)}`}>
                        {synthesis.regime}
                      </h3>
                    </div>
                    <p className="text-[11px] text-main-primary/50 leading-relaxed font-sans italic pt-2 border-l-2 border-white/5 pl-3">
                      "{synthesis.narrative}"
                    </p>
                  </div>

                  {/* Policy */}
                  <div className="space-y-3 pt-6 border-t border-white/5">
                    <span className="text-[9px] font-mono font-bold text-main-primary/30 uppercase tracking-[0.25em]">Policy & Liquidity</span>
                    <div className="grid grid-cols-1 gap-2">
                       <div className="p-3 bg-white/5 rounded-xl border border-white/5 group/policy">
                          <div className="flex justify-between items-center mb-2">
                             <span className="text-[9px] font-mono font-bold text-white/30 uppercase">Fed Stance</span>
                             <span className={`text-[10px] font-mono font-bold ${getStatusColor(synthesis.policyWatch.fed)}`}>{synthesis.policyWatch.fed}</span>
                          </div>
                          <div className="flex gap-1 h-1.5">
                             {[1,2,3,4,5,6,7,8].map(i => (
                               <div key={i} className={`flex-1 rounded-full ${i <= 6 ? (synthesis.policyWatch.fed.includes('Hawkish') ? 'bg-rose-500/40' : 'bg-brand-emerald/40') : 'bg-white/5'}`} />
                             ))}
                          </div>
                       </div>
                       <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                          <div className="flex justify-between items-center mb-2">
                             <span className="text-[9px] font-mono font-bold text-white/30 uppercase">Net Liquidity</span>
                             <span className="text-[10px] font-mono font-bold text-brand-amber">STRESSED</span>
                          </div>
                          <div className="flex items-end gap-1 h-8">
                             {[0.4, 0.6, 0.5, 0.8, 0.7, 0.9, 0.75].map((v, i) => (
                               <div key={i} className="flex-1 bg-brand-emerald/20 rounded-t-[2px]" style={{ height: `${v * 100}%` }} />
                             ))}
                          </div>
                       </div>
                    </div>
                  </div>

                  {/* Yield Spreads - PREVIOUSLY EMPTY SPACE FILLER */}
                  <div className="space-y-3 pt-6 border-t border-white/5">
                    <span className="text-[9px] font-mono font-bold text-main-primary/30 uppercase tracking-[0.25em]">Yield Spread Matrix</span>
                    <div className="grid grid-cols-2 gap-2">
                       {[
                         { name: '2s10s', value: '-32bps', status: 'Inverted' },
                         { name: '3m10y', value: '-124bps', status: 'Deep Inversion' },
                         { name: '5s30s', value: '+12bps', status: 'Flattening' },
                         { name: 'Fed vs 2Y', value: '-45bps', status: 'Tight' }
                       ].map(spread => (
                         <div key={spread.name} className="p-2.5 bg-black/20 rounded-lg border border-white/5 hover:border-accent-primary/30 transition-all group/spread">
                            <span className="text-[8px] font-mono font-bold text-white/20 uppercase block tracking-tighter group-hover/spread:text-accent-primary">{spread.name}</span>
                            <div className="flex justify-between items-center mt-1">
                               <span className={`text-[10px] font-mono font-bold ${spread.value.startsWith('-') ? 'text-rose-500' : 'text-brand-emerald'}`}>{spread.value}</span>
                               <Info size={8} className="text-white/10 group-hover/spread:text-white/30" />
                            </div>
                         </div>
                       ))}
                    </div>
                  </div>

                  {/* Bias Analysis */}
                  <div className="space-y-3 pt-6 border-t border-white/5">
                    <span className="text-[9px] font-mono font-bold text-main-primary/30 uppercase tracking-[0.25em]">Tactical Lean</span>
                    <div className="grid grid-cols-2 gap-2 pb-2">
                       {Object.entries(synthesis.assetClassViews || {}).map(([asset, view]) => (
                         <div key={asset} className="flex flex-col p-2.5 bg-black/20 rounded-lg border border-white/10">
                           <span className="text-[8px] font-mono font-bold uppercase text-main-primary/20 truncate mb-1">{asset.replace('_', ' ')}</span>
                           <span className={`text-[10px] font-bold font-mono ${getStatusColor(view as string)}`}>{view as string}</span>
                         </div>
                       ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="p-3 bg-black/40 border-t border-white/5 flex flex-col gap-2">
               <div className="flex justify-between items-center">
                  <span className="text-[7px] font-mono font-bold text-main-primary/30 uppercase">Risk Index</span>
                  <span className="text-[9px] font-mono font-bold text-rose-500">CRITICAL</span>
               </div>
               <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: '85%' }} className="h-full bg-rose-500 shadow-[0_0_8px_theme(colors.rose.500)]" />
               </div>
            </div>
          </div>
        </div>

        {/* Center-Right Column: Core Dynamics (lg:col-span-9) - MAXIMIZED WIDTH */}
        <div className="lg:col-span-9 flex flex-col gap-4">
          <div className="bg-black/30 border border-white/10 rounded-xl overflow-hidden flex-1 flex flex-col shadow-2xl">
            <div className="flex border-b border-white/5 bg-white/5">
              {['playbook', 'technical', 'yields', 'liquidity'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`px-6 sm:px-10 py-5 text-[11px] font-mono font-bold uppercase tracking-[0.3em] transition-all relative ${
                    activeTab === tab ? 'text-accent-primary bg-accent-primary/10' : 'text-main-primary opacity-30 hover:opacity-100 hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-2 sm:gap-3">
                     {tab === 'playbook' ? <Book size={14} /> : tab === 'technical' ? <Search size={14} /> : tab === 'yields' ? <LineChart size={14} /> : <Layers size={14} />}
                     {tab === 'technical' ? 'Terminal' : tab === 'playbook' ? 'Daily Playbook' : tab}
                  </span>
                  {activeTab === tab && (
                    <motion.div layoutId="macro-tab-indicator" className="absolute bottom-0 left-0 w-full h-1 bg-accent-primary shadow-[0_0_20px_var(--accent-glow)]" />
                  )}
                </button>
              ))}
              <div className="ml-auto flex items-center px-6 gap-6">
                 <div className="hidden lg:flex items-center gap-4 bg-black/40 px-5 py-2 rounded-xl border border-white/10 shadow-inner">
                    <div className="flex items-center gap-2">
                       <RefreshCcw size={14} className="text-brand-emerald animate-spin-slow" />
                       <span className="text-[11px] font-mono font-bold text-brand-emerald tracking-tighter">CROSS-ASSET SYNC: NOMINAL</span>
                    </div>
                 </div>
                 <button 
                  onClick={() => setIsReportOpen(true)}
                  className="p-3 hover:bg-accent-primary/20 rounded-xl transition-all text-accent-primary group border border-accent-primary/20 shadow-lg"
                 >
                    <Book size={18} className="group-hover:scale-110 transition-transform" />
                 </button>
              </div>
            </div>

            <div className="p-4 flex-1">
              <AnimatePresence mode="wait">
                {activeTab === 'playbook' && (
                  <motion.div key="playbook" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col gap-4">
                     {/* Daily Playbook Header */}
                     <div className="flex items-center justify-between p-3 border border-accent-primary/20 bg-accent-primary/5 rounded-xl">
                        <div className="flex items-center gap-4">
                           <span className="text-[12px] font-mono font-bold text-accent-primary uppercase tracking-[0.2em] flex items-center gap-2"><Book size={14}/> DAILY PLAYBOOK</span>
                           <div className="flex items-center gap-3 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
                              <span className="text-[12px] font-mono font-bold text-white uppercase">{chartSymbol}</span>
                              <span className="text-[12px] font-mono font-bold text-brand-emerald">${(spotPrice || 0).toFixed(2)}</span>
                           </div>
                        </div>
                        <span className="text-[9px] font-mono font-bold text-white/30 uppercase tracking-[0.2em]">{synthesis?.regime || 'HAWKISH'} [+2]</span>
                     </div>

                     {/* The 7 Pillars */}
                     <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
                        {[
                          { title: '1. DIRECTION', val: synthesis?.playbook?.direction?.summary || 'N/A', sub: synthesis?.playbook?.direction?.details || 'Awaiting data', color: 'text-rose-500' },
                          { title: '2. VOLATILITY', val: synthesis?.playbook?.volatility?.summary || 'N/A', sub: synthesis?.playbook?.volatility?.details || 'Awaiting data', color: 'text-accent-primary' },
                          { title: '3. POSITION SIZE', val: synthesis?.playbook?.positionSize?.summary || 'N/A', sub: synthesis?.playbook?.positionSize?.details || 'Awaiting data', color: 'text-rose-500' },
                          { title: '4. STRATEGY', val: synthesis?.playbook?.recommendedStrategies?.[0]?.name || 'N/A', sub: synthesis?.playbook?.recommendedStrategies?.[1]?.name || 'Awaiting data', color: 'text-accent-primary' },
                          { title: '5. MACRO RANGE', val: synthesis?.playbook?.macroRange?.summary || 'N/A', sub: synthesis?.playbook?.macroRange?.details || 'Awaiting data', color: 'text-brand-emerald' },
                          { title: '6. SECTOR CONTEXT', val: `Best: ${[...(synthesis?.sectors || [])].sort((a,b)=>b.performance-a.performance)[0]?.name || 'N/A'}`, sub: `Worst: ${[...(synthesis?.sectors || [])].sort((a,b)=>a.performance-b.performance)[0]?.name || 'N/A'}`, color: 'text-brand-emerald' },
                          { title: '7. RISK EVENTS (7D)', val: synthesis?.economicCalendar?.[0]?.event || 'N/A', sub: synthesis?.economicCalendar?.[1]?.event || 'N/A', color: 'text-brand-amber' },
                        ].map((item, i) => (
                           <div key={i} className="p-3 bg-black/20 border border-white/5 rounded-xl flex flex-col justify-between hover:border-white/20 transition-all">
                              <span className="text-[9px] font-mono font-bold text-white/30 uppercase tracking-widest">{item.title}</span>
                              <div className="mt-2 text-left">
                                 <span className={`block text-[11px] sm:text-xs font-mono font-bold ${item.color} tracking-tighter truncate`}>{item.val}</span>
                                 <span className="block text-[9px] font-mono text-white/40 mt-1 truncate">{item.sub}</span>
                              </div>
                           </div>
                        ))}
                     </div>

                     <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1">
                        {/* Options Event Pricing & VIX */}
                        <div className="flex flex-col gap-4">
                           <div className="p-4 bg-black/20 border border-white/5 rounded-xl">
                              <span className="text-[10px] font-mono font-bold text-accent-primary uppercase tracking-[0.2em] mb-4 block">OPTIONS EVENT PRICING</span>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                 {(synthesis?.playbook?.optionsPricing || [
                                   { label: 'EXPECTED MOVE (2D)', val: 'N/A', sub: '' },
                                   { label: 'IV TERM STRUCTURE', val: 'N/A', sub: '' },
                                   { label: 'PUT/CALL SKEW', val: 'N/A', sub: '' },
                                   { label: 'P/C OI RATIO', val: 'N/A', sub: '' },
                                   { label: 'MAX PAIN', val: 'N/A', sub: '' },
                                 ]).map((opt: any, i: number) => (
                                    <div key={i} className="flex flex-col border-l-2 border-white/5 pl-3">
                                       <span className="text-[8px] font-mono font-bold text-white/30 uppercase">{opt.label}</span>
                                       <span className="text-sm font-mono font-bold text-white mt-1">{opt.val}</span>
                                       <span className={`text-[8px] font-mono mt-0.5 ${(opt.sub||'').includes('Fear') || (opt.sub||'').includes('Bearish') ? 'text-rose-500' : 'text-white/40'}`}>{opt.sub}</span>
                                    </div>
                                 ))}
                              </div>
                           </div>
                           
                           <div className="p-4 bg-black/20 border border-white/5 rounded-xl flex-1 flex flex-col justify-between">
                              <span className="text-[10px] font-mono font-bold text-accent-primary uppercase tracking-[0.2em] mb-4 block">VIX INTELLIGENCE</span>
                              <div className="flex items-center gap-6">
                                 <span className="text-4xl justify-center font-mono font-bold text-accent-primary">{synthesis?.playbook?.vixIntelligence?.actual?.toFixed(2) || 'N/A'}</span>
                                 <div>
                                    <span className="text-[10px] font-mono font-bold text-white block">{synthesis?.playbook?.vixIntelligence?.status || 'N/A'}</span>
                                    <span className="text-[9px] font-mono text-white/40">{synthesis?.playbook?.vixIntelligence?.details || 'Awaiting logic'}</span>
                                 </div>
                              </div>
                              <div className="mt-4 space-y-2">
                                 <div className="flex justify-between text-[9px] font-mono text-white/40"><span className="text-brand-emerald">Fair: {synthesis?.playbook?.vixIntelligence?.fair?.toFixed(2) || 'N/A'}</span><span className="text-accent-primary">Actual: {synthesis?.playbook?.vixIntelligence?.actual?.toFixed(2) || 'N/A'}</span></div>
                                 <div className="w-full h-1.5 bg-white/5 rounded-full relative">
                                    <div className="absolute left-[30%] w-1.5 h-3 -top-[3px] bg-brand-emerald rounded-full" />
                                    <div className="absolute left-[15%] w-1.5 h-3 -top-[3px] bg-accent-primary rounded-full" />
                                 </div>
                                 <span className="text-[9px] font-mono text-brand-emerald">Signal: {synthesis?.playbook?.vixIntelligence?.signal || 'N/A'}</span>
                              </div>
                           </div>
                        </div>

                        {/* ETF Rotation & Recs */}
                        <div className="flex flex-col gap-4">
                           <div className="p-4 bg-black/20 border border-white/5 rounded-xl">
                              <span className="text-[10px] font-mono font-bold text-accent-primary uppercase tracking-[0.2em] mb-4 block">SECTOR ETF ROTATION</span>
                              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                 {(synthesis?.sectors || [
                                   { name: 'N/A', performance: 0, status: 'Neutral' },
                                 ]).map((s: any) => (
                                    <div key={s.name} className={`p-2 flex flex-col items-center justify-center border rounded-lg ${s.performance > 1 ? 'text-brand-emerald border-brand-emerald/20 bg-brand-emerald/5' : s.performance < -1 ? 'text-rose-500 border-rose-500/20 bg-rose-500/5' : 'text-white/40 border-white/5'}`}>
                                       <span className="text-[10px] font-mono font-bold truncate max-w-[60px] text-center">{s.name}</span>
                                       <span className="text-[9px] font-mono">{s.performance > 0 ? '+' : ''}{s.performance}%</span>
                                    </div>
                                 ))}
                              </div>
                              <div className="mt-4 flex items-center gap-4 bg-black/40 p-3 rounded-xl border border-rose-500/10">
                                 <div className="w-10 h-10 rounded-full border-2 border-rose-500 flex items-center justify-center shrink-0">
                                    <span className="text-rose-500 font-mono font-bold text-[10px]">10.0</span>
                                 </div>
                                 <div className="flex flex-col">
                                    <span className="text-[10px] font-mono font-bold text-rose-500 uppercase tracking-widest">EXTREME EVENT RISK</span>
                                    <span className="text-[9px] font-mono text-white/40">{(synthesis?.economicCalendar || []).map((e: any) => e.event).join(' • ')}</span>
                                 </div>
                              </div>
                           </div>

                           <div className="p-4 bg-black/20 border border-white/5 rounded-xl flex-1">
                              <span className="text-[10px] font-mono font-bold text-accent-primary uppercase tracking-[0.2em] mb-4 block">RECOMMENDED STRATEGIES</span>
                              <div className="space-y-2">
                                 {(synthesis?.playbook?.recommendedStrategies || [
                                   { name: 'N/A', confidence: 'N/A', details: 'Awaiting data' },
                                 ]).map((strat: any, idx: number) => (
                                    <div key={idx} className="p-3 bg-white/5 border border-white/5 rounded-lg hover:border-white/20 transition-all flex justify-between items-center group">
                                       <div className="flex flex-col">
                                          <span className="text-[11px] font-mono font-bold text-white group-hover:text-accent-primary transition-colors">{strat.name}</span>
                                          <span className="text-[9px] font-mono text-white/40 mt-1">{strat.details}</span>
                                       </div>
                                       <span className={`text-[9px] font-mono font-bold px-2 py-1 rounded bg-black/40 ${strat.confidence === 'HIGH' ? 'text-brand-emerald border border-brand-emerald/20' : 'text-brand-amber border border-brand-amber/20'}`}>{strat.confidence}</span>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        </div>
                     </div>
                  </motion.div>
                )}

                {activeTab === 'technical' && (
                  <motion.div
                    key="tech"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full flex flex-col"
                  >
                    <div className="flex items-center justify-between mb-6 px-2">
                        <div className="flex items-center gap-4 w-full">
                           <form onSubmit={handleSearch} className="relative group flex-1 max-w-sm">
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-accent-primary transition-colors" size={16} />
                              <input 
                                 type="text"
                                 value={symbolInput}
                                 onChange={(e) => setSymbolInput(e.target.value)}
                                 placeholder="Search Ticker (e.g. BTCUSD, SPY)"
                                 className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-12 pr-4 text-sm font-mono focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20 transition-all placeholder:text-white/10"
                              />
                           </form>
                           <div className="flex bg-black/40 rounded-xl p-1.5 border border-white/10 shadow-inner">
                              {['1', '5', '15', '60', 'D'].map(iv => (
                                <button
                                  key={iv}
                                  onClick={() => setChartInterval(iv)}
                                  className={`px-6 py-2 text-[12px] font-mono font-bold rounded-lg transition-all ${chartInterval === iv ? 'bg-white/10 text-white shadow-xl ring-1 ring-white/10' : 'text-white/30 hover:text-white'}`}
                                >
                                  {iv === '60' ? '1H' : iv === 'D' ? 'DAILY' : `${iv}M`}
                                </button>
                              ))}
                           </div>
                        </div>
                        <div className="hidden lg:flex items-center gap-8 shrink-0">
                           <div className="flex items-center gap-4 bg-black/40 px-6 py-3 rounded-2xl border border-white/5 shadow-2xl">
                              <div className="px-5 py-1.5 bg-accent-primary text-white rounded-lg font-mono text-sm font-black shadow-[0_5px_15px_var(--accent-glow)] tracking-tighter uppercase ring-1 ring-white/10">
                                 {chartSymbol}
                              </div>
                              <span className="text-[12px] font-mono font-bold text-main-primary/50 tracking-widest uppercase">SYMBOLS: <span className="text-brand-emerald">SYNCED</span></span>
                           </div>
                        </div>
                     </div>
                     {/* Horizontal Hero Chart Terminal */}
                     <div className="flex-1 min-h-[600px] lg:min-h-[700px] border border-white/10 rounded-3xl overflow-hidden relative bg-black/60 shadow-[0_40px_120px_-20px_rgba(0,0,0,1)] ring-1 ring-white/5">
                        <TradingViewWidget 
                          symbol={chartSymbol}
                          interval={chartInterval}
                          theme="dark"
                          height="100%"
                        />
                     </div>
                  </motion.div>
                )}

                {activeTab === 'yields' && (
                  <motion.div key="yields" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col space-y-4">
                     <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-accent-primary uppercase tracking-widest">Treasury Yield Curve</span>
                        <div className="flex items-center gap-2">
                           <ShieldAlert size={12} className="text-rose-500" />
                           <span className="text-[9px] font-mono font-bold text-rose-500">2s10s INVERSION: {benchmarks['SPREAD_2s10s']?.price ? `${(benchmarks['SPREAD_2s10s'].price * 100).toFixed(0)}bps` : '-32bps'}</span>
                        </div>
                     </div>
                     <div className="flex-1 bg-black/20 rounded-xl border border-white/5 p-6 relative group/chart overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-accent-primary/5 to-transparent opacity-0 group-hover/chart:opacity-100 transition-opacity pointer-events-none" />
                        <ResponsiveContainer width="100%" height="100%">
                           <AreaChart data={[
                             { name: '3M', y: benchmarks['US13W']?.price || 5.42 }, 
                             { name: '2Y', y: benchmarks['US2Y']?.price || 4.88 }, 
                             { name: '5Y', y: benchmarks['US5Y']?.price || 4.52 }, 
                             { name: '10Y', y: benchmarks['US10Y']?.price || 4.54 }, 
                             { name: '30Y', y: benchmarks['US30Y']?.price || 4.65 }
                           ]}>
                              <defs>
                                <linearGradient id="yieldGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)', fontFamily: 'JetBrains Mono', fontWeight: 600 }} 
                                dy={10}
                              />
                              <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} hide />
                              <Tooltip 
                                cursor={{ stroke: 'rgba(59, 130, 246, 0.2)', strokeWidth: 1 }}
                                contentStyle={{ 
                                  backgroundColor: 'rgba(0,0,0,0.9)', 
                                  border: '1px solid rgba(255,255,255,0.1)', 
                                  borderRadius: '12px', 
                                  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)',
                                  backdropFilter: 'blur(8px)'
                                }}
                                content={({ active, payload, label }) => {
                                  if (active && payload && payload.length) {
                                    return (
                                      <div className="p-3 font-mono">
                                        <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1">{label} Treasury</div>
                                        <div className="text-lg font-bold text-accent-primary leading-none">
                                          {payload[0].value?.toFixed(2)}%
                                        </div>
                                        <div className="text-[8px] text-brand-emerald uppercase mt-1 tracking-tighter">Yield-to-Maturity</div>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="y" 
                                stroke="#3B82F6" 
                                strokeWidth={3} 
                                fillOpacity={1} 
                                fill="url(#yieldGrad)"
                                animationDuration={1500}
                              />
                           </AreaChart>
                        </ResponsiveContainer>
                     </div>
                     <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                          { tenor: '2Y', key: 'US2Y', fallback: 4.88 }, 
                          { tenor: '5Y', key: 'US5Y', fallback: 4.52 }, 
                          { tenor: '10Y', key: 'US10Y', fallback: 4.54 }, 
                          { tenor: '30Y', key: 'US30Y', fallback: 4.65 }
                        ].map(item => (
                           <div key={item.tenor} className="p-4 border border-white/5 rounded-2xl bg-black/20 flex flex-col items-center hover:border-white/20 transition-all group">
                              <span className="text-[9px] font-mono font-bold text-white/20 uppercase tracking-[0.2em] group-hover:text-accent-primary transition-colors">{item.tenor} Yield</span>
                              <span className="text-xl font-mono font-bold text-white mt-1">
                                {benchmarks[item.key]?.price ? `${benchmarks[item.key].price.toFixed(2)}%` : `${item.fallback.toFixed(2)}%`}
                              </span>
                           </div>
                        ))}
                     </div>
                  </motion.div>
                )}

                {activeTab === 'liquidity' && (
                  <motion.div key="liq" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col space-y-4">
                     <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                           <span className="text-[10px] font-mono font-bold text-brand-emerald uppercase tracking-widest">Systemic Net Liquidity Flow</span>
                           <span className="text-[9px] font-mono text-white/30 uppercase mt-0.5">Proxy: Fed Bal Sheet - (TGA + RRP)</span>
                        </div>
                        <div className="flex gap-8">
                           <div className="flex flex-col items-end">
                              <span className="text-[9px] font-mono font-bold text-white/30">FED RRP</span>
                              <span className="text-lg font-mono font-bold text-white">$450B</span>
                           </div>
                           <div className="flex flex-col items-end">
                              <span className="text-[9px] font-mono font-bold text-white/30">NET WEEKLY FLOW</span>
                              <span className={`text-lg font-mono font-bold ${(synthesis?.playbook?.liquidityTrend?.[synthesis.playbook.liquidityTrend.length-1]?.value || 0) >= 0 ? 'text-brand-emerald' : 'text-rose-500'}`}>
                                {synthesis?.playbook?.liquidityTrend?.[synthesis.playbook.liquidityTrend.length-1]?.value ? `${synthesis.playbook.liquidityTrend[synthesis.playbook.liquidityTrend.length-1].value > 0 ? '+' : ''}${synthesis.playbook.liquidityTrend[synthesis.playbook.liquidityTrend.length-1].value}B` : '-$12B'}
                              </span>
                           </div>
                        </div>
                     </div>
                     <div className="flex-1 bg-black/20 rounded-xl border border-white/5 p-6 group/liq relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-t from-brand-emerald/5 to-transparent pointer-events-none opacity-0 group-hover/liq:opacity-100 transition-opacity" />
                        <ResponsiveContainer width="100%" height="100%">
                           <BarChart data={synthesis?.playbook?.liquidityTrend || [
                             { date: 'W-4', value: 40, description: 'Normalizing' }, 
                             { date: 'W-3', value: 35, description: 'Slight Drain' }, 
                             { date: 'W-2', value: 45, description: 'Repo Injection' }, 
                             { date: 'W-1', value: 38, description: 'TGA Refill' }, 
                             { date: 'Now', value: 52, description: 'Net Liquidity Growth' }
                           ]}>
                              <XAxis 
                                dataKey="date" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.2)', fontFamily: 'JetBrains Mono' }}
                                dy={10}
                              />
                              <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                              <Tooltip 
                                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                      <div className="bg-black/90 border border-white/10 p-4 rounded-xl backdrop-blur-xl shadow-2xl font-mono">
                                        <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">{data.date}</div>
                                        <div className="flex items-center gap-3 mb-2">
                                          <div className={`w-2 h-2 rounded-full ${data.value >= 0 ? 'bg-brand-emerald animate-pulse' : 'bg-rose-500'}`} />
                                          <div className={`text-xl font-bold ${data.value >= 0 ? 'text-brand-emerald' : 'text-rose-500'}`}>
                                            {data.value > 0 ? '+' : ''}{data.value}B
                                          </div>
                                        </div>
                                        <div className="text-[9px] text-white/60 max-w-[140px] leading-relaxed">
                                          {data.description}
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-white/5 flex flex-col gap-1">
                                          <div className="text-[8px] text-white/20 flex justify-between"><span>Impact:</span> <span className={data.value >= 0 ? 'text-brand-emerald' : 'text-rose-500'}>{data.value >= 0 ? 'Pro-Risk' : 'Risk-Off'}</span></div>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Bar dataKey="value">
                                {(synthesis?.playbook?.liquidityTrend || []).map((entry, index) => (
                                  <Cell 
                                    key={index} 
                                    fill={entry.value >= 0 ? '#10B981' : '#F43F5E'} 
                                    fillOpacity={0.6}
                                    className="hover:fill-opacity-100 transition-all cursor-crosshair"
                                  />
                                ))}
                                {!synthesis?.playbook?.liquidityTrend && (
                                   <Cell fill="#10B981" fillOpacity={0.6} />
                                )}
                              </Bar>
                           </BarChart>
                        </ResponsiveContainer>
                     </div>
                     <div className="p-4 bg-brand-emerald/10 border border-brand-emerald/20 rounded-xl font-mono text-[11px] text-brand-emerald leading-relaxed shadow-lg flex items-center gap-4">
                        <Info size={16} className="shrink-0" />
                        <span>SYSTEMIC LIQUIDITY REMAINS STRESSED BUT RESILIENT DUE TO RRP OFFSETS. MONITOR TGA REFILLING FOR Q3 SHOCKS.</span>
                     </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Row 2: Left column (3) + New Content (9) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-black/30 border border-white/10 rounded-2xl overflow-hidden flex flex-col h-full font-mono shadow-2xl">
            <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">Correlation</span>
              <BarChart3 size={14} className="text-white/20" />
            </div>
            
            <div className="p-5 space-y-5 flex-1">
               <div className="space-y-3">
                  {[
                    { pair: 'DXY | QQQ', corr: -0.85 },
                    { pair: '10Y | SPY', corr: -0.62 },
                    { pair: 'GLD | BTC', corr: 0.45 },
                  ].map(p => (
                    <div key={p.pair} className="p-3 bg-black/40 border border-white/5 rounded-xl hover:border-white/20 transition-colors">
                       <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-bold text-main-primary/80">{p.pair}</span>
                          <span className={`text-[11px] font-bold ${p.corr < 0 ? 'text-rose-400' : 'text-brand-emerald'}`}>{(p.corr * 100).toFixed(0)}%</span>
                       </div>
                       <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden flex shadow-inner">
                          <div className={`h-full ${p.corr < 0 ? 'bg-rose-500 shadow-[0_0_8px_theme(colors.rose.500)]' : 'bg-brand-emerald shadow-[0_0_8px_theme(colors.brand.emerald)]'}`} style={{ width: `${Math.abs(p.corr) * 100}%`, marginLeft: p.corr < 0 ? 'auto' : '0' }} />
                       </div>
                    </div>
                  ))}
               </div>

               <div className="pt-5 border-t border-white/5 space-y-4">
                  <span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.3em]">Macro Events</span>
                  <div className="space-y-3">
                     {synthesis?.economicCalendar?.slice(0, 2).map((event, i) => (
                        <div key={i} className="p-3 bg-black/40 border border-white/5 rounded-xl group/event hover:bg-white/5 transition-colors">
                           <div className="text-[10px] font-bold text-main-primary leading-tight group-hover/event:text-white transition-colors">{event.event}</div>
                           <div className="flex justify-between items-center mt-3">
                              <span className="text-[8px] text-accent-primary uppercase font-bold tracking-widest">{event.date}</span>
                              <span className="text-[8px] text-white/20 font-bold uppercase italic">{event.forecast}</span>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="pt-5 border-t border-white/5 space-y-3">
                  <span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.3em]">Risk Audit</span>
                  <div className="space-y-2">
                     {synthesis?.riskAudit.slice(0, 2).map((risk, i) => (
                        <div key={i} className="flex gap-3 p-3 bg-rose-500/5 rounded-xl border border-rose-500/10 group/risk hover:bg-rose-500/10 transition-colors">
                           <ShieldAlert size={12} className="text-rose-500 shrink-0 mt-0.5" />
                           <span className="text-[9px] text-main-primary/60 leading-relaxed font-sans">{risk}</span>
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            <div className="p-4 border-t border-white/5 bg-black/40 space-y-4">
                <div className="space-y-2">
                   <div className="flex justify-between items-center">
                      <span className="text-[8px] font-mono font-bold text-white/30 uppercase tracking-widest">Rate Probabilities (Next FOMC)</span>
                      <span className="text-[8px] font-mono font-bold text-accent-primary">EXP: JUN 12</span>
                   </div>
                   <div className="space-y-1.5">
                      {[
                        { label: 'Pause (5.25-5.50)', prob: 94.2, color: 'bg-brand-emerald' },
                        { label: 'Cut (5.00-5.25)', prob: 5.8, color: 'bg-white/10' }
                      ].map(item => (
                        <div key={item.label} className="space-y-1">
                           <div className="flex justify-between text-[9px] font-mono">
                              <span className="text-white/60">{item.label}</span>
                              <span className="text-white font-bold">{item.prob}%</span>
                           </div>
                           <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${item.prob}%` }} className={`h-full ${item.color}`} />
                           </div>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="flex justify-between items-center p-3 bg-accent-primary/10 rounded-xl border border-accent-primary/20 shadow-inner">
                   <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse" />
                      <span className="text-[8px] font-bold text-accent-primary uppercase tracking-widest">Neural Divergence</span>
                   </div>
                   <span className="text-[10px] font-bold text-accent-primary tracking-tighter">BULLISH BIAS</span>
                </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-12 gap-4">
           {/* Refined AI Narrative Engine (lg:col-span-8) */}
           <div className="md:col-span-8 bg-black/30 border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden group">
              <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <Binary size={16} className="text-accent-primary animate-pulse" />
                    <span className="text-[11px] font-mono font-bold text-white/30 uppercase tracking-[0.4em]">Neural Narrative Processor</span>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-lg">
                       <div className="w-1 h-1 rounded-full bg-brand-emerald animate-ping" />
                       <span className="text-[8px] font-mono font-bold text-white/40 uppercase tracking-widest">Logic Flow: {chartSymbol}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-accent-primary/10 border border-accent-primary/20 rounded-full">
                       <RefreshCcw size={10} className="text-accent-primary animate-spin-slow" />
                       <span className="text-[9px] font-mono font-bold text-accent-primary uppercase tracking-tighter">{isLoadingSynthesis ? `Synthesizing ${chartSymbol}...` : 'Analysis Synced'}</span>
                    </div>
                 </div>
              </div>
              <div className="p-8 flex-1 flex flex-col justify-center relative overflow-hidden">
                 {/* Decorative Synapse Background */}
                 <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-accent-primary/20 rounded-full blur-[100px]" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-emerald/10 rounded-full blur-[100px]" />
                 </div>

                 <div className="space-y-8 relative z-10">
                    <div className="p-6 bg-black/40 border border-white/5 rounded-2xl relative overflow-hidden group/box hover:border-accent-primary/30 transition-all shadow-inner">
                       <div className="absolute top-0 left-0 w-1.5 h-full bg-accent-primary shadow-[0_0_15px_var(--accent-glow)]" />
                       <div className="flex items-center justify-between mb-4">
                          <h4 className="text-[10px] font-mono font-bold text-accent-primary uppercase tracking-[0.3em] flex items-center gap-2">
                             <Zap size={10} /> {chartSymbol} Synthetic Objective
                          </h4>
                          <span className="text-[8px] font-mono text-white/20 uppercase font-black">Node: Alpha-7</span>
                       </div>
                       <p className="text-sm font-sans text-white/90 leading-relaxed font-medium">
                          The current <span className="text-accent-primary font-bold">{synthesis?.regime}</span> regime suggests a cluster of volatility in the next 72-hour window. 
                          Tactical positioning maintains a <span className="text-brand-emerald font-bold">{synthesis?.assetClassViews.equities}</span> stance on risk assets while closely 
                          monitoring the {synthesis?.economicCalendar[0]?.event} for regime pivot confirmation.
                       </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
                       <div className="p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors">
                          <span className="text-[9px] font-mono font-bold text-white/20 uppercase block mb-2 tracking-widest">Tail Risk Index</span>
                          <div className="flex items-center gap-3">
                             <div className="h-2 flex-1 bg-black/40 rounded-full overflow-hidden shadow-inner">
                                <motion.div initial={{ width: 0 }} animate={{ width: '42%' }} className="h-full bg-brand-amber shadow-[0_0_10px_theme(colors.brand.amber)]" />
                             </div>
                             <span className="text-xs font-mono font-bold text-brand-amber tabular-nums">42.8</span>
                          </div>
                       </div>
                       <div className="p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors">
                          <span className="text-[9px] font-mono font-bold text-white/20 uppercase block mb-2 tracking-widest">Compute Precision</span>
                          <div className="flex items-center gap-3">
                             <div className="h-2 flex-1 bg-black/40 rounded-full overflow-hidden shadow-inner">
                                <motion.div initial={{ width: 0 }} animate={{ width: '98%' }} className="h-full bg-brand-emerald shadow-[0_0_10px_theme(colors.brand.emerald)]" />
                             </div>
                             <span className="text-xs font-mono font-bold text-brand-emerald tabular-nums">98.2%</span>
                          </div>
                       </div>
                       <div className="p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors">
                          <span className="text-[9px] font-mono font-bold text-white/20 uppercase block mb-2 tracking-widest">Regime Delta</span>
                          <div className="flex items-center justify-between">
                             <span className="text-sm font-mono font-bold text-brand-emerald">+0.12</span>
                             <div className="flex items-center gap-1">
                                {[1,2,3].map(i => <TrendingUp key={i} size={10} className="text-brand-emerald/40" />)}
                             </div>
                          </div>
                       </div>
                       <div className="p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors flex flex-col justify-between">
                          <span className="text-[9px] font-mono font-bold text-white/20 uppercase block mb-1 tracking-widest">Logic Health</span>
                          <div className="flex items-center justify-between">
                             <span className="text-sm font-mono font-bold text-white/60 uppercase">Nominal</span>
                             <div className="flex items-center gap-1">
                                {[1,2,3,4].map(i => <div key={i} className="w-1 h-3 bg-brand-emerald/40 rounded-full animate-pulse" style={{ animationDelay: `${i*0.2}s` }} />)}
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
              <div className="p-4 bg-black/40 border-t border-white/5 flex items-center justify-between px-6">
                 <div className="flex items-center gap-4">
                    <span className="text-[9px] font-mono font-bold text-white/20 uppercase tracking-[0.2em]">Processing Stream: 14.2 GB/s</span>
                    <div className="w-px h-3 bg-white/10" />
                    <span className="text-[9px] font-mono font-bold text-white/20 uppercase tracking-[0.2em]">Buffer: Stable</span>
                 </div>
                 <Layers size={14} className="text-accent-primary opacity-20" />
              </div>
           </div>

           {/* Vol Radar: Refined & Useful (lg:col-span-4) */}
           <div className="md:col-span-4 bg-black/30 border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden group">
              <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <Target size={16} className="text-rose-500 animate-pulse" />
                    <span className="text-[11px] font-mono font-bold text-white/30 uppercase tracking-[0.3em]">Neural Vol Radar</span>
                 </div>
                 <div className="flex items-center gap-1.5 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
                    <span className="text-[9px] font-mono font-bold text-rose-500 uppercase">Alert: Elevated Skew</span>
                 </div>
              </div>
              <div className="p-6 flex-1 flex flex-col items-center justify-center space-y-8 relative">
                 <div className="relative w-40 h-40 flex items-center justify-center">
                    {/* Radial Scan UI */}
                    <div className="absolute inset-0 rounded-full border border-white/5" />
                    <div className="absolute inset-4 rounded-full border border-white/10" />
                    <div className="absolute inset-8 rounded-full border border-white/20" />
                    <div className="absolute inset-12 rounded-full border border-white/30" />
                    
                    {/* Radar Sweep */}
                    <motion.div 
                       animate={{ rotate: 360 }} 
                       transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                       className="absolute inset-0 border-t-2 border-accent-primary/60 rounded-full bg-gradient-to-t from-transparent via-transparent to-accent-primary/10" 
                    />
                    
                    {/* Active Alerts on Radar */}
                    <motion.div 
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 2] }}
                      transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                      className="absolute top-1/4 left-1/3 w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_15px_theme(colors.rose.500)]"
                    />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 2] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: 1.2 }}
                      className="absolute bottom-1/3 right-1/4 w-2 h-2 rounded-full bg-brand-emerald shadow-[0_0_15px_theme(colors.brand.emerald)]"
                    />

                    <div className="z-10 flex flex-col items-center">
                       <Zap size={28} className="text-accent-primary drop-shadow-[0_0_10px_var(--accent-glow)]" />
                       <span className="text-[10px] font-mono font-black text-white/40 mt-1 uppercase">Active</span>
                    </div>
                 </div>

                 <div className="w-full grid grid-cols-2 gap-4">
                    <div className="p-4 bg-black/40 border border-white/5 rounded-2xl flex flex-col">
                       <span className="text-[10px] font-mono font-bold text-white/20 uppercase mb-1">VIX Term</span>
                       <span className="text-lg font-mono font-bold text-brand-emerald tabular-nums">+2.4%</span>
                       <span className="text-[8px] font-mono font-bold text-white/10 uppercase mt-1">Impled / Realized</span>
                    </div>
                    <div className="p-4 bg-black/40 border border-white/5 rounded-2xl flex flex-col">
                       <span className="text-[10px] font-mono font-bold text-white/20 uppercase mb-1">Gamma Flip</span>
                       <span className="text-lg font-mono font-bold text-rose-500 tabular-nums">4950</span>
                       <span className="text-[8px] font-mono font-bold text-white/10 uppercase mt-1">Zero-G Threshold</span>
                    </div>
                 </div>
              </div>
              <div className="p-4 bg-black/40 border-t border-white/5 space-y-3">
                 <div className="flex items-center justify-between group-hover:bg-white/5 p-2 rounded-xl transition-colors cursor-help">
                    <div className="flex items-center gap-2">
                       <Info size={12} className="text-accent-primary" />
                       <span className="text-[9px] font-mono font-bold text-white/40 uppercase tracking-widest">Utility Breakdown</span>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-white/20 uppercase">Expand Info</span>
                 </div>
                 <p className="text-[10px] font-mono text-white/30 leading-relaxed px-2">
                    Monitoring <span className="text-accent-primary">VOLATILITY CLUSTERS</span>: High probability of expansion in next 48h based on skew divergence and gamma hedging flows.
                 </p>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pb-4">
         {/* Sector Alpha (3/12) */}
         <div className="md:col-span-3 bg-black/30 border border-white/10 rounded-2xl p-5 flex flex-col justify-between overflow-hidden group shadow-2xl">
            <div className="flex items-center justify-between mb-5">
               <span className="text-[11px] font-mono font-bold text-accent-primary uppercase tracking-[0.3em]">Sector Performance</span>
               <PieChart size={16} className="text-accent-primary opacity-40" />
            </div>
            <div className="flex-1 space-y-4">
              {(synthesis?.sectors || []).slice(0, 6).map(s => (
                <div key={s.name} className="flex items-center justify-between group/item">
                   <div className="flex flex-col">
                      <span className="text-[11px] font-mono font-bold text-white/50 uppercase group-hover/item:text-white transition-colors">{s.name}</span>
                      <span className="text-[7px] text-white/20 uppercase font-bold tracking-tighter">{s.status}</span>
                   </div>
                   <div className="flex items-center gap-4">
                      <div className="w-16 sm:w-24 h-1.5 bg-white/5 rounded-full overflow-hidden shadow-inner">
                         <div className={`h-full ${s.performance >= 0 ? 'bg-brand-emerald shadow-[0_0_8px_theme(colors.brand.emerald)]' : 'bg-rose-500 shadow-[0_0_8px_theme(colors.rose.500)]'}`} style={{ width: `${Math.min(Math.abs(s.performance) * 10, 100)}%` }} />
                      </div>
                      <span className={`text-[11px] font-mono font-bold tabular-nums min-w-[45px] text-right ${s.performance >= 0 ? 'text-brand-emerald' : 'text-rose-500'}`}>
                        {s.performance > 0 ? '+' : ''}{s.performance}%
                      </span>
                   </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
               <div className="flex justify-between items-center">
                  <span className="text-[9px] font-mono font-bold text-white/30 uppercase tracking-widest">Surprise Index</span>
                  <span className="text-[10px] font-mono font-bold text-brand-emerald">+12.4</span>
               </div>
               <div className="flex items-end gap-1 h-10">
                  {[0.3, 0.5, 0.4, 0.6, 0.8, 0.7, 0.9, 0.85, 0.7, 0.6].map((v, i) => (
                    <div key={i} className="flex-1 bg-accent-primary/20 hover:bg-accent-primary/40 rounded-t-[1px]" style={{ height: `${v * 100}%` }} />
                  ))}
               </div>
            </div>
            <button className="w-full mt-6 py-2.5 text-[10px] font-mono font-bold text-white/40 uppercase border border-white/10 rounded-xl hover:bg-white/5 hover:text-white transition-all tracking-widest bg-white/5 hover:border-accent-primary/40">
               Full Rotation Analysis
            </button>
         </div>

         {/* AI Synthesis Grid (6/12) - Removed overflow-hidden to allow tooltips to breathe */}
         <div className="md:col-span-6 bg-black/30 border border-white/10 rounded-2xl flex flex-col shadow-2xl relative">
            <div className="p-4 px-6 bg-white/5 border-b border-white/5 rounded-t-2xl flex items-center justify-between relative z-10">
               <div className="flex items-center gap-8">
                  <span className="text-[11px] font-mono font-bold text-white/30 uppercase tracking-[0.25em]">Neural Indicators Matrix</span>
                  <div className="flex items-center gap-6">
                     <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-brand-emerald shadow-[0_0_10px_theme(colors.brand.emerald)]" />
                        <span className="text-[10px] font-mono font-bold text-white/20 uppercase tracking-wider">Bullish Flow</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_theme(colors.rose.500)]" />
                        <span className="text-[10px] font-mono font-bold text-white/20 uppercase tracking-wider">Bearish Flow</span>
                     </div>
                  </div>
               </div>
               <Info size={16} className="text-white/20" />
            </div>
            <div className="p-5 grid grid-cols-2 lg:grid-cols-3 gap-4 flex-1 relative z-20">
               {(synthesis?.keyIndicators || []).slice(0, 9).map((ind, i) => (
                 <div key={i} className="p-4 border border-white/5 bg-black/40 rounded-2xl hover:border-accent-primary/50 hover:bg-white/5 transition-all cursor-help group relative shadow-lg overflow-hidden">
                    <div className="flex justify-between items-start mb-2">
                       <span className="text-[9px] font-mono font-bold text-white/30 uppercase truncate group-hover:text-accent-primary transition-colors tracking-tight">{ind.name}</span>
                       <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-mono font-bold ${ind.change?.startsWith('+') ? 'text-brand-emerald' : 'text-rose-500'}`}>
                             {ind.change}
                          </span>
                       </div>
                    </div>
                    
                    <div className="flex items-baseline justify-between relative z-10">
                       <span className="text-xl font-mono font-bold text-white tabular-nums tracking-tighter">{ind.value}</span>
                       <div className={`w-2.5 h-2.5 rounded-full ${ind.status.toLowerCase().includes('bullish') || ind.status.toLowerCase().includes('expanding') || ind.status.toLowerCase().includes('positive') ? 'bg-brand-emerald shadow-[0_0_10px_theme(colors.brand.emerald)]' : 'bg-rose-500 shadow-[0_0_10px_theme(colors.rose.500)]'}`} />
                    </div>

                    {/* Mini Trend Sparkline */}
                    <div className="mt-4 flex items-end gap-0.5 h-6">
                       {(ind.trend || []).map((v, j) => {
                          const max = Math.max(...(ind.trend || [1]), 1);
                          const height = `${(v / max) * 100}%`;
                          return (
                             <div key={j} className="flex-1 bg-white/5 rounded-t-[1px] relative group/bar">
                                <motion.div 
                                   initial={{ height: 0 }}
                                   animate={{ height }}
                                   className={`absolute bottom-0 left-0 right-0 rounded-t-[1px] ${ind.status.toLowerCase().includes('bullish') ? 'bg-brand-emerald/20 group-hover/bar:bg-brand-emerald/40' : 'bg-rose-500/20 group-hover/bar:bg-rose-500/40'} transition-colors`}
                                />
                             </div>
                          );
                       })}
                    </div>

                    {/* Importance Indicator */}
                    <div className="absolute top-0 right-0 w-12 h-12 overflow-hidden pointer-events-none">
                       <div className={`absolute top-0 right-0 w-full h-[1px] bg-white/10 rotate-45 translate-x-1/2 -translate-y-1/2`} />
                    </div>

                    {/* Tooltip - Adjusted positioning and z-index */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-5 bg-[#0F0F0F] border border-accent-primary/40 rounded-2xl shadow-[0_30px_70px_rgba(0,0,0,1)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] pointer-events-none backdrop-blur-2xl ring-1 ring-white/10">
                       <div className="text-[9px] font-mono font-bold text-accent-primary uppercase mb-3 tracking-[0.3em] border-b border-accent-primary/20 pb-2 flex justify-between items-center">
                          <span>AI IMPLICATION</span>
                          <div className="flex items-center gap-2">
                             <span className="text-[8px] text-white/40">IMPORTANCE: {ind.importance}/10</span>
                             <Zap size={10} className="animate-pulse" />
                          </div>
                       </div>
                       <p className="text-[11px] font-mono text-white/70 font-bold leading-relaxed">{ind.implication}</p>
                    </div>
                 </div>
               ))}
            </div>
            <div className="px-6 py-3 bg-black/40 border-t border-white/5 rounded-b-2xl flex items-center justify-between relative z-10">
               <div className="flex items-center gap-4">
                  <Zap size={14} className="text-accent-primary animate-pulse" />
                  <span className="text-[10px] font-mono font-bold text-main-primary/30 tracking-[0.3em] uppercase">Neural Latency: 2.4ms • Compute: active</span>
               </div>
            </div>
         </div>

         {/* Risk & Correlation (3/12) */}
         <div className="md:col-span-3 bg-black/30 border border-white/10 rounded-2xl flex flex-col shadow-2xl font-mono overflow-hidden">
            <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
               <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">Relational Risk</span>
               <BarChart3 size={14} className="text-white/20" />
            </div>
            <div className="p-5 space-y-6 flex-1">
               <div className="space-y-4">
                  {[
                    { pair: 'DXY | QQQ', corr: -0.85 },
                    { pair: '10Y | SPY', corr: -0.62 },
                    { pair: 'GLD | BTC', corr: 0.45 },
                  ].map(p => (
                    <div key={p.pair} className="space-y-1.5">
                       <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-white/60 tracking-tighter">{p.pair}</span>
                          <span className={`text-[11px] font-bold ${p.corr < 0 ? 'text-rose-400' : 'text-brand-emerald'}`}>{(p.corr * 100).toFixed(0)}%</span>
                       </div>
                       <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden flex">
                          <div className={`h-full ${p.corr < 0 ? 'bg-rose-500' : 'bg-brand-emerald'}`} style={{ width: `${Math.abs(p.corr) * 100}%`, marginLeft: p.corr < 0 ? 'auto' : '0' }} />
                       </div>
                    </div>
                  ))}
               </div>

               <div className="pt-4 border-t border-white/5 space-y-3">
                  <span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.3em]">Critical Events</span>
                  <div className="space-y-2">
                     {synthesis?.economicCalendar?.slice(0, 2).map((event, i) => (
                        <div key={i} className="p-3 bg-black/40 border border-white/5 rounded-xl group/event hover:border-accent-primary transition-colors">
                           <div className="text-[10px] font-bold text-main-primary leading-tight group-hover/event:text-accent-primary transition-colors">{event.event}</div>
                           <div className="flex justify-between items-center mt-2">
                              <span className="text-[8px] text-accent-primary uppercase font-bold tracking-widest">{event.date}</span>
                              <span className="text-[8px] text-white/20 font-bold uppercase italic">{event.impact} IMPACT</span>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
         </div>
      </div>

      {/* Report Modal */}
      <AnimatePresence>
        {isReportOpen && synthesis && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsReportOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card-primary w-full max-w-3xl max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-main-primary"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8 border-b border-white/10 flex items-center justify-between bg-accent-primary text-white">
                <div className="flex items-center gap-3">
                  <Globe size={24} />
                  <div>
                    <h2 className="text-xl font-bold font-mono tracking-tighter">MACRO STRATEGY REPORT</h2>
                    <p className="text-[10px] opacity-70 uppercase tracking-widest font-mono">Generated by Gemini-3-Flash • {new Date().toLocaleDateString()}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsReportOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <RefreshCcw size={20} className="rotate-45" />
                </button>
              </div>
              <div className="p-8 overflow-y-auto no-scrollbar flex-1 prose prose-invert max-w-none">
                <div className="mockup-code bg-black text-brand-emerald p-4 mb-8 font-mono text-xs rounded-xl shadow-inner">
                   <pre><code>{`CORE REGIME: ${synthesis.regime.toUpperCase()}`}</code></pre>
                   <pre><code>{`PROBABILITY: ${synthesis.regimeScore}%`}</code></pre>
                   <pre><code>{`STATUS: ${synthesis.statusMsg.toUpperCase()}`}</code></pre>
                </div>
                <div className="markdown-body">
                  <Markdown>{synthesis.detailedReport || synthesis.narrative}</Markdown>
                </div>
              </div>
              <div className="p-6 bg-main-primary/5 flex justify-end">
                <button 
                  onClick={() => setIsReportOpen(false)}
                  className="px-6 py-2 bg-accent-primary text-white rounded-xl text-xs font-mono font-bold uppercase tracking-widest hover:bg-accent-primary/80 transition-colors"
                >
                  Close Analysis
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Final Sync Status Bar */}
      <div className="bg-black/40 border border-white/10 rounded-xl p-3 flex items-center justify-between px-6 shadow-2xl">
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-brand-emerald animate-pulse" />
               <span className="text-[9px] font-mono font-bold text-white/30 uppercase tracking-widest">Cross-Asset Connectivity: Sync'd</span>
            </div>
            <div className="hidden md:flex items-center gap-2 border-l border-white/5 pl-6">
               <span className="text-[9px] font-mono font-bold text-white/20 uppercase">Intelligence Latency: 142ms</span>
            </div>
         </div>
         <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
               {[1,2,3,4].map(i => (
                 <div key={i} className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <Zap size={8} className="text-white/20" />
                 </div>
               ))}
            </div>
            <span className="text-[9px] font-mono font-bold text-accent-primary uppercase animate-pulse">Node Beta Active</span>
         </div>
      </div>
    </div>
  );
};
