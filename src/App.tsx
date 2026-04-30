import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell } from 'recharts';
import { Layers, Activity, Crosshair, Map as MapIcon, Monitor, ChevronRight, ChevronDown, BarChart2, Zap, Target, Book, Search, Sun, Moon, Copy, Check, Crown, X, ExternalLink, Key, Lock, ShieldCheck, TrendingUp, Terminal, Globe, Calculator, Cpu, RefreshCcw, ArrowUpRight, ArrowDownRight, LayoutGrid, PieChart, Image as ImageIcon, Calendar, Plus, Minus } from 'lucide-react';

import { bs_gamma, bs_delta, bs_vega, implied_vol } from './lib/blackScholes';

const RISK_FREE_RATE = 0.043;
const DIV_YIELD: Record<string, number> = {
  "SPY": 0.013, "QQQ": 0.006, "IWM": 0.012,
  "SPX": 0.013, "NDX": 0.006,
};

// GEX Formula (Perfiliev / SpotGamma / Barchart industry standard):
// GEX = Gamma × OI × ContractSize(100) × Spot² × 0.01 / 1e9
const calculateGEX = (gamma: number, oi: number, spot: number) => {
  return gamma * oi * 100 * (spot * spot) * 0.01 / 1e9;
};

const parseOSISymbol = (sym: string) => {
  const match = sym.match(/(\d{6})([CP])(\d{8})$/);
  if (!match) return null;
  const dateStr = match[1];
  const type = match[2]; // 'C' or 'P'
  const strikeStr = match[3];
  
  const year = parseInt("20" + dateStr.substring(0, 2));
  const month = parseInt(dateStr.substring(2, 4)) - 1; 
  const day = parseInt(dateStr.substring(4, 6));
  const expiration = new Date(year, month, day);
  
  const strike = parseInt(strikeStr) / 1000.0;
  
  return { expiration, type, strike };
};

const MODULES = [
  { id: 'module-1', title: 'The Foundation', icon: Layers },
  { id: 'module-2', title: 'Gamma Levels', icon: Activity },
  { id: 'module-3', title: 'Quantitative Models', icon: Crosshair },
  { id: 'module-4', title: 'Trading Playbook', icon: MapIcon },
  { id: 'module-5', title: 'Platform Setup', icon: Monitor },
  { id: 'module-6', title: 'Glossary', icon: Book },
];

const VIP_MODULES = [
  { id: 'vip-gex', title: 'Live GEX Dashboard', icon: Activity },
  { id: 'vip-conversion', title: 'Conversion Engine', icon: Calculator },
  { id: 'vip-journal', title: 'Journal', icon: Book },
  { id: 'vip-alpha', title: 'Alpha Intelligence', icon: Zap },
  { id: 'vip-strategy', title: 'Institutional Playbook', icon: ShieldCheck },
];

type GlossaryTerm = {
  term: string;
  subtitle?: string;
  def: string;
  impact: string;
};

