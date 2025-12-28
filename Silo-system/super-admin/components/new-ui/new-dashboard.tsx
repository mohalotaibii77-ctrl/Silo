"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Settings, 
  LogOut, 
  Search, 
  Bell, 
  Plus,
  ArrowUpRight,
  Wallet,
  Activity,
  Command,
  TrendingUp,
  Calendar,
  AlertCircle,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  User,
  Store,
  Mail,
  Phone,
  MapPin,
  ImageIcon,
  MessageSquare,
  StickyNote,
  Loader2,
  Globe,
  Languages,
  Percent
} from "lucide-react";
import { useBusinessData } from "@/hooks/use-business-data";
import { ModeToggle } from "@/components/mode-toggle";
import { NewCreateBusinessModal } from "@/components/new-ui/modals/new-create-business-modal";
import { NewViewBusinessModal } from "@/components/new-ui/modals/new-view-business-modal";
import { NewEditBusinessModal } from "@/components/new-ui/modals/new-edit-business-modal";
import { NewDeleteConfirmationModal } from "@/components/new-ui/modals/new-delete-confirmation-modal";
import { NotificationsPanel } from "@/components/new-ui/modals/notifications-panel";
import { OwnerViewModal } from "@/components/new-ui/modals/owner-view-modal";
import { OwnerCreateModal } from "@/components/new-ui/modals/owner-create-modal";
import { useState as useStateNotif, useEffect as useEffectNotif } from "react";
import api, { ownerApi } from "@/lib/api";
import type { Owner } from "@/types";

type ActiveTab = 'dashboard' | 'businesses' | 'users' | 'requests' | 'settings';

interface ChangeRequest {
  id: number;
  request_type: string;
  status: string;
  // Profile fields - old values
  old_name?: string;
  old_email?: string;
  old_phone?: string;
  old_address?: string;
  old_logo_url?: string;
  old_certificate_url?: string;
  // Profile fields - new values
  new_name?: string;
  new_email?: string;
  new_phone?: string;
  new_address?: string;
  new_logo_url?: string;
  new_certificate_url?: string;
  // Localization fields - old values
  old_currency?: string;
  old_language?: string;
  old_timezone?: string;
  // Localization fields - new values
  new_currency?: string;
  new_language?: string;
  new_timezone?: string;
  // Tax/VAT fields - old values
  old_vat_enabled?: boolean;
  old_vat_rate?: number;
  // Tax/VAT fields - new values
  new_vat_enabled?: boolean;
  new_vat_rate?: number;
  // Notes
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

export function NewDashboard() {
  const {
    user,
    businesses,
    loading,
    loadBusinesses,
    handleLogout,
    modalState,
    actions
  } = useBusinessData();

  const {
    showCreateModal, setShowCreateModal,
    showViewModal, setShowViewModal,
    showEditModal, setShowEditModal,
    showDeleteModal, setShowDeleteModal,
    selectedBusiness, setSelectedBusiness
  } = modalState;

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [showNotifications, setShowNotifications] = useStateNotif(false);
  const [pendingCount, setPendingCount] = useStateNotif(0);
  
  // Owner state
  const [owners, setOwners] = useState<Owner[]>([]);
  const [ownersLoading, setOwnersLoading] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);
  const [showOwnerViewModal, setShowOwnerViewModal] = useState(false);
  const [showOwnerCreateModal, setShowOwnerCreateModal] = useState(false);

  // Requests state
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [expandedRequestId, setExpandedRequestId] = useState<number | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<number, string>>({});
  const [processingRequestId, setProcessingRequestId] = useState<number | null>(null);

  // Platform stats from backend - all calculations done server-side
  const [platformStats, setPlatformStats] = useState<{
    total_businesses: number;
    active_businesses: number;
    inactive_businesses: number;
    total_owners: number;
    total_users: number;
    total_revenue: number;
    businesses_by_tier: Record<string, number>;
  } | null>(null);

  // Fetch pending requests count
  useEffectNotif(() => {
    const fetchPendingCount = async () => {
      try {
        const response = await api.get('/api/businesses/change-requests/all');
        setPendingCount(response.data.data?.length || 0);
      } catch (err) {
        console.error('Failed to fetch pending count:', err);
      }
    };
    fetchPendingCount();
  }, []);

