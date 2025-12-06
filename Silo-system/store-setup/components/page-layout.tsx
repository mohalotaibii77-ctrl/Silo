'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, User, Command, Bell, ChevronDown, Building2, Check, MapPin, Store } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { Sidebar } from '@/components/sidebar';
import { useLanguage } from '@/lib/language-context';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';

interface UserData {
  id: number;
  username: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  email?: string | null;
}

interface Business {
  id: number;
  name: string;
  slug: string;
  logo_url?: string | null;
  language?: string;
  currency?: string;
  timezone?: string;
  country?: string;
}

interface Branch {
  id: number;
  business_id: number;
  name: string;
  slug: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  is_main: boolean;
  is_active: boolean;
}

interface WorkspaceBusiness extends Business {
  role?: string;
}

interface PageLayoutProps {
  children: ReactNode;
  searchPlaceholder?: { en: string; ar: string };
}

export function PageLayout({ children, searchPlaceholder }: PageLayoutProps) {
  const router = useRouter();
  const { isRTL, t } = useLanguage();
  const [user, setUser] = useState<UserData | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<WorkspaceBusiness[]>([]);
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('setup_token');
    const storedUser = localStorage.getItem('setup_user');
    const storedBusiness = localStorage.getItem('setup_business');
    const storedBranch = localStorage.getItem('setup_branch');

    if (!token || !storedUser) {
      router.push('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      if (parsedUser.role !== 'owner' && parsedUser.role !== 'manager') {
        handleLogout();
        return;
      }
      setUser(parsedUser);
      
      let parsedBusiness: Business | null = null;
      if (storedBusiness) {
        parsedBusiness = JSON.parse(storedBusiness);
        setBusiness(parsedBusiness);
      }

      // Restore selected branch from localStorage
      if (storedBranch) {
        try {
          setCurrentBranch(JSON.parse(storedBranch));
        } catch {}
      }

      // Fetch workspaces if user is an owner
      if (parsedUser.role === 'owner' && parsedUser.username) {
        fetchWorkspaces(parsedUser.username);
      }

      // Fetch branches for the current business
      if (parsedBusiness?.id) {
        fetchBranches(parsedBusiness.id);
      }
    } catch {
      router.push('/login');
      return;
    }

    setLoading(false);
  }, [router]);

  const fetchWorkspaces = async (username: string) => {
    try {
      const response = await api.get(`/owners/businesses-by-username?username=${encodeURIComponent(username)}`);
      if (response.data.businesses && response.data.businesses.length > 0) {
        setWorkspaces(response.data.businesses);
      }
    } catch (err) {
      console.error('Failed to fetch workspaces:', err);
    }
  };

  const fetchBranches = async (businessId: number) => {
    try {
      const response = await api.get(`/businesses/${businessId}/branches`);
      if (response.data.branches && response.data.branches.length > 0) {
        setBranches(response.data.branches);
        
        // If no branch is selected, select the main branch or first one
        const storedBranch = localStorage.getItem('setup_branch');
        if (!storedBranch) {
          const mainBranch = response.data.branches.find((b: Branch) => b.is_main) || response.data.branches[0];
          setCurrentBranch(mainBranch);
          localStorage.setItem('setup_branch', JSON.stringify(mainBranch));
        }
      }
    } catch (err) {
      console.error('Failed to fetch branches:', err);
    }
  };

  const switchBranch = (branch: Branch) => {
    localStorage.setItem('setup_branch', JSON.stringify(branch));
    setCurrentBranch(branch);
    setShowBranchDropdown(false);
    
    // Reload to refresh data for the new branch context
    window.location.reload();
  };

  const switchWorkspace = (newBusiness: WorkspaceBusiness) => {
    // Update business in localStorage
    localStorage.setItem('setup_business', JSON.stringify(newBusiness));
    setBusiness(newBusiness);
    setShowWorkspaceDropdown(false);

    // Clear branch selection when switching business
    localStorage.removeItem('setup_branch');
    setCurrentBranch(null);
    setBranches([]);

    // Update language direction
    const lang = newBusiness.language || 'en';
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;

    // Reload the page to refresh all data for the new business
    window.location.reload();
  };

  const handleLogout = () => {
    localStorage.removeItem('setup_token');
    localStorage.removeItem('setup_user');
    localStorage.removeItem('setup_business');
    localStorage.removeItem('setup_branch');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Command className="w-8 h-8 animate-spin text-zinc-900 dark:text-white" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans" dir={isRTL ? 'rtl' : 'ltr'}>
      <Sidebar business={business} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl sticky top-0 z-30 px-6 flex items-center justify-between">
          {/* Business & Branch Switcher */}
          <div className="flex items-center gap-4">
            <div 
              className="relative"
              onMouseEnter={() => branches.length > 1 && setShowBranchDropdown(true)}
              onMouseLeave={() => setShowBranchDropdown(false)}
            >
              <button 
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                {/* Business Logo */}
                <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center flex-shrink-0 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                  {business?.logo_url ? (
                    <img src={business.logo_url} alt={business.name} className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <Store size={16} className="text-zinc-500 dark:text-zinc-400" />
                  )}
                </div>
                
                {/* Business & Branch Names */}
                <div className={`flex flex-col ${isRTL ? 'items-end' : 'items-start'}`}>
                  <span className="font-semibold text-sm text-zinc-900 dark:text-white leading-tight">
                    {business?.name || t('Select Business', 'اختر المنشأة')}
                  </span>
                  {currentBranch && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                      <MapPin size={10} />
                      {currentBranch.name}
                      {currentBranch.is_main && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium">
                          {t('Main', 'رئيسي')}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                
                {branches.length > 1 && (
                  <ChevronDown size={16} className={`text-zinc-400 transition-transform ${showBranchDropdown ? 'rotate-180' : ''}`} />
                )}
              </button>

              {/* Branch Dropdown */}
              <AnimatePresence>
                {showBranchDropdown && branches.length > 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className={`absolute top-full mt-2 ${isRTL ? 'right-0' : 'left-0'} w-72 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl z-50 overflow-hidden`}
                  >
                    <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        {t('Switch Branch', 'تبديل الفرع')}
                      </p>
                    </div>
                    <div className="max-h-64 overflow-y-auto py-2">
                      {branches.filter(b => b.is_active).map((branch) => (
                        <button
                          key={branch.id}
                          onClick={() => switchBranch(branch)}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${
                            currentBranch?.id === branch.id ? 'bg-zinc-50 dark:bg-zinc-800/50' : ''
                          } ${isRTL ? 'flex-row-reverse' : ''}`}
                        >
                          <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 border border-zinc-200 dark:border-zinc-700">
                            <MapPin size={18} className="text-zinc-500 dark:text-zinc-400" />
                          </div>
                          <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                            <p className="font-medium text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                              {branch.name}
                              {branch.is_main && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium">
                                  {t('Main', 'رئيسي')}
                                </span>
                              )}
                            </p>
                            {branch.address && (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                {branch.address}
                              </p>
                            )}
                          </div>
                          {currentBranch?.id === branch.id && (
                            <Check size={16} className="text-emerald-500 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 relative">
              <Bell className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1"></div>
            <ModeToggle />
            <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1"></div>
            {/* Workspace Switcher & User Profile */}
            <div 
              className="relative"
              onMouseEnter={() => workspaces.length > 1 && setShowWorkspaceDropdown(true)}
              onMouseLeave={() => setShowWorkspaceDropdown(false)}
            >
              <button className={`flex items-center gap-3 ${workspaces.length > 1 ? 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 -mx-2 px-2 py-1.5 rounded-lg transition-colors' : ''}`}>
                <div className={`hidden sm:block ${isRTL ? 'text-left' : 'text-right'}`}>
                  <p className="font-semibold text-sm text-zinc-900 dark:text-white">
                    {user?.first_name || user?.username}
                  </p>
                  <p className="text-xs capitalize text-zinc-500 dark:text-zinc-400">
                    {user?.role}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                  <User size={16} className="text-zinc-600 dark:text-zinc-400" />
                </div>
                {workspaces.length > 1 && (
                  <ChevronDown size={14} className={`text-zinc-400 transition-transform ${showWorkspaceDropdown ? 'rotate-180' : ''}`} />
                )}
              </button>

              {/* Workspace Dropdown */}
              <AnimatePresence>
                {showWorkspaceDropdown && workspaces.length > 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className={`absolute top-full mt-2 ${isRTL ? 'left-0' : 'right-0'} w-72 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl z-50 overflow-hidden`}
                  >
                    <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        {t('Switch Workspace', 'تبديل مساحة العمل')}
                      </p>
                    </div>
                    <div className="max-h-64 overflow-y-auto py-2">
                      {workspaces.map((ws) => (
                        <button
                          key={ws.id}
                          onClick={() => switchWorkspace(ws)}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${
                            business?.id === ws.id ? 'bg-zinc-50 dark:bg-zinc-800/50' : ''
                          }`}
                        >
                          <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 border border-zinc-200 dark:border-zinc-700">
                            {ws.logo_url ? (
                              <img src={ws.logo_url} alt={ws.name} className="w-full h-full object-cover rounded-lg" />
                            ) : (
                              <Building2 size={18} className="text-zinc-500 dark:text-zinc-400" />
                            )}
                          </div>
                          <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                            <p className="font-medium text-sm text-zinc-900 dark:text-white truncate">
                              {ws.name}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              @{ws.slug}
                            </p>
                          </div>
                          {business?.id === ws.id && (
                            <Check size={16} className="text-emerald-500 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
              title={t('Logout', 'تسجيل الخروج')}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8" dir={isRTL ? 'rtl' : 'ltr'}>
          {children}
        </div>
      </main>
    </div>
  );
}

// Hook to get business and branch data for pages that need it
export function usePageData() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  
  useEffect(() => {
    const storedBusiness = localStorage.getItem('setup_business');
    const storedBranch = localStorage.getItem('setup_branch');
    
    if (storedBusiness) {
      try {
        setBusiness(JSON.parse(storedBusiness));
      } catch {}
    }
    
    if (storedBranch) {
      try {
        setBranch(JSON.parse(storedBranch));
      } catch {}
    }
  }, []);
  
  return { business, branch };
}

// Export Branch type for other components
export type { Branch };

