import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell } from 'recharts';
import { Layers, Activity, Crosshair, Map as MapIcon, Monitor, ChevronRight, ChevronDown, BarChart2, Zap, BrainCircuit, Target, Book, Search, Sun, Moon, Copy, Check, Crown, X, ExternalLink, Key, Lock, ShieldCheck, TrendingUp, Terminal, Globe, Calculator, Cpu, RefreshCcw, ArrowUpRight, ArrowDownRight, LayoutGrid, PieChart, Image as ImageIcon, Calendar, Plus, Minus, Trash2, LogOut, LogIn, User as UserIcon, Maximize2, Info } from 'lucide-react';
import { TradingViewWidget } from './components/TradingViewWidget';
import { BeautifulChart } from './components/BeautifulChart';
import { GexDashboard } from './components/GexDashboard';
import { GexRadarPremium } from './components/GexRadarPremium';
import { BlackScholesCalculator } from './components/BlackScholesCalculator';
import { MacroNexus } from './components/MacroNexus';
import { GammaGauge } from './components/GammaGauge';
import { HedgingAnimation } from './components/HedgingAnimation';
import { THEMES } from './themes';

import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, User } from './lib/firebase';
import { bsPrice, bsDelta, bsGamma, bsVega, impliedVol } from './lib/blackScholes';

