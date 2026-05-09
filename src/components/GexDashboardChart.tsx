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

export const GexDashboardChart: React.FC<GexDashboardChartProps> = ({ activeTicker, data: propData }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const gexSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  const [activeTimeframe, setActiveTimeframe] = useState('15m');
  const [useCandles, setUseCandles] = useState(true);
  const [processedData, setProcessedData] = useState<any[]>([]);
  const processedDataRef = useRef<any[]>([]);

  const lastDataPointRef = useRef<{ ohlc: any, gex: any, vol: number } | null>(null);

  const callWallLineRef = useRef<any>(null);
  const putWallLineRef = useRef<any>(null);
  const spotLineRef = useRef<any>(null);

  const dataLengthRef = useRef<number>(0);

  const getGexColor = (val: number) => {
    const abs = Math.abs(val);
    // Subtle intensity gradient: lower base alpha, gentler scaling
    const alpha = Math.min(0.1 + (abs / 5.0) * 0.4, 0.6);
    return val >= 0 
      ? `rgba(16, 185, 129, ${alpha})` // emerald-500
      : `rgba(239, 68, 68, ${alpha})`; // rose-500
  };

  // Sync propData if it has candles
  useEffect(() => {
    if (propData && propData.length > 0 && propData[0].open !== undefined && 
        seriesRef.current && chartRef.current) {
        const candles = propData.map(d => ({
            time: d.time as any,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
            volume: d.volume || 0,
            netGex: d.netGex || 0
        }));
        
        setProcessedData(candles);
        processedDataRef.current = candles;
        
        // Instead of .update, use .setData which avoids errors when datasets swap
        seriesRef.current.setData(candles);
        
        // Only fit content on the first load so users can zoom/pan freely
        if (dataLengthRef.current === 0) {
            chartRef.current.timeScale().fitContent();
        }

        dataLengthRef.current = propData.length;
        
        const last = propData[propData.length - 1];
        lastDataPointRef.current = { 
            ohlc: { time: last.time, open: last.open, high: last.high, low: last.low, close: last.close },
            gex: { time: last.time, value: last.netGex, color: getGexColor(last.netGex) },
            vol: last.volume || 0
        };
    }
  }, [propData]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#1a1a1a',
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
        vertLines: { color: 'rgba(0, 0, 0, 0.02)' },
        horzLines: { color: 'rgba(0, 0, 0, 0.02)' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: 'rgba(0, 0, 0, 0.05)',
      },
      rightPriceScale: {
        borderColor: 'rgba(0, 0, 0, 0.05)',
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: 'rgba(0, 0, 0, 0.1)',
          width: 1,
          style: 3,
        },
        horzLine: {
          color: 'rgba(0, 0, 0, 0.1)',
          width: 1,
          style: 3,
        },
      },
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

    // Crosshair Tooltip logic
    chart.subscribeCrosshairMove((param) => {
      if (!tooltipRef.current || !chartContainerRef.current) return;
      
      const isOutOfBounds = 
        !param.point || 
        !param.time || 
        param.point.x < 0 || 
        param.point.x > chartContainerRef.current.clientWidth || 
        param.point.y < 0 || 
        param.point.y > chartContainerRef.current.clientHeight;

      if (isOutOfBounds) {
        tooltipRef.current.style.display = 'none';
        return;
      }

      const csData = param.seriesData.get(candlestickSeries) as any;
      if (!csData) return;

      const price = csData.close !== undefined ? csData.close : csData.value;
      
      // Access GEX and Volume from the current data point
      const timeMatch = param.time;
      const dataPoint = processedDataRef.current.find(d => (d.time as any) === timeMatch);
      const gex = dataPoint ? dataPoint.netGex : 0;
      const volume = dataPoint ? dataPoint.volume : 0;
      const volStr = volume >= 1000000 ? (volume / 1000000).toFixed(2) + 'M' : (volume / 1000).toFixed(1) + 'K';

      // Exposure Intensity Calculation
      const intensityLabel = gex > 2.0 ? 'ULTRA' : gex > 1.0 ? 'CRITICAL CALL' : gex > 0.4 ? 'BULLISH' : gex < -2.0 ? 'MAJOR SHORT' : gex < -1.0 ? 'CRITICAL PUT' : gex < -0.4 ? 'BEARISH' : 'NEUTRAL';
      const intensityColor = gex >= 0 ? '#10b981' : '#ef4444';

      tooltipRef.current.style.display = 'flex';
      tooltipRef.current.style.flexDirection = 'column';
      tooltipRef.current.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
      tooltipRef.current.style.backdropFilter = 'blur(16px)';
      (tooltipRef.current.style as any).webkitBackdropFilter = 'blur(16px)';
      
      // Prevent tooltip from overflowing the right edge
      const tooltipWidth = 240;
      let leftPos = param.point.x + 20;
      if (leftPos + tooltipWidth > chartContainerRef.current.clientWidth) {
        leftPos = param.point.x - tooltipWidth - 20;
      }
      
      tooltipRef.current.style.left = leftPos + 'px';
      tooltipRef.current.style.top = param.point.y + 20 + 'px';
      
      const dateStr = new Date((param.time as number) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      tooltipRef.current.innerHTML = `
        <div style="font-size: 9px; color: rgba(0,0,0,0.4); font-weight: 800; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.25em; font-family: 'JetBrains Mono', monospace; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0,0,0,0.06); padding-bottom: 10px;">
          <span style="display: flex; align-items: center; gap: 4px;"><div style="width: 6px; height: 6px; border-radius: 50%; background: #000;"></div> INTEL RELAY</span>
          <span>${dateStr}</span>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <span style="color: #666; font-size: 10px; font-weight: 700; letter-spacing: 0.05em; font-family: 'Inter', sans-serif;">SPOT PRICE</span>
            <span style="font-weight: 800; font-family: 'JetBrains Mono', monospace; color: #000; font-size: 16px;">$${price.toFixed(2)}</span>
          </div>
          
          <div style="padding: 12px; background: ${gex >= 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)'}; border: 1px solid ${gex >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.02);">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;">
               <span style="color: ${intensityColor}; font-size: 10px; font-weight: 800; letter-spacing: 0.05em; font-family: 'Inter', sans-serif;">NET GAMMA (GEX)</span>
               <span style="font-weight: 800; font-family: 'JetBrains Mono', monospace; color: ${intensityColor}; font-size: 16px;">${gex >= 0 ? '+' : ''}${gex.toFixed(4)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
               <span style="color: #666; font-size: 8px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.1em;">TRADE VOLUME</span>
               <span style="font-weight: 700; font-family: 'JetBrains Mono', monospace; color: #171717; font-size: 11px;">${volStr}</span>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 4px;">
               <div style="display: flex; justify-content: space-between; align-items: center;">
                 <span style="color: #666; font-size: 8px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.1em;">INTENSITY</span>
                 <span style="color: ${intensityColor}; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em;">${intensityLabel}</span>
               </div>
               <div style="height: 4px; background: rgba(0,0,0,0.05); border-radius: 2px; overflow: hidden; position: relative;">
                 <div style="height: 100%; width: ${Math.min(Math.abs(gex) * 25, 100)}%; background: ${intensityColor}; transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1); border-radius: 2px;"></div>
               </div>
            </div>
          </div>
        </div>
      `;
    });

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !chartRef.current) return;
      const { width, height } = entries[0].contentRect;
      chartRef.current.applyOptions({ width, height });
    });
    
    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
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

        const res = await fetch(`/api/v1/chart-data/${activeTicker}?interval=${activeTimeframe}&range=${range}`);
        
        if (!res.ok) {
          throw new Error(`API returned status ${res.status}`);
        }

        const text = await res.text();
        let json;
        try {
          if (text.trim().startsWith('<!')) {
             console.error(`Received HTML instead of JSON from chart backend. Length: ${text.length}. Content: ${text.substring(0, 100)}`);
             throw new Error('Received HTML instead of JSON from intelligence relay');
          }
          json = JSON.parse(text);
        } catch (e) {
          console.error(`GEX Chart Fetch: Failed to parse JSON. Staus: ${res.status}. Sample: ${text.substring(0, 100)}`);
          throw new Error('Invalid JSON response from intelligence relay');
        }
        
        if (!isMounted || !json.chart || !json.chart.result) return;
        
        const result = json.chart.result[0];
        const timestamps = result.timestamp;
        const quote = result.indicators.quote[0];
        
        if (!timestamps || !quote.close) return;

        const processedOhlc: any[] = [];
        
        let lastTime = 0;
        
        for (let i = 0; i < timestamps.length; i++) {
          const time = timestamps[i] as Time;
          if ((time as any) <= lastTime || quote.close[i] === null || quote.open[i] === null) continue;
          lastTime = time as number;
          
          const open = quote.open[i];
          const high = quote.high[i];
          const low = quote.low[i];
          const close = quote.close[i];
          const volume = quote.volume ? quote.volume[i] : 0;

          // ADVANCED PSEUDO-GEX MODEL:
          const volatility = Math.abs(close - open) / (open || 1);
          const direction = close >= open ? 1 : -1;
          const baseGex = (i % 5 === 0 ? 1.4 : 0.9);
          const noise = (Math.sin(i * 0.5) * 0.2) + (Math.random() - 0.5) * 0.1;
          const pseudoGex = direction * (volatility * 1000 * baseGex) + noise;

          processedOhlc.push({ 
            time, 
            open, 
            high, 
            low, 
            close, 
            volume,
            netGex: pseudoGex 
          });
        }

        if (processedOhlc.length > 0) {
          setProcessedData(processedOhlc);
          processedDataRef.current = processedOhlc;
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
          if (chartRef.current) chartRef.current.timeScale().fitContent();

          lastDataPointRef.current = {
            ohlc: processedOhlc[processedOhlc.length - 1],
            gex: { value: processedOhlc[processedOhlc.length - 1].netGex },
            vol: processedOhlc[processedOhlc.length - 1].volume
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
    if (propData && propData.length > 0) return; // Disable if high-fidelity prop data is available

    const intervalId = setInterval(() => {
      if (!lastDataPointRef.current || !seriesRef.current) return;
      
      const lastCandle = { ...lastDataPointRef.current.ohlc };
      const lastGex = { ...lastDataPointRef.current.gex };
      const lastVol = lastDataPointRef.current.vol;

      // Simulate minor price fluctuation
      const change = lastCandle.close * (Math.random() - 0.5) * 0.0003;
      const prevClose = lastCandle.close;
      lastCandle.close = lastCandle.close + change;
      lastCandle.high = Math.max(lastCandle.high, lastCandle.close);
      lastCandle.low = Math.min(lastCandle.low, lastCandle.close);

      // Simulate GEX fluctuation (tied to price direction)
      const direction = lastCandle.close >= prevClose ? 1 : -1;
      const gexFluctuation = direction * (Math.abs(change) / (prevClose || 1)) * 2000 + (Math.random() - 0.5) * 0.2;
      lastGex.value = (lastGex.value || 0) + gexFluctuation;
      
      // Clamp GEX to reasonable bounds for simulation stability
      lastGex.value = Math.max(-5, Math.min(5, lastGex.value));

      // Simulate Volume
      const newVol = Math.max(0, lastVol + (Math.random() - 0.5) * 1000);

      lastDataPointRef.current = { ohlc: lastCandle, gex: lastGex, vol: newVol };

      try {
        const updatePoint = { ...lastCandle, netGex: lastGex.value, volume: newVol };
        seriesRef.current.update(updatePoint);
        
        // Update the local processedData for the tooltip
        setProcessedData(prev => {
          const newData = [...prev];
          if (newData.length > 0) {
            newData[newData.length - 1] = updatePoint;
          }
          processedDataRef.current = newData;
          return newData;
        });
      } catch (e) {
        console.warn('Simulation update failed', e);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, []);

  const TimeframeBtn = ({ label }: { label: string }) => (
    <button 
      onClick={() => setActiveTimeframe(label)}
      className={`px-2 py-1 text-[10px] font-mono transition-all border-black/10 last:border-r-0 ${activeTimeframe === label ? 'bg-black text-white font-bold' : 'bg-transparent text-black/50 hover:bg-black/5'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="w-full h-full flex flex-col bg-white relative z-10 overflow-hidden" style={{ borderRadius: '2px' }}>
      {/* Top Bar Navigation */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="text-black/80 font-mono text-xs font-bold tracking-wider py-1 px-2 rounded-sm">
            {activeTicker} <span className="text-black/30 mx-1">|</span> {activeTimeframe}
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-mono text-black/40 uppercase tracking-[0.2em]">Live Stream</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white rounded-sm overflow-hidden">
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
          className="absolute z-50 pointer-events-none hidden bg-white/70 backdrop-blur-lg rounded-[4px] shadow-2xl"
          style={{ padding: '12px 16px', minWidth: '180px' }}
        />
      </div>
    </div>
  );
};



