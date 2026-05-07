
/**
 * Estimates AR(1) parameters from a sequence of closes.
 * y_t = c + phi * y_{t-1} + e_t
 */
export function estimateAR1(closes: number[]): { phi: number; mu: number; sigma: number } | null {
  if (!closes || closes.length < 5) return null;

  try {
    const y = closes.filter(val => isFinite(val));
    if (y.length < 5) return null;

    const mu = y.reduce((a, b) => a + b, 0) / y.length;
    
    // Simple least squares for AR(1)
    // x_lag = y[0...n-2]
    // x_curr = y[1...n-1]
    const xLag = y.slice(0, -1);
    const xCurr = y.slice(1);
    const n = xLag.length;

    const meanLag = xLag.reduce((a, b) => a + b, 0) / n;
    const meanCurr = xCurr.reduce((a, b) => a + b, 0) / n;

    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
        num += (xLag[i] - meanLag) * (xCurr[i] - meanCurr);
        den += (xLag[i] - meanLag) ** 2;
    }

    let phi = den !== 0 ? num / den : 0.95;
    phi = Math.max(0.01, Math.min(0.99, phi));

    const c = meanCurr - phi * meanLag;
    
    // Residuals
    let sumResidSq = 0;
    for (let i = 0; i < n; i++) {
        const resid = xCurr[i] - (c + phi * xLag[i]);
        sumResidSq += resid ** 2;
    }
    const sigma = Math.sqrt(sumResidSq / n);

    if (isNaN(sigma) || !isFinite(sigma) || sigma <= 0) {
        // Fallback to small % of price
        const std = Math.sqrt(y.map(x => (x - mu) ** 2).reduce((a, b) => a + b, 0) / y.length);
        return { phi, mu, sigma: Math.max(std * 0.01, 1e-9) };
    }

    return { phi, mu, sigma };
  } catch (e) {
    console.error("AR1 Estimation error", e);
    return null;
  }
}

/**
 * 1D Kalman Filter for Ornstein-Uhlenbeck process.
 * State x is the estimated mean level (fair value).
 */
export class KalmanOU {
  phi: number;
  mu: number;
  Q: number;
  R: number;
  x: number;
  P: number;

  constructor(phi: number, mu: number, sigmaProcess: number, obsNoiseScale: number = 1.0) {
    this.phi = phi;
    this.mu = mu;
    // Process noise variance
    this.Q = (sigmaProcess ** 2) * Math.max(1 - phi ** 2, 1e-6);
    // Observation noise variance
    this.R = (sigmaProcess ** 2) * Math.max(obsNoiseScale, 0.01);
    this.x = mu;
    this.P = this.R;
  }

  predict() {
    this.x = this.phi * this.x + (1 - this.phi) * this.mu;
    this.P = this.phi ** 2 * this.P + this.Q;
  }

  update(z: number) {
    this.predict();
    const K = this.P / (this.P + this.R);
    this.x = this.x + K * (z - this.x);
    this.P = (1 - K) * this.P;
  }

  forecast(steps: number): number[] {
    const results: number[] = [];
    let currentX = this.x;
    for (let i = 1; i <= steps; i++) {
        currentX = this.phi * currentX + (1 - this.phi) * this.mu;
        results.push(currentX);
    }
    return results;
  }
}

export function noiseLeverToScale(leverPercent: number): number {
    const p = Math.max(0, Math.min(100, leverPercent)) / 100.0;
    if (p >= 1.0) return 1e8;
    return 0.1 + (10.0 - 0.1) * p;
}
