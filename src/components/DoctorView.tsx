import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  CheckCircle2, 
  Loader2, 
  Image as ImageIcon,
  ChevronRight,
  Send,
  Stethoscope,
  Syringe,
  Microscope,
  ExternalLink,
  Brain
} from 'lucide-react';
import { toast } from 'sonner';

interface DoctorViewProps {
  user: any;
  cases: any[];
  onUpdateCase: (caseId: number, updates: any) => void;
}

export default function DoctorView({ user, cases, onUpdateCase }: DoctorViewProps) {
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [updating, setUpdating] = useState(false);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [showOverlay, setShowOverlay] = useState(true);

  const filteredCases = cases.filter(c => c.assignedTo === user.role);

  useEffect(() => {
    if (selectedCase) {
      setClinicalNotes('');
    }
  }, [selectedCase]);

  const handleUpdateStatus = async (status: string) => {
    if (!selectedCase) return;
    setUpdating(true);
    
    try {
      const token = localStorage.getItem('neurox_token');
      const response = await fetch(`/api/cases/${selectedCase.id}/status`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        onUpdateCase(selectedCase.id, { status, clinicalNotes });
        setSelectedCase({ ...selectedCase, status, clinicalNotes });
        toast.success(`Case status updated to: ${status}`);
      }
    } catch (error) {
      console.error('Update status error:', error);
      toast.error('Failed to update case status on server');
    } finally {
      setUpdating(false);
    }
  };

  const handleForwardToAnesthesiologist = async () => {
    if (!selectedCase) return;
    setUpdating(true);
    
    try {
      const token = localStorage.getItem('neurox_token');
      
      // 1. Get users to find Anesthesiologist
      const usersRes = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const users = await usersRes.json();
      const targetUser = users.find((u: any) => u.role === 'Anesthesiologist');
      
      if (targetUser) {
        // 2. Transfer the case
        const transferRes = await fetch('/api/cases/transfer', {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            caseId: selectedCase.id,
            sentTo: targetUser.id,
            notes: clinicalNotes || 'Forwarded for anesthesiologist review'
          })
        });

        if (transferRes.ok) {
          const updates = { 
            status: 'Forwarded for Review', 
            clinicalNotes,
            assignedTo: 'Anesthesiologist'
          };
          onUpdateCase(selectedCase.id, updates);
          setSelectedCase({ ...selectedCase, ...updates });
          toast.success('Case forwarded for Anesthesiologist review');
        }
      }
    } catch (error) {
      console.error('Forward error:', error);
      toast.error('Failed to forward case on server');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-10 max-w-6xl mx-auto pb-20">
      <div className="flex items-center justify-between">
        <div className="relative">
          <h2 className="text-3xl font-black tracking-tighter uppercase italic text-white">
            {user.role} <span className="text-blue-500 text-2xl">Terminal</span>
          </h2>
          <div className="absolute -bottom-2 left-0 w-24 h-1 bg-blue-600 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.5)]" />
        </div>
        <div className="flex items-center gap-4">
          <div className={`px-6 py-3 rounded-2xl flex items-center gap-3 border backdrop-blur-md ${user.role === 'Doctor' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-orange-500/10 border-orange-500/20 text-orange-400'}`}>
            {user.role === 'Doctor' ? <Stethoscope className="w-5 h-5" /> : <Syringe className="w-5 h-5" />}
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Session in progress...</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Case List */}
        <div className="lg:col-span-1 space-y-6">
          <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
            Assigned Queue
          </h3>
          <div className="space-y-4">
            {filteredCases.length === 0 ? (
              <div className="p-10 bg-slate-900/20 backdrop-blur-md border border-slate-800/50 border-dashed rounded-[2rem] flex flex-col items-center justify-center text-slate-700">
                <FileText className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest">No active cases</p>
              </div>
            ) : (
              filteredCases.map((c) => (
                <motion.button 
                  key={c.id}
                  whileHover={{ scale: 1.02, x: 5 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedCase(c)}
                  className={`w-full p-5 rounded-2xl border transition-all text-left flex items-center gap-5 relative overflow-hidden group ${selectedCase?.id === c.id ? 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.1)]' : 'bg-slate-900/20 border-slate-800/50 hover:border-slate-700'}`}
                >
                  {selectedCase?.id === c.id && (
                    <div className="absolute left-0 top-0 w-1 h-full bg-blue-500" />
                  )}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${selectedCase?.id === c.id ? 'bg-blue-500/20' : 'bg-slate-900/50 border border-slate-800'}`}>
                    <ImageIcon className={`w-6 h-6 ${selectedCase?.id === c.id ? 'text-blue-400' : 'text-slate-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-black uppercase tracking-tight truncate ${selectedCase?.id === c.id ? 'text-white' : 'text-slate-400'}`}>{c.patientName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${c.status === 'Completed' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                      <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">{c.status}</p>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 transition-transform ${selectedCase?.id === c.id ? 'text-blue-400 translate-x-1' : 'text-slate-700'}`} />
                </motion.button>
              ))
            )}
          </div>
        </div>

        {/* Case Detail */}
        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence mode="wait">
            {selectedCase ? (
              <motion.div 
                key={selectedCase.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="bg-slate-900/20 backdrop-blur-md border border-slate-800/50 rounded-[2rem] p-10 h-full flex flex-col shadow-2xl"
              >
                <div className="flex items-center justify-between mb-10">
                  <div className="relative">
                    <h3 className="text-3xl font-black tracking-tighter uppercase italic text-white">{selectedCase.patientName}</h3>
                    <p className="text-slate-500 text-[10px] mt-2 uppercase tracking-[0.3em] font-black flex items-center gap-2">
                      <span className="text-blue-500">#</span> {selectedCase.id}
                    </p>
                  </div>
                  <div className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border backdrop-blur-md ${selectedCase.status === 'Completed' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                    {selectedCase.status}
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 mb-10">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Neural Visualization</p>
                      <button 
                        onClick={() => setShowOverlay(!showOverlay)}
                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all border ${showOverlay ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-slate-900/50 border-slate-800 text-slate-500'}`}
                      >
                        {showOverlay ? 'Hide Neural Mask' : 'Show Neural Mask'}
                      </button>
                    </div>
                    <div className="relative aspect-video bg-black rounded-2xl border border-slate-800/50 overflow-hidden shadow-inner group/preview">
                      <img 
                        src={selectedCase.originalImage} 
                        alt="Ultrasound" 
                        className={`w-full h-full object-contain transition-all duration-1000 ${showOverlay ? 'opacity-40 grayscale-[0.5]' : 'opacity-100'}`}
                        referrerPolicy="no-referrer"
                      />
                      {selectedCase.maskPath && showOverlay && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                            <motion.path
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 0.5 }}
                              d={selectedCase.maskPath}
                              fill="none"
                              stroke="#3b82f6"
                              strokeWidth="10"
                              strokeLinecap="round"
                              filter="blur(6px)"
                            />
                            <motion.path
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              d={selectedCase.maskPath}
                              fill="none"
                              stroke="#60a5fa"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              className="drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]"
                            />
                          </svg>
                        </div>
                      )}
                      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-end pointer-events-none">
                        <ExternalLink className="w-4 h-4 text-white/20" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {/* AI Analysis Section (Visible to both Doctor and Anesthesiologist) */}
                    <div className="p-8 bg-blue-500/5 rounded-[2rem] border border-blue-500/20 relative overflow-hidden group/ai">
                      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <Brain className="w-5 h-5 text-blue-500" />
                          <label className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">AI Diagnostic Intelligence</label>
                        </div>
                        <p className="text-slate-300 text-sm leading-relaxed font-medium italic">"{selectedCase.findings}"</p>
                      </div>
                    </div>

                    {/* Doctor's Clinical Input (Visible only to Anesthesiologist) */}
                    {user.role === 'Anesthesiologist' && selectedCase.clinicalNotes && (
                      <div className="p-8 bg-purple-500/5 rounded-[2rem] border border-purple-500/20 relative overflow-hidden group/doctor">
                        <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <Stethoscope className="w-5 h-5 text-purple-500" />
                            <label className="text-[10px] font-black text-purple-500 uppercase tracking-[0.2em]">Doctor's Clinical Observations</label>
                          </div>
                          <p className="text-slate-300 text-sm leading-relaxed font-medium">"{selectedCase.clinicalNotes}"</p>
                        </div>
                      </div>
                    )}

                    <div className="p-8 bg-black/40 rounded-[2rem] border border-slate-800/50 relative overflow-hidden group/findings">
                      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50" />
                      
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                          {user.role === 'Anesthesiologist' ? 'Anesthesiologist Input' : 'Clinical Observations'}
                        </label>
                        <textarea 
                          value={clinicalNotes}
                          onChange={(e) => setClinicalNotes(e.target.value)}
                          placeholder="Initialize clinical input..."
                          className="w-full bg-slate-900/50 border border-slate-800/50 rounded-2xl p-5 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 min-h-[120px] resize-none transition-all placeholder:text-slate-700 font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="p-6 bg-black/40 rounded-2xl border border-slate-800/50">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">Neural Confidence</p>
                          <span className="text-[10px] font-black text-blue-500">{(selectedCase.confidence * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${selectedCase.confidence * 100}%` }}
                            className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                          />
                        </div>
                      </div>
                      <div className="p-6 bg-black/40 rounded-2xl border border-slate-800/50 flex flex-col justify-center">
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mb-1">Priority Matrix</p>
                        <p className="text-xs font-black text-yellow-500 uppercase tracking-widest">Standard</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="grid grid-cols-1 gap-4">
                          <button 
                            onClick={() => handleUpdateStatus('Completed')}
                            disabled={updating || selectedCase.status === 'Completed'}
                            className="flex items-center justify-center gap-3 px-6 py-4 bg-green-600/90 hover:bg-green-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl text-[10px] transition-all shadow-[0_0_30px_rgba(22,163,74,0.2)] disabled:opacity-30"
                          >
                            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Complete
                          </button>
                        </div>
                        {user.role === 'Doctor' && (
                          <button 
                            onClick={handleForwardToAnesthesiologist}
                            disabled={updating || selectedCase.assignedTo === 'Anesthesiologist'}
                            className="w-full flex items-center justify-center gap-3 px-6 py-5 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl text-[10px] transition-all shadow-[0_0_30px_rgba(37,99,235,0.3)] hover:shadow-[0_0_40px_rgba(37,99,235,0.5)] disabled:opacity-30"
                          >
                            <Send className="w-4 h-4" />
                            Forward to Anesthesiologist
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-slate-900/10 border-2 border-slate-800/30 border-dashed rounded-[2rem] p-10 h-full flex flex-col items-center justify-center text-slate-700 min-h-[500px]"
              >
                <div className="w-20 h-20 bg-slate-900/50 rounded-full flex items-center justify-center mb-8 opacity-20">
                  <Microscope className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tight mb-3">Select Terminal Node</h3>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-center max-w-xs leading-relaxed">Select a case from the queue to initialize neural diagnostic review.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
