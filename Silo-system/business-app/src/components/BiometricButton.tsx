/**
 * Biometric Button Component
 *
 * A reusable button for biometric authentication (Face ID, Touch ID, Fingerprint).
 * Auto-detects the biometric type available on the device and shows the appropriate icon.
 */

import React, { useState, useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { ScanFace, Fingerprint } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useLocalization } from '../localization/LocalizationContext';
import { biometricAuth, BiometricType } from '../services/BiometricAuthService';

interface BiometricButtonProps {
  onPress: () => Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'outline' | 'ghost';
  showLabel?: boolean;
  label?: string;
  biometricType?: BiometricType;
}

export function BiometricButton({
  onPress,
  disabled = false,
  loading = false,
  size = 'medium',
  variant = 'outline',
  showLabel = true,
  label,
  biometricType: propBiometricType,
}: BiometricButtonProps) {
  const { colors } = useTheme();
  const { t, language } = useLocalization();

  const [isLoading, setIsLoading] = useState(loading);
  const [biometricType, setBiometricType] = useState<BiometricType>(propBiometricType || 'fingerprint');

  useEffect(() => {
    if (!propBiometricType) {
      loadBiometricType();
    }
  }, [propBiometricType]);

  const loadBiometricType = async () => {
    const capability = await biometricAuth.isDeviceSupported();
    setBiometricType(capability.biometricType);
  };

  const handlePress = async () => {
    if (disabled || isLoading) return;

    setIsLoading(true);
    try {
      await onPress();
    } finally {
      setIsLoading(false);
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'small': return 20;
      case 'large': return 32;
      default: return 24;
    }
  };

  const getButtonStyles = () => {
    const baseStyle = [
      styles.button,
      size === 'small' && styles.buttonSmall,
      size === 'large' && styles.buttonLarge,
    ];

    switch (variant) {
      case 'primary':
        return [
          ...baseStyle,
          { backgroundColor: colors.primary },
          disabled && { opacity: 0.5 },
        ];
      case 'ghost':
        return [
          ...baseStyle,
          { backgroundColor: 'transparent' },
          disabled && { opacity: 0.5 },
        ];
      default: // outline
        return [
          ...baseStyle,
          {
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: colors.border,
          },
          disabled && { opacity: 0.5 },
        ];
    }
  };

  const getIconColor = () => {
    if (disabled) return colors.mutedForeground;
    return variant === 'primary' ? colors.primaryForeground : colors.primary;
  };

  const getTextColor = () => {
    if (disabled) return colors.mutedForeground;
    return variant === 'primary' ? colors.primaryForeground : colors.foreground;
  };

  const renderIcon = () => {
    const iconSize = getIconSize();
    const iconColor = getIconColor();

    if (isLoading) {
      return <ActivityIndicator size="small" color={iconColor} />;
    }

    if (biometricType === 'face') {
      return <ScanFace size={iconSize} color={iconColor} />;
    }
    return <Fingerprint size={iconSize} color={iconColor} />;
  };

  const getLabel = () => {
    if (label) return label;

    const typeName = biometricAuth.getBiometricTypeName(biometricType, language as 'en' | 'ar');
    return t(`Use ${typeName}`, `استخدم ${typeName}`);
  };

  return (
    <TouchableOpacity
      style={getButtonStyles()}
      onPress={handlePress}
      disabled={disabled || isLoading}
      activeOpacity={0.7}
    >
      {renderIcon()}
      {showLabel && (
        <Text style={[styles.label, { color: getTextColor() }]}>
          {getLabel()}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// Icon-only version for compact spaces
export function BiometricIconButton({
  onPress,
  disabled = false,
  loading = false,
  size = 48,
  biometricType: propBiometricType,
}: {
  onPress: () => Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  size?: number;
  biometricType?: BiometricType;
}) {
  const { colors } = useTheme();

  const [isLoading, setIsLoading] = useState(loading);
  const [biometricType, setBiometricType] = useState<BiometricType>(propBiometricType || 'fingerprint');

  useEffect(() => {
    if (!propBiometricType) {
      loadBiometricType();
    }
  }, [propBiometricType]);

  const loadBiometricType = async () => {
    const capability = await biometricAuth.isDeviceSupported();
    setBiometricType(capability.biometricType);
  };

  const handlePress = async () => {
    if (disabled || isLoading) return;

    setIsLoading(true);
    try {
      await onPress();
    } finally {
      setIsLoading(false);
    }
  };

  const iconSize = size * 0.5;
  const iconColor = disabled ? colors.mutedForeground : colors.primary;

  return (
    <TouchableOpacity
      style={[
        styles.iconButton,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.primary + '15',
          borderColor: colors.primary + '30',
        },
        disabled && { opacity: 0.5 },
      ]}
      onPress={handlePress}
      disabled={disabled || isLoading}
      activeOpacity={0.7}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : biometricType === 'face' ? (
        <ScanFace size={iconSize} color={iconColor} />
      ) : (
        <Fingerprint size={iconSize} color={iconColor} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  buttonSmall: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonLarge: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  iconButton: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
});

export default BiometricButton;
