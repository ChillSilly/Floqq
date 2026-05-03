import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Calculator, Zap, ArrowRight, Info, Target, TrendingUp, Activity } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { bsPrice, bsDelta, bsGamma, bsVega, bsTheta, bsCharm, bsVanna, bsVomma, bsZomma } from '../lib/blackScholes';

const C = {
  bg: 'var(--bg-app)', bg1: 'var(--bg-card)', border: 'var(--border-main)',
  accent: 'var(--brand-purple)', neon: 'var(--accent-primary)', green: 'var(--brand-emerald)', pink: '#ff2d55',
  amber: 'var(--brand-amber)', violet: 'var(--brand-purple)',
  t1: 'var(--text-main)', t2: 'var(--text-main)', t3: 'var(--text-main)'
};

function Slider({ label, value, onChange, min, max, step, unit = '', color = C.accent }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; unit?: string; color?: string;
}) {
  return (
    <div className="mb-6 group">
      <div className="flex justify-between mb-3">
        <label className="text-[10px] font-mono font-bold text-main-primary opacity-30 uppercase tracking-widest group-hover:opacity-50 transition-colors">{label}</label>
        <span className="text-sm font-mono font-bold" style={{ color }}>
          {value.toFixed(step < 1 ? (step < 0.01 ? 3 : 2) : 0)}{unit}
        </span>
      </div>
      <input 
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-black/5 dark:bg-white/5 rounded-full appearance-none cursor-pointer accent-current hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        style={{ color }}
      />
    </div>
  );
}

function GreekCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="bg-accent-surface border border-main-primary rounded-2xl p-5 relative overflow-hidden group hover:bg-card-primary transition-all">
      <div className="absolute top-0 right-0 w-24 h-24 blur-3xl opacity-[0.03] transition-opacity group-hover:opacity-[0.06]" style={{ backgroundColor: color }} />
      <div className="text-[9px] font-mono font-bold text-main-primary opacity-20 uppercase tracking-[0.2em] mb-4">{label}</div>
      <div className="text-2xl font-mono font-bold tracking-tighter" style={{ color }}>{value}</div>
      {sub && <div className="text-[9px] text-main-primary opacity-25 mt-2 font-medium tracking-tight h-4 truncate">/{sub}</div>}
    </div>
  );
}

