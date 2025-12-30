/**
 * POS Lock Screen Component
 * 
 * Displays a PIN pad overlay when the POS screen becomes idle.
 * Any employee with POS access can unlock by entering their PIN.
 * 
 * Flow:
 * 1. Device is logged in (has business token)
 * 2. Screen locks after 5 minutes of inactivity
 * 3. This overlay appears with a PIN pad
 * 4. Employee enters their 4-6 digit PIN
 * 5. On success, the employee is set as the current operator
 * 6. Orders are tagged to this employee
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Dimensions,
  Vibration,
  Platform,
} from 'react-native';
import { Lock, Delete, User } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useLocalization } from '../localization/LocalizationContext';
import { API_URL } from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

interface POSLockScreenProps {
  visible: boolean;
  onUnlock: (employee: {
    id: number;
    username: string;
    first_name?: string;
    last_name?: string;
    display_name: string;
    role: string;
  }) => void;
  currentEmployeeName?: string;
}

export function POSLockScreen({ visible, onUnlock, currentEmployeeName }: POSLockScreenProps) {
  const { colors } = useTheme();
  const { t, isRTL } = useLocalization();
  
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const handleKeyPress = useCallback((key: string) => {
    setError(null);
    if (key === 'delete') {
      setPin(prev => prev.slice(0, -1));
    } else if (key === 'clear') {
      setPin('');
    } else if (pin.length < 6) {
      setPin(prev => prev + key);
    }
  }, [pin.length]);

  const triggerShake = useCallback(() => {
    setShake(true);
    if (Platform.OS !== 'web') {
      Vibration.vibrate(100);
    }
    setTimeout(() => setShake(false), 500);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (pin.length < 4) {
      setError(t('PIN must be at least 4 digits', 'رمز PIN يجب أن يكون 4 أرقام على الأقل'));
      triggerShake();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = await AsyncStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/pos-sessions/pin-authenticate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ pin }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid PIN');
      }

      // Success - call onUnlock with employee data
      setPin('');
      onUnlock(data.data.employee);
    } catch (err: any) {
      setError(err.message || t('Invalid PIN', 'رمز PIN غير صحيح'));
      triggerShake();
      setPin('');
    } finally {
      setIsLoading(false);
    }
  }, [pin, onUnlock, t, triggerShake]);

  // Auto-submit when PIN reaches 4-6 digits
  React.useEffect(() => {
    if (pin.length >= 4 && pin.length <= 6) {
      // Small delay to show the filled dots
      const timeout = setTimeout(() => {
        if (pin.length >= 4) {
          handleSubmit();
        }
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [pin]);

  const renderPinDots = () => {
    const dots = [];
    for (let i = 0; i < 6; i++) {
      dots.push(
        <View
          key={i}
          style={[
            styles.pinDot,
            {
              backgroundColor: i < pin.length ? colors.primary : 'transparent',
              borderColor: i < pin.length ? colors.primary : colors.border,
            },
          ]}
        />
      );
    }
    return dots;
  };

  const renderKeypad = () => {
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['clear', '0', 'delete'],
    ];

    return keys.map((row, rowIndex) => (
      <View key={rowIndex} style={styles.keypadRow}>
        {row.map((key) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.keypadButton,
              {
                backgroundColor: key === 'clear' || key === 'delete' 
                  ? colors.muted 
                  : colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={() => handleKeyPress(key)}
            disabled={isLoading}
          >
            {key === 'delete' ? (
              <Delete size={24} color={colors.foreground} />
            ) : key === 'clear' ? (
              <Text style={[styles.keypadText, { color: colors.mutedForeground }]}>
                {t('C', 'مسح')}
              </Text>
            ) : (
              <Text style={[styles.keypadText, { color: colors.foreground }]}>
                {key}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    ));
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0, 0, 0, 0.85)' }]}>
        <View 
          style={[
            styles.container, 
            { backgroundColor: colors.background },
            shake && styles.shake,
          ]}
        >
          {/* Lock Icon */}
          <View style={[styles.lockIconContainer, { backgroundColor: colors.primary + '20' }]}>
            <Lock size={40} color={colors.primary} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.foreground }]}>
            {t('Screen Locked', 'الشاشة مقفلة')}
          </Text>

          {/* Subtitle with previous employee name */}
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {currentEmployeeName 
              ? t(`Last: ${currentEmployeeName}`, `السابق: ${currentEmployeeName}`)
              : t('Enter your PIN to unlock', 'أدخل رمز PIN للفتح')}
          </Text>

          {/* Error message */}
          {error && (
            <View style={[styles.errorContainer, { backgroundColor: colors.destructive + '20' }]}>
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {error}
              </Text>
            </View>
          )}

          {/* PIN Dots */}
          <View style={[styles.pinDotsContainer, isRTL && { flexDirection: 'row-reverse' }]}>
            {renderPinDots()}
          </View>

          {/* Loading indicator */}
          {isLoading && (
            <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
          )}

          {/* Keypad */}
          <View style={styles.keypad}>
            {renderKeypad()}
          </View>

          {/* Hint */}
          <View style={[styles.hintContainer, { backgroundColor: colors.muted }]}>
            <User size={16} color={colors.mutedForeground} />
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
              {t('Any employee with POS access can unlock', 'أي موظف لديه صلاحية نقطة البيع يمكنه الفتح')}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: Math.min(400, width - 40),
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
  },
  shake: {
    // Animation handled by React Native Animated API if needed
  },
  lockIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  errorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
  },
  pinDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  loader: {
    marginBottom: 16,
  },
  keypad: {
    width: '100%',
    gap: 12,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  keypadButton: {
    width: 72,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  keypadText: {
    fontSize: 24,
    fontWeight: '600',
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 24,
  },
  hintText: {
    fontSize: 12,
    flex: 1,
  },
});

export default POSLockScreen;


