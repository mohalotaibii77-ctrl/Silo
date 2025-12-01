'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Trash2, Ban, Eye, EyeOff, Lock } from 'lucide-react';
import { businessApi } from '@/lib/api';
import type { Business } from '@/types';

interface NewDeleteConfirmationModalProps {
  business: Business | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } }
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { type: "spring", damping: 25, stiffness: 300 }
  },
  exit: { opacity: 0, scale: 0.95, y: 20 }
};

export function NewDeleteConfirmationModal({ business, isOpen, onClose, onSuccess }: NewDeleteConfirmationModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setPassword('');
      setError('');
      setShowPassword(false);
    }
  }, [isOpen]);

  if (!business) return null;

  const handleDelete = async () => {
    if (!password.trim()) {
      setError('Please enter your admin password');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await businessApi.deleteWithPassword(business.id, password);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete business. Check your password.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && password.trim()) {
      handleDelete();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
            className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-sm"
          />
          
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden pointer-events-auto flex flex-col"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                   <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Delete Business?</h2>
                <p className="text-zinc-500 text-sm mb-6">
                  This action is permanent and cannot be undone. All data associated with <span className="font-semibold text-zinc-900 dark:text-white">{business.name}</span> will be permanently deleted.
                </p>

                {error && (
                   <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg text-sm flex items-center justify-center gap-2">
                     <Ban className="w-4 h-4" /> {error}
                   </div>
                )}

                <div className="text-left mb-6">
                  <label className="text-xs font-semibold uppercase text-zinc-400 mb-2 block flex items-center gap-2">
                    <Lock className="w-3 h-3" /> Enter Admin Password to Confirm
                  </label>
                  <div className="relative">
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(''); }}
                      onKeyDown={handleKeyDown}
                      placeholder="Enter your password"
                      autoFocus
                      className="w-full px-4 py-3 pr-12 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                   <button 
                     onClick={onClose}
                     className="py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                   >
                     Cancel
                   </button>
                   <button 
                     onClick={handleDelete}
                     disabled={loading || !password.trim()}
                     className="py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition-colors shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                     Delete
                   </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
