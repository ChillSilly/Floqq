import React from 'react';
import type { GexResult } from '../lib/gexEngine';

function fmtB(v: number) { return `${v >= 0 ? '+' : ''}${v.toFixed(3)}B`; }

export function GexMetricsTicker({ data }: { data: GexResult | null }) {
  if (!data) return <div className="text-[10px] font-mono text-main-primary opacity-30">Live Metrics Loading...</div>;

  const totalCallGex = data.totals.call_gex || 0;
  const totalPutGex = data.totals.put_gex || 0;
  
  return (
    <div className="flex gap-6 p-4 bg-accent-surface border border-main-primary rounded-xl">
      <div className="text-[10px] font-mono font-bold tracking-widest text-main-primary opacity-40 uppercase">Live Metrics (60s)</div>
      <div className="text-[11px] font-mono">Net: <span className={data.totals.net_gex >= 0 ? 'text-brand-emerald' : 'text-rose-500'}>{fmtB(data.totals.net_gex)}</span></div>
      <div className="text-[11px] font-mono">Call: <span className={totalCallGex >= 0 ? 'text-brand-emerald' : 'text-rose-500'}>{fmtB(totalCallGex)}</span></div>
      <div className="text-[11px] font-mono">Put: <span className={totalPutGex >= 0 ? 'text-brand-emerald' : 'text-rose-500'}>{fmtB(totalPutGex)}</span></div>
    </div>
  );
}
