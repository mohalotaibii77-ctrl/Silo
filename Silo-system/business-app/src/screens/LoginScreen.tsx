import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Animated, Easing, Dimensions, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { storeAuthToken } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import { useLocalization } from '../localization';
import { Command, Mail, Lock, Sun, Moon, ArrowRight } from 'lucide-react-native';
import { dataPreloader } from '../services/DataPreloader';
import { useBiometricAuth } from '../hooks/useBiometricAuth';
import { BiometricButton } from '../components/BiometricButton';
import { BiometricEnrollmentModal } from '../components/BiometricEnrollmentModal';

const { width } = Dimensions.get('window');

export default function LoginScreen({ navigation }: any) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { applyLanguageFromSettings, refreshCurrency, t, language } = useLocalization();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Biometric authentication state
  const biometric = useBiometricAuth();
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [pendingLoginData, setPendingLoginData] = useState<any>(null);
  const [biometricLoading, setBiometricLoading] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.setValue(0);
    }
  }, [loading, spinValue]);

  // Auto-prompt biometric login if available and enabled
  useEffect(() => {
    const checkBiometricLogin = async () => {
      // Wait for biometric state to load
      if (biometric.isLoading) return;

      // Only auto-prompt if biometrics are available, enabled, and we have stored credentials
      if (biometric.isAvailable && biometric.isEnabled && biometric.hasStoredCredentials) {
        // Small delay for better UX
        setTimeout(() => {
          handleBiometricLogin();
        }, 500);
      }
    };

    checkBiometricLogin();
  }, [biometric.isLoading, biometric.isAvailable, biometric.isEnabled, biometric.hasStoredCredentials]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Handle biometric login
  const handleBiometricLogin = async () => {
    if (biometricLoading || loading) return;

    setBiometricLoading(true);
    try {
      const result = await biometric.promptAndLogin(
        t('Sign in to Silo', 'تسجيل الدخول إلى Silo')
      );

      if (result.success && result.userData) {
        // Process successful login
        await processLoginSuccess(result.userData);
      } else if (result.error) {
        // Only show error if user didn't cancel
        if (!result.error.includes('cancel') && !result.error.includes('Cancel')) {
          if (Platform.OS === 'web') {
            window.alert(t('Biometric login failed. Please use email and password.', 'فشل تسجيل الدخول البيومتري. يرجى استخدام البريد الإلكتروني وكلمة المرور.'));
          }
        }
      }
    } catch (error) {
      console.error('[Login] Biometric login error:', error);
    } finally {
      setBiometricLoading(false);
    }
  };

  // Process successful login (shared between password and biometric login)
  const processLoginSuccess = async (data: any, credentialsForEnrollment?: { email: string; password: string }) => {
    // Store token securely
    await storeAuthToken(data.token);
    await AsyncStorage.setItem('token', data.token); // Keep for backward compatibility
    await AsyncStorage.setItem('user', JSON.stringify(data.user));

    // Save business data including currency settings
    if (data.business) {
      await AsyncStorage.setItem('business', JSON.stringify(data.business));
      refreshCurrency();
    }

    // Save all businesses for workspace switching (owners only)
    if (data.businesses && data.businesses.length > 0) {
      await AsyncStorage.setItem('businesses', JSON.stringify(data.businesses));
    }

    // Save user settings (persisted from database)
    if (data.userSettings) {
      await AsyncStorage.setItem('userSettings', JSON.stringify(data.userSettings));

      // Apply language immediately from user settings
      const preferredLang = data.userSettings.preferred_language;
      if (preferredLang) {
        applyLanguageFromSettings(preferredLang);
      }
    } else if (data.business?.language) {
      // Fallback to business language if no user settings
      applyLanguageFromSettings(data.business.language);
    }

    const role = data.user.role;
    const userId = data.user.id?.toString();

    // Check if user needs to change their default password (first-time login)
    if (data.requiresPasswordChange) {
      console.log('[Login] First-time login - redirecting to set password');
      navigation.replace('SetPassword', {
        token: data.token,
        userData: data.user,
        businessData: data.business,
        businessesData: data.businesses,
        userSettings: data.userSettings,
      });
      return;
    }

    // Check if we should prompt for biometric enrollment
    if (credentialsForEnrollment && biometric.isAvailable && !biometric.isEnabled && userId) {
      const hasBeenPrompted = await biometric.hasBeenPrompted(userId);
      if (!hasBeenPrompted) {
        // Store login data and show enrollment modal
        setPendingLoginData({ data, role, credentialsForEnrollment });
        setShowEnrollmentModal(true);
        return;
      }
    }

    // Navigate to dashboard
    navigateToDashboard(role);
  };

  // Navigate to appropriate dashboard based on role
  const navigateToDashboard = (role: string) => {
    // Start background preloading immediately (don't wait)
    dataPreloader.preloadAll().catch(console.error);

    if (role === 'owner') {
      navigation.replace('OwnerDashboard');
    } else if (role === 'manager' || role === 'operations_manager') {
      navigation.replace('StaffDashboard');
    } else if (role === 'pos' || role === 'cashier') {
      navigation.replace('POSTerminal');
    } else if (role === 'kitchen_display') {
      navigation.replace('KitchenDisplay');
    } else if (role === 'employee') {
      navigation.replace('StaffDashboard');
    } else {
      navigation.replace('StaffDashboard');
    }
  };

  // Handle biometric enrollment
  const handleEnableBiometric = async () => {
    if (!pendingLoginData) return;

    const { credentialsForEnrollment } = pendingLoginData;
    const userId = pendingLoginData.data.user.id?.toString();

    try {
      const success = await biometric.enableBiometric(
        userId,
        credentialsForEnrollment.email,
        credentialsForEnrollment.password
      );

      if (success) {
        console.log('[Login] Biometric enabled successfully');
      }
    } catch (error) {
      console.error('[Login] Error enabling biometric:', error);
    }

    // Close modal and navigate
    setShowEnrollmentModal(false);
    navigateToDashboard(pendingLoginData.role);
    setPendingLoginData(null);
  };

  const handleSkipEnrollment = () => {
    if (!pendingLoginData) return;

    setShowEnrollmentModal(false);
    navigateToDashboard(pendingLoginData.role);
    setPendingLoginData(null);
  };

  const handleDontAskAgain = async () => {
    if (!pendingLoginData) return;

    const userId = pendingLoginData.data.user.id?.toString();
    if (userId) {
      await biometric.markAsPrompted(userId);
    }

    setShowEnrollmentModal(false);
    navigateToDashboard(pendingLoginData.role);
    setPendingLoginData(null);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      if (Platform.OS === 'web') {
        window.alert(t('Please enter email and password', 'يرجى إدخال البريد الإلكتروني وكلمة المرور'));
      } else {
        Alert.alert(t('Error', 'خطأ'), t('Please enter email and password', 'يرجى إدخال البريد الإلكتروني وكلمة المرور'));
      }
      return;
    }

    setLoading(true);
    try {
      console.log('[Login] Attempting login with:', email);
      console.log('[Login] API baseURL:', api.defaults.baseURL);
      const response = await api.post('/business-auth/login', { email, password });
      console.log('[Login] Response:', response.data);

      // Process login success with credentials for enrollment check
      await processLoginSuccess(response.data, { email, password });
    } catch (error: any) {
      console.error('[Login] Error:', error);
      console.error('[Login] Error response:', error.response?.data);
      const errorMessage = error.response?.data?.error || error.message || t('Invalid credentials', 'بيانات الاعتماد غير صالحة');
      if (Platform.OS === 'web') {
        window.alert(t('Login Failed', 'فشل تسجيل الدخول') + ': ' + errorMessage);
      } else {
        Alert.alert(t('Login Failed', 'فشل تسجيل الدخول'), errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      padding: 24,
    },
    themeToggle: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 60 : 40,
      right: 24,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.secondary,
      zIndex: 10,
    },
    contentContainer: {
      width: '100%',
      maxWidth: 420,
      alignSelf: 'center',
    },
    logoSection: {
      alignItems: 'center',
      marginBottom: 40,
    },
    logoContainer: {
      width: 72,
      height: 72,
      backgroundColor: isDark ? '#18181b' : '#ffffff', // Zinc-900 / White
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 5,
    },
    title: {
      fontSize: 30,
      fontWeight: '700',
      color: colors.foreground,
      marginBottom: 8,
      letterSpacing: -0.5,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: colors.mutedForeground,
      textAlign: 'center',
      lineHeight: 24,
    },
    card: {
      backgroundColor: isDark ? 'rgba(24, 24, 27, 0.8)' : 'rgba(255, 255, 255, 0.9)',
      borderRadius: 24,
      padding: 32,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 24,
      elevation: 8,
    },
    inputGroup: {
      marginBottom: 20,
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.mutedForeground,
      marginBottom: 8,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginLeft: 4,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.input,
      borderRadius: 14,
      paddingHorizontal: 16,
      height: 56, // Taller inputs
    },
    inputIcon: {
      marginRight: 12,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: colors.foreground,
      height: '100%',
    },
    forgotPassword: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginBottom: 24,
    },
    forgotPasswordText: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontWeight: '500',
    },
    button: {
      backgroundColor: colors.primary,
      height: 56,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
      gap: 10,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    buttonText: {
      color: colors.primaryForeground,
      fontSize: 16,
      fontWeight: '600',
    },
    footer: {
      marginTop: 24,
      alignItems: 'center',
    },
    footerText: {
      fontSize: 12,
      color: colors.mutedForeground,
      opacity: 0.6,
    },
  });

  return (
    <View style={styles.container}>
      {/* Theme toggle button */}
      <TouchableOpacity
        onPress={toggleTheme}
        style={{
          position: 'absolute',
          top: 50,
          right: 20,
          padding: 10,
          backgroundColor: colors.card,
          borderRadius: 20,
          zIndex: 10,
        }}
      >
        {isDark ? (
          <Sun size={24} color={colors.foreground} />
        ) : (
          <Moon size={24} color={colors.foreground} />
        )}
      </TouchableOpacity>

      <Animated.View 
        style={[
          styles.contentContainer, 
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <Command size={40} color={isDark ? '#ffffff' : '#18181b'} />
          </View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Enter your credentials to access Silo</Text>
        </View>
        
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputContainer}>
              <Mail size={20} color={colors.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="name@company.com"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
          </View>
          
          <View style={styles.inputGroup}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
              <Text style={[styles.label, {marginBottom: 0}]}>Password</Text>
              <TouchableOpacity>
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputContainer}>
              <Lock size={20} color={colors.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
          </View>
          
          <TouchableOpacity
            style={[styles.button, (loading || biometricLoading) && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading || biometricLoading}
          >
            {loading ? (
              <>
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <Command size={20} color={colors.primaryForeground} />
                </Animated.View>
                <Text style={styles.buttonText}>{t('Signing in...', 'جاري تسجيل الدخول...')}</Text>
              </>
            ) : (
              <>
                <Text style={styles.buttonText}>{t('Sign in', 'تسجيل الدخول')}</Text>
                <ArrowRight size={20} color={colors.primaryForeground} />
              </>
            )}
          </TouchableOpacity>

          {/* Biometric login button - shown when available and has stored credentials */}
          {biometric.isAvailable && biometric.hasStoredCredentials && !biometric.isLoading && (
            <View style={{ marginTop: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                <Text style={{ marginHorizontal: 12, color: colors.mutedForeground, fontSize: 12 }}>
                  {t('or', 'أو')}
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              </View>
              <BiometricButton
                onPress={handleBiometricLogin}
                disabled={loading || biometricLoading}
                loading={biometricLoading}
                variant="outline"
                biometricType={biometric.biometricType}
              />
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('Powered by Silo System', 'مدعوم من نظام Silo')}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Biometric Enrollment Modal */}
      <BiometricEnrollmentModal
        visible={showEnrollmentModal}
        onEnable={handleEnableBiometric}
        onSkip={handleSkipEnrollment}
        onDontAskAgain={handleDontAskAgain}
        biometricType={biometric.biometricType}
      />
    </View>
  );
}
