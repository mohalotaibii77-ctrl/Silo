'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Trash2, Ban } from 'lucide-react';
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
  const [confirmText, setConfirmText] = useState('');

  if (!business) return null;

  const handleDelete = async () => {
    if (confirmText !== business.name) {
      setError('Business name does not match');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await businessApi.delete(business.id);
      onSuccess();
      onClose();
      setConfirmText('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete business');
    } finally {
      setLoading(false);
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
                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                   <AlertTriangle className="w-8 h-8 text-zinc-900 dark:text-white" />
                </div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Delete Business?</h2>
                <p className="text-zinc-500 text-sm mb-6">
                  This action is permanent and cannot be undone. All data associated with <span className="font-semibold text-zinc-900 dark:text-white">{business.name}</span> will be lost.
                </p>

                {error && (
                   <div className="mb-4 p-3 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm flex items-center justify-center gap-2">
                     <Ban className="w-4 h-4" /> {error}
                   </div>
                )}

                <div className="text-left mb-6">
                  <label className="text-xs font-semibold uppercase text-zinc-400 mb-2 block">
                     Type <span className="text-zinc-900 dark:text-white select-all">{business.name}</span> to confirm
                  </label>
                  <input 
                    value={confirmText}
                    onChange={(e) => { setConfirmText(e.target.value); setError(''); }}
                    placeholder={business.name}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500 transition-all"
                  />
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
                     disabled={loading || confirmText !== business.name}
                     className="py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium hover:bg-black dark:hover:bg-zinc-200 transition-colors shadow-lg shadow-zinc-500/10 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
