
/**
 * Stochastic Process Mathematics Library
 * Translated from Python implementations of Karhunen-Loève and Discrete simulations
 */

export function brownianMotionDiscrete(steps: number, paths: number, T: number): number[][] {
  const dt = T / steps;
  const results: number[][] = [];

  for (let p = 0; p < paths; p++) {
    const path: number[] = [0];
    let current = 0;
    for (let s = 1; s < steps; s++) {
      const db = Math.sqrt(dt) * normalRandom();
      current += db;
      path.push(current);
    }
    results.push(path);
  }
  return results;
}

export function brownianBridgeDiscrete(steps: number, paths: number, T: number): number[][] {
  const wt = brownianMotionDiscrete(steps, paths, T);
  const dt = T / steps;
  
  return wt.map(p => {
    const wT = p[p.length - 1];
    return p.map((val, i) => {
      const t = i * dt;
      return val - (t / T) * wT;
    });
  });
}

export function geometricBrownianMotion(
  S0: number, 
  mu: number, 
  sigma: number, 
  T: number, 
  steps: number, 
  paths: number
): number[][] {
  const wt = brownianMotionDiscrete(steps, paths, T);
  const dt = T / steps;
  
  return wt.map(p => {
    return p.map((w, i) => {
      const t = i * dt;
      return S0 * Math.exp((mu - 0.5 * sigma ** 2) * t + sigma * w);
    });
  });
}

export function ornsteinUhlenbeckDiscrete(
  x0: number,
  theta: number,
  mu: number,
  sigma: number,
  T: number,
  steps: number,
  paths: number
): number[][] {
  const dt = T / steps;
  const results: number[][] = [];

  for (let p = 0; p < paths; p++) {
    const path: number[] = [x0];
    let current = x0;
    for (let s = 1; s < steps; s++) {
      const dx = theta * (mu - current) * dt + sigma * Math.sqrt(dt) * normalRandom();
      current += dx;
      path.push(current);
    }
    results.push(path);
  }
  return results;
}

/**
 * Monte Carlo Option Pricing
 */
export interface OptionResult {
  price: number;
  stdError: number;
  payoffs: number[];
}

export function priceEuropeanOption(
  S0: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  type: 'call' | 'put',
  paths: number = 10000
): OptionResult {
  const steps = 1; // Only need maturity price for European
  const st = geometricBrownianMotion(S0, r, sigma, T, steps + 1, paths);
  
  const finalPrices = st.map(p => p[p.length - 1]);
  const payoffs = finalPrices.map(sT => {
    return type === 'call' ? Math.max(sT - K, 0) : Math.max(K - sT, 0);
  });
  
  const discountFactor = Math.exp(-r * T);
  const sumPayoffs = payoffs.reduce((a, b) => a + b, 0);
  const meanPayoff = sumPayoffs / paths;
  const price = discountFactor * meanPayoff;
  
  // Std Error
  const sqDiffs = payoffs.map(p => (p - meanPayoff) ** 2);
  const variance = sqDiffs.reduce((a, b) => a + b, 0) / paths;
  const stdError = (discountFactor * Math.sqrt(variance)) / Math.sqrt(paths);
  
  return { price, stdError, payoffs };
}

/**
 * Black-Scholes Pricing and Greeks
 */

// Normal Distribution Helper functions
function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1.0 / (1.0 + p * Math.abs(x));
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function normCDF(x: number): number {
  return (1.0 + erf(x / Math.sqrt(2.0))) / 2.0;
}

function normPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2.0 * Math.PI);
}

export function blackScholes(
  S: number, 
  K: number, 
  T: number, 
  r: number, 
  sigma: number, 
  type: 'call' | 'put'
): number {
  if (T <= 0) return type === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  if (type === 'call') {
    return S * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2);
  } else {
    return K * Math.exp(-r * T) * normCDF(-d2) - S * normCDF(-d1);
  }
}

export interface Greeks {
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
}

export function calculateGreeks(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  type: 'call' | 'put'
): Greeks {
  if (T <= 0) return { delta: 0, gamma: 0, vega: 0, theta: 0 };
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  const nd1 = normPDF(d1);
  const Nd1 = normCDF(d1);
  
  // Delta
  const delta = type === 'call' ? Nd1 : Nd1 - 1;
  
  // Gamma
  const gamma = nd1 / (S * sigma * Math.sqrt(T));
  
  // Vega (normalized for 1% change)
  const vega = (S * nd1 * Math.sqrt(T)) / 100;
  
  // Theta (annualized then daily)
  const thetaTerm1 = -(S * nd1 * sigma) / (2 * Math.sqrt(T));
  const thetaTerm2 = type === 'call' 
    ? -r * K * Math.exp(-r * T) * normCDF(d2)
    : r * K * Math.exp(-r * T) * normCDF(-d2);
  const theta = (thetaTerm1 + thetaTerm2) / 365;

  return { delta, gamma, vega, theta };
}

/**
 * Standard Normal Random (Box-Muller)
 */
function normalRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
