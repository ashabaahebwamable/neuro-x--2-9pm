import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { FirebaseProvider } from './components/FirebaseProvider';
import { useFirebase } from './components/FirebaseContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { auth } from './lib/firebase';
import { signOut } from 'firebase/auth';

function AppContent() {
  const { user, profile, loading } = useFirebase();

  const handleLogin = (userData: any, token: string) => {
    // Firebase Auth handles the session, but we can keep this for any additional logic
    localStorage.setItem('neurox_token', token);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('neurox_token');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const currentUser = profile || user;

  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-blue-500/30 selection:text-blue-400">
        <Routes>
          <Route 
            path="/login" 
            element={user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />} 
          />
          <Route 
            path="/*" 
            element={user ? <Dashboard user={currentUser} onLogout={handleLogout} /> : <Navigate to="/login" />} 
          />
        </Routes>
        <Toaster position="top-right" theme="dark" richColors />
      </div>
    </Router>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <AppContent />
      </FirebaseProvider>
    </ErrorBoundary>
  );
}
