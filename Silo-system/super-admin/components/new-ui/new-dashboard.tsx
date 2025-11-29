"use client";

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
  Command
} from "lucide-react";
import { useBusinessData } from "@/hooks/use-business-data";
import { ModeToggle } from "@/components/mode-toggle";
import { NewCreateBusinessModal } from "@/components/new-ui/modals/new-create-business-modal";
import { NewViewBusinessModal } from "@/components/new-ui/modals/new-view-business-modal";
import { NewEditBusinessModal } from "@/components/new-ui/modals/new-edit-business-modal";
import { NewDeleteConfirmationModal } from "@/components/new-ui/modals/new-delete-confirmation-modal";

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
          
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white font-medium transition-all">
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </a>
          
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all group">
            <Building2 className="w-5 h-5 group-hover:text-zinc-900 dark:group-hover:text-white" />
            Businesses
          </a>
          
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all group">
            <Users className="w-5 h-5 group-hover:text-zinc-900 dark:group-hover:text-white" />
            Users
          </a>

          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4 mt-8 px-2">Settings</div>

          <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all group">
            <Settings className="w-5 h-5 group-hover:text-zinc-900 dark:group-hover:text-white" />
            System Config
          </a>
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
             <button className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 relative">
               <Bell className="w-5 h-5" />
               <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-zinc-900"></span>
             </button>
             <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1"></div>
             <ModeToggle />
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth">
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="max-w-7xl mx-auto space-y-8"
          >
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Dashboard Overview</h1>
                <p className="text-zinc-500 dark:text-zinc-400 mt-1">Welcome back, here's what's happening today.</p>
              </div>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-5 py-2.5 rounded-full font-medium hover:shadow-lg hover:shadow-zinc-500/20 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Add New Business
              </button>
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
                     <span className="text-xs font-medium text-zinc-600 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400 px-2 py-0.5 rounded-full flex items-center gap-1">
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
                    animate={{ width: `${(activeCount / businesses.length) * 100}%` }}
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

            {/* Recent Businesses Table */}
            <motion.div variants={itemVariants} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">All Businesses</h3>
                  <p className="text-sm text-zinc-500">Manage your platform tenants</p>
                </div>
                <button className="text-sm font-medium text-zinc-900 dark:text-white hover:underline">View All</button>
              </div>
              
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
                    {businesses.map((business, i) => (
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
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border
                            bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700
                          `}>
                            <span className={`w-1.5 h-1.5 rounded-full bg-zinc-500 dark:bg-zinc-400`}></span>
                            {business.subscription_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => actions.handleEdit(business)}
                              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-white dark:hover:bg-zinc-800 transition-all"
                            >
                              Settings
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
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
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
    </div>
  );
}
