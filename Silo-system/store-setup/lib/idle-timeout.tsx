'use client';

import { createContext, useContext, useEffect, useRef, useCallback, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes in milliseconds

// Pages that should NOT auto-logout
const EXEMPT_PATHS = [
  '/kitchen-display',
  '/login',
];

interface IdleTimeoutContextType {
  resetTimer: () => void;
  isIdle: boolean;
  remainingTime: number;
}

const IdleTimeoutContext = createContext<IdleTimeoutContextType | undefined>(undefined);

export function useIdleTimeout() {
  const context = useContext(IdleTimeoutContext);
  if (!context) {
    throw new Error('useIdleTimeout must be used within IdleTimeoutProvider');
  }
  return context;
}

interface IdleTimeoutProviderProps {
  children: ReactNode;
}

export function IdleTimeoutProvider({ children }: IdleTimeoutProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const [isIdle, setIsIdle] = useState(false);
  const [remainingTime, setRemainingTime] = useState(IDLE_TIMEOUT_MS);

  // Check if current path is exempt from idle timeout
  const isExemptPath = EXEMPT_PATHS.some(path => pathname?.startsWith(path));

  // Check if user is authenticated
  const isAuthenticated = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('setup_token');
  }, []);

  // Logout function
  const logout = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    // Clear all auth data
    localStorage.removeItem('setup_token');
    localStorage.removeItem('setup_user');
    localStorage.removeItem('setup_business');
    localStorage.removeItem('setup_branch');
    localStorage.removeItem('setup_user_settings');
    
    // Redirect to login
    router.push('/login');
  }, [router]);

  // Reset the idle timer
  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setIsIdle(false);
    setRemainingTime(IDLE_TIMEOUT_MS);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Don't set timeout if exempt or not authenticated
    if (isExemptPath || !isAuthenticated()) {
      return;
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      setIsIdle(true);
      logout();
    }, IDLE_TIMEOUT_MS);
  }, [isExemptPath, isAuthenticated, logout]);

  // Set up activity listeners
  useEffect(() => {
    // Skip if exempt path or not authenticated
    if (isExemptPath || !isAuthenticated()) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      return;
    }

    // Activity events to track
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'wheel',
    ];

    // Throttle the reset timer to avoid too many calls
    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledResetTimer = () => {
      if (throttleTimeout) return;
      throttleTimeout = setTimeout(() => {
        throttleTimeout = null;
        resetTimer();
      }, 1000); // Throttle to once per second
    };

    // Add event listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, throttledResetTimer, { passive: true });
    });

    // Also listen for visibility change (tab focus)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if we should have logged out while tab was hidden
        const timeSinceLastActivity = Date.now() - lastActivityRef.current;
        if (timeSinceLastActivity >= IDLE_TIMEOUT_MS) {
          logout();
        } else {
          resetTimer();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Start the timer
    resetTimer();

    // Update remaining time every second (for potential UI display)
    const intervalId = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      const remaining = Math.max(0, IDLE_TIMEOUT_MS - elapsed);
      setRemainingTime(remaining);
    }, 1000);

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, throttledResetTimer);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
      clearInterval(intervalId);
    };
  }, [pathname, isExemptPath, isAuthenticated, resetTimer, logout]);

  return (
    <IdleTimeoutContext.Provider value={{ resetTimer, isIdle, remainingTime }}>
      {children}
    </IdleTimeoutContext.Provider>
  );
}



