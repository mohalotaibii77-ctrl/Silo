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
  AlertCircle
} from "lucide-react";
import { useBusinessData } from "@/hooks/use-business-data";
import { ModeToggle } from "@/components/mode-toggle";
import { NewCreateBusinessModal } from "@/components/new-ui/modals/new-create-business-modal";
import { NewViewBusinessModal } from "@/components/new-ui/modals/new-view-business-modal";
import { NewEditBusinessModal } from "@/components/new-ui/modals/new-edit-business-modal";
import { NewDeleteConfirmationModal } from "@/components/new-ui/modals/new-delete-confirmation-modal";
import { NotificationsPanel } from "@/components/new-ui/modals/notifications-panel";
import { useState as useStateNotif, useEffect as useEffectNotif } from "react";
import api from "@/lib/api";

type ActiveTab = 'dashboard' | 'businesses' | 'users' | 'settings';

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

  const activeCount = businesses.filter(b => b.subscription_status === 'active').length;
  const suspendedCount = businesses.filter(b => b.subscription_status === 'suspended').length;
  const totalRevenue = businesses.reduce((acc, b) => acc + (b.subscription_tier === 'enterprise' ? 299 : b.subscription_tier === 'pro' ? 99 : 0), 0); // Mock revenue calc

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
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-indigo-500/20 shadow-lg">
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
                className="pl-9 pr-4 py-2 w-64 rounded-full bg-zinc-100 dark:bg-zinc-800 border-none text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-zinc-500 text-zinc-900 dark:text-white"
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
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                        <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-zinc-500">Trial Accounts</p>
                        <p className="text-xl font-bold text-zinc-900 dark:text-white">
                          {businesses.filter(b => b.subscription_status === 'trial').length}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm text-zinc-500">Suspended</p>
                        <p className="text-xl font-bold text-zinc-900 dark:text-white">
                          {businesses.filter(b => b.subscription_status === 'suspended').length}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                        <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm text-zinc-500">Total Users</p>
                        <p className="text-xl font-bold text-zinc-900 dark:text-white">
                          {businesses.reduce((acc, b) => acc + (b.user_count || 0), 0)}
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
                                    : business.subscription_status === 'trial'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800'
                                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    business.subscription_status === 'active' 
                                      ? 'bg-emerald-500'
                                      : business.subscription_status === 'trial'
                                      ? 'bg-blue-500'
                                      : 'bg-zinc-500'
                                  }`}></span>
                                  {business.subscription_status}
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

            {/* Users Tab - Placeholder */}
            {activeTab === 'users' && (
              <motion.div variants={itemVariants}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Users</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">Manage platform administrators</p>
                  </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
                  <Users className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
                  <p className="text-zinc-500 dark:text-zinc-400">Users management coming soon</p>
                </div>
              </motion.div>
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
    </div>
  );
}
