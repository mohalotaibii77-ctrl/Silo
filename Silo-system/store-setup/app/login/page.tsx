'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command, Mail, Lock, ArrowRight } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import api from '@/lib/api';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please enter username and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/business-auth/login', { email, password });
      const { token, user, business } = response.data;

      // Only allow owner and manager roles
      if (user.role !== 'owner' && user.role !== 'manager') {
        setError('Access denied. Only owners and managers can access store setup.');
        setLoading(false);
        return;
      }

      // Store auth data
      localStorage.setItem('setup_token', token);
      localStorage.setItem('setup_user', JSON.stringify(user));
      localStorage.setItem('setup_business', JSON.stringify(business));

      // Apply language direction immediately before navigation
      const lang = business?.language || 'en';
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;

      // Navigate to Items page directly
      router.push('/items');
    } catch (err: any) {
      console.error('Login error:', err);
      // Show actual error for debugging
      if (err.code === 'ERR_NETWORK') {
        setError('Network error - check if backend is running on port 9000');
      } else if (err.message?.includes('CORS') || err.message?.includes('Network Error')) {
        setError('CORS error - backend may not allow this origin');
      } else {
        setError(err.response?.data?.error || err.message || 'Invalid credentials');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(#e4e4e7_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(#27272a_1px,transparent_1px)] opacity-50" />
      
      {/* Theme Toggle - Top Right */}
      <div className="absolute top-6 right-6 z-10">
        <ModeToggle />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[420px] z-10 px-4"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
            className="inline-flex items-center justify-center w-16 h-16 bg-white dark:bg-zinc-900 rounded-2xl mb-6 shadow-xl border border-zinc-200 dark:border-zinc-800"
          >
            <Command className="w-8 h-8 text-zinc-900 dark:text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white tracking-tight mb-2">
            Welcome back
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            Enter your credentials to access Store Setup
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-2xl shadow-zinc-200/50 dark:shadow-black/50">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Error Message */}
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2"
              >
                <span className="font-medium">Error:</span>
                <span>{error}</span>
              </motion.div>
            )}

            {/* Username Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ml-1">
                Username
              </label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-zinc-900 dark:group-focus-within:text-white transition-colors" />
                <input
                  type="text"
                  placeholder="Enter your username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-zinc-900 dark:focus:border-zinc-100 focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 focus:outline-none transition-all text-zinc-900 dark:text-white placeholder:text-zinc-400"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ml-1">
                Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-zinc-900 dark:group-focus-within:text-white transition-colors" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-zinc-900 dark:focus:border-zinc-100 focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 focus:outline-none transition-all text-zinc-900 dark:text-white placeholder:text-zinc-400"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-3.5 px-4 rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl active:scale-[0.98] flex items-center justify-center gap-2 mt-4"
            >
              {loading ? (
                <>
                  <Command className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800/50 text-center">
            <p className="text-xs text-zinc-400 dark:text-zinc-600">
              Powered by Silo System
            </p>
          </div>
        </div>

        {/* Role Notice */}
        <p className="text-center mt-6 text-xs text-zinc-400 dark:text-zinc-600">
          Only owners and operations managers can access store setup
        </p>
      </motion.div>
    </div>
  );
}
