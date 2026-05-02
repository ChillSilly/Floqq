import React, { useEffect, useRef } from 'react';

interface TradingViewWidgetProps {
  symbol?: string;
  theme?: 'light' | 'dark';
  height?: number | string;
}

export function TradingViewWidget({ symbol = 'NASDAQ:QQQ', theme = 'dark', height = '100%' }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Clear the container first in case it re-renders
    containerRef.current.innerHTML = '';
    
    // Use a unique ID so we can have multiple widgets if needed
    const uniqueId = `tv_widget_${Math.random().toString(36).substring(7)}`;
    containerRef.current.id = uniqueId;

    const initWidget = () => {
      if (containerRef.current && window.TradingView) {
        new window.TradingView.widget({
          autosize: true,
          symbol: symbol,
          interval: "15",
          timezone: "Etc/UTC",
          theme: theme,
          style: "1", // 1 = Candle, 2 = Line, 3 = Area
          locale: "en",
          enable_publishing: false,
          backgroundColor: theme === 'dark' ? "transparent" : "#ffffff",
          gridColor: theme === 'dark' ? "rgba(255, 255, 255, 0.05)" : "rgba(0,0,0,0.05)",
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          container_id: containerRef.current.id,
        });
      }
    };

    if (!window.TradingView) {
      if (!document.getElementById('tv-script-global')) {
        const script = document.createElement('script');
        script.id = 'tv-script-global';
        script.src = 'https://s3.tradingview.com/tv.js';
        script.type = 'text/javascript';
        script.async = true;
        script.onload = initWidget;
        document.head.appendChild(script);
      } else {
        document.getElementById('tv-script-global')?.addEventListener('load', initWidget);
      }
    } else {
      initWidget();
    }
    
    return () => {
      // Just clean the container contents on unmount
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, theme]);

  return (
    <div className='tradingview-widget-container' style={{ height: height, width: "100%" }}>
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}

// Add type definition for window.TradingView to avoid TS errors
declare global {
  interface Window {
    TradingView: any;
  }
}
