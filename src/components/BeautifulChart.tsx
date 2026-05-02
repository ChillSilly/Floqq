import React, { useMemo } from 'react';
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';

interface ChartDataPoint {
  time: number | string;
  price: number;
  netGex: number;
}

interface BeautifulChartProps {
  data: ChartDataPoint[];
  height?: number;
  lineColor: string;
  secondaryLineColor: string;
  areaColor: string;
  positiveGexColor?: string;
  negativeGexColor?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    let timeStr = label;
    if (typeof label === 'number') {
       timeStr = new Date(label * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    
    const priceP = payload.find((p: any) => p.dataKey === 'price');
    const gexP = payload.find((p: any) => p.dataKey === 'netGex');

    return (
      <div className="p-4 bg-black/80 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl">
        <p className="text-[10px] text-white/50 uppercase tracking-[0.2em] mb-4 font-bold">{timeStr}</p>
        <div className="flex flex-col gap-3">
          {priceP && (
            <div className="flex items-center justify-between gap-6">
              <span className="text-[10px] uppercase font-bold text-white/60 tracking-wider">SPOT</span>
              <span className="font-mono text-base font-bold" style={{ color: priceP.color }}>
                ${Number(priceP.value).toFixed(2)}
              </span>
            </div>
          )}
          {gexP && (
            <div className="flex items-center justify-between gap-6">
              <span className="text-[10px] uppercase font-bold text-white/60 tracking-wider">NET GEX</span>
              <span className="font-mono text-base font-bold" style={{ color: gexP.value >= 0 ? '#00E5A0' : '#fb7185' }}>
                ${Number(gexP.value).toFixed(2)}B
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export const BeautifulChart: React.FC<BeautifulChartProps> = ({ 
  data, 
  height = 300, 
  lineColor, 
  secondaryLineColor,
  areaColor,
  positiveGexColor = '#00E5A0',
  negativeGexColor = '#fb7185'
}) => {
  const chartData = useMemo(() => {
    return data.map(d => ({
      ...d,
      timeVal: d.time
    }));
  }, [data]);

  const yDomainPrice = useMemo(() => {
      if (!chartData.length) return ['auto', 'auto'];
      const prices = chartData.map(d => d.price);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const padding = (max - min) * 0.1 || 1;
      return [min - padding, max + padding];
  }, [chartData]);
  
  const yDomainGex = useMemo(() => {
      if (!chartData.length) return ['auto', 'auto'];
      const gexs = chartData.map(d => d.netGex);
      const min = Math.min(...gexs);
      const max = Math.max(...gexs);
      const padding = Math.max(Math.abs(max), Math.abs(min)) * 0.1 || 1;
      return [min - padding, max + padding];
  }, [chartData]);

  const gradientOffset = useMemo(() => {
    if (!chartData.length) return 0;
    const gexs = chartData.map(d => d.netGex);
    const min = Math.min(...gexs);
    const max = Math.max(...gexs);
    if (min >= 0) return 1;
    if (max <= 0) return 0;
    return max / (max - min);
  }, [chartData]);

  return (
    <div className="w-full relative group" style={{ height: `${height}px` }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={areaColor} stopOpacity={0.15}/>
              <stop offset="95%" stopColor={areaColor} stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="splitColorGex" x1="0" y1="0" x2="0" y2="1">
              <stop offset={gradientOffset} stopColor={positiveGexColor} stopOpacity={0.8} />
              <stop offset={gradientOffset} stopColor={negativeGexColor} stopOpacity={0.8} />
            </linearGradient>
            <linearGradient id="splitColorGexArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset={gradientOffset} stopColor={positiveGexColor} stopOpacity={0.2} />
              <stop offset={gradientOffset} stopColor={negativeGexColor} stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="timeVal" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'monospace' }}
            tickFormatter={(val) => {
               if (typeof val === 'number') {
                  return new Date(val * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
               }
               return String(val);
            }}
            minTickGap={40}
            dy={10}
          />
          <YAxis 
            yAxisId="left"
            domain={yDomainPrice}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: 'monospace' }}
            tickFormatter={(val) => `$${val.toFixed(0)}`}
            orientation="left"
            dx={-10}
          />
          <YAxis 
            yAxisId="right"
            domain={yDomainGex}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: 'monospace' }}
            tickFormatter={(val) => `${val > 0 ? '+' : ''}${val.toFixed(2)}B`}
            orientation="right"
            dx={10}
          />
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={true} horizontal={true} />
          
          <Tooltip 
            content={<CustomTooltip />} 
            cursor={{ stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1, strokeDasharray: '4 4' }} 
            isAnimationActive={true}
          />
          
          <ReferenceLine y={0} yAxisId="right" stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />

          {/* Price Area */}
          <Area 
            yAxisId="left"
            type="monotone" 
            dataKey="price" 
            stroke={lineColor} 
            strokeWidth={1.5}
            fillOpacity={1} 
            fill="url(#colorPrice)" 
            isAnimationActive={false}
            activeDot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
          />

          {/* Net GEX Line/Area */}
          <Area 
            yAxisId="right"
            type="monotone" 
            dataKey="netGex" 
            stroke="url(#splitColorGex)"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#splitColorGexArea)"
            isAnimationActive={false}
            activeDot={{ r: 4, fill: "url(#splitColorGex)", strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
