'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('setup_token');
    const storedUser = localStorage.getItem('setup_user');

    if (!token || !storedUser) {
      // Not logged in - redirect to login
      router.push('/login');
    } else {
      // Logged in - redirect to orders
      router.push('/orders');
    }
  }, [router]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <Command className="w-8 h-8 animate-spin text-zinc-400" />
    </div>
  );
}
