import { AppState, AppStateStatus, PanResponder, GestureResponderEvent, PanResponderGestureState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes in milliseconds

// Screens that should NOT auto-logout (full logout)
const EXEMPT_SCREENS = [
  'KitchenDisplay',
  'Login',
  'SetPassword',
];

// Screens that should LOCK instead of logout (show PIN pad)
const LOCK_SCREENS = [
  'POSTerminal',
  'POS',
];

type NavigateFunction = (screen: string) => void;
type LockScreenCallback = () => void;

class IdleTimeoutService {
  private timeoutId: NodeJS.Timeout | null = null;
  private lastActivityTime: number = Date.now();
  private isMonitoring: boolean = false;
  private currentScreen: string = '';
  private navigateToLogin: NavigateFunction | null = null;
  private appStateSubscription: any = null;
  private onLockScreen: LockScreenCallback | null = null;
  private isLocked: boolean = false;

  // Start monitoring for idle timeout
  start(currentScreen: string, navigateToLogin: NavigateFunction, onLockScreen?: LockScreenCallback) {
    this.currentScreen = currentScreen;
    this.navigateToLogin = navigateToLogin;
    this.onLockScreen = onLockScreen || null;
    this.lastActivityTime = Date.now();
    this.isMonitoring = true;
    this.isLocked = false;

    // Listen for app state changes (background/foreground)
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

    // Start the idle timer
    this.resetTimer();
  }

  // Set the lock screen callback (can be set after start)
  setLockScreenCallback(callback: LockScreenCallback | null) {
    this.onLockScreen = callback;
  }

  // Check if screen should lock instead of logout
  private shouldLockScreen(screenName: string): boolean {
    return LOCK_SCREENS.some(screen => screenName.includes(screen));
  }

  // Called when user unlocks with PIN
  unlock() {
    this.isLocked = false;
    this.lastActivityTime = Date.now();
    this.resetTimer();
  }

  // Check if currently locked
  getIsLocked(): boolean {
    return this.isLocked;
  }

  // Stop monitoring
  stop() {
    this.isMonitoring = false;
    this.clearTimer();
    
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  // Update current screen (called when navigation changes)
  updateScreen(screenName: string) {
    this.currentScreen = screenName;
    
    // If navigated to exempt screen, clear timer
    if (this.isExemptScreen(screenName)) {
      this.clearTimer();
    } else {
      // Reset timer when navigating to non-exempt screen
      this.resetTimer();
    }
  }

  // Check if current screen is exempt from idle timeout
  private isExemptScreen(screenName: string): boolean {
    return EXEMPT_SCREENS.includes(screenName);
  }

  // Reset the idle timer (called on user activity)
  resetTimer() {
    this.lastActivityTime = Date.now();
    this.clearTimer();

    // Don't set timer if monitoring is off or on exempt screen
    if (!this.isMonitoring || this.isExemptScreen(this.currentScreen)) {
      return;
    }

    // Set new timeout
    this.timeoutId = setTimeout(() => {
      this.handleIdleTimeout();
    }, IDLE_TIMEOUT_MS);
  }

  // Clear the existing timer
  private clearTimer() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  // Handle app state changes
  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      // App came to foreground - check if we should have logged out or locked
      const timeSinceLastActivity = Date.now() - this.lastActivityTime;
      
      if (timeSinceLastActivity >= IDLE_TIMEOUT_MS && !this.isExemptScreen(this.currentScreen)) {
        this.handleIdleTimeout();
      } else if (!this.isLocked) {
        // Only reset timer if not locked
        this.resetTimer();
      }
    } else if (nextAppState === 'background') {
      // App went to background - clear timer (will check on return)
      this.clearTimer();
    }
  };

  // Handle idle timeout - lock screen or logout user
  private async handleIdleTimeout() {
    if (this.isExemptScreen(this.currentScreen)) {
      return;
    }

    // Check if this screen should lock instead of logout
    if (this.shouldLockScreen(this.currentScreen)) {
      console.log('[IdleTimeout] User idle for 5 minutes, locking POS screen...');
      this.isLocked = true;
      
      // Call lock screen callback if set
      if (this.onLockScreen) {
        this.onLockScreen();
      }
      return;
    }

    console.log('[IdleTimeout] User idle for 5 minutes, logging out...');

    // Clear all auth data
    await this.clearAuthData();

    // Navigate to login
    if (this.navigateToLogin) {
      this.navigateToLogin('Login');
    }
  }

  // Clear auth data from storage
  private async clearAuthData() {
    try {
      await AsyncStorage.multiRemove([
        'token',
        'user',
        'business',
        'businesses',
        'userSettings',
      ]);
    } catch (error) {
      console.error('[IdleTimeout] Error clearing auth data:', error);
    }
  }

  // Record user activity (call this on touch events)
  recordActivity() {
    if (!this.isMonitoring || this.isExemptScreen(this.currentScreen)) {
      return;
    }
    
    this.lastActivityTime = Date.now();
    
    // Only reset timer if significant time has passed (throttle)
    const timeSinceReset = Date.now() - this.lastActivityTime;
    if (timeSinceReset > 1000) {
      this.resetTimer();
    }
  }

  // Create a PanResponder that tracks all touch events
  createActivityTracker() {
    return PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {
        this.resetTimer();
        return false; // Don't capture - let children handle touches
      },
      onMoveShouldSetPanResponderCapture: () => {
        this.resetTimer();
        return false;
      },
    });
  }

  // Get remaining time until timeout (for UI display if needed)
  getRemainingTime(): number {
    const elapsed = Date.now() - this.lastActivityTime;
    return Math.max(0, IDLE_TIMEOUT_MS - elapsed);
  }

  // Check if user is currently authenticated
  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem('token');
      return !!token;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const idleTimeout = new IdleTimeoutService();

// Export the class for testing
export { IdleTimeoutService };



