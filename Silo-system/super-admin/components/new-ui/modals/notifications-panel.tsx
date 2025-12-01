"use client";

import { useState, useEffect, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, XCircle, Clock, Store, ImageIcon, FileText, Loader2 } from "lucide-react";
import api from "@/lib/api";

interface ChangeRequest {
  id: number;
  request_type: string;
  status: string;
  new_name?: string;
  new_email?: string;
  new_phone?: string;
  new_address?: string;
  new_logo_url?: string;
  new_certificate_url?: string;
  created_at: string;
  business?: {
    id: number;
    name: string;
    slug: string;
  };
  requester?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
  };
}

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export function NotificationsPanel({ isOpen, onClose, onUpdate }: NotificationsPanelProps) {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchRequests();
    }
  }, [isOpen]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/businesses/change-requests/all');
      setRequests(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    setProcessing(id);
    try {
      await api.put(`/api/businesses/change-requests/${id}/approve`, {
        admin_notes: 'Approved by admin',
      });
      fetchRequests();
      onUpdate?.();
    } catch (err) {
      console.error('Failed to approve:', err);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: number) => {
    setProcessing(id);
    try {
      await api.put(`/api/businesses/change-requests/${id}/reject`, {
        admin_notes: 'Rejected by admin',
      });
      fetchRequests();
      onUpdate?.();
    } catch (err) {
      console.error('Failed to reject:', err);
    } finally {
      setProcessing(null);
    }
  };

  const getRequestIcon = (type: string) => {
    switch (type) {
      case 'logo':
        return <ImageIcon className="w-4 h-4" />;
      case 'certificate':
        return <FileText className="w-4 h-4" />;
      default:
        return <Store className="w-4 h-4" />;
    }
  };

  const getRequestDescription = (req: ChangeRequest) => {
    switch (req.request_type) {
      case 'logo':
        return 'Logo update request';
      case 'certificate':
        return 'Certificate upload request';
      case 'profile':
        const changes = [];
        if (req.new_name) changes.push(`Name: "${req.new_name}"`);
        if (req.new_email) changes.push(`Email: ${req.new_email}`);
        if (req.new_phone) changes.push(`Phone: ${req.new_phone}`);
        if (req.new_address) changes.push(`Address updated`);
        return changes.length ? changes.join(', ') : 'Profile update';
      default:
        return 'Change request';
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-end pt-16 pr-4"
      >
        {/* Backdrop */}
        <div className="absolute inset-0" onClick={onClose} />
        
        {/* Panel */}
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          className="relative w-96 max-h-[calc(100vh-5rem)] bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h3 className="font-semibold text-zinc-900 dark:text-white">Change Requests</h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
              </div>
            ) : requests.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-6 h-6 text-zinc-400" />
                </div>
                <p className="text-sm text-zinc-500">No pending requests</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {requests.map((req) => (
                  <div key={req.id} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 flex-shrink-0">
                        {getRequestIcon(req.request_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-zinc-900 dark:text-white truncate">
                            {req.business?.name || 'Unknown Business'}
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                            <Clock className="w-3 h-3" />
                            Pending
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5 truncate">
                          {getRequestDescription(req)}
                        </p>
                        <p className="text-xs text-zinc-400 mt-1">
                          by {req.requester?.first_name || req.requester?.username || 'Unknown'} • {new Date(req.created_at).toLocaleDateString()}
                        </p>
                        
                        {/* Preview for logo/certificate */}
                        {req.new_logo_url && (
                          <div className="mt-2 w-16 h-16 rounded-lg bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                            <img src={req.new_logo_url} alt="New logo" className="w-full h-full object-cover" />
                          </div>
                        )}

                        {/* Actions */}
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(req.id)}
                            disabled={processing === req.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50"
                          >
                            {processing === req.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3 h-3" />
                            )}
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(req.id)}
                            disabled={processing === req.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-3 h-3" />
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