export function BlackScholesCalculator() {
  const [spot, setSpot] = useState(550);
  const [strike, setStrike] = useState(550);
  const [days, setDays] = useState(30);
  const [iv, setIv] = useState(0.20);
  const [rate, setRate] = useState(0.043);
  const [divYield, setDivYield] = useState(0.013);
  const [flag, setFlag] = useState<'C' | 'P'>('C');
  const [plotType, setPlotType] = useState<'price' | 'delta' | 'gamma' | 'vega' | 'theta'>('price');

  const T = Math.max(days, 0.5) / 365;

  const greeks = useMemo(() => {
    const price = bsPrice(spot, strike, T, rate, divYield, iv, flag);
    const delta = bsDelta(spot, strike, T, rate, divYield, iv, flag);
    const gamma = bsGamma(spot, strike, T, rate, divYield, iv);
    const vega = bsVega(spot, strike, T, rate, divYield, iv);
    const theta = bsTheta(spot, strike, T, rate, divYield, iv, flag);
    const charm = bsCharm(spot, strike, T, rate, divYield, iv, flag);
    const vanna = bsVanna(spot, strike, T, rate, divYield, iv);
    const vomma = bsVomma(spot, strike, T, rate, divYield, iv);
    const zomma = bsZomma(spot, strike, T, rate, divYield, iv);
    return { price, delta, gamma, vega, theta, charm, vanna, vomma, zomma };
  }, [spot, strike, T, iv, rate, divYield, flag]);

  const plotData = useMemo(() => {
    const data = [];
    const minSpot = spot * 0.7;
    const maxSpot = spot * 1.3;
    const step = (maxSpot - minSpot) / 50;

    for (let currentSpot = minSpot; currentSpot <= maxSpot; currentSpot += step) {
      data.push({
        spot: Math.round(currentSpot),
        price: bsPrice(currentSpot, strike, T, rate, divYield, iv, flag),
        delta: bsDelta(currentSpot, strike, T, rate, divYield, iv, flag),
        gamma: bsGamma(currentSpot, strike, T, rate, divYield, iv),
        vega: bsVega(currentSpot, strike, T, rate, divYield, iv),
        theta: bsTheta(currentSpot, strike, T, rate, divYield, iv, flag)
      });
    }
    return data;
  }, [spot, strike, T, iv, rate, divYield, flag]);

  const getPlotColor = () => {
    switch (plotType) {
      case 'price': return C.neon;
      case 'delta': return flag === 'C' ? C.green : C.pink;
      case 'gamma': return C.neon;
      case 'vega': return C.amber;
      case 'theta': return C.pink;
      default: return C.accent;
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-main-primary">
        <div>
          <div className="flex items-center gap-3 mb-3">
             <div className="p-2 bg-accent-primary/10 rounded-xl border border-accent-primary/20">
               <Calculator size={16} className="text-accent-primary" />
             </div>
             <span className="text-[10px] font-mono font-bold tracking-[0.4em] text-accent-primary opacity-60 uppercase">Quantitative Workbench</span>
          </div>
          <h2 className="text-4xl font-black tracking-tighter text-main-primary uppercase italic">
            Black-Scholes <span className="text-accent-primary">Calculator</span>
          </h2>
        </div>
        <div className="text-right hidden md:block">
           <div className="text-[10px] font-mono font-bold text-main-primary opacity-20 uppercase tracking-widest mb-1">Standard Reference</div>
           <div className="text-xs text-main-primary opacity-40 italic">Continuous Dividend Model v2.4</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Inputs */}
        <div className="lg:col-span-4 space-y-6 bg-card-primary border border-main-primary rounded-3xl p-8 shadow-2xl relative">
          <div className="absolute inset-0 bg-gradient-to-b from-main-primary/5 to-transparent pointer-events-none" />
          
          {/* Flag Toggle */}
          <div className="flex p-1 bg-accent-surface rounded-2xl border border-main-primary mb-8">
             <button 
               onClick={() => setFlag('C')}
               className={`flex-1 py-3 text-xs font-mono font-black uppercase rounded-xl transition-all ${
                 flag === 'C' ? 'bg-brand-emerald text-app-primary shadow-[0_0_20px_var(--accent-glow)]' : 'text-main-primary opacity-30 hover:opacity-50'
               }`}
             >
               📈 Call Option
             </button>
             <button 
               onClick={() => setFlag('P')}
               className={`flex-1 py-3 text-xs font-mono font-black uppercase rounded-xl transition-all ${
                 flag === 'P' ? 'bg-rose-500 text-app-primary shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'text-main-primary opacity-30 hover:opacity-50'
               }`}
             >
               📉 Put Option
             </button>
          </div>

          <Slider label="Spot Price" value={spot} onChange={setSpot} min={10} max={2000} step={1} unit="$" color={C.t1} />
          <Slider label="Strike Price" value={strike} onChange={setStrike} min={10} max={2000} step={1} unit="$" color={C.t2} />
          <Slider label="Time to Expiry" value={days} onChange={setDays} min={0.5} max={365} step={0.5} unit=" Days" color={C.neon} />
          <Slider label="Implied Vol" value={iv} onChange={setIv} min={0.01} max={2.0} step={0.01} color={C.accent} />
          <Slider label="Risk Free Rate" value={rate} onChange={setRate} min={0} max={0.1} step={0.001} color={C.amber} />
          <Slider label="Div Yield" value={divYield} onChange={setDivYield} min={0} max={0.1} step={0.001} color={C.green} />
        </div>

        {/* Right: Outputs */}
        <div className="lg:col-span-8 flex flex-col gap-6">
           {/* Primary Price Display */}
           <div className="bg-card-primary border border-main-primary rounded-3xl p-8 relative group overflow-hidden">
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-accent-primary/5 blur-3xl rounded-full" />
              <div className="flex items-center justify-between relative z-10">
                 <div>
                    <div className="text-[10px] font-mono font-bold text-main-primary opacity-30 uppercase tracking-[0.4em] mb-4">Theoretical Value</div>
                    <div className="text-6xl font-black tracking-tighter text-main-primary tabular-nums drop-shadow-[0_0_15px_var(--accent-glow)]">
                      ${greeks.price.toFixed(3)}
                    </div>
                 </div>
                 <div className="text-right">
                    <div className="text-[9px] font-mono font-bold text-main-primary opacity-20 uppercase mb-2">Per Contract</div>
                    <div className="text-2xl font-mono font-bold text-main-primary opacity-80">${(greeks.price * 100).toFixed(2)}</div>
                 </div>
              </div>
           </div>

           {/* Greeks Grid */}
           <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <GreekCard label="Delta" value={greeks.delta.toFixed(4)} color={flag === 'C' ? C.green : C.pink} sub="Rate of change vs Spot" />
              <GreekCard label="Gamma" value={greeks.gamma.toFixed(5)} color={C.neon} sub="Delta sensitivity" />
              <GreekCard label="Vega" value={greeks.vega.toFixed(4)} color={C.amber} sub="Impact of 1% IV move" />
              <GreekCard label="Theta (Daily)" value={greeks.theta.toFixed(4)} color={C.pink} sub="Daily time decay" />
              <GreekCard label="Charm" value={greeks.charm.toFixed(6)} color={C.violet} sub="Delta decay over time" />
              <GreekCard label="Vanna" value={greeks.vanna.toFixed(6)} color={C.t2} sub="Delta sensitivity to Vol" />
           </div>

           {/* Plot Profile Section */}
           <div className="bg-accent-surface border border-main-primary rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                 <div className="flex items-center gap-2">
                    <Activity size={16} className="text-accent-primary" />
                    <span className="text-xs font-mono font-bold text-main-primary opacity-60 uppercase tracking-widest">Risk Profile Plot</span>
                 </div>
                 
                 <div className="flex gap-2">
                    {(['price', 'delta', 'gamma', 'vega', 'theta'] as const).map(type => (
                       <button
                         key={type}
                         onClick={() => setPlotType(type)}
                         className={`px-3 py-1.5 text-[10px] font-mono font-bold uppercase rounded-lg border transition-all ${
                           plotType === type 
                             ? 'bg-accent-primary text-app-primary border-accent-primary shadow-[0_0_10px_var(--accent-glow)]' 
                             : 'bg-transparent border-main-primary/20 text-main-primary opacity-60 hover:opacity-100 hover:border-main-primary/50'
                         }`}
                       >
                         {type}
                       </button>
                    ))}
                 </div>
              </div>

              <div className="h-64 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={plotData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                       <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" opacity={0.2} vertical={false} />
                       <XAxis 
                         dataKey="spot" 
                         stroke="var(--text-main)" 
                         opacity={0.3} 
                         tick={{ fill: 'var(--text-main)', fontSize: 10, fontFamily: 'monospace' }}
                         tickFormatter={(v) => `$${v}`}
                         domain={['dataMin', 'dataMax']}
                         type="number"
                       />
                       <YAxis 
                         stroke="var(--text-main)" 
                         opacity={0.3} 
                         tick={{ fill: 'var(--text-main)', fontSize: 10, fontFamily: 'monospace' }} 
                         width={60}
                         domain={['auto', 'auto']}
                         tickFormatter={(v) => v.toFixed(plotType === 'gamma' ? 4 : 2)}
                       />
                       <Tooltip
                         contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-main)', borderRadius: '8px' }}
                         itemStyle={{ color: getPlotColor(), fontFamily: 'monospace', fontSize: '12px', fontWeight: 'bold' }}
                         labelStyle={{ color: 'var(--text-main)', opacity: 0.5, fontFamily: 'monospace', fontSize: '10px', marginBottom: '4px' }}
                         formatter={(value: number) => [value.toFixed(4), plotType.toUpperCase()]}
                         labelFormatter={(label: number) => `SPOT: $${label}`}
                       />
                       {/* Strike Line */}
                       <Line 
                         type="monotone" 
                         dataKey={plotType} 
                         stroke={getPlotColor()} 
                         strokeWidth={3} 
                         dot={false}
                         activeDot={{ r: 6, fill: getPlotColor(), stroke: 'var(--bg-app)', strokeWidth: 2 }}
                         animationDuration={500}
                       />
                    </LineChart>
                 </ResponsiveContainer>
              </div>
           </div>

           {/* Second Order Details */}
           <div className="bg-accent-surface border border-main-primary rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                 <Zap size={14} className="text-brand-amber" />
                <span className="text-[10px] font-mono font-bold text-main-primary opacity-40 uppercase tracking-widest">Higher Order Greeks</span>
              </div>
              <div className="grid grid-cols-2 gap-8">
                 <div className="flex justify-between items-center group">
                    <span className="text-xs text-main-primary flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity underline decoration-dotted decoration-main-primary/20 cursor-help" title="Vega sensitivity to volatility changes">Vomma (Vol of Vol)</span>
                    <span className="text-sm font-mono font-bold text-main-primary opacity-80">{greeks.vomma.toFixed(6)}</span>
                 </div>
                 <div className="flex justify-between items-center group">
                    <span className="text-xs text-main-primary flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity underline decoration-dotted decoration-main-primary/20 cursor-help" title="Gamma sensitivity to volatility changes">Zomma</span>
                    <span className="text-sm font-mono font-bold text-main-primary opacity-80">{greeks.zomma.toFixed(6)}</span>
                 </div>
              </div>
           </div>

           {/* Disclaimer/Info */}
           <div className="flex gap-4 p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
              <Info size={16} className="text-blue-400 shrink-0" />
              <p className="text-[10px] text-blue-300/60 leading-relaxed font-medium">
                The Black-Scholes model assumes constant volatility, risk-free interest rates, and log-normal return distributions. Real-world market friction, non-constant skew, and discrete dividends may cause divergence from these theoretical values.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}

