import React, { useEffect, useRef, useState } from 'react';
import { 
  createChart, 
  ColorType, 
  CandlestickSeries, 
  IChartApi, 
  ISeriesApi, 
  Time,
  PriceLineOptions
} from 'lightweight-charts';
import { RefreshCcw, Settings, ListFilter, AlertCircle } from 'lucide-react';

interface MenthorQLevelsChartProps {
  ticker: string;
}

export const MenthorQLevelsChart: React.FC<MenthorQLevelsChartProps> = ({ ticker }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#101014' }, // Quantower/MotiveWave dark background
        textColor: '#8e8e93',
        fontFamily: 'Inter, sans-serif',
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      crosshair: {
        mode: 1,
        vertLine: { color: 'rgba(255, 255, 255, 0.2)', width: 1, style: 3 },
        horzLine: { color: 'rgba(255, 255, 255, 0.2)', width: 1, style: 3 },
      },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981', // green
      downColor: '#ef4444', // red
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    seriesRef.current = candlestickSeries as any;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  const loadData = async () => {
    if (!seriesRef.current || !chartRef.current) return;
    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch OHLC Data
      const ohlcRes = await fetch(`/api/yahoo/chart/${ticker}?interval=5m&range=5d`);
      if (!ohlcRes.ok) throw new Error('Failed to fetch chart data');
      const ohlcJson = await ohlcRes.json();
      
      const result = ohlcJson.chart.result[0];
      const timestamps = result.timestamp;
      const quote = result.indicators.quote[0];
      
      const chartData: any[] = [];
      let lastTime = 0;
      
      for (let i = 0; i < timestamps.length; i++) {
        const time = timestamps[i] as Time;
        if ((time as any) <= lastTime || quote.close[i] === null || quote.open[i] === null) continue;
        lastTime = time as number;
        
        chartData.push({ 
          time, 
          open: quote.open[i], 
          high: quote.high[i], 
          low: quote.low[i], 
          close: quote.close[i]
        });
      }

      seriesRef.current.setData(chartData);
      chartRef.current.timeScale().fitContent();

      // 2. Fetch MenthorQ Levels
      const levelsRes = await fetch(`/api/menthorq/levels/${ticker}`);
      if (!levelsRes.ok) throw new Error('Failed to fetch MenthorQ levels');
      const levelsData = await levelsRes.json();

      // Clear existing lines
      priceLinesRef.current.forEach(line => {
         seriesRef.current?.removePriceLine(line);
      });
      priceLinesRef.current = [];

      // Add new MenthorQ lines mimicking MotiveWave UI
      levelsData.levels.forEach((level: any) => {
         const plOptions: PriceLineOptions = {
            price: level.price,
            color: level.color,
            lineWidth: 2,
            lineStyle: 0, // Solid line
            axisLabelVisible: true,
            title: level.name,
            axisLabelColor: level.color,
            axisLabelTextColor: '#ffffff',
            lineVisible: true,
         };
         const pl = seriesRef.current?.createPriceLine(plOptions);
         priceLinesRef.current.push(pl);
      });

      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [ticker]);

  return (
    <div className="w-full h-full flex flex-col bg-[#101014] rounded-lg overflow-hidden shadow-2xl relative">
      {/* Top Bar - Quantower Style */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#18181c]">
         <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
               <span className="text-white font-mono text-sm font-bold tracking-wide">{ticker} 5m</span>
               <div className="h-4 w-px bg-white/10 mx-1"></div>
               <span className="text-emerald-400 font-mono text-xs animate-pulse flex items-center gap-1">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> Connected
               </span>
            </div>
            
            <div className="flex items-center gap-2 pl-4">
               <button className="flex items-center gap-1.5 px-2 py-1 hover:bg-white/5 rounded text-white/60 hover:text-white transition-colors text-xs font-medium">
                  <ListFilter size={14} /> Levels
               </button>
               <button className="flex items-center gap-1.5 px-2 py-1 hover:bg-white/5 rounded text-white/60 hover:text-white transition-colors text-xs font-medium">
                  <Settings size={14} /> Props
               </button>
            </div>
         </div>

         <div className="flex items-center gap-4">
            {lastUpdated && (
               <div className="text-white/40 text-[10px] font-mono whitespace-nowrap hidden sm:block">
                  Last updated: {lastUpdated.toLocaleTimeString([], { hour12: false })}
               </div>
            )}
            <button 
               onClick={loadData}
               disabled={isLoading}
               className={`p-1.5 rounded text-white/50 hover:text-white hover:bg-white/5 transition-all ${isLoading ? 'animate-spin' : ''}`}
            >
               <RefreshCcw size={14} />
            </button>
         </div>
      </div>

      {/* Chart Container */}
      <div className="flex-1 w-full relative">
         {isLoading && chartDataEmpty() && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#101014]/80 z-10 backdrop-blur-sm">
               <div className="flex flex-col items-center gap-4">
                  <RefreshCcw className="animate-spin text-white/20" size={32} />
                  <span className="text-white/40 font-mono text-xs uppercase tracking-widest">Loading Market Data...</span>
               </div>
            </div>
         )}
         
         {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-rose-500/10 text-rose-400 px-4 py-2 rounded-md z-20 shadow-xl">
               <AlertCircle size={16} />
               <span className="text-xs font-medium">{error}</span>
            </div>
         )}

         <div ref={chartContainerRef} className="absolute inset-0" />
      </div>
      
      {/* Footer Branding */}
      <div className="absolute bottom-4 left-4 z-10 select-none pointer-events-none">
         <div className="text-white/20 font-bold tracking-widest text-sm" style={{ fontFamily: "'Helvetica Neue', system-ui, sans-serif" }}>
            MenthorQ Integration
         </div>
      </div>
    </div>
  );

  function chartDataEmpty() {
     return priceLinesRef.current.length === 0;
  }
};
