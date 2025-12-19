"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Store, 
  ImageIcon, 
  FileText, 
  Loader2,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  MessageSquare,
  Building2,
  Mail,
  Phone,
  MapPin,
  StickyNote,
  Globe,
  Percent
} from "lucide-react";
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
  // Localization fields
  new_currency?: string;
  new_language?: string;
  new_timezone?: string;
  // Tax fields
  new_vat_enabled?: boolean;
  new_vat_rate?: number;
  requester_notes?: string;
  admin_notes?: string;
  created_at: string;
  updated_at?: string;
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
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<number, string>>({});

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
        admin_notes: adminNotes[id] || 'Approved by admin',
      });
      fetchRequests();
      onUpdate?.();
      setExpandedId(null);
      setAdminNotes(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
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
        admin_notes: adminNotes[id] || 'Rejected by admin',
      });
      fetchRequests();
      onUpdate?.();
      setExpandedId(null);
      setAdminNotes(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
    } catch (err) {
      console.error('Failed to reject:', err);
    } finally {
      setProcessing(null);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getRequestIcon = (type: string) => {
    switch (type) {
      case 'logo':
        return <ImageIcon className="w-4 h-4" />;
      case 'certificate':
        return <FileText className="w-4 h-4" />;
      case 'localization':
        return <Globe className="w-4 h-4" />;
      case 'tax':
        return <Percent className="w-4 h-4" />;
      default:
        return <Store className="w-4 h-4" />;
    }
  };

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'logo':
        return 'Logo Update';
      case 'certificate':
        return 'Certificate Upload';
      case 'profile':
      case 'info':
        return 'Profile Update';
      case 'localization':
        return 'Localization Settings';
      case 'tax':
        return 'Tax/VAT Settings';
      default:
        return 'Change Request';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      }),
      relative: getRelativeTime(date)
    };
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getRequesterName = (req: ChangeRequest) => {
    if (req.requester?.first_name && req.requester?.last_name) {
      return `${req.requester.first_name} ${req.requester.last_name}`;
    }
    return req.requester?.username || 'Unknown User';
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
          className="relative w-[480px] max-h-[calc(100vh-5rem)] bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 dark:from-zinc-800 dark:to-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-white">Change Requests</h3>
                <p className="text-xs text-zinc-500">{requests.length} pending request{requests.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/50 dark:hover:bg-zinc-700 text-zinc-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
              </div>
            ) : requests.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">All caught up!</p>
                <p className="text-xs text-zinc-500 mt-1">No pending requests to review</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {requests.map((req) => {
                  const isExpanded = expandedId === req.id;
                  const dateInfo = formatDateTime(req.created_at);
                  
                  return (
                    <div 
                      key={req.id} 
                      className={`transition-colors ${isExpanded ? 'bg-zinc-50 dark:bg-zinc-800/30' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/30'}`}
                    >
                      {/* Collapsed View - Click to Expand */}
                      <div 
                        className="p-4 cursor-pointer"
                        onClick={() => toggleExpand(req.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 flex-shrink-0">
                            {getRequestIcon(req.request_type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-zinc-900 dark:text-white truncate">
                                  {req.business?.name || 'Unknown Business'}
                                </span>
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                  <Clock className="w-3 h-3" />
                                  Pending
                                </span>
                              </div>
                              <motion.div
                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <ChevronDown className="w-4 h-4 text-zinc-400" />
                              </motion.div>
                            </div>
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                              {getRequestTypeLabel(req.request_type)}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {getRequesterName(req)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {dateInfo.relative}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 space-y-4">
                              {/* Divider */}
                              <div className="h-px bg-zinc-200 dark:bg-zinc-700" />

                              {/* Submission Details */}
                              <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                                  Submission Details
                                </h4>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm">
                                    <User className="w-4 h-4 text-zinc-400" />
                                    <span className="text-zinc-600 dark:text-zinc-400">Submitted by:</span>
                                    <span className="font-medium text-zinc-900 dark:text-white">
                                      {getRequesterName(req)}
                                    </span>
                                    {req.requester?.username && (
                                      <span className="text-xs text-zinc-500">(@{req.requester.username})</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-sm">
                                    <Calendar className="w-4 h-4 text-zinc-400" />
                                    <span className="text-zinc-600 dark:text-zinc-400">Date:</span>
                                    <span className="font-medium text-zinc-900 dark:text-white">
                                      {dateInfo.date}
                                    </span>
                                    <span className="text-xs text-zinc-500">at {dateInfo.time}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm">
                                    <Building2 className="w-4 h-4 text-zinc-400" />
                                    <span className="text-zinc-600 dark:text-zinc-400">Business:</span>
                                    <span className="font-medium text-zinc-900 dark:text-white">
                                      {req.business?.name}
                                    </span>
                                    {req.business?.slug && (
                                      <span className="text-xs text-zinc-500">({req.business.slug})</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Requested Changes */}
                              <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                                  Requested Changes
                                </h4>
                                <div className="space-y-2">
                                  {req.new_name && (
                                    <div className="flex items-start gap-2 text-sm">
                                      <Store className="w-4 h-4 text-zinc-400 mt-0.5" />
                                      <div>
                                        <span className="text-zinc-600 dark:text-zinc-400">New Name: </span>
                                        <span className="font-medium text-zinc-900 dark:text-white">{req.new_name}</span>
                                      </div>
                                    </div>
                                  )}
                                  {req.new_email && (
                                    <div className="flex items-start gap-2 text-sm">
                                      <Mail className="w-4 h-4 text-zinc-400 mt-0.5" />
                                      <div>
                                        <span className="text-zinc-600 dark:text-zinc-400">New Email: </span>
                                        <span className="font-medium text-zinc-900 dark:text-white">{req.new_email}</span>
                                      </div>
                                    </div>
                                  )}
                                  {req.new_phone && (
                                    <div className="flex items-start gap-2 text-sm">
                                      <Phone className="w-4 h-4 text-zinc-400 mt-0.5" />
                                      <div>
                                        <span className="text-zinc-600 dark:text-zinc-400">New Phone: </span>
                                        <span className="font-medium text-zinc-900 dark:text-white">{req.new_phone}</span>
                                      </div>
                                    </div>
                                  )}
                                  {req.new_address && (
                                    <div className="flex items-start gap-2 text-sm">
                                      <MapPin className="w-4 h-4 text-zinc-400 mt-0.5" />
                                      <div>
                                        <span className="text-zinc-600 dark:text-zinc-400">New Address: </span>
                                        <span className="font-medium text-zinc-900 dark:text-white">{req.new_address}</span>
                                      </div>
                                    </div>
                                  )}
                                  {req.new_logo_url && (
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2 text-sm">
                                        <ImageIcon className="w-4 h-4 text-zinc-400" />
                                        <span className="text-zinc-600 dark:text-zinc-400">New Logo:</span>
                                      </div>
                                      <div className="ml-6 w-24 h-24 rounded-xl bg-zinc-100 dark:bg-zinc-700 overflow-hidden border-2 border-zinc-200 dark:border-zinc-600">
                                        <img 
                                          src={req.new_logo_url} 
                                          alt="New logo" 
                                          className="w-full h-full object-cover" 
                                        />
                                      </div>
                                    </div>
                                  )}
                                  {req.new_certificate_url && (
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2 text-sm">
                                        <FileText className="w-4 h-4 text-zinc-400" />
                                        <span className="text-zinc-600 dark:text-zinc-400">New Certificate:</span>
                                      </div>
                                      <a 
                                        href={req.new_certificate_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-6 inline-flex items-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-700 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                                      >
                                        <FileText className="w-4 h-4" />
                                        View Certificate
                                      </a>
                                    </div>
                                  )}
                                  {/* Localization Changes */}
                                  {req.new_currency && (
                                    <div className="flex items-start gap-2 text-sm">
                                      <Globe className="w-4 h-4 text-zinc-400 mt-0.5" />
                                      <div>
                                        <span className="text-zinc-600 dark:text-zinc-400">New Currency: </span>
                                        <span className="font-medium text-zinc-900 dark:text-white">{req.new_currency}</span>
                                      </div>
                                    </div>
                                  )}
                                  {req.new_language && (
                                    <div className="flex items-start gap-2 text-sm">
                                      <Globe className="w-4 h-4 text-zinc-400 mt-0.5" />
                                      <div>
                                        <span className="text-zinc-600 dark:text-zinc-400">New Language: </span>
                                        <span className="font-medium text-zinc-900 dark:text-white">{req.new_language === 'en' ? 'English' : req.new_language === 'ar' ? 'Arabic' : req.new_language}</span>
                                      </div>
                                    </div>
                                  )}
                                  {req.new_timezone && (
                                    <div className="flex items-start gap-2 text-sm">
                                      <Globe className="w-4 h-4 text-zinc-400 mt-0.5" />
                                      <div>
                                        <span className="text-zinc-600 dark:text-zinc-400">New Timezone: </span>
                                        <span className="font-medium text-zinc-900 dark:text-white">{req.new_timezone}</span>
                                      </div>
                                    </div>
                                  )}
                                  {/* Tax/VAT Changes */}
                                  {req.new_vat_enabled !== undefined && req.new_vat_enabled !== null && (
                                    <div className="flex items-start gap-2 text-sm">
                                      <Percent className="w-4 h-4 text-zinc-400 mt-0.5" />
                                      <div>
                                        <span className="text-zinc-600 dark:text-zinc-400">VAT Enabled: </span>
                                        <span className={`font-medium ${req.new_vat_enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                          {req.new_vat_enabled ? 'Yes' : 'No'}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                  {req.new_vat_rate !== undefined && (
                                    <div className="flex items-start gap-2 text-sm">
                                      <Percent className="w-4 h-4 text-zinc-400 mt-0.5" />
                                      <div>
                                        <span className="text-zinc-600 dark:text-zinc-400">New VAT Rate: </span>
                                        <span className="font-medium text-zinc-900 dark:text-white">{req.new_vat_rate}%</span>
                                      </div>
                                    </div>
                                  )}
                                  {!req.new_name && !req.new_email && !req.new_phone && !req.new_address && !req.new_logo_url && !req.new_certificate_url && (
                                    <p className="text-sm text-zinc-500 italic">No specific changes detailed</p>
                                  )}
                                </div>
                              </div>

                              {/* Requester Notes */}
                              {req.requester_notes && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                                  <div className="flex items-center gap-2 mb-2">
                                    <StickyNote className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                                      Note from Business
                                    </h4>
                                  </div>
                                  <p className="text-sm text-blue-800 dark:text-blue-200">
                                    {req.requester_notes}
                                  </p>
                                </div>
                              )}

                              {/* Admin Notes Input */}
                              <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                                <div className="flex items-center gap-2 mb-3">
                                  <MessageSquare className="w-4 h-4 text-zinc-500" />
                                  <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                    Admin Response Note
                                  </h4>
                                </div>
                                <textarea
                                  value={adminNotes[req.id] || ''}
                                  onChange={(e) => setAdminNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                                  placeholder="Add a note to your response (optional)..."
                                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 resize-none"
                                  rows={3}
                                />
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-3 pt-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApprove(req.id);
                                  }}
                                  disabled={processing === req.id}
                                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 shadow-sm"
                                >
                                  {processing === req.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4" />
                                  )}
                                  Approve Request
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReject(req.id);
                                  }}
                                  disabled={processing === req.id}
                                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
                                >
                                  <XCircle className="w-4 h-4" />
                                  Reject
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
