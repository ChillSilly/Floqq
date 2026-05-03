import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, ArrowDownRight, ArrowUpRight, Shield } from 'lucide-react';

export function HedgingAnimation() {
  const [phase, setPhase] = useState(0); // 0: baseline, 1: drop, 2: hedge, 3: recover, 4: hedge
  
  useEffect(() => {
    const timer = setInterval(() => {
      setPhase((p) => (p + 1) % 5);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const getPricePosition = () => {
    switch(phase) {
      case 0: return 50;
      case 1: return 80;
      case 2: return 80;
      case 3: return 20;
      case 4: return 20;
      default: return 50;
    }
  };

  const getMMAction = () => {
    switch(phase) {
      case 0: return { action: "Neutral", color: "text-main-primary", bg: "bg-main-primary/10", detail: "Perfectly hedged" };
      case 1: return { action: "Long Delta", color: "text-rose-500", bg: "bg-rose-500/10", detail: "Price drops, Put delta increases" };
      case 2: return { action: "Selling Asset", color: "text-rose-500", bg: "bg-rose-500/20", detail: "Shorting to get back to neutral" };
      case 3: return { action: "Short Delta", color: "text-brand-emerald", bg: "bg-brand-emerald/10", detail: "Price rises, Put delta decreases" };
      case 4: return { action: "Buying Asset", color: "text-brand-emerald", bg: "bg-brand-emerald/20", detail: "Buying back shorts to balance" };
      default: return { action: "Neutral", color: "", bg: "", detail: "" };
    }
  };

  const { action, color, bg, detail } = getMMAction();

  return (
    <div className="bg-card-primary border border-main-primary/20 p-6 rounded-2xl shadow-sm">
      <div className="mb-6">
        <h4 className="text-xl font-serif italic text-main-primary mb-2 flex items-center gap-2">
          <Shield size={20} className="text-accent-primary" />
          Interactive: Short Put Hedging (Negative Gamma)
        </h4>
        <p className="text-sm text-main-primary opacity-70">
          When a Market Maker sells a put option, they are short gamma. Watch how their forced hedging exacerbates price movement.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Price Chart Side */}
        <div className="relative h-48 bg-accent-surface rounded-xl border border-main-primary/10 overflow-hidden flex items-center p-4">
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[linear-gradient(rgba(var(--color-main-primary),0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(var(--color-main-primary),0.2)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
          
          <div className="w-full relative h-[140px] border-l border-b border-main-primary/30">
            {/* Price Line Indicator */}
            <motion.div 
               className="absolute left-0 w-full border-t-2 border-dashed border-accent-primary z-10"
               animate={{ top: `${getPricePosition()}%` }}
               transition={{ type: "spring", stiffness: 40, damping: 15 }}
            >
               <div className="absolute right-0 -top-3 bg-accent-primary text-card-primary text-[10px] font-bold px-2 py-0.5 rounded shadow">PRICE</div>
            </motion.div>

            {/* Trading Volume Indicator */}
            <AnimatePresence>
               {phase === 2 && (
                 <motion.div 
                   initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                   className="absolute left-1/2 top-[80%] -translate-x-1/2 flex items-center gap-1 text-rose-500 font-bold bg-rose-500/10 px-3 py-1 rounded-full z-20"
                 >
                   <ArrowDownRight size={16} /> Selling Pressure
                 </motion.div>
               )}
               {phase === 4 && (
                 <motion.div 
                   initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                   className="absolute left-1/2 top-[20%] -translate-x-1/2 flex items-center gap-1 text-brand-emerald font-bold bg-brand-emerald/10 px-3 py-1 rounded-full z-20"
                 >
                   <ArrowUpRight size={16} /> Buying Pressure
                 </motion.div>
               )}
            </AnimatePresence>
          </div>
        </div>

        {/* Market Maker Book Side */}
        <div className="flex flex-col justify-center gap-4">
          <div className="flex justify-between text-xs font-mono uppercase tracking-widest text-main-primary opacity-50 mb-2">
            <span>Market Maker Book</span>
            <span>Delta Exposure</span>
          </div>

          <div className={`p-4 rounded-xl border border-main-primary/10 transition-colors duration-500 ${bg}`}>
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-main-primary">Status:</span>
              <span className={`font-mono font-bold ${color}`}>{action}</span>
            </div>
            <div className="text-sm text-main-primary opacity-80 h-10">
              {detail}
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="flex justify-between mt-4">
            {[0,1,2,3,4].map(idx => (
              <div key={idx} className={`h-1.5 flex-1 mx-0.5 rounded-full transition-colors duration-500 ${phase === idx ? 'bg-accent-primary' : phase > idx ? 'bg-accent-primary/40' : 'bg-main-primary/10'}`} />
            ))}
          </div>
          <div className="text-center text-[10px] font-mono text-main-primary opacity-40 uppercase">
             {phase === 0 && 'Baseline'}
             {phase === 1 && 'Market Drop'}
             {phase === 2 && 'Forced Hedging'}
             {phase === 3 && 'Market Rally'}
             {phase === 4 && 'Forced Hedging'}
          </div>
        </div>
      </div>
    </div>
  );
}
