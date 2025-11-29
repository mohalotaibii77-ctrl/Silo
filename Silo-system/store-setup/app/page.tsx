'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, ArrowRight, CheckCircle2, LogOut, User, Command } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { motion } from 'framer-motion';

interface User {
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
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('setup_token');
    const storedUser = localStorage.getItem('setup_user');
    const storedBusiness = localStorage.getItem('setup_business');

    if (!token || !storedUser) {
      router.push('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      
      // Verify role permission
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
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-zinc-900 dark:bg-white shadow-sm">
            <Store size={20} className="text-white dark:text-zinc-900" />
          </div>
          <div>
            <h1 className="font-bold text-zinc-900 dark:text-white">
              {business?.name || 'Store Setup'}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              Setup Wizard
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <ModeToggle />
          <div className="h-8 w-[1px] bg-zinc-200 dark:bg-zinc-800 mx-2 hidden sm:block" />
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="font-semibold text-sm text-zinc-900 dark:text-white">
                {user?.first_name || user?.username}
              </p>
              <p className="text-xs capitalize text-zinc-500 dark:text-zinc-400">
                {user?.role}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              <User size={18} className="text-zinc-600 dark:text-zinc-400" />
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center p-8 pt-20 pb-20">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl w-full text-center space-y-10"
        >
          {/* Logo & Title */}
          <div className="space-y-6">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="inline-flex items-center justify-center w-24 h-24 rounded-3xl mb-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl"
            >
              <Store className="w-12 h-12 text-zinc-900 dark:text-white" />
            </motion.div>
            <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Welcome to Store Setup
            </h1>
            <p className="text-xl max-w-lg mx-auto text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Get your restaurant up and running in minutes with our guided setup wizard.
            </p>
          </div>

          {/* Features */}
          <div className="grid gap-4 text-left mt-12">
            {[
              'Configure your restaurant profile and branding',
              'Set up your menu categories and items',
              'Add staff members and assign roles',
              'Configure POS terminals and payment methods',
              'Set up inventory and supplier connections',
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + (i * 0.1) }}
                className="flex items-center gap-4 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-zinc-900 dark:text-white" />
                </div>
                <span className="text-base font-medium text-zinc-700 dark:text-zinc-200">{feature}</span>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="pt-8"
          >
            <button 
              className="inline-flex items-center gap-3 px-10 py-5 rounded-2xl font-semibold text-lg transition-all hover:-translate-y-1 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xl hover:shadow-2xl shadow-zinc-900/20 dark:shadow-white/10"
            >
              Start Setup Wizard
              <ArrowRight className="w-5 h-5" />
            </button>
            <p className="text-sm mt-6 text-zinc-400 dark:text-zinc-500">
              Takes approximately 10-15 minutes to complete
            </p>
          </motion.div>
        </motion.div>
      </div>
    </main>
  );
}
