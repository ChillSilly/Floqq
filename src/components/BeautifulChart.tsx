import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries, IChartApi, ISeriesApi, Time } from 'lightweight-charts';

interface ChartDataPoint {
  time: number | Time;
  open: number;
  high: number;
  low: number;
  close: number;
  netGex: number;
  volume?: number;
}

interface BeautifulChartProps {
  data: ChartDataPoint[];
  height?: number;
  isDarkTheme?: boolean;
}

export const BeautifulChart: React.FC<BeautifulChartProps> = ({ 
  data, 
  height = 300, 
  isDarkTheme = false
}) => {
  const isDark = isDarkTheme;
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const lastDataLength = useRef<number>(0);
  const dataRef = useRef<ChartDataPoint[]>([]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
        fontFamily: 'JetBrains Mono, monospace',
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
        vertLines: { visible: false },
        horzLines: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)' },
      },
      timeScale: {
        borderColor: 'transparent',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: 'transparent',
        autoScale: true,
      },
      crosshair: {
        vertLine: {
          color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
          labelBackgroundColor: isDark ? '#1e293b' : '#000000',
        },
        horzLine: {
          color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
          labelBackgroundColor: isDark ? '#1e293b' : '#000000',
        },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries as any;

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

      const csData = param.seriesData.get(candleSeries) as any;
      if (!csData) return;

      const price = csData.close !== undefined ? csData.close : csData.value;
      
      const timeMatch = param.time;
      const dataPoint = dataRef.current.find(d => (d.time as any) === timeMatch);
      const gex = dataPoint ? dataPoint.netGex : 0;
      const volume = dataPoint?.volume || 0;
      const volStr = volume >= 1000000 ? (volume / 1000000).toFixed(1) + 'M' : (volume / 1000).toFixed(0) + 'K';
      
      const intensityColor = gex >= 0 ? '#10b981' : '#ef4444';

      tooltipRef.current.style.display = 'block';
      tooltipRef.current.style.backgroundColor = isDark ? 'rgba(8, 12, 23, 0.9)' : 'rgba(255, 255, 255, 0.9)';
      tooltipRef.current.style.color = isDark ? '#f8fafc' : '#0f172a';
      tooltipRef.current.style.border = 'none';
      tooltipRef.current.style.backdropFilter = 'blur(12px)';
      (tooltipRef.current.style as any).webkitBackdropFilter = 'blur(12px)';
      let leftPos = param.point.x + 15;
      if (leftPos + 200 > chartContainerRef.current.clientWidth) {
        leftPos = param.point.x - 215;
      }
      
      tooltipRef.current.style.left = leftPos + 'px';
      tooltipRef.current.style.top = param.point.y + 15 + 'px';
      
      const dateStr = new Date((param.time as number) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      tooltipRef.current.innerHTML = `
        <div style="font-size: 10px; color: ${isDark ? '#94a3b8' : '#888'}; font-weight: 700; margin-bottom: 8px; font-family: 'JetBrains Mono', monospace;">${dateStr}</div>
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; justify-content: space-between; gap: 20px;">
            <span style="color: ${isDark ? '#64748b' : '#666'}; font-size: 10px; font-weight: 700;">PX</span>
            <span style="font-weight: 700; font-family: 'JetBrains Mono', monospace; color: ${isDark ? '#f1f5f9' : '#000'}; font-size: 12px;">$${price.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 20px;">
            <span style="color: ${isDark ? '#64748b' : '#666'}; font-size: 10px; font-weight: 700;">VOL</span>
            <span style="font-weight: 700; font-family: 'JetBrains Mono', monospace; color: ${isDark ? '#f1f5f9' : '#000'}; font-size: 12px;">${volStr}</span>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 20px;">
            <span style="color: ${isDark ? '#64748b' : '#666'}; font-size: 10px; font-weight: 700;">GEX</span>
            <span style="font-weight: 700; font-family: 'JetBrains Mono', monospace; color: ${intensityColor}; font-size: 12px;">${gex >= 0 ? '+' : ''}${gex.toFixed(3)}</span>
          </div>
        </div>
      `;
    });

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    dataRef.current = data;
    if (!seriesDataValid(data)) return;
    
    if (candleSeriesRef.current && chartRef.current) {
      const candles = data.map(d => ({
        time: d.time as any,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));

      candleSeriesRef.current.setData(candles);

      if (lastDataLength.current === 0) {
         chartRef.current.timeScale().fitContent();
      }
      
      lastDataLength.current = data.length;
    }
  }, [data]);

  const seriesDataValid = (d: any[]) => {
    return d && d.length > 0 && d[0].open !== undefined;
  };

  return (
    <div className="w-full h-full relative" style={{ height: `${height}px` }}>
      <div ref={chartContainerRef} className="w-full h-full" />
      <div 
        ref={tooltipRef} 
        className="absolute z-50 pointer-events-none hidden bg-card-primary/90 backdrop-blur-md rounded p-3 shadow-xl"
        style={{ minWidth: '120px' }}
      />
    </div>
  );
};
