'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Building2, Mail, Phone, MapPin, FileText, Users, CreditCard, Calendar, ExternalLink, CheckCircle2, AlertCircle, Clock, Store } from 'lucide-react';
import type { Business } from '@/types';
import Image from 'next/image';

interface NewViewBusinessModalProps {
  business: Business | null;
  isOpen: boolean;
  onClose: () => void;
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

export function NewViewBusinessModal({ business, isOpen, onClose }: NewViewBusinessModalProps) {
  if (!business) return null;

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'active': return 'text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700';
      case 'trial': return 'text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700';
      default: return 'text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'active': return <CheckCircle2 className="w-4 h-4" />;
      case 'trial': return <Clock className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
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
              className="w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden pointer-events-auto flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                <div className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                      {business.logo_url ? (
                        <Image 
                          src={business.logo_url} 
                          alt={`${business.name} logo`}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <Building2 className="w-6 h-6 text-zinc-400" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{business.name}</h2>
                      <p className="text-zinc-500 font-mono text-sm">@{business.slug}</p>
                    </div>
                  </div>
                  <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                    <X className="w-5 h-5 text-zinc-500" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-6 overflow-y-auto custom-scrollbar space-y-8">
                
                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                    <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Status</span>
                    <div className={`mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-sm font-medium border ${getStatusColor(business.subscription_status)}`}>
                      {getStatusIcon(business.subscription_status)}
                      <span className="capitalize">{business.subscription_status}</span>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                    <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Tier</span>
                    <div className="mt-2 flex items-center gap-2 text-zinc-900 dark:text-white font-medium capitalize">
                      <CreditCard className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                      {business.subscription_tier} Plan
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                    <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Users</span>
                    <div className="mt-2 flex items-center gap-2 text-zinc-900 dark:text-white font-medium">
                      <Users className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                      {business.user_count} / {business.max_users}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                    <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Branches</span>
                    <div className="mt-2 flex items-center gap-2 text-zinc-900 dark:text-white font-medium">
                      <Store className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                      {business.branch_count || 1} {(business.branch_count || 1) === 1 ? 'Location' : 'Locations'}
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800"></div>
                    Contact Information
                    <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800"></div>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-500">Email Address</label>
                      <div className="flex items-center gap-3 text-zinc-700 dark:text-zinc-300">
                        <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                          <Mail className="w-4 h-4" />
                        </div>
                        {business.email || 'N/A'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-500">Phone Number</label>
                      <div className="flex items-center gap-3 text-zinc-700 dark:text-zinc-300">
                        <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                          <Phone className="w-4 h-4" />
                        </div>
                        {business.phone || 'N/A'}
                      </div>
                    </div>
                    <div className="col-span-full space-y-1">
                      <label className="text-xs text-zinc-500">Physical Address</label>
                      <div className="flex items-start gap-3 text-zinc-700 dark:text-zinc-300">
                        <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <span className="flex-1">{business.address || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Branches Section */}
                {business.branches && business.branches.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800"></div>
                      Branches
                      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800"></div>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {business.branches.map((branch) => (
                        <div 
                          key={branch.id} 
                          className={`p-4 rounded-xl border ${branch.is_main ? 'bg-zinc-100 dark:bg-zinc-800/80 border-zinc-300 dark:border-zinc-600' : 'bg-zinc-50 dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-700'}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-zinc-900 dark:text-white flex items-center gap-2">
                              <Store className="w-4 h-4" />
                              {branch.name}
                            </span>
                            {branch.is_main && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                                Main
                              </span>
                            )}
                          </div>
                          {branch.address && (
                            <p className="text-sm text-zinc-500 mt-1">{branch.address}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-zinc-400">
                            {branch.phone && <span>{branch.phone}</span>}
                            {branch.email && <span>{branch.email}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Details */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800"></div>
                    System Details
                    <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800"></div>
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/30">
                      <span className="text-zinc-500">Business ID</span>
                      <span className="font-mono text-zinc-900 dark:text-white">{business.id}</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/30">
                      <span className="text-zinc-500">Created At</span>
                      <span className="text-zinc-900 dark:text-white">{formatDate(business.created_at)}</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/30">
                      <span className="text-zinc-500">Max Products</span>
                      <span className="text-zinc-900 dark:text-white">{business.max_products}</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/30">
                      <span className="text-zinc-500">Type</span>
                      <span className="text-zinc-900 dark:text-white capitalize">{business.business_type}</span>
                    </div>
                  </div>
                </div>

                {/* Certificate */}
                {business.certificate_url && (
                   <div className="space-y-4">
                     <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                       <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800"></div>
                       Documents
                       <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800"></div>
                     </h3>
                     <div className="relative w-full h-48 bg-zinc-100 dark:bg-zinc-900 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 group">
                       {business.certificate_url.startsWith('http') || business.certificate_url.startsWith('data') ? (
                         <Image 
                           src={business.certificate_url} 
                           alt="Certificate" 
                           fill 
                           className="object-contain p-4"
                           unoptimized
                         />
                       ) : (
                         <div className="flex items-center justify-center h-full text-zinc-400">
                           <FileText className="w-12 h-12" />
                         </div>
                       )}
                       <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                         <a 
                           href={business.certificate_url} 
                           target="_blank" 
                           rel="noopener noreferrer"
                           className="flex items-center gap-2 px-4 py-2 bg-white text-zinc-900 rounded-full font-medium hover:scale-105 transition-transform"
                         >
                           <ExternalLink className="w-4 h-4" /> View Full Document
                         </a>
                       </div>
                     </div>
                   </div>
                )}

              </div>

              <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-xl">
                <button onClick={onClose} className="w-full py-3 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors">
                  Close
                </button>
              </div>

            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