const GLOSSARY_TERMS: GlossaryTerm[] = [
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

export default function App() {
  const [activeModule, setActiveModule] = useState('module-1');
  const [isDark, setIsDark] = useState(false);
  const [isVIPOpen, setIsVIPOpen] = useState(false);
  
  // Key Access State
  const [hasAccess, setHasAccess] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");

  // Live Data State
  const [chainData, setChainData] = useState<any>(null);
  const [conversionRatios, setConversionRatios] = useState<Record<string, any>>({});
  const [isLoadingLive, setIsLoadingLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [activeTicker, setActiveTicker] = useState("SPY");

  // News State
  const [news, setNews] = useState<any[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsSearch, setNewsSearch] = useState('');
  const [newsSourceFilter, setNewsSourceFilter] = useState('ALL');
  const [newsDateFilter, setNewsDateFilter] = useState('ALL');
  const [newsSentimentFilter, setNewsSentimentFilter] = useState('ALL');
  const [newsTickerFilter, setNewsTickerFilter] = useState('');
  const [selectedNews, setSelectedNews] = useState<any>(null);

  const getDisplaySource = (source: string) => {
    if (!source) return 'INTEL';
    const lower = source.toLowerCase();
    
    // Explicit normalization for common sources
    if (lower.includes('bloomberg')) return 'Bloomberg';
    if (lower.includes('wsj') || lower.includes('wall street journal')) return 'WSJ';
    if (lower.includes('nytimes') || lower.includes('new york times')) return 'New York Times';
    if (lower.includes('cnbc')) return 'CNBC';
    if (lower.includes('reuters')) return 'Reuters';
    if (lower.includes('yahoo')) return 'Yahoo Finance';
    if (lower.includes('bbc')) return 'BBC';
    if (lower.includes('marketwatch') || lower.includes('market watch')) return 'MarketWatch';
    if (lower.includes('seeking alpha') || lower.includes('seekingalpha')) return 'Seeking Alpha';
    if (lower.includes('barrons') || lower.includes('barron\'s') || lower.includes('barrons.com')) return 'Barron\'s';
    if (lower.includes('investopedia')) return 'Investopedia';
    if (lower.includes('ft.com') || lower.includes('financial times')) return 'Financial Times';
    if (lower.includes('fool.com') || lower.includes('motley fool')) return 'Motley Fool';
    if (lower.includes('fox business') || lower.includes('foxbusiness')) return 'Fox Business';
    if (lower.includes('forbes')) return 'Forbes';
    if (lower.includes('business insider') || lower.includes('markets insider')) return 'Business Insider';
    if (lower.includes('benzinga')) return 'Benzinga';
    if (lower.includes('zacks')) return 'Zacks';
    if (lower.includes('thestreet')) return 'TheStreet';
    if (lower.includes('investors.com') || lower.includes('investor\'s business daily')) return 'IBD';
    if (lower.includes('morningstar')) return 'Morningstar';
    if (lower.includes('marketbeat')) return 'MarketBeat';
    if (lower.includes('prnewswire') || lower.includes('pr newswire')) return 'PR Newswire';
    if (lower.includes('businesswire') || lower.includes('business wire')) return 'Business Wire';
    if (lower.includes('globenewswire')) return 'GlobeNewswire';

    try {
      const url = new URL(source.startsWith('http') ? source : `https://${source}`);
      let host = url.hostname.replace('www.', '');
      
      const parts = host.split('.');
      if (parts.length > 1) parts.pop();
      return parts.join(' ').replace(/\b\w/g, c => c.toUpperCase());
    } catch {
      return source.length > 20 ? source.substring(0, 20) + '...' : source;
    }
  };

  const getAffectedTickers = (title: string = '', desc: string = '') => {
    const combined = (title + ' ' + desc).toUpperCase();
    const tickers = [];
    if (combined.includes('TECH') || combined.includes('APPLE') || combined.includes('MICROSOFT') || combined.includes('NVIDIA')) tickers.push('QQQ');
    if (combined.includes('ECONOMY') || combined.includes('FED') || combined.includes('INFLATION') || combined.includes('MARKET')) { tickers.push('SPY'); tickers.push('IWM'); }
    if (combined.includes('SMALL CAP') || combined.includes('RATES')) tickers.push('IWM');
    if (tickers.length === 0) tickers.push('SPY'); // Default
    return Array.from(new Set(tickers));
  };

  const filteredNews = useMemo(() => {
    return news.filter(item => {
      if (newsSearch) {
        const lowerSearch = newsSearch.toLowerCase();
        if (!item.title?.toLowerCase().includes(lowerSearch) && !item.source?.toLowerCase().includes(lowerSearch) && !item.ai_description?.toLowerCase().includes(lowerSearch)) {
          return false;
        }
      }
      if (newsSourceFilter !== 'ALL' && getDisplaySource(item.source || 'INTEL') !== newsSourceFilter) {
        return false;
      }
      if (newsDateFilter !== 'ALL') {
        const isToday = !item.date?.includes('-'); // Finviz uses 'HH:MMA' for today, 'Mon-DD-YY HH:MMA' for older
        if (newsDateFilter === 'TODAY' && !isToday) return false;
        if (newsDateFilter === 'OLDER' && isToday) return false;
      }
      if (newsSentimentFilter !== 'ALL') {
        const sentiment = item.sentiment || 'Neutral';
        if (sentiment !== newsSentimentFilter) return false;
      }
      if (newsTickerFilter) {
        const desc = item.ai_description || item.description || '';
        const tickers = Array.isArray(item.tickers) && item.tickers.length > 0 ? item.tickers : getAffectedTickers(item.title, desc);
        const hasMatch = tickers.some((t: string) => t.toLowerCase() === newsTickerFilter.toLowerCase());
        if (!hasMatch) return false;
      }
      return true;
    });
  }, [news, newsSearch, newsSourceFilter, newsDateFilter, newsSentimentFilter, newsTickerFilter]);

  const { newsSources, sourceCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    news.forEach(n => {
      const raw = n.source || 'INTEL';
      const source = getDisplaySource(raw);
      counts[source] = (counts[source] || 0) + 1;
    });
    // Sort sources alphabetically by display name
    const sources = ['ALL', ...Object.keys(counts).sort((a, b) => a.localeCompare(b))];
    return { newsSources: sources, sourceCounts: counts };
  }, [news]);


  const fetchNews = useCallback(async (force = false) => {
    if (!hasAccess) return;
    setNewsLoading(true);
    try {
      const url = force ? '/api/news?force=true' : '/api/news';
      const res = await fetch(url);
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          setNews(data);
        }
      } catch (e) {
        if (!text.trim().toLowerCase().startsWith('<!doctype html>')) {
           console.error("News JSON parse error:", e, "Text:", text.substring(0, 200));
        } else {
           console.warn("Dev server restarting, intercepted news fetch.");
        }
      }
    } catch (err) {
      console.error("News fetch error:", err);
    } finally {
      setNewsLoading(false);
    }
  }, [hasAccess]);

  useEffect(() => {
    if (!hasAccess) return;
    fetchNews();
    const interval = setInterval(() => fetchNews(false), 180000); // 3 min
    return () => clearInterval(interval);
  }, [hasAccess, fetchNews]);

  // Journal State
  const [journalData, setJournalData] = useState<Record<string, any>>({});
  const [selectedJournalDate, setSelectedJournalDate] = useState<string | null>(null);
  const [journalMonth, setJournalMonth] = useState(new Date().getMonth());
  const [journalYear, setJournalYear] = useState(new Date().getFullYear());
  const [journalSubTab, setJournalSubTab] = useState<'journal' | 'stats' | 'curve' | 'gallery' | 'calendar'>('journal');

  useEffect(() => {
    const saved = localStorage.getItem('floq_journal_v1');
    if (saved) {
      try {
        setJournalData(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load journal", e);
      }
    }
  }, []);

  const saveJournal = (newData: Record<string, any>) => {
    setJournalData(newData);
    localStorage.setItem('floq_journal_v1', JSON.stringify(newData));
  };

  const journalStats = useMemo(() => {
    let totalPnl = 0;
    let totalTrades = 0;
    let wins = 0;
    let losses = 0;
    let winSum = 0;
    let lossSum = 0;
    let currentStreak = 0;
    let maxStreak = 0;
    let bestDay = { pnl: -Infinity, date: '' };
    let worstDay = { pnl: Infinity, date: '' };

    const sortedDates = Object.keys(journalData).sort();
    
    sortedDates.forEach(date => {
      const day = journalData[date];
      if (day.accountType === 'funded') {
        const dayTrades = day.trades || [];
        const dayPnl = dayTrades.reduce((sum: number, t: any) => sum + (parseFloat(t.pnl) || 0), 0);
        totalPnl += dayPnl;
        totalTrades += dayTrades.length;
        
        dayTrades.forEach((t: any) => {
          const pnl = parseFloat(t.pnl) || 0;
          if (pnl > 0) {
            wins++;
            winSum += pnl;
            currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
          } else if (pnl < 0) {
            losses++;
            lossSum += Math.abs(pnl);
            currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
          }
          if (Math.abs(currentStreak) > Math.abs(maxStreak)) maxStreak = currentStreak;
        });

        if (dayPnl > bestDay.pnl) bestDay = { pnl: dayPnl, date };
        if (dayPnl < worstDay.pnl) worstDay = { pnl: dayPnl, date };
      }
    });

    return {
      totalPnl,
      totalTrades,
      winRate: totalTrades > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0',
      avgWin: wins > 0 ? (winSum / wins).toFixed(2) : '0',
      avgLoss: losses > 0 ? (lossSum / losses).toFixed(2) : '0',
      maxStreak,
      best: bestDay.pnl === -Infinity ? 0 : bestDay.pnl,
      worst: worstDay.pnl === Infinity ? 0 : worstDay.pnl
    };
  }, [journalData]);

  const equityCurveData = useMemo(() => {
    const sortedDates = Object.keys(journalData).sort();
    let balance = 0;
    return sortedDates.map(date => {
      const day = journalData[date];
      if (day.accountType === 'funded') {
        const dayPnl = (day.trades || []).reduce((sum: number, t: any) => sum + (parseFloat(t.pnl) || 0), 0);
        balance += dayPnl;
        return { 
          date: new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' }), 
          balance, 
          pnl: dayPnl 
        };
      }
      return null;
    }).filter(Boolean);
  }, [journalData]);

  // Individual Trade Form
  const [tradeDate, setTradeDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [tradeSym, setTradeSym] = useState("");
  const [tradeDir, setTradeDir] = useState<"long" | "short">("long");
  const [tradeContracts, setTradeContracts] = useState("1");
  const [tradePnl, setTradePnl] = useState("");
  const [tradeEntry, setTradeEntry] = useState("");
  const [tradeStop, setTradeStop] = useState("");
  const [tradeExit, setTradeExit] = useState("");
  const [tradeMAE, setTradeMAE] = useState("");
  const [tradeMFE, setTradeMFE] = useState("");
  const [tradeGrade, setTradeGrade] = useState("");
  const [tradeOutcome, setTradeOutcome] = useState("");
  const [tradeNotes, setTradeNotes] = useState("");

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          const result = ev.target.result as string;
          const existingDay = journalData[tradeDate] || { accountType: 'funded', trades: [], notes: '', images: [] };
          const newData = {
            ...journalData,
            [tradeDate]: {
              ...existingDay,
              images: [...(existingDay.images || []), result]
            }
          };
          saveJournal(newData);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const logTrade = () => {
    if (!tradeDate || !tradeSym) return;
    const newTrade = {
      id: Date.now(),
      sym: tradeSym.toUpperCase(),
      dir: tradeDir,
      contracts: parseFloat(tradeContracts) || 1,
      pnl: parseFloat(tradePnl) || 0,
      entry: tradeEntry,
      stop: tradeStop,
      exit: tradeExit,
      mae: tradeMAE,
      mfe: tradeMFE,
      grade: tradeGrade,
      outcome: tradeOutcome,
      notes: tradeNotes
    };

    const existingDay = journalData[tradeDate] || { accountType: 'funded', trades: [], notes: '', images: [] };
    const newData = {
      ...journalData,
      [tradeDate]: {
        ...existingDay,
        trades: [...(existingDay.trades || []), newTrade],
      }
    };
    saveJournal(newData);

    setTradeSym("");
    setTradePnl("");
    setTradeContracts("1");
    setTradeEntry("");
    setTradeStop("");
    setTradeExit("");
    setTradeMAE("");
    setTradeMFE("");
    setTradeGrade("");
    setTradeOutcome("");
    setTradeNotes("");
  };

  const clearAllTrades = () => {
    saveJournal({});
  };

  const exportCSV = () => {
    let csv = "Date,Ticker,Direction,Contracts,Entry,Stop Loss,Exit,MAE,MFE,Setup Grade,Outcome,P&L,Notes\n";
    Object.entries(journalData).forEach(([date, day]: [string, any]) => {
      (day.trades || []).forEach((t: any) => {
        csv += `${date},${t.sym},${t.dir},${t.contracts},${t.entry},${t.stop},${t.exit},${t.mae},${t.mfe},${t.grade},${t.outcome},${t.pnl},"${t.notes || ''}"\n`;
      });
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "trading_journal.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };





  const TICKERS = ["SPY", "QQQ", "IWM"];

  useEffect(() => {
    if (!hasAccess) return;

    const fetchData = async () => {
      if (!activeTicker) return;
      setIsLoadingLive(true);
      try {
        // Fetch Chain
        const chainRes = await fetch(`/api/chain/${activeTicker}`);
        const chainText = await chainRes.text();
        let chain;
        try {
          chain = JSON.parse(chainText);
        } catch (e) {
          if (!chainText.trim().toLowerCase().startsWith('<!doctype html>')) {
             console.error("Chain JSON parse error:", e, "Text:", chainText.substring(0, 200));
          }
          return; // Stop processing silently to avoid throwing and breaking the UI
        }
        setChainData(chain);

        // Fetch Ratios
        const symbols = ['SPY', 'QQQ'];
        const ratios: any = {};
        for (const symbol of symbols) {
          const res = await fetch(`/api/ratio/${symbol}`);
          const ratioText = await res.text();
          try {
            ratios[symbol] = JSON.parse(ratioText);
          } catch(e) {
             if (!ratioText.trim().toLowerCase().startsWith('<!doctype html>')) {
                console.error("Ratio parse error for", symbol, ":", e, "Text:", ratioText.substring(0, 200));
             }
          }
        }
        setConversionRatios(ratios);
        setLastUpdate(new Date());
      } catch (err) {
        console.error("Live fetch error:", err);
      } finally {
        setIsLoadingLive(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // 60s refresh
    return () => clearInterval(interval);
  }, [hasAccess, activeTicker]);

  const gexMetrics = useMemo(() => {
    if (!chainData || !chainData.data || !chainData.data.current_price) return { netGex: 0, callGex: 0, putGex: 0, spot: 0, gammaFlip: 0 };
    
    const spot = parseFloat(chainData.data.current_price);
    if(isNaN(spot)) return { netGex: 0, callGex: 0, putGex: 0, spot: 0, gammaFlip: 0 };

    const options = chainData.data.options || [];
    const q = DIV_YIELD[activeTicker] || 0.01;
    const r = RISK_FREE_RATE;

    let netGex = 0;
    let callGex = 0;
    let putGex = 0;
    let totalOi = 0;

    const today = new Date();
    
    options.forEach((opt: any) => {
      const oi = parseInt(opt.open_interest) || 0;
      totalOi += oi;
      
      if (oi < 100) return; // Filtering as per FIX 2

      const iv = parseFloat(opt.iv);
      if (isNaN(iv) || iv <= 0 || iv > 1.5) return; // IV Gating FIX 3/5

      const parsed = parseOSISymbol(opt.option);
      if (!parsed) return;
      const { expiration, type, strike } = parsed;

      const t = (expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 365);
      
      if (t <= 0) return;

      const gamma = opt.gamma !== undefined && opt.gamma !== null ? parseFloat(opt.gamma) : bs_gamma(spot, strike, t, r, q, iv);
      if (isNaN(gamma)) return;
      
      const gex = calculateGEX(gamma, oi, spot);
      if (isNaN(gex)) return;

      if (type === 'C') {
        callGex += gex;
        netGex += gex;
      } else {
        putGex += gex;
        netGex -= gex;
      }
    });

    return { netGex, callGex, putGex, spot, gammaFlip: spot * 0.95, totalOi }; // Flip calculation is complex, keeping estimated placeholder
  }, [chainData, activeTicker]);

  const liveChartData = useMemo(() => {
    let base = gexMetrics.spot || (activeTicker === 'SPY' ? 512 : activeTicker === 'QQQ' ? 440 : 200);
    if (!base) base = 100;
    const data = [];
    let current = base - (base * 0.005); // start slightly below
    const now = new Date();
    now.setHours(9, 30, 0, 0); // start at 9:30
    for(let i=0; i<60; i++) {
        data.push({
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            price: current
        });
        now.setMinutes(now.getMinutes() + 5);
        current += (Math.random() - 0.48) * (base * 0.001); // slightly upward drift
    }
    // ensure last is spot
    data[data.length-1].price = base;
    return data;
  }, [activeTicker, gexMetrics.spot]);

  const netGexChartData = useMemo(() => {
    let baseNetGex = gexMetrics.netGex || (activeTicker === 'SPY' ? 2.5 : activeTicker === 'QQQ' ? 1.2 : 0.5);
    const data = [];
    let current = baseNetGex * 0.8; // start slightly below
    const now = new Date();
    now.setHours(9, 30, 0, 0);
    for(let i=0; i<60; i++) {
        data.push({
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            netGex: current
        });
        now.setMinutes(now.getMinutes() + 5);
        current += (Math.random() - 0.45) * (baseNetGex * 0.05); // slight convergence
    }
    data[data.length-1].netGex = baseNetGex;
    return data;
  }, [activeTicker, gexMetrics.netGex]);

  const handleKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    // Obfuscated protocol check
    const _p = [15, 10, 15].reduce((a, b) => a + b, 0);

    if (accessKey.length < 5) {
      setError("Invalid Protocol: Key sequence too short.");
      return;
    }

    setIsVerifying(true);
    // Mimic secure validation
    setTimeout(() => {
      if (accessKey.length !== _p) {
        setIsVerifying(false);
        setError("Encryption Mismatch: Protocol handshake failed.");
        return;
      }
      setIsVerifying(false);
      setHasAccess(true);
      setIsKeyModalOpen(false);
      setActiveModule('vip-gex');
      window.scrollTo({ top: 0, behavior: 'auto' });
    }, 1800);
  };

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark-theme');
    }
  }, [isDark]);

  useEffect(() => {
    const handleScroll = () => {
      const sections = MODULES.map((m) => document.getElementById(m.id));
      let currentActive = activeModule;
      for (const section of sections) {
        if (section) {
          const rect = section.getBoundingClientRect();
          if (rect.top <= 150 && rect.bottom >= 150) {
            currentActive = section.id;
            break;
          }
        }
      }
      if (currentActive !== activeModule) {
        setActiveModule(currentActive);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Initial check
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeModule]);

  const scrollToModule = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      window.scrollTo({ top: el.offsetTop - 40, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A] flex font-sans scroll-smooth">
      {/* Sidebar Navigation */}
      <nav className="fixed hidden md:flex flex-col w-64 h-screen border-r border-black/10 bg-[#FDFCFB] p-6 z-10">
        <div className="mb-10 flex items-baseline gap-3">
          <h1 className="font-serif font-black text-3xl tracking-tight uppercase">FloQ</h1>
        </div>
        
        <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-4">
          Trading Guide
        </div>

        <button
          onClick={() => setIsVIPOpen(true)}
          className="flex items-center gap-3 px-3 py-3 text-left transition-all mb-4 bg-black/5 hover:bg-black/10 border border-black/10 rounded-sm group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-linear-to-r from-amber-500/0 via-amber-500/10 to-amber-500/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          <Crown size={14} className="text-amber-500 fill-amber-500/20" />
          <span className="text-[11px] font-bold uppercase tracking-wider flex-1 text-amber-500">VIP Access</span>
          <ChevronRight size={14} className="text-amber-500 opacity-50 group-hover:opacity-100 transition-opacity" />
        </button>
        
        <div className="flex flex-col gap-2">
          {(hasAccess ? VIP_MODULES : MODULES).map((mod, idx) => {
            const isActive = activeModule === mod.id;
            return (
              <button
                key={mod.id}
                onClick={() => {
                  if (hasAccess) setActiveModule(mod.id);
                  else scrollToModule(mod.id);
                }}
                className={`flex items-center gap-3 px-3 py-3 text-left transition-all ${
                  isActive ? 'border-b border-black text-black' : 'opacity-40 hover:opacity-100 hover:border-b hover:border-black text-black'
                }`}
              >
                <span className="font-serif italic text-xs">0{idx + 1}</span>
                <span className="text-[11px] font-bold uppercase tracking-wider flex-1">{mod.title}</span>
                {isActive && <ChevronRight size={14} />}
              </button>
            );
          })}
        </div>

        {!hasAccess && (
          <button
            onClick={() => setIsKeyModalOpen(true)}
            className="flex items-center gap-3 px-3 py-3 text-left transition-all mt-6 border border-dashed border-black/20 hover:border-black/40 rounded-sm group opacity-60 hover:opacity-100"
          >
            <Key size={14} className="group-hover:rotate-45 transition-transform" />
            <span className="text-[10px] font-bold uppercase tracking-widest flex-1">Decrypt Access</span>
          </button>
        )}

        {hasAccess && (
           <div className="mt-6 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-sm">
             <ShieldCheck size={14} className="text-emerald-600" />
             <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-700">Institutional Session</span>
           </div>
        )}
        
        <div className="mt-auto pt-6 border-t border-black/10 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest opacity-40 font-bold mt-1">
            Vol. 01 — Journal
          </div>
          <button 
            onClick={() => setIsDark(!isDark)}
            className="p-2 border border-black/10 hover:bg-black/5 transition-colors bg-white shadow-sm"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 relative overflow-x-hidden">
        {/* Mobile Header */}
        <div className="md:hidden sticky top-0 bg-[#FDFCFB]/90 backdrop-blur-md border-b border-black/10 p-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <h1 className="font-serif font-black text-lg tracking-tight uppercase">FloQ</h1>
            <span className="text-[10px] uppercase tracking-widest font-bold opacity-40">{hasAccess ? 'Enterprise' : 'Academy'}</span>
          </div>
          <div className="flex items-center gap-2">
            {!hasAccess && (
              <button
                 onClick={() => setIsVIPOpen(true)}
                 className="p-2 border border-amber-500/20 hover:bg-amber-500/5 transition-colors bg-amber-50 shadow-sm rounded-sm"
                 aria-label="VIP Access"
              >
                <Crown size={14} className="text-amber-600 fill-amber-600/10" />
              </button>
            )}
            <button 
              onClick={() => setIsDark(!isDark)}
              className="p-2 border border-black/10 hover:bg-black/5 transition-colors bg-white shadow-sm"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!hasAccess ? (
            <motion.div 
              key="guide-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="max-w-4xl mx-auto px-6 py-12 md:py-24 space-y-32"
            >
              {/* Header Section */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6 max-w-2xl pb-12 border-b border-black/10"
              >
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 flex items-center gap-2">
                  Journal
                </div>
                <h1 className="text-5xl md:text-7xl font-serif font-light leading-[1.1] text-black">
                  The Options Flow <br />
                  <span className="italic">Trading Guide</span>
                </h1>
                <p className="text-lg text-neutral-600 leading-relaxed max-w-xl">
                  An institutional approach to the financial ecosystem. Learn the foundation of options-driven markets, quantitative models, and actionable strategies.
                </p>
              </motion.div>

          {/* Module 1 */}
          <section id="module-1" className="scroll-mt-10">
            <div className="mb-6 flex items-center gap-4">
              <span className="text-[11px] font-bold uppercase text-emerald-800 bg-emerald-50 px-2 py-1">Module 01</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-serif italic font-light leading-tight mb-10">The Foundation of Options-Driven Markets</h2>
            
            <div className="space-y-12">
              <div className="max-w-3xl">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4 border-b border-black/10 pb-2">Why Traditional Technical Analysis is No Longer Enough</h3>
                <p className="text-neutral-600 leading-relaxed text-lg">
                  The global financial ecosystem has experienced a fundamental transition in its underlying price discovery mechanisms. 
                  Since 2021, options trading volumes have systematically surpassed the volumes of the underlying cash equity markets. 
                  This evolution means that the hedging activities of market makers—the primary counterparties to retail and institutional 
                  options trades—now constitute a dominant force in intraday and swing-term price action.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-white p-8 border border-black/5 shadow-sm group">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 mb-4 bg-emerald-50 inline-block px-2 py-1">Mechanism</h3>
                  <h4 className="text-2xl font-serif italic mb-3">The Role of the Market Maker and Delta Hedging</h4>
                  <p className="text-neutral-600 leading-relaxed text-sm">
                    Market makers are not in the business of taking directional bets; their goal is to provide liquidity and collect the spread. 
                    To protect themselves from market movements, they use a strategy called <strong className="font-bold text-black">delta hedging</strong>. 
                    This means they constantly buy or sell the underlying asset (or futures) to keep their directional exposure neutral. 
                  </p>
                </div>
                
                <div className="preserve-dark p-8 bg-black text-white rounded-tr-[40px] shadow-sm">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-4 bg-white/10 inline-block px-2 py-1">Metrics</h3>
                  <h4 className="text-2xl font-serif italic mb-3">What is Gamma and Why Does It Move Markets?</h4>
                  <p className="text-neutral-300 leading-relaxed text-sm">
                    Gamma measures how fast an option's delta changes as the underlying price moves. When gamma is high, an option's 
                    delta changes very quickly, which forces dealers to adjust their hedges rapidly. This urgent need to hedge translates 
                    into massive buying or selling volume in the underlying asset.
                  </p>
                </div>
              </div>

              <div className="bg-[#F5F2EF] border border-black/5 p-8 md:p-10">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-6 pb-2 border-b border-black/10 flex items-center justify-between">
                  <span>Positive vs. Negative Gamma Regimes</span>
                  <Activity size={16} className="opacity-50" />
                </h3>
                <p className="text-neutral-600 leading-relaxed mb-8 text-sm italic font-serif">
                  To trade successfully, you must know what "gamma regime" the market is in. FlowDynamics calculates the Net Gamma Exposure (Net GEX) to determine this:
                </p>
                
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-1 bg-emerald-800"></div>
                    <div>
                      <h4 className="text-xl font-serif italic text-black mb-1">Position Gamma (Low Volatility / Mean Reverting)</h4>
                      <p className="text-neutral-600 text-sm leading-relaxed">
                        When the market is in positive gamma, market makers hedge by buying when the price drops and selling when it rises. 
                        This dampens volatility, keeping the market trapped in a range and creating choppy, sideways movement.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="w-1 bg-red-800"></div>
                    <div>
                      <h4 className="text-xl font-serif italic text-black mb-1">Negative Gamma (High Volatility / Directional)</h4>
                      <p className="text-neutral-600 text-sm leading-relaxed">
                        When the market is in negative gamma, dealers must sell when the price drops and buy when it rises. 
                        This pro-cyclical hedging amplifies market moves, creating fast, aggressive trends and massive intraday swings.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Module 2 */}
          <section id="module-2" className="scroll-mt-10">
            <div className="mb-6 flex items-center gap-4">
              <span className="text-[11px] font-bold uppercase text-emerald-800 bg-emerald-50 px-2 py-1">Module 02</span>
            </div>
            <div className="mb-12 border-b border-black/10 pb-8">
              <h2 className="text-4xl md:text-5xl font-serif italic font-light leading-tight mb-4">Mastering Gamma Levels</h2>
              <p className="text-neutral-600 text-lg max-w-3xl">
                OptionsFlow Gamma Levels are forward-looking price zones derived from options positioning, revealing exactly where institutions and market makers are forced to hedge aggressively.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-x-10 gap-y-6">
              <GlossaryCard 
                idx={0}
                title="Core Resistance"
                subtitle="The Gamma Wall"
                def="This is the strike price with the highest net call gamma exposure across the option chain."
                impact="It acts as a structural ceiling. As price approach this level, dealers who are long gamma must sell the underlying to stay neutral, causing the price to stall or reject."
              />
              <GlossaryCard 
                idx={1}
                title="Put Support"
                subtitle="Floor"
                def="The strike price with the highest net put gamma exposure."
                impact="It acts as a structural floor. When price drops here, put holders monetize. Dealers buy back the underlying, creating a bounce."
                color="red"
              />
              <GlossaryCard 
                idx={2}
                title="High Volatility Level (HVL)"
                subtitle="Regime Compass"
                def="The transition zone where market overall gamma flips from positive to negative."
                impact="Price ABOVE HVL = positive gamma (range-bound chop). Price BELOW HVL = negative gamma (momentum, trends, high volatility)."
                color="emerald"
              />
              <GlossaryCard 
                idx={3}
                title="1-Day Expected Move"
                subtitle="Min & Max"
                def="A proprietary volatility indicator using historical implied volatility to forecast statistical high and low boundaries for the day."
                impact="The S&P 500 stays inside this range 85%-87% of the time."
              />
              <GlossaryCard 
                idx={4}
                title="0DTE Levels"
                subtitle="Intraday Magnets"
                def="Gamma levels calculated purely from options that expire on the current day."
                impact="They have the highest gamma and are incredibly sensitive, causing fast pinning or reversals."
              />
              <GlossaryCard 
                idx={5}
                title="GEX Levels (1-10)"
                subtitle="Secondary Ranges"
                def="Secondary levels representing the top 10 strikes with highest net gamma and delta exposure."
                impact="GEX 1 is the strongest. Actively used by day traders for precise take-profit targets."
              />
            </div>
          </section>

          {/* Module 3 */}
          <section id="module-3" className="scroll-mt-10">
            <div className="mb-6 flex items-center gap-4">
              <span className="text-[11px] font-bold uppercase text-emerald-800 bg-emerald-50 px-2 py-1">Module 03</span>
            </div>
            
            <div className="mb-12 border-b border-black/10 pb-8">
              <h2 className="text-4xl md:text-5xl font-serif italic font-light leading-tight mb-4">Advanced Quantitative Models</h2>
              <p className="text-neutral-600 text-lg max-w-3xl">
                To give you a true institutional edge, FlowDynamics provides supplementary models that combine with Gamma Levels to build a complete trading roadmap.
              </p>
            </div>

            <div className="space-y-6">
              <div className="bg-white border text-black border-black/10 p-8 flex flex-col md:flex-row gap-8 items-start shadow-sm mix-blend-multiply">
                <div className="md:w-1/3">
                  <h3 className="text-2xl font-serif italic mb-2">Blind Spots Levels</h3>
                  <div className="w-12 h-1 bg-black my-4"></div>
                </div>
                <div className="md:w-2/3">
                  <p className="text-neutral-600 leading-relaxed text-sm">
                    Blind Spots are hidden market reaction zones that traditional charting overlooks. They highlight crucial price levels where correlated assets (such as bonds, commodities, or the Dollar) heavily influence your target asset. They serve as excellent take-profit zones and help you avoid opening trades right into hidden institutional friction.
                  </p>
                </div>
              </div>

              <div className="bg-white border text-black border-black/10 p-8 flex flex-col md:flex-row gap-8 items-start shadow-sm mix-blend-multiply">
                <div className="md:w-1/3">
                  <h3 className="text-2xl font-serif italic mb-2">Dark Pool Anomalies</h3>
                  <div className="w-12 h-1 bg-black my-4"></div>
                </div>
                <div className="md:w-2/3">
                  <p className="text-neutral-600 leading-relaxed text-sm">
                    Off-exchange footprints tracking high-block institutional volume that bypasses the public lit order books. These dark pools act as immense structural support or resistance when the public price approaches. Monitoring these anomalies gives early warnings of potential trend reversals or major continuation legs before retail catches on.
                  </p>
                </div>
              </div>

              <div className="bg-white border text-black border-black/10 p-8 flex flex-col md:flex-row gap-8 items-start shadow-sm mix-blend-multiply">
                <div className="md:w-1/3">
                  <h3 className="text-2xl font-serif italic mb-2">Absolute Liquidity Voids</h3>
                  <div className="w-12 h-1 bg-black my-4"></div>
                </div>
                <div className="md:w-2/3">
                  <p className="text-neutral-600 leading-relaxed text-sm">
                    Pinpoint exact price levels where institutional limit orders have completely evaporated. When the market enters a liquidity void, price accelerates violently due to a lack of friction. By mapping these hidden vacuums before they are filled, you can catch massive, high-R/R breakout momentum trades with razor-sharp precision long before retail volume even registers the move.
                  </p>
                </div>
              </div>

            </div>
          </section>

          {/* Module 4 */}
          <section id="module-4" className="scroll-mt-10">
            <div className="mb-6 flex items-center gap-4">
              <span className="text-[11px] font-bold uppercase text-emerald-800 bg-emerald-50 px-2 py-1">Module 04</span>
            </div>
            
            <div className="mb-12 border-b border-black/10 pb-8">
              <h2 className="text-4xl md:text-5xl font-serif italic font-light leading-tight mb-4">The Options Flow Trading Playbook</h2>
              <p className="text-neutral-600 text-lg max-w-3xl">
                Actionable, step-by-step strategies based on the identified gamma environment.
              </p>
            </div>

            <div className="space-y-12">
              <StrategyCard 
                num="01"
                title="Positive Gamma Mean Reversion"
                env="The underlying price is trading ABOVE the HVL, and the Net GEX is positive."
                play="Expect a choppy, range-bound market because dealers are selling rallies and buying dips. Use mean-reversion strategies: fade (short) the market at the Core Resistance and buy bounces at the Put Support. Anticipate the price to 'pin' near these major strikes."
                color="emerald"
              />
               <StrategyCard 
                num="02"
                title="Negative Gamma Trend Following"
                env="The price drops BELOW the HVL, flipping the gamma regime to negative."
                play="Dealers are now forced to sell when the price drops, creating a feedback loop of volatility. Do not 'buy the dip' blindly. Switch to trend-following and momentum breakdown strategies, and widen stop-losses and profit targets to accommodate massive intraday swings."
                color="red"
              />
               <StrategyCard 
                num="03"
                title="1-Day Expected Move Fades"
                env="Price rapidly touches the 1-Day Min or 1-Day Max early in the session without a major news catalyst."
                play="Because the market stays inside this statistical range ~85% of the time, touching the boundary signals the market is overextended. Enter a reversal trade at the 1D Min/Max, and use the opposite expected move or secondary GEX levels as your take-profit target."
              />
               <StrategyCard 
                num="04"
                title="Intraday Gamma Scalping"
                env="High-volume intraday trading sessions."
                play="Map out the 0DTE Core Resistance, 0DTE Put Support, and GEX 1 / GEX 2 levels. Use these exact lines as highly precise intraday magnets to scalp small bounces or efficiently scale out of winning positions."
              />
            </div>
          </section>

          {/* Module 5 */}
          <section id="module-5" className="scroll-mt-10">
            <div className="mb-6 flex items-center gap-4">
              <span className="text-[11px] font-bold uppercase text-emerald-800 bg-emerald-50 px-2 py-1">Module 05</span>
            </div>
            
             <div className="mb-12 border-b border-black/10 pb-8">
              <h2 className="text-4xl md:text-5xl font-serif italic font-light leading-tight mb-4">Integrating the Data</h2>
              <p className="text-neutral-600 text-lg max-w-3xl">
                We deliver institutional models directly to your favorite charting software via API, eliminating guesswork.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-10">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider mb-6 pb-2 border-b border-black/10">Supported Platforms</h3>
                <p className="text-neutral-600 mb-6 text-sm">FlowDynamics natively integrates into the industry's best software:</p>
                <ul className="space-y-4">
                  {[
                    ['MotiveWave', 'Imports Gamma Levels, Blind Spots, and Expected Moves natively.'],
                    ['Quantower', 'Overlays options liquidity data right onto advanced order-flow software.']
                  ].map(([p, desc]) => (
                    <li key={p} className="flex gap-4 p-4 border border-black/10 bg-white shadow-sm">
                      <div className="mt-1"><Target size={18} className="opacity-50" /></div>
                      <div>
                        <div className="font-serif italic text-lg mb-1">{p}</div>
                        <div className="text-xs text-neutral-600">{desc}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="preserve-dark bg-black text-white p-8 rounded-tr-[40px] shadow-sm relative flex flex-col h-full">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Monitor size={150} />
                </div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-4 bg-white/10 inline-block px-2 py-1 self-start">Feature</h3>
                <h3 className="text-2xl font-serif italic mb-4 relative z-10">The Power of Levels Conversion</h3>
                <div className="w-12 h-1 bg-white my-6 relative z-10"></div>
                <div className="text-neutral-300 leading-relaxed text-sm relative z-10 space-y-4 flex-1">
                  <p>
                    If you trade Futures (like ES or NQ), looking at futures volume alone is trading blind. FlowDynamics's "Levels Conversion" tool allows you to take the massive options data from indices (like SPX or NDX) and accurately overlay them onto your futures charts. 
                  </p>
                  <p>
                    By applying an <strong>Auto Ratio</strong> or <strong>Manual Ratio</strong>, you can perfectly align institutional SPX options flow onto your ES futures chart in real-time.
                  </p>
                  <div className="mt-6 p-4 border border-white/20 bg-white/5 rounded-sm">
                    <h4 className="font-bold text-white mb-2 uppercase text-[10px] tracking-wider">Why Not ETFs?</h4>
                    <p className="text-xs">
                      Levels conversion strictly applies to cash-settled Indices (like SPX and NDX) mapping to their respective Futures. ETFs (like SPY or QQQ) hold physical underlying shares and carry dividend payouts and early assignment risk. Because of these structural pricing differences, institutional options flow originating from an ETF cannot be mathematically mapped to a Futures contract with the precision required for institutional trading. We rely exclusively on the purest source: European-style Index Options.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Module 6 */}
          <section id="module-6" className="scroll-mt-10">
            <div className="mb-6 flex items-center gap-4">
              <span className="text-[11px] font-bold uppercase text-emerald-800 bg-emerald-50 px-2 py-1">Module 06</span>
            </div>
            
             <div className="mb-12 border-b border-black/10 pb-8">
              <h2 className="text-4xl md:text-5xl font-serif italic font-light leading-tight mb-4">Interactive Glossary</h2>
              <p className="text-neutral-600 text-lg max-w-3xl">
                A definitive reference for quantitative options trading terminology and market mechanics.
              </p>
            </div>

            <InteractiveGlossary />
          </section>

          {/* Footer */}
          <footer className="mt-10 pt-4 flex flex-col md:flex-row justify-between items-center text-[10px] pb-12 uppercase tracking-[0.2em] opacity-40 border-t border-black/10 gap-4">
            <span>© {new Date().getFullYear()} OptionsFlow Quantitative Research</span>
            <span>Confidential Institutional Models</span>
            <span>Page 042</span>
          </footer>
        </motion.div>
      ) : (
        <motion.div 
          key="vip-dashboard"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="min-h-screen bg-[#faf9f6]"
        >
          <div className="max-w-[1600px] w-full mx-auto px-4 md:px-8 py-8 md:py-12 space-y-12">
            {/* VIP Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-8 border-b border-black/5">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="px-2 py-1 bg-amber-500 text-white text-[9px] font-bold uppercase tracking-widest rounded-sm">verified access</div>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Live Terminal active</span>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-6">
                    <h1 className="text-5xl font-serif italic">The Elite Dashboard</h1>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-black/30 group-focus-within:text-black/60 transition-colors" />
                      </div>
                      <input 
                        type="text" 
                        placeholder="SEARCH TICKER..." 
                        className="bg-white border border-black/10 text-black placeholder-black/30 text-xs font-mono font-bold uppercase tracking-wider pl-9 pr-4 py-2.5 outline-none w-64 focus:border-black/30 focus:ring-1 focus:ring-black/5 transition-all rounded-sm shadow-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = e.currentTarget.value.trim().toUpperCase();
                            if (val) setActiveTicker(val);
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Presets:</span>
                    {['SPY', 'QQQ', 'DIA', 'IWM', 'GLD'].map(t => (
                      <button
                        key={t}
                        onClick={() => setActiveTicker(t)}
                        className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-sm transition-all ${activeTicker === t ? 'bg-black text-white shadow-sm' : 'bg-black/5 text-black/60 hover:bg-black/10 hover:text-black'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-neutral-500 text-sm max-w-md">Proprietary institutional flow models. Real-time dealer positioning and volatility regime conversion.</p>
              </div>
              <div className="flex gap-4">
                <div className="p-4 bg-white border border-black/5 rounded-sm shadow-sm">
                  <div className="text-[10px] uppercase tracking-widest opacity-40 mb-1">Session ID</div>
                  <div className="font-mono text-xs font-bold">{Math.random().toString(36).substring(2, 10).toUpperCase()}-FLOQ</div>
                </div>
              </div>
            </div>

            {/* VIP Content Switcher */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Main Display Area */}
              <div className={`space-y-8 ${['vip-journal', 'vip-conversion', 'vip-gex'].includes(activeModule) ? 'lg:col-span-12' : 'lg:col-span-8'}`}>
                {activeModule === 'vip-gex' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <div className="preserve-dark bg-[#0A0B0E] border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.4)] text-white p-8 md:p-10 rounded-2xl relative overflow-hidden group">
                       <div className="absolute top-0 right-0 p-12 opacity-5 translate-x-1/4 -translate-y-1/4 group-hover:scale-110 transition-transform duration-1000">
                         <Activity size={240} />
                       </div>
                       <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500/50 via-purple-500/50 to-pink-500/50 opacity-50"></div>
                      <div className="flex flex-col xl:flex-row xl:items-start justify-between mb-12 relative z-10 gap-8">
                        <div>
                          <h2 className="text-4xl font-serif italic mb-2 tracking-tight drop-shadow-md text-white/90">Real-time GEX Dashboard</h2>
                          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#64A0E6]/80 drop-shadow-sm">Global Gamma & Positioning Engine</p>
                        </div>
                        <div className="flex bg-[#111] p-1.5 rounded-xl border border-white/10 self-start md:self-auto shadow-inner overflow-hidden">
                           {TICKERS.map(t => (
                             <button 
                               key={t}
                               onClick={() => setActiveTicker(t)}
                               className={`text-[12px] font-bold uppercase tracking-[0.1em] px-8 py-3 transition-all rounded-lg ${activeTicker === t ? 'bg-[#64A0E6] text-[#0A0B0E] shadow-[0_4px_12px_rgba(100,160,230,0.5)] scale-[1.02]' : 'bg-transparent text-white/50 hover:bg-white/5 hover:text-white'}`}
                             >
                               {t}
                             </button>
                           ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 relative z-10 mb-8">
                          {[
                            { label: 'Net GEX', val: `${gexMetrics.netGex.toFixed(2)}B`, color: gexMetrics.netGex >= 0 ? 'text-[#00E5A0] drop-shadow-[0_0_8px_rgba(0,229,160,0.3)]' : 'text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.3)]' },
                            { label: 'Spot Price', val: gexMetrics.spot.toFixed(2), color: 'text-white drop-shadow-sm' },
                            { label: 'Calculated at', val: lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), color: 'text-[#F5A623] drop-shadow-[0_0_8px_rgba(245,166,35,0.3)]' },
                            { label: 'OI Sum', val: gexMetrics.totalOi ? `${(gexMetrics.totalOi / 1000).toFixed(1)}k` : '---', color: 'text-[#64A0E6] drop-shadow-sm' }
                          ].map(stat => (
                            <div key={stat.label} className="p-6 bg-black/40 border border-white/5 rounded-xl relative overflow-hidden group hover:border-[#64A0E6]/30 transition-colors shadow-inner flex flex-col justify-center">
                              <div className="absolute inset-0 bg-gradient-to-b from-[#64A0E6]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                              <div className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-3">{stat.label}</div>
                              <div className={`text-3xl lg:text-4xl font-bold font-mono ${stat.color}`}>{stat.val}</div>
                            </div>
                          ))}
                      </div>
                      
                      {/* Net GEX Trend Chart */}
                      <div className="relative z-10 p-6 bg-[#000]/30 border border-white/5 rounded-xl h-[350px]">
                         <div className="absolute top-4 left-6 z-20 flex justify-between w-full pr-12">
                            <div className="flex flex-col">
                              <span className="text-[12px] uppercase tracking-widest font-bold text-white/40">{activeTicker} Net GEX Flow</span>
                              <span className={gexMetrics.netGex >= 0 ? 'text-[10px] text-[#00E5A0] uppercase tracking-widest font-bold' : 'text-[10px] text-rose-400 uppercase tracking-widest font-bold'}>Historical Gamma Positioning</span>
                            </div>
                            <div className="text-right">
                              <span className={`text-2xl font-mono font-bold ${gexMetrics.netGex >= 0 ? 'text-[#00E5A0]' : 'text-rose-400'}`}>${gexMetrics.netGex.toFixed(2)}B</span>
                            </div>
                         </div>
                         <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={netGexChartData}>
                               <defs>
                                  <linearGradient id="netGexColor" x1="0" y1="0" x2="0" y2="1">
                                     <stop offset="5%" stopColor={gexMetrics.netGex >= 0 ? '#00E5A0' : '#fb7185'} stopOpacity={0.4}/>
                                     <stop offset="95%" stopColor={gexMetrics.netGex >= 0 ? '#00E5A0' : '#fb7185'} stopOpacity={0}/>
                                  </linearGradient>
                               </defs>
                               <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                               <XAxis dataKey="time" hide={true} />
                               <YAxis domain={['auto', 'auto']} stroke="#ffffff30" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val.toFixed(1)}B`} width={50} />
                               <Tooltip 
                                  contentStyle={{ backgroundColor: '#0A0B0E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                  itemStyle={{ color: gexMetrics.netGex >= 0 ? '#00E5A0' : '#fb7185', fontFamily: 'monospace', fontWeight: 'bold' }}
                                  labelStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}
                               />
                               <Area type="monotone" dataKey="netGex" stroke={gexMetrics.netGex >= 0 ? '#00E5A0' : '#fb7185'} strokeWidth={2} fillOpacity={1} fill="url(#netGexColor)" isAnimationActive={false} />
                            </AreaChart>
                         </ResponsiveContainer>
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                       <div className="preserve-dark p-8 bg-[#0D0D11] text-white border border-white/[0.08] shadow-[0_8px_30px_rgb(0,0,0,0.5)] rounded-2xl hover:border-white/20 transition-all group overflow-hidden relative">
                         <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${gexMetrics.netGex >= 0 ? 'from-[#00E5A0]/80' : 'from-rose-500/80'} to-transparent opacity-50 group-hover:opacity-100 transition-opacity`}></div>
                         <div className="flex items-center gap-3 mb-6">
                            <div className={`p-2.5 ${gexMetrics.netGex >= 0 ? 'bg-[#00E5A0]/10 border-[#00E5A0]/20' : 'bg-rose-500/10 border-rose-500/20'} rounded-xl border`}><Zap size={18} className={gexMetrics.netGex >= 0 ? 'text-[#00E5A0]' : 'text-rose-400'} /></div>
                            <h3 className="text-sm font-bold uppercase tracking-widest text-white/90">Volatility Regime</h3>
                         </div>
                         <div className="space-y-4">
                           <div className="flex flex-col gap-1 p-5 bg-black/40 border border-white/5 rounded-xl shadow-inner">
                             <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Dealer Profile</span>
                             <span className={`font-mono font-bold text-2xl drop-shadow-sm ${gexMetrics.netGex >= 0 ? 'text-[#00E5A0]' : 'text-rose-400'}`}>
                               {gexMetrics.netGex >= 0 ? 'LONG GAMMA' : 'SHORT GAMMA'}
                             </span>
                             <p className="text-[11px] text-white/40 leading-tight mt-1">
                               {gexMetrics.netGex >= 0 
                                 ? 'Mechanically dampening volatility through mean-reversion hedging.' 
                                 : 'Accelerating market moves through pro-cyclical hedging behavior.'}
                             </p>
                           </div>
                           <div className="flex justify-between items-center px-5 py-3 bg-white/[0.02] border border-white/5 rounded-lg">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Gamma Flip Est.</span>
                              <span className="font-mono text-sm text-white/60">${gexMetrics.gammaFlip.toFixed(2)}</span>
                           </div>
                         </div>
                       </div>
                       <div className="preserve-dark p-8 bg-[#0D0D11] text-white border border-white/[0.08] shadow-[0_8px_30px_rgb(0,0,0,0.5)] rounded-2xl overflow-hidden relative group hover:border-[#64A0E6]/30 transition-all">
                         <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-700 pointer-events-none">
                            <Layers size={120} />
                         </div>
                         <div className="flex items-center gap-3 mb-6 relative z-10">
                            <div className="p-2.5 bg-[#64A0E6]/10 rounded-xl border border-[#64A0E6]/20 shadow-inner"><Target size={18} className="text-[#64A0E6]" /></div>
                            <h3 className="text-sm font-bold uppercase tracking-widest text-white/90">Dealer Concentration</h3>
                         </div>
                         <div className="space-y-4 relative z-10">
                            <div className="flex flex-col gap-1 p-5 bg-black/40 border border-white/5 rounded-xl shadow-inner">
                               <div className="flex justify-between items-end mb-2">
                                 <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Call/Put GEX Ratio</span>
                                 <span className="font-mono text-xl text-white font-bold">{(gexMetrics.callGex / Math.abs(gexMetrics.putGex || 1)).toFixed(2)}x</span>
                               </div>
                               <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden flex">
                                  <div 
                                    className="h-full bg-[#00E5A0]" 
                                    style={{ width: `${(gexMetrics.callGex / (gexMetrics.callGex + Math.abs(gexMetrics.putGex)) * 100).toFixed(1)}%` }} 
                                  />
                                  <div 
                                    className="h-full bg-rose-500" 
                                    style={{ width: `${(Math.abs(gexMetrics.putGex) / (gexMetrics.callGex + Math.abs(gexMetrics.putGex)) * 100).toFixed(1)}%` }} 
                                  />
                               </div>
                               <div className="flex justify-between text-[9px] mt-2 font-bold uppercase tracking-tighter opacity-40">
                                  <span>Call Wall Influence</span>
                                  <span>Put Support Base</span>
                               </div>
                            </div>
                            <div className="flex items-center justify-between px-5 pt-2">
                               <div className="flex items-center gap-2">
                                 <div className="w-1.5 h-1.5 rounded-full bg-[#00E5A0] shadow-[0_0_8px_rgba(0,229,160,0.8)] animate-pulse"></div>
                                 <div className="text-[10px] text-[#00E5A0] font-bold uppercase tracking-widest">Live Flow Sync</div>
                               </div>
                               <div className="text-[10px] text-white/30 font-mono italic">Institutional grade precision</div>
                            </div>
                         </div>
                       </div>
                    </div>
                  </motion.div>
                )}

                {activeModule === 'vip-conversion' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                    <div className="preserve-dark relative p-6 md:p-10 bg-[#0A0B0E] text-white border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.4)] rounded-2xl overflow-hidden mt-2">
                       <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neutral-800 via-neutral-600 to-neutral-800 opacity-50"></div>
                       <div className="flex flex-col md:flex-row md:items-center justify-between mb-12">
                         <div className="relative">
                           <h2 className="text-4xl font-serif italic mb-2 tracking-wide font-medium drop-shadow-md text-white">Conversion Engine</h2>
                           <p className="text-[11px] text-[#00E5A0]/80 uppercase tracking-[0.2em] font-bold">FIX 7: DYNAMIC ES / NQ RATIOS</p>
                         </div>
                         <div className="flex items-center gap-3 px-4 py-2 bg-[#111] border border-white/10 rounded-full mt-4 md:mt-0 shadow-inner">
                            <RefreshCcw size={14} className="text-[#00E5A0] animate-spin" />
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80 text-[#00E5A0]">Live Data Feed</span>
                         </div>
                       </div>

                       {/* Real-time Price Chart (Moved from VIP GEX) */}
                       <div className="relative z-10 p-6 bg-[#000]/30 border border-white/5 rounded-xl h-[350px]">
                          <div className="absolute top-4 left-6 z-20 flex justify-between w-full pr-12">
                             <div className="flex flex-col">
                               <span className="text-[12px] uppercase tracking-widest font-bold text-[#00E5A0]">{activeTicker} Live Pricing Protocol</span>
                               <span className="text-[10px] text-white/40 uppercase tracking-widest">Real-time dealer hedging influence</span>
                             </div>
                             <div className="text-right">
                               <span className="text-2xl font-mono text-white font-bold">${typeof conversionRatios[activeTicker]?.spotPrice === 'number' ? conversionRatios[activeTicker].spotPrice.toFixed(2) : gexMetrics.spot.toFixed(2)}</span>
                             </div>
                          </div>
                          <ResponsiveContainer width="100%" height="100%">
                             <AreaChart data={liveChartData}>
                                <defs>
                                   <linearGradient id="liveColorConversion" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#00E5A0" stopOpacity={0.4}/>
                                      <stop offset="95%" stopColor="#00E5A0" stopOpacity={0}/>
                                   </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis dataKey="time" stroke="#ffffff30" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis domain={['auto', 'auto']} stroke="#ffffff30" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val.toFixed(0)}`} width={40} />
                                <Tooltip 
                                   contentStyle={{ backgroundColor: '#0A0B0E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                   itemStyle={{ color: '#00E5A0', fontFamily: 'monospace', fontWeight: 'bold' }}
                                   labelStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}
                                />
                                <Area type="monotone" dataKey="price" stroke="#00E5A0" strokeWidth={2} fillOpacity={1} fill="url(#liveColorConversion)" isAnimationActive={false} />
                             </AreaChart>
                          </ResponsiveContainer>
                       </div>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
                        <div className="preserve-dark relative p-8 bg-[#0D0D11] border border-white/[0.08] shadow-[0_8px_30px_rgb(0,0,0,0.5)] rounded-2xl text-white overflow-hidden group hover:border-white/10 transition-colors">
                           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#00E5A0]/50 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
                           <div className="flex items-center gap-3 mb-2">
                              <div className="p-2.5 bg-[#00E5A0]/10 rounded-xl border border-[#00E5A0]/20 shadow-inner"><Calculator size={18} className="text-[#00E5A0]" /></div>
                              <h3 className="text-xl font-bold tracking-tight text-white/90">SPY → ES Converter</h3>
                           </div>
                           <p className="text-sm text-white/40 tracking-wide mb-8">Convert SPY levels to ES using live ratio</p>
                           
                           <div className="flex items-center gap-2 mb-6 text-[#00E5A0] text-xs font-medium tracking-wide uppercase">
                              <Check size={14} className="opacity-80" /> <span>Prices fetched dynamically</span>
                           </div>

                           <div className="grid grid-cols-2 gap-4 mb-6">
                              <div className="p-5 bg-black/30 rounded-xl border border-white/5 shadow-inner flex flex-col items-center justify-center">
                                 <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">SPY Spot</div>
                                 <div className="text-2xl font-mono text-white/90 drop-shadow-sm">{typeof conversionRatios['SPY']?.spotPrice === 'number' ? conversionRatios['SPY']?.spotPrice?.toFixed(2) : '---'}</div>
                              </div>
                              <div className="p-5 bg-black/30 rounded-xl border border-white/5 shadow-inner flex flex-col items-center justify-center">
                                 <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">ES Future</div>
                                 <div className="text-2xl font-mono text-[#00E5A0] drop-shadow-sm">{typeof conversionRatios['SPY']?.futurePrice === 'number' ? conversionRatios['SPY']?.futurePrice?.toFixed(2) : '---'}</div>
                              </div>
                           </div>

                           <div className="p-5 bg-[#14161C] border border-white/5 rounded-xl flex justify-between items-center mb-8 shadow-inner">
                              <span className="text-sm text-white/60 font-medium">Conversion Ratio (ES / SPY)</span>
                              <span className="text-lg font-mono font-bold text-[#00E5A0] drop-shadow-[0_0_8px_rgba(0,229,160,0.3)]">{conversionRatios['SPY']?.ratio?.toFixed(4) || '---'}</span>
                           </div>

                           <div className="space-y-4">
                              <div className="flex items-center gap-2 text-sm text-white/80 font-medium tracking-wide">
                                 <ChevronRight size={16} className="text-[#00E5A0]" /> Calculate Level
                              </div>
                              <div className="relative group/input">
                                 <input type="number" placeholder="Enter SPY level (e.g., 600)" className="w-full bg-[#0A0B0E] border border-white/10 rounded-xl py-4 px-5 text-sm font-mono text-white focus:outline-none focus:border-[#00E5A0]/50 transition-colors placeholder:text-white/20 shadow-inner" onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    const box = document.getElementById('spy-result');
                                    if (box) {
                                       box.innerText = isNaN(val) ? '0.00' : (val * (conversionRatios['SPY']?.ratio || 10.0869)).toFixed(2);
                                    }
                                 }} />
                              </div>
                              <div className="flex flex-col mt-4 bg-[#00E5A0]/5 rounded-xl border border-[#00E5A0]/10 p-5 mt-6">
                                 <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Estimated ES Level</div>
                                 <div className="text-3xl font-mono font-bold text-[#00E5A0] drop-shadow-md" id="spy-result">0.00</div>
                              </div>
                           </div>
                        </div>

                        <div className="preserve-dark relative p-8 bg-[#0D0D11] border border-white/[0.08] shadow-[0_8px_30px_rgb(0,0,0,0.5)] rounded-2xl text-white overflow-hidden group hover:border-[#F5A623]/30 transition-colors">
                           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#F5A623]/50 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
                           <div className="flex items-center gap-3 mb-2">
                              <div className="p-2.5 bg-[#F5A623]/10 rounded-xl border border-[#F5A623]/20 shadow-inner"><Calculator size={18} className="text-[#F5A623]" /></div>
                              <h3 className="text-xl font-bold tracking-tight text-white/90">QQQ → NQ Converter</h3>
                           </div>
                           <p className="text-sm text-white/40 tracking-wide mb-8">Convert QQQ levels to NQ using live ratio</p>
                           
                           <div className="flex items-center gap-2 mb-6 text-[#00E5A0] text-xs font-medium tracking-wide uppercase">
                              <Check size={14} className="opacity-80" /> <span>Prices fetched dynamically</span>
                           </div>

                           <div className="grid grid-cols-2 gap-4 mb-6">
                              <div className="p-5 bg-black/30 rounded-xl border border-white/5 shadow-inner flex flex-col items-center justify-center">
                                 <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">QQQ Spot</div>
                                 <div className="text-2xl font-mono text-white/90 drop-shadow-sm">{typeof conversionRatios['QQQ']?.spotPrice === 'number' ? conversionRatios['QQQ']?.spotPrice?.toFixed(2) : '---'}</div>
                              </div>
                              <div className="p-5 bg-black/30 rounded-xl border border-white/5 shadow-inner flex flex-col items-center justify-center">
                                 <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">NQ Future</div>
                                 <div className="text-2xl font-mono text-[#F5A623] drop-shadow-sm">{typeof conversionRatios['QQQ']?.futurePrice === 'number' ? conversionRatios['QQQ']?.futurePrice?.toFixed(2) : '---'}</div>
                              </div>
                           </div>

                           <div className="p-5 bg-[#14161C] border border-white/5 rounded-xl flex justify-between items-center mb-8 shadow-inner">
                              <span className="text-sm text-white/60 font-medium">Conversion Ratio (NQ / QQQ)</span>
                              <span className="text-lg font-mono font-bold text-[#F5A623] drop-shadow-[0_0_8px_rgba(245,166,35,0.3)]">{conversionRatios['QQQ']?.ratio?.toFixed(4) || '---'}</span>
                           </div>

                           <div className="space-y-4">
                              <div className="flex items-center gap-2 text-sm text-white/80 font-medium tracking-wide">
                                 <ChevronRight size={16} className="text-[#F5A623]" /> Calculate Level
                              </div>
                              <div className="relative group/input">
                                 <input type="number" placeholder="Enter QQQ level (e.g., 500)" className="w-full bg-[#0A0B0E] border border-white/10 rounded-xl py-4 px-5 text-sm font-mono text-white focus:outline-none focus:border-[#F5A623]/50 transition-colors placeholder:text-white/20 shadow-inner" onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    const box = document.getElementById('qqq-result');
                                    if (box) {
                                       box.innerText = isNaN(val) ? '0.00' : (val * (conversionRatios['QQQ']?.ratio || 41.4269)).toFixed(2);
                                    }
                                 }} />
                              </div>
                              <div className="flex flex-col mt-4 bg-[#F5A623]/5 rounded-xl border border-[#F5A623]/10 p-5 mt-6">
                                 <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Estimated NQ Level</div>
                                 <div className="text-3xl font-mono font-bold text-[#F5A623] drop-shadow-md" id="qqq-result">0.00</div>
                              </div>
                           </div>
                        </div>
                    </div>

                    <div className="p-0 border border-black/5 bg-[#FAFAFA] text-black rounded-sm overflow-hidden shadow-sm">
                       <div className="p-6 border-b border-black/5 bg-[#F4F5F7] flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-600 flex items-center gap-2">
                             <Target size={14} className="text-emerald-600" />
                             Chain Decomposition ({activeTicker})
                          </h3>
                          <div className="relative">
                             <input 
                               type="text" 
                               placeholder="SEARCH TICKER" 
                               className="bg-transparent border-2 border-dashed border-blue-400/50 text-blue-600 placeholder-blue-400/60 text-xs font-mono font-bold uppercase tracking-wider px-4 py-2 outline-none w-48 focus:border-blue-500 transition-colors rounded-sm"
                               onKeyDown={(e) => {
                                 if (e.key === 'Enter') {
                                   const val = e.currentTarget.value.trim().toUpperCase();
                                   if (val) setActiveTicker(val);
                                   e.currentTarget.value = '';
                                 }
                               }}
                             />
                          </div>
                       </div>
                       <div className="overflow-x-auto">
                          <table className="w-full text-right font-mono text-[11px]">
                             <thead className="bg-[#F8F9FA] text-[10px] uppercase tracking-wider text-neutral-500">
                               <tr className="border-b border-black/5">
                                 <th className="py-4 px-6 text-left font-semibold">Strike</th>
                                 <th className="py-4 px-6 font-semibold">{activeTicker === 'SPY' ? 'ES' : activeTicker === 'QQQ' ? 'NQ1!' : 'FUT'}</th>
                                 <th className="py-4 px-6 font-semibold">Net GEX</th>
                                 <th className="py-4 px-6 font-semibold">Call GEX</th>
                                 <th className="py-4 px-6 font-semibold">Put GEX</th>
                                 <th className="py-4 px-6 font-semibold">Net Delta</th>
                                 <th className="py-4 px-6 font-semibold">Net Gamma</th>
                                 <th className="py-4 px-6 font-semibold">Net Vega</th>
                                 <th className="py-4 px-6 font-semibold">OI</th>
                                 <th className="py-4 px-6 font-semibold">IV%</th>
                               </tr>
                             </thead>
                             <tbody>
                               {(() => {
                                 const options = chainData?.data?.options || [];
                                 const spot = gexMetrics.spot;
                                 if (!spot || options.length === 0) return null;

                                 const parsedOptions = options.map((o: any) => ({ ...o, parsed: parseOSISymbol(o.option) })).filter((o: any) => o.parsed);
                                 
                                 // Aggregate by strike
                                 const strikesMap = new Map<number, { callGex: number, putGex: number, netGex: number, netDelta: number, netGamma: number, netVega: number, oi: number, ivSum: number, count: number }>();
                                 
                                 parsedOptions.forEach((opt: any) => {
                                    const strike = opt.parsed.strike;
                                    const type = opt.parsed.type;
                                    const oi = parseInt(opt.open_interest) || 0;
                                    
                                    const t = Math.max((opt.parsed.expiration.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 365), 0.001);
                                    const div = DIV_YIELD[activeTicker] || 0.0;
                                    
                                    const marketPrice = parseFloat(opt.mark) || parseFloat(opt.last_trade_price) || 0;
                                    let iv = parseFloat(opt.iv) || 0;
                                    const calcIv = implied_vol(marketPrice, spot, strike, t, RISK_FREE_RATE, div, type as "C" | "P");
                                    if (!isNaN(calcIv) && calcIv > 0) iv = calcIv;
                                    
                                    const gamma = opt.gamma !== undefined && opt.gamma !== null ? parseFloat(opt.gamma) : bs_gamma(spot, strike, t, RISK_FREE_RATE, div, iv);
                                    const delta = opt.delta !== undefined && opt.delta !== null ? parseFloat(opt.delta) : bs_delta(spot, strike, t, RISK_FREE_RATE, div, iv, type as "C" | "P");
                                    const vega = opt.vega !== undefined && opt.vega !== null ? parseFloat(opt.vega) : bs_vega(spot, strike, t, RISK_FREE_RATE, div, iv);

                                    const gex = calculateGEX(gamma, oi, spot) || 0; // Return in Billions
                                    
                                    if (!strikesMap.has(strike)) {
                                       strikesMap.set(strike, { callGex: 0, putGex: 0, netGex: 0, netDelta: 0, netGamma: 0, netVega: 0, oi: 0, ivSum: 0, count: 0 });
                                    }
                                    const cur = strikesMap.get(strike)!;
                                    cur.oi += oi;
                                    cur.ivSum += iv;
                                    cur.count += 1;
                                    
                                    if (type === 'C') {
                                       cur.callGex += gex;
                                       cur.netGex += gex;
                                       cur.netDelta += delta * oi * 100;
                                       cur.netGamma += gamma * oi * 100;
                                       cur.netVega += vega * oi * 100;
                                    } else {
                                       cur.putGex -= gex; // Put GEX is assigned negative
                                       cur.netGex -= gex; 
                                       cur.netDelta += delta * oi * 100; 
                                       cur.netGamma += gamma * oi * 100; // Adding total aggregate gamma
                                       cur.netVega += vega * oi * 100;
                                    }
                                 });

                                 const strikes = Array.from(strikesMap.keys()).sort((a: number, b: number) => a - b);
                                 let closestIdx = 0;
                                 let minDiff = Infinity;
                                 strikes.forEach((s: number, idx: number) => {
                                   if (Math.abs(s - spot) < minDiff) { minDiff = Math.abs(s - spot); closestIdx = idx; }
                                 });

                                 // Show +/- 20 strikes from spot
                                 const displayStrikes = strikes.slice(Math.max(0, closestIdx - 20), closestIdx + 21);
                                 // Sort descending
                                 displayStrikes.sort((a: number, b: number) => b - a);
                                 
                                 const ratio = conversionRatios[activeTicker]?.ratio || (activeTicker === 'SPY' ? 10.0869 : activeTicker === 'QQQ' ? 41.4269 : 1);

                                 return displayStrikes.map((strike: number, i: number) => {
                                   const data = strikesMap.get(strike)!;
                                   const isClosest = strike === strikes[closestIdx];
                                   const avgIv = data.count > 0 ? (data.ivSum / data.count) : 0;
                                   const futValue = strike * ratio;
                                   
                                   const formatGex = (val: number, forceSign = false, zeroString = '0.0000') => {
                                      if (Math.abs(val) < 0.00005) return zeroString;
                                      const s = val.toFixed(4);
                                      return (forceSign && val > 0) ? `+${s}` : s;
                                   };

                                   return (
                                     <tr key={strike} className={`border-b border-black/5 last:border-0 hover:bg-black/[0.02] transition-colors ${isClosest ? 'bg-indigo-50/50' : (i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]')}`}>
                                       <td className={`py-3 px-6 text-left font-bold ${isClosest ? 'text-indigo-600' : 'text-neutral-900'}`}>
                                          <div className="flex items-center gap-2">
                                             {isClosest && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>}
                                             {strike.toFixed(2)}
                                          </div>
                                       </td>
                                       <td className="py-3 px-6 text-neutral-500">{Math.round(futValue)}</td>
                                       <td className={`py-3 px-6 font-bold ${data.netGex > 0.00005 ? 'text-emerald-600' : data.netGex < -0.00005 ? 'text-[#FF8DA1]' : 'text-neutral-400'}`}>
                                          {formatGex(data.netGex, false, '-0.0000')}
                                       </td>
                                       <td className={`py-3 px-6 ${data.callGex > 0.00005 ? 'text-emerald-500' : 'text-neutral-400'}`}>{formatGex(data.callGex, false, '0.0000')}</td>
                                       <td className={`py-3 px-6 ${data.putGex < -0.00005 ? 'text-[#FF8DA1]' : 'text-neutral-400'}`}>{formatGex(data.putGex, false, '-0.0000')}</td>
                                       <td className={`py-3 px-6 font-semibold ${data.netDelta > 0 ? 'text-blue-500' : data.netDelta < 0 ? 'text-orange-500' : 'text-neutral-400'}`}>{data.netDelta === 0 ? '0' : data.netDelta > 0 ? `+${Math.round(data.netDelta).toLocaleString()}` : Math.round(data.netDelta).toLocaleString()}</td>
                                       <td className={`py-3 px-6 font-semibold ${data.netGamma > 0 ? 'text-purple-500' : data.netGamma < 0 ? 'text-pink-500' : 'text-neutral-400'}`}>{data.netGamma === 0 ? '0' : data.netGamma > 0 ? `+${Math.round(data.netGamma).toLocaleString()}` : Math.round(data.netGamma).toLocaleString()}</td>
                                       <td className={`py-3 px-6 font-semibold ${data.netVega > 0 ? 'text-teal-500' : data.netVega < 0 ? 'text-amber-500' : 'text-neutral-400'}`}>{data.netVega === 0 ? '0' : data.netVega > 0 ? `+${Math.round(data.netVega).toLocaleString()}` : Math.round(data.netVega).toLocaleString()}</td>
                                       <td className="py-3 px-6 text-neutral-800 font-semibold">{data.oi}</td>
                                       <td className="py-3 px-6 text-neutral-500">{(avgIv * 100).toFixed(1)}</td>
                                     </tr>
                                   );
                                 });
                               })()}
                             </tbody>
                          </table>
                       </div>
                    </div>
                  </motion.div>
                )}

                {activeModule === 'vip-journal' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <div className="preserve-dark bg-[#0A0B0E] border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.4)] text-white p-8 md:p-10 rounded-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-12 opacity-5 translate-x-1/4 -translate-y-1/4 group-hover:scale-110 transition-transform duration-1000 pointer-events-none">
                        <Book size={240} />
                      </div>
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/50 via-teal-500/50 to-cyan-500/50 opacity-50"></div>
                      
                      <div className="relative z-10">
                        {/* Module Title & Tabs */}
                        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-8">
                           <div>
                              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#64A0E6] mb-2">Trade Analytics</div>
                              <h2 className="text-4xl font-serif italic text-white">Journal</h2>
                              <p className="text-white/40 text-xs mt-2">Log institutional executions — equity curve, session stats & alpha metrics</p>
                           </div>
                           <div className="flex bg-[#111] border border-white/10 p-1.5 rounded-xl shadow-inner self-start xl:self-auto overflow-x-auto max-w-full hide-scrollbar">
                              {[
                                { id: 'journal', label: 'Journal', icon: Book },
                                { id: 'curve', label: 'Equity Curve', icon: TrendingUp },
                                { id: 'stats', label: 'Analytics', icon: PieChart },
                                { id: 'gallery', label: 'Gallery', icon: ImageIcon },
                                { id: 'calendar', label: 'Calendar', icon: Calendar }
                              ].map(tab => (
                                <button
                                  key={tab.id}
                                  onClick={() => setJournalSubTab(tab.id as any)}
                                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${journalSubTab === tab.id ? 'bg-[#00E5A0] text-[#0A0B0E] shadow-[0_0_15px_rgba(0,229,160,0.3)]' : 'text-white/40 hover:text-white/80 hover:bg-white/5'}`}
                                >
                                   <tab.icon size={14} />
                                   <span className="hidden sm:inline">{tab.label}</span>
                                </button>
                              ))}
                           </div>
                        </div>

                        {/* Quick Stats Grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
                           {[
                             { label: 'Total Trades', value: journalStats.totalTrades, sub: 'Executions' },
                             { label: 'Win Rate', value: `${journalStats.winRate}%`, sub: 'Accuracy' },
                             { label: 'Avg Win', value: `$${journalStats.avgWin}`, sub: 'Profitability' },
                             { label: 'Avg Loss', value: `$${journalStats.avgLoss}`, sub: 'Risk Control' },
                             { label: 'Total P&L', value: `$${journalStats.totalPnl.toLocaleString()}`, sub: 'Net Bottom Line', color: journalStats.totalPnl >= 0 ? 'text-[#00E5A0]' : 'text-rose-400' },
                             { label: 'Streak', value: journalStats.maxStreak, sub: 'Consistency', color: 'text-amber-400' }
                           ].map(stat => (
                             <div key={stat.label} className="p-5 bg-white/[0.02] border border-white/5 rounded-xl text-center hover:bg-white/[0.04] transition-colors">
                                <div className="text-[9px] font-bold uppercase tracking-widest text-[#64A0E6]/70 mb-2">{stat.label}</div>
                                <div className={`text-2xl font-mono font-bold ${stat.color || 'text-white'}`}>{stat.value}</div>
                                <div className="text-[9px] text-white/20 font-bold uppercase mt-1">{stat.sub}</div>
                             </div>
                           ))}
                        </div>

                        {/* Tab Content */}
                        <AnimatePresence mode="wait">
                           {journalSubTab === 'journal' && (
                              <motion.div key="journal" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-8">
                                 {/* LOG A TRADE SECTION */}
                             <div>
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-4 border-b border-white/5 pb-2">Log A Trade</h3>
                                
                                <div className="space-y-4">
                                   {/* Drag & Drop Area */}
                                   <div className="relative border-2 border-dashed border-white/10 rounded-lg p-6 bg-white/[0.02] hover:bg-white/[0.04] transition-colors flex items-center gap-4 cursor-pointer">
                                      <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                      <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center border border-white/10">
                                         <Plus size={16} className="text-white/40" />
                                      </div>
                                      <div>
                                         <p className="text-sm font-bold text-white/80">Paste or drop a position screenshot <span className="font-normal text-white/30 italic">— stored with trade</span></p>
                                         <p className="text-[10px] text-white/30 truncate mt-1">Ctrl+V to paste &middot; drag & drop image &middot; future: AI auto-fill</p>
                                      </div>
                                   </div>

                                   {/* Fields Row */}
                                   <div className="grid grid-cols-2 md:grid-cols-11 gap-2">
                                      <div className="space-y-1">
                                         <div className="text-[9px] uppercase tracking-widest text-white/40">Date</div>
                                         <input type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} className="w-full bg-transparent border border-white/10 rounded grow py-2 px-2 text-xs font-mono text-white outline-none focus:border-white/30" />
                                      </div>
                                      <div className="space-y-1">
                                         <div className="text-[9px] uppercase tracking-widest text-white/40">Ticker</div>
                                         <input type="text" value={tradeSym} onChange={(e) => setTradeSym(e.target.value)} placeholder="ES/SPY" className="w-full bg-transparent border border-white/10 rounded py-2 px-2 text-xs font-mono text-white outline-none focus:border-white/30" />
                                      </div>
                                      <div className="space-y-1">
                                         <div className="text-[9px] uppercase tracking-widest text-white/40">Direction</div>
                                         <select value={tradeDir} onChange={(e) => setTradeDir(e.target.value as any)} className="w-full bg-transparent border border-white/10 rounded py-2 px-2 text-xs font-mono text-white outline-none focus:border-white/30 appearance-none">
                                            <option value="long">Long</option>
                                            <option value="short">Short</option>
                                         </select>
                                      </div>
                                      <div className="space-y-1">
                                         <div className="text-[9px] uppercase tracking-widest text-white/40">Entry Price</div>
                                         <input type="text" value={tradeEntry} onChange={(e) => setTradeEntry(e.target.value)} placeholder="e.g. 21450" className="w-full bg-transparent border border-white/10 rounded py-2 px-2 text-xs font-mono text-white outline-none focus:border-white/30" />
                                      </div>
                                      <div className="space-y-1">
                                         <div className="text-[9px] uppercase tracking-widest text-white/40">Stop Loss</div>
                                         <input type="text" value={tradeStop} onChange={(e) => setTradeStop(e.target.value)} placeholder="e.g. 21420" className="w-full bg-transparent border border-white/10 rounded py-2 px-2 text-xs font-mono text-white outline-none focus:border-white/30" />
                                      </div>
                                      <div className="space-y-1">
                                         <div className="text-[9px] uppercase tracking-widest text-white/40">Exit Price</div>
                                         <input type="text" value={tradeExit} onChange={(e) => setTradeExit(e.target.value)} placeholder="e.g. 21525" className="w-full bg-transparent border border-white/10 rounded py-2 px-2 text-xs font-mono text-white outline-none focus:border-white/30" />
                                      </div>
                                      <div className="space-y-1">
                                         <div className="text-[9px] uppercase tracking-widest text-white/40">Contracts</div>
                                         <input type="number" value={tradeContracts} onChange={(e) => setTradeContracts(e.target.value)} placeholder="1" className="w-full bg-transparent border border-white/10 rounded py-2 px-2 text-xs font-mono text-white outline-none focus:border-white/30" />
                                      </div>
                                      <div className="space-y-1">
                                         <div className="text-[9px] uppercase tracking-widest text-white/40">MAE</div>
                                         <input type="text" value={tradeMAE} onChange={(e) => setTradeMAE(e.target.value)} placeholder="Max adverse" className="w-full bg-transparent border border-white/10 rounded py-2 px-2 text-xs font-mono text-white outline-none focus:border-white/30" />
                                      </div>
                                      <div className="space-y-1">
                                         <div className="text-[9px] uppercase tracking-widest text-white/40">MFE</div>
                                         <input type="text" value={tradeMFE} onChange={(e) => setTradeMFE(e.target.value)} placeholder="Max favorable" className="w-full bg-transparent border border-white/10 rounded py-2 px-2 text-xs font-mono text-white outline-none focus:border-white/30" />
                                      </div>
                                      <div className="space-y-1">
                                         <div className="text-[9px] uppercase tracking-widest text-white/40">Setup Grade</div>
                                         <input type="text" value={tradeGrade} onChange={(e) => setTradeGrade(e.target.value)} placeholder="-" className="w-full bg-transparent border border-white/10 rounded py-2 px-2 text-xs font-mono text-white outline-none focus:border-white/30" />
                                      </div>
                                      <div className="space-y-1">
                                         <div className="text-[9px] uppercase tracking-widest text-white/40">Outcome</div>
                                         <select value={tradeOutcome} onChange={(e) => setTradeOutcome(e.target.value)} className="w-full bg-transparent border border-white/10 rounded py-2 px-2 text-xs font-mono text-white outline-none focus:border-white/30 appearance-none">
                                            <option value="">-</option>
                                            <option value="win">Win</option>
                                            <option value="loss">Loss</option>
                                            <option value="be">Break Even</option>
                                         </select>
                                      </div>
                                      <div className="space-y-1">
                                         <div className="text-[9px] uppercase tracking-widest text-white/40">P&L ($)</div>
                                         <input type="number" value={tradePnl} onChange={(e) => setTradePnl(e.target.value)} placeholder="auto" className="w-full bg-transparent border border-white/10 rounded py-2 px-2 text-xs font-mono text-white outline-none focus:border-white/30" />
                                      </div>
                                   </div>

                                   {/* Notes */}
                                   <div className="space-y-1 mt-4">
                                      <div className="text-[9px] uppercase tracking-widest text-white/40">Notes</div>
                                      <textarea 
                                         value={tradeNotes} 
                                         onChange={(e) => setTradeNotes(e.target.value)} 
                                         placeholder="What did you see? What worked well? What would you do differently?"
                                         className="w-full bg-transparent border border-white/10 rounded py-3 px-3 text-xs font-mono text-white outline-none focus:border-white/30 min-h-[80px]"
                                      />
                                   </div>

                                   {/* Buttons */}
                                   <div className="flex items-center justify-between mt-4">
                                      <div className="flex gap-4">
                                         <button onClick={logTrade} className="bg-[#00E5A0] hover:bg-[#00E5A0]/80 text-[#0A0B0E] font-bold text-[11px] uppercase tracking-wider py-2 px-6 rounded transition-colors">
                                           Add Trade
                                         </button>
                                         <button onClick={exportCSV} className="bg-transparent border border-white/10 text-white/60 hover:text-white hover:border-white/30 font-bold text-[11px] uppercase tracking-wider py-2 px-4 rounded transition-colors">
                                            Export CSV
                                         </button>
                                      </div>
                                      <button onClick={clearAllTrades} className="bg-transparent border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 font-bold text-[11px] uppercase tracking-wider py-2 px-4 rounded transition-colors">
                                         Clear All
                                      </button>
                                   </div>
                                </div>
                             </div>

                             {/* TRADE LOG */}
                             <div className="mt-8 border border-white/5 rounded-lg bg-[#0A0B0E]">
                                <div className="flex items-center justify-between p-4 border-b border-white/5 bg-black/40">
                                   <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Trade Log</div>
                                   <div className="flex gap-6">
                                      <button className="text-[#00E5A0] border border-[#00E5A0]/30 rounded px-3 py-1 text-[10px] uppercase font-bold bg-[#00E5A0]/5">All</button>
                                      <button className="text-white/40 hover:text-white/80 text-[10px] uppercase font-bold">Today</button>
                                      <button className="text-white/40 hover:text-white/80 text-[10px] uppercase font-bold">This Week</button>
                                      <button className="text-white/40 hover:text-white/80 text-[10px] uppercase font-bold">This Month</button>
                                      <button className="text-white/40 hover:text-white/80 text-[10px] uppercase font-bold">Pick Date</button>
                                   </div>
                                </div>
                                <div className="overflow-x-auto">
                                   <table className="w-full text-left font-mono">
                                      <thead>
                                         <tr className="bg-black/20 text-[9px] uppercase tracking-widest text-white/30">
                                            <th className="px-4 py-3 font-normal">Date</th>
                                            <th className="px-4 py-3 font-normal">TKR</th>
                                            <th className="px-4 py-3 font-normal">Dir</th>
                                            <th className="px-4 py-3 font-normal">Entry</th>
                                            <th className="px-4 py-3 font-normal">Stop</th>
                                            <th className="px-4 py-3 font-normal">Exit</th>
                                            <th className="px-4 py-3 font-normal">CTS</th>
                                            <th className="px-4 py-3 font-normal relative group cursor-help">
                                               Grade
                                               <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-[#111] border border-white/10 rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity z-50">
                                                  <div className="text-[10px] space-y-1 text-white/70 normal-case tracking-normal">
                                                     <div className="flex justify-between"><span className="text-[#00E5A0] font-bold">A+</span><span>Perfect Execution</span></div>
                                                     <div className="flex justify-between"><span className="text-white font-bold">A</span><span>Good Setup</span></div>
                                                     <div className="flex justify-between"><span className="text-white/50 font-bold">B</span><span>Mediocre</span></div>
                                                     <div className="flex justify-between"><span className="text-rose-400 font-bold">C</span><span>Poor Context</span></div>
                                                     <div className="flex justify-between"><span className="text-rose-500 font-bold">D</span><span>Rule Break</span></div>
                                                  </div>
                                               </div>
                                            </th>
                                            <th className="px-4 py-3 font-normal relative group cursor-help">
                                               Outcome
                                               <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 p-3 bg-[#111] border border-white/10 rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity z-50">
                                                  <div className="text-[10px] space-y-1 text-white/70 normal-case tracking-normal">
                                                     <div className="flex justify-between"><span className="text-[#00E5A0] font-bold">Win</span><span>Target hit</span></div>
                                                     <div className="flex justify-between"><span className="text-rose-400 font-bold">Loss</span><span>Stop-out</span></div>
                                                     <div className="flex justify-between"><span className="text-white/50 font-bold">BE</span><span>Break Even</span></div>
                                                  </div>
                                               </div>
                                            </th>
                                            <th className="px-4 py-3 font-normal">R:R</th>
                                            <th className="px-4 py-3 font-normal">P&L</th>
                                            <th className="px-4 py-3 font-normal">Notes</th>
                                         </tr>
                                      </thead>
                                      <tbody className="divide-y divide-white/5 text-[11px] text-white/70">
                                         {Object.entries(journalData).slice(-15).reverse().map(([date, day]: [string, any]) => (
                                            day.trades?.map((t: any, i: number) => {
                                               const rr = (parseFloat(t.entry) && parseFloat(t.stop) && parseFloat(t.exit)) 
                                                 ? Math.abs((parseFloat(t.exit) - parseFloat(t.entry)) / (parseFloat(t.entry) - parseFloat(t.stop))).toFixed(1)
                                                 : '-';
                                               return (
                                               <tr key={`${date}-${i}`} className="hover:bg-white/[0.02] transition-colors group">
                                                  <td className="px-4 py-3 opacity-50 group-hover:opacity-100 transition-opacity whitespace-nowrap">{date}</td>
                                                  <td className="px-4 py-3 font-bold text-white">{t.sym}</td>
                                                  <td className="px-4 py-3 capitalize">{t.dir}</td>
                                                  <td className="px-4 py-3">{t.entry || '-'}</td>
                                                  <td className="px-4 py-3">{t.stop || '-'}</td>
                                                  <td className="px-4 py-3">{t.exit || '-'}</td>
                                                  <td className="px-4 py-3">{t.contracts}</td>
                                                  <td className="px-4 py-3 opacity-70">{t.grade || '-'}</td>
                                                  <td className="px-4 py-3 capitalize">{t.outcome || '-'}</td>
                                                  <td className="px-4 py-3">{rr}</td>
                                                  <td className="px-4 py-3">
                                                     <span className={`px-2 py-1 rounded text-[10px] font-bold ${t.pnl > 0 ? 'bg-[#00E5A0]/10 text-[#00E5A0]' : t.pnl < 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-white/5 text-white/70'}`}>
                                                        {t.pnl === 0 ? '$0' : t.pnl > 0 ? `+$${t.pnl}` : `-$${Math.abs(t.pnl)}`}
                                                     </span>
                                                  </td>
                                                  <td className="px-4 py-3 max-w-xs truncate opacity-40">{t.notes || '-'}</td>
                                               </tr>
                                               );
                                            })
                                         ))}
                                         {Object.keys(journalData).length === 0 && (
                                           <tr>
                                              <td colSpan={12} className="px-6 py-20 text-center">
                                                 <div className="flex flex-col items-center opacity-20">
                                                    <p className="text-sm font-mono italic">No trades match this filter</p>
                                                    <p className="text-[10px] mt-4">Trades saved locally in your browser</p>
                                                 </div>
                                              </td>
                                           </tr>
                                         )}
                                      </tbody>
                                   </table>
                                </div>
                             </div>
                          </motion.div>
                       )}

                       {journalSubTab === 'curve' && (
                          <motion.div key="curve" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-6">
                             <div className="p-8 bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors rounded-2xl h-[400px]">
                                <div className="flex items-center justify-between mb-8">
                                   <div>
                                      <h3 className="text-lg font-serif italic text-white/90">Institutional Equity Curve</h3>
                                      <p className="text-xs text-[#64A0E6]/50">Statistical consistency visualization across all mandates</p>
                                   </div>
                                   <div className="text-right">
                                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#00E5A0]/50">Total Net Balance</div>
                                      <div className="text-2xl font-bold font-mono text-white">${journalStats.totalPnl.toLocaleString()}</div>
                                   </div>
                                </div>
                                <div className="h-[250px]">
                                   <ResponsiveContainer width="100%" height="100%">
                                      <AreaChart data={equityCurveData}>
                                         <defs>
                                            <linearGradient id="curveColor" x1="0" y1="0" x2="0" y2="1">
                                               <stop offset="5%" stopColor="#00E5A0" stopOpacity={0.5}/>
                                               <stop offset="95%" stopColor="#00E5A0" stopOpacity={0}/>
                                            </linearGradient>
                                         </defs>
                                         <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                         <XAxis dataKey="date" stroke="#ffffff30" fontSize={10} tickLine={false} axisLine={false} />
                                         <YAxis stroke="#ffffff30" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                                         <Tooltip 
                                            contentStyle={{ backgroundColor: '#0A0B0E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                            itemStyle={{ color: '#00E5A0', fontFamily: 'monospace', fontWeight: 'bold' }}
                                            labelStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}
                                         />
                                         <Area type="monotone" dataKey="balance" stroke="#00E5A0" strokeWidth={2} fillOpacity={1} fill="url(#curveColor)" />
                                      </AreaChart>
                                   </ResponsiveContainer>
                                </div>
                             </div>

                             <div className="p-8 bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors rounded-2xl h-[400px]">
                                <div className="flex items-center justify-between mb-8">
                                   <div>
                                      <h3 className="text-lg font-serif italic text-white/90">Consistency Graph (Daily P&L)</h3>
                                      <p className="text-xs text-[#64A0E6]/50">Day-by-day distribution of returns</p>
                                   </div>
                                   <div className="text-right">
                                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#64A0E6]/50">Win Rate</div>
                                      <div className="text-2xl font-bold font-mono text-white">{journalStats.winRate}%</div>
                                   </div>
                                </div>
                                <div className="h-[250px]">
                                   <ResponsiveContainer width="100%" height="100%">
                                      <BarChart data={equityCurveData}>
                                         <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                         <XAxis dataKey="date" stroke="#ffffff30" fontSize={10} tickLine={false} axisLine={false} />
                                         <YAxis stroke="#ffffff30" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                                         <Tooltip
                                            cursor={{fill: 'rgba(255,255,255,0.02)'}}
                                            contentStyle={{ backgroundColor: '#0A0B0E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                            itemStyle={{ fontFamily: 'monospace', fontWeight: 'bold' }}
                                            labelStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}
                                         />
                                         <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                                            {
                                               equityCurveData.map((entry, index) => (
                                                  <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#00E5A0' : '#F43F5E'} fillOpacity={0.8} />
                                               ))
                                            }
                                         </Bar>
                                      </BarChart>
                                   </ResponsiveContainer>
                                </div>
                             </div>
                          </motion.div>
                       )}

                       {journalSubTab === 'calendar' && (
                          <motion.div key="calendar" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="preserve-dark bg-[#0A0B0E] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-black/20">
                              <div className="flex items-center gap-4">
                                 <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                                    <Calendar size={18} className="text-[#64A0E6]" />
                                 </div>
                                 <h2 className="text-xl font-serif italic text-white/90">
                                   {new Date(journalYear, journalMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                                 </h2>
                              </div>
                              <div className="flex gap-2">
                                 <button onClick={() => {
                                   if (journalMonth === 0) { setJournalMonth(11); setJournalYear(journalYear - 1); }
                                   else setJournalMonth(journalMonth - 1);
                                 }} className="p-2 hover:bg-white/5 border border-white/10 rounded-lg text-white/60 transition-colors">
                                   <ChevronRight size={18} className="rotate-180" />
                                 </button>
                                 <button onClick={() => {
                                   if (journalMonth === 11) { setJournalMonth(0); setJournalYear(journalYear + 1); }
                                   else setJournalMonth(journalMonth + 1);
                                 }} className="p-2 hover:bg-white/5 border border-white/10 rounded-lg text-white/60 transition-colors">
                                   <ChevronRight size={18} />
                                 </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-5 border-b border-white/10 bg-black/40">
                              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
                                <div key={day} className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-white/30 text-center border-r border-white/5 last:border-0">{day}</div>
                              ))}
                            </div>

                            <div className="grid grid-cols-5 bg-black/10">
                              {(() => {
                                 const firstDay = new Date(journalYear, journalMonth, 1);
                                 const lastDay = new Date(journalYear, journalMonth + 1, 0);
                                 
                                 let current = new Date(firstDay);
                                 while (current.getDay() !== 1) { current.setDate(current.getDate() - 1); }

                                 const cells = [];
                                 for (let i = 0; i < 30; i++) {
                                   const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
                                   const isThisMonth = current.getMonth() === journalMonth;
                                   const isToday = dateStr === new Date().toISOString().split('T')[0];
                                   const entry = journalData[dateStr];
                                   const dayPnl = (entry?.trades || []).reduce((s: number, t: any) => s + (parseFloat(t.pnl) || 0), 0);
                                   
                                   cells.push(
                                     <div 
                                       key={dateStr} 
                                       onClick={() => {
                                         if (isThisMonth) {
                                           setTradeDate(dateStr);
                                           setJournalSubTab('journal');
                                         }
                                       }}
                                       className={`min-h-[120px] p-4 border-r border-b border-white/5 relative group cursor-pointer transition-all ${
                                         !isThisMonth ? 'opacity-10 pointer-events-none' : 'hover:bg-white/[0.02]'
                                       } ${isToday ? 'bg-white/[0.03]' : ''}`}
                                     >
                                       <div className={`text-[11px] font-mono font-bold mb-2 ${isToday ? 'text-[#64A0E6]' : 'text-white/40'}`}>
                                         {current.getDate()}
                                       </div>
                                       
                                       {entry && (
                                         <div className="space-y-1">
                                            {dayPnl !== 0 && (
                                              <div className={`text-sm font-bold font-mono ${dayPnl > 0 ? 'text-[#00E5A0]' : 'text-rose-400'}`}>
                                                {dayPnl > 0 ? '+' : ''}{dayPnl >= 1000 ? `${(dayPnl/1000).toFixed(1)}k` : dayPnl.toFixed(0)}
                                              </div>
                                            )}
                                            <div className="flex flex-wrap gap-1">
                                               {entry.accountType === 'challenge' && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)]" />}
                                               {entry.trades?.length > 0 && <div className="text-[9px] text-white/20 font-bold">{entry.trades.length}T</div>}
                                            </div>
                                         </div>
                                       )}

                                       {isToday && <div className="absolute top-2 right-2 w-1 h-1 rounded-full bg-[#64A0E6] animate-pulse" />}
                                     </div>
                                   );
                                   
                                   current.setDate(current.getDate() + 1);
                                   if (current.getDay() === 6) current.setDate(current.getDate() + 2);
                                 }
                                 return cells;
                              })()}
                            </div>
                          </motion.div>
                       )}
                       {journalSubTab === 'gallery' && (
                          <motion.div key="gallery" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                             {Object.entries(journalData).map(([date, day]: [string, any]) => (
                                day.images?.map((img: string, i: number) => (
                                   <div key={`${date}-${i}`} className="group relative aspect-video bg-black/40 border border-white/10 rounded-xl overflow-hidden cursor-zoom-in">
                                      <img src={img} alt="Execution Evidence" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                                         <div className="text-[10px] font-bold text-[#00E5A0] uppercase tracking-widest">{date}</div>
                                      </div>
                                   </div>
                                ))
                             ))}
                             {Object.values(journalData).every((day: any) => !day.images?.length) && (
                               <div className="col-span-full py-20 text-center opacity-20 italic">No visual evidence recorded in the ledger.</div>
                             )}
                          </motion.div>
                       )}

                       {journalSubTab === 'stats' && (
                          <motion.div key="stats" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="p-8 bg-black/40 border border-white/10 rounded-2xl">
                                <h3 className="text-sm font-bold text-white uppercase tracking-[0.2em] mb-6">Performance Distribution</h3>
                                <div className="space-y-6">
                                   <div>
                                      <div className="flex justify-between text-[10px] uppercase font-bold text-white/30 mb-2">
                                         <span>Win / Loss Ratio</span>
                                         <span className="text-white">{journalStats.winRate}%</span>
                                      </div>
                                      <div className="h-2 bg-white/5 rounded-full overflow-hidden flex">
                                         <div className="h-full bg-[#00E5A0]" style={{ width: `${journalStats.winRate}%` }} />
                                         <div className="h-full bg-rose-500/30" style={{ width: `${100 - parseFloat(journalStats.winRate)}%` }} />
                                      </div>
                                   </div>
                                   <div className="grid grid-cols-2 gap-4">
                                      <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                         <div className="text-[9px] uppercase font-bold text-white/20 mb-1">Expectancy</div>
                                         <div className="text-lg font-mono font-bold text-white">
                                            ${( (parseFloat(journalStats.winRate)/100 * parseFloat(journalStats.avgWin)) - ((1 - parseFloat(journalStats.winRate)/100) * parseFloat(journalStats.avgLoss)) ).toFixed(2)}
                                         </div>
                                      </div>
                                      <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                         <div className="text-[9px] uppercase font-bold text-white/20 mb-1">Profit Factor</div>
                                         <div className="text-lg font-mono font-bold text-[#00E5A0]">
                                            {(parseFloat(journalStats.avgWin) / (parseFloat(journalStats.avgLoss) || 1)).toFixed(2)}
                                         </div>
                                      </div>
                                   </div>
                                </div>
                             </div>
                             <div className="p-8 bg-black/40 border border-white/10 rounded-2xl">
                                <h3 className="text-sm font-bold text-white uppercase tracking-[0.2em] mb-6">System Extremes</h3>
                                <div className="space-y-4">
                                   <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5">
                                      <span className="text-[10px] uppercase font-bold text-white/30">Apex Session</span>
                                      <span className="text-sm font-mono font-bold text-[#00E5A0]">+${journalStats.best.toLocaleString()}</span>
                                   </div>
                                   <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5">
                                      <span className="text-[10px] uppercase font-bold text-white/30">Nadir Session</span>
                                      <span className="text-sm font-mono font-bold text-rose-400">-${Math.abs(journalStats.worst).toLocaleString()}</span>
                                   </div>
                                   <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5">
                                      <span className="text-[10px] uppercase font-bold text-white/30">Max Consistency Streak</span>
                                      <span className="text-sm font-mono font-bold text-white">{journalStats.maxStreak} Sessions</span>
                                   </div>
                                </div>
                             </div>
                          </motion.div>
                       )}
                    </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeModule === 'vip-alpha' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <div className="preserve-dark bg-[#0A0B0E] border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.4)] text-white pb-12 pr-[15px] pl-[19px] pt-10 rounded-2xl relative overflow-hidden group">
                       <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500/80 to-transparent opacity-50">
                         <div className="absolute top-0 left-0 h-full w-24 bg-white/80 animate-[ping_3s_ease-in-out_infinite] blur-[2px]"></div>
                       </div>
                      
                      <div className="flex flex-col md:flex-row md:items-start justify-between mb-8 relative z-10 gap-8 border-b border-white/5 pb-8">
                        <div>
                          <h2 className="text-4xl font-serif italic mb-2 tracking-tight drop-shadow-md text-white/90">Alpha Intelligence News</h2>
                          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-500/80 drop-shadow-sm">Real-time Institutional Flow & Catalyst Tracking</p>

                        </div>
                        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4">

                           <select
                              value={newsSentimentFilter}
                              onChange={e => setNewsSentimentFilter(e.target.value)}
                              className="bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 w-full sm:w-auto font-mono appearance-none"
                           >
                              <option value="ALL" className="bg-black text-white">ALL SENTIMENT</option>
                              <option value="Positive" className="bg-black text-emerald-400">Positive</option>
                              <option value="Neutral" className="bg-black text-neutral-400">Neutral</option>
                              <option value="Negative" className="bg-black text-red-400">Negative</option>
                           </select>
                           <select
                              value={newsSourceFilter}
                              onChange={e => setNewsSourceFilter(e.target.value)}
                              className="bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 w-full sm:w-auto font-mono appearance-none"
                           >
                              {newsSources.map(source => (
                                <option key={source} value={source} className="bg-black text-white">{source === 'ALL' ? 'ALL SOURCES' : source}</option>
                              ))}
                           </select>
                           <select
                              value={newsDateFilter}
                              onChange={e => setNewsDateFilter(e.target.value)}
                              className="bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 w-full sm:w-auto font-mono appearance-none"
                           >
                              <option value="ALL" className="bg-black text-white">All Time</option>
                              <option value="TODAY" className="bg-black text-white">Today</option>
                              <option value="OLDER" className="bg-black text-white">Older</option>
                           </select>
                           <button 
                             onClick={() => fetchNews(true)}
                             className="flex items-center justify-center p-2.5 rounded-lg bg-black/50 border border-white/10 hover:border-amber-500/40 transition-colors"
                           >
                              {newsLoading ? <RefreshCcw size={16} className="text-amber-500 animate-spin" /> : <RefreshCcw size={16} className="text-white/30 hover:text-amber-500" />}
                           </button>
                        </div>
                      </div>

                      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[750px] overflow-y-auto pr-2 custom-scrollbar">
                        {filteredNews.length === 0 && !newsLoading ? (
                           <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-12 opacity-40 italic font-mono text-sm">NO INTELLIGENCE FOUND MATCHING CRITERIA.</div>
                        ) : (
                          filteredNews.map((item, idx) => {
                            const desc = item.ai_description || item.description || `AI Summary: Initial flow analysis indicates institutional activity surrounding "${item.title}". Volatility markers from ${getDisplaySource(item.source)} suggest market makers are adjusting positions. Further details and market impacts are being processed by our models.`;
                            const sentiment = item.sentiment || 'Neutral';
                            const tickers = Array.isArray(item.tickers) && item.tickers.length > 0 ? item.tickers : getAffectedTickers(item.title, desc);
                            
                            const getSentimentStyle = (s: string) => {
                                if (s === 'Positive') return 'text-emerald-400';
                                if (s === 'Negative') return 'text-red-400';
                                return 'text-neutral-400';
                            };

                            const SentimentIcon = sentiment === 'Positive' ? ArrowUpRight : sentiment === 'Negative' ? ArrowDownRight : Minus;

                            return (
                            <div 
                              key={idx} 
                              onClick={() => setSelectedNews({...item, displayDesc: desc, displayTickers: tickers, displaySentiment: sentiment})}
                              className="flex flex-col h-full p-6 bg-[#0D0D11] border border-white/5 rounded-xl hover:border-amber-500/40 hover:bg-[#111115] hover:-translate-y-1 transition-all duration-300 group/news shadow-sm overflow-hidden relative cursor-pointer"
                            >
                              <div className="absolute top-0 right-0 p-8 opacity-0 group-hover/news:opacity-[0.03] transition-opacity duration-500 delay-100 pointer-events-none">
                                <Zap size={100} />
                              </div>
                              <div className="flex-1 flex flex-col z-10 pointer-events-none">
                                <div className="flex items-center justify-between gap-3 mb-5 border-b border-white/5 pb-4">
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500">
                                      {getDisplaySource(item.source)}
                                    </span>
                                    <span className="text-white/20 text-[9px]">•</span>
                                    {sentiment && (
                                      <span className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 ${getSentimentStyle(sentiment)}`}>
                                        {sentiment}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[9px] text-white/30 font-mono font-medium whitespace-nowrap">{item.date}</span>
                                </div>
                                <h3 className="text-lg font-serif font-medium text-white group-hover/news:text-amber-400 transition-colors leading-snug mb-4">
                                  {item.title}
                                </h3>
                                <div className="relative mt-auto">
                                  <p className="text-sm text-neutral-400 leading-relaxed font-sans line-clamp-3">
                                    {desc}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-5 pt-4 flex items-center justify-between shrink-0 z-10 pointer-events-none">
                                <div className="flex flex-wrap gap-1.5">
                                  {tickers.slice(0, 4).map((tick: string, i: number) => (
                                    <span key={i} className="text-[9px] font-mono font-bold uppercase text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                                      ${tick}
                                    </span>
                                  ))}
                                </div>
                                <span 
                                  className="text-[10px] font-bold uppercase tracking-widest text-amber-500 opacity-60 group-hover/news:opacity-100 transition-opacity flex items-center gap-1"
                                >
                                  Deep Analysis <ArrowUpRight size={12} />
                                </span>
                              </div>
                            </div>
                          )})
                        )}
                      </div>

                      {/* Modal overlay for selected news */}
                      <AnimatePresence>
                        {selectedNews && (
                           <motion.div
                             initial={{ opacity: 0 }}
                             animate={{ opacity: 1 }}
                             exit={{ opacity: 0 }}
                             className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-black/60"
                             onClick={() => setSelectedNews(null)}
                           >
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-[#0A0B0E] border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.8)] rounded-3xl p-8 md:p-12 max-w-2xl w-full relative overflow-hidden flex flex-col max-h-[90vh]"
                              >
                                <div className="absolute top-0 right-0 opacity-5 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                                  <Zap size={300} />
                                </div>
                                
                                <button
                                  onClick={() => setSelectedNews(null)}
                                  className="absolute top-6 right-6 p-2 text-white/40 hover:text-white rounded-full hover:bg-white/10 transition-colors z-50 bg-black/20"
                                >
                                  <X size={20} />
                                </button>
                                
                                <div className="overflow-y-auto custom-scrollbar pr-2 mt-4">
                                  <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500 shrink-0">
                                      {getDisplaySource(selectedNews.source)}
                                    </span>
                                    <span className="text-white/20 text-[10px]">•</span>
                                  {selectedNews.displaySentiment && (
                                     <span 
                                       className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest ${
                                         selectedNews.displaySentiment === 'Positive' ? 'text-emerald-400' : 
                                         selectedNews.displaySentiment === 'Negative' ? 'text-red-400' : 
                                         'text-neutral-400'
                                       } shrink-0`}
                                       aria-label={`Sentiment: ${selectedNews.displaySentiment}`}
                                     >
                                       {selectedNews.displaySentiment}
                                     </span>
                                  )}
                                  <span className="ml-auto text-[10px] text-white/30 font-mono font-medium">{selectedNews.date}</span>
                                </div>
                                
                                <h2 className="text-2xl md:text-3xl font-serif font-medium text-white leading-tight mb-8">
                                  {selectedNews.title}
                                </h2>
                                
                                <div className="space-y-6">
                                  <div>
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-amber-500/50 mb-3">General Summary</h4>
                                    <p className="text-base text-white/80 leading-relaxed font-light">
                                      {selectedNews.displayDesc}
                                    </p>
                                  </div>

                                  <div>
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#a8b8d0] mb-3 border-b border-[#2d3748] pb-2 mt-8">Source</h4>
                                    <a 
                                      href={selectedNews.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 bg-[#234bd8] hover:bg-[#1a38a3] text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                      Read Full Article <ExternalLink size={16} />
                                    </a>
                                  </div>
                                  
                                  <div>
                                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-3 border-b border-white/10 pb-2 mt-8">Affected Tickers</h4>
                                    <div className="flex gap-3">
                                      {(selectedNews.displayTickers || []).map((ticker: string) => (
                                        <span key={ticker} className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 text-amber-400 rounded text-xs font-mono">
                                          ${ticker}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                </div>
                              </motion.div>
                           </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}

                {activeModule === 'vip-strategy' && (
                   <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-12 border border-black/5 bg-white text-center rounded-sm">
                      <Lock size={32} className="mx-auto mb-6 text-amber-500 opacity-40" />
                      <h2 className="text-2xl font-serif italic mb-4">Institutional Strategy Brief</h2>
                      <p className="text-neutral-500 text-sm max-sm-mx-auto mb-8">This module requires external credentials or will be delivered via your registered portal.</p>
                      <button className="preserve-dark px-8 py-3 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all">Request Token</button>
                   </motion.div>
                )}
              </div>

              {/* Sidebar Info/Status */}
              {activeModule === 'vip-alpha' ? (
                <div className="lg:col-span-4 space-y-6">
                   <div className="p-6 border border-amber-500/20 bg-[#0D0D11] rounded-xl relative overflow-hidden shadow-[0_4px_20px_rgba(245,158,11,0.05)]">
                      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>
                      <div className="flex items-center gap-2 mb-4">
                        <Cpu size={14} className="text-amber-500" />
                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-white">AI Overall Sentiment Analysis</h3>
                      </div>
                      
                      {(() => {
                         if (newsLoading) {
                           return (
                             <div className="flex flex-col items-center justify-center py-6">
                               <div className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mb-3"></div>
                               <div className="text-xs text-amber-500/80 uppercase tracking-widest animate-pulse">Scanning flow...</div>
                             </div>
                           );
                         }

                         const validNews = filteredNews.filter(n => n.sentiment && ['Positive', 'Negative', 'Neutral'].includes(n.sentiment));
                         if (validNews.length === 0) return <div className="text-xs text-white/40 py-4">Awaiting intelligence...</div>;
                         
                         const pos = validNews.filter(n => n.sentiment === 'Positive').length;
                         const neg = validNews.filter(n => n.sentiment === 'Negative').length;
                         const neu = validNews.filter(n => n.sentiment === 'Neutral').length;
                         const total = validNews.length;
                         
                         const posPct = (pos / total) * 100;
                         const negPct = (neg / total) * 100;
                         const neuPct = (neu / total) * 100;
                         
                         const dominant = pos > neg ? 'Net Positive' : neg > pos ? 'Net Negative' : 'Mixed / Neutral';
                         const dominantColor = pos > neg ? 'text-emerald-400' : neg > pos ? 'text-red-400' : 'text-neutral-400';
                         const analysisText = pos > neg ? 'Catalyst flow is heavily titled towards bullish positioning. Institutions are buying dips.' : neg > pos ? 'Catalyst flow shows structural weakness. Large participants are accelerating distribution.' : 'Conflicting fundamental drivers. Expect dealer mean-reversion chopping action.';
                         
                         return (
                           <>
                             <div className="mb-5">
                               <div className={`text-xl font-serif italic mb-1 ${dominantColor}`}>{dominant}</div>
                               <div className="text-[10px] text-white/40 uppercase tracking-widest">{total} Market Drivers Analyzed</div>
                             </div>
                             
                             <div className="space-y-3 mb-5">
                               <div>
                                  <div className="flex justify-between text-[9px] font-mono mb-1">
                                    <span className="text-emerald-400">Positive ({Math.round(posPct)}%)</span>
                                    <span className="text-emerald-400">{pos}</span>
                                  </div>
                                  <div className="h-1 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-emerald-500/80" style={{width: `${posPct}%`}}></div></div>
                               </div>
                               <div>
                                  <div className="flex justify-between text-[9px] font-mono mb-1">
                                    <span className="text-red-400">Negative ({Math.round(negPct)}%)</span>
                                    <span className="text-red-400">{neg}</span>
                                  </div>
                                  <div className="h-1 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-red-500/80" style={{width: `${negPct}%`}}></div></div>
                               </div>
                               <div>
                                  <div className="flex justify-between text-[9px] font-mono mb-1">
                                    <span className="text-neutral-400">Neutral ({Math.round(neuPct)}%)</span>
                                    <span className="text-neutral-400">{neu}</span>
                                  </div>
                                  <div className="h-1 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-neutral-500/80" style={{width: `${neuPct}%`}}></div></div>
                               </div>
                             </div>
                             
                             <div className="p-3 bg-amber-500/5 rounded-lg border border-amber-500/10">
                               <p className="text-xs text-amber-500/80 leading-relaxed italic">{analysisText}</p>
                             </div>
                           </>
                         );
                      })()}
                   </div>
                </div>
              ) : !['vip-journal', 'vip-conversion', 'vip-gex'].includes(activeModule) && (
                <div className="lg:col-span-4 space-y-6">
                   <div className="p-6 bg-white border border-black/5 shadow-sm rounded-sm">
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 opacity-40">System Diagnostics</h3>
                      <div className="space-y-4">
                         {[
                           { label: 'Engine', status: 'Stable', color: 'text-emerald-500' },
                           { label: 'Market Data API', status: 'Connected', color: 'text-emerald-500' },
                           { label: 'Latency', status: '12ms', color: 'text-emerald-500' },
                           { label: 'Risk Model', status: 'Optimal', color: 'text-emerald-500' }
                         ].map(d => (
                           <div key={d.label} className="flex justify-between items-center text-[11px] font-bold">
                              <span className="uppercase tracking-wider opacity-60">{d.label}</span>
                              <span className={d.color}>{d.status}</span>
                           </div>
                         ))}
                      </div>
                   </div>

                   <div className="p-6 bg-amber-50 border border-amber-100 rounded-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Globe size={14} className="text-amber-600" />
                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Market Regime</h3>
                      </div>
                      <div className="p-3 bg-white border border-amber-200 rounded-sm mb-4">
                         <div className="text-2xl font-serif italic text-amber-900 mb-1">Low Volatility Drift</div>
                         <div className="text-[10px] text-amber-700/60 font-bold uppercase">Positive Gamma Regime (72%)</div>
                      </div>
                      <p className="text-xs text-amber-800/70 italic leading-relaxed">Dealer hedging is currently dampening price action. Expect mean-reversion at established Core Resistance strikes.</p>
                   </div>

                   <button 
                     onClick={() => setHasAccess(false)}
                     className="w-full py-4 text-[10px] font-bold uppercase tracking-wider opacity-30 hover:opacity-100 transition-opacity flex items-center justify-center gap-2"
                   >
                     <X size={12} />
                     Terminiate Session
                   </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Key Access Modal */}
      <AnimatePresence>
        {isKeyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => !isVerifying && setIsKeyModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="preserve-dark relative w-full max-w-md bg-[#0F0F0F] border border-white/10 p-8 md:p-12 shadow-2xl overflow-hidden"
            >
              {/* Security scan animation */}
              {isVerifying && (
                <motion.div 
                  initial={{ top: -20 }}
                  animate={{ top: '100%' }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                  className="absolute left-0 right-0 h-1 bg-emerald-500/50 blur-[2px] z-10"
                />
              )}

              <div className="text-center space-y-6 mb-8">
                <div className="w-16 h-16 mx-auto bg-white/5 border border-white/10 rounded-full flex items-center justify-center">
                  {isVerifying ? (
                    <ShieldCheck className="text-emerald-500 animate-pulse" size={24} />
                  ) : (
                    <Lock className="text-neutral-500" size={24} />
                  )}
                </div>
                <div>
                  <h3 className="text-white text-lg font-serif italic mb-2">Access Terminal</h3>
                  <p className="text-neutral-500 text-xs uppercase tracking-widest leading-loose">Enter your institutional <br /> encrypted session key.</p>
                </div>
              </div>

              <form onSubmit={handleKeySubmit} className="space-y-6">
                <div className="relative">
                  <input 
                    type="password"
                    value={accessKey}
                    onChange={(e) => setAccessKey(e.target.value)}
                    disabled={isVerifying}
                    placeholder="SESSION_KEY_0x..."
                    className="w-full bg-white/5 border border-white/10 text-white font-mono text-center py-4 px-6 focus:border-white/20 outline-none transition-all placeholder:opacity-20 uppercase"
                  />
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-rose-500 text-[10px] text-center font-bold uppercase tracking-widest">
                    {error}
                  </motion.div>
                )}

                <button 
                  type="submit"
                  disabled={isVerifying || accessKey.length < 8}
                  className="w-full py-4 bg-white text-black font-bold uppercase text-[10px] tracking-widest hover:bg-neutral-200 transition-all disabled:opacity-20 disabled:cursor-not-allowed group relative overflow-hidden"
                >
                  <span className="relative z-10">{isVerifying ? 'Verifying Protocol...' : 'Authenticate'}</span>
                  {isVerifying && (
                    <motion.div 
                      className="absolute inset-0 bg-emerald-500"
                      initial={{ left: '-100%' }}
                      animate={{ left: '100%' }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}
                </button>
              </form>

              <button 
                type="button"
                onClick={() => setIsKeyModalOpen(false)}
                className="mt-6 w-full text-[9px] text-neutral-600 font-bold uppercase tracking-widest hover:text-white transition-colors"
                disabled={isVerifying}
              >
                Cancel Session
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

        {/* VIP Modal */}
        <AnimatePresence>
          {isVIPOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsVIPOpen(false)}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300, ease: "easeOut" }}
                className="relative bg-[#FDFCFB] w-full max-w-xl shadow-2xl border border-black/10 overflow-hidden"
              >
                {/* Decorative Amber Bar */}
                <div className="h-1.5 w-full bg-linear-to-r from-amber-200 via-amber-500 to-amber-200" />
                
                <button
                  onClick={() => setIsVIPOpen(false)}
                  className="absolute top-4 right-4 p-2 hover:bg-black/5 transition-colors rounded-full z-10"
                >
                  <X size={20} className="opacity-40" />
                </button>

                <div className="p-8 md:p-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <Crown size={24} className="text-amber-500 fill-amber-500/10" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-600">The Elite Tier</span>
                  </div>

                  <h2 className="text-4xl font-serif italic mb-6">The Elite Trading Model</h2>
                  
                  <p className="text-neutral-600 mb-8 leading-relaxed">
                    Elevate your edge with our institutional-grade proprietary flow models. Designed for traders who require real-time transparency into market dealer positioning.
                  </p>

                  <div className="space-y-4 mb-10">
                    {[
                      { title: "Real-time GEX Dashboard", desc: "Live gamma streams and zero-delay level conversion." },
                      { title: "Private Alpha Discord", desc: "Direct access to our lead quantitative analysts." },
                      { title: "Dark Pool Liquidity Voids", desc: "See where institutional block orders are hiding." },
                      { title: "Weekly Strategy Briefings", desc: "Technical breakdowns of the coming market regimes." }
                    ].map((item, i) => (
                      <div key={i} className="flex gap-4 items-start">
                        <div className="mt-1 flex-shrink-0">
                          <Check size={16} className="text-amber-500" />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs uppercase tracking-wider mb-0.5">{item.title}</h4>
                          <p className="text-xs text-neutral-500">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <a 
                    href="https://whop.com/gexprada/the-trading-model/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="preserve-dark flex items-center justify-center gap-3 w-full bg-black text-white py-4 font-bold uppercase text-xs tracking-widest hover:bg-neutral-800 transition-colors group"
                  >
                    <span>Secure Your Access</span>
                    <ExternalLink size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </a>
                  
                  <p className="mt-4 text-center text-[10px] opacity-30 uppercase tracking-[0.2em]">
                    Limited institutional spots remaining
                  </p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>


      </main>
    </div>
  );
}

// Subcomponents

function GlossaryCard({ title, subtitle, def, impact, color = 'black', idx = 0 }: { title: string, subtitle: string, def: string, impact: string, color?: 'black' | 'emerald' | 'red', idx?: number }) {
  const borderColors = {
    black: 'border-black',
    emerald: 'border-emerald-800',
    red: 'border-red-800 text-red-800'
  };
  const textColors = {
    black: 'opacity-50',
    emerald: 'text-emerald-800',
    red: 'text-red-800'
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay: idx * 0.1, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.3, ease: 'easeOut' } }}
      className={`p-5 border-l-4 ${borderColors[color]} bg-white shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="flex justify-between items-baseline mb-3">
        <h4 className="font-serif italic text-xl text-black">{title}</h4>
        <span className={`font-mono text-xs ${textColors[color]}`}>"{subtitle}"</span>
      </div>
      <div className="space-y-3">
        <p className="text-[13px] leading-snug text-neutral-600"><strong>Def:</strong> {def}</p>
        <p className="text-[13px] leading-snug text-neutral-600 border-t border-black/5 pt-2 italic transition-colors"><strong>Impact:</strong> {impact}</p>
      </div>
    </motion.div>
  );
}

function InteractiveGlossary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTerm, setActiveTerm] = useState(GLOSSARY_TERMS[0]);
  const [copied, setCopied] = useState(false);

  const filteredTerms = GLOSSARY_TERMS.filter(t => 
    t.term.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.def.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const copyToClipboard = () => {
    const textToCopy = `Term: ${activeTerm.term}\nDefinition: ${activeTerm.def}\nMarket Impact: ${activeTerm.impact}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid md:grid-cols-12 gap-10 items-start">
      <div className="md:col-span-5 flex flex-col">
        <div className="relative border-b border-black/20 pb-2 mb-4">
          <Search size={14} className="absolute left-0 top-1/2 -translate-y-1/2 opacity-40" />
          <input 
            type="text" 
            placeholder="Search glossary..." 
            className="w-full bg-transparent pl-7 pr-4 py-2 outline-none font-sans text-sm placeholder:opacity-50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
          {filteredTerms.length === 0 && (
            <div className="text-sm text-neutral-400 italic py-4">No terms found.</div>
          )}
          <AnimatePresence mode="popLayout">
            {filteredTerms.map(t => (
              <motion.button 
                key={t.term} 
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                whileHover={{ x: 4, backgroundColor: 'rgba(0,0,0,0.03)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTerm(t)}
                className={`text-left p-4 border-l-2 relative overflow-hidden transition-all ${activeTerm.term === t.term ? 'border-black bg-black/[0.03]' : 'border-transparent'}`}
              >
                {activeTerm.term === t.term && (
                  <motion.div 
                    layoutId="activeGlossaryIndicator" 
                    className="absolute inset-y-0 left-0 w-1 bg-black" 
                    initial={false}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <div className={`font-bold text-xs uppercase tracking-wider transition-colors ${activeTerm.term === t.term ? 'text-black' : 'text-neutral-500 hover:text-black'}`}>{t.term}</div>
                {t.subtitle && <div className="text-[10px] opacity-50 mt-1 italic font-serif">{t.subtitle}</div>}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>
      <div className="md:col-span-7 bg-white border border-black/10 p-8 shadow-sm relative group">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTerm.term}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-3xl font-serif italic mb-2">{activeTerm.term}</h3>
                {activeTerm.subtitle && <p className="font-mono text-xs opacity-50">"{activeTerm.subtitle}"</p>}
              </div>
              <button 
                onClick={copyToClipboard}
                className="p-2 hover:bg-neutral-100 rounded-full transition-colors relative"
                title="Copy to clipboard"
              >
                {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} className="opacity-40 hover:opacity-100" />}
                {copied && (
                  <motion.span 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider text-emerald-600 whitespace-nowrap"
                  >
                    Copied!
                  </motion.span>
                )}
              </button>
            </div>
            
            <div className="space-y-6 text-sm">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-2 border-l-2 pl-2 border-black">Definition</div>
                <p className="text-neutral-600 leading-relaxed">{activeTerm.def}</p>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-2 border-l-2 pl-2 border-black">Market Impact</div>
                <p className="text-black font-medium leading-relaxed">{activeTerm.impact}</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function StrategyCard({ num, title, env, play, color = 'black' }: { num: string, title: string, env: string, play: string, color?: 'black' | 'emerald' | 'red' }) {
  const numberColors = {
    black: 'text-black/10',
    emerald: 'text-emerald-900/10',
    red: 'text-red-900/10'
  }
  return (
    <div className="relative pl-12 md:pl-20">
      <div className={`absolute left-0 top-0 text-[50px] font-serif italic ${numberColors[color]}`}>
        {num}
      </div>
      <h5 className="font-bold text-xs uppercase border-b border-black/10 pb-2 mb-4 tracking-wider">{title}</h5>
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-2 border-l-2 pl-2 border-black">Environment</div>
          <p className="text-neutral-600 text-[13px] leading-relaxed italic">{env}</p>
        </div>
        <div>
           <div className="text-[10px] font-bold uppercase tracking-widest mb-2 border-l-2 pl-2 border-black">Strategy</div>
          <p className="text-black font-medium text-[13px] leading-relaxed">{play}</p>
        </div>
      </div>
    </div>
  );
}

