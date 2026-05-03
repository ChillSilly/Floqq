import React from 'react';
import { motion } from 'motion/react';
import { useGexMetrics } from '../hooks/useGexMetrics';

export function GammaGauge({ ticker = 'SPX' }: { ticker?: string }) {
  const { data, loading, error } = useGexMetrics(ticker, 1, 60000);

  if (loading) {
    return (
      <div className="h-48 rounded-xl bg-card-primary border border-main-primary/20 flex items-center justify-center animate-pulse">
        <span className="text-sm font-mono text-main-primary opacity-50">Calibrating Gauge...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-48 rounded-xl bg-card-primary border border-main-primary/20 flex items-center justify-center">
        <span className="text-sm font-mono text-rose-500 opacity-80">Failed to load regime</span>
      </div>
    );
  }

  const { regime, totals } = data;
  const isPositive = regime.is_long_gamma;
  const netGexB = (totals.net_gex / 1e9).toFixed(2);
  
  // Calculate an angle for the gauge needle (-90 to +90)
  // Let's assume +/- 50B is the max for the gauge to peg at
  const maxGex = 50e9;
  const angle = Math.max(-90, Math.min(90, (totals.net_gex / maxGex) * 90));

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-card-primary to-accent-surface border border-main-primary/20 p-6 rounded-2xl shadow-sm">
      <div className="flex justify-between items-start mb-6">
        <div>
           <h4 className="text-xl font-serif italic text-main-primary">Gamma Regime Gauge</h4>
           <div className="text-xs uppercase font-mono tracking-widest opacity-60 text-main-primary mt-1">Live <span className="text-accent-primary">{ticker}</span> Net GEX</div>
        </div>
        <div className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider ${isPositive ? 'bg-brand-emerald/10 text-brand-emerald' : 'bg-rose-500/10 text-rose-500'}`}>
           {regime.label}
        </div>
      </div>

      <div className="relative h-32 flex items-end justify-center mb-4">
        {/* Gauge Background */}
        <div className="absolute top-0 w-64 h-32 overflow-hidden">
          <div className="w-64 h-64 border-[24px] border-main-primary/10 rounded-full box-border border-b-transparent border-l-rose-500/40 border-r-brand-emerald/40 rotate-45 transform" />
        </div>
        
        {/* Gauge Needle */}
        <div className="absolute top-0 w-64 h-32 flex justify-center items-end pb-2">
            <motion.div 
              initial={{ rotate: -90 }}
              animate={{ rotate: angle }}
              transition={{ type: "spring", stiffness: 60, damping: 15 }}
              className="w-1 h-24 bg-main-primary origin-bottom rounded-full relative z-10"
              style={{ bottom: '-4px' }}
            >
               <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-accent-primary rounded-full shadow-[0_0_10px_rgba(var(--color-accent-primary),0.8)]" />
            </motion.div>
            <div className="absolute bottom-0 w-6 h-6 bg-main-primary rounded-full z-20 shadow-md"></div>
        </div>
      </div>

      <div className="text-center">
         <div className="text-3xl font-mono font-light text-main-primary mb-1">
            {totals.net_gex > 0 ? '+' : ''}{netGexB}B
         </div>
         <p className="text-sm text-main-primary opacity-60">
            {isPositive ? 'Market Makers provide liquidity. Mean reverting behavior expected.' : 'Market Makers demand liquidity. Trending/volatile behavior expected.'}
         </p>
      </div>
    </div>
  );
}
