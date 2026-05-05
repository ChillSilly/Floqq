import React from 'react';
import type { GexResult } from '../lib/gexEngine';

function fmtB(v: number) { return `${v >= 0 ? '+' : ''}${v.toFixed(3)}B`; }

export function GexMetricsTicker({ data }: { data: GexResult | null }) {
  if (!data) return (
    <div className="flex items-center gap-3 px-6 py-3 bg-accent-surface/30 backdrop-blur-md rounded-2xl animate-pulse">
      <div className="w-2 h-2 rounded-full bg-accent-primary opacity-50" />
      <span className="text-[10px] font-mono font-bold tracking-widest text-main-primary opacity-30 uppercase">Initializing Alpha Stream...</span>
    </div>
  );

  const totalCallGex = data.totals.call_gex || 0;
  const totalPutGex = data.totals.put_gex || 0;
  
  return (
    <div className="flex flex-wrap gap-10 p-5 bg-card-primary/40 backdrop-blur-xl rounded-2xl shadow-xl shadow-black/40 relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-r from-accent-primary/5 to-transparent pointer-events-none" />
      
      <div className="flex items-center gap-4 pr-10">
        <div className="relative">
          <div className="w-2 h-2 rounded-full bg-brand-emerald shadow-[0_0_10px_#10b981]" />
          <div className="absolute inset-0 bg-brand-emerald/40 blur-[4px] rounded-full animate-ping" />
        </div>
        <div className="text-[10px] font-mono font-black tracking-[0.4em] text-main-primary opacity-20 uppercase">Core Metrics (60s)</div>
      </div>

      <div className="flex items-center gap-12">
        <div className="flex flex-col">
          <span className="text-[8px] font-mono font-bold text-main-primary opacity-20 uppercase tracking-widest mb-1">Net Exposure</span>
          <span className={`text-[13px] font-mono font-black ${data.totals.net_gex >= 0 ? 'text-brand-emerald' : 'text-rose-500'} drop-shadow-[0_0_10px_currentColor]`}>
            {fmtB(data.totals.net_gex)}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-[8px] font-mono font-bold text-main-primary opacity-20 uppercase tracking-widest mb-1">Call GEX</span>
          <span className={`text-[13px] font-mono font-black ${totalCallGex >= 0 ? 'text-brand-emerald' : 'text-rose-500'}`}>
            {fmtB(totalCallGex)}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-[8px] font-mono font-bold text-main-primary opacity-20 uppercase tracking-widest mb-1">Put GEX</span>
          <span className={`text-[13px] font-mono font-black ${totalPutGex >= 0 ? 'text-brand-emerald' : 'text-rose-500'}`}>
            {fmtB(totalPutGex)}
          </span>
        </div>
      </div>

      <div className="ml-auto hidden xl:flex items-center gap-4 text-[10px] font-mono font-black text-main-primary opacity-10 uppercase tracking-[0.2em]">
        <span>Encrypted Tunnel Active</span>
        <div className="w-[1px] h-3 bg-white/5" />
        <span className="text-accent-primary/40">Secure Node #751-A</span>
      </div>
    </div>
  );
}
