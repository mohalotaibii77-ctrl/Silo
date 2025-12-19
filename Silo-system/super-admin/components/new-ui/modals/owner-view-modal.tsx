"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Building2, 
  Mail, 
  Phone, 
  Calendar, 
  Link2, 
  Unlink,
  Plus,
  User,
  Clock,
  Briefcase
} from "lucide-react";
import type { Owner, UnassignedBusiness } from "@/types";
import { ownerApi } from "@/lib/api";

interface OwnerViewModalProps {
  owner: Owner | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function OwnerViewModal({ owner, isOpen, onClose, onUpdate }: OwnerViewModalProps) {
  const [ownerData, setOwnerData] = useState<Owner | null>(null);
  const [unassignedBusinesses, setUnassignedBusinesses] = useState<UnassignedBusiness[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unlinking, setUnlinking] = useState<number | null>(null);
  const [linking, setLinking] = useState<number | null>(null);

  useEffect(() => {
    if (owner && isOpen) {
      loadOwnerDetails();
    }
  }, [owner, isOpen]);

  const loadOwnerDetails = async () => {
    if (!owner) return;
    setLoading(true);
    try {
      const data = await ownerApi.getById(owner.id);
      setOwnerData(data);
    } catch (err) {
      console.error('Error loading owner:', err);
      // Fallback to the owner data we have
      setOwnerData(owner);
    } finally {
      setLoading(false);
    }
  };

  const loadUnassignedBusinesses = async () => {
    try {
      const businesses = await ownerApi.getUnassignedBusinesses();
      setUnassignedBusinesses(businesses);
    } catch (err) {
      console.error('Error loading unassigned businesses:', err);
    }
  };

  const handleUnlinkBusiness = async (businessId: number) => {
    if (!ownerData) return;
    setUnlinking(businessId);
    try {
      await ownerApi.unlinkBusiness(ownerData.id, businessId);
      await loadOwnerDetails();
      onUpdate();
    } catch (err) {
      console.error('Error unlinking business:', err);
    } finally {
      setUnlinking(null);
    }
  };

  const handleLinkBusiness = async (businessId: number) => {
    if (!ownerData) return;
    setLinking(businessId);
    try {
      await ownerApi.linkBusiness(ownerData.id, businessId);
      await loadOwnerDetails();
      await loadUnassignedBusinesses();
      onUpdate();
    } catch (err) {
      console.error('Error linking business:', err);
    } finally {
      setLinking(null);
    }
  };

  const openLinkModal = async () => {
    await loadUnassignedBusinesses();
    setShowLinkModal(true);
  };

  if (!isOpen || !owner) return null;

  const displayOwner = ownerData || owner;
  const fullName = [displayOwner.first_name, displayOwner.last_name].filter(Boolean).join(' ') || 'No name';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-zinc-200 dark:border-zinc-800"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <User className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{fullName}</h2>
                  <p className="text-sm text-zinc-500">{displayOwner.email}</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-600 dark:border-zinc-400"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Owner Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                      <Mail className="w-5 h-5 text-zinc-400" />
                      <div>
                        <p className="text-xs text-zinc-500">Email</p>
                        <p className="text-sm font-medium text-zinc-900 dark:text-white">{displayOwner.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                      <Phone className="w-5 h-5 text-zinc-400" />
                      <div>
                        <p className="text-xs text-zinc-500">Phone</p>
                        <p className="text-sm font-medium text-zinc-900 dark:text-white">{displayOwner.phone || 'Not provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                      <Calendar className="w-5 h-5 text-zinc-400" />
                      <div>
                        <p className="text-xs text-zinc-500">Created</p>
                        <p className="text-sm font-medium text-zinc-900 dark:text-white">
                          {new Date(displayOwner.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                      <Clock className="w-5 h-5 text-zinc-400" />
                      <div>
                        <p className="text-xs text-zinc-500">Last Login</p>
                        <p className="text-sm font-medium text-zinc-900 dark:text-white">
                          {displayOwner.last_login 
                            ? new Date(displayOwner.last_login).toLocaleDateString()
                            : 'Never'
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-500">Status:</span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      displayOwner.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                        : displayOwner.status === 'inactive'
                        ? 'bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
                        : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        displayOwner.status === 'active' ? 'bg-emerald-500' 
                        : displayOwner.status === 'inactive' ? 'bg-zinc-500' 
                        : 'bg-red-500'
                      }`}></span>
                      {displayOwner.status}
                    </span>
                  </div>

                  {/* Assigned Businesses */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                        <Briefcase className="w-5 h-5" />
                        Assigned Businesses ({displayOwner.businesses?.length || 0})
                      </h3>
                      <button
                        onClick={openLinkModal}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Link Business
                      </button>
                    </div>

                    {displayOwner.businesses && displayOwner.businesses.length > 0 ? (
                      <div className="space-y-2">
                        {displayOwner.businesses.map((business) => (
                          <div 
                            key={business.id}
                            className="flex items-center justify-between p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                              </div>
                              <div>
                                <p className="font-medium text-zinc-900 dark:text-white">{business.name}</p>
                                <p className="text-xs text-zinc-500">@{business.slug} • {business.role}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                business.subscription_status === 'active'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              }`}>
                                {business.subscription_status === 'active' ? 'Active' : 'Inactive'}
                              </span>
                              <button
                                onClick={() => handleUnlinkBusiness(business.id)}
                                disabled={unlinking === business.id}
                                className="p-2 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                                title="Unlink business"
                              >
                                {unlinking === business.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                                ) : (
                                  <Unlink className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-dashed border-zinc-300 dark:border-zinc-700">
                        <Building2 className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
                        <p className="text-zinc-500">No businesses assigned</p>
                        <button
                          onClick={openLinkModal}
                          className="mt-2 text-zinc-900 dark:text-white hover:text-zinc-700 dark:hover:text-zinc-300 text-sm font-medium"
                        >
                          Link a business →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Link Business Sub-Modal */}
          <AnimatePresence>
            {showLinkModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowLinkModal(false)}
                className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden border border-zinc-200 dark:border-zinc-800"
                >
                  <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
                    <h3 className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                      <Link2 className="w-5 h-5" />
                      Link Business to Owner
                    </h3>
                    <button 
                      onClick={() => setShowLinkModal(false)}
                      className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-4 max-h-[60vh] overflow-y-auto">
                    {unassignedBusinesses.length > 0 ? (
                      <div className="space-y-2">
                        {unassignedBusinesses.map((business) => (
                          <div 
                            key={business.id}
                            className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-zinc-500" />
                              </div>
                              <div>
                                <p className="font-medium text-sm text-zinc-900 dark:text-white">{business.name}</p>
                                <p className="text-xs text-zinc-500">@{business.slug}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleLinkBusiness(business.id)}
                              disabled={linking === business.id}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
                            >
                              {linking === business.id ? (
                                <span className="flex items-center gap-1">
                                  <div className="animate-spin rounded-full h-3 w-3 border-b border-white dark:border-zinc-900"></div>
                                  Linking...
                                </span>
                              ) : (
                                'Link'
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Building2 className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
                        <p className="text-zinc-500 text-sm">No unassigned businesses</p>
                        <p className="text-zinc-400 text-xs mt-1">All businesses have owners assigned</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

