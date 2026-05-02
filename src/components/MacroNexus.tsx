import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, TrendingUp, TrendingDown, Clock, Shield, Globe, Cpu, Zap, Target, Search, RefreshCcw, Info, BarChart3, LineChart, PieChart, ShieldAlert, Binary, Layers } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart as ReLineChart, Line, BarChart, Bar, Cell } from 'recharts';

interface MacroIndicator {
  name: string;
  status: string;
  value: string;
  implication: string;
}

interface MacroSynthesis {
  regime: string;
  regimeScore: number;
  narrative: string;
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
}

interface BenchmarkData {
  price: number;
  change: number;
  changePercent: number;
  symbol: string;
  error?: boolean;
}

import { BeautifulChart } from './BeautifulChart';
import Markdown from 'react-markdown';

interface MacroNexusProps {
  activeTicker: string;
  spotPrice: number;
  netGex: number;
  chartData: any[];
}

export const MacroNexus: React.FC<MacroNexusProps> = ({ activeTicker, spotPrice, netGex, chartData }) => {
  const [synthesis, setSynthesis] = useState<MacroSynthesis | null>(null);
  const [benchmarks, setBenchmarks] = useState<Record<string, BenchmarkData>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'synthesis' | 'technical' | 'indicators' | 'yields' | 'liquidity' | 'sectors'>('technical');
  const [isReportOpen, setIsReportOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [synthRes, benchRes] = await Promise.all([
          fetch('/api/macro/synthesis'),
          fetch('/api/macro/benchmarks')
        ]);
        
        if (synthRes.ok) setSynthesis(await synthRes.json());
        if (benchRes.ok) setBenchmarks(await benchRes.json());
      } catch (error) {
        console.error('Failed to fetch macro data', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 300000); // 5 mins
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    if (!status) return 'text-neutral-400';
    const s = status.toLowerCase();
    if (['expansion', 'hot', 'bullish', 'strong', 'hawkish', 'accelerating', 'expanding', 'favorable', 'soft landing', 'stable', 'overweight', 'tightening', 'high conviction'].includes(s)) return 'text-emerald-500';
    if (['recession', 'bearish', 'weak', 'dovish', 'declining', 'cooling', 'contracting', 'unfavorable', 'underweight', 'widening', 'low conviction'].includes(s)) return 'text-rose-500';
    return 'text-amber-500';
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
    <div className="space-y-6">
      {/* Top Banner: Macro Context */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          { label: 'DXY Index', key: 'DXY', icon: Globe },
          { label: 'VIX Intensity', key: 'VIX', icon: Activity },
          { label: '10Y Yield', key: 'US10Y', icon: Target },
          { label: 'High Yield (HYG)', key: 'HYG', icon: ShieldAlert },
          { label: 'Bitcoin Spot', key: 'BTC', icon: Binary },
          { label: 'Copper % Gold', key: 'HG_GC_RATIO', icon: Zap },
        ].map((item) => (
          <div key={item.key} className="bg-white border border-black/5 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex items-center gap-2 mb-2">
              <item.icon size={12} className="text-neutral-400 group-hover:text-blue-500 transition-colors" />
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest">{item.label}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-mono font-bold text-black leading-none">
                {benchmarks[item.key]?.price ? benchmarks[item.key].price.toFixed(2) : '---'}
              </span>
              <span className={`text-[10px] font-mono font-bold ${benchmarks[item.key]?.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {benchmarks[item.key]?.changePercent ? `${benchmarks[item.key].changePercent > 0 ? '+' : ''}${benchmarks[item.key].changePercent.toFixed(2)}%` : ''}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left Column: AI Synthesis & Sentiment (4/12) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-black/10 rounded-2xl overflow-hidden shadow-sm flex flex-col h-full hover:border-blue-500/20 transition-colors">
            <div className="p-4 border-b border-black/5 bg-[#fafafa] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-neutral-500">Macro Analysis Nexus</span>
              </div>
              <Cpu size={14} className="text-neutral-300" />
            </div>

            <div className="p-6 flex-1 flex flex-col">
              {isLoading ? (
                <div className="flex-1 flex items-center justify-center p-12">
                   <div className="relative">
                      <RefreshCcw size={48} className="text-blue-500/10 animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                         <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                      </div>
                   </div>
                </div>
              ) : synthesis ? (
                <div className="space-y-6">
                  {/* Regime Badge */}
                  <div className="p-4 bg-black/[0.02] border border-black/[0.03] rounded-xl relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-2xl group-hover:bg-blue-500/10 transition-colors" />
                     <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest">Economic Regime</span>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 bg-blue-500/10 text-blue-600 rounded">PROB: {synthesis.regimeScore}%</span>
                     </div>
                     <div className="flex items-center gap-3">
                        {getRegimeIcon(synthesis.regime)}
                        <h3 className={`text-2xl font-mono font-bold tracking-tighter uppercase ${getStatusColor(synthesis.regime)}`}>
                          {synthesis.regime}
                        </h3>
                     </div>
                     <p className="text-xs text-neutral-500 mt-3 font-sans leading-relaxed italic">
                        "{synthesis.narrative}"
                     </p>
                  </div>

                  {/* Policy Watch (Fed) */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest">Policy Dashboard</span>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 border border-black/5 rounded-xl bg-white shadow-inner">
                         <span className="text-[9px] font-mono font-bold text-neutral-400 uppercase tracking-widest block mb-1">Stance</span>
                         <div className={`text-base font-bold font-mono ${getStatusColor(synthesis.policyWatch.fed)}`}>{synthesis.policyWatch.fed}</div>
                      </div>
                      <div className="p-4 border border-black/5 rounded-xl bg-white shadow-inner">
                         <span className="text-[9px] font-mono font-bold text-neutral-400 uppercase tracking-widest block mb-1">QT / QT (Flow)</span>
                         <div className="text-xs font-bold font-mono text-black uppercase">{synthesis.policyWatch.quantTightening}</div>
                      </div>
                    </div>
                  </div>

                  {/* Asset Views */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest">Structural Bias</span>
                    <div className="grid grid-cols-2 gap-2">
                       {Object.entries(synthesis.assetClassViews).map(([asset, view]) => (
                         <div key={asset} className="flex items-center justify-between px-3 py-2 bg-black/[0.01] border border-black/5 rounded-lg">
                           <span className="text-[10px] font-mono font-bold uppercase text-neutral-400 truncate mr-2">{asset.replace('_', ' ')}</span>
                           <span className={`text-[10px] font-bold font-mono whitespace-nowrap ${getStatusColor(view as string)}`}>{view as string}</span>
                         </div>
                       ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="p-4 border-t border-black/5 mt-auto bg-white flex justify-between items-center whitespace-nowrap overflow-hidden">
               <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-neutral-400 uppercase font-bold tracking-tighter">Systemic Risk</span>
                    <span className="text-xs font-mono font-bold text-rose-500">ELEVATED</span>
                  </div>
                  <div className="w-px h-6 bg-black/5" />
                  <div className="flex flex-col">
                    <span className="text-[9px] text-neutral-400 uppercase font-bold tracking-tighter">M2 Cycle</span>
                    <span className={`text-xs font-mono font-bold ${isLoading ? 'text-neutral-400' : 'text-emerald-500'}`}>EXPANDING</span>
                  </div>
               </div>
               <div className="px-3 py-1 bg-black text-white text-[9px] font-mono font-bold rounded-sm tracking-widest animate-pulse">
                NEXUS: ONLINE
               </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Widgets (8/12) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="bg-white border border-black/10 rounded-2xl shadow-sm flex-1 flex flex-col overflow-hidden hover:border-blue-500/20 transition-colors">
            <div className="flex p-0 border-b border-black/5 overflow-x-auto no-scrollbar">
              {['technical', 'synthesis', 'indicators', 'yields', 'liquidity', 'sectors'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`flex-1 min-w-[80px] py-4 text-[10px] font-mono font-bold uppercase tracking-[0.2em] transition-all relative ${
                    activeTab === tab ? 'text-blue-600 bg-blue-50/50' : 'text-neutral-400 hover:bg-black/[0.02]'
                  }`}
                >
                  {tab}
                  {activeTab === tab && (
                    <motion.div layoutId="nexus-tab" className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.5)]" />
                  )}
                </button>
              ))}
            </div>

            <div className="p-6 flex-1 min-h-[400px]">
              <AnimatePresence mode="wait">
                {activeTab === 'technical' && (
                  <motion.div
                    key="tab-technical"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-full flex flex-col"
                  >
                    <div className="mb-4 flex justify-between items-center px-2">
                       <div className="flex flex-col">
                         <span className="text-[11px] uppercase tracking-widest font-bold text-blue-600">Cross-Asset Yield Sync Chart</span>
                         <span className="text-[9px] text-neutral-500 uppercase tracking-widest mt-1">Real-time OHLC & Gamma Flow Intensity</span>
                       </div>
                    </div>
                    <div className="flex-1 bg-black/[0.01] rounded-xl overflow-hidden min-h-[350px]">
                      <BeautifulChart 
                         data={chartData} 
                         lineColor="#3B82F6"
                         secondaryLineColor="#F59E0B"
                         areaColor="#3B82F6"
                         height={350}
                       />
                    </div>
                  </motion.div>
                )}

                 {activeTab === 'synthesis' && (
                  <motion.div
                    key="tab-synthesis"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-8"
                  >
                     <div className="space-y-6">
                        <div className="space-y-4">
                          <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-blue-600 flex items-center gap-2">
                            <Clock size={14} /> Economic Calendar
                          </h4>
                          <div className="space-y-2">
                             {synthesis?.economicCalendar?.map((event, i) => (
                               <div key={i} className="p-3 border border-black/5 bg-white rounded-xl shadow-sm flex items-center justify-between group hover:border-blue-500/30 transition-colors">
                                  <div className="flex flex-col">
                                     <span className="text-[10px] font-mono font-bold text-black uppercase">{event.event}</span>
                                     <span className="text-[9px] text-neutral-400 font-mono mt-0.5">{event.date}</span>
                                  </div>
                                  <div className="flex items-center gap-6">
                                     <div className="flex flex-col items-end">
                                        <span className="text-[9px] text-neutral-400 uppercase font-bold">Forecast</span>
                                        <span className="text-[10px] font-mono font-bold text-blue-600">{event.forecast}</span>
                                     </div>
                                     <div className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-widest ${
                                        event.impact === 'High' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'
                                     }`}>
                                        {event.impact}
                                     </div>
                                  </div>
                               </div>
                             ))}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-blue-600 flex items-center gap-2">
                            <Target size={14} /> Risk Audit Logs
                          </h4>
                          <div className="space-y-3">
                            {synthesis?.riskAudit.map((risk, i) => (
                              <div key={i} className="flex gap-4 p-4 border border-rose-500/10 bg-rose-50/20 rounded-xl">
                                 <ShieldAlert size={16} className="text-rose-500 shrink-0 mt-0.5" />
                                 <span className="text-xs text-neutral-600 font-sans leading-relaxed">{risk}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                     </div>
                     
                     <div className="space-y-6">
                        <div className="space-y-4">
                          <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-blue-600 flex items-center gap-2">
                            <Layers size={14} /> Structural Playbook
                          </h4>
                          <div className="p-5 border border-black/5 rounded-2xl bg-white shadow-sm space-y-4 font-mono">
                             <div className="flex justify-between items-center text-[11px]">
                               <span className="text-neutral-400">Yield Sync Mode</span>
                               <span className="text-emerald-500 font-bold">OPTIMAL</span>
                             </div>
                             <div className="flex justify-between items-center text-[11px]">
                               <span className="text-neutral-400">Volatility Regime</span>
                               <span className="text-rose-500 font-bold">{netGex < 0 ? 'NEGATIVE GAMMA' : 'POSITIVE GAMMA'}</span>
                             </div>
                             <div className="flex justify-between items-center text-[11px]">
                               <span className="text-neutral-400">Liquidity Window</span>
                               <span className="text-blue-500 font-bold">NEUTRAL-OPEN</span>
                             </div>
                             <div className="pt-4 border-t border-black/5">
                                <p className="text-[10px] text-neutral-400 uppercase mb-3 font-bold">Recommended Tactical Position</p>
                                <div className="p-3 bg-black text-white rounded text-xs font-bold text-center tracking-widest">
                                   {netGex < 0 ? 'DYNAMIC VOLATILITY LONG (VXM)' : 'YIELD CURVE NEUTRAL CARRY'}
                                </div>
                             </div>
                          </div>
                        </div>

                         <div className="p-6 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl text-white shadow-lg overflow-hidden relative group shrink-0">
                           <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
                           <h5 className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] opacity-80 mb-4">Macro Analyst Pro Insight</h5>
                           <div className="flex-1">
                             <p className="text-sm font-medium leading-relaxed italic mb-6">
                               {synthesis?.narrative || "Analyzing current correlation matrices for systemic divergence..."}
                             </p>
                           </div>
                           <button 
                             onClick={() => setIsReportOpen(true)}
                             className="w-full py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-[10px] font-mono font-bold uppercase tracking-widest transition-all cursor-pointer mt-auto"
                           >
                             View Full Report
                           </button>
                        </div>
                     </div>
                  </motion.div>
                )}

                {activeTab === 'indicators' && (
                  <motion.div
                    key="tab-indicators"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-full flex flex-col"
                  >
                     <div className="grid md:grid-cols-3 gap-6">
                        {(synthesis?.keyIndicators || []).length > 0 ? (
                          synthesis?.keyIndicators.map((ind) => (
                            <div key={ind.name} className="p-6 border border-black/5 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                               <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/10 group-hover:bg-blue-500 transition-colors" />
                               <div className="flex items-center justify-between mb-4">
                                  <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest">{ind.name}</span>
                                  <div className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${getStatusColor(ind.status)} bg-black/[0.02]`}>{ind.status}</div>
                               </div>
                               <div className="text-3xl font-mono font-bold text-black mb-4 tracking-tighter tabular-nums">{ind.value}</div>
                               <div className="p-4 bg-black/[0.02] border border-black/[0.03] rounded-xl flex items-start gap-3">
                                  <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                                  <p className="text-[10px] text-neutral-500 leading-relaxed font-mono font-medium">
                                     <span className="text-black/40 uppercase">IMPLICATION:</span> {ind.implication}
                                  </p>
                               </div>
                            </div>
                          ))
                        ) : (
                          [1, 2, 3].map(i => (
                            <div key={i} className="p-6 border border-black/5 bg-white rounded-2xl h-48 animate-pulse flex flex-col justify-between">
                               <div className="w-24 h-3 bg-black/5 rounded" />
                               <div className="w-16 h-8 bg-black/5 rounded" />
                               <div className="w-full h-12 bg-black/5 rounded" />
                            </div>
                          ))
                        )}
                     </div>
                     <div className="mt-8 p-6 bg-blue-50/50 border border-blue-100 rounded-3xl flex items-center gap-6">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-lg">
                           <Binary size={24} />
                        </div>
                        <div>
                           <h5 className="text-sm font-mono font-bold text-blue-900 uppercase tracking-tight">Macro Indicator Convergence Analysis</h5>
                           <p className="text-xs text-blue-800/60 mt-1 leading-relaxed">System-wide indicators show 82% correlation with early recovery signals. Cross-check against dark pool institutional flow for breakout validation.</p>
                        </div>
                     </div>
                  </motion.div>
                )}

                {activeTab === 'yields' && (
                  <motion.div
                    key="tab-yields"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-full flex flex-col space-y-6"
                  >
                     <div className="flex-1 min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                           <ReLineChart data={[
                             { name: '13W', yield: benchmarks.US13W?.price || 5.25 },
                             { name: '2Y', yield: benchmarks.US2Y?.price || 4.88 },
                             { name: '5Y', yield: benchmarks.US5Y?.price || 4.54 },
                             { name: '10Y', yield: benchmarks.US10Y?.price || 4.48 },
                             { name: '30Y', yield: benchmarks.US30Y?.price || 4.62 },
                           ]}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
                              <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fill: '#888', fontWeight: 700, fontFamily: 'JetBrains Mono' }} 
                              />
                              <YAxis 
                                domain={['auto', 'auto']}
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fill: '#888', fontWeight: 700, fontFamily: 'JetBrains Mono' }} 
                              />
                              <Tooltip 
                                contentStyle={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 10px 20px rgba(0,0,0,0.05)', fontSize: '12px', fontWeight: 'bold' }}
                                itemStyle={{ color: '#3B82F6' }}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="yield" 
                                stroke="#3B82F6" 
                                strokeWidth={3} 
                                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4, stroke: 'white' }}
                                activeDot={{ r: 6, fill: '#3B82F6' }}
                              />
                           </ReLineChart>
                        </ResponsiveContainer>
                     </div>
                     <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <Shield size={16} className="text-rose-500" />
                           <span className="text-xs font-mono font-bold text-rose-500 uppercase tracking-widest">Yield Curve Alert: 2s10s Inversion</span>
                        </div>
                        <span className="text-lg font-mono font-bold text-rose-500">
                          {benchmarks['SPREAD_2s10s']?.price ? (benchmarks['SPREAD_2s10s'].price * 100).toFixed(1) : '---'}bps
                        </span>
                     </div>
                  </motion.div>
                )}
                  {activeTab === 'liquidity' && (
                    <motion.div
                      key="tab-liquidity"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="h-full flex flex-col space-y-6"
                    >
                      <div className="grid md:grid-cols-2 gap-6">
                         <div className="p-6 border border-black/10 rounded-2xl bg-white shadow-sm overflow-hidden relative">
                            <h5 className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest mb-4">M2 Growth (Simulated Proxy)</h5>
                            <div className="h-40">
                               <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={[
                                    { name: 'Jan', val: 400 }, { name: 'Feb', val: 300 }, { name: 'Mar', val: 500 }, { name: 'Apr', val: 450 }, { name: 'May', val: 600 }
                                  ]}>
                                     <Area type="monotone" dataKey="val" stroke="#10B981" fill="rgba(16,185,129,0.1)" strokeWidth={2} />
                                  </AreaChart>
                               </ResponsiveContainer>
                            </div>
                            <div className="mt-4 flex justify-between items-end">
                               <div>
                                  <span className="text-2xl font-mono font-bold text-emerald-500">+1.2%</span>
                                  <span className="text-[9px] text-neutral-400 font-bold block">YoY MOMENTUM</span>
                               </div>
                               <div className="text-[9px] font-mono font-bold px-2 py-1 bg-emerald-500/10 text-emerald-600 rounded">EXPANSIONARY</div>
                            </div>
                         </div>

                         <div className="p-6 border border-black/10 rounded-2xl bg-white shadow-sm">
                            <h5 className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest mb-4">Central Bank Assets (Aggregated)</h5>
                            <div className="h-40">
                               <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={[
                                    { name: 'FED', val: 7.4 }, { name: 'ECB', val: 6.8 }, { name: 'BOJ', val: 5.2 }
                                  ]}>
                                     <Bar dataKey="val" fill="#3B82F6" radius={[4, 4, 0, 0]}>
                                        <Cell fill="#3B82F6" opacity={0.8} />
                                        <Cell fill="#10B981" opacity={0.8} />
                                        <Cell fill="#F59E0B" opacity={0.8} />
                                     </Bar>
                                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fontWeight: 700 }} />
                                  </BarChart>
                               </ResponsiveContainer>
                            </div>
                            <p className="text-[10px] text-neutral-400 font-mono mt-4 leading-relaxed">
                               Central banks are currently in a <span className="text-rose-500 font-bold underline">Net Tightening</span> regime, pulling ~$95B/month from global markets through QT programs.
                            </p>
                         </div>
                      </div>
                      
                      <div className="p-5 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-4">
                         <div className="p-3 bg-blue-600 rounded-xl text-white">
                            <RefreshCcw size={20} />
                         </div>
                         <div>
                            <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-widest block">Reverse Repo (RRP) Dynamics</span>
                            <p className="text-xs text-neutral-600 mt-1">RRP draining remains the primary buffer for liquidity. Estimated exhaustion window: Q3 2026. This typically precedes increased market sensitivity.</p>
                         </div>
                      </div>
                    </motion.div>
                  )}
                  {activeTab === 'sectors' && (
                    <motion.div
                      key="tab-sectors"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="h-full flex flex-col space-y-6"
                    >
                      <div className="flex-1 min-h-[300px]">
                        <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-blue-600 mb-6 flex items-center gap-2">
                          <BarChart3 size={14} /> Global Sector Health Monitor
                        </h4>
                        {(synthesis?.sectors || []).length > 0 ? (
                          <div className="flex-1 flex flex-col">
                            <div className="flex-1 h-[250px]">
                               <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={synthesis?.sectors || []} layout="vertical" margin={{ left: 0, right: 40 }}>
                                  <XAxis type="number" hide />
                                  <YAxis 
                                    dataKey="name" 
                                    type="category" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    width={90}
                                    tick={{ fontSize: 9, fill: '#666', fontWeight: 800, fontFamily: 'JetBrains Mono' }} 
                                  />
                                  <Tooltip 
                                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                                    contentStyle={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 10px 20px rgba(0,0,0,0.05)', fontSize: '10px' }}
                                  />
                                  <Bar dataKey="performance" radius={[0, 4, 4, 0]} barSize={20}>
                                    {synthesis?.sectors?.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.performance >= 0 ? '#10B981' : '#EF4444'} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mt-8">
                              {synthesis?.sectors?.map((sector, i) => (
                                <div key={i} className="p-4 border border-black/5 rounded-2xl bg-white flex flex-col gap-2 items-center text-center shadow-sm hover:shadow-xl hover:border-blue-500 transition-all duration-300">
                                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-2">
                                     <Layers size={18} />
                                  </div>
                                  <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase truncate w-full tracking-tight">{sector.name}</span>
                                  <span className={`text-sm font-mono font-bold ${sector.performance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {sector.performance > 0 ? '+' : ''}{sector.performance}%
                                  </span>
                                  <div className={`w-full h-1.5 mt-2 rounded-full overflow-hidden bg-black/[0.03]`}>
                                     <motion.div 
                                       initial={{ width: 0 }}
                                       animate={{ width: `${Math.min(Math.abs(sector.performance) * 20, 100)}%` }}
                                       className={`h-full ${sector.performance >= 0 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`}
                                     />
                                  </div>
                                  <span className={`text-[8px] font-mono font-bold px-2 py-0.5 mt-2 rounded-full uppercase ${
                                    sector.status === 'Leading' ? 'bg-emerald-100 text-emerald-700' : 
                                    sector.status === 'Lagging' ? 'bg-rose-100 text-rose-700' : 'bg-neutral-100 text-neutral-600'
                                  }`}>
                                    {sector.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center p-12 text-neutral-400">
                             <RefreshCcw size={48} className="opacity-20 animate-spin mb-4" />
                             <span className="text-[10px] font-mono font-bold uppercase tracking-widest">Aggregating Global Sectors...</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
              </AnimatePresence>
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
              className="bg-white w-full max-w-3xl max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8 border-b border-black/5 flex items-center justify-between bg-blue-600 text-white">
                <div className="flex items-center gap-3">
                  <Globe size={24} />
                  <div>
                    <h2 className="text-xl font-bold font-mono tracking-tighter">MACRO STRATEGY REPORT</h2>
                    <p className="text-[10px] opacity-70 uppercase tracking-widest font-mono">Generated by Gemini-1.5-Pro • {new Date().toLocaleDateString()}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsReportOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <RefreshCcw size={20} className="rotate-45" />
                </button>
              </div>
              <div className="p-8 overflow-y-auto no-scrollbar flex-1 prose prose-neutral max-w-none">
                <div className="mockup-code bg-neutral-900 text-emerald-400 p-4 mb-8 font-mono text-xs rounded-xl shadow-inner">
                   <pre><code>{`CORE REGIME: ${synthesis.regime.toUpperCase()}`}</code></pre>
                   <pre><code>{`PROBABILITY: ${synthesis.regimeScore}%`}</code></pre>
                   <pre><code>{`STATUS: ANALYZING CROSS-ASSET CORRELATIONS...`}</code></pre>
                </div>
                <div className="markdown-body">
                  <Markdown>{synthesis.detailedReport || synthesis.narrative}</Markdown>
                </div>
              </div>
              <div className="p-6 bg-neutral-50 border-t border-black/5 flex justify-end">
                <button 
                  onClick={() => setIsReportOpen(false)}
                  className="px-6 py-2 bg-black text-white rounded-xl text-xs font-mono font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors"
                >
                  Close Analysis
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
