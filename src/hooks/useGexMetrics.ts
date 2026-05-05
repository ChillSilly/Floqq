import { useState, useEffect, useCallback } from 'react';
import type { GexResult } from '../lib/gexEngine';

export function useGexMetrics(ticker: string, exps = 1, intervalMs = 60000) {
  const [data, setData] = useState<GexResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  const fetchMetrics = useCallback(async (forced = false) => {
    if (!ticker) return;
    try {
      const url = `/api/gex?ticker=${ticker}&exps=${exps}${forced ? '&force=true' : ''}`;
      const res = await fetch(url);
      const isJson = res.headers.get('content-type')?.includes('application/json');
      if (!res.ok) {
        const errData = isJson ? await res.json().catch(() => ({})) : {};
        throw new Error(errData.error || `HTTP error ${res.status}`);
      }
      if (!isJson) {
        throw new Error("Server returned non-JSON response");
      }
      const json = await res.json();
      
      setData(prev => {
        if (!prev) return json;
        // Simple deep compare for identifying significant changes
        const prevCopy = { ...prev, timestamp: 0 };
        const jsonCopy = { ...json, timestamp: 0 };
        if (JSON.stringify(prevCopy) === JSON.stringify(jsonCopy)) return prev;
        return json;
      });
      setError(null);
      setLastUpdated(Date.now());
    } catch (e: any) {
      console.error('GEX Fetch Error:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [ticker, exps]);

  useEffect(() => {
    setLoading(true);
    fetchMetrics();
    const interval = setInterval(() => fetchMetrics(), intervalMs);
    return () => clearInterval(interval);
  }, [fetchMetrics, intervalMs]);

  return { data, loading, error, refetch: () => fetchMetrics(true), lastUpdated };
}