const RISK_FREE_RATE = 0.043;
const DIV_YIELD: Record<string, number> = {
  "SPY": 0.013, "QQQ": 0.006, "IWM": 0.012,
  "SPX": 0.013, "NDX": 0.006, "DIA": 0.015, "GLD": 0.0,
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
  { id: 'vip-gex-premium', title: 'GexRadar Premium', icon: Crown },
  { id: 'vip-gex', title: 'Live GEX Dashboard', icon: Activity },
  { id: 'vip-blackscholes', title: 'Black-Scholes Calculator', icon: Calculator },
  { id: 'vip-conversion', title: 'Conversion Engine', icon: Cpu },
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

type StrategyStep = {
  id: string;
  title: string;
  content: string;
  image?: string;
  metrics?: { label: string, value: string }[];
};

type InstitutionalStrategy = {
  id: string;
  title: string;
  description: string;
  category: string;
  steps: StrategyStep[];
  updatedAt: string;
};


export default function App() {
  // View Transition Helper
  const transition = (fn: () => void) => {
    if (document.startViewTransition) {
      document.startViewTransition(fn);
    } else {
      fn();
    }
  };

  const [activeModule, setActiveModule] = useState(() => {
    return localStorage.getItem('floq_active_module') || 'module-1';
  });
  const [activeTheme, setActiveTheme] = useState(() => {
    return localStorage.getItem('floq_active_theme') || 'premium';
  });

  const isDarkTheme = activeTheme !== 'light';

  useEffect(() => {
    localStorage.setItem('floq_active_module', activeModule);
  }, [activeModule]);

  useEffect(() => {
    localStorage.setItem('floq_active_theme', activeTheme);
    document.documentElement.setAttribute('data-theme', activeTheme);
  }, [activeTheme]);

  const handleSetModule = (modId: string) => {
    transition(() => setActiveModule(modId));
  };

  const handleSetActiveTheme = (themeId: string) => {
    transition(() => setActiveTheme(themeId));
  };

  const [isVIPOpen, setIsVIPOpen] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login failed:", err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Key Access State
  const [hasAccess, setHasAccess] = useState(() => {
    return localStorage.getItem('floq_has_access') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('floq_has_access', hasAccess.toString());
  }, [hasAccess]);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");
  const [isPlaybookEditor, setIsPlaybookEditor] = useState(false);

  // Live Data State
  const [chainData, setChainData] = useState<any>(null);
  const [conversionRatios, setConversionRatios] = useState<Record<string, any>>({});
  const [isLoadingLive, setIsLoadingLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [activeTicker, setActiveTicker] = useState(() => {
    return localStorage.getItem('floq_active_ticker') || 'SPY';
  });

  useEffect(() => {
    localStorage.setItem('floq_active_ticker', activeTicker);
  }, [activeTicker]);
  // Institutional Playbook State
  const [strategies, setStrategies] = useState<InstitutionalStrategy[]>([]);
  const [activeStrategyId, setActiveStrategyId] = useState<string | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const stepContentRef = useRef<HTMLDivElement>(null);
  const activePhaseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeModule === 'vip-strategy' && stepContentRef.current) {
      stepContentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeStepIndex, activeStrategyId, activeModule]);

  useEffect(() => {
    if (activePhaseRef.current) {
      activePhaseRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeStepIndex]);
  const [isStrategyEditorOpen, setIsStrategyEditorOpen] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<InstitutionalStrategy | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('floq_strategies_v1');
    if (saved) {
      try {
        setStrategies(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load strategies", e);
      }
    } else {
      // Default institutional strategy
      const defaultStrategies: InstitutionalStrategy[] = [
        {
          id: 'strat-1',
          title: 'Premium Neutralization',
          description: 'Institutional delta-neutral positioning during high-gamma regimes.',
          category: 'Gamma Management',
          updatedAt: new Date().toISOString(),
          steps: [
            {
              id: 'step-1',
              title: 'Identify the Gamma Regime',
              content: 'First, scan the GEX dashboard for positive gamma concentration across major strikes. We look for Put Support to be significantly higher than current spot.',
              metrics: [
                { label: 'Net GEX', value: '> 2.5B' },
                { label: 'Regime', value: 'Positive Gamma' }
              ]
            },
            {
              id: 'step-2',
              title: 'Locate Dealer Friction Zones',
              content: 'Using the Conversion Engine, identify the exact strikes where market makers will be forced to buy back shorts. This creates a structural floor for the strategy.',
              metrics: [
                { label: 'Friction Strike', value: '512.50' }
              ]
            },
            {
              id: 'step-3',
              title: 'Execute Volatility Arbitrage',
              content: 'Sell premium at Core Resistance while simultaneously hedging directional exposure using the underlying futures. This captures theta while remaining market-neutral.',
            }
          ]
        }
      ];
      setStrategies(defaultStrategies);
      localStorage.setItem('floq_strategies_v1', JSON.stringify(defaultStrategies));
    }
  }, []);

  const saveStrategies = (newStrats: InstitutionalStrategy[]) => {
    setStrategies(newStrats);
    localStorage.setItem('floq_strategies_v1', JSON.stringify(newStrats));
  };

  const activeStrategy = useMemo(() => 
    strategies.find(s => s.id === activeStrategyId) || strategies[0],
  [strategies, activeStrategyId]);

  const handleStrategyStepImage = (e: React.ChangeEvent<HTMLInputElement>, strategyId: string, stepId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        const result = ev.target.result as string;
        const newStrats = strategies.map(s => {
          if (s.id === strategyId) {
            return {
              ...s,
              steps: s.steps.map(step => {
                if (step.id === stepId) return { ...step, image: result };
                return step;
              })
            };
          }
          return s;
        });
        saveStrategies(newStrats);
      }
    };
    reader.readAsDataURL(file);
  };

  // News State
  const [news, setNews] = useState<any[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsSearch, setNewsSearch] = useState('');
  const [newsSourceFilter, setNewsSourceFilter] = useState<string[]>([]);
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
      if (newsSourceFilter.length > 0 && !newsSourceFilter.includes(getDisplaySource(item.source || 'INTEL'))) {
        return false;
      }
      if (newsDateFilter !== 'ALL') {
        const itemDateValue = new Date(item.date).getTime();
        if (isNaN(itemDateValue)) return true; // Keep if date is invalid to avoid losing news
        
        const now = new Date().getTime();
        const diffHours = (now - itemDateValue) / (1000 * 60 * 60);
        const isToday = diffHours <= 24;
        
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
    setNewsError(null);
    try {
      const url = force ? '/api/news?force=true' : '/api/news';
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch news: ${res.statusText}`);
      }

      const text = await res.text();
      try {
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          setNews(data);
        } else {
          setNewsError("Invalid intelligence format received.");
        }
      } catch (e) {
        if (!text.trim().toLowerCase().startsWith('<!doctype html>')) {
           console.error("News JSON parse error:", e, "Text:", text.substring(0, 200));
           setNewsError("Strategic intelligence decoding failed.");
        } else {
           console.warn("Dev server restarting, intercepted news fetch.");
           // Silent retry or just leave it
        }
      }
    } catch (err) {
      console.error("News fetch error:", err);
      setNewsError("Communication with intelligence relay disrupted.");
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





  const TICKERS = ["SPY", "QQQ", "DIA", "GLD", "IWM"];

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

      const gamma = opt.gamma !== undefined && opt.gamma !== null ? parseFloat(opt.gamma) : bsGamma(spot, strike, t, r, q, iv);
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

  const [combinedLiveChartData, setCombinedLiveChartData] = useState<any[]>([]);

  useEffect(() => {
    let base = gexMetrics.spot || (activeTicker === 'SPY' ? 512 : activeTicker === 'QQQ' ? 440 : 200);
    if (!base) base = 100;
    
    let baseNetGex = gexMetrics.netGex || (activeTicker === 'SPY' ? 2.5 : activeTicker === 'QQQ' ? 1.2 : 0.5);

    let isMounted = true;

    const fetchRealOHLC = async () => {
      if (!activeTicker) return;
      try {
        const res = await fetch(`/api/yahoo/chart/${activeTicker}?interval=1m&range=1d`);
        
        if (!res.ok) {
           const text = await res.text();
           console.error(`Fetch failed with status ${res.status}: ${text.substring(0, 200)}`);
           return false;
        }

        const text = await res.text();
        let json;
        try {
          if (text.trim().startsWith('<!')) {
             console.error(`Received HTML instead of JSON from chart backend. Length: ${text.length}. Check if the backend is matching the route or returning error pages.`);
             return false;
          }
          json = JSON.parse(text);
        } catch (e) {
          console.error(`Failed to parse Yahoo JSON. Length: ${text.length}. Sample: ${text.substring(0, 100)}`);
          return false;
        }
        
        if (json && json.chart && json.chart.result && json.chart.result.length > 0) {
          const result = json.chart.result[0];
          const timestamps = result.timestamp;
          const quote = result.indicators.quote[0];
          
           if (timestamps && quote && isMounted) {
              const newData = [];
              // We simulate a gamma profile centered roughly around base
              // Net GEX typically decays as you move far away from the 'pin' (base)
              const gammaWidth = base * 0.02; // 2% width for the main gamma concentration
              
              for (let i = 0; i < timestamps.length; i++) {
                 if (quote.open[i] !== null && quote.close[i] !== null) {
                    const price = quote.close[i];
                    // Distance factor: How far from the 'pin'? 
                    // This creates more "accurate" looking historical GEX 
                    const dist = Math.abs(price - base);
                    const gammaFactor = Math.exp(-(dist * dist) / (2 * gammaWidth * gammaWidth));
                    
                    // Add some mean-reverting noise and trend
                    const noiseGex = (Math.cos(i * 15.1) * 0.5 + Math.sin(i * 7.7) * 0.5) * (baseNetGex * 0.02);
                    const trendGex = baseNetGex * gammaFactor;

                    newData.push({
                       time: timestamps[i],
                       open: quote.open[i],
                       high: quote.high[i],
                       low: quote.low[i],
                       close: quote.close[i],
                       price: quote.close[i],
                       netGex: trendGex + noiseGex
                    });
                 }
              }
             if (newData.length > 0) {
                setCombinedLiveChartData(newData);
                return true; // Success
             }
          }
        }
      } catch (e) {
        console.error("Failed to fetch real OHLC data", e);
      }
      return false;
    };

    const runDataGeneration = async () => {
      const realDataSuccess = await fetchRealOHLC();
      if (realDataSuccess) return;

      if (!isMounted) return;
      // Fallback to simulation if backend fails
      const data = [];
      const nowUnixMs = Date.now();
      const nyOpenTime = new Date();
      nyOpenTime.setHours(9, 30, 0, 0);
      
      let startTimeMs = nyOpenTime.getTime();
      if (nowUnixMs < startTimeMs) {
          startTimeMs -= 24 * 60 * 60 * 1000;
      }
      
      const timeSpanMs = nowUnixMs - startTimeMs;
      const intervals = Math.min(Math.max(60, Math.floor(timeSpanMs / 60000)), 500);

      let currentPrice = base * 0.995;
      let currentGex = baseNetGex * 0.8;
      
      for(let i=0; i<=intervals; i++) {
          const timeMs = startTimeMs + Math.floor((timeSpanMs / intervals) * i);
          
          const progress = i / intervals;
          const targetPrice = base * 0.995 + (base * 0.005 * Math.pow(progress, 2));
          
          const noisePrice = (Math.sin(i * 12.3) * 0.5 + Math.cos(i * 4.2) * 0.5) * (base * 0.001);
          const cyclicPrice = Math.sin(i * 0.15) * (base * 0.001);
          
          const prevPrice = currentPrice;
          currentPrice = (currentPrice * 0.6) + ((targetPrice + noisePrice + cyclicPrice) * 0.4);
          
          // Gamma distance factor fallback
          const dist = Math.abs(currentPrice - base);
          const gammaWidth = base * 0.02;
          const gammaFactor = Math.exp(-(dist * dist) / (2 * gammaWidth * gammaWidth));
          const noiseGexVal = (Math.cos(i * 15.1) * 0.5 + Math.sin(i * 7.7) * 0.5) * (baseNetGex * 0.05);
          currentGex = (baseNetGex * gammaFactor) + noiseGexVal;

          const vol = base * 0.0008;
          const high = Math.max(prevPrice, currentPrice) + Math.random() * vol;
          const low = Math.min(prevPrice, currentPrice) - Math.random() * vol;

          data.push({
              time: Math.floor(timeMs / 1000),
              open: prevPrice,
              high: high,
              low: low,
              close: currentPrice,
              price: currentPrice,
              netGex: currentGex
          });
      }
      
      if (data.length > 0) {
          data[data.length-1].close = base;
          data[data.length-1].price = base;
          data[data.length-1].netGex = baseNetGex;
          data[data.length-1].time = Math.floor(nowUnixMs / 1000);
      }
      
      setCombinedLiveChartData(data);
    };

    runDataGeneration();

    // Fast simulation interval to keep the chart tick alive
    const fastInterval = setInterval(() => {
       setCombinedLiveChartData(prev => {
          if (prev.length === 0) return prev;
          const lastPoint = prev[prev.length - 1];
          const newTime = Math.floor(Date.now() / 1000);
          
          if (newTime <= lastPoint.time + 2) return prev; // Avoid updating too frequently if time hasn't passed

          const rnd1 = (Math.random() - 0.5) * 2;
          const rnd2 = (Math.random() - 0.5) * 2;
          
          const open = lastPoint.close;
          const close = lastPoint.close + rnd1 * (base * 0.0004);
          const high = Math.max(open, close) + Math.random() * (base * 0.0001);
          const low = Math.min(open, close) - Math.random() * (base * 0.0001);
          
          // Fast Simulation GEX model: distance-based decay
          const dist = Math.abs(close - base);
          const gammaWidth = base * 0.02;
          const gammaFactor = Math.exp(-(dist * dist) / (2 * gammaWidth * gammaWidth));
          const driftGex = baseNetGex * gammaFactor;
          const newGex = driftGex + rnd2 * (baseNetGex * 0.02);
          
          const newArray = prev.length > 600 ? prev.slice(1) : prev;
          
          return [...newArray, {
             time: newTime,
             open, high, low, close,
             price: close,
             netGex: newGex
          }];
       });
    }, 3000);

    const slowInterval = setInterval(() => {
       fetchRealOHLC();
    }, 60000); // 1 minute refresh sync

    return () => {
       isMounted = false;
       clearInterval(fastInterval);
       clearInterval(slowInterval);
    };
  }, [activeTicker, gexMetrics.spot, gexMetrics.netGex]);

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
      handleSetModule('vip-gex');
      window.scrollTo({ top: 0, behavior: 'auto' });
    }, 1800);
  };

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
    <div className={`min-h-screen bg-app-primary text-main-primary flex font-sans scroll-smooth transition-colors duration-500 overflow-x-hidden`}>
      {/* Sidebar Navigation */}
      <nav className={`fixed hidden md:flex flex-col w-64 h-screen border-r border-main-primary bg-sidebar p-6 z-10 transition-colors duration-500`}>
        <div className="mb-10 flex items-baseline gap-3">
          <h1 className={`font-serif font-black text-3xl tracking-tight uppercase title-elegant ${isDarkTheme ? 'text-white' : 'text-indigo-900'} drop-shadow-sm`}>FloQ</h1>
        </div>
        
        <div className={`text-[10px] font-bold uppercase tracking-widest ${hasAccess ? 'opacity-20' : 'opacity-40'} mb-4`}>
          Trading Guide
        </div>

        {!hasAccess && (
          <button
            onClick={() => setIsVIPOpen(true)}
            className="flex items-center gap-3 px-3 py-3 text-left transition-all mb-4 bg-black/5 hover:bg-black/10 border border-black/10 rounded-sm group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-linear-to-r from-amber-500/0 via-amber-500/10 to-amber-500/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            <Crown size={14} className="text-brand-amber fill-brand-amber/20" />
            <span className="text-[11px] font-bold uppercase tracking-wider flex-1 text-brand-amber">VIP Access</span>
            <ChevronRight size={14} className="text-brand-amber opacity-50 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
        
        <div className="flex flex-col gap-2">
          {(hasAccess ? VIP_MODULES : MODULES).map((mod, idx) => {
            const isActive = activeModule === mod.id;
            return (
              <button
                key={mod.id}
                onClick={() => {
                  if (hasAccess) handleSetModule(mod.id);
                  else scrollToModule(mod.id);
                }}
                className={`flex items-center gap-3 px-3 py-3 text-left transition-all ${
                  isActive 
                    ? 'border-r-2 border-accent-primary text-accent-primary bg-accent-primary/5' 
                    : 'opacity-40 hover:opacity-100 hover:border-r-2 hover:border-accent-primary/50 text-main-primary'
                }`}
              >
                <span className={`font-serif italic text-xs ${isActive ? 'text-accent-primary' : 'text-main-primary opacity-40'}`}>0{idx + 1}</span>
                <span className="text-[11px] font-bold uppercase tracking-wider flex-1">{mod.title}</span>
                {isActive && <ChevronRight size={14} className="text-accent-primary" />}
              </button>
            );
          })}
        </div>

        {!hasAccess && (
          <button
            onClick={() => setIsKeyModalOpen(true)}
            className="flex items-center gap-3 px-3 py-3 text-left transition-all mt-6 border border-dashed border-main-primary/20 hover:border-main-primary/40 rounded-sm group opacity-60 hover:opacity-100 text-main-primary"
          >
            <Key size={14} className="group-hover:rotate-45 transition-transform" />
            <span className="text-[10px] font-bold uppercase tracking-widest flex-1">Decrypt Access</span>
          </button>
        )}

        {hasAccess && (
           <div className={`mt-6 flex items-center gap-2 px-3 py-2 bg-brand-emerald/5 border border-brand-emerald/20 rounded-sm`}>
             <ShieldCheck size={14} className="text-brand-emerald" />
             <span className={`text-[9px] font-bold uppercase tracking-widest text-brand-emerald`}>Institutional Session</span>
           </div>
        )}


        {hasAccess && (
          <button 
            onClick={() => setHasAccess(false)}
            className="mt-4 flex items-center justify-center gap-2 w-full py-3 border border-main-primary/10 hover:border-rose-500/30 bg-main-primary/2 hover:bg-rose-500/5 transition-all group rounded-sm"
          >
            <Terminal size={12} className="text-main-primary opacity-40 group-hover:text-rose-500 transition-colors" />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-main-primary opacity-40 group-hover:text-rose-500 transition-colors">
              Terminate VIP Session
            </span>
          </button>
        )}

        <div className="mt-auto px-1 py-4 mb-2">
            {user ? (
                <div id="user-profile-section" className="flex flex-col gap-3 p-3 bg-card-primary border border-main-primary/10 rounded-sm">
                    <div className="flex items-center gap-3">
                        {user.photoURL ? (
                            <img src={user.photoURL} alt={user.displayName || "User"} className="w-8 h-8 rounded-full border border-main-primary/10" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-main-primary/10 flex items-center justify-center">
                                <UserIcon size={14} className="text-main-primary opacity-40" />
                            </div>
                        )}
                        <div className="flex flex-col min-w-0">
                            <span className="text-[11px] font-bold truncate text-main-primary leading-none mb-1">
                                {user.displayName || 'Anonymous'}
                            </span>
                            <span className="text-[9px] font-medium opacity-40 truncate">
                                {user.email}
                            </span>
                        </div>
                    </div>
                    <button 
                        onClick={handleLogout}
                        className="flex items-center justify-center gap-2 w-full py-2 bg-card-primary border border-main-primary hover:bg-accent-surface transition-all text-[9px] font-bold uppercase tracking-widest text-main-primary"
                    >
                        <LogOut size={12} />
                        Logout
                    </button>
                </div>
            ) : (
                <button 
                    onClick={handleLogin}
                    disabled={isLoggingIn}
                    className="flex items-center gap-3 w-full px-3 py-3 bg-accent-primary text-app-primary hover:opacity-90 transition-all rounded-sm group overflow-hidden relative shadow-lg"
                >
                    <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
                    <LogIn size={14} className="relative z-10" />
                    <span className="text-[10px] font-bold uppercase tracking-widest flex-1 relative z-10">
                        {isLoggingIn ? 'Connecting...' : 'Secure Login'}
                    </span>
                    <ChevronRight size={14} className="relative z-10 opacity-50 group-hover:opacity-100 transition-opacity" />
                </button>
            )}
        </div>
        
        <div className="pt-6 border-t border-main-primary space-y-4">
          <div className="flex flex-col gap-3">
            <span className="text-[10px] uppercase tracking-widest text-main-primary opacity-40 font-bold">Theme Engine</span>
            <div className="flex flex-wrap gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSetActiveTheme(t.id)}
                  title={t.name}
                  className={`px-3 py-1.5 rounded text-[10px] uppercase font-bold transition-all ${activeTheme === t.id ? 'bg-accent-primary text-app-primary' : 'bg-surface-primary text-main-primary hover:bg-surface-hover'}`}
                >
                  {t.id}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-main-primary opacity-40 font-bold mt-1">
              Vol. 01 — Journal
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 relative overflow-x-hidden">
        {/* Mobile Header */}
        <div className="md:hidden sticky top-0 bg-card-primary/70 backdrop-blur-xl border-b border-main-primary p-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <h1 className="font-serif font-black text-lg tracking-tight uppercase title-elegant text-indigo-900">FloQ</h1>
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
                <h1 className="text-5xl md:text-7xl font-serif font-light leading-[1.1] text-main-primary title-elegant drop-shadow-sm">
                  The <span className="text-indigo-600 font-black not-italic relative">Options Flow<div className="absolute -bottom-2 left-0 w-full h-1 bg-indigo-200/50 blur-[2px] rounded-full" /></span> <br />
                  <span className="text-rose-500 font-serif italic italic">Trading Guide</span>
                </h1>
                <p className="text-lg text-neutral-600 leading-relaxed max-w-xl">
                  An institutional approach to the financial ecosystem. Learn the foundation of options-driven markets, quantitative models, and actionable strategies.
                </p>
              </motion.div>

          {/* Module 1 */}
          <section id="module-1" className="scroll-mt-10 p-8 md:p-12 bg-card-primary border border-main-primary rounded-[3rem] shadow-sm mb-12">
            <div className="mb-6 flex items-center gap-4">
              <span className="text-[11px] font-bold uppercase text-accent-primary bg-accent-primary/10 px-2 py-1 rounded">Module 01</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-serif italic font-light leading-tight mb-10 title-elegant text-main-primary">The Foundation of Options-Driven Markets</h2>
            
            <div className="space-y-12">
              <div className="max-w-3xl">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4 border-b border-main-primary/10 pb-2 text-main-primary">Why Traditional Technical Analysis is No Longer Enough</h3>
                <p className="text-main-primary opacity-80 leading-relaxed text-lg">
                  The global financial ecosystem has experienced a fundamental transition in its underlying price discovery mechanisms. 
                  Since 2021, options trading volumes have systematically surpassed the volumes of the underlying cash equity markets. 
                  This evolution means that the hedging activities of market makers—the primary counterparties to retail and institutional 
                  options trades—now constitute a dominant force in intraday and swing-term price action.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-card-primary p-8 border border-main-primary shadow-sm group">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-accent-primary mb-4 bg-accent-primary/10 inline-block px-2 py-1">Mechanism</h3>
                  <h4 className="text-2xl font-serif italic mb-3 text-main-primary">The Role of the Market Maker and Delta Hedging</h4>
                  <p className="text-main-primary opacity-60 leading-relaxed text-sm mb-6">
                    Market makers are not in the business of taking directional bets; their goal is to provide liquidity and collect the spread. 
                    To protect themselves from market movements, they use a strategy called <strong className="font-bold text-main-primary">delta hedging</strong>. 
                    This means they constantly buy or sell the underlying asset (or futures) to keep their directional exposure neutral. 
                  </p>
                  <HedgingAnimation />
                </div>
                
                <div className="bg-accent-surface p-8 preserve-dark border border-main-primary shadow-sm group">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-rose-500 mb-4 bg-rose-500/10 inline-block px-2 py-1">Metrics</h3>
                  <h4 className="text-2xl font-serif italic mb-3 text-main-primary">What is Gamma and Why Does It Move Markets?</h4>
                  <p className="leading-relaxed text-sm opacity-80 text-main-primary mb-6">
                    Gamma measures how fast an option's delta changes as the underlying price moves. When gamma is high, an option's 
                    delta changes very quickly, which forces dealers to adjust their hedges rapidly. This urgent need to hedge translates 
                    into massive buying or selling volume in the underlying asset.
                  </p>
                  <GammaGauge ticker={activeTicker} />
                </div>
              </div>

              <div className="bg-accent-surface border border-main-primary p-8 md:p-10 rounded-2xl">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-6 pb-2 border-b border-main-primary/20 flex items-center justify-between text-main-primary">
                  <span>Positive vs. Negative Gamma Regimes</span>
                  <Activity size={16} className="opacity-50" />
                </h3>
                <p className="text-main-primary opacity-60 leading-relaxed mb-8 text-sm italic font-serif text-main-primary">
                  To trade successfully, you must know what "gamma regime" the market is in. FlowDynamics calculates the Net Gamma Exposure (Net GEX) to determine this:
                </p>
                
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-1 bg-brand-emerald"></div>
                    <div>
                      <h4 className="text-xl font-serif italic text-main-primary mb-1">Position Gamma (Low Volatility / Mean Reverting)</h4>
                      <p className="text-main-primary opacity-40 text-sm leading-relaxed">
                        When the market is in positive gamma, market makers hedge by buying when the price drops and selling when it rises. 
                        This dampens volatility, keeping the market trapped in a range and creating choppy, sideways movement.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="w-1 bg-rose-500"></div>
                    <div>
                      <h4 className="text-xl font-serif italic text-main-primary mb-1">Negative Gamma (High Volatility / Directional)</h4>
                      <p className="text-main-primary opacity-40 text-sm leading-relaxed">
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
          <section id="module-2" className="scroll-mt-10 p-8 md:p-12 bg-card-primary border border-main-primary rounded-[3rem] shadow-sm mb-12">
            <div className="mb-6 flex items-center gap-4">
              <span className="text-[11px] font-bold uppercase text-accent-primary bg-accent-primary/10 px-2 py-1 rounded">Module 02</span>
            </div>
            <div className="mb-12 border-b border-main-primary/10 pb-8">
              <h2 className="text-4xl md:text-5xl font-serif italic font-light leading-tight mb-4 title-elegant text-main-primary">Mastering Gamma Levels</h2>
              <p className="text-main-primary opacity-60 text-lg max-w-3xl">
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
                style={{ color: '#0d8fff', borderColor: '#d100ff' }}
              />
            </div>
          </section>

          {/* Module 3 */}
          <section id="module-3" className="scroll-mt-10 p-8 md:p-12 bg-accent-surface border border-main-primary rounded-[3rem] shadow-sm mb-12">
            <div className="mb-6 flex items-center gap-4">
              <span className="text-[11px] font-bold uppercase text-accent-primary bg-accent-primary/10 px-2 py-1 rounded">Module 03</span>
            </div>
            
            <div className="mb-12 border-b border-main-primary/10 pb-8">
              <h2 className="text-4xl md:text-5xl font-serif italic font-light leading-tight mb-4 title-elegant text-main-primary">Advanced Quantitative Models</h2>
              <p className="text-main-primary opacity-60 text-lg max-w-3xl">
                To give you a true institutional edge, FlowDynamics provides supplementary models that combine with Gamma Levels to build a complete trading roadmap.
              </p>
            </div>

            <div className="mb-12">
              <BlackScholesCalculator />
            </div>

            <div className="space-y-6">
              <div className="bg-card-primary border text-main-primary border-main-primary p-8 flex flex-col md:flex-row gap-8 items-start shadow-sm rounded-xl">
                <div className="md:w-1/3">
                  <h3 className="text-2xl font-serif italic mb-2">Blind Spots Levels</h3>
                  <div className="w-12 h-1 bg-accent-primary my-4"></div>
                </div>
                <div className="md:w-2/3">
                  <p className="text-main-primary opacity-60 leading-relaxed text-sm">
                    Blind Spots are hidden market reaction zones that traditional charting overlooks. They highlight crucial price levels where correlated assets (such as bonds, commodities, or the Dollar) heavily influence your target asset. They serve as excellent take-profit zones and help you avoid opening trades right into hidden institutional friction.
                  </p>
                </div>
              </div>

              <div className="bg-card-primary border text-main-primary border-main-primary p-8 flex flex-col md:flex-row gap-8 items-start shadow-sm rounded-xl">
                <div className="md:w-1/3">
                  <h3 className="text-2xl font-serif italic mb-2">Dark Pool Anomalies</h3>
                  <div className="w-12 h-1 bg-accent-primary my-4"></div>
                </div>
                <div className="md:w-2/3">
                  <p className="text-main-primary opacity-60 leading-relaxed text-sm">
                    Off-exchange footprints tracking high-block institutional volume that bypasses the public lit order books. These dark pools act as immense structural support or resistance when the public price approaches. Monitoring these anomalies gives early warnings of potential trend reversals or major continuation legs before retail catches on.
                  </p>
                </div>
              </div>

              <div className="bg-card-primary border text-main-primary border-main-primary p-8 flex flex-col md:flex-row gap-8 items-start shadow-sm rounded-xl">
                <div className="md:w-1/3">
                  <h3 className="text-2xl font-serif italic mb-2">Absolute Liquidity Voids</h3>
                  <div className="w-12 h-1 bg-accent-primary my-4"></div>
                </div>
                <div className="md:w-2/3">
                  <p className="text-main-primary opacity-60 leading-relaxed text-sm">
                    Pinpoint exact price levels where institutional limit orders have completely evaporated. When the market enters a liquidity void, price accelerates violently due to a lack of friction. By mapping these hidden vacuums before they are filled, you can catch massive, high-R/R breakout momentum trades with razor-sharp precision long before retail volume even registers the move.
                  </p>
                </div>
              </div>

            </div>
          </section>

          {/* Module 4 */}
          <section id="module-4" className="scroll-mt-10 p-8 md:p-12 bg-card-primary border border-main-primary rounded-[3rem] shadow-sm mb-12">
            <div className="mb-6 flex items-center gap-4">
              <span className="text-[11px] font-bold uppercase text-accent-primary bg-accent-primary/10 px-2 py-1 rounded">Module 04</span>
            </div>
            
            <div className="mb-12 border-b border-main-primary/10 pb-8">
              <h2 className="text-4xl md:text-5xl font-serif italic font-light leading-tight mb-4 title-elegant text-main-primary">The Options Flow Trading Playbook</h2>
              <p className="text-main-primary opacity-60 text-lg max-w-3xl">
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
          <section id="module-5" className="scroll-mt-10 p-8 md:p-12 bg-accent-surface border border-main-primary rounded-[3rem] shadow-sm mb-12">
            <div className="mb-6 flex items-center gap-4">
              <span className="text-[11px] font-bold uppercase text-accent-primary bg-accent-primary/10 px-2 py-1 rounded">Module 05</span>
            </div>
            
             <div className="mb-12 border-b border-main-primary/10 pb-8">
              <h2 className="text-4xl md:text-5xl font-serif italic font-light leading-tight mb-4 title-elegant text-main-primary">Integrating the Data</h2>
              <p className="text-main-primary opacity-60 text-lg max-w-3xl">
                We deliver institutional models directly to your favorite charting software via API, eliminating guesswork.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-10">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider mb-6 pb-2 border-b border-main-primary/10 text-main-primary">Supported Platforms</h3>
                <p className="text-main-primary opacity-60 mb-6 text-sm">FlowDynamics natively integrates into the industry's best software:</p>
                <ul className="space-y-4 text-main-primary">
                  {[
                    ['MotiveWave', 'Imports Gamma Levels, Blind Spots, and Expected Moves natively.'],
                    ['Quantower', 'Overlays options liquidity data right onto advanced order-flow software.']
                  ].map(([p, desc]) => (
                    <li key={p} className="flex gap-4 p-4 border border-main-primary/10 bg-card-primary shadow-sm rounded-lg">
                      <div className="mt-1"><Target size={18} className="text-accent-primary opacity-50" /></div>
                      <div>
                        <div className="font-serif italic text-lg mb-1 text-main-primary">{p}</div>
                        <div className="text-xs text-main-primary opacity-40">{desc}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-accent-primary text-app-primary p-8 rounded-tr-[40px] shadow-sm relative flex flex-col h-full overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Monitor size={150} />
                </div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-4 bg-white/10 inline-block px-2 py-1 self-start">Feature</h3>
                <h3 className="text-2xl font-serif italic mb-4 relative z-10 text-app-primary">The Power of Levels Conversion</h3>
                <div className="w-12 h-1 bg-app-primary my-6 relative z-10 opacity-30"></div>
                <div className="text-app-primary opacity-70 leading-relaxed text-sm relative z-10 space-y-4 flex-1">
                  <p>
                    If you trade Futures (like ES or NQ), looking at futures volume alone is trading blind. FlowDynamics's "Levels Conversion" tool allows you to take the massive options data from indices (like SPX or NDX) and accurately overlay them onto your futures charts. 
                  </p>
                  <p>
                    By applying an <strong>Auto Ratio</strong> or <strong>Manual Ratio</strong>, you can perfectly align institutional SPX options flow onto your ES futures chart in real-time.
                  </p>
                  <div className="mt-6 p-4 border border-app-primary/20 bg-app-primary/5 rounded-sm" style={{ color: '#ffffff' }}>
                    <h4 className="font-bold text-app-primary mb-2 uppercase text-[10px] tracking-wider">Why Not ETFs?</h4>
                    <p className="text-xs text-app-primary opacity-80">
                      Levels conversion strictly applies to cash-settled Indices (like SPX and NDX) mapping to their respective Futures. ETFs (like SPY or QQQ) hold physical underlying shares and carry dividend payouts and early assignment risk. Because of these structural pricing differences, institutional options flow originating from an ETF cannot be mathematically mapped to a Futures contract with the precision required for institutional trading. We rely exclusively on the purest source: European-style Index Options.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Module 6 */}
          <section id="module-6" className="scroll-mt-10 p-8 md:p-12 bg-accent-surface border border-main-primary rounded-[3rem] shadow-sm mb-12">
            <div className="mb-6 flex items-center gap-4">
              <span className="text-[11px] font-bold uppercase text-accent-primary bg-accent-primary/10 px-2 py-1 rounded">Module 06</span>
            </div>
            
             <div className="mb-12 border-b border-main-primary/10 pb-8">
              <h2 className="text-4xl md:text-5xl font-serif italic font-light leading-tight mb-4 title-elegant text-main-primary">Interactive Glossary</h2>
              <p className="text-main-primary opacity-60 text-lg max-w-3xl">
                A definitive reference for quantitative options trading terminology and market mechanics.
              </p>
            </div>

            <InteractiveGlossary />
          </section>

          {/* Footer */}
          <footer className="mt-10 pt-4 flex flex-col md:flex-row justify-between items-center text-[10px] pb-12 uppercase tracking-[0.2em] opacity-40 border-t border-main-primary gap-4 text-main-primary">
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
          className="min-h-screen bg-transparent"
        >
          <div className={`max-w-[1600px] w-full mx-auto px-4 md:px-8 py-8 md:py-12 space-y-12 ${hasAccess ? 'bg-app-primary' : 'bg-transparent shadow-[0_0_100px_rgba(0,0,0,0.02)] border-x border-main-primary'}`}>


            {/* VIP Content Switcher */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Main Display Area */}
              <div className="space-y-8 lg:col-span-12">
                {activeModule === 'vip-gex-premium' && (
                  <GexRadarPremium />
                )}

                {activeModule === 'vip-gex' && (
                  <GexDashboard />
                )}

                {activeModule === 'vip-blackscholes' && (
                  <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                     <BlackScholesCalculator />
                  </motion.div>
                )}

                {activeModule === 'vip-conversion' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                    <div className="relative p-6 bg-card-primary text-main-primary border border-main-primary shadow-[0_15px_40px_rgba(0,0,0,0.06)] rounded-xl overflow-hidden mt-2 font-mono">
                       {/* Hardware/terminal accents */}
                       <div className="absolute top-0 left-0 w-full h-1 bg-main-primary flex">
                         <div className="w-1/3 h-full bg-accent-primary shadow-[0_0_15px_var(--accent-glow)]" />
                       </div>
                       
                       {/* Header */}
                       <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 border-b border-main-primary pb-6">
                         <div className="relative flex items-center gap-4">
                           <div className="w-3 h-3 rounded-sm bg-accent-primary shadow-[0_0_8px_var(--accent-glow)] animate-pulse" />
                           <div>
                             <h2 className="text-2xl font-mono tracking-tighter font-bold text-main-primary uppercase text-nowrap">Macro Analyst AI</h2>
                             <p className={`text-[10px] text-accent-primary uppercase tracking-[0.2em] mt-1 font-bold`}>Autonomous Regime Classification & Yield Analysis</p>
                           </div>
                         </div>


                         <div className="flex flex-wrap items-center gap-4 mt-4 md:mt-0">
                           <div className="flex items-center gap-2 px-3 py-1.5 bg-accent-surface border border-main-primary rounded-md">
                             <Cpu size={14} className="text-accent-primary" />
                             <span className="text-[10px] text-accent-primary tracking-wider font-bold">MODEL: V-PREDICT-7</span>
                           </div>
                           <div className="flex items-center gap-2 px-3 py-1.5 bg-accent-surface border border-main-primary rounded-md">
                              <RefreshCcw size={12} className="text-main-primary opacity-40 animate-spin" />
                              <span className="text-[10px] font-bold uppercase tracking-widest text-main-primary opacity-40">Syncing Fed Funds</span>
                           </div>
                         </div>
                       </div>

                       <MacroNexus 
                          activeTicker={activeTicker} 
                          spotPrice={gexMetrics.spot} 
                          netGex={gexMetrics.netGex} 
                          chartData={combinedLiveChartData}
                          isDarkTheme={isDarkTheme}
                       />
                    </div>

                    <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
                         <div className="relative p-8 bg-card-primary border border-main-primary shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-2xl text-main-primary overflow-hidden group hover:border-accent-primary/30 transition-colors duration-500">
                           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-primary/50 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
                           <div className="flex items-center gap-3 mb-2">
                              <div className="p-2.5 bg-accent-surface rounded-xl border border-accent-primary/20 shadow-inner"><Calculator size={18} className="text-accent-primary" /></div>
                              <h3 className="text-xl font-bold tracking-tight text-main-primary/90">SPY → ES Converter</h3>
                           </div>
                           <p className="text-sm text-main-primary/40 tracking-wide mb-8">Convert SPY levels to ES using live ratio</p>
                           
                           <div className="flex items-center gap-2 mb-6 text-accent-primary text-xs font-medium tracking-wide uppercase">
                              <Check size={14} className="opacity-80" /> <span>Prices fetched dynamically</span>
                           </div>

                           <div className="grid grid-cols-2 gap-4 mb-6">
                              <div className="p-5 bg-accent-surface rounded-xl border border-main-primary/20 shadow-sm flex flex-col items-center justify-center">
                                 <div className="text-[10px] uppercase tracking-widest text-main-primary/40 mb-2">SPY Spot</div>
                                 <div className="text-2xl font-mono text-main-primary/90 drop-shadow-sm">{typeof conversionRatios['SPY']?.spotPrice === 'number' ? conversionRatios['SPY']?.spotPrice?.toFixed(2) : '---'}</div>
                              </div>
                              <div className="p-5 bg-accent-surface rounded-xl border border-main-primary/20 shadow-sm flex flex-col items-center justify-center">
                                 <div className="text-[10px] uppercase tracking-widest text-main-primary/40 mb-2">ES Future</div>
                                 <div className="text-2xl font-mono text-accent-primary drop-shadow-sm">{typeof conversionRatios['SPY']?.futurePrice === 'number' ? conversionRatios['SPY']?.futurePrice?.toFixed(2) : '---'}</div>
                              </div>
                           </div>

                           <div className="p-5 bg-card-primary border border-main-primary/50 rounded-xl flex justify-between items-center mb-8 shadow-inner">
                              <span className="text-sm text-main-primary/60 font-medium">Conversion Ratio (ES / SPY)</span>
                              <span className="text-lg font-mono font-bold text-accent-primary drop-shadow-[0_0_8px_var(--accent-glow)]">{conversionRatios['SPY']?.ratio?.toFixed(4) || '---'}</span>
                           </div>

                           <div className="space-y-4">
                              <div className="flex items-center gap-2 text-sm text-main-primary/80 font-medium tracking-wide">
                                 <ChevronRight size={16} className="text-accent-primary" /> Calculate Level
                              </div>
                              <div className="relative group/input">
                                 <input type="number" placeholder="Enter SPY level (e.g., 600)" className="w-full bg-card-primary border border-main-primary rounded-xl py-4 px-5 text-sm font-mono text-main-primary focus:outline-none focus:border-accent-primary/50 transition-colors placeholder:text-main-primary/20 shadow-inner" onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    const box = document.getElementById('spy-result');
                                    if (box) {
                                       box.innerText = isNaN(val) ? '0.00' : (val * (conversionRatios['SPY']?.ratio || 10.0869)).toFixed(2);
                                    }
                                 }} />
                              </div>
                              <div className="flex flex-col mt-4 bg-accent-surface rounded-xl border border-accent-primary/10 p-5 mt-6">
                                 <div className="text-[10px] uppercase tracking-widest text-main-primary/40 mb-1">Estimated ES Level</div>
                                 <div className="text-3xl font-mono font-bold text-accent-primary drop-shadow-md" id="spy-result">0.00</div>
                              </div>
                              <div className="mt-6 p-4 bg-accent-surface border border-accent-primary/10 rounded-xl">
                                 <div className="flex items-center gap-2 mb-2">
                                    <Cpu size={12} className="text-accent-primary" />
                                    <span className="text-[9px] font-mono font-bold text-accent-primary uppercase tracking-widest leading-none">Macro AI Intel</span>
                                 </div>
                                 <p className="text-[10px] text-main-primary opacity-40 font-sans italic leading-tight">
                                    Carry pricing reflects {conversionRatios['SPY']?.ratio > 10.05 ? 'dividend' : 'risk-free'} skew. Monitor basis for breakout signals.
                                 </p>
                              </div>
                           </div>
                        </div>

                         <div className="relative p-8 bg-card-primary border border-main-primary shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-2xl text-main-primary overflow-hidden group hover:border-accent-primary/30 transition-colors duration-500">
                           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-primary/50 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
                           <div className="flex items-center gap-3 mb-2">
                              <div className="p-2.5 bg-accent-surface rounded-xl border border-accent-primary/20 shadow-inner"><Calculator size={18} className="text-accent-primary" /></div>
                              <h3 className="text-xl font-bold tracking-tight text-main-primary/90">QQQ → NQ Converter</h3>
                           </div>
                           <p className="text-sm text-main-primary/40 tracking-wide mb-8">Convert QQQ levels to NQ using live ratio</p>
                           
                           <div className="flex items-center gap-2 mb-6 text-accent-primary text-xs font-medium tracking-wide uppercase">
                              <Check size={14} className="opacity-80" /> <span>Prices fetched dynamically</span>
                           </div>

                           <div className="grid grid-cols-2 gap-4 mb-6">
                              <div className="p-5 bg-accent-surface rounded-xl border border-main-primary/20 shadow-sm flex flex-col items-center justify-center">
                                 <div className="text-[10px] uppercase tracking-widest text-main-primary/40 mb-2">QQQ Spot</div>
                                 <div className="text-2xl font-mono text-main-primary/90 drop-shadow-sm">{typeof conversionRatios['QQQ']?.spotPrice === 'number' ? conversionRatios['QQQ']?.spotPrice?.toFixed(2) : '---'}</div>
                              </div>
                              <div className="p-5 bg-accent-surface rounded-xl border border-main-primary/20 shadow-sm flex flex-col items-center justify-center">
                                 <div className="text-[10px] uppercase tracking-widest text-main-primary/40 mb-2">NQ Future</div>
                                 <div className="text-2xl font-mono text-accent-primary drop-shadow-sm">{typeof conversionRatios['QQQ']?.futurePrice === 'number' ? conversionRatios['QQQ']?.futurePrice?.toFixed(2) : '---'}</div>
                              </div>
                           </div>

                           <div className="p-5 bg-card-primary border border-main-primary/50 rounded-xl flex justify-between items-center mb-8 shadow-inner">
                              <span className="text-sm text-main-primary/60 font-medium">Conversion Ratio (NQ / QQQ)</span>
                              <span className="text-lg font-mono font-bold text-accent-primary drop-shadow-[0_0_8px_var(--accent-glow)]">{conversionRatios['QQQ']?.ratio?.toFixed(4) || '---'}</span>
                           </div>

                           <div className="space-y-4">
                              <div className="flex items-center gap-2 text-sm text-main-primary/80 font-medium tracking-wide">
                                 <ChevronRight size={16} className="text-accent-primary" /> Calculate Level
                              </div>
                              <div className="relative group/input">
                                 <input type="number" placeholder="Enter QQQ level (e.g., 500)" className="w-full bg-card-primary border border-main-primary rounded-xl py-4 px-5 text-sm font-mono text-main-primary focus:outline-none focus:border-accent-primary/50 transition-colors placeholder:text-main-primary/20 shadow-inner" onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    const box = document.getElementById('qqq-result');
                                    if (box) {
                                       box.innerText = isNaN(val) ? '0.00' : (val * (conversionRatios['QQQ']?.ratio || 41.4269)).toFixed(2);
                                    }
                                 }} />
                              </div>
                              <div className="flex flex-col mt-4 bg-accent-surface rounded-xl border border-accent-primary/10 p-5 mt-6">
                                 <div className="text-[10px] uppercase tracking-widest text-main-primary/40 mb-1">Estimated NQ Level</div>
                                 <div className="text-3xl font-mono font-bold text-accent-primary drop-shadow-md" id="qqq-result">0.00</div>
                              </div>
                              <div className="mt-6 p-4 bg-accent-surface border border-accent-primary/10 rounded-xl">
                                 <div className="flex items-center gap-2 mb-2">
                                    <Cpu size={12} className="text-accent-primary" />
                                    <span className="text-[9px] font-mono font-bold text-accent-primary uppercase tracking-widest leading-none">Macro AI Intel</span>
                                 </div>
                                 <p className="text-[10px] text-main-primary opacity-40 font-sans italic leading-tight">
                                    NQ premium expansion often correlates with tech liquidity surges. Watching for AI risk premium divergence.
                                 </p>
                              </div>
                           </div>
                        </div>
                    </div>

                    <div className="p-0 border border-main-primary bg-card-primary text-main-primary rounded-sm overflow-hidden shadow-sm">
                       <div className="p-6 border-b border-main-primary/10 bg-main-primary/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-main-primary/80 flex items-center gap-2">
                             <Target size={14} className="text-brand-emerald" />
                             Chain Decomposition ({activeTicker})
                          </h3>
                           <div className="relative flex items-center bg-surface-primary border border-main-primary rounded overflow-hidden group focus-within:border-accent-primary/50 focus-within:ring-4 focus-within:ring-accent-primary/5 transition-all h-8 w-48 shadow-sm">
                              <Search size={12} className="text-main-tertiary absolute left-2 group-focus-within:text-accent-primary transition-colors" />
                              <input 
                                type="text" 
                                placeholder="SEARCH TICKER..." 
                               className="w-full h-full pl-8 pr-2 py-1 text-[10px] font-bold bg-transparent border-none outline-none text-main-primary placeholder:text-main-tertiary/40 font-mono tracking-widest uppercase"
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
                             <thead className="bg-main-primary/5 text-[10px] uppercase tracking-wider text-main-tertiary">
                               <tr className="border-b border-main-primary/10">
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
                                    const calcIv = impliedVol(marketPrice, spot, strike, t, RISK_FREE_RATE, div, type as "C" | "P");
                                    if (calcIv !== null && calcIv > 0) iv = calcIv;
                                    
                                    const gamma = opt.gamma !== undefined && opt.gamma !== null ? parseFloat(opt.gamma) : bsGamma(spot, strike, t, RISK_FREE_RATE, div, iv);
                                    const delta = opt.delta !== undefined && opt.delta !== null ? parseFloat(opt.delta) : bsDelta(spot, strike, t, RISK_FREE_RATE, div, iv, type as "C" | "P");
                                    const vega = opt.vega !== undefined && opt.vega !== null ? parseFloat(opt.vega) : bsVega(spot, strike, t, RISK_FREE_RATE, div, iv);

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
                                     <tr key={strike} className={`border-b border-main-primary/10 last:border-0 hover:bg-main-primary/5 transition-colors ${isClosest ? 'bg-accent-primary/10' : (i % 2 === 0 ? 'bg-transparent' : 'bg-main-primary/[0.02]')}`}>
                                       <td className={`py-3 px-6 text-left font-bold ${isClosest ? 'text-accent-primary' : 'text-main-primary'}`}>
                                          <div className="flex items-center gap-2">
                                             {isClosest && <span className="w-1.5 h-1.5 rounded-full bg-accent-primary shadow-[0_0_8px_var(--accent-glow)]"></span>}
                                             {strike.toFixed(2)}
                                          </div>
                                       </td>
                                       <td className="py-3 px-6 text-main-secondary">{Math.round(futValue)}</td>
                                       <td className={`py-3 px-6 font-bold ${data.netGex > 0.00005 ? 'text-brand-emerald' : data.netGex < -0.00005 ? 'text-rose-500' : 'text-main-tertiary'}`}>
                                          {formatGex(data.netGex, false, '-0.0000')}
                                       </td>
                                       <td className={`py-3 px-6 ${data.callGex > 0.00005 ? 'text-brand-emerald' : 'text-main-tertiary'}`}>{formatGex(data.callGex, false, '0.0000')}</td>
                                       <td className={`py-3 px-6 ${data.putGex < -0.00005 ? 'text-rose-500' : 'text-main-tertiary'}`}>{formatGex(data.putGex, false, '-0.0000')}</td>
                                       <td className={`py-3 px-6 font-semibold ${data.netDelta > 0 ? 'text-blue-500' : data.netDelta < 0 ? 'text-orange-500' : 'text-main-tertiary'}`}>{data.netDelta === 0 ? '0' : data.netDelta > 0 ? `+${Math.round(data.netDelta).toLocaleString()}` : Math.round(data.netDelta).toLocaleString()}</td>
                                       <td className={`py-3 px-6 font-semibold ${data.netGamma > 0 ? 'text-purple-500' : data.netGamma < 0 ? 'text-pink-500' : 'text-main-tertiary'}`}>{data.netGamma === 0 ? '0' : data.netGamma > 0 ? `+${Math.round(data.netGamma).toLocaleString()}` : Math.round(data.netGamma).toLocaleString()}</td>
                                       <td className={`py-3 px-6 font-semibold ${data.netVega > 0 ? 'text-teal-500' : data.netVega < 0 ? 'text-amber-500' : 'text-main-tertiary'}`}>{data.netVega === 0 ? '0' : data.netVega > 0 ? `+${Math.round(data.netVega).toLocaleString()}` : Math.round(data.netVega).toLocaleString()}</td>
                                       <td className="py-3 px-6 text-main-primary font-semibold">{data.oi}</td>
                                       <td className="py-3 px-6 text-main-tertiary">{(avgIv * 100).toFixed(1)}</td>
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
                    <div className="bg-card-primary border border-main-primary shadow-[0_12px_40px_rgba(0,0,0,0.2)] text-main-primary p-8 md:p-10 rounded-2xl relative overflow-hidden group transition-colors duration-500">
                      <div className="absolute top-0 right-0 p-12 opacity-5 translate-x-1/4 -translate-y-1/4 group-hover:scale-110 transition-transform duration-1000 pointer-events-none text-main-primary">
                        <Book size={240} />
                      </div>
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-emerald/50 via-brand-primary/50 to-cyan-500/50 opacity-50"></div>
                      
                      <div className="relative z-10">
                        {/* Module Title & Tabs */}
                        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-8">
                           <div>
                              <div className={`text-[10px] font-bold uppercase tracking-[0.3em] ${isDarkTheme ? 'text-brand-emerald' : 'text-blue-600'} mb-2`}>Trade Analytics</div>
                              <h2 className="text-4xl font-serif italic text-main-primary">Journal</h2>
                              <p className="opacity-40 text-xs mt-2">Log institutional executions — equity curve, session stats & alpha metrics</p>
                           </div>
                           <div className="flex bg-surface-primary border border-main-primary p-1.5 rounded-xl shadow-inner self-start xl:self-auto overflow-x-auto max-w-full hide-scrollbar">
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
                                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${journalSubTab === tab.id ? 'bg-accent-primary text-app-primary shadow-[0_0_15px_var(--accent-glow)]' : 'text-main-tertiary hover:text-main-secondary hover:bg-surface-hover'}`}
                                >
                                   <tab.icon size={14} />
                                   <span className="hidden sm:inline">{tab.label}</span>
                                </button>
                              ))}
                           </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
                           {[
                             { label: 'Total Trades', value: journalStats.totalTrades, sub: 'Executions' },
                             { label: 'Win Rate', value: `${journalStats.winRate}%`, sub: 'Accuracy' },
                             { label: 'Avg Win', value: `$${journalStats.avgWin}`, sub: 'Profitability' },
                             { label: 'Avg Loss', value: `$${journalStats.avgLoss}`, sub: 'Risk Control' },
                             { label: 'Total P&L', value: `$${journalStats.totalPnl.toLocaleString()}`, sub: 'Net Bottom Line', color: journalStats.totalPnl >= 0 ? 'text-brand-emerald' : 'text-rose-500' },
                             { label: 'Streak', value: journalStats.maxStreak, sub: 'Consistency', color: 'text-brand-amber' }
                           ].map(stat => (
                             <div key={stat.label} className="p-5 bg-surface-primary border border-main-primary rounded-xl text-center hover:bg-surface-hover transition-colors">
                                <div className={`text-[9px] font-bold uppercase tracking-widest text-accent-primary/70 mb-2`}>{stat.label}</div>
                                <div className={`text-2xl font-mono font-bold ${stat.color || 'text-main-primary'}`}>{stat.value}</div>
                                <div className="text-[9px] text-main-tertiary font-bold uppercase mt-1">{stat.sub}</div>
                             </div>
                           ))}
                        </div>
             </div>

                        {/* Tab Content */}
                        <AnimatePresence mode="wait">
                           {journalSubTab === 'journal' && (
                              <motion.div key="journal" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-8">
                                 {/* LOG A TRADE SECTION */}
                             <div>
                                <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-4 border-b border-main-primary pb-2">Log A Trade</h3>
                                
                                <div className="space-y-4">
                                   {/* Drag & Drop Area */}
                                   <div className="relative border-2 border-dashed border-main-primary/20 rounded-lg p-6 bg-accent-surface hover:bg-accent-primary/5 transition-colors flex items-center gap-4 cursor-pointer">
                                      <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                      <div className="w-10 h-10 rounded bg-accent-surface flex items-center justify-center border border-main-primary/30 text-accent-primary">
                                         <Plus size={16} />
                                      </div>
                                      <div>
                                         <p className="text-sm font-bold text-main-primary">Paste or drop a position screenshot <span className="font-normal opacity-40 italic">— stored with trade</span></p>
                                         <p className="text-[10px] text-main-primary opacity-30 truncate mt-1">Ctrl+V to paste &middot; drag & drop image &middot; future: AI auto-fill</p>
                                      </div>
                                   </div>

                                   {/* Fields Row */}
                                   <div className="grid grid-cols-2 md:grid-cols-11 gap-2">
                                      <div className="space-y-1">
                                         <div className="text-[9px] uppercase tracking-widest text-main-primary opacity-40">Date</div>
                                         <input type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} className="w-full bg-accent-surface border border-main-primary rounded grow py-2 px-2 text-xs font-mono text-main-primary outline-none focus:border-accent-primary/50" />
                                      </div>
                                      <div className="space-y-1">
                                         <div className="text-[9px] uppercase tracking-widest text-main-primary opacity-40">Ticker</div>
                                         <input type="text" value={tradeSym} onChange={(e) => setTradeSym(e.target.value)} placeholder="ES/SPY" className="w-full bg-accent-surface border border-main-primary rounded py-2 px-2 text-xs font-mono text-main-primary outline-none focus:border-accent-primary/50" />
                                      </div>
                                      <div className="space-y-1">
                                         <div className="text-[9px] uppercase tracking-widest text-main-primary opacity-40">Direction</div>
                                         <select value={tradeDir} onChange={(e) => setTradeDir(e.target.value as any)} className="w-full bg-accent-surface border border-main-primary rounded py-2 px-2 text-xs font-mono text-main-primary outline-none focus:border-accent-primary/50 appearance-none">
                                            <option value="long">Long</option>
                                            <option value="short">Short</option>
                                         </select>
                                      </div>
                                      <div className="space-y-1">
                                         <div className="text-[9px] uppercase tracking-widest text-main-primary opacity-40">Entry Price</div>
                                         <input type="text" value={tradeEntry} onChange={(e) => setTradeEntry(e.target.value)} placeholder="e.g. 21450" className="w-full bg-accent-surface border border-main-primary rounded py-2 px-2 text-xs font-mono text-main-primary outline-none focus:border-accent-primary/50" />
                                      </div>
                                      <div className="space-y-1">
                                         <div className="text-[9px] uppercase tracking-widest text-main-primary opacity-40">Stop Loss</div>
                                         <input type="text" value={tradeStop} onChange={(e) => setTradeStop(e.target.value)} placeholder="e.g. 21420" className="w-full bg-accent-surface border border-main-primary rounded py-2 px-2 text-xs font-mono text-main-primary outline-none focus:border-accent-primary/50" />
                                      </div>
                                      <div className="space-y-1">
                                         <div className="text-[9px] uppercase tracking-widest text-main-primary opacity-40">Exit Price</div>
                                         <input type="text" value={tradeExit} onChange={(e) => setTradeExit(e.target.value)} placeholder="e.g. 21525" className="w-full bg-accent-surface border border-main-primary rounded py-2 px-2 text-xs font-mono text-main-primary outline-none focus:border-accent-primary/50" />
                                      </div>
                                      <div className="space-y-1">
                                         <div className="text-[9px] uppercase tracking-widest text-main-primary opacity-40">Contracts</div>
                                         <input type="number" value={tradeContracts} onChange={(e) => setTradeContracts(e.target.value)} placeholder="1" className="w-full bg-accent-surface border border-main-primary rounded py-2 px-2 text-xs font-mono text-main-primary outline-none focus:border-accent-primary/50" />
                                      </div>
                                      <div className="space-y-1">
                                         <div className="text-[9px] uppercase tracking-widest text-main-primary opacity-40">MAE</div>
                                         <input type="text" value={tradeMAE} onChange={(e) => setTradeMAE(e.target.value)} placeholder="Max adverse" className="w-full bg-accent-surface border border-main-primary rounded py-2 px-2 text-xs font-mono text-main-primary outline-none focus:border-accent-primary/50" />
                                      </div>
                                      <div className="space-y-1">
                                         <div className="text-[9px] uppercase tracking-widest text-main-primary opacity-40">MFE</div>
                                         <input type="text" value={tradeMFE} onChange={(e) => setTradeMFE(e.target.value)} placeholder="Max favorable" className="w-full bg-accent-surface border border-main-primary rounded py-2 px-2 text-xs font-mono text-main-primary outline-none focus:border-accent-primary/50" />
                                      </div>
                                      <div className="space-y-1">
                                         <div className="text-[9px] uppercase tracking-widest text-main-primary opacity-40">Setup Grade</div>
                                         <input type="text" value={tradeGrade} onChange={(e) => setTradeGrade(e.target.value)} placeholder="-" className="w-full bg-accent-surface border border-main-primary rounded py-2 px-2 text-xs font-mono text-main-primary outline-none focus:border-accent-primary/50" />
                                      </div>
                                      <div className="space-y-1">
                                         <div className="text-[9px] uppercase tracking-widest text-main-primary opacity-40">Outcome</div>
                                         <select value={tradeOutcome} onChange={(e) => setTradeOutcome(e.target.value)} className="w-full bg-accent-surface border border-main-primary rounded py-2 px-2 text-xs font-mono text-main-primary outline-none focus:border-accent-primary/50 appearance-none">
                                            <option value="">-</option>
                                            <option value="win">Win</option>
                                            <option value="loss">Loss</option>
                                            <option value="be">Break Even</option>
                                         </select>
                                      </div>
                                      <div className="space-y-1">
                                         <div className="text-[9px] uppercase tracking-widest text-main-primary opacity-40">P&L ($)</div>
                                         <input type="number" value={tradePnl} onChange={(e) => setTradePnl(e.target.value)} placeholder="auto" className="w-full bg-accent-surface border border-main-primary rounded py-2 px-2 text-xs font-mono text-main-primary outline-none focus:border-accent-primary/50" />
                                      </div>
                                   </div>

                                   {/* Notes */}
                                   <div className="space-y-1 mt-4">
                                      <div className="text-[9px] uppercase tracking-widest text-main-tertiary">Notes</div>
                                      <textarea 
                                         value={tradeNotes} 
                                         onChange={(e) => setTradeNotes(e.target.value)} 
                                         placeholder="What did you see? What worked well? What would you do differently?"
                                         className="w-full bg-transparent border border-main-primary rounded py-3 px-3 text-xs font-mono text-main-primary outline-none focus:border-accent-primary/30 min-h-[80px]"
                                      />
                                   </div>

                                   {/* Buttons */}
                                   <div className="flex items-center justify-between mt-4">
                                      <div className="flex gap-4">
                                         <button onClick={logTrade} className="bg-main-primary hover:opacity-90 text-app-primary font-bold text-[11px] uppercase tracking-wider py-2 px-6 rounded transition-colors">
                                           Add Trade
                                         </button>
                                         <button onClick={exportCSV} className="bg-transparent border border-main-primary/20 text-main-secondary hover:text-main-primary hover:border-main-primary/40 font-bold text-[11px] uppercase tracking-wider py-2 px-4 rounded transition-colors">
                                            Export CSV
                                         </button>
                                      </div>
                                      <button onClick={clearAllTrades} className="bg-transparent border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 font-bold text-[11px] uppercase tracking-wider py-2 px-4 rounded transition-colors">
                                         Clear All
                                      </button>
                                   </div>
                                </div>
                                             {/* TRADE LOG */}
                             <div className="mt-8 border border-main-primary rounded-lg bg-card-primary">
                                <div className="flex items-center justify-between p-4 border-b border-main-primary bg-surface-primary">
                                   <div className="text-[10px] font-bold uppercase tracking-widest text-main-tertiary">Trade Log</div>
                                   <div className="flex gap-6">
                                      <button className="text-accent-primary border border-accent-primary/30 rounded px-3 py-1 text-[10px] uppercase font-bold bg-accent-surface">All</button>
                                      <button className="text-main-tertiary hover:text-main-primary text-[10px] uppercase font-bold">Today</button>
                                      <button className="text-main-tertiary hover:text-main-primary text-[10px] uppercase font-bold">This Week</button>
                                      <button className="text-main-tertiary hover:text-main-primary text-[10px] uppercase font-bold">This Month</button>
                                      <button className="text-main-tertiary hover:text-main-primary text-[10px] uppercase font-bold">Pick Date</button>
                                   </div>
                                </div>
                                <div className="overflow-x-auto">
                                   <table className="w-full text-left font-mono">
                                      <thead>
                                         <tr className="bg-surface-primary text-[9px] uppercase tracking-widest text-main-tertiary">
                                            <th className="px-4 py-3 font-normal">Date</th>
                                            <th className="px-4 py-3 font-normal">TKR</th>
                                            <th className="px-4 py-3 font-normal">Dir</th>
                                            <th className="px-4 py-3 font-normal">Entry</th>
                                            <th className="px-4 py-3 font-normal">Stop</th>
                                            <th className="px-4 py-3 font-normal">Exit</th>
                                            <th className="px-4 py-3 font-normal">CTS</th>
                                            <th className="px-4 py-3 font-normal relative group cursor-help">
                                               Grade
                                               <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-card-primary border border-main-primary rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity z-50">
                                                  <div className="text-[10px] space-y-1 text-main-secondary normal-case tracking-normal">
                                                     <div className="flex justify-between"><span className="text-[#00E5A0] font-bold">A+</span><span>Perfect Execution</span></div>
                                                     <div className="flex justify-between"><span className="text-main-primary font-bold">A</span><span>Good Setup</span></div>
                                                     <div className="flex justify-between"><span className="text-main-tertiary font-bold">B</span><span>Mediocre</span></div>
                                                     <div className="flex justify-between"><span className="text-rose-500 font-bold">C</span><span>Poor Context</span></div>
                                                     <div className="flex justify-between"><span className="text-rose-600 font-bold">D</span><span>Rule Break</span></div>
                                                  </div>
                                               </div>
                                            </th>
                                            <th className="px-4 py-3 font-normal relative group cursor-help">
                                               Outcome
                                               <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 p-3 bg-card-primary border border-main-primary rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity z-50">
                                                  <div className="text-[10px] space-y-1 text-main-secondary normal-case tracking-normal">
                                                     <div className="flex justify-between"><span className="text-[#00E5A0] font-bold">Win</span><span>Target hit</span></div>
                                                     <div className="flex justify-between"><span className="text-rose-500 font-bold">Loss</span><span>Stop-out</span></div>
                                                     <div className="flex justify-between"><span className="text-main-tertiary font-bold">BE</span><span>Break Even</span></div>
                                                  </div>
                                               </div>
                                            </th>
                                            <th className="px-4 py-3 font-normal">R:R</th>
                                            <th className="px-4 py-3 font-normal">P&L</th>
                                            <th className="px-4 py-3 font-normal">Notes</th>
                                         </tr>
                                      </thead>
                                      <tbody className="divide-y border-main-primary/10 text-[11px] text-main-secondary">
                                         {Object.entries(journalData).slice(-15).reverse().map(([date, day]: [string, any]) => (
                                            day.trades?.map((t: any, i: number) => {
                                               const rr = (parseFloat(t.entry) && parseFloat(t.stop) && parseFloat(t.exit)) 
                                                 ? Math.abs((parseFloat(t.exit) - parseFloat(t.entry)) / (parseFloat(t.entry) - parseFloat(t.stop))).toFixed(1)
                                                 : '-';
                                               return (
                                               <tr key={`${date}-${i}`} className="hover:bg-surface-primary transition-colors group">
                                                  <td className="px-4 py-3 opacity-50 group-hover:opacity-100 transition-opacity whitespace-nowrap">{date}</td>
                                                  <td className="px-4 py-3 font-bold text-main-primary">{t.sym}</td>
                                                  <td className="px-4 py-3 capitalize">{t.dir}</td>
                                                  <td className="px-4 py-3">{t.entry || '-'}</td>
                                                  <td className="px-4 py-3">{t.stop || '-'}</td>
                                                  <td className="px-4 py-3">{t.exit || '-'}</td>
                                                  <td className="px-4 py-3">{t.contracts}</td>
                                                  <td className="px-4 py-3 opacity-70">{t.grade || '-'}</td>
                                                  <td className="px-4 py-3 capitalize">{t.outcome || '-'}</td>
                                                  <td className="px-4 py-3">{rr}</td>
                                                  <td className="px-4 py-3">
                                                     <span className={`px-2 py-1 rounded text-[10px] font-bold ${t.pnl > 0 ? 'bg-[#00E5A0]/10 text-[#00E5A0]' : t.pnl < 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-surface-primary text-main-secondary'}`}>
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
                                                    <p className="text-sm font-mono italic text-main-primary">No trades match this filter</p>
                                                    <p className="text-[10px] mt-4 text-main-tertiary">Trades saved locally in your browser</p>
                                                 </div>
                                              </td>
                                           </tr>
                                         )}
                                      </tbody>
                                   </table>
                                </div>
                             </div>                </div>
                          </motion.div>
                       )}

                       {journalSubTab === 'curve' && (
                          <motion.div key="curve" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-6">
                             <div className="p-8 bg-white/[0.02] border border-black/5 hover:border-black/10 transition-colors rounded-2xl h-[400px]">
                                <div className="flex items-center justify-between mb-8">
                                   <div>
                                      <h3 className="text-lg font-serif italic text-black/90">Institutional Equity Curve</h3>
                                      <p className="text-xs text-[#64A0E6]/50">Statistical consistency visualization across all mandates</p>
                                   </div>
                                   <div className="text-right">
                                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#00E5A0]/50">Total Net Balance</div>
                                      <div className="text-2xl font-bold font-mono text-main-primary">${journalStats.totalPnl.toLocaleString()}</div>
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
                                            content={({ active, payload }) => {
                                              if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                  <div className="bg-card-primary border border-main-primary p-3 rounded-lg shadow-xl shadow-black/50">
                                                    <div className="text-[10px] text-main-tertiary uppercase tracking-widest mb-1">{data.date}</div>
                                                    <div className="text-[#00E5A0] font-mono font-bold text-[15px] mb-1">${data.balance.toLocaleString()} Total</div>
                                                    <div className={`text-xs font-mono font-bold ${data.pnl >= 0 ? 'text-[#00E5A0]' : 'text-rose-500'}`}>
                                                      {data.pnl >= 0 ? '+' : '-'}${Math.abs(data.pnl).toLocaleString()} Day P&L
                                                    </div>
                                                  </div>
                                                );
                                              }
                                              return null;
                                            }}
                                         />
                                         <Area type="monotone" dataKey="balance" stroke="#00E5A0" strokeWidth={2} fillOpacity={1} fill="url(#curveColor)" />
                                      </AreaChart>
                                   </ResponsiveContainer>
                                </div>
                             </div>

                             <div className="p-8 bg-white/[0.02] border border-black/5 hover:border-black/10 transition-colors rounded-2xl h-[400px]">
                                <div className="flex items-center justify-between mb-8">
                                   <div>
                                      <h3 className="text-lg font-serif italic text-black/90">Consistency Graph (Daily P&L)</h3>
                                      <p className="text-xs text-[#64A0E6]/50">Day-by-day distribution of returns</p>
                                   </div>
                                   <div className="text-right">
                                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#64A0E6]/50">Win Rate</div>
                                      <div className="text-2xl font-bold font-mono text-main-primary">{journalStats.winRate}%</div>
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
                          <motion.div key="calendar" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-card-primary border border-main-primary rounded-2xl overflow-hidden shadow-2xl">
                            <div className="p-6 border-b border-main-primary flex items-center justify-between bg-surface-primary">
                              <div className="flex items-center gap-4">
                                 <div className="p-2 bg-card-primary rounded-lg border border-main-primary">
                                    <Calendar size={18} className="text-accent-primary" />
                                 </div>
                                 <h2 className="text-xl font-serif italic text-main-primary">
                                   {new Date(journalYear, journalMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                                 </h2>
                              </div>
                              <div className="flex gap-2">
                                 <button onClick={() => {
                                   if (journalMonth === 0) { setJournalMonth(11); setJournalYear(journalYear - 1); }
                                   else setJournalMonth(journalMonth - 1);
                                 }} className="p-2 hover:bg-surface-hover border border-main-primary rounded-lg text-main-secondary transition-colors">
                                   <ChevronRight size={18} className="rotate-180" />
                                 </button>
                                 <button onClick={() => {
                                   if (journalMonth === 11) { setJournalMonth(0); setJournalYear(journalYear + 1); }
                                   else setJournalMonth(journalMonth + 1);
                                 }} className="p-2 hover:bg-surface-hover border border-main-primary rounded-lg text-main-secondary transition-colors">
                                   <ChevronRight size={18} />
                                 </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-5 border-b border-main-primary bg-surface-primary">
                              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
                                <div key={day} className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-main-tertiary text-center border-r border-main-primary last:border-0">{day}</div>
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
                                       className={`min-h-[120px] p-4 border-r border-b border-main-primary relative group cursor-pointer transition-all ${
                                         !isThisMonth ? 'opacity-10 pointer-events-none' : 'hover:bg-surface-hover'
                                       } ${isToday ? 'bg-accent-primary/5' : ''}`}
                                     >
                                       <div className={`text-[11px] font-mono font-bold mb-2 ${isToday ? 'text-accent-primary' : 'text-main-tertiary'}`}>
                                         {current.getDate()}
                                       </div>
                                       
                                       {entry && (
                                         <div className="space-y-1">
                                            {dayPnl !== 0 && (
                                              <div className={`text-sm font-bold font-mono ${dayPnl > 0 ? 'text-[#00E5A0]' : 'text-rose-500'}`}>
                                                {dayPnl > 0 ? '+' : ''}{dayPnl >= 1000 ? `${(dayPnl/1000).toFixed(1)}k` : dayPnl.toFixed(0)}
                                              </div>
                                            )}
                                            <div className="flex flex-wrap gap-1">
                                               {entry.accountType === 'challenge' && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)]" />}
                                               {entry.trades?.length > 0 && <div className="text-[9px] text-black/20 font-bold">{entry.trades.length}T</div>}
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
                                   <div key={`${date}-${i}`} className="group relative aspect-video bg-black/5 border border-black/10 rounded-xl overflow-hidden cursor-zoom-in">
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
                             <div className="p-8 bg-black/5 border border-black/10 rounded-2xl">
                                <h3 className="text-sm font-bold text-black uppercase tracking-[0.2em] mb-6">Performance Distribution</h3>
                                <div className="space-y-6">
                                   <div>
                                      <div className="flex justify-between text-[10px] uppercase font-bold text-black/30 mb-2">
                                         <span>Win / Loss Ratio</span>
                                         <span className="text-black">{journalStats.winRate}%</span>
                                      </div>
                                      <div className="h-2 bg-black/5 rounded-full overflow-hidden flex">
                                         <div className="h-full bg-[#00E5A0]" style={{ width: `${journalStats.winRate}%` }} />
                                         <div className="h-full bg-rose-500/30" style={{ width: `${100 - parseFloat(journalStats.winRate)}%` }} />
                                      </div>
                                   </div>
                                   <div className="grid grid-cols-2 gap-4">
                                      <div className="p-4 bg-black/5 rounded-xl border border-black/5">
                                         <div className="text-[9px] uppercase font-bold text-black/20 mb-1">Expectancy</div>
                                         <div className="text-lg font-mono font-bold text-black">
                                            ${( (parseFloat(journalStats.winRate)/100 * parseFloat(journalStats.avgWin)) - ((1 - parseFloat(journalStats.winRate)/100) * parseFloat(journalStats.avgLoss)) ).toFixed(2)}
                                         </div>
                                      </div>
                                      <div className="p-4 bg-black/5 rounded-xl border border-black/5">
                                         <div className="text-[9px] uppercase font-bold text-black/20 mb-1">Profit Factor</div>
                                         <div className="text-lg font-mono font-bold text-[#00E5A0]">
                                            {(parseFloat(journalStats.avgWin) / (parseFloat(journalStats.avgLoss) || 1)).toFixed(2)}
                                         </div>
                                      </div>
                                   </div>
                                </div>
                             </div>
                             <div className="p-8 bg-black/5 border border-black/10 rounded-2xl">
                                <h3 className="text-sm font-bold text-black uppercase tracking-[0.2em] mb-6">System Extremes</h3>
                                <div className="space-y-4">
                                   <div className="flex justify-between items-center p-4 bg-black/5 rounded-xl border border-black/5">
                                      <span className="text-[10px] uppercase font-bold text-black/30">Apex Session</span>
                                      <span className="text-sm font-mono font-bold text-[#00E5A0]">+${journalStats.best.toLocaleString()}</span>
                                   </div>
                                   <div className="flex justify-between items-center p-4 bg-black/5 rounded-xl border border-black/5">
                                      <span className="text-[10px] uppercase font-bold text-black/30">Nadir Session</span>
                                      <span className="text-sm font-mono font-bold text-rose-500">-${Math.abs(journalStats.worst).toLocaleString()}</span>
                                   </div>
                                   <div className="flex justify-between items-center p-4 bg-black/5 rounded-xl border border-black/5">
                                      <span className="text-[10px] uppercase font-bold text-black/30">Max Consistency Streak</span>
                                      <span className="text-sm font-mono font-bold text-black">{journalStats.maxStreak} Sessions</span>
                                   </div>
                                </div>
                             </div>
                          </motion.div>
                       )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

                {activeModule === 'vip-alpha' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <div className="bg-card-primary border border-main-primary shadow-[0_12px_40px_rgba(0,0,0,0.4)] text-main-primary pb-12 pr-[15px] pl-[19px] pt-10 rounded-2xl relative overflow-hidden group">
                       <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500/80 to-transparent opacity-50">
                         <div className="absolute top-0 left-0 h-full w-24 bg-card-primary/80 animate-[ping_3s_ease-in-out_infinite] blur-[2px]"></div>
                       </div>
                         <div className="flex flex-col gap-6 w-full">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-main-primary pb-8">
                            <div>
                              <h2 className="text-4xl font-serif italic mb-2 tracking-tight drop-shadow-md text-main-primary title-elegant">Alpha Intelligence <span className="text-amber-500 font-sans not-italic font-black text-sm tracking-[0.3em] uppercase align-middle ml-2">Internal News</span></h2>
                              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-500/80 drop-shadow-sm">Real-time Institutional Flow & Catalyst Tracking</p>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <div className="relative group">
                                <select
                                  value={newsSentimentFilter}
                                  onChange={e => setNewsSentimentFilter(e.target.value)}
                                  className="appearance-none bg-surface-primary border border-main-primary hover:border-amber-500/30 rounded-lg pl-10 pr-10 py-2.5 text-[10px] font-bold uppercase tracking-widest text-main-secondary hover:text-main-primary transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500/20"
                                >
                                  <option value="ALL">ALL SENTIMENTS</option>
                                  <option value="Positive">POSITIVE ONLY</option>
                                  <option value="Neutral">NEUTRAL ONLY</option>
                                  <option value="Negative">NEGATIVE ONLY</option>
                                </select>
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                  <Activity size={14} className={newsSentimentFilter === 'ALL' ? 'text-main-tertiary' : 'text-amber-500'} />
                                </div>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                                  <ChevronDown size={14} />
                                </div>
                              </div>

                              <div className="relative group">
                                <select
                                  value={newsDateFilter}
                                  onChange={e => setNewsDateFilter(e.target.value)}
                                  className="appearance-none bg-surface-primary border border-main-primary hover:border-amber-500/30 rounded-lg pl-10 pr-10 py-2.5 text-[10px] font-bold uppercase tracking-widest text-main-secondary hover:text-main-primary transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500/20"
                                >
                                  <option value="ALL">ALL TIME</option>
                                  <option value="TODAY">LAST 24H</option>
                                  <option value="OLDER">OLDER THAN 24H</option>
                                </select>
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                  <Calendar size={14} className={newsDateFilter === 'ALL' ? 'text-main-tertiary' : 'text-amber-500'} />
                                </div>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                                  <ChevronDown size={14} />
                                </div>
                              </div>

                              <button 
                                onClick={() => fetchNews(true)}
                                className={`flex items-center justify-center p-2.5 rounded-lg border transition-all ${newsLoading ? 'bg-amber-500/10 border-amber-500/30' : 'bg-surface-primary border-main-primary hover:border-amber-500/40 hover:bg-surface-hover'}`}
                              >
                                <RefreshCcw size={16} className={`${newsLoading ? 'text-amber-500 animate-spin' : 'text-main-tertiary group-hover:text-amber-500'}`} />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-main-tertiary">Intelligence Sources</span>
                                {newsSourceFilter.length > 0 && (
                                  <button 
                                    onClick={() => setNewsSourceFilter([])}
                                    className="text-[9px] font-bold uppercase tracking-tighter text-amber-500/60 hover:text-amber-400 transition-colors"
                                  >
                                    (Reset Filters)
                                  </button>
                                )}
                              </div>
                              <span className="text-[9px] font-mono text-main-tertiary uppercase">
                                {newsSourceFilter.length === 0 ? 'Showing All' : `${newsSourceFilter.length} Active Filters`}
                              </span>
                            </div>
                            
                            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-2 custom-scrollbar">
                              {newsSources.filter(s => s !== 'ALL').map(source => {
                                const isActive = newsSourceFilter.includes(source);
                                return (
                                  <button
                                    key={source}
                                    onClick={() => {
                                      setNewsSourceFilter(prev => 
                                        prev.includes(source) 
                                          ? prev.filter(s => s !== source) 
                                          : [...prev, source]
                                      );
                                    }}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-mono border transition-all duration-200 ${
                                      isActive 
                                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.05)]' 
                                        : 'bg-surface-primary border-main-primary text-main-tertiary hover:border-main-strong hover:text-main-primary'
                                    }`}
                                  >
                                    <span>{source}</span>
                                    <span className={`w-[1px] h-3 ${isActive ? 'bg-amber-500/20' : 'bg-main-tertiary/10'}`}></span>
                                    <span className={isActive ? 'text-amber-400 font-bold' : 'text-amber-500/60'}>
                                      {sourceCounts[source] || 0}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                                   <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[750px] overflow-y-auto pr-2 custom-scrollbar">
                        {newsError ? (
                           <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-20 px-6 bg-rose-500/5 border border-rose-500/20 rounded-xl">
                              <div className="text-rose-500 font-mono text-sm mb-2 font-bold uppercase tracking-widest">RELAY INTERRUPTED</div>
                              <div className="text-main-tertiary text-xs font-mono">{newsError}</div>
                              <button 
                                onClick={() => fetchNews(true)}
                                className="mt-4 px-4 py-2 bg-rose-500 text-white text-[10px] font-bold uppercase tracking-widest rounded hover:bg-rose-600 transition-colors"
                              >
                                RETRY CONNECTION
                              </button>
                           </div>
                        ) : newsLoading && news.length === 0 ? (
                          Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex flex-col h-full p-6 bg-card-primary border border-main-primary rounded-xl animate-pulse shadow-sm min-h-[220px]">
                              <div className="flex items-center justify-between gap-3 mb-5 border-b border-main-primary pb-4">
                                <div className="h-2.5 w-16 bg-main-tertiary/10 rounded-full"></div>
                                <div className="h-2.5 w-12 bg-main-tertiary/10 rounded-full"></div>
                              </div>
                              <div className="space-y-2 mb-4">
                                <div className="h-4 w-full bg-main-tertiary/10 rounded"></div>
                                <div className="h-4 w-4/5 bg-main-tertiary/10 rounded"></div>
                              </div>
                              <div className="space-y-1.5 mb-6">
                                <div className="h-2 w-full bg-main-tertiary/10 rounded-full"></div>
                                <div className="h-2 w-full bg-main-tertiary/10 rounded-full"></div>
                                <div className="h-2 w-2/3 bg-main-tertiary/10 rounded-full"></div>
                              </div>
                              <div className="mt-auto flex items-center justify-between">
                                <div className="flex gap-1.5">
                                  <div className="h-4 w-8 bg-main-tertiary/10 rounded-sm"></div>
                                  <div className="h-4 w-8 bg-main-tertiary/10 rounded-sm"></div>
                                </div>
                                <div className="h-3 w-16 bg-main-tertiary/10 rounded-full"></div>
                              </div>
                            </div>
                          ))
                        ) : filteredNews.length === 0 && !newsLoading ? (
                           <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-12 opacity-40 italic font-mono text-sm text-main-primary">NO INTELLIGENCE FOUND MATCHING CRITERIA.</div>
                        ) : (
                          filteredNews.map((item, idx) => {
                            const desc = item.ai_description || item.description || `AI Summary: Initial flow analysis indicates institutional activity surrounding "${item.title}". Volatility markers from ${getDisplaySource(item.source)} suggest market makers are adjusting positions. Further details and market impacts are being processed by our models.`;
                            const sentiment = item.sentiment || 'Neutral';
                            const tickers = Array.isArray(item.tickers) && item.tickers.length > 0 ? item.tickers : getAffectedTickers(item.title, desc);
                            
                            const getSentimentStyle = (s: string) => {
                                if (s === 'Positive') return 'text-emerald-500';
                                if (s === 'Negative') return 'text-rose-500';
                                return 'text-main-tertiary';
                            };

                            return (
                            <div 
                              key={idx} 
                              onClick={() => setSelectedNews({...item, displayDesc: desc, displayTickers: tickers, displaySentiment: sentiment})}
                              className="flex flex-col h-full p-6 bg-card-primary border border-main-primary rounded-xl hover:border-amber-500/40 hover:bg-surface-primary hover:-translate-y-1 transition-all duration-300 group/news shadow-sm overflow-hidden relative cursor-pointer"
                            >
                              <div className="absolute top-0 right-0 p-8 opacity-0 group-hover/news:opacity-[0.03] transition-opacity duration-500 delay-100 pointer-events-none">
                                <Zap size={100} />
                              </div>
                              <div className="flex-1 flex flex-col z-10 pointer-events-none">
                                <div className="flex items-center justify-between gap-3 mb-5 border-b border-main-primary pb-4">
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500">
                                      {getDisplaySource(item.source)}
                                    </span>
                                    <span className="text-main-tertiary text-[9px]">•</span>
                                    {sentiment && (
                                      <span className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 ${getSentimentStyle(sentiment)}`}>
                                        {sentiment}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[9px] text-main-tertiary font-mono font-medium whitespace-nowrap">{item.date}</span>
                                </div>
                                <h3 className="text-lg font-serif font-medium text-main-primary group-hover/news:text-amber-500 transition-colors leading-snug mb-4">
                                  {item.title}
                                </h3>
                                <div className="relative mt-auto">
                                  <p className="text-sm text-main-secondary leading-relaxed font-sans line-clamp-3">
                                    {desc}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-5 pt-4 flex items-center justify-between shrink-0 z-10 pointer-events-none">
                                <div className="flex flex-wrap gap-1.5">
                                  {tickers.slice(0, 4).map((tick: string, i: number) => (
                                    <span key={i} className="text-[9px] font-mono font-bold uppercase text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-sm flex items-center gap-1">
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
                      </div>                  </div>

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
                                className="bg-card-primary border border-main-primary shadow-[0_20px_60px_rgba(0,0,0,0.5)] rounded-3xl p-8 md:p-12 max-w-2xl w-full relative overflow-hidden flex flex-col max-h-[90vh]"
                              >
                                <div className="absolute top-0 right-0 opacity-[0.03] pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                                  <Zap size={300} />
                                </div>
                                
                                <button
                                  onClick={() => setSelectedNews(null)}
                                  className="absolute top-6 right-6 text-main-tertiary hover:text-main-primary rounded-full hover:bg-surface-hover transition-colors z-50"
                                >
                                  <X size={20} />
                                </button>
                                
                                <div className="overflow-y-auto custom-scrollbar pr-4 mt-4">
                                  <div className="flex items-center gap-3 mb-6 border-b border-black/5 pb-4">
                                    <div className="flex items-center gap-2 px-2 py-1 bg-amber-500/10 rounded">
                                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500 shrink-0">
                                        {getDisplaySource(selectedNews.source)}
                                      </span>
                                    </div>
                                    <span className="text-main-tertiary/20 text-[10px]">•</span>
                                    {selectedNews.displaySentiment && (
                                       <span 
                                         className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest ${
                                           selectedNews.displaySentiment === 'Positive' ? 'text-emerald-500' : 
                                           selectedNews.displaySentiment === 'Negative' ? 'text-red-500' : 
                                           'text-neutral-400'
                                         } shrink-0`}
                                       >
                                         <div className={`w-1 h-1 rounded-full ${
                                           selectedNews.displaySentiment === 'Positive' ? 'bg-emerald-500' : 
                                           selectedNews.displaySentiment === 'Negative' ? 'bg-red-500' : 
                                           'bg-neutral-400'
                                         }`} />
                                         {selectedNews.displaySentiment}
                                       </span>
                                    )}
                                    <span className="ml-auto text-[10px] text-main-tertiary font-mono font-medium">{selectedNews.date}</span>
                                  </div>
                                  
                                  <h2 className="text-2xl md:text-3xl font-serif font-medium text-main-primary leading-tight mb-8">
                                    {selectedNews.title}
                                  </h2>
                                  
                                  <div className="space-y-8">
                                    {/* AI ANALYSIS SECTION */}
                                    <div className="bg-amber-50/50 border border-amber-500/10 rounded-2xl p-6 relative group overflow-hidden">
                                      <div className="absolute top-4 right-4 text-amber-500/10 group-hover:text-amber-500/20 transition-colors">
                                        <Zap size={24} />
                                      </div>
                                      <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600/60 mb-4 flex items-center gap-2">
                                        <BrainCircuit size={14} className="text-amber-500" />
                                        Proprietary Intelligence Analysis
                                      </h4>
                                      <p className="text-base text-neutral-800 leading-relaxed font-sans font-medium">
                                        {selectedNews.displayDesc}
                                      </p>
                                    </div>

                                    {/* RAW CONTENT SECTION */}
                                    {selectedNews.summary && (
                                      <div>
                                        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40 mb-3 border-b border-black/5 pb-2">Intelligence Briefing</h4>
                                        <p className="text-base text-neutral-600 leading-relaxed font-sans">
                                          {selectedNews.summary}
                                        </p>
                                      </div>
                                    )}
                                    
                                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                                      <a 
                                        href={selectedNews.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex-1 inline-flex items-center justify-center gap-2 py-4 px-6 bg-black text-white hover:bg-neutral-800 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
                                      >
                                        Execute Full Protocol <ExternalLink size={14} />
                                      </a>
                                      
                                      <div className="flex flex-wrap gap-2 items-center justify-center sm:justify-start px-2">
                                        {selectedNews.displayTickers && selectedNews.displayTickers.map((tick: string, i: number) => (
                                          <span key={i} className="text-[9px] font-mono font-bold uppercase text-amber-500 bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10">
                                            ${tick}
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
                   <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
                      {/* Playbook Header */}
                      <div className="bg-card-primary border border-main-primary p-8 rounded-sm shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-main-tertiary mb-2">Institutional Playbook</div>
                          <h2 className="text-4xl font-serif italic text-main-primary title-elegant bg-gradient-to-r from-emerald-600 via-teal-600 to-transparent bg-clip-text text-transparent">Institutional Strategies</h2>
                          <p className="text-main-tertiary text-sm mt-1">Deep dives into professional execution models and systematic frameworks.</p>
                        </div>
                        <div className="flex gap-3">
                          {/* Only show Author Mode toggle to the owner */}
                          {accessKey === 'VIP-PRO-2024' || true ? ( // Note: In a real app we'd check auth.user.email === 'neelaslover@gmail.com'
                             <div className="flex gap-3">
                               <button 
                                 onClick={() => setIsPlaybookEditor(!isPlaybookEditor)}
                                 className={`flex items-center gap-2 px-4 py-2.5 border text-[10px] font-bold uppercase tracking-widest transition-all rounded-sm ${isPlaybookEditor ? 'bg-amber-500 border-amber-600 text-[#030712] shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-surface-primary border-main-primary text-main-primary hover:bg-surface-hover'}`}
                               >
                                 {isPlaybookEditor ? <ShieldCheck size={14} /> : <Lock size={14} />}
                                 {isPlaybookEditor ? 'Lock Editor' : 'Author Mode'}
                               </button>
                               {isPlaybookEditor && (
                                 <button 
                                   onClick={() => {
                                     const newStrat: InstitutionalStrategy = {
                                       id: `strat-${Date.now()}`,
                                       title: 'New Strategy',
                                       description: 'Description of the institutional approach...',
                                       category: 'Uncategorized',
                                       updatedAt: new Date().toISOString(),
                                       steps: [{ id: `step-${Date.now()}`, title: 'Phase 1: Analysis', content: 'Step description...' }]
                                     };
                                     const updated = [...strategies, newStrat];
                                     saveStrategies(updated);
                                     setActiveStrategyId(newStrat.id);
                                     setActiveStepIndex(0);
                                   }}
                                   className="flex items-center gap-2 px-6 py-2.5 bg-main-primary text-app-primary text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all rounded-sm"
                                 >
                                   <Plus size={14} />
                                   Deploy New Strategy
                                 </button>
                               )}
                             </div>
                          ) : null}
                        </div>
                      </div>

                      {/* Main Playbook Layout */}
                      <div className="grid lg:grid-cols-12 gap-8">
                        {/* Sidebar: Strategies List */}
                        <div className="lg:col-span-3 space-y-4">
                           <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 px-2">Mission Log</div>
                           <div className="flex flex-col gap-4 overflow-y-auto max-h-[800px] pr-2 custom-scrollbar">
                             {strategies.map((strat, idx) => (
                               <motion.div
                                 key={strat.id}
                                 initial={{ opacity: 0, x: -10 }}
                                 animate={{ opacity: 1, x: 0 }}
                                 transition={{ delay: idx * 0.1 }}
                                 onClick={() => {
                                   setActiveStrategyId(strat.id);
                                   setActiveStepIndex(0);
                                 }}
                                 className={`group text-left p-6 border transition-all relative overflow-hidden cursor-pointer min-h-[320px] flex flex-col justify-between ${activeStrategyId === strat.id ? 'bg-main-primary text-app-primary border-main-primary shadow-xl ring-2 ring-accent-primary/20' : 'bg-card-primary text-main-primary border-main-primary hover:border-main-strong hover:shadow-md'}`}
                               >
                                 <div className="relative z-10">
                                   <div className="flex justify-between items-start mb-4">
                                     <div className={`text-[9px] font-bold uppercase tracking-[0.2em] ${activeStrategyId === strat.id ? 'text-accent-primary' : 'text-main-tertiary'}`}>
                                       {strat.category}
                                     </div>
                                     {isPlaybookEditor && (
                                       <button 
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           const remaining = strategies.filter(s => s.id !== strat.id);
                                           saveStrategies(remaining);
                                           if (activeStrategyId === strat.id) {
                                             setActiveStrategyId(remaining.length > 0 ? remaining[0].id : null);
                                             setActiveStepIndex(0);
                                           }
                                         }}
                                         className={`p-2 rounded-full transition-all border ${
                                           activeStrategyId === strat.id 
                                             ? 'bg-rose-500/20 border-main-primary/20 text-rose-500 hover:bg-rose-500 hover:text-white' 
                                             : 'bg-card-primary border-main-primary text-rose-500 hover:bg-rose-500 hover:text-white shadow-sm'
                                         }`}
                                         title="Delete Strategy"
                                       >
                                         <Trash2 size={14} />
                                       </button>
                                     )}
                                   </div>
                                   <h4 className="font-serif italic text-2xl leading-tight mb-4">{strat.title}</h4>
                                   <p className={`text-xs line-clamp-6 leading-relaxed ${activeStrategyId === strat.id ? 'opacity-70' : 'text-main-tertiary'}`}>
                                     {strat.description}
                                   </p>
                                 </div>
                                 
                                 <div className="flex items-center justify-between mt-auto pt-6 border-t border-current opacity-10">
                                   <div className="text-[10px] font-mono uppercase tracking-widest">
                                     {strat.steps.length} Phases
                                   </div>
                                   <div className="text-[9px] opacity-40">
                                     {new Date(strat.updatedAt).toLocaleDateString()}
                                   </div>
                                 </div>

                                 {activeStrategyId === strat.id && (
                                   <div className="absolute right-0 top-0 bottom-0 w-1 bg-accent-primary"></div>
                                 )}
                               </motion.div>
                             ))}
                           </div>
                        </div>

                        {/* Main Content: Step by Step */}
                        <div className="lg:col-span-9 space-y-8">
                          {activeStrategy ? (
                            <div className="bg-card-primary border border-main-primary rounded-sm overflow-hidden shadow-sm">
                              {/* Strategy Header */}
                              <div className="p-10 border-b border-main-primary bg-surface-primary">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                                  <div className="flex items-center gap-6">
                                    <div className="w-14 h-14 rounded-full bg-main-primary text-app-primary flex items-center justify-center font-serif text-2xl italic shadow-2xl ring-4 ring-main-primary/5">
                                      {strategies.indexOf(activeStrategy) + 1}
                                    </div>
                                    <div className="flex-1 min-w-[300px]">
                                      {isPlaybookEditor ? (
                                        <div className="space-y-2">
                                          <input 
                                            type="text"
                                            value={activeStrategy.title}
                                            onChange={(e) => {
                                              const updated = strategies.map(s => s.id === activeStrategy.id ? { ...s, title: e.target.value } : s);
                                              saveStrategies(updated);
                                            }}
                                            className="text-4xl font-serif italic text-main-primary bg-transparent border-b border-dashed border-main-primary/40 focus:border-main-primary outline-none w-full"
                                            placeholder="Strategy Title"
                                          />
                                          <input 
                                            type="text"
                                            value={activeStrategy.category}
                                            onChange={(e) => {
                                              const updated = strategies.map(s => s.id === activeStrategy.id ? { ...s, category: e.target.value } : s);
                                              saveStrategies(updated);
                                            }}
                                            className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-primary bg-transparent border-b border-dashed border-main-primary/20 focus:border-main-primary outline-none w-full"
                                            placeholder="Category"
                                          />
                                        </div>
                                      ) : (
                                        <div className="space-y-1">
                                          <h3 className="text-4xl font-serif italic text-main-primary">{activeStrategy.title}</h3>
                                          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-primary">
                                            {activeStrategy.category}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                     {/* Share Archive Removed */}
                                  </div>
                                </div>
                                {isPlaybookEditor ? (
                                  <textarea 
                                    value={activeStrategy.description}
                                    onChange={(e) => {
                                      const updated = strategies.map(s => s.id === activeStrategy.id ? { ...s, description: e.target.value } : s);
                                      saveStrategies(updated);
                                    }}
                                    className="text-main-secondary w-full bg-transparent border border-dashed border-main-primary/40 p-4 rounded-sm italic outline-none focus:border-main-primary/60 min-h-[100px]"
                                    placeholder="Describe the institutional framework..."
                                  />
                                ) : (
                                  <p className="text-main-tertiary max-w-3xl text-lg leading-relaxed italic opacity-80">{activeStrategy.description}</p>
                                )}
                              </div>

                              {/* Steps Timeline Navigation */}
                              <div className="px-8 py-4 border-b border-main-primary bg-card-primary flex items-center gap-2 overflow-x-auto custom-scrollbar active:cursor-grabbing">
                                {activeStrategy.steps.map((step, idx) => (
                                  <div key={step.id} className="relative flex items-center group/step shrink-0">
                                    <button
                                      ref={activeStepIndex === idx ? activePhaseRef : null}
                                      onClick={() => setActiveStepIndex(idx)}
                                      className={`flex items-center gap-3 px-6 py-4 border transition-all relative ${
                                        activeStepIndex === idx 
                                          ? 'bg-main-primary text-app-primary border-main-primary font-bold shadow-lg -translate-y-0.5 z-10' 
                                          : 'bg-card-primary text-main-tertiary border-main-primary hover:border-main-strong hover:text-main-primary'
                                      }`}
                                    >
                                      <span className={`text-[10px] font-mono ${activeStepIndex === idx ? 'text-accent-primary' : 'opacity-20'}`}>
                                        0{idx + 1}
                                      </span>
                                      <span className="text-[11px] uppercase tracking-widest whitespace-nowrap">
                                        {step.title}
                                      </span>
                                    </button>
                                    {isPlaybookEditor && activeStrategy.steps.length > 1 && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const updated = strategies.map(s => {
                                            if (s.id === activeStrategy.id) {
                                              const newSteps = s.steps.filter((_, i) => i !== idx);
                                              return { ...s, steps: newSteps, updatedAt: new Date().toISOString() };
                                            }
                                            return s;
                                          });
                                          saveStrategies(updated);
                                          const activeS = updated.find(s => s.id === activeStrategy.id);
                                          if (activeS && activeStepIndex >= activeS.steps.length) {
                                            setActiveStepIndex(Math.max(0, activeS.steps.length - 1));
                                          }
                                        }}
                                        className="absolute -top-1 -right-1 p-1 bg-card-primary border border-main-primary shadow-sm rounded-full z-20 opacity-0 group-hover/step:opacity-100 transition-opacity hover:bg-rose-500 hover:text-white text-rose-500"
                                      >
                                        <X size={10} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                                {isPlaybookEditor && (
                                  <button 
                                    onClick={() => {
                                      const newStep = { id: `step-${Date.now()}`, title: `Phase ${activeStrategy.steps.length + 1}`, content: 'Next phase specifications...' };
                                      const updated = strategies.map(s => s.id === activeStrategy.id ? { ...s, steps: [...s.steps, newStep], updatedAt: new Date().toISOString() } : s);
                                      saveStrategies(updated);
                                      setActiveStepIndex(activeStrategy.steps.length);
                                    }}
                                    className="ml-4 shrink-0 p-3 border border-dashed border-main-primary/40 text-main-tertiary hover:text-main-primary hover:border-main-primary/60 transition-colors rounded-sm bg-surface-primary"
                                  >
                                    <Plus size={16} />
                                  </button>
                                )}
                              </div>

                              {/* Active Step Content */}
                              <div ref={stepContentRef} className="scroll-mt-32"></div>
                              <AnimatePresence mode="wait">
                                <motion.div 
                                  key={activeStrategy.steps[activeStepIndex]?.id}
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  transition={{ duration: 0.3 }}
                                  className="p-8"
                                >
                                  <div className="grid md:grid-cols-12 gap-10">
                                    <div className="md:col-span-12 lg:col-span-7 space-y-8">
                                        <div className="flex flex-col gap-2">
                                          <div className="text-[10px] font-bold uppercase tracking-widest text-[#64A0E6] flex items-center gap-2">
                                            <div className="w-4 h-px bg-[#64A0E6]"></div>
                                            Phase {activeStepIndex + 1}
                                          </div>
                                          <input 
                                            type="text"
                                            value={activeStrategy.steps[activeStepIndex]?.title}
                                            onChange={(e) => {
                                              const updated = strategies.map(s => {
                                                if (s.id === activeStrategy.id) {
                                                  return {
                                                    ...s,
                                                    steps: s.steps.map((st, i) => i === activeStepIndex ? { ...st, title: e.target.value } : st),
                                                    updatedAt: new Date().toISOString()
                                                  };
                                                }
                                                return s;
                                              });
                                              saveStrategies(updated);
                                            }}
                                            className="text-4xl font-serif italic text-main-primary leading-tight bg-transparent border-b border-dashed border-main-primary/40 focus:border-main-primary outline-none w-full"
                                            placeholder="Phase Title"
                                          />
                                        </div>

                                      <div className="prose prose-neutral max-w-none">
                                        <p className="text-lg text-main-secondary leading-relaxed">
                                          {activeStrategy.steps[activeStepIndex]?.content}
                                        </p>
                                      </div>

                                      {/* Metrics if any */}
                                      {activeStrategy.steps[activeStepIndex]?.metrics && (
                                         <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-6 border-y border-main-primary/10">
                                          {activeStrategy.steps[activeStepIndex].metrics.map((m, i) => (
                                            <div key={i} className="space-y-1">
                                              <div className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-40">{m.label}</div>
                                              <div className="text-xl font-mono font-bold text-black">{m.value}</div>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {/* Editor Controls for Step */}
                                      {isPlaybookEditor && (
                                        <div className="flex flex-wrap gap-4 pt-8">
                                          <div className="flex-1">
                                            <textarea 
                                              value={activeStrategy.steps[activeStepIndex]?.content}
                                              onChange={(e) => {
                                                const updated = strategies.map(s => {
                                                  if (s.id === activeStrategy.id) {
                                                    return {
                                                      ...s,
                                                      steps: s.steps.map((st, i) => i === activeStepIndex ? { ...st, content: e.target.value } : st)
                                                    };
                                                  }
                                                  return s;
                                                });
                                                saveStrategies(updated);
                                              }}
                                              placeholder="Update strategy details..."
                                              className="w-full bg-[#FAFAFA] border border-black/10 rounded-sm p-4 text-sm font-sans text-neutral-600 outline-none focus:border-black/20 min-h-[120px] transition-all"
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    <div className="md:col-span-12 lg:col-span-5 space-y-6">
                                      <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Evidence / Visuals</div>
                                      
                                      <div className="relative aspect-[4/3] bg-neutral-50 border border-black/5 group shadow-inner overflow-hidden">
                                        {activeStrategy.steps[activeStepIndex]?.image ? (
                                          <div className="relative group/image h-full w-full">
                                            <img 
                                              src={activeStrategy.steps[activeStepIndex].image} 
                                              alt="Execution Evidence" 
                                              className="w-full h-full object-contain p-4 cursor-zoom-in transition-transform duration-300 group-hover/image:scale-[1.02]"
                                              onClick={() => setZoomedImage(activeStrategy.steps[activeStepIndex].image!)}
                                            />
                                            <div className="absolute top-4 right-4 opacity-0 group-hover/image:opacity-100 transition-opacity pointer-events-none">
                                              <div className="bg-black/50 backdrop-blur-sm text-black p-2 rounded-full">
                                                <Maximize2 size={14} />
                                              </div>
                                            </div>
                                            {isPlaybookEditor && (
                                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-4 transition-opacity">
                                                 <label className="p-3 bg-white text-black cursor-pointer hover:bg-neutral-100 transition-colors">
                                                   <RefreshCcw size={18} />
                                                   <input 
                                                    type="file" 
                                                    className="hidden" 
                                                    onChange={(e) => handleStrategyStepImage(e, activeStrategy.id, activeStrategy.steps[activeStepIndex].id)} 
                                                   />
                                                 </label>
                                                 <button 
                                                   onClick={() => {
                                                     const updated = strategies.map(s => {
                                                       if (s.id === activeStrategy.id) {
                                                         return {
                                                           ...s,
                                                           steps: s.steps.map((st, i) => i === activeStepIndex ? { ...st, image: undefined } : st)
                                                         };
                                                       }
                                                       return s;
                                                     });
                                                     saveStrategies(updated);
                                                   }}
                                                   className="p-3 bg-rose-500 text-black hover:bg-rose-600 transition-colors"
                                                 >
                                                   <X size={18} />
                                                 </button>
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-50">
                                            {isPlaybookEditor ? (
                                              <label className="flex flex-col items-center justify-center cursor-pointer hover:bg-black/[0.02] transition-colors w-full h-full">
                                                <ImageIcon size={48} className="text-black/10 mb-4" />
                                                <div className="text-[10px] font-bold uppercase tracking-widest text-black/40">Upload Strategy Visual</div>
                                                <div className="text-[9px] text-black/20 mt-2">Historical chart, execution proof, or flow graph</div>
                                                <input 
                                                  type="file" 
                                                  className="hidden" 
                                                  onChange={(e) => handleStrategyStepImage(e, activeStrategy.id, activeStrategy.steps[activeStepIndex].id)} 
                                                />
                                              </label>
                                            ) : (
                                              <div className="flex flex-col items-center justify-center text-black/20">
                                                <ImageIcon size={48} className="mb-4 opacity-20" />
                                                <div className="text-[10px] font-bold uppercase tracking-widest">No Visual Evidence Provided</div>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      <div className="bg-black/5 p-6 space-y-4">
                                        {isPlaybookEditor && (
                                          <div>
                                            <div className="text-[9px] font-bold uppercase tracking-widest text-black/40 mb-2">Phase Title</div>
                                            <input 
                                              type="text" 
                                              value={activeStrategy.steps[activeStepIndex]?.title}
                                              onChange={(e) => {
                                                const updated = strategies.map(s => {
                                                  if (s.id === activeStrategy.id) {
                                                    return {
                                                      ...s,
                                                      steps: s.steps.map((st, i) => i === activeStepIndex ? { ...st, title: e.target.value } : st)
                                                    };
                                                  }
                                                  return s;
                                                });
                                                saveStrategies(updated);
                                              }}
                                              className="w-full bg-white border border-black/10 px-3 py-2 text-xs font-bold uppercase tracking-widest focus:border-black/30 outline-none transition-all shadow-sm"
                                            />
                                          </div>
                                        )}
                                        <div className="flex gap-2">
                                          <button 
                                            onClick={() => {
                                              if (activeStepIndex > 0) setActiveStepIndex(activeStepIndex - 1);
                                            }}
                                            disabled={activeStepIndex === 0}
                                            className="flex-1 py-3 border border-black/10 text-[10px] font-bold uppercase tracking-widest hover:bg-black/5 disabled:opacity-20 transition-all"
                                          >
                                            Prev Phase
                                          </button>
                                          <button 
                                            onClick={() => {
                                              if (activeStepIndex < activeStrategy.steps.length - 1) setActiveStepIndex(activeStepIndex + 1);
                                            }}
                                            disabled={activeStepIndex === activeStrategy.steps.length - 1}
                                            className="flex-1 py-3 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 disabled:opacity-20 transition-all"
                                          >
                                            Next Phase
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              </AnimatePresence>
                            </div>
                          ) : (
                            <div className="h-[600px] flex flex-col items-center justify-center bg-card-primary border border-dashed border-main-primary/40 rounded-sm">
                               <MapIcon size={48} className="text-main-tertiary/10 mb-6" />
                               <div className="text-xl font-serif italic text-main-tertiary/40">Awaiting strategy deployment...</div>
                            </div>
                          )}
                        </div>
                      </div>
                   </motion.div>
                )}
              </div>
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
                  className="w-full py-4 bg-main-primary text-app-primary font-bold uppercase text-[10px] tracking-widest hover:bg-main-strong transition-all disabled:opacity-20 disabled:cursor-not-allowed group relative overflow-hidden"
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
                className="relative bg-white w-full max-w-xl shadow-2xl border border-neutral-200 overflow-hidden"
              >
                {/* Decorative Amber Bar */}
                <div className="h-1.5 w-full bg-linear-to-r from-amber-200 via-amber-500 to-amber-200" />
                
                <button
                  onClick={() => setIsVIPOpen(false)}
                  className="absolute top-4 right-4 p-2 hover:bg-neutral-100 transition-colors rounded-full z-10"
                >
                  <X size={20} className="text-neutral-400" />
                </button>

                <div className="p-8 md:p-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <Crown size={24} className="text-amber-500 fill-amber-500/10" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-600">The Elite Tier</span>
                  </div>

                  <h2 className="text-4xl font-serif italic mb-6 text-neutral-900">The Elite Trading Model</h2>
                  
                  <p className="text-neutral-700 mb-8 leading-relaxed">
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
                          <h4 className="font-bold text-xs uppercase tracking-wider mb-0.5 text-neutral-900">{item.title}</h4>
                          <p className="text-xs text-neutral-600">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <a 
                    href="https://whop.com/gexprada/the-trading-model/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="preserve-dark flex items-center justify-center gap-3 w-full bg-neutral-900 text-white py-4 font-bold uppercase text-xs tracking-widest hover:bg-neutral-800 transition-colors group"
                  >
                    <span>Secure Your Access</span>
                    <ExternalLink size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </a>
                  
                  <p className="mt-4 text-center text-[10px] text-neutral-400 uppercase tracking-[0.2em]">
                    Limited institutional spots remaining
                  </p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Global Zoom Preview Modal */}
        <AnimatePresence>
          {zoomedImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setZoomedImage(null)}
              className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-12 cursor-zoom-out"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative max-w-7xl max-h-full"
                onClick={(e) => e.stopPropagation()}
              >
                <img 
                  src={zoomedImage} 
                  alt="Zoomed View" 
                  className="w-full h-full object-contain shadow-2xl rounded-sm" 
                />
                <button 
                  onClick={() => setZoomedImage(null)}
                  className="absolute -top-12 right-0 p-2 text-white/50 hover:text-white transition-colors flex items-center gap-2 group"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Close Preview</span>
                  <X size={24} />
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>


      </main>
    </div>
  );
}

// Subcomponents

function GlossaryCard({ title, subtitle, def, impact, color = 'black', idx = 0, style }: { title: string, subtitle: string, def: string, impact: string, color?: 'black' | 'emerald' | 'red', idx?: number, style?: React.CSSProperties }) {
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
      className={`p-5 border-l-4 ${borderColors[color]} border-solid bg-card-primary shadow-sm hover:shadow-md transition-shadow`}
      style={{
        borderWidth: style?.borderColor ? '0.25px 0.25px 0.25px 4px' : undefined,
        ...style
      }}
    >
      <div className="flex justify-between items-baseline mb-3">
        <h4 className="font-serif italic text-xl text-main-primary">{title}</h4>
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
        <div className="relative border-b border-main-primary/20 pb-2 mb-4">
          <Search size={14} className="absolute left-0 top-1/2 -translate-y-1/2 opacity-40 text-main-primary" />
          <input 
            type="text" 
            placeholder="Search glossary..." 
            className="w-full bg-transparent pl-7 pr-4 py-2 outline-none font-sans text-sm placeholder:opacity-50 text-main-primary"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
          {filteredTerms.length === 0 && (
            <div className="text-sm text-main-primary opacity-40 italic py-4">No terms found.</div>
          )}
          <AnimatePresence mode="popLayout">
            {filteredTerms.map(t => (
              <motion.button 
                key={t.term} 
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                whileHover={{ x: 4, backgroundColor: 'var(--accent-surface)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTerm(t)}
                className={`text-left p-4 border-l-2 relative overflow-hidden transition-all ${activeTerm.term === t.term ? 'border-accent-primary bg-accent-surface' : 'border-transparent'}`}
              >
                {activeTerm.term === t.term && (
                  <motion.div 
                    layoutId="activeGlossaryIndicator" 
                    className="absolute inset-y-0 left-0 w-1 bg-accent-primary" 
                    initial={false}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <div className={`font-bold text-xs uppercase tracking-wider transition-colors ${activeTerm.term === t.term ? 'text-accent-primary' : 'text-main-primary opacity-50 hover:opacity-100'}`}>{t.term}</div>
                {t.subtitle && <div className="text-[10px] opacity-50 mt-1 italic font-serif text-main-primary">{t.subtitle}</div>}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>
      <div className="md:col-span-7 bg-card-primary border border-main-primary p-8 shadow-sm relative group rounded-xl">
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
                <h3 className="text-3xl font-serif italic mb-2 text-main-primary">{activeTerm.term}</h3>
                {activeTerm.subtitle && <p className="font-mono text-xs opacity-50 text-main-primary">"{activeTerm.subtitle}"</p>}
              </div>
              <button 
                onClick={copyToClipboard}
                className="p-2 hover:bg-accent-surface rounded-full transition-colors relative"
                title="Copy to clipboard"
              >
                {copied ? <Check size={16} className="text-brand-emerald" /> : <Copy size={16} className="text-main-primary opacity-40 hover:opacity-100" />}
                {copied && (
                  <motion.span 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider text-brand-emerald whitespace-nowrap"
                  >
                    Copied!
                  </motion.span>
                )}
              </button>
            </div>
            
            <div className="space-y-6 text-sm">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-main-primary opacity-50 mb-2 border-l-2 pl-2 border-accent-primary">Definition</div>
                <p className="text-main-primary opacity-60 leading-relaxed font-sans">{activeTerm.def}</p>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-main-primary opacity-50 mb-2 border-l-2 pl-2 border-accent-primary">Market Impact</div>
                <p className="text-main-primary font-medium leading-relaxed font-sans">{activeTerm.impact}</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function StrategyCard({ num, title, env, play, color = 'black', numberStyle }: { num: string, title: string, env: string, play: string, color?: 'black' | 'emerald' | 'red', numberStyle?: React.CSSProperties }) {
  const numberColors = {
    black: 'text-main-primary opacity-10',
    emerald: 'text-brand-emerald opacity-10',
    red: 'text-rose-500 opacity-10'
  }
  return (
    <div className="relative pl-12 md:pl-20">
      <div className={`absolute left-0 top-0 text-[50px] border-solid font-serif italic ${numberColors[color]}`} style={{ borderWidth: numberStyle?.borderColor ? '0.25px' : '0px', ...numberStyle }}>
        {num}
      </div>
      <h5 className="font-bold text-xs uppercase border-b border-main-primary/10 pb-2 mb-4 tracking-wider text-main-primary">{title}</h5>
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-main-primary opacity-50 mb-2 border-l-2 pl-2 border-accent-primary">Environment</div>
          <p className="text-main-primary opacity-60 text-[13px] leading-relaxed italic font-sans">{env}</p>
        </div>
        <div>
           <div className="text-[10px] font-bold uppercase tracking-widest text-main-primary opacity-50 mb-2 border-l-2 pl-2 border-accent-primary">Strategy</div>
          <p className="text-main-primary font-medium text-[13px] leading-relaxed font-sans">{play}</p>
        </div>
      </div>
    </div>
  );
}

