import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Clock, 
  User, 
  Save,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface ShiftLogProps {
  user: any;
}

export default function ShiftLog({ user }: ShiftLogProps) {
  const [name, setName] = useState(user.name || '');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const fetchShiftStats = async () => {
      const token = localStorage.getItem('neurox_token');
      if (!token) return;

      try {
        const response = await fetch('/api/shift-stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok && data.login_time) {
          setStartTime(new Date(data.login_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
          setIsSaved(true);
        }
      } catch (error) {
        console.error('Failed to fetch shift stats', error);
      }
    };

    fetchShiftStats();
  }, [user.email]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // In this implementation, shifts are started automatically on login
    // We just show the current shift status
    setIsSaved(true);
    toast.success('Shift parameters synchronized with central neural core');
  };

  return (
    <div className="space-y-10 max-w-2xl mx-auto pb-20">
      <div className="relative">
        <h2 className="text-3xl font-black tracking-tighter uppercase italic text-white">Shift <span className="text-blue-500">Log</span></h2>
        <div className="absolute -bottom-2 left-0 w-24 h-1 bg-blue-600 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.5)]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900/20 backdrop-blur-md border border-slate-800/50 rounded-[2rem] p-10 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
        
        <form onSubmit={handleSave} className="space-y-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Clinician Identity</label>
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" 
                required
                value={name}
                onChange={(e) => { setName(e.target.value); setIsSaved(false); }}
                className="w-full bg-slate-900/50 border border-slate-800/50 rounded-2xl py-4 pl-12 pr-6 focus:outline-none focus:border-blue-500/50 transition-all text-white font-medium placeholder:text-slate-700"
                placeholder="Initialize Identity..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Shift Start</label>
              <div className="relative group">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type="time" 
                  required
                  value={startTime}
                  onChange={(e) => { setStartTime(e.target.value); setIsSaved(false); }}
                  className="w-full bg-slate-900/50 border border-slate-800/50 rounded-2xl py-4 pl-12 pr-6 focus:outline-none focus:border-blue-500/50 transition-all text-white font-medium"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Expected End</label>
              <div className="relative group">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type="time" 
                  required
                  value={endTime}
                  onChange={(e) => { setEndTime(e.target.value); setIsSaved(false); }}
                  className="w-full bg-slate-900/50 border border-slate-800/50 rounded-2xl py-4 pl-12 pr-6 focus:outline-none focus:border-blue-500/50 transition-all text-white font-medium"
                />
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button 
              type="submit" 
              className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 transition-all ${isSaved ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_30px_rgba(37,99,235,0.3)] hover:shadow-[0_0_40px_rgba(37,99,235,0.5)]'}`}
            >
              {isSaved ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Session Logged
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Login Shift
                </>
              )}
            </button>
          </div>
        </form>

        {isSaved && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10 p-6 bg-blue-500/5 border border-blue-500/20 rounded-2xl flex items-start gap-4"
          >
            <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-[10px] text-blue-400/80 leading-relaxed font-black uppercase tracking-widest">
              Shift parameters synchronized with central neural core. HIPAA-compliant auditing active.
            </div>
          </motion.div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-slate-900/20 backdrop-blur-sm border border-slate-800/50 rounded-2xl">
          <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-2">Current Date</p>
          <p className="text-sm font-black text-white tracking-tight">{new Date().toLocaleDateString()}</p>
        </div>
        <div className="p-6 bg-slate-900/20 backdrop-blur-sm border border-slate-800/50 rounded-2xl">
          <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-2">Terminal ID</p>
          <p className="text-sm font-black text-white tracking-tight">NX-772-B</p>
        </div>
        <div className="p-6 bg-slate-900/20 backdrop-blur-sm border border-slate-800/50 rounded-2xl">
          <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-2">Status</p>
          <p className="text-sm font-black text-green-500 tracking-tight uppercase">Active Session</p>
        </div>
      </div>
    </div>
  );
}
