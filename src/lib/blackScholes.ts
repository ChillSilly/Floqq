export const normalPDF = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

export const normalCDF = (x: number) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
};

export const _d1d2 = (S: number, K: number, T: number, r: number, q: number, sigma: number) => {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) return { d1: NaN, d2: NaN };
  const d1 = (Math.log(S / K) + (r - q + 0.5 * Math.pow(sigma, 2)) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return { d1, d2 };
};

export const bs_price = (S: number, K: number, T: number, r: number, q: number, sigma: number, flag: "C" | "P") => {
  const { d1, d2 } = _d1d2(S, K, T, r, q, sigma);
  if (isNaN(d1)) return 0.0;
  if (flag === "C") {
    return S * Math.exp(-q * T) * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
  }
  return K * Math.exp(-r * T) * normalCDF(-d2) - S * Math.exp(-q * T) * normalCDF(-d1);
};

export const bs_gamma = (S: number, K: number, T: number, r: number, q: number, sigma: number) => {
  const { d1 } = _d1d2(S, K, T, r, q, sigma);
  if (isNaN(d1)) return 0.0;
  return Math.exp(-q * T) * normalPDF(d1) / (S * sigma * Math.sqrt(T));
};

export const bs_delta = (S: number, K: number, T: number, r: number, q: number, sigma: number, flag: "C" | "P") => {
  const { d1 } = _d1d2(S, K, T, r, q, sigma);
  if (isNaN(d1)) return 0.0;
  return flag === "C" ? Math.exp(-q * T) * normalCDF(d1) : -Math.exp(-q * T) * normalCDF(-d1);
};

export const bs_vega = (S: number, K: number, T: number, r: number, q: number, sigma: number) => {
  const { d1 } = _d1d2(S, K, T, r, q, sigma);
  if (isNaN(d1)) return 0.0;
  return S * Math.exp(-q * T) * normalPDF(d1) * Math.sqrt(T) / 100; // usually vega is divided by 100
};

export const bs_charm = (S: number, K: number, T: number, r: number, q: number, sigma: number, flag: "C" | "P") => {
  const { d1, d2 } = _d1d2(S, K, T, r, q, sigma);
  if (isNaN(d1)) return 0.0;
  const c = -Math.exp(-q * T) * normalPDF(d1) * (2 * (r - q) * T - d2 * sigma * Math.sqrt(T)) / (2 * T * sigma * Math.sqrt(T));
  return flag === "C" ? c - q * Math.exp(-q * T) * normalCDF(d1) : c + q * Math.exp(-q * T) * normalCDF(-d1);
};

export const bs_vanna = (S: number, K: number, T: number, r: number, q: number, sigma: number) => {
  const { d1, d2 } = _d1d2(S, K, T, r, q, sigma);
  if (isNaN(d1)) return 0.0;
  return -Math.exp(-q * T) * normalPDF(d1) * d2 / sigma / 100;
};

export const bs_vomma = (S: number, K: number, T: number, r: number, q: number, sigma: number) => {
  const { d1, d2 } = _d1d2(S, K, T, r, q, sigma);
  if (isNaN(d1)) return 0.0;
  return (S * Math.exp(-q * T) * normalPDF(d1) * Math.sqrt(T)) * d1 * d2 / sigma / 10000;
};

export const bs_zomma = (S: number, K: number, T: number, r: number, q: number, sigma: number) => {
  const { d1, d2 } = _d1d2(S, K, T, r, q, sigma);
  if (isNaN(d1)) return 0.0;
  return bs_gamma(S, K, T, r, q, sigma) * (d1 * d2 - 1) / sigma;
};

export const implied_vol = (market_price: number, S: number, K: number, T: number, r: number, q: number, flag: "C" | "P") => {
  if (T <= 0 || market_price <= 0) return NaN;
  const intrinsic = Math.max(0.0, flag === "C" ? S - K : K - S);
  if (market_price <= intrinsic + 1e-4) return NaN;
  
  let sigma = 0.5; // initial guess
  for (let i = 0; i < 100; i++) {
    const price = bs_price(S, K, T, r, q, sigma, flag);
    const vega = bs_vega(S, K, T, r, q, sigma) * 100; // Need exact derivative 
    if (Math.abs(price - market_price) < 1e-6) return sigma;
    if (Math.abs(vega) < 1e-8) break;
    sigma = sigma - (price - market_price) / vega;
  }
  
  return (sigma > 0.005 && sigma < 5.0) ? sigma : NaN;
};
