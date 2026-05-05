import React, { lazy, Suspense } from 'react';

// Using React.lazy instead of Next.js dynamic
const Plot = lazy(() => import('react-plotly.js'));

interface HeatmapProps {
  data: { strike: number; expiration: string; callGEX: number; putGEX: number }[];
  spotPrice: number;
}

export function HeatmapChart({ data, spotPrice }: HeatmapProps) {
  if (!data || !data.length) return null;

  const expiries = Array.from(new Set(data.map(d => d.expiration))).sort();
  const strikes = Array.from(new Set(data.map(d => d.strike))).sort((a, b) => a - b);
  
  const minStrike = spotPrice * 0.95;
  const maxStrike = spotPrice * 1.05;
  const filteredStrikes = strikes.filter(s => s >= minStrike && s <= maxStrike);

  const zMatrix = filteredStrikes.map(strike => {
    return expiries.map(exp => {
      const option = data.find(d => d.strike === strike && d.expiration === exp);
      return option ? (option.callGEX + option.putGEX) : 0;
    });
  });

  const colorscale: any = [
    [0.0, '#f59e0b'],
    [0.2, '#ef4444'],
    [0.5, '#161b22'],
    [0.8, '#10b981'],
    [1.0, '#3b82f6'],
  ];

  return (
    <div style={{ width: '100%', height: 600, borderRadius: 8, overflow: 'hidden', background: '#070b14' }}>
      <Suspense fallback={<div style={{height: 500, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117', borderRadius: 8, color: '#9ca3af'}}>Loading Heatmap...</div>}>
        <Plot
          data={[
            {
              z: zMatrix,
              x: expiries,
              y: filteredStrikes,
              type: 'heatmap',
              colorscale: colorscale,
              zmid: 0,
              hoverongaps: false,
              hovertemplate: 'Expiry: %{x}<br>Strike: $%{y}<br>Net GEX: %{z:.2f}B<extra></extra>',
            } as any
          ]}
          layout={{
            autosize: true,
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            margin: { t: 40, r: 40, l: 60, b: 80 },
            title: { text: 'GEX HEATMAP (Per Expiry)', font: { color: '#9ca3af', family: "'JetBrains Mono', monospace", size: 14 }, x: 0.05 },
            xaxis: { 
              title: { text: 'Expiration' }, 
              tickangle: -45, 
              tickfont: { color: '#6b7280', family: "'JetBrains Mono', monospace" },
              gridcolor: 'rgba(99,102,241,0.08)'
            },
            yaxis: { 
              title: { text: 'Strike' }, 
              tickprefix: '$', 
              tickfont: { color: '#6b7280', family: "'JetBrains Mono', monospace" },
              gridcolor: 'rgba(99,102,241,0.08)',
              zeroline: false
            },
            shapes: [
              {
                type: 'line',
                x0: 0, x1: 1, xref: 'paper',
                y0: spotPrice, y1: spotPrice, yref: 'y',
                line: { color: '#f59e0b', width: 2, dash: 'dash' }
              }
            ]
          } as any}
          useResizeHandler={true}
          style={{ width: '100%', height: '100%' }}
        />
      </Suspense>
    </div>
  );
}
