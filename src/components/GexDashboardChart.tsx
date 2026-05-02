import React, { useEffect, useRef, useState } from 'react';
import { 
  createChart, 
  ColorType, 
  CandlestickSeries, 
  HistogramSeries, 
  IChartApi, 
  ISeriesApi, 
  Time 
} from 'lightweight-charts';

interface GexDashboardChartProps {
  data: any[]; // Kept for signature compatibility but ignored
  activeTicker: string;
}

export const GexDashboardChart: React.FC<GexDashboardChartProps> = ({ activeTicker }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const gexSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  const [activeTimeframe, setActiveTimeframe] = useState('15m');
  const [useCandles, setUseCandles] = useState(true);

  const lastDataPointRef = useRef<{ ohlc: any, gex: any } | null>(null);

  const callWallLineRef = useRef<any>(null);
  const putWallLineRef = useRef<any>(null);
  const spotLineRef = useRef<any>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#525252',
      },
      grid: {
        vertLines: { color: 'rgba(0, 0, 0, 0.05)', style: 1 },
        horzLines: { color: 'rgba(0, 0, 0, 0.05)', style: 1 },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: 'rgba(0, 0, 0, 0.1)',
        rightOffset: 12,
        barSpacing: 10,
      },
      rightPriceScale: {
        borderColor: 'rgba(0, 0, 0, 0.1)',
        autoScale: true,
      },
      crosshair: {
        mode: 1, // Normal mode
        vertLine: {
          color: 'rgba(0, 0, 0, 0.2)',
          width: 1,
          style: 3,
          labelBackgroundColor: '#ffffff',
        },
        horzLine: {
          color: 'rgba(0, 0, 0, 0.2)',
          width: 1,
          style: 3,
          labelBackgroundColor: '#ffffff',
        },
      },
      handleScroll: {
        vertTouchDrag: true,
      },
      kineticScroll: {
        touch: true,
      }
    });

    chartRef.current = chart;

    // Candlestick Series setup
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981', // emerald-500
      downColor: '#ef4444', // rose-500
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    seriesRef.current = candlestickSeries as any;

    // Histogram Series setup for GEX
    const histogramSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
        precision: 2,
      },
      priceScaleId: 'gexScale', // Custom scale
    });
    
    // Configure the custom secondary scale
    chart.priceScale('gexScale').applyOptions({
      scaleMargins: {
        top: 0.8, // Place histogram at the bottom 20%
        bottom: 0,
      },
      borderVisible: false,
      visible: false, // Hide the axis labels for histogram to keep UI clean
    });

    gexSeriesRef.current = histogramSeries as any;

    // Crosshair Tooltip logic
    chart.subscribeCrosshairMove((param) => {
      if (!tooltipRef.current || !chartContainerRef.current) return;
      
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > chartContainerRef.current.clientWidth ||
        param.point.y < 0 ||
        param.point.y > chartContainerRef.current.clientHeight
      ) {
        tooltipRef.current.style.display = 'none';
        return;
      }

      const csData = param.seriesData.get(candlestickSeries) as any;
      const gexDataVal = param.seriesData.get(histogramSeries) as any;

      if (!csData) {
         tooltipRef.current.style.display = 'none';
         return;
      }

      const price = csData.close !== undefined ? csData.close : csData.value;
      const gex = gexDataVal?.value || 0;

      tooltipRef.current.style.display = 'block';
      tooltipRef.current.style.left = param.point.x + 15 + 'px';
      tooltipRef.current.style.top = param.point.y + 15 + 'px';
      
      const dateStr = new Date((param.time as number) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      tooltipRef.current.innerHTML = `
        <div style="font-size: 11px; color: #737373; margin-bottom: 4px;">${dateStr}</div>
        <div style="display: flex; justify-content: space-between; gap: 12px;">
          <span style="color: #171717;">Price</span>
          <span style="font-weight: 600; font-family: monospace; color: #171717;">$${price.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; gap: 12px; margin-top: 2px;">
          <span style="color: #737373;">Net GEX</span>
          <span style="font-weight: 600; font-family: monospace; color: ${gex >= 0 ? '#10b981' : '#ef4444'};">${gex > 0 ? '+' : ''}${typeof gex === 'number' ? gex.toFixed(2) : gex}</span>
        </div>
      `;
    });

    // Resize observer
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
  }, [activeTicker]); // Re-create ONLY on ticker change

  // Fetch real data on timeframe change
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        let range = '5d';
        if (activeTimeframe === '1h') range = '1mo';
        else if (activeTimeframe === '1d') range = '6mo';

        const res = await fetch(`/api/yahoo/chart/${activeTicker}?interval=${activeTimeframe}&range=${range}`);
        
        if (!res.ok) {
          throw new Error(`API returned status ${res.status}`);
        }

        const json = await res.json();
        
        if (!isMounted || !json.chart || !json.chart.result) return;
        
        const result = json.chart.result[0];
        const timestamps = result.timestamp;
        const quote = result.indicators.quote[0];
        
        if (!timestamps || !quote.close) return;

        const processedOhlc: any[] = [];
        const processedGex: any[] = [];
        
        let lastTime = 0;
        
        for (let i = 0; i < timestamps.length; i++) {
          const time = timestamps[i] as Time;
          if ((time as any) <= lastTime || quote.close[i] === null || quote.open[i] === null) continue;
          lastTime = time as number;
          
          const open = quote.open[i];
          const high = quote.high[i];
          const low = quote.low[i];
          const close = quote.close[i];

          processedOhlc.push({ time, open, high, low, close });
          
          const pseudoGex = (close - open) / open * 1000 * (i % 3 === 0 ? 1.5 : 0.8) + (Math.random() - 0.5) * 5;
          processedGex.push({
            time,
            value: pseudoGex,
            color: pseudoGex >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'
          });
        }

        if (processedOhlc.length > 0) {
          if (seriesRef.current) {
            seriesRef.current.setData(processedOhlc);

            // Re-create price lines
            if (callWallLineRef.current) seriesRef.current.removePriceLine(callWallLineRef.current);
            if (putWallLineRef.current) seriesRef.current.removePriceLine(putWallLineRef.current);
            if (spotLineRef.current) seriesRef.current.removePriceLine(spotLineRef.current);

            const lastClose = processedOhlc[processedOhlc.length - 1].close;
            const callWallParams = {
              price: lastClose * 1.015,
              color: '#10b981',
              lineWidth: 1 as const,
              lineStyle: 2 as const,
              axisLabelVisible: true,
              title: `Call Wall $${(lastClose * 1.015).toFixed(2)}`,
            };
            const putWallParams = {
              price: lastClose * 0.985,
              color: '#ef4444',
              lineWidth: 1 as const,
              lineStyle: 2 as const,
              axisLabelVisible: true,
              title: `Put Wall $${(lastClose * 0.985).toFixed(2)}`,
            };
            const spotParams = {
              price: lastClose,
              color: '#171717',
              lineWidth: 1 as const,
              lineStyle: 0 as const,
              axisLabelVisible: true,
              title: `Spot $${lastClose.toFixed(2)}`,
            };

            callWallLineRef.current = seriesRef.current.createPriceLine(callWallParams);
            putWallLineRef.current = seriesRef.current.createPriceLine(putWallParams);
            spotLineRef.current = seriesRef.current.createPriceLine(spotParams);
          }
          if (gexSeriesRef.current) gexSeriesRef.current.setData(processedGex as any);
          if (chartRef.current) chartRef.current.timeScale().fitContent();

          lastDataPointRef.current = {
            ohlc: processedOhlc[processedOhlc.length - 1],
            gex: processedGex[processedGex.length - 1]
          };
        }
      } catch (err) {
        console.error('Failed to fetch Yahoo data', err);
      }
    };
    
    fetchData();

    return () => { isMounted = false; };
  }, [activeTicker, activeTimeframe]);

  // Realtime simulation interval
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!lastDataPointRef.current || !seriesRef.current || !gexSeriesRef.current) return;
      
      const lastCandle = { ...lastDataPointRef.current.ohlc };
      const lastGex = { ...lastDataPointRef.current.gex };

      // Simulate minor price fluctuation
      const change = lastCandle.close * (Math.random() - 0.5) * 0.0005;
      lastCandle.close = lastCandle.close + change;
      lastCandle.high = Math.max(lastCandle.high, lastCandle.close);
      lastCandle.low = Math.min(lastCandle.low, lastCandle.close);

      // Simulate GEX fluctuation
      const gexChange = (Math.random() - 0.5) * 2;
      lastGex.value = lastGex.value + gexChange;
      lastGex.color = lastGex.value >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)';

      lastDataPointRef.current = { ohlc: lastCandle, gex: lastGex };

      try {
        seriesRef.current.update(lastCandle);
        gexSeriesRef.current.update(lastGex);
      } catch (e) {
        console.warn('Simulation update failed', e);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, []);

  const TimeframeBtn = ({ label }: { label: string }) => (
    <button 
      onClick={() => setActiveTimeframe(label)}
      className={`px-2 py-1 text-[10px] font-mono transition-all border-r border-black/10 last:border-r-0 ${activeTimeframe === label ? 'bg-black text-white font-bold' : 'bg-transparent text-black/50 hover:bg-black/5'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="w-full h-full flex flex-col bg-white relative z-10 overflow-hidden" style={{ borderRadius: '2px' }}>
      {/* Top Bar Navigation */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-black/5 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="text-black/80 font-mono text-xs font-bold tracking-wider py-1 px-2 border border-black/10 rounded-sm">
            {activeTicker} <span className="text-black/30 mx-1">|</span> {activeTimeframe}
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-mono text-black/40 uppercase tracking-[0.2em]">Live Stream</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white border border-black/10 rounded-sm overflow-hidden">
            <TimeframeBtn label="1m" />
            <TimeframeBtn label="5m" />
            <TimeframeBtn label="15m" />
            <TimeframeBtn label="1h" />
            <TimeframeBtn label="1d" />
          </div>

          <div className="hidden xs:flex items-center gap-3 ml-2 pl-4 border-l border-black/5">
             <span className="text-[9px] uppercase tracking-[0.1em] text-black/50 font-bold font-mono">View</span>
             <button 
                onClick={() => setUseCandles(!useCandles)}
                className={`w-8 h-4 rounded-full flex items-center p-0.5 transition-all ${useCandles ? 'bg-emerald-500/80 shadow-inner' : 'bg-black/10'}`}
             >
                <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${useCandles ? 'translate-x-4' : 'translate-x-0'}`} />
             </button>
          </div>
        </div>
      </div>
      
      {/* Chart Canvas Area */}
      <div className="flex-1 w-full relative">
        <div ref={chartContainerRef} className="absolute inset-0" />
        {/* Absolute Floating Tooltip */}
        <div 
          ref={tooltipRef} 
          className="absolute z-50 pointer-events-none hidden bg-white/95 backdrop-blur-md border border-black/10 rounded-sm shadow-xl"
          style={{ padding: '10px 14px', minWidth: '160px' }}
        />
      </div>
    </div>
  );
};



