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
    
    containerRef.current.innerHTML = '';
    
    const uniqueId = `tv_widget_${Math.random().toString(36).substring(7)}`;
    containerRef.current.id = uniqueId;

    const initWidget = () => {
      if (containerRef.current && window.TradingView) {
        new window.TradingView.widget({
          autosize: true,
          symbol: symbol,
          interval: "5",
          timezone: "Etc/UTC",
          theme: theme,
          style: "1",
          locale: "en",
          enable_publishing: false,
          backgroundColor: theme === 'dark' ? "#1a1a1a" : "transparent",
          gridColor: theme === 'dark' ? "rgba(255, 255, 255, 0.05)" : "rgba(0,0,0,0.03)",
          hide_top_toolbar: true,
          hide_legend: true,
          save_image: false,
          container_id: containerRef.current.id,
          toolbar_bg: "transparent",
          studies: [
            "Volume@tv-basicstudies"
          ]
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

declare global {
  interface Window {
    TradingView: any;
  }
}
