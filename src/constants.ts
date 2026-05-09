import { Layers, Activity, Map as MapIcon, Monitor, Book, Zap, Calculator, Cpu, ShieldCheck, Globe } from 'lucide-react';

export const MODULES = [
  { id: 'module-1', title: 'The Foundation', icon: Layers },
  { id: 'module-2', title: 'Gamma Levels', icon: Activity },
  { id: 'module-4', title: 'Trading Playbook', icon: MapIcon },
  { id: 'module-5', title: 'Platform Setup', icon: Monitor },
  { id: 'module-6', title: 'Glossary', icon: Book },
];

export const VIP_MODULES = [
  { id: 'vip-gex', title: 'Live GEX Dashboard', icon: Activity },
  { id: 'vip-blackscholes', title: 'Black-Scholes Calculator', icon: Calculator },
  { id: 'vip-macro', title: 'Macro Analysis', icon: Globe },
  { id: 'vip-conversion', title: 'Conversion Engine', icon: Cpu },
  { id: 'vip-journal', title: 'Journal', icon: Book },
  { id: 'vip-alpha', title: 'Alpha Intelligence', icon: Zap },
  { id: 'vip-strategy', title: 'Institutional Playbook', icon: ShieldCheck },
];

export const GLOSSARY_TERMS = [
  { term: "Delta Hedging", def: "A strategy where market makers constantly buy/sell the underlying asset to keep their directional exposure neutral.", impact: "This mechanical buying/selling affects liquidity and heavily dictates price action." },
  { term: "Gamma", def: "Measures how fast an option's delta changes as the underlying price moves.", impact: "High gamma forces rapid hedging, translating into massive buying/selling volume that amplifies price moves." },
  { term: "Net GEX (Net Gamma Exposure)", def: "The overall balance of market maker gamma positioning (positive or negative).", impact: "Determines the 'regime' the market is in—either choppy and range-bound (positive) or aggressive and trending (negative)." },
  { term: "Core Resistance", def: "The strike price with the highest net call gamma exposure.", impact: "Acts as a structural ceiling. Dealers sell the underlying to remain neutral, causing rallies to stall." },
  { term: "Put Support", def: "The strike price with the highest net put gamma exposure.", impact: "Acts as a structural floor. Puts being monetized leads to dealers buying back the underlying, causing bounces." },
  { term: "HVL", subtitle: "High Volatility Level", def: "The transition zone where the market's overall gamma flips from positive to negative.", impact: "Above it = positive gamma (range-bound chop). Below it = negative gamma (momentum, massive swings)." },
  { term: "1-Day Expected Move", def: "A volatility indicator predicting the statistical high and low boundaries for the day.", impact: "The S&P 500 stays inside this range ~85% of the time. Used for take-profits and reversal trades." },
  { term: "0DTE Levels", def: "Gamma levels calculated purely from options expiring today (Zero Days to Expiration).", impact: "Extremely sensitive levels that act as massive intraday magnets for price action." },
  { term: "GEX Levels", def: "Secondary levels representing strikes with high net gamma after Core Resistance and Put Support.", impact: "Used by day traders for precise gamma scalping and take-profit targets." },
  { term: "Blind Spots", def: "Hidden market reaction zones derived from correlated assets like bonds or commodities.", impact: "Helps you avoid opening trades into hidden institutional friction." }
];

export const RISK_FREE_RATE = 0.043;
export const DIV_YIELD: Record<string, number> = {
  "SPY": 0.013, "QQQ": 0.006, "IWM": 0.012,
  "SPX": 0.013, "NDX": 0.006, "DIA": 0.015, "GLD": 0.0,
};
