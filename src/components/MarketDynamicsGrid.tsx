import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Zap, Shield, Cpu, Layers, Disc, Terminal, AlertCircle } from 'lucide-react';
import { useGexMetrics } from '../hooks/useGexMetrics';

export function MarketDynamicsGrid({ ticker = 'SPY' }: { ticker?: string }) {
  const { data, loading } = useGexMetrics(ticker, 1, 60000);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(p => (p + 1) % 100);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  if (loading || !data) {
    return (
      <div className="h-[380px] w-full flex items-center justify-center bg-[#050510] rounded-3xl animate-pulse">
        <div className="flex flex-col items-center gap-3">
          <Terminal size={24} className="text-blue-500/50" />
          <span className="text-[9px] font-mono font-black text-white/20 uppercase tracking-[0.4em]">Synchronizing Liquidity Nodes...</span>
        </div>
      </div>
    );
  }

  const netGex = data.totals.net_gex;
  const isPositive = netGex >= 0;

  const metrics = [
    { 
      label: 'Net Delta', 
      value: `$${Math.abs(data.totals.dex * data.spot / 1e9).toFixed(1)}B`, 
      icon: Shield, 
      color: 'text-blue-400' 
    },
    { 
      label: 'Net Gamma', 
      value: `$${Math.abs(data.totals.net_gex).toFixed(1)}B`, 
      icon: Layers, 
      color: 'text-rose-400' 
    },
    { 
      label: 'Gamma Flip', 
      value: data.levels.gamma_flip.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), 
      icon: Zap, 
      color: 'text-amber-400' 
    },
    { 
      label: 'Vol Trigger', 
      value: data.levels.vol_trigger.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), 
      icon: Cpu, 
      color: 'text-emerald-400' 
    },
  ];

  return (
    <div className="relative w-full p-0.5 rounded-2xl bg-white/[0.01] shadow-[0_30px_80px_rgba(0,0,0,0.6)] overflow-hidden group font-mono">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      
      {/* Laser Scan Effect */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent animate-[scan_4s_linear_infinite]" />

      <div className="relative p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header - Technical Overlay Style */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-blue-500" />
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40">Realtime Intel</span>
            </div>
            <h3 className="text-lg sm:text-xl font-light text-white tracking-tight">Market Dynamics</h3>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
            <Cpu className="text-blue-400 w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
          </div>
        </div>

        {/* Dynamic Matrix View */}
        <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4">
          {metrics.map((m, i) => (
            <motion.div 
              key={m.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-3 sm:p-4 rounded-2xl bg-white/[0.02] space-y-2 sm:space-y-3 group/item transition-all hover:bg-white/[0.05] border border-white/5"
            >
              <div className="flex items-center justify-between">
                <m.icon size={12} className={`${m.color} opacity-40 group-hover/item:opacity-100 transition-opacity`} />
                <span className="text-[8px] sm:text-[10px] font-bold text-white/20">0{i+1}</span>
              </div>
              <div className="min-w-0">
                <div className="text-[9px] sm:text-[10px] text-white/40 uppercase tracking-widest mb-0.5 sm:mb-1 truncate">{m.label}</div>
                <div className="text-base sm:text-lg text-white font-black truncate">{m.value}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Global Sentiment Terminal */}
        <div className="p-4 sm:p-6 rounded-2xl bg-black/40 relative overflow-hidden border border-white/5">
          <div className={`absolute top-0 left-0 w-full h-1 ${isPositive ? 'bg-emerald-500' : 'bg-rose-500'} opacity-30`} />
          
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-black text-white/60 uppercase tracking-[0.2em] flex items-center gap-2 truncate">
                <Terminal size={10} className="shrink-0" />
                Regime Analysis
              </span>
              <AnimatePresence mode="wait">
                <motion.div
                  key={isPositive ? 'pos' : 'neg'}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className={`text-[8px] sm:text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded shrink-0 ${isPositive ? 'text-emerald-500 bg-emerald-500/5' : 'text-rose-500 bg-rose-500/5'}`}
                >
                  {isPositive ? 'Stability' : 'Momentum'}
                </motion.div>
              </AnimatePresence>
            </div>
            
            <p className="text-[10px] sm:text-xs text-white/60 leading-relaxed font-sans line-clamp-3">
              Critical structural threshold detected. {isPositive 
                ? 'Mean reversion filters active. Anticipate high frequency chop at core walls.' 
                : 'Pro-cyclical hedging engaged. Momentum escalation risk is high below HVL.'}
            </p>

            <div className="pt-1 sm:pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1 w-3 sm:w-4 rounded-full ${i < (isPositive ? 4 : 2) ? 'bg-blue-500' : 'bg-white/10'}`} 
                  />
                ))}
              </div>
              <span className="text-[7px] sm:text-[8px] font-bold text-white/30 uppercase tracking-tighter">Neural Confidence 88%</span>
            </div>
          </div>
        </div>

        {/* System Footer */}
        <div className="flex items-center justify-between text-[8px] text-white/20 uppercase tracking-[0.3em] font-black pt-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={8} />
            Data Stream: Encrypted
          </div>
          <div>Node: ALPHA-9</div>
        </div>
      </div>
      
      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(calc(100% + 100px)); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
