import React from 'react';
import type { GexResult } from '../lib/gexEngine';
import { ShieldAlert, Zap, TrendingUp, TrendingDown, Target } from 'lucide-react';

const C = {
  call: '#10b981', // emerald
  put: '#ef4444', // rose
};

export function UnusualOptionsActivity({ data }: { data: GexResult | null }) {
  if (!data || !data.uoa || data.uoa.length === 0) return null;

  return (
    <div className="bg-[#0b0f19] rounded-3xl p-8 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.1] transition-all duration-700 pointer-events-none">
        <ShieldAlert size={120} />
      </div>
      
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
          <Zap className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white tracking-widest uppercase">Unusual Options Activity</h2>
          <div className="text-xs font-mono font-bold text-slate-500 tracking-wider">Volume &gt; Open Interest (New Positioning)</div>
        </div>
      </div>

      <div className="overflow-x-auto relative z-10">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="uppercase text-[10px] font-mono tracking-widest text-slate-500">
              <th className="py-3 px-4 font-bold">Contract</th>
              <th className="py-3 px-4 font-bold">DTE</th>
              <th className="py-3 px-4 font-bold">Vol / OI</th>
              <th className="py-3 px-4 font-bold">Vol</th>
              <th className="py-3 px-4 font-bold">OI</th>
              <th className="py-3 px-4 font-bold">Prem Flow</th>
              <th className="py-3 px-4 font-bold">Nature</th>
            </tr>
          </thead>
          <tbody>
            {data.uoa.map((row, i) => {
              const isCall = row.flag === 'C';
              const isITM = isCall ? data.spot > row.strike : data.spot < row.strike;
              const PremiumFlow = row.volume * row.mid * 100;
              return (
                <tr key={`${row.strike}-${row.expiration}-${row.flag}-${i}`} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${isCall ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {row.flag}
                      </div>
                      <div>
                        <div className="text-sm font-mono font-bold text-white">${row.strike}</div>
                        <div className="text-[10px] font-mono text-slate-500">{row.expiration}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className={`text-xs font-mono font-bold ${row.dte <= 7 ? 'text-amber-400' : 'text-slate-300'}`}>
                      {row.dte}d
                    </div>
                    {row.dte <= 7 && <div className="text-[9px] font-mono text-amber-500/70">Short-Term</div>}
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-xs font-mono font-bold text-white">
                      {(row.volume / Math.max(1, row.oi)).toFixed(1)}x
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-xs font-mono font-bold text-white">{row.volume.toLocaleString()}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-xs font-mono font-bold text-slate-400">{row.oi.toLocaleString()}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-xs font-mono font-bold text-white">
                      ${(PremiumFlow / 1000).toFixed(0)}k
                    </div>
                    {isITM ? (
                      <div className="text-[9px] font-mono text-emerald-500/70">ITM (${row.intrinsic.toFixed(2)})</div>
                    ) : (
                      <div className="text-[9px] font-mono text-slate-500/70">OTM</div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                       {isCall ? <TrendingUp size={14} className="text-emerald-400" /> : <TrendingDown size={14} className="text-rose-400" />}
                       <span className={`text-[10px] font-bold tracking-widest uppercase ${isCall ? 'text-emerald-400' : 'text-rose-400'}`}>
                         {isCall ? 'Bullish' : 'Bearish'}
                       </span>
                    </div>
                    {row.volume > 5000 && (
                       <div className="mt-1 inline-flex items-center gap-1 bg-purple-500/20 text-purple-400 text-[8px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded">
                         {row.volume >= 10000 ? 'Block Size' : 'Heavy Flow'}
                       </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
