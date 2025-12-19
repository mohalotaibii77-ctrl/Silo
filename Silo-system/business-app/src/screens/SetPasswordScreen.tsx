import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Animated, Easing, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import { Command, Lock, Eye, EyeOff, Shield, Check } from 'lucide-react-native';
import { dataPreloader } from '../services/DataPreloader';

export default function SetPasswordScreen({ navigation, route }: any) {
  const { colors, isDark } = useTheme();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Get user data from route params (passed from login)
  const userData = route.params?.userData;
  const token = route.params?.token;
  const businessData = route.params?.businessData;
  const businessesData = route.params?.businessesData;
  const userSettings = route.params?.userSettings;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Password validation
  const isValidPassword = newPassword.length >= 6;
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const handleSetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      const msg = 'Please enter and confirm your new password';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
      return;
    }

    if (newPassword.length < 6) {
      const msg = 'Password must be at least 6 characters';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
      return;
    }

    if (newPassword !== confirmPassword) {
      const msg = 'Passwords do not match';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
      return;
    }

    setLoading(true);
    try {
      // Call change password API
      await api.post('/business-auth/change-password', {
        newPassword,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Save all the data now that password is set
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      
      if (businessData) {
        await AsyncStorage.setItem('business', JSON.stringify(businessData));
      }
      
      if (businessesData && businessesData.length > 0) {
        await AsyncStorage.setItem('businesses', JSON.stringify(businessesData));
      }
      
      if (userSettings) {
        await AsyncStorage.setItem('userSettings', JSON.stringify(userSettings));
      }

      // Start background preloading
      dataPreloader.preloadAll().catch(console.error);

      // Navigate based on role
      const role = userData.role;
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
    } catch (error: any) {
      console.error('[SetPassword] Error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to set password';
      Platform.OS === 'web' ? window.alert('Error: ' + errorMessage) : Alert.alert('Error', errorMessage);
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
    contentContainer: {
      width: '100%',
      maxWidth: 420,
      alignSelf: 'center',
    },
    logoSection: {
      alignItems: 'center',
      marginBottom: 32,
    },
    logoContainer: {
      width: 72,
      height: 72,
      backgroundColor: isDark ? '#18181b' : '#ffffff',
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
      fontSize: 26,
      fontWeight: '700',
      color: colors.foreground,
      marginBottom: 8,
      letterSpacing: -0.5,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      color: colors.mutedForeground,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: 16,
    },
    welcomeBox: {
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.1)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.3)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    welcomeText: {
      flex: 1,
      fontSize: 14,
      color: isDark ? '#10b981' : '#059669',
      fontWeight: '500',
    },
    card: {
      backgroundColor: isDark ? 'rgba(24, 24, 27, 0.8)' : 'rgba(255, 255, 255, 0.9)',
      borderRadius: 24,
      padding: 28,
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
      height: 56,
    },
    inputContainerValid: {
      borderColor: '#10b981',
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
    eyeButton: {
      padding: 8,
    },
    validationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      marginLeft: 4,
      gap: 6,
    },
    validationText: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
    validationTextValid: {
      color: '#10b981',
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
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: colors.primaryForeground,
      fontSize: 16,
      fontWeight: '600',
    },
    footer: {
      marginTop: 20,
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
            <Shield size={40} color={isDark ? '#ffffff' : '#18181b'} />
          </View>
          <Text style={styles.title}>Set Your Password</Text>
          <Text style={styles.subtitle}>
            Welcome! For security, please create a new password to replace the default one.
          </Text>
        </View>
        
        <View style={styles.card}>
          <View style={styles.welcomeBox}>
            <Check size={20} color="#10b981" />
            <Text style={styles.welcomeText}>
              Hi {userData?.first_name || userData?.username}! You're signed in as {userData?.role}.
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>New Password</Text>
            <View style={[
              styles.inputContainer,
              isValidPassword && styles.inputContainerValid
            ]}>
              <Lock size={20} color={isValidPassword ? '#10b981' : colors.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter new password"
                placeholderTextColor={colors.mutedForeground}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? (
                  <EyeOff size={20} color={colors.mutedForeground} />
                ) : (
                  <Eye size={20} color={colors.mutedForeground} />
                )}
              </TouchableOpacity>
            </View>
            <View style={styles.validationRow}>
              <Check size={14} color={isValidPassword ? '#10b981' : colors.mutedForeground} />
              <Text style={[styles.validationText, isValidPassword && styles.validationTextValid]}>
                At least 6 characters
              </Text>
            </View>
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={[
              styles.inputContainer,
              passwordsMatch && styles.inputContainerValid
            ]}>
              <Lock size={20} color={passwordsMatch ? '#10b981' : colors.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirm new password"
                placeholderTextColor={colors.mutedForeground}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                {showConfirmPassword ? (
                  <EyeOff size={20} color={colors.mutedForeground} />
                ) : (
                  <Eye size={20} color={colors.mutedForeground} />
                )}
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 && (
              <View style={styles.validationRow}>
                <Check size={14} color={passwordsMatch ? '#10b981' : '#ef4444'} />
                <Text style={[styles.validationText, { color: passwordsMatch ? '#10b981' : '#ef4444' }]}>
                  {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                </Text>
              </View>
            )}
          </View>
          
          <TouchableOpacity 
            style={[
              styles.button, 
              (!isValidPassword || !passwordsMatch || loading) && styles.buttonDisabled
            ]}
            onPress={handleSetPassword}
            disabled={!isValidPassword || !passwordsMatch || loading}
          >
            {loading ? (
              <>
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <Command size={20} color={colors.primaryForeground} />
                </Animated.View>
                <Text style={styles.buttonText}>Setting password...</Text>
              </>
            ) : (
              <>
                <Shield size={20} color={colors.primaryForeground} />
                <Text style={styles.buttonText}>Set Password & Continue</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Your password is encrypted and secure</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}





