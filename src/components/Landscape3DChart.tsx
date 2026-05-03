import React, { lazy, Suspense } from 'react';

const Plot = lazy(() => import('react-plotly.js'));

interface LandscapeProps {
  data: { strike: number; expiration: string; callGEX: number; putGEX: number }[];
  spotPrice: number;
}

export function Landscape3DChart({ data, spotPrice }: LandscapeProps) {
  if (!data || !data.length) return null;

  const expiries = Array.from(new Set(data.map(d => d.expiration))).sort();
  const strikes = Array.from(new Set(data.map(d => d.strike))).sort((a, b) => a - b);
  
  const filteredStrikes = strikes.filter(s => s >= spotPrice * 0.90 && s <= spotPrice * 1.10);

  const zMatrix = filteredStrikes.map(strike => {
    return expiries.map(exp => {
      const option = data.find(d => d.strike === strike && d.expiration === exp);
      return option ? (option.callGEX + option.putGEX) : 0;
    });
  });

  const maxAbs = Math.max(...zMatrix.flat().map(Math.abs));

  return (
    <div style={{ width: '100%', height: 600, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(99,102,241,0.15)', background: '#070b14' }}>
      <Suspense fallback={<div style={{height: 500, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117', borderRadius: 8, color: '#9ca3af'}}>Loading 3D Landscape...</div>}>
      <Plot
        data={[
          {
            z: zMatrix,
            x: expiries,
            y: filteredStrikes,
            type: 'surface',
            colorscale: 'Picnic',
            cmin: -maxAbs,
            cmax: maxAbs,
          } as any
        ]}
        layout={{
          autosize: true,
          paper_bgcolor: 'transparent',
          scene: {
            xaxis: { title: { text: 'Expiration' }, tickfont: { color: '#9ca3af', family: "'JetBrains Mono'" }, gridcolor: '#1f2937' },
            yaxis: { title: { text: 'Strike' }, tickfont: { color: '#9ca3af', family: "'JetBrains Mono'" }, gridcolor: '#1f2937' },
            zaxis: { title: { text: 'GEX ($B)' }, tickfont: { color: '#9ca3af', family: "'JetBrains Mono'" }, gridcolor: '#1f2937' },
            camera: {
              eye: { x: 1.5, y: 1.5, z: 0.5 }
            }
          },
          margin: { t: 30, r: 0, l: 0, b: 0 }
        } as any}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
      />
      </Suspense>
    </div>
  );
}
