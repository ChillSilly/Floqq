import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, ComposedChart, Bar, Scatter, ReferenceLine, PieChart, Pie, Cell
} from 'recharts';
import { 
  Zap, Activity, Cpu, RefreshCcw, TrendingUp, TrendingDown, 
  Settings, Info, LayoutGrid, Target, Clock, BarChart2,
  ChevronRight, ArrowUpRight, ArrowDownRight, MousePointer2,
  Lock, ShieldCheck, Database, Sliders, Play, Waves, Binary,
  Calculator, FlaskConical, Gauge, ListFilter
} from 'lucide-react';
import { estimateAR1, KalmanOU, noiseLeverToScale } from '../lib/kalmanFilter';
import { 
  brownianMotionDiscrete, 
  brownianBridgeDiscrete, 
  geometricBrownianMotion, 
  ornsteinUhlenbeckDiscrete,
  priceEuropeanOption,
  OptionResult,
  calculateGreeks,
  blackScholes,
  Greeks
} from '../lib/stochasticMath';

interface BarData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  kalmanMean?: number;
}

type QuantTab = 'kts' | 'stochastic' | 'options' | 'volatility';

export function QuantDashboard() {
  const [activeTab, setActiveTab] = useState<QuantTab>('kts');
  const [ticker, setTicker] = useState('SPY');
  const [activeTicker, setActiveTicker] = useState('SPY');
  const [barSize, setBarSize] = useState('1m');
  const [calibWindow, setCalibWindow] = useState(60);
  const [noiseLever, setNoiseLever] = useState(50);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const [ohlcData, setOhlcData] = useState<BarData[]>([]);
  const [params, setParams] = useState<{ phi: number; mu: number; sigma: number } | null>(null);
  const [kalman, setKalman] = useState<KalmanOU | null>(null);
  const [forecast, setForecast] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastPrice, setLastPrice] = useState<number | null>(null);

  const kalmanRef = useRef<KalmanOU | null>(null);

  // --- Stochastic Lab State ---
  const [simType, setSimType] = useState<'bm' | 'bb' | 'gbm' | 'ou'>('gbm');
  const [simPaths, setSimPaths] = useState(10);
  const [simSteps, setSimSteps] = useState(100);
  const [simData, setSimData] = useState<any[]>([]);

  // --- Options State ---
  const [strike, setStrike] = useState(0);
  const [expiry, setExpiry] = useState(1.0); // Years
  const [riskFree, setRiskFree] = useState(0.045);
  const [pricingResult, setPricingResult] = useState<{ call: OptionResult; put: OptionResult } | null>(null);

  // --- Volatility Lab State ---
  const [targetSpot, setTargetSpot] = useState<number | string>('');
  const [targetIV, setTargetIV] = useState<number | string>('');
  const [scenarioResult, setScenarioResult] = useState<{
      original: { call: number; put: number; greeks: Greeks };
      scenario: { call: number; put: number; greeks: Greeks };
      pnl: number;
  } | null>(null);

  const fetchHistory = useCallback(async (sym: string, interval: string, window: number) => {
    setIsLoading(true);
    try {
      const range = window <= 60 ? '1d' : window <= 300 ? '5d' : '1mo';
      const res = await fetch(`/api/yahoo/chart/${sym}?interval=${interval}&range=${range}`);
      if (!res.ok) throw new Error("Failed to fetch history");
      
      const json = await res.json();
      if (json && json.chart && json.chart.result) {
        const result = json.chart.result[0];
        const timestamps = result.timestamp;
        const quote = result.indicators.quote[0];
        
        const bars: BarData[] = [];
        for (let i = 0; i < timestamps.length; i++) {
          if (quote.close[i] !== null) {
            bars.push({
              time: timestamps[i],
              open: quote.open[i],
              high: quote.high[i],
              low: quote.low[i],
              close: quote.close[i]
            });
          }
        }
        
        const recentBars = bars.slice(-window);
        setOhlcData(recentBars);
        
        // Calibrate
        const closes = recentBars.map(b => b.close);
        const est = estimateAR1(closes);
        if (est) {
          setParams(est);
          const k = new KalmanOU(est.phi, est.mu, est.sigma, noiseLeverToScale(noiseLever));
          
          // Back-run Kalman for history
          const historicalBars = recentBars.map(b => {
            k.update(b.close);
            return { ...b, kalmanMean: k.x };
          });
          
          setOhlcData(historicalBars);
          setKalman(k);
          kalmanRef.current = k;
          setForecast(k.forecast(5));
          const lp = recentBars[recentBars.length - 1].close;
          setLastPrice(lp);
          if (strike === 0) setStrike(Math.round(lp));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [noiseLever, strike]);

  useEffect(() => {
    fetchHistory(activeTicker, barSize, calibWindow);
  }, [activeTicker, barSize, calibWindow, fetchHistory]);

  // Simulated streaming update
  useEffect(() => {
    if (!isStreaming || !kalmanRef.current) return;

    const intervalId = setInterval(() => {
      if (!kalmanRef.current || !lastPrice) return;
      const newPrice = lastPrice * (1 + (Math.random() - 0.5) * 0.001);
      setLastPrice(newPrice);
      kalmanRef.current.update(newPrice);
      setKalman(Object.assign(Object.create(Object.getPrototypeOf(kalmanRef.current)), kalmanRef.current));
      setForecast(kalmanRef.current.forecast(5));
      setOhlcData(prev => {
          const last = prev[prev.length - 1];
          const updated = [...prev];
          updated[updated.length - 1] = {
              ...last,
              close: newPrice,
              high: Math.max(last.high, newPrice),
              low: Math.min(last.low, newPrice),
              kalmanMean: kalmanRef.current?.x
          };
          return updated;
      });
    }, 5000);
    return () => clearInterval(intervalId);
  }, [isStreaming, lastPrice]);

  const handleNoiseChange = (val: number) => {
      setNoiseLever(val);
      if (kalmanRef.current && params) {
          kalmanRef.current.R = (params.sigma ** 2) * Math.max(noiseLeverToScale(val), 0.01);
          setKalman(Object.assign(Object.create(Object.getPrototypeOf(kalmanRef.current)), kalmanRef.current));
      }
  };

  const chartData = useMemo(() => {
    const base = ohlcData.map((d, i) => ({ ...d, index: i }));
    if (forecast.length > 0 && base.length > 0) {
        const lastIdx = base[base.length - 1].index;
        const forecastPoints = forecast.map((f, i) => ({
            index: lastIdx + i + 1,
            forecastValue: f
        }));
        return [...base, ...forecastPoints];
    }
    return base;
  }, [ohlcData, forecast]);

  // --- Stochastic Simulation Action ---
  const runSimulation = useCallback(() => {
      if (!lastPrice || !params) return;
      
      let paths: number[][] = [];
      const T = 1.0;
      
      switch(simType) {
          case 'bm': paths = brownianMotionDiscrete(simSteps, simPaths, T); break;
          case 'bb': paths = brownianBridgeDiscrete(simSteps, simPaths, T); break;
          case 'gbm': paths = geometricBrownianMotion(lastPrice, params.phi - 1, params.sigma, T, simSteps, simPaths); break;
          case 'ou': paths = ornsteinUhlenbeckDiscrete(lastPrice, 2.0, params.mu, params.sigma, T, simSteps, simPaths); break;
      }

      const formatted = Array.from({ length: simSteps }).map((_, i) => {
          const row: any = { index: i };
          paths.forEach((p, pIdx) => {
              row[`p${pIdx}`] = p[i];
          });
          return row;
      });
      setSimData(formatted);
  }, [simType, simPaths, simSteps, lastPrice, params]);

  // --- Option Pricing Action ---
  const calculateOptions = useCallback(() => {
    if (!lastPrice || !params) return;
    const call = priceEuropeanOption(lastPrice, strike, expiry, riskFree, params.sigma, 'call', 50000);
    const put = priceEuropeanOption(lastPrice, strike, expiry, riskFree, params.sigma, 'put', 50000);
    setPricingResult({ call, put });
  }, [lastPrice, strike, expiry, riskFree, params]);

  // --- Volatility Scenario Action ---
  const runVolatilityAnalysis = useCallback(() => {
      if (!lastPrice || !params || !strike) return;
      
      const S0 = lastPrice;
      const K = strike;
      const sigma0 = params.sigma;
      const r = riskFree;
      const T = expiry;

      const tSpot = targetSpot === '' ? S0 : Number(targetSpot);
      const tIV = targetIV === '' ? sigma0 : Number(targetIV);

      // Current
      const cCall = blackScholes(S0, K, T, r, sigma0, 'call');
      const cPut = blackScholes(S0, K, T, r, sigma0, 'put');
      const cGreeks = calculateGreeks(S0, K, T, r, sigma0, 'call'); // Combined delta/gamma usually for straddle

      // Scenario
      const sCall = blackScholes(tSpot, K, T, r, tIV, 'call');
      const sPut = blackScholes(tSpot, K, T, r, tIV, 'put');
      const sGreeks = calculateGreeks(tSpot, K, T, r, tIV, 'call');

      const originalStraddle = cCall + cPut;
      const scenarioStraddle = sCall + sPut;

      setScenarioResult({
          original: { call: cCall, put: cPut, greeks: cGreeks },
          scenario: { call: sCall, put: sPut, greeks: sGreeks },
          pnl: scenarioStraddle - originalStraddle
      });
  }, [lastPrice, params, strike, riskFree, expiry, targetSpot, targetIV]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-surface-primary border border-main-primary rounded-xl w-fit">
         {[
           { id: 'kts', label: 'KTS Alpha', icon: Cpu },
           { id: 'stochastic', label: 'Stochastic Lab', icon: FlaskConical },
           { id: 'options', label: 'Risk Desk', icon: Calculator },
           { id: 'volatility', label: 'Volatility Lab', icon: Waves }
         ].map(tab => (
           <button
             key={tab.id}
             onClick={() => setActiveTab(tab.id as QuantTab)}
             className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-accent-primary text-app-primary shadow-[0_0_15px_var(--accent-glow)]' : 'text-main-tertiary hover:bg-surface-hover hover:text-main-primary'}`}
           >
             <tab.icon size={14} />
             {tab.label}
           </button>
         ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'kts' && (
          <motion.div 
            key="kts" 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {/* KTS Content (The original code goes here) */}
            <div className="grid lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 bg-card-primary border border-main-primary rounded-2xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none rotate-12">
                  <TrendingUp size={240} />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-accent-surface text-accent-primary rounded-lg"><Cpu size={20} /></div>
                      <div>
                        <h2 className="text-2xl font-serif italic text-main-primary tracking-tight">KTS Alpha Engine</h2>
                        <p className="text-[10px] font-mono text-main-tertiary uppercase tracking-widest">Kalman-OU Mean Reversion System</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 items-center">
                      <div className="flex items-center h-10 border border-main-primary rounded bg-surface-primary px-3 focus-within:border-accent-primary/50 transition-colors">
                        <Database size={14} className="text-main-tertiary mr-2" />
                        <input type="text" value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && setActiveTicker(ticker)} className="bg-transparent border-none outline-none text-xs font-mono font-bold w-16" />
                        <button onClick={() => setActiveTicker(ticker)} className="ml-2 text-[10px] font-bold text-accent-primary uppercase">Sync</button>
                      </div>
                      <select value={barSize} onChange={e => setBarSize(e.target.value)} className="h-10 bg-surface-primary border border-main-primary rounded px-3 text-[10px] font-bold uppercase tracking-wider text-main-primary">
                        <option value="1m">1 MIN BARS</option>
                        <option value="5m">5 MIN BARS</option>
                        <option value="1h">1 HOUR BARS</option>
                      </select>
                      <button onClick={() => setIsStreaming(!isStreaming)} className={`h-10 px-6 rounded font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all ${isStreaming ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.3)]' : 'bg-accent-primary text-app-primary shadow-[0_0_15px_var(--accent-glow)]'}`}>
                        {isStreaming ? (<><div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />Stop Stream</>) : (<><Activity size={14} />Start Engine</>)}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[{ label: 'Ø PHI', value: params?.phi.toFixed(4) || '---' }, { label: 'μ MEAN', value: params?.mu.toFixed(2) || '---' }, { label: 'σ SIGMA', value: params?.sigma.toFixed(4) || '---' }, { label: 'Engine X', value: kalman?.x.toFixed(2) || '---', color: 'text-accent-primary' }].map(stat => (
                      <div key={stat.label} className="p-4 bg-surface-primary border border-main-primary rounded-xl flex flex-col items-center justify-center min-w-[120px]">
                        <div className="text-[9px] font-bold text-main-tertiary uppercase tracking-widest mb-1">{stat.label}</div>
                        <div className={`text-lg font-mono font-bold ${stat.color || 'text-main-primary'}`}>{stat.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="lg:col-span-4 bg-card-primary border border-main-primary rounded-2xl p-8 flex flex-col justify-between">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-main-primary">Noise Calibration</h3>
                    <span className="text-xs font-mono font-bold text-accent-primary">{noiseLever}%</span>
                  </div>
                  <input type="range" min="0" max="100" value={noiseLever} onChange={e => handleNoiseChange(parseInt(e.target.value))} className="w-full h-1.5 bg-surface-primary rounded-lg appearance-none cursor-pointer accent-accent-primary" />
                  <div className="p-4 bg-accent-surface border border-accent-primary/20 rounded-xl">
                    <p className="text-[10px] text-main-tertiary leading-relaxed">Adjusting R variance: High noise Trust OU, Low noise Trust Price.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                   <button className="flex-1 py-3 bg-emerald-500 text-white rounded-lg text-[10px] font-bold uppercase">Buy</button>
                   <button className="flex-1 py-3 bg-rose-500 text-white rounded-lg text-[10px] font-bold uppercase">Sell</button>
                </div>
              </div>
            </div>
            {/* Chart Area */}
            <div className="bg-card-primary border border-main-primary rounded-2xl p-8 shadow-xl">
               <div className="h-[600px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <ComposedChart data={chartData}>
                     <CartesianGrid strokeDasharray="3 3" opacity={0.05} vertical={false} />
                     <XAxis dataKey="index" hide />
                     <YAxis domain={['auto', 'auto']} orientation="right" tickFormatter={(v) => v.toFixed(2)} fontSize={10} />
                     <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-main)', fontSize: '11px' }} />
                     {params && <ReferenceLine y={params.mu} stroke="var(--text-tertiary)" strokeDasharray="5 5" label={{ value: 'MEAN', fill: 'var(--text-tertiary)', fontSize: 9 }} />}
                     <Line type="monotone" dataKey="close" stroke="var(--text-main)" strokeWidth={1} dot={false} opacity={0.4} />
                     <Area type="monotone" dataKey="kalmanMean" stroke="var(--accent-main)" strokeWidth={2} fill="var(--accent-main)" fillOpacity={0.05} dot={false} />
                     <Scatter dataKey="forecastValue" fill="var(--color-brand-purple)" />
                   </ComposedChart>
                 </ResponsiveContainer>
               </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'stochastic' && (
          <motion.div 
            key="stochastic" 
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="grid lg:grid-cols-4 gap-6">
               <div className="lg:col-span-1 space-y-6">
                  <div className="bg-card-primary border border-main-primary rounded-2xl p-6 space-y-4">
                     <h3 className="text-xs font-bold uppercase tracking-widest text-main-primary flex items-center gap-2">
                       <FlaskConical size={14} className="text-accent-primary" /> Core Simulation
                     </h3>
                     <div className="space-y-4">
                        <div>
                           <label className="text-[9px] font-bold text-main-tertiary uppercase block mb-2">Process Type</label>
                           <div className="grid grid-cols-2 gap-2">
                              {['bm', 'bb', 'gbm', 'ou'].map(type => (
                                <button key={type} onClick={() => setSimType(type as any)} className={`py-2 rounded text-[9px] font-bold border transition-all ${simType === type ? 'bg-accent-primary text-app-primary border-transparent' : 'bg-surface-primary text-main-tertiary border-main-primary'}`}>
                                   {type.toUpperCase()}
                                </button>
                              ))}
                           </div>
                        </div>
                        <div>
                           <label className="text-[9px] font-bold text-main-tertiary uppercase block mb-2">Paths (Max 15)</label>
                           <input type="number" value={simPaths} onChange={e => setSimPaths(Math.min(15, parseInt(e.target.value)))} className="w-full bg-surface-primary border border-main-primary rounded px-3 py-2 text-xs font-mono font-bold" />
                        </div>
                        <button onClick={runSimulation} className="w-full py-3 bg-accent-primary text-app-primary rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                           <Play size={14} /> Run Matrix
                        </button>
                     </div>
                  </div>
                  <div className="bg-card-primary border border-main-primary rounded-2xl p-6">
                     <h4 className="text-[9px] font-bold text-main-tertiary uppercase mb-4">Simulation Context</h4>
                     <p className="text-[10px] text-main-tertiary leading-relaxed">
                        The Stochastic Lab uses the {activeTicker} volatility (σ={params?.sigma.toFixed(3)}) and drift to generate synthetic paths. Use BB for bridges or OU for mean-reversion modeling.
                     </p>
                  </div>
               </div>

               <div className="lg:col-span-3 bg-card-primary border border-main-primary rounded-2xl p-8 relative min-h-[500px]">
                  <div className="flex justify-between items-center mb-10">
                     <h3 className="text-xl font-serif italic text-main-primary capitalize">{simType === 'bm' ? 'Brownian Motion' : simType === 'bb' ? 'Brownian Bridge' : simType === 'gbm' ? 'Geometric Brownian' : 'Ornstein-Uhlenbeck'} Paths</h3>
                     {simData.length > 0 && <span className="text-[10px] font-mono text-accent-primary">N = {simSteps} Steps</span>}
                  </div>
                  <div className="h-[450px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={simData}>
                         <CartesianGrid strokeDasharray="3 3" opacity={0.05} vertical={false} />
                         <XAxis dataKey="index" hide />
                         <YAxis domain={['auto', 'auto']} orientation="right" fontSize={10} tickLine={false} axisLine={false} />
                         <Tooltip contentStyle={{ backgroundColor: 'black', border: '1px solid #333', fontSize: '10px' }} />
                         {Array.from({ length: 15 }).map((_, i) => (
                           <Line key={i} type="monotone" dataKey={`p${i}`} stroke={`hsl(${i * 25}, 70%, 50%)`} strokeWidth={1} dot={false} opacity={simData[0]?.[`p${i}`] !== undefined ? 1 : 0} />
                         ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
               </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'options' && (
          <motion.div 
            key="options" 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-8"
          >
            <div className="grid lg:grid-cols-12 gap-6">
               <div className="lg:col-span-4 space-y-6">
                  <div className="bg-card-primary border border-main-primary rounded-2xl p-8 space-y-6">
                     <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-main-primary">Contract Engine</h3>
                     <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="text-[9px] font-bold text-main-tertiary uppercase block mb-1">Strike ($)</label>
                              <input type="number" value={strike} onChange={e => setStrike(parseFloat(e.target.value))} className="w-full bg-surface-primary border border-main-primary rounded p-3 text-xs font-mono font-bold" />
                           </div>
                           <div>
                              <label className="text-[9px] font-bold text-main-tertiary uppercase block mb-1">Time (Yrs)</label>
                              <input type="number" value={expiry} onChange={e => setExpiry(parseFloat(e.target.value))} className="w-full bg-surface-primary border border-main-primary rounded p-3 text-xs font-mono font-bold" />
                           </div>
                        </div>
                        <div>
                           <label className="text-[9px] font-bold text-main-tertiary uppercase block mb-1">Risk Free Rate</label>
                           <input type="number" value={riskFree} step="0.001" onChange={e => setRiskFree(parseFloat(e.target.value))} className="w-full bg-surface-primary border border-main-primary rounded p-3 text-xs font-mono font-bold" />
                        </div>
                        <button onClick={calculateOptions} className="w-full py-4 bg-accent-primary text-app-primary rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-[0_4px_20px_var(--accent-glow)]">
                           <Calculator size={16} /> Compute Matrix
                        </button>
                     </div>
                  </div>
               </div>

               <div className="lg:col-span-8 grid md:grid-cols-2 gap-6">
                  {['call', 'put'].map(type => {
                     const res = type === 'call' ? pricingResult?.call : pricingResult?.put;
                     return (
                       <div key={type} className="bg-card-primary border border-main-primary rounded-2xl p-8 flex flex-col justify-between">
                          <div className="flex justify-between items-start mb-8">
                             <div>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-main-primary">{type} Matrix</h3>
                                <p className="text-[10px] text-main-tertiary uppercase">Monte Carlo 50,000 Paths</p>
                             </div>
                             <div className={`p-2 rounded-lg ${type === 'call' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                {type === 'call' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                             </div>
                          </div>
                          
                          <div className="space-y-6">
                             <div className="flex flex-col items-center justify-center py-6 border-y border-main-primary/20">
                                <span className="text-[9px] font-bold text-main-tertiary uppercase tracking-widest mb-1">Estimated Value</span>
                                <span className={`text-5xl font-mono font-bold ${type === 'call' ? 'text-emerald-400' : 'text-rose-400'}`}>${res?.price.toFixed(2) || '---'}</span>
                                <span className="text-[9px] font-mono text-main-tertiary mt-2">Std Error: ±{res?.stdError.toFixed(4) || '---'}</span>
                             </div>
                             <div className="space-y-3">
                                <div className="flex justify-between text-[10px]">
                                   <span className="text-main-tertiary uppercase font-bold">In-The-Money Prob</span>
                                   <span className="text-main-primary font-mono">{res ? (res.payoffs.filter(p => p > 0).length / res.payoffs.length * 100).toFixed(1) : '---'}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-surface-primary rounded-full overflow-hidden">
                                   <div 
                                     className={`h-full transition-all duration-1000 ${type === 'call' ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                                     style={{ width: res ? `${(res.payoffs.filter(p => p > 0).length / res.payoffs.length * 100)}%` : '0%' }} 
                                   />
                                </div>
                             </div>
                          </div>
                       </div>
                     );
                  })}
               </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'volatility' && (
          <motion.div 
            key="volatility" 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -15 }}
            className="space-y-8"
          >
            <div className="grid lg:grid-cols-12 gap-6">
               <div className="lg:col-span-4 space-y-6">
                  <div className="bg-card-primary border border-main-primary rounded-2xl p-8 space-y-6">
                     <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-main-primary flex items-center gap-2">
                       <Waves size={16} className="text-accent-primary" /> 
                       Crush Scenario
                     </h3>
                     
                     <div className="space-y-4">
                        <div className="p-4 bg-surface-primary border border-main-primary rounded-xl flex items-center justify-between">
                           <div>
                              <div className="text-[9px] font-bold text-main-tertiary uppercase mb-1">Current Spot</div>
                              <div className="text-sm font-mono font-bold text-main-primary">${lastPrice?.toFixed(2) || '---'}</div>
                           </div>
                           <div className="text-right">
                              <div className="text-[9px] font-bold text-main-tertiary uppercase mb-1">Current IV</div>
                              <div className="text-sm font-mono font-bold text-accent-primary">{((params?.sigma || 0) * 100).toFixed(1)}%</div>
                           </div>
                        </div>

                        <div className="space-y-3">
                           <div>
                              <label className="text-[9px] font-bold text-main-tertiary uppercase block mb-1">Target Price (Spot)</label>
                              <input 
                                type="number" 
                                value={targetSpot} 
                                onChange={e => setTargetSpot(e.target.value)}
                                placeholder={lastPrice?.toFixed(2)}
                                className="w-full bg-surface-primary border border-main-primary rounded p-3 text-xs font-mono font-bold outline-none focus:border-accent-primary" 
                              />
                           </div>
                           <div>
                              <label className="text-[9px] font-bold text-main-tertiary uppercase block mb-1">Target Volatility (IV %)</label>
                              <input 
                                type="number" 
                                value={targetIV === '' ? '' : (Number(targetIV) * 100)} 
                                onChange={e => setTargetIV(e.target.value === '' ? '' : (Number(e.target.value) / 100))}
                                placeholder={((params?.sigma || 0) * 100).toFixed(1)}
                                className="w-full bg-surface-primary border border-main-primary rounded p-3 text-xs font-mono font-bold outline-none focus:border-accent-primary" 
                              />
                           </div>
                        </div>

                        <button 
                          onClick={runVolatilityAnalysis}
                          className="w-full py-4 bg-accent-primary text-app-primary rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-[0_4px_20px_var(--accent-glow)] mt-4"
                        >
                           <Binary size={16} /> Run Scenario
                        </button>
                     </div>
                  </div>
               </div>

               <div className="lg:col-span-8 space-y-6">
                  {scenarioResult ? (
                    <div className="grid md:grid-cols-2 gap-6 h-full">
                       {/* Result Side */}
                       <div className="bg-card-primary border border-main-primary rounded-2xl p-8 flex flex-col justify-between">
                          <div>
                             <h4 className="text-xs font-bold uppercase tracking-widest text-main-primary mb-2">Scenario Alpha</h4>
                             <p className="text-[10px] text-main-tertiary">Differential analysis across variance shifts</p>
                          </div>

                          <div className="py-10 border-y border-main-primary/10 flex flex-col items-center">
                             <span className="text-[9px] font-bold text-main-tertiary uppercase tracking-[0.2em] mb-2">Net P/L Result</span>
                             <div className={`text-6xl font-mono font-bold ${scenarioResult.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {scenarioResult.pnl >= 0 ? '+' : ''}{scenarioResult.pnl.toFixed(2)}
                             </div>
                             <span className="text-[10px] font-bold text-main-tertiary uppercase mt-4">Straddle Value: ${(scenarioResult.scenario.call + scenarioResult.scenario.put).toFixed(2)}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                             <div className="p-4 bg-surface-primary border border-main-primary rounded-xl">
                                <div className="text-[8px] font-bold text-main-tertiary uppercase mb-1">New Delta</div>
                                <div className="text-sm font-mono font-bold text-main-primary">{scenarioResult.scenario.greeks.delta.toFixed(3)}</div>
                             </div>
                             <div className="p-4 bg-surface-primary border border-main-primary rounded-xl">
                                <div className="text-[8px] font-bold text-main-tertiary uppercase mb-1">New Gamma</div>
                                <div className="text-sm font-mono font-bold text-main-primary">{scenarioResult.scenario.greeks.gamma.toFixed(4)}</div>
                             </div>
                          </div>
                       </div>

                       {/* Greeks Side */}
                       <div className="bg-card-primary border border-main-primary rounded-2xl p-8 space-y-8">
                          <h4 className="text-xs font-bold uppercase tracking-widest text-main-primary">Greek Drift</h4>
                          
                          <div className="space-y-6">
                             {[
                               { label: 'Delta', val: scenarioResult.scenario.greeks.delta, orig: scenarioResult.original.greeks.delta, fmt: (v: number) => v.toFixed(3) },
                               { label: 'Gamma', val: scenarioResult.scenario.greeks.gamma, orig: scenarioResult.original.greeks.gamma, fmt: (v: number) => v.toFixed(4) },
                               { label: 'Vega', val: scenarioResult.scenario.greeks.vega, orig: scenarioResult.original.greeks.vega, fmt: (v: number) => v.toFixed(2) },
                               { label: 'Theta', val: scenarioResult.scenario.greeks.theta, orig: scenarioResult.original.greeks.theta, fmt: (v: number) => v.toFixed(2) }
                             ].map(g => (
                               <div key={g.label} className="flex items-center justify-between">
                                  <div className="text-[10px] font-bold text-main-tertiary uppercase">{g.label}</div>
                                  <div className="flex items-center gap-4">
                                     <span className="text-[9px] font-mono text-main-tertiary opacity-40">{g.fmt(g.orig)}</span>
                                     <ChevronRight size={12} className="text-main-tertiary opacity-30" />
                                     <span className="text-xs font-mono font-bold text-main-primary">{g.fmt(g.val)}</span>
                                  </div>
                               </div>
                             ))}
                          </div>

                          <div className="p-6 bg-accent-surface border border-accent-primary/20 rounded-2xl relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-4 opacity-[0.05]"><Gauge size={60} /></div>
                             <h5 className="text-[10px] font-bold text-accent-primary uppercase mb-2">Sensitivity Insight</h5>
                             <p className="text-[10px] text-main-tertiary leading-relaxed italic">
                               The scenario assumes a instantaneous jump to target spot and target vol while time remains constant (T={expiry}y).
                             </p>
                          </div>
                       </div>
                    </div>
                  ) : (
                    <div className="h-full bg-card-primary border border-main-primary border-dashed rounded-2xl flex flex-col items-center justify-center opacity-40">
                       <FlaskConical size={48} className="mb-4 text-main-tertiary" />
                       <p className="text-xs uppercase tracking-widest font-bold text-main-tertiary">Awaiting Simulation Parameters</p>
                    </div>
                  )}
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

