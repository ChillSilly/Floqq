import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Signal, Zap, Shield, TrendingUp, RefreshCcw } from 'lucide-react';
import { useGexMetrics } from '../hooks/useGexMetrics';

export function GammaGauge({ ticker = 'SPX' }: { ticker?: string }) {
  const { data, loading, error } = useGexMetrics(ticker, 1, 60000);
  const [jitter, setJitter] = useState(0);

  const maxGexB = 25; 
  const maxGexRaw = maxGexB * 1e9;

  // Simulate organic micro-fluctuations to keep it alive
  useEffect(() => {
    const interval = setInterval(() => {
      setJitter((Math.random() * 0.8) - 0.4);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="h-[460px] w-full max-w-[400px] mx-auto rounded-[2.5rem] bg-accent-surface/30 flex flex-col items-center justify-center gap-6 animate-pulse">
        <div className="w-48 h-24 relative">
           <div className="absolute inset-0 bg-gradient-to-t from-accent-primary/10 to-transparent blur-xl" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <RefreshCcw className="w-5 h-5 text-accent-primary/40 animate-spin" />
          <span className="text-[9px] font-mono font-black text-main-primary/20 uppercase tracking-[0.4em]">Calibrating Sensors...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-[460px] rounded-[2.5rem] bg-card-primary flex flex-col items-center justify-center gap-4 text-center p-8">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mb-2">
          <Activity size={24} className="text-rose-500 opacity-50" />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-mono font-black text-rose-500 uppercase tracking-widest block">Neural Link Offline</span>
          <p className="text-[10px] text-main-primary opacity-40 leading-relaxed">External data stream parity error. <br/>Check connection status.</p>
        </div>
      </div>
    );
  }

  const activeGexRaw = data.totals.net_gex; 
  const isPositive = activeGexRaw >= 0;
  const activeGexB = activeGexRaw / 1e9;
  const netGexBDisplay = Math.abs(activeGexB).toFixed(2);
  
  const baseAngle = Math.max(-95, Math.min(95, (activeGexRaw / maxGexRaw) * 90));
  const activeAngle = baseAngle + jitter;

  return (
    <div className="relative w-full max-w-[400px] mx-auto p-8 rounded-xl bg-[#101014] shadow-2xl overflow-hidden group">
      {/* Visual Accents */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className={`absolute -top-32 -left-32 w-64 h-64 blur-[100px] rounded-full pointer-events-none transition-colors duration-1000 ${isPositive ? 'bg-emerald-500/5' : 'bg-rose-500/5'}`} />

      {/* Header Info - Quantower Style */}
      <header className="mb-10 flex justify-between items-start pb-4">
         <div className="space-y-1.5">
            <div className="flex items-center gap-2 mb-1">
               <div className={`w-1.5 h-1.5 rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
               <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#8e8e93]">Physics Engine</span>
            </div>
            <h4 className="text-xl font-mono text-white tracking-wide">Gamma Velocity</h4>
         </div>
         <div className="bg-[#18181c] px-2 py-1 rounded flex items-center gap-2">
            <Signal size={12} className="text-white/40" />
            <span className="text-[10px] font-mono font-bold text-white/60">{ticker}</span>
         </div>
      </header>

      {/* Main Meter View */}
      <div className="relative h-64 flex flex-col items-center justify-center mb-6">
        {/* Semi-circle track */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border-[2px] border-dashed border-white/10 opacity-50" style={{ clipPath: 'inset(0 0 50% 0)' }} />
        
        {/* Active Fill Track */}
        <motion.div 
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border-[4px] ${isPositive ? 'border-emerald-500' : 'border-rose-500'} z-10 transition-colors duration-1000`} 
          animate={{ rotate: activeAngle }}
          transition={{ type: "spring", stiffness: 30, damping: 20 }}
          style={{ clipPath: isPositive ? 'inset(0 0 50% 50%)' : 'inset(0 50% 50% 0)' }}
        />

        {/* Needle */}
        <motion.div 
          className="absolute bottom-1/2 left-1/2 origin-bottom w-[2px] h-28 z-20 flex flex-col items-center"
          animate={{ rotate: activeAngle }}
          transition={{ type: "spring", stiffness: 20, damping: 15 }}
        >
          <div className={`w-full h-full ${isPositive ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-rose-500 shadow-[0_0_10px_#f43f5e]'} transition-colors duration-1000`} />
          <div className="w-3 h-3 rounded-full bg-[#18181c] border-2 border-white/20 absolute -bottom-1.5 z-30 shadow-xl" />
        </motion.div>

        {/* Value Display Overlay */}
        <div className="relative z-30 pt-16 flex flex-col items-center mt-8 bg-[#101014] px-6 rounded-t-full">
          <AnimatePresence mode="popLayout">
            <motion.div 
               key={netGexBDisplay}
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 1.05 }}
               className={`text-5xl font-mono font-black tracking-tighter ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}
            >
               {activeGexRaw >= 0 ? '+' : '-'}{netGexBDisplay}
            </motion.div>
          </AnimatePresence>
          <span className="text-[10px] font-mono font-bold text-[#8e8e93] uppercase tracking-widest mt-1 ml-1">Net GEX ($B)</span>
        </div>
      </div>

      {/* Footer Insight */}
      <div className={`relative p-4 rounded-md transition-all duration-1000 overflow-hidden bg-[#18181c]`}>
         <div className="relative flex items-center gap-4">
            <div className={`p-2 rounded bg-black/20 shadow-sm ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
               {isPositive ? <Shield size={16} /> : <TrendingUp size={16} />}
            </div>
            <div className="flex-1 space-y-1">
               <div className="flex items-center justify-between">
                 <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#8e8e93]">
                    Regime Intelligence
                 </span>
                 <Zap size={10} className={`${isPositive ? 'text-emerald-500' : 'text-rose-500'} opacity-50`} />
               </div>
               <p className="text-xs font-mono text-white/70 leading-relaxed">
                  {isPositive 
                    ? 'Dealers absorb selling volume, creating structural range stability.' 
                    : 'Dealers chase price direction, accelerating market momentum.'}
               </p>
            </div>
         </div>
      </div>
    </div>
  );
}

