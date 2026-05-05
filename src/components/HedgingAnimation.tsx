import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield } from 'lucide-react';

export function HedgingAnimation() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhase((p) => (p + 1) % 5);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const getMMAction = () => {
    switch(phase) {
      case 0: return { title: "Neutral State", color: "text-main-primary", bg: "bg-main-primary/5", border: "border-main-primary/20", detail: "Market Maker is perfectly delta neutral." };
      case 1: return { title: "Delta Imbalance", color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/30", detail: "Price drops. The short put gains Delta. MM becomes dangerously LONG Delta." };
      case 2: return { title: "Forced Selling", color: "text-rose-500", bg: "bg-rose-500/20", border: "border-rose-500/50", detail: "MM sells underlying assets into the falling market to neutralize their Long Delta, amplifying the drop." };
      case 3: return { title: "Delta Imbalance", color: "text-brand-emerald", bg: "bg-brand-emerald/10", border: "border-brand-emerald/30", detail: "Price rallies. The short put loses Delta. The MM's previous short hedges now make them dangerously SHORT Delta." };
      case 4: return { title: "Forced Buying", color: "text-brand-emerald", bg: "bg-brand-emerald/20", border: "border-brand-emerald/50", detail: "MM buys underlying assets into the rising market to cover their short hedges, amplifying the rally." };
      default: return { title: "Neutral", color: "", bg: "", border: "", detail: "" };
    }
  };

  const getPricePosition = () => {
    // 0 = left (drop), 50 = middle, 100 = right (rally)
    switch(phase) {
      case 0: return 50;
      case 1: return 15;
      case 2: return 15;
      case 3: return 85;
      case 4: return 85;
      default: return 50;
    }
  };

  const getExposure = () => {
    switch(phase) {
      case 0: return 0;
      case 1: return 40; // Long delta
      case 2: return 0;  // Hedged back to 0
      case 3: return -40; // Short delta
      case 4: return 0; // Hedged back to 0
      default: return 0;
    }
  };

  const { title, color, bg, border, detail } = getMMAction();

  return (
    <div className="relative overflow-hidden group/container flex flex-col justify-center h-full w-full max-w-[360px] mx-auto">
      
      <div className="mb-10 text-center">
         <h4 className="text-2xl font-serif italic text-main-primary mb-3 flex items-center justify-center gap-2">
            <Shield size={20} className="text-accent-primary" /> The Short Gamma Loop
         </h4>
         <p className="text-xs text-main-primary/60 font-sans leading-relaxed max-w-[280px] mx-auto">
            How dealers are forced to trade with the trend, amplifying velocity.
         </p>
      </div>

      <div className="relative mb-12">
         <div className="flex justify-between text-[10px] font-mono uppercase tracking-[0.2em] mb-4 text-main-primary opacity-40">
             <span>Market Price</span>
         </div>
         {/* Price Track */}
         <div className="h-[2px] bg-main-primary/20 w-full relative">
            <motion.div 
               className="absolute top-1/2 -translate-y-1/2 -ml-2 w-4 h-4 rounded-full bg-accent-primary shadow-[0_0_12px_rgba(var(--color-accent-primary),0.6)]"
               animate={{ left: `${getPricePosition()}%` }}
               transition={{ type: "spring", stiffness: 40, damping: 15 }}
            />
            {/* Price Zones */}
            <div className="absolute top-4 left-0 text-[10px] font-mono text-rose-500 opacity-80">DROP</div>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] font-mono text-main-primary opacity-40">SPOT</div>
            <div className="absolute top-4 right-0 text-[10px] font-mono text-brand-emerald opacity-80">RALLY</div>
         </div>
      </div>

      <div className="relative mb-8">
         <div className="flex justify-between text-[10px] font-mono uppercase tracking-[0.2em] mb-3 text-main-primary opacity-40">
             <span>Dealer Delta Exposure</span>
         </div>
         {/* Exposure Track */}
         <div className="h-4 w-full bg-main-primary/5 rounded border border-main-primary/10 relative overflow-hidden">
             <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-main-primary/30 z-10" />
             
             {/* The Exposure Fill */}
             <motion.div 
                className={`absolute top-0 bottom-0 ${getExposure() > 0 ? 'bg-rose-500/60 left-1/2 origin-left' : 'bg-brand-emerald/60 right-1/2 origin-right'}`}
                animate={{ 
                   width: `${Math.abs(getExposure())}%`,
                   backgroundColor: getExposure() > 0 ? 'rgb(244 63 94 / 0.6)' : 'rgb(16 185 129 / 0.6)'
                }}
                transition={{ type: "spring", stiffness: 50, damping: 15 }}
             />
         </div>
         <div className="flex justify-between mt-2">
             <span className="text-[9px] font-mono text-brand-emerald opacity-80">SHORT DELTA</span>
             <span className="text-[9px] font-mono text-rose-500 opacity-80">LONG DELTA</span>
         </div>
      </div>

      <div className={`mt-4 p-6 rounded-2xl border transition-all duration-700 text-center ${bg} ${border} min-h-[160px] flex flex-col items-center justify-center relative overflow-hidden`}>
         <motion.div 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-main-primary/5 to-transparent h-full w-40 -skew-x-12 translate-x-[-200%]"
            animate={{ translateX: ['-100%', '300%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
         />
         <motion.div
           key={title}
           initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
           className={`font-mono font-bold text-[10px] mb-4 uppercase tracking-widest px-3 py-1 rounded inline-block ${color} bg-white/5 border border-white/10`}
         >
           {title}
         </motion.div>
         <AnimatePresence mode="wait">
            <motion.p 
            key={detail}
            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
            className="text-[13px] font-serif italic text-main-primary/90 leading-relaxed"
            >
            {detail}
            </motion.p>
         </AnimatePresence>
      </div>
      
      <div className="flex justify-center gap-2 mt-8">
          {[0,1,2,3,4].map(idx => (
             <div 
                key={idx} 
                className={`h-1.5 w-1.5 rounded-full transition-all duration-1000 ${phase === idx ? 'bg-accent-primary scale-125' : phase > idx ? 'bg-accent-primary/30' : 'bg-main-primary/10'}`} 
             />
          ))}
      </div>

    </div>
  );
}
