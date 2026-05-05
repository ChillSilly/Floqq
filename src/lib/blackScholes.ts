// ─────────────────────────────────────────────────────────────────────────────
// BLACK-SCHOLES ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * ax);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return 0.5 * (1.0 + sign * y);
}

export function d1d2(S: number, K: number, T: number, r: number, q: number, sigma: number): [number, number] | null {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) return null;
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return [d1, d2];
}

export function bsPrice(S: number, K: number, T: number, r: number, q: number, sigma: number, flag: 'C' | 'P'): number {
  const dd = d1d2(S, K, T, r, q, sigma);
  if (!dd) return 0;
  const [d1, d2] = dd;
  if (flag === 'C') {
    return S * Math.exp(-q * T) * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
  }
  return K * Math.exp(-r * T) * normalCDF(-d2) - S * Math.exp(-q * T) * normalCDF(-d1);
}

export function bsGamma(S: number, K: number, T: number, r: number, q: number, sigma: number): number {
  const dd = d1d2(S, K, T, r, q, sigma);
  if (!dd) return 0;
  return Math.exp(-q * T) * normalPDF(dd[0]) / (S * sigma * Math.sqrt(T));
}

export function bsDelta(S: number, K: number, T: number, r: number, q: number, sigma: number, flag: 'C' | 'P'): number {
  const dd = d1d2(S, K, T, r, q, sigma);
  if (!dd) return 0;
  return flag === 'C'
    ? Math.exp(-q * T) * normalCDF(dd[0])
    : -Math.exp(-q * T) * normalCDF(-dd[0]);
}

export function bsVega(S: number, K: number, T: number, r: number, q: number, sigma: number): number {
  const dd = d1d2(S, K, T, r, q, sigma);
  if (!dd) return 0;
  return S * Math.exp(-q * T) * normalPDF(dd[0]) * Math.sqrt(T);
}

export function bsTheta(S: number, K: number, T: number, r: number, q: number, sigma: number, flag: 'C' | 'P'): number {
  const dd = d1d2(S, K, T, r, q, sigma);
  if (!dd) return 0;
  const [d1, d2] = dd;
  const term1 = -(S * Math.exp(-q * T) * normalPDF(d1) * sigma) / (2 * Math.sqrt(T));
  if (flag === 'C') {
    return term1 + q * S * Math.exp(-q * T) * normalCDF(d1) - r * K * Math.exp(-r * T) * normalCDF(d2);
  }
  return term1 - q * S * Math.exp(-q * T) * normalCDF(-d1) + r * K * Math.exp(-r * T) * normalCDF(-d2);
}

export function bsCharm(S: number, K: number, T: number, r: number, q: number, sigma: number, flag: 'C' | 'P'): number {
  const dd = d1d2(S, K, T, r, q, sigma);
  if (!dd) return 0;
  const [d1, d2] = dd;
  const sqrtT = Math.sqrt(T);
  const c = -Math.exp(-q * T) * normalPDF(d1) * (2 * (r - q) * T - d2 * sigma * sqrtT) / (2 * T * sigma * sqrtT);
  return flag === 'C'
    ? c - q * Math.exp(-q * T) * normalCDF(d1)
    : c + q * Math.exp(-q * T) * normalCDF(-d1);
}

export function bsVanna(S: number, K: number, T: number, r: number, q: number, sigma: number): number {
  const dd = d1d2(S, K, T, r, q, sigma);
  if (!dd) return 0;
  const [d1, d2] = dd;
  return -Math.exp(-q * T) * normalPDF(d1) * d2 / sigma;
}

export function bsVomma(S: number, K: number, T: number, r: number, q: number, sigma: number): number {
  const dd = d1d2(S, K, T, r, q, sigma);
  if (!dd) return 0;
  const [d1, d2] = dd;
  return bsVega(S, K, T, r, q, sigma) * d1 * d2 / sigma;
}

export function bsZomma(S: number, K: number, T: number, r: number, q: number, sigma: number): number {
  const dd = d1d2(S, K, T, r, q, sigma);
  if (!dd) return 0;
  const [d1, d2] = dd;
  return bsGamma(S, K, T, r, q, sigma) * (d1 * d2 - 1) / sigma;
}

export function impliedVol(marketPrice: number, S: number, K: number, T: number, r: number, q: number, flag: 'C' | 'P'): number | null {
  if (T <= 0 || marketPrice <= 0) return null;
  const intrinsic = Math.max(0, flag === 'C' ? S - K : K - S);
  if (marketPrice <= intrinsic + 0.0001) return null;
  let lo = 0.001, hi = 10.0;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const price = bsPrice(S, K, T, r, q, mid, flag);
    if (Math.abs(price - marketPrice) < 0.0001) {
      return mid > 0.005 && mid < 5.0 ? mid : null;
    }
    if (price > marketPrice) hi = mid;
    else lo = mid;
  }
  const result = (lo + hi) / 2;
  return result > 0.005 && result < 5.0 ? result : null;
}

// ── Constants ────────────────────────────────────────────────────────────────
export const RISK_FREE_RATE = 0.043;
export const DIV_YIELD: Record<string, number> = {
  SPY: 0.013, QQQ: 0.006, IWM: 0.012, DIA: 0.017,
  GLD: 0.0, SLV: 0.0, TLT: 0.04,
  XLF: 0.018, XLE: 0.035, IBIT: 0.0,
  AAPL: 0.005, NVDA: 0.001, TSLA: 0.0,
  AMZN: 0.0, MSFT: 0.007, META: 0.004,
  GOOGL: 0.0, SPX: 0.013, NDX: 0.006, RUT: 0.012,
};

export const TICKERS = [
  'SPY', 'QQQ', 'IWM', 'DIA', 'GLD', 'SLV', 'TLT', 'XLF', 'XLE', 'IBIT',
  'AAPL', 'NVDA', 'TSLA', 'AMZN', 'MSFT', 'META', 'GOOGL',
] as const;
export type Ticker = (typeof TICKERS)[number];
