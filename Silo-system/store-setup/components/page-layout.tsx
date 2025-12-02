'use client';

import { useEffect, useState, ReactNode, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, User, Command, Bell, Search, ChevronDown, Building2, Check } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { Sidebar } from '@/components/sidebar';
import { useLanguage } from '@/lib/language-context';
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowWorkspaceDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('setup_token');
    const storedUser = localStorage.getItem('setup_user');
    const storedBusiness = localStorage.getItem('setup_business');

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
      if (storedBusiness) {
        setBusiness(JSON.parse(storedBusiness));
      }

      // Fetch workspaces if user is an owner
      if (parsedUser.role === 'owner' && parsedUser.username) {
        fetchWorkspaces(parsedUser.username);
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

  const switchWorkspace = (newBusiness: WorkspaceBusiness) => {
    // Update business in localStorage
    localStorage.setItem('setup_business', JSON.stringify(newBusiness));
    setBusiness(newBusiness);
    setShowWorkspaceDropdown(false);

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
          <div className="flex items-center gap-4">
            {searchPlaceholder && (
              <div className="relative hidden sm:block">
                <Search className={`w-4 h-4 absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-zinc-400`} />
                <input 
                  type="text" 
                  placeholder={t(searchPlaceholder.en, searchPlaceholder.ar)}
                  className={`${isRTL ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2 w-64 rounded-full bg-zinc-100 dark:bg-zinc-800 border-none text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none transition-all placeholder:text-zinc-500 text-zinc-900 dark:text-white`}
                />
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 relative">
              <Bell className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1"></div>
            <ModeToggle />
            <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1"></div>
            {/* Workspace Switcher & User Profile */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => workspaces.length > 1 && setShowWorkspaceDropdown(!showWorkspaceDropdown)}
                className={`flex items-center gap-3 ${workspaces.length > 1 ? 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 -mx-2 px-2 py-1.5 rounded-lg transition-colors' : ''}`}
              >
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
              {showWorkspaceDropdown && workspaces.length > 1 && (
                <div className={`absolute top-full mt-2 ${isRTL ? 'left-0' : 'right-0'} w-72 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl z-50 overflow-hidden`}>
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
                </div>
              )}
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

        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

// Hook to get business data for pages that need it
export function usePageData() {
  const [business, setBusiness] = useState<Business | null>(null);
  
  useEffect(() => {
    const storedBusiness = localStorage.getItem('setup_business');
    if (storedBusiness) {
      try {
        setBusiness(JSON.parse(storedBusiness));
      } catch {}
    }
  }, []);
  
  return { business };
}

