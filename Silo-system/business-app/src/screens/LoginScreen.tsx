import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Animated, Easing, Dimensions, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import { Command, Mail, Lock, Sun, Moon, ArrowRight } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function LoginScreen({ navigation }: any) {
  const { colors, toggleTheme, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/business-auth/login', { email, password });
      await AsyncStorage.setItem('token', response.data.token);
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
      
      // Save business data including currency settings
      if (response.data.business) {
        await AsyncStorage.setItem('business', JSON.stringify(response.data.business));
      }
      
      // Save all businesses for workspace switching (owners only)
      if (response.data.businesses && response.data.businesses.length > 0) {
        await AsyncStorage.setItem('businesses', JSON.stringify(response.data.businesses));
      }
      
      const role = response.data.user.role;
      
      if (role === 'owner') {
        navigation.replace('OwnerDashboard');
      } else if (role === 'manager') {
        navigation.replace('PMDashboard');
      } else if (role === 'pos') {
        navigation.replace('POSTerminal');
      } else if (role === 'employee') {
        navigation.replace('EmployeePOS');
      } else {
        navigation.replace('EmployeePOS');
      }
    } catch (error: any) {
      Alert.alert('Login Failed', error.response?.data?.error || 'Invalid credentials');
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
      <TouchableOpacity style={styles.themeToggle} onPress={toggleTheme}>
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
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <>
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <Command size={20} color={colors.primaryForeground} />
                </Animated.View>
                <Text style={styles.buttonText}>Signing in...</Text>
              </>
            ) : (
              <>
                <Text style={styles.buttonText}>Sign in</Text>
                <ArrowRight size={20} color={colors.primaryForeground} />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Powered by Silo System</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
