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
      const url = `/api/v1/options-data?ticker=${encodeURIComponent(ticker)}&exps=${exps}${forced ? '&force=true' : ''}`;
      const res = await fetch(url);
      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      
      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        // Not JSON or empty
      }
      
      if (!res.ok) {
        let errorMsg = `HTTP error ${res.status}`;
        if (json && json.error) {
          errorMsg = json.error;
          if (json.details) errorMsg += `: ${json.details}`;
        } else if (text) {
          errorMsg += ` - ${text.substring(0, 100)}`;
        }
        console.error(`GEX API Error ${res.status}: ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      if (!isJson) {
        console.error(`GEX Non-JSON Response (Status: ${res.status}, Type: ${contentType}): ${text.substring(0, 200)}`);
        throw new Error(`Server returned non-JSON response [Status: ${res.status}, Type: ${contentType}]`);
      }
      
      if (!json) {
        throw new Error("Failed to parse GEX response");
      }
      
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