  // Fetch platform stats from backend - all calculations done server-side
  useEffectNotif(() => {
    const fetchPlatformStats = async () => {
      try {
        const response = await api.get('/api/owners/platform-stats');
        if (response.data.success) {
          setPlatformStats(response.data.stats);
        }
      } catch (err) {
        console.error('Failed to fetch platform stats:', err);
      }
    };
    fetchPlatformStats();
  }, [businesses]); // Refresh when businesses change

  // Load owners when Users tab is active
  const loadOwners = async () => {
    setOwnersLoading(true);
    try {
      const data = await ownerApi.getAll();
      setOwners(data);
    } catch (err) {
      console.error('Failed to fetch owners:', err);
    } finally {
      setOwnersLoading(false);
    }
  };

  useEffectNotif(() => {
    if (activeTab === 'users') {
      loadOwners();
    }
    if (activeTab === 'requests') {
      loadRequests();
    }
  }, [activeTab]);

  const handleViewOwner = (owner: Owner) => {
    setSelectedOwner(owner);
    setShowOwnerViewModal(true);
  };

  // Requests functions
  const loadRequests = async () => {
    setRequestsLoading(true);
    try {
      const response = await api.get('/api/businesses/change-requests/all');
      setRequests(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    } finally {
      setRequestsLoading(false);
    }
  };

  const handleApproveRequest = async (id: number) => {
    setProcessingRequestId(id);
    try {
      await api.put(`/api/businesses/change-requests/${id}/approve`, {
        admin_notes: adminNotes[id] || 'Approved by admin',
      });
      loadRequests();
      // Update pending count
      api.get('/api/businesses/change-requests/all')
        .then(res => setPendingCount(res.data.data?.length || 0))
        .catch(() => {});
      setExpandedRequestId(null);
      setAdminNotes(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
    } catch (err) {
      console.error('Failed to approve:', err);
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleRejectRequest = async (id: number) => {
    setProcessingRequestId(id);
    try {
      await api.put(`/api/businesses/change-requests/${id}/reject`, {
        admin_notes: adminNotes[id] || 'Rejected by admin',
      });
      loadRequests();
      // Update pending count
      api.get('/api/businesses/change-requests/all')
        .then(res => setPendingCount(res.data.data?.length || 0))
        .catch(() => {});
      setExpandedRequestId(null);
      setAdminNotes(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
    } catch (err) {
      console.error('Failed to reject:', err);
    } finally {
      setProcessingRequestId(null);
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

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'logo': return 'Logo Update';
      case 'certificate': return 'Certificate Upload';
      case 'profile':
      case 'info': return 'Profile Update';
      default: return 'Change Request';
    }
  };

  const getRequestIcon = (type: string) => {
    switch (type) {
      case 'logo': return <ImageIcon className="w-5 h-5" />;
      case 'certificate': return <FileText className="w-5 h-5" />;
      default: return <Store className="w-5 h-5" />;
    }
  };

  // Use backend-calculated stats - no frontend calculations for business metrics
  const activeCount = platformStats?.active_businesses ?? 0;
  const inactiveCount = platformStats?.inactive_businesses ?? 0;
  const totalRevenue = platformStats?.total_revenue ?? 0;
  const totalUsers = platformStats?.total_users ?? 0;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

    if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
             <Command className="h-6 w-6 text-zinc-900 dark:text-white animate-spin" />
          </div>
          <p className="text-sm text-zinc-500 font-medium">Loading Silo OS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hidden md:flex flex-col sticky top-0 h-screen z-40">
        <div className="p-6 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-zinc-900 font-bold shadow-zinc-500/20 shadow-lg">
            S
          </div>
          <span className="font-bold text-lg tracking-tight text-zinc-900 dark:text-white">Silo Admin</span>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto py-4">
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4 px-2">Platform</div>
          
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
              activeTab === 'dashboard' 
                ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white font-medium' 
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </button>
          
          <button 
            onClick={() => setActiveTab('businesses')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
              activeTab === 'businesses' 
                ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white font-medium' 
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Building2 className="w-5 h-5" />
            Businesses
          </button>
          
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
              activeTab === 'users' 
                ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white font-medium' 
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Users className="w-5 h-5" />
            Users
          </button>

          <button 
            onClick={() => setActiveTab('requests')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
              activeTab === 'requests' 
                ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white font-medium' 
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5" />
              Requests
            </div>
            {pendingCount > 0 && (
              <span className="min-w-[20px] h-5 flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold rounded-full px-1.5">
                {pendingCount}
              </span>
            )}
          </button>

          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4 mt-8 px-2">Settings</div>

          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
              activeTab === 'settings' 
                ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white font-medium' 
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Settings className="w-5 h-5" />
            System Config
          </button>
        </nav>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <span className="font-medium text-sm">{user?.name?.[0] || 'A'}</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate text-zinc-900 dark:text-white">{user?.name || 'Admin'}</p>
              <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button 
             onClick={handleLogout}
             className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl sticky top-0 z-30 px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input 
                type="text" 
                placeholder="Search businesses..." 
                className="pl-9 pr-4 py-2 w-64 rounded-full bg-zinc-100 dark:bg-zinc-800 border-none text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none transition-all placeholder:text-zinc-500 text-zinc-900 dark:text-white"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <button 
               onClick={() => setShowNotifications(true)}
               className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 relative"
             >
               <Bell className="w-5 h-5" />
               {pendingCount > 0 && (
                 <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full ring-2 ring-white dark:ring-zinc-900">
                   {pendingCount > 9 ? '9+' : pendingCount}
                 </span>
               )}
             </button>
             <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1"></div>
             <ModeToggle />
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth">
          <motion.div 
            key={activeTab}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="max-w-7xl mx-auto space-y-8"
          >
            {/* Dashboard Tab - Stats Only */}
            {activeTab === 'dashboard' && (
              <>
                <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Dashboard Overview</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">Welcome back, here's what's happening today.</p>
                  </div>
                </motion.div>

                {/* KPI Grid */}
                <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                       <Building2 className="w-24 h-24" />
                    </div>
                    <div className="flex flex-col">
                       <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Businesses</span>
                       <div className="mt-4 flex items-baseline gap-2">
                         <span className="text-4xl font-bold text-zinc-900 dark:text-white tracking-tight">{businesses.length}</span>
                         <span className="text-xs font-medium text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                           <ArrowUpRight className="w-3 h-3" />
                           12%
                         </span>
                       </div>
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                       <Activity className="w-24 h-24 text-zinc-500" />
                    </div>
                     <div className="flex flex-col">
                       <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Active Subscriptions</span>
                       <div className="mt-4 flex items-baseline gap-2">
                         <span className="text-4xl font-bold text-zinc-900 dark:text-white tracking-tight">{activeCount}</span>
                         <span className="text-sm text-zinc-400">/ {businesses.length}</span>
                       </div>
                    </div>
                    <div className="mt-4 h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${businesses.length > 0 ? (activeCount / businesses.length) * 100 : 0}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-zinc-900 dark:bg-white rounded-full" 
                      />
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                       <Wallet className="w-24 h-24 text-zinc-500" />
                    </div>
                     <div className="flex flex-col">
                       <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Est. Monthly Revenue</span>
                       <div className="mt-4 flex items-baseline gap-2">
                         <span className="text-4xl font-bold text-zinc-900 dark:text-white tracking-tight">${totalRevenue.toLocaleString()}</span>
                       </div>
                    </div>
                  </div>
                </motion.div>

                {/* Additional Stats Row */}
                <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="text-sm text-zinc-500">Inactive</p>
                        <p className="text-xl font-bold text-zinc-900 dark:text-white">
                          {inactiveCount}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                        <Users className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                      </div>
                      <div>
                        <p className="text-sm text-zinc-500">Total Users</p>
                        <p className="text-xl font-bold text-zinc-900 dark:text-white">
                          {totalUsers}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                        <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm text-zinc-500">This Month</p>
                        <p className="text-xl font-bold text-zinc-900 dark:text-white">
                          {businesses.filter(b => {
                            const created = new Date(b.created_at);
                            const now = new Date();
                            return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
                          }).length} new
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Quick Actions */}
                <motion.div variants={itemVariants} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Quick Actions</h3>
                  <div className="flex flex-wrap gap-3">
                    <button 
                      onClick={() => { setActiveTab('businesses'); setShowCreateModal(true); }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Business
                    </button>
                    <button 
                      onClick={() => setActiveTab('businesses')}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <Building2 className="w-4 h-4" />
                      View Businesses
                    </button>
                    <button 
                      onClick={() => setShowNotifications(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <Bell className="w-4 h-4" />
                      Pending Requests ({pendingCount})
                    </button>
                  </div>
                </motion.div>
              </>
            )}

            {/* Businesses Tab - Table and Add Button */}
            {activeTab === 'businesses' && (
              <>
                <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Businesses</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">Manage your platform tenants</p>
                  </div>
                  <button 
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-5 py-2.5 rounded-full font-medium hover:shadow-lg hover:shadow-zinc-500/20 transition-all active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    Add New Business
                  </button>
                </motion.div>

                {/* Businesses Table */}
                <motion.div variants={itemVariants} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Business</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Plan</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Users</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {businesses.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center">
                              <Building2 className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
                              <p className="text-zinc-500 dark:text-zinc-400">No businesses yet</p>
                              <button 
                                onClick={() => setShowCreateModal(true)}
                                className="mt-4 inline-flex items-center gap-2 text-zinc-900 dark:text-white hover:underline"
                              >
                                <Plus className="w-4 h-4" />
                                Add your first business
                              </button>
                            </td>
                          </tr>
                        ) : (
                          businesses.map((business, i) => (
                            <motion.tr 
                              key={business.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-4">
                                  <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white font-bold text-sm">
                                    {business.name.substring(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-medium text-zinc-900 dark:text-white">{business.name}</div>
                                    <div className="text-xs text-zinc-500">@{business.slug}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                 <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                                   bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300
                                 `}>
                                   {business.subscription_tier}
                                 </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                                  <Users className="w-4 h-4" />
                                  {business.user_count} / {business.max_users}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                  business.subscription_status === 'active' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                                    : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    business.subscription_status === 'active' 
                                      ? 'bg-emerald-500'
                                      : 'bg-red-500'
                                  }`}></span>
                                  {business.subscription_status === 'active' ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button 
                                    onClick={() => actions.handleEdit(business)}
                                    className="p-2 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-white dark:hover:bg-zinc-800 transition-all"
                                  >
                                    Edit
                                  </button>
                                  <button 
                                    onClick={() => actions.handleDelete(business)}
                                    className="p-2 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-all"
                                  >
                                    Delete
                                  </button>
                                  <button 
                                    onClick={() => actions.handleView(business)}
                                    className="p-2 rounded-lg text-zinc-900 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700 transition-all text-sm font-medium"
                                  >
                                    View
                                  </button>
                                </div>
                              </td>
                            </motion.tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              </>
            )}

            {/* Users Tab - Owners Management */}
            {activeTab === 'users' && (
              <>
                <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Owners</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">Manage platform owners and their business assignments</p>
                  </div>
                  <button 
                    onClick={() => setShowOwnerCreateModal(true)}
                    className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-5 py-2.5 rounded-full font-medium hover:shadow-lg hover:shadow-zinc-500/20 transition-all active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    Add New Owner
                  </button>
                </motion.div>

                {/* Owners Table */}
                <motion.div variants={itemVariants} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                  {ownersLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-600 dark:border-zinc-400"></div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Owner</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Businesses</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                          {owners.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-6 py-12 text-center">
                                <Users className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
                                <p className="text-zinc-500 dark:text-zinc-400">No owners yet</p>
                                <button 
                                  onClick={() => setShowOwnerCreateModal(true)}
                                  className="mt-4 inline-flex items-center gap-2 text-zinc-900 dark:text-white hover:underline"
                                >
                                  <Plus className="w-4 h-4" />
                                  Add your first owner
                                </button>
                              </td>
                            </tr>
                          ) : (
                            owners.map((owner, i) => {
                              const fullName = [owner.first_name, owner.last_name].filter(Boolean).join(' ') || 'No name';
                              const initials = fullName !== 'No name' 
                                ? fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                                : owner.email.substring(0, 2).toUpperCase();
                              
                              return (
                                <motion.tr 
                                  key={owner.id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: i * 0.05 }}
                                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                                >
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-4">
                                      <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 font-bold text-sm">
                                        {initials}
                                      </div>
                                      <div>
                                        <div className="font-medium text-zinc-900 dark:text-white">{fullName}</div>
                                        <div className="text-xs text-zinc-500">{owner.phone || 'No phone'}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="text-sm text-zinc-600 dark:text-zinc-400">{owner.email}</span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-1.5">
                                      <Building2 className="w-4 h-4 text-zinc-400" />
                                      <span className="text-sm font-medium text-zinc-900 dark:text-white">
                                        {owner.business_count || 0}
                                      </span>
                                      <span className="text-sm text-zinc-500">
                                        {(owner.business_count || 0) === 1 ? 'business' : 'businesses'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                      owner.status === 'active' 
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                                        : owner.status === 'inactive'
                                        ? 'bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
                                        : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                                    }`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${
                                        owner.status === 'active' 
                                          ? 'bg-emerald-500'
                                          : owner.status === 'inactive'
                                          ? 'bg-zinc-500'
                                          : 'bg-red-500'
                                      }`}></span>
                                      {owner.status}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right">
                                    <button 
                                      onClick={() => handleViewOwner(owner)}
                                      className="p-2 rounded-lg text-zinc-900 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700 transition-all text-sm font-medium"
                                    >
                                      View
                                    </button>
                                  </td>
                                </motion.tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </motion.div>
              </>
            )}

            {/* Requests Tab */}
            {activeTab === 'requests' && (
              <>
                <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Change Requests</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">Review and manage pending business change requests</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm font-medium">
                      <Clock className="w-4 h-4" />
                      {requests.length} pending
                    </span>
                  </div>
                </motion.div>

                {/* Requests List */}
                <motion.div variants={itemVariants} className="space-y-4">
                  {requestsLoading ? (
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
                    </div>
                  ) : requests.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
                      <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                      </div>
                      <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300">All caught up!</p>
                      <p className="text-sm text-zinc-500 mt-1">No pending requests to review</p>
                    </div>
                  ) : (
                    requests.map((req) => {
                      const isExpanded = expandedRequestId === req.id;
                      const dateInfo = formatDateTime(req.created_at);
                      
                      return (
                        <motion.div
                          key={req.id}
                          layout
                          className={`bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-shadow ${
                            isExpanded ? 'shadow-lg ring-2 ring-amber-500/20' : 'shadow-sm hover:shadow-md'
                          }`}
                        >
                          {/* Collapsed Header - Click to Expand */}
                          <div 
                            className="p-6 cursor-pointer"
                            onClick={() => setExpandedRequestId(isExpanded ? null : req.id)}
                          >
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 flex-shrink-0">
                                {getRequestIcon(req.request_type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <span className="font-semibold text-lg text-zinc-900 dark:text-white">
                                      {req.business?.name || 'Unknown Business'}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                      <Clock className="w-3 h-3" />
                                      Pending
                                    </span>
                                  </div>
                                  <motion.div
                                    animate={{ rotate: isExpanded ? 180 : 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                  >
                                    <ChevronDown className="w-5 h-5 text-zinc-400" />
                                  </motion.div>
                                </div>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                                  {getRequestTypeLabel(req.request_type)}
                                </p>
                                <div className="flex items-center gap-4 mt-3 text-sm text-zinc-500">
                                  <span className="flex items-center gap-1.5">
                                    <User className="w-4 h-4" />
                                    {getRequesterName(req)}
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4" />
                                    {dateInfo.relative}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="border-t border-zinc-200 dark:border-zinc-800 p-6 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-6"
                            >
                              {/* Submission Details */}
                              <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 border border-zinc-200 dark:border-zinc-700">
                                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
                                  Submission Details
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="flex items-center gap-3">
                                    <User className="w-5 h-5 text-zinc-400" />
                                    <div>
                                      <span className="text-sm text-zinc-500">Submitted by</span>
                                      <p className="font-medium text-zinc-900 dark:text-white">
                                        {getRequesterName(req)}
                                        {req.requester?.username && (
                                          <span className="text-zinc-500 font-normal ml-1">(@{req.requester.username})</span>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <Calendar className="w-5 h-5 text-zinc-400" />
                                    <div>
                                      <span className="text-sm text-zinc-500">Submitted on</span>
                                      <p className="font-medium text-zinc-900 dark:text-white">
                                        {dateInfo.date} <span className="text-zinc-500 font-normal">at {dateInfo.time}</span>
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <Building2 className="w-5 h-5 text-zinc-400" />
                                    <div>
                                      <span className="text-sm text-zinc-500">Business</span>
                                      <p className="font-medium text-zinc-900 dark:text-white">
                                        {req.business?.name}
                                        {req.business?.slug && (
                                          <span className="text-zinc-500 font-normal ml-1">({req.business.slug})</span>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <FileText className="w-5 h-5 text-zinc-400" />
                                    <div>
                                      <span className="text-sm text-zinc-500">Request Type</span>
                                      <p className="font-medium text-zinc-900 dark:text-white">
                                        {getRequestTypeLabel(req.request_type)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Requested Changes */}
                              <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 border border-zinc-200 dark:border-zinc-700">
                                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
                                  Requested Changes
                                </h4>
                                <div className="space-y-3">
                                  {req.new_name && (
                                    <div className="flex items-start gap-3">
                                      <Store className="w-5 h-5 text-zinc-400 mt-0.5" />
                                      <div>
                                        <span className="text-sm text-zinc-500">New Name</span>
                                        <p className="font-medium text-zinc-900 dark:text-white">{req.new_name}</p>
                                      </div>
                                    </div>
                                  )}
                                  {req.new_email && (
                                    <div className="flex items-start gap-3">
                                      <Mail className="w-5 h-5 text-zinc-400 mt-0.5" />
                                      <div>
                                        <span className="text-sm text-zinc-500">New Email</span>
                                        <p className="font-medium text-zinc-900 dark:text-white">{req.new_email}</p>
                                      </div>
                                    </div>
                                  )}
                                  {req.new_phone && (
                                    <div className="flex items-start gap-3">
                                      <Phone className="w-5 h-5 text-zinc-400 mt-0.5" />
                                      <div>
                                        <span className="text-sm text-zinc-500">New Phone</span>
                                        <p className="font-medium text-zinc-900 dark:text-white">{req.new_phone}</p>
                                      </div>
                                    </div>
                                  )}
                                  {req.new_address && (
                                    <div className="flex items-start gap-3">
                                      <MapPin className="w-5 h-5 text-zinc-400 mt-0.5" />
                                      <div>
                                        <span className="text-sm text-zinc-500">New Address</span>
                                        <p className="font-medium text-zinc-900 dark:text-white">{req.new_address}</p>
                                      </div>
                                    </div>
                                  )}
                                  {req.new_logo_url && (
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2 text-sm text-zinc-500">
                                        <ImageIcon className="w-5 h-5 text-zinc-400" />
                                        New Logo
                                      </div>
                                      <div className="ml-8 w-32 h-32 rounded-xl bg-zinc-100 dark:bg-zinc-700 overflow-hidden border-2 border-zinc-200 dark:border-zinc-600">
                                        <img src={req.new_logo_url} alt="New logo" className="w-full h-full object-cover" />
                                      </div>
                                    </div>
                                  )}
                                  {req.new_certificate_url && (
                                    <div className="flex items-start gap-3">
                                      <FileText className="w-5 h-5 text-zinc-400 mt-0.5" />
                                      <div>
                                        <span className="text-sm text-zinc-500">New Certificate</span>
                                        <a 
                                          href={req.new_certificate_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="mt-1 inline-flex items-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-700 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                                        >
                                          <FileText className="w-4 h-4" />
                                          View Certificate
                                        </a>
                                      </div>
                                    </div>
                                  )}
                                  {/* Localization Changes */}
                                  {req.new_currency && (
                                    <div className="flex items-start gap-3">
                                      <Wallet className="w-5 h-5 text-amber-500 mt-0.5" />
                                      <div>
                                        <span className="text-sm text-zinc-500">New Currency</span>
                                        <p className="font-medium text-zinc-900 dark:text-white">{req.new_currency}</p>
                                      </div>
                                    </div>
                                  )}
                                  {req.new_language && (
                                    <div className="flex items-start gap-3">
                                      <Languages className="w-5 h-5 text-blue-500 mt-0.5" />
                                      <div>
                                        <span className="text-sm text-zinc-500">New Language</span>
                                        <p className="font-medium text-zinc-900 dark:text-white">
                                          {req.new_language === 'en' ? 'English' : req.new_language === 'ar' ? 'العربية (Arabic)' : req.new_language}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  {req.new_timezone && (
                                    <div className="flex items-start gap-3">
                                      <Globe className="w-5 h-5 text-green-500 mt-0.5" />
                                      <div>
                                        <span className="text-sm text-zinc-500">New Timezone</span>
                                        <p className="font-medium text-zinc-900 dark:text-white">{req.new_timezone}</p>
                                      </div>
                                    </div>
                                  )}
                                  {/* Tax/VAT Changes */}
                                  {req.new_vat_enabled !== undefined && req.new_vat_enabled !== null && (
                                    <div className="flex items-start gap-3">
                                      <Percent className="w-5 h-5 text-purple-500 mt-0.5" />
                                      <div>
                                        <span className="text-sm text-zinc-500">VAT Status</span>
                                        <p className="font-medium text-zinc-900 dark:text-white">
                                          {req.new_vat_enabled ? 'Enabled' : 'Disabled'}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  {req.new_vat_rate !== undefined && req.new_vat_rate !== null && (
                                    <div className="flex items-start gap-3">
                                      <Percent className="w-5 h-5 text-purple-500 mt-0.5" />
                                      <div>
                                        <span className="text-sm text-zinc-500">New VAT Rate</span>
                                        <p className="font-medium text-zinc-900 dark:text-white">{req.new_vat_rate}%</p>
                                      </div>
                                    </div>
                                  )}
                                  {!req.new_name && !req.new_email && !req.new_phone && !req.new_address && !req.new_logo_url && !req.new_certificate_url && !req.new_currency && !req.new_language && !req.new_timezone && req.new_vat_enabled === undefined && req.new_vat_rate === undefined && (
                                    <p className="text-sm text-zinc-500 italic">No specific changes detailed</p>
                                  )}
                                </div>
                              </div>

                              {/* Requester Notes */}
                              {req.requester_notes && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-5 border border-blue-200 dark:border-blue-800">
                                  <div className="flex items-center gap-2 mb-3">
                                    <StickyNote className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                                      Note from Business
                                    </h4>
                                  </div>
                                  <p className="text-blue-800 dark:text-blue-200">
                                    {req.requester_notes}
                                  </p>
                                </div>
                              )}

                              {/* Admin Notes Input */}
                              <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 border border-zinc-200 dark:border-zinc-700">
                                <div className="flex items-center gap-2 mb-3">
                                  <MessageSquare className="w-5 h-5 text-zinc-500" />
                                  <h4 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
                                    Admin Response Note
                                  </h4>
                                </div>
                                <textarea
                                  value={adminNotes[req.id] || ''}
                                  onChange={(e) => setAdminNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                                  placeholder="Add a note to your response (optional)..."
                                  className="w-full px-4 py-3 text-sm rounded-xl border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 dark:focus:ring-amber-400/50 resize-none transition-all"
                                  rows={3}
                                />
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-4 pt-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApproveRequest(req.id);
                                  }}
                                  disabled={processingRequestId === req.id}
                                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium rounded-xl bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 shadow-sm"
                                >
                                  {processingRequestId === req.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4" />
                                  )}
                                  Approve Request
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRejectRequest(req.id);
                                  }}
                                  disabled={processingRequestId === req.id}
                                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium rounded-xl bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
                                >
                                  <XCircle className="w-4 h-4" />
                                  Reject Request
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </motion.div>
                      );
                    })
                  )}
                </motion.div>
              </>
            )}

            {/* Settings Tab - Placeholder */}
            {activeTab === 'settings' && (
              <motion.div variants={itemVariants}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">System Config</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">Configure platform settings</p>
                  </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
                  <Settings className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
                  <p className="text-zinc-500 dark:text-zinc-400">System configuration coming soon</p>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </main>

      {/* Modals */}
      <NewCreateBusinessModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadBusinesses}
      />
      <NewViewBusinessModal
        business={selectedBusiness}
        isOpen={showViewModal}
        onClose={() => { setShowViewModal(false); setSelectedBusiness(null); }}
      />
      <NewEditBusinessModal
        business={selectedBusiness}
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setSelectedBusiness(null); }}
        onSuccess={loadBusinesses}
      />
      <NewDeleteConfirmationModal
        business={selectedBusiness}
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setSelectedBusiness(null); }}
        onSuccess={loadBusinesses}
      />
      <NotificationsPanel
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        onUpdate={() => {
          // Refresh count when a request is handled
          api.get('/api/businesses/change-requests/all')
            .then(res => setPendingCount(res.data.data?.length || 0))
            .catch(() => {});
          loadBusinesses();
        }}
      />
      
      {/* Owner Modals */}
      <OwnerViewModal
        owner={selectedOwner}
        isOpen={showOwnerViewModal}
        onClose={() => { setShowOwnerViewModal(false); setSelectedOwner(null); }}
        onUpdate={loadOwners}
      />
      <OwnerCreateModal
        isOpen={showOwnerCreateModal}
        onClose={() => setShowOwnerCreateModal(false)}
        onSuccess={loadOwners}
      />
    </div>
  );
}
