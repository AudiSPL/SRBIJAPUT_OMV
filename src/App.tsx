import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend, Cell, PieChart, Pie, LabelList
} from 'recharts';
import { 
  LayoutDashboard, Fuel, CreditCard, Users, Calendar, 
  ChevronDown, Bell, Settings, Download, Filter, 
  TrendingUp, Clock, AlertCircle, Mail
} from 'lucide-react';
import Papa from 'papaparse';
import { format, parse, isWithinInterval, startOfMonth, startOfWeek, endOfDay, max } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Types ---
interface Transaction {
  LICENSE_PLATE_NO: string;
  GROSS_CC: number;
  PRODUCT_INV: string;
  TRANSACTION_DATE: string;
  parsedDate: Date;
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Card = ({ children, className, title, icon: Icon }: { children: React.ReactNode, className?: string, title?: string, icon?: any }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={cn("bg-[#18181b] border border-[#27272a] rounded-2xl p-6 shadow-xl", className)}
  >
    {title && (
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-medium text-[#a1a1aa] uppercase tracking-wider">{title}</h3>
        {Icon && <Icon className="w-4 h-4 text-[#3b82f6]" />}
      </div>
    )}
    {children}
  </motion.div>
);

const KPICard = ({ title, value, subtext, icon: Icon, trend }: { title: string, value: string, subtext: string, icon: any, trend?: string }) => (
  <Card className="flex flex-col justify-between">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-[#a1a1aa]">{title}</p>
        <h2 className="text-3xl font-bold mt-2 tracking-tight">{value}</h2>
      </div>
      <div className="p-3 bg-[#3b82f6]/10 rounded-xl">
        <Icon className="w-6 h-6 text-[#3b82f6]" />
      </div>
    </div>
    <div className="mt-4 flex items-center gap-2">
      {trend && <span className="text-xs font-medium text-emerald-500">{trend}</span>}
      <p className="text-xs text-[#71717a]">{subtext}</p>
    </div>
  </Card>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#18181b] border border-[#27272a] p-3 rounded-lg shadow-2xl">
        <p className="text-xs font-medium text-[#a1a1aa] mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm font-bold" style={{ color: entry.color }}>
            {entry.name}: {new Intl.NumberFormat('sr-RS', { style: 'currency', currency: 'RSD' }).format(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// --- Main App ---

export default function App() {
  const [data, setData] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewBy, setViewBy] = useState<'Week' | 'Month'>('Month');
  const [dateRange, setDateRange] = useState({ start: '2020-01-01', end: format(new Date(), 'yyyy-MM-dd') });
  const [showSettings, setShowSettings] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/data');
        const csvText = await response.text();
        
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
          complete: (results) => {
            const parsed = results.data.map((row: any) => {
              // Format: DD.MM.YYYY HH:MM:SS
              let date;
              try {
                date = parse(row.TRANSACTION_DATE, 'dd.MM.yyyy HH:mm:ss', new Date());
              } catch (e) {
                date = new Date();
              }
              return {
                ...row,
                GROSS_CC: parseFloat(row.GROSS_CC) || 0,
                parsedDate: date
              };
            }) as Transaction[];
            setData(parsed);
            setLoading(false);
          }
        });
      } catch (error) {
        console.error("Error fetching data:", error);
        setLoading(false);
      }
    };
    fetchData();

    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // --- Filtered Data ---
  const filteredData = useMemo(() => {
    return data.filter(t => {
      const start = new Date(dateRange.start);
      const end = endOfDay(new Date(dateRange.end));
      return isWithinInterval(t.parsedDate, { start, end });
    });
  }, [data, dateRange]);

  // --- Calculations ---
  const stats = useMemo(() => {
    if (filteredData.length === 0) return null;

    const totalSpend = filteredData.reduce((acc, t) => acc + t.GROSS_CC, 0);
    const totalTransactions = filteredData.length;

    // Chart 1: Top 10 users by total spend
    const spendByUser = filteredData.reduce((acc: any, t) => {
      acc[t.LICENSE_PLATE_NO] = (acc[t.LICENSE_PLATE_NO] || 0) + t.GROSS_CC;
      return acc;
    }, {});
    const topUsersBySpend = Object.entries(spendByUser)
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Chart 2: Top 10 users by non-fuel spend
    const nonFuelItems = filteredData.filter(t => {
      const prod = t.PRODUCT_INV?.toUpperCase() || "";
      return !prod.includes("DIZEL") && !prod.includes("BMB") && !prod.includes("MOTION");
    });
    const nonFuelByUser = nonFuelItems.reduce((acc: any, t) => {
      acc[t.LICENSE_PLATE_NO] = (acc[t.LICENSE_PLATE_NO] || 0) + t.GROSS_CC;
      return acc;
    }, {});
    const topUsersByNonFuel = Object.entries(nonFuelByUser)
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Chart 3: Trends
    const top10UserNames = topUsersBySpend.map(u => u.name);
    const trendsMap = filteredData.reduce((acc: any, t) => {
      if (!top10UserNames.includes(t.LICENSE_PLATE_NO)) return acc;
      const dateKey = viewBy === 'Month' 
        ? format(startOfMonth(t.parsedDate), 'MMM yyyy')
        : format(startOfWeek(t.parsedDate), 'dd MMM');
      
      if (!acc[dateKey]) acc[dateKey] = { date: dateKey };
      acc[dateKey][t.LICENSE_PLATE_NO] = (acc[dateKey][t.LICENSE_PLATE_NO] || 0) + t.GROSS_CC;
      return acc;
    }, {});
    const trends = Object.values(trendsMap).sort((a: any, b: any) => {
      const dateA = viewBy === 'Month' 
        ? parse(a.date, 'MMM yyyy', new Date())
        : parse(a.date, 'dd MMM', new Date());
      const dateB = viewBy === 'Month' 
        ? parse(b.date, 'MMM yyyy', new Date())
        : parse(b.date, 'dd MMM', new Date());
      return dateA.getTime() - dateB.getTime();
    });

    // Chart 4: Latest refuelers
    const latestRefuelMap = filteredData.reduce((acc: any, t) => {
      const timeStr = format(t.parsedDate, 'HH:mm:ss');
      if (!acc[t.LICENSE_PLATE_NO] || timeStr > acc[t.LICENSE_PLATE_NO]) {
        acc[t.LICENSE_PLATE_NO] = timeStr;
      }
      return acc;
    }, {});
    const latestRefuelers = Object.entries(latestRefuelMap)
      .map(([name, time]) => ({ name, time: time as string }))
      .sort((a, b) => b.time.localeCompare(a.time))
      .slice(0, 10);

    return {
      totalSpend,
      totalTransactions,
      topUsersBySpend,
      topUsersByNonFuel,
      trends,
      latestRefuelers
    };
  }, [filteredData, viewBy]);

  const handleLegendClick = (o: any) => {
    const { dataKey } = o;
    setSelectedUser(prev => prev === dataKey ? null : dataKey);
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#09090b]">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="flex flex-col items-center gap-4"
        >
          <Fuel className="w-12 h-12 text-[#3b82f6]" />
          <p className="text-[#a1a1aa] font-medium animate-pulse">Učitavanje analitike flote...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] p-4 md:p-8">
      {/* --- Header --- */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/10">
            <Fuel className="w-8 h-8 text-[#3b82f6]" />
            <div className="w-px h-8 bg-white/20 mx-1" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/OMV_logo.svg/1200px-OMV_logo.svg.png" alt="OMV" className="h-8 w-auto object-contain" referrerPolicy="no-referrer" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">SrbijaPut OMV Fleet</h1>
            <p className="text-[#a1a1aa] text-sm">Analitika potrošnje goriva i troškova</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-[#18181b] border border-[#27272a] rounded-xl p-1">
            <button 
              onClick={() => setViewBy('Week')}
              className={cn(
                "px-4 py-1.5 text-xs font-medium rounded-lg transition-all",
                viewBy === 'Week' ? "bg-[#27272a] text-white shadow-sm" : "text-[#71717a] hover:text-white"
              )}
            >
              Nedelja
            </button>
            <button 
              onClick={() => setViewBy('Month')}
              className={cn(
                "px-4 py-1.5 text-xs font-medium rounded-lg transition-all",
                viewBy === 'Month' ? "bg-[#27272a] text-white shadow-sm" : "text-[#71717a] hover:text-white"
              )}
            >
              Mesec
            </button>
          </div>

          <div className="flex items-center gap-2 bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-1.5">
            <Calendar className="w-4 h-4 text-[#71717a]" />
            <input 
              type="date" 
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="bg-transparent text-xs font-medium outline-none text-white cursor-pointer"
            />
            <span className="text-[#71717a] text-xs">do</span>
            <input 
              type="date" 
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="bg-transparent text-xs font-medium outline-none text-white cursor-pointer"
            />
          </div>

          <button 
            onClick={() => window.location.reload()}
            className="p-2.5 bg-[#18181b] border border-[#27272a] rounded-xl hover:bg-[#27272a] transition-colors"
            title="Osveži podatke"
          >
            <Clock className="w-5 h-5 text-[#a1a1aa]" />
          </button>

          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2.5 bg-[#18181b] border border-[#27272a] rounded-xl hover:bg-[#27272a] transition-colors"
          >
            <Settings className="w-5 h-5 text-[#a1a1aa]" />
          </button>
        </div>
      </header>

      {/* --- Main Content --- */}
      <main className="max-w-7xl mx-auto space-y-8">
        
        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <KPICard 
            title="Ukupna potrošnja" 
            value={new Intl.NumberFormat('sr-RS', { style: 'currency', currency: 'RSD' }).format(stats?.totalSpend || 0)}
            subtext="Za sva vozila"
            icon={CreditCard}
            trend="+12.5%"
          />
          <KPICard 
            title="Ukupno transakcija" 
            value={(stats?.totalTransactions || 0).toLocaleString()}
            subtext="Obrađeni logovi goriva"
            icon={Fuel}
          />
          <KPICard 
            title="Aktivna vozila" 
            value={stats?.topUsersBySpend.length.toString() || "0"}
            subtext="Prijavljena u ovom periodu"
            icon={Users}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Chart 1: Top Spend */}
          <Card title="Top 10 vozila po potrošnji" icon={TrendingUp}>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.topUsersBySpend} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#a1a1aa', fontSize: 12 }}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#27272a' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {stats?.topUsersBySpend.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#3b82f680'} />
                    ))}
                    <LabelList 
                      dataKey="value" 
                      position="insideRight" 
                      formatter={(val: number) => new Intl.NumberFormat('sr-RS').format(val)}
                      style={{ fill: '#fff', fontSize: 10, fontWeight: 'bold' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Chart 2: Non-Fuel Spend */}
          <Card title="Troškovi van goriva (Top 10)" icon={Filter}>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.topUsersByNonFuel} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#a1a1aa', fontSize: 12 }}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#27272a' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {stats?.topUsersByNonFuel.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#10b98180'} />
                    ))}
                    <LabelList 
                      dataKey="value" 
                      position="insideRight" 
                      formatter={(val: number) => new Intl.NumberFormat('sr-RS').format(val)}
                      style={{ fill: '#fff', fontSize: 10, fontWeight: 'bold' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Chart 3: Trends */}
          <Card title={`Trendovi potrošnje po ${viewBy === 'Month' ? 'mesecima' : 'nedeljama'}`} className="lg:col-span-2" icon={Calendar}>
            <div className="mb-4 flex items-center gap-2 text-xs text-[#a1a1aa]">
              <AlertCircle className="w-3.5 h-3.5 text-[#3b82f6]" />
              <span>Kliknite na vozilo u legendi da biste izolovali njegov trend</span>
            </div>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats?.trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#a1a1aa', fontSize: 12 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#a1a1aa', fontSize: 12 }}
                    tickFormatter={(val) => `RSD ${val/1000}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="top" 
                    align="right" 
                    iconType="circle"
                    onClick={handleLegendClick}
                    wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', cursor: 'pointer' }}
                  />
                  {stats?.topUsersBySpend.map((user, index) => (
                    <Line 
                      key={user.name}
                      type="monotone" 
                      dataKey={user.name} 
                      stroke={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} 
                      strokeWidth={selectedUser === user.name ? 4 : 2}
                      strokeOpacity={selectedUser === null || selectedUser === user.name ? 1 : 0.1}
                      dot={selectedUser === user.name}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Chart 4: Latest Refuelers */}
          <Card title="Poslednja točenja u danu (Top 10)" icon={Clock}>
            <div className="space-y-4">
              {stats?.latestRefuelers.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-[#27272a]/30 rounded-xl border border-[#27272a]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#3b82f6]/10 flex items-center justify-center text-xs font-bold text-[#3b82f6]">
                      {index + 1}
                    </div>
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#a1a1aa]">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-xs font-mono">{item.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Alert Options / Settings */}
          <AnimatePresence>
            {showSettings && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              >
                <div className="bg-[#18181b] border border-[#27272a] rounded-3xl p-8 max-w-md w-full shadow-2xl">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-bold">Automatizacija i obaveštenja</h2>
                    <button onClick={() => setShowSettings(false)} className="text-[#a1a1aa] hover:text-white">
                      <Settings className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">Dnevni izveštaj putem e-pošte</label>
                      <div className="flex items-center justify-between p-4 bg-[#27272a]/50 rounded-2xl border border-[#27272a]">
                        <div className="flex items-center gap-3">
                          <Mail className="w-5 h-5 text-[#3b82f6]" />
                          <div>
                            <p className="text-sm font-medium">Slanje u 08:00</p>
                            <p className="text-xs text-[#71717a]">Pregled ključnih indikatora flote</p>
                          </div>
                        </div>
                        <div className="w-10 h-5 bg-[#3b82f6] rounded-full relative cursor-pointer">
                          <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">Ručno slanje izveštaja</label>
                      <button 
                        onClick={async () => {
                          try {
                            const res = await fetch('/api/send-summary', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ email: 'milossavin@gmail.com' })
                            });
                            if (res.ok) alert('Izveštaj je poslat na milossavin@gmail.com');
                          } catch (e) {
                            alert('Greška pri slanju');
                          }
                        }}
                        className="w-full py-3 bg-[#18181b] border border-[#27272a] hover:bg-[#27272a] text-white rounded-2xl text-sm font-medium transition-all"
                      >
                        Pošalji testni izveštaj odmah
                      </button>
                    </div>

                    <button 
                      onClick={() => setShowSettings(false)}
                      className="w-full py-3 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-2xl font-bold transition-all shadow-lg shadow-[#3b82f6]/20"
                    >
                      Sačuvaj podešavanja
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </main>

      <footer className="max-w-7xl mx-auto mt-16 pt-8 border-t border-[#27272a] flex flex-col md:flex-row items-center justify-between gap-4 text-[#71717a] text-xs">
        <p>© 2026 SrbijaPut OMV Fleet Intelligence. Sva prava zadržana.</p>
        <div className="flex items-center gap-6">
          <a href="#" className="hover:text-white transition-colors">Dokumentacija</a>
          <a href="#" className="hover:text-white transition-colors">API referenca</a>
          <a href="#" className="hover:text-white transition-colors">Podrška</a>
        </div>
      </footer>
    </div>
  );
}
