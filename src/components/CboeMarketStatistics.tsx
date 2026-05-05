import React from 'react';
import { motion } from 'motion/react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import type { GexResult } from '../lib/gexEngine';
import { Activity, BarChart2, PieChart as PieChartIcon } from 'lucide-react';

const C = {
  call: '#10b981', // green for calls
  put: '#ef4444', // red for puts
  bg: '#0f172a',
  surface: '#1e293b',
  border: '#334155'
};

export function CboeMarketStatistics({ data }: { data: GexResult | null }) {
  if (!data) return null;

  // Calculate market statistics from the full CBOE option chain
  let totalCallVol = 0;
  let totalPutVol = 0;
  let totalCallOi = 0;
  let totalPutOi = 0;

  for (const r of data.raw) {
    if (r.flag === 'C') {
      totalCallVol += r.volume || 0;
    } else if (r.flag === 'P') {
      totalPutVol += r.volume || 0;
    }
  }
  
  // We need the raw volume and OI from agg
  data.agg.forEach(a => {
     totalCallOi += a.call_oi;
     totalPutOi += a.put_oi;
  });
  
  // Using flow metrics to estimate relative volume distribution since raw volume isn't directly exposed in standard agg. 
  // Wait, let's just use the flow.net and flow.ratio, but we really want raw PCR
  
  return (
    <div className="bg-[#0b0f19] rounded-3xl p-8 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.1] transition-all duration-700 pointer-events-none">
        <PieChartIcon size={120} />
      </div>
      
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <BarChart2 className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white tracking-widest uppercase">CBOE Market Statistics</h2>
          <div className="text-xs font-mono font-bold text-slate-500 tracking-wider">Derived from {data.ticker} Options Chain</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        {/* Put/Call Ratio OI */}
        <div className="bg-[#131b2c] rounded-2xl p-5">
           <div className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-4 tracking-widest">
             Open Interest Ratio
           </div>
           <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-mono font-black text-white">
                  {(totalPutOi / Math.max(1, totalCallOi)).toFixed(2)}
                </div>
                <div className="text-xs font-mono font-bold text-slate-500 mt-1">P/C Ratio</div>
              </div>
              <div className="h-20 w-20">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[{ name: 'Calls', value: totalCallOi }, { name: 'Puts', value: totalPutOi }]}
                      cx="50%" cy="50%" innerRadius={25} outerRadius={35}
                      paddingAngle={5} dataKey="value" stroke="none"
                    >
                      <Cell fill={C.call} />
                      <Cell fill={C.put} />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
           </div>
           
           <div className="flex items-center justify-between mt-4 text-[11px] font-mono font-bold">
             <div className="flex items-center gap-2 text-emerald-400">
               <div className="w-2 h-2 rounded-full bg-emerald-400" />
               Calls: {(totalCallOi).toLocaleString(undefined, {maximumFractionDigits: 0})}
             </div>
             <div className="flex items-center gap-2 text-rose-400">
               Puts: {(totalPutOi).toLocaleString(undefined, {maximumFractionDigits: 0})}
               <div className="w-2 h-2 rounded-full bg-rose-400" />
             </div>
           </div>
        </div>

        {/* Global Volume Flow */}
        <div className="bg-[#131b2c] rounded-2xl p-5">
           <div className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-4 tracking-widest">
             Volume Ratio
           </div>
           <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-mono font-black text-white">
                  {(totalPutVol / Math.max(1, totalCallVol)).toFixed(2)}
                </div>
                <div className="text-xs font-mono font-bold text-slate-500 mt-1">P/C Volume</div>
              </div>
              <div className="h-20 w-20">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[{ name: 'Calls', value: totalCallVol }, { name: 'Puts', value: totalPutVol }]}
                      cx="50%" cy="50%" innerRadius={25} outerRadius={35}
                      paddingAngle={5} dataKey="value" stroke="none"
                    >
                      <Cell fill={C.call} />
                      <Cell fill={C.put} />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
           </div>
           
           <div className="flex items-center justify-between mt-4 text-[11px] font-mono font-bold">
             <div className="flex items-center gap-2 text-emerald-400">
               <div className="w-2 h-2 rounded-full bg-emerald-400" />
               Call Vol: {(totalCallVol).toLocaleString(undefined, {maximumFractionDigits: 0})}
             </div>
             <div className="flex items-center gap-2 text-rose-400">
               Put Vol: {(totalPutVol).toLocaleString(undefined, {maximumFractionDigits: 0})}
               <div className="w-2 h-2 rounded-full bg-rose-400" />
             </div>
           </div>
        </div>

      </div>
    </div>
  );
}
