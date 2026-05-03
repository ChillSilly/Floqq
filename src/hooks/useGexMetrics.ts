import { useState, useEffect } from 'react';
import type { GexResult } from '../lib/gexEngine';

export function useGexMetrics(ticker: string, exps = 1, intervalMs = 60000) {
  const [data, setData] = useState<GexResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchMetrics = async () => {
      try {
        const res = await fetch(`/api/gex?ticker=${ticker}&exps=${exps}`);
        if (!res.ok) throw new Error('Fetch failed');
        const json = await res.json();
        if (isMounted) {
          setData(prev => {
            if (prev) {
              const prevCopy = { ...prev, timestamp: '' };
              const jsonCopy = { ...json, timestamp: '' };
              if (JSON.stringify(prevCopy) === JSON.stringify(jsonCopy)) {
                return prev;
              }
            }
            return json;
          });
          setError('');
        }
      } catch (e: any) {
        if (isMounted) setError(e.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, intervalMs);
    return () => {
        isMounted = false;
        clearInterval(interval);
    };
  }, [ticker, exps, intervalMs]);

  return { data, loading, error };
}
