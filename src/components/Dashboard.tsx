import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LogOut, 
  User, 
  FileText, 
  Clock, 
  ChevronRight,
  Microscope,
  Cpu,
  Zap
} from 'lucide-react';
import RadiologistView from './RadiologistView';
import DoctorView from './DoctorView';
import AnalyticsView from './AnalyticsView';
import ShiftLog from './ShiftLog';
import Logo from './Logo';

interface DashboardProps {
  user: any;
  onLogout: () => void;
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [cases, setCases] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('cases');
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    const fetchCases = async () => {
      const token = localStorage.getItem('neurox_token');
      if (!token) return;

      try {
        const endpoint = user.role === 'Radiologist' ? '/api/cases/radiologist' : '/api/cases/specialist';
        const response = await fetch(endpoint, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
          setCases(data);
        }
      } catch (error) {
        console.error('Failed to fetch cases', error);
      }
    };

    fetchCases();
    // Poll for updates every 10 seconds in production
    const interval = setInterval(fetchCases, 10000);
    return () => clearInterval(interval);
  }, [user.role]);

  const handleAddCase = (newCase: any) => {
    setCases(prev => [newCase, ...prev]);
  };

  const handleUpdateCase = (caseId: number, updates: any) => {
    setCases(prev => prev.map(c => c.id === caseId ? { ...c, ...updates } : c));
  };

  return (
    <div className="flex h-screen bg-black text-slate-200 overflow-hidden font-sans selection:bg-blue-500/30 selection:text-blue-200">
      {/* Futuristic Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(59,130,246,0.05),_transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.3)_1px,_transparent_1px),_linear-gradient(90deg,rgba(15,23,42,0.3)_1px,_transparent_1px)] bg-[size:60px_60px]" />
      </div>

      {/* Sidebar */}
      <aside className="w-72 border-r border-slate-800/50 bg-slate-950/80 backdrop-blur-xl flex flex-col relative z-10">
        <div className="p-8 border-b border-slate-800/50">
          <Logo size="sm" className="!items-start" />
          <div className="mt-4 flex items-center gap-2 px-2 py-1 bg-slate-900/50 border border-slate-800 rounded-lg w-fit">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">System v2.4.0</span>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 mb-4 ml-2">Navigation</p>
          <NavButton 
            active={activeTab === 'cases'} 
            onClick={() => setActiveTab('cases')}
            icon={<FileText className="w-5 h-5" />}
            label="Active Cases"
          />
          <NavButton 
            active={activeTab === 'analytics'} 
            onClick={() => setActiveTab('analytics')}
            icon={<Microscope className="w-5 h-5" />}
            label="AI Analytics"
          />
          <NavButton 
            active={activeTab === 'shift'} 
            onClick={() => setActiveTab('shift')}
            icon={<Clock className="w-5 h-5" />}
            label="Shift Log"
          />
        </nav>

        <div className="p-6 mt-auto border-t border-slate-800/50 relative">
          <button 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="w-full flex flex-col gap-4 p-4 bg-slate-900/40 border border-slate-800/50 rounded-2xl mb-4 relative overflow-hidden group text-left transition-all hover:border-blue-500/30"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-3 relative z-10 w-full">
              <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center shadow-inner">
                <User className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black truncate text-white">{user.name}</p>
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-3 h-3 text-blue-500" />
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{user.role}</p>
                </div>
              </div>
            </div>
            {user.loginTime && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-lg border border-slate-800/50 relative z-10">
                <Zap className="w-3 h-3 text-yellow-500/80" />
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
                  Uplink: {new Date(user.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute bottom-full left-6 right-6 mb-4 p-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 backdrop-blur-xl"
              >
                <button 
                  onClick={onLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Terminate Session
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="h-10" /> {/* Spacer */}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative z-10">
        <header className="h-20 border-b border-slate-800/50 flex items-center justify-between px-10 bg-black/40 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            <span className="hover:text-blue-500 cursor-pointer transition-colors">Terminal</span>
            <ChevronRight className="w-4 h-4 text-slate-700" />
            <span className="text-blue-500">{activeTab}</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 px-4 py-2 bg-blue-500/5 border border-blue-500/20 rounded-xl">
              <div className="relative">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping absolute inset-0" />
                <div className="w-2 h-2 bg-blue-500 rounded-full relative z-10" />
              </div>
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">Session in progress...</span>
            </div>
          </div>
        </header>

        <div className="p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {activeTab === 'analytics' ? (
                <AnalyticsView cases={cases} />
              ) : activeTab === 'shift' ? (
                <ShiftLog user={user} />
              ) : user.role === 'Radiologist' ? (
                <RadiologistView cases={cases} onAddCase={handleAddCase} />
              ) : (
                <DoctorView user={user} cases={cases} onUpdateCase={handleUpdateCase} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all relative group ${active ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
    >
      {active && (
        <motion.div 
          layoutId="nav-active"
          className="absolute inset-0 bg-blue-500/10 border border-blue-500/20 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.1)]"
        />
      )}
      <div className={`relative z-10 transition-transform group-hover:scale-110 ${active ? 'text-blue-500' : ''}`}>
        {icon}
      </div>
      <span className="relative z-10 font-black uppercase tracking-[0.15em] text-[11px]">{label}</span>
      {active && (
        <motion.div 
          layoutId="nav-indicator"
          className="absolute right-4 w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]"
        />
      )}
    </button>
  );
}
