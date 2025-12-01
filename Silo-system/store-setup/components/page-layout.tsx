'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, User, Command, Bell, Search } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { Sidebar } from '@/components/sidebar';
import { useLanguage } from '@/lib/language-context';

interface UserData {
  id: number;
  username: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
}

interface Business {
  id: number;
  name: string;
  slug: string;
  logo_url?: string | null;
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
    } catch {
      router.push('/login');
      return;
    }

    setLoading(false);
  }, [router]);

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
            <div className="flex items-center gap-3">
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

