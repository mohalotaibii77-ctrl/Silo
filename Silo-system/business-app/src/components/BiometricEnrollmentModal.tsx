/**
 * Biometric Enrollment Modal Component
 *
 * Shows after first successful login to prompt user to enable biometric authentication.
 * Displays appropriate icon and messaging based on device's biometric type.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { ScanFace, Fingerprint, Shield } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useLocalization } from '../localization/LocalizationContext';
import { biometricAuth, BiometricType } from '../services/BiometricAuthService';
import { BaseModal } from './BaseModal';

interface BiometricEnrollmentModalProps {
  visible: boolean;
  onEnable: () => Promise<void>;
  onSkip: () => void;
  onDontAskAgain: () => void;
  biometricType?: BiometricType;
}

export function BiometricEnrollmentModal({
  visible,
  onEnable,
  onSkip,
  onDontAskAgain,
  biometricType: propBiometricType,
}: BiometricEnrollmentModalProps) {
  const { colors } = useTheme();
  const { t, language, isRTL } = useLocalization();

  const [isEnabling, setIsEnabling] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>(propBiometricType || 'fingerprint');

  useEffect(() => {
    if (!propBiometricType && visible) {
      loadBiometricType();
    }
  }, [propBiometricType, visible]);

  const loadBiometricType = async () => {
    const capability = await biometricAuth.isDeviceSupported();
    setBiometricType(capability.biometricType);
  };

  const handleEnable = async () => {
    setIsEnabling(true);
    try {
      await onEnable();
    } finally {
      setIsEnabling(false);
    }
  };

  const getBiometricName = () => {
    return biometricAuth.getBiometricTypeName(biometricType, language as 'en' | 'ar');
  };

  const renderIcon = () => {
    const iconSize = 48;
    const iconColor = colors.primary;

    if (biometricType === 'face') {
      return <ScanFace size={iconSize} color={iconColor} />;
    }
    return <Fingerprint size={iconSize} color={iconColor} />;
  };

  const getTitle = () => {
    const name = getBiometricName();
    return t(`Enable ${name}?`, `تفعيل ${name}؟`);
  };

  const getDescription = () => {
    const name = getBiometricName();
    return t(
      `Sign in faster and more securely using ${name}. Your credentials will be stored securely on this device.`,
      `سجل الدخول بشكل أسرع وأكثر أمانًا باستخدام ${name}. سيتم تخزين بيانات الاعتماد الخاصة بك بشكل آمن على هذا الجهاز.`
    );
  };

  return (
    <BaseModal
      visible={visible}
      onClose={onSkip}
      title={getTitle()}
      subtitle={getDescription()}
      height="75%"
      scrollable={false}
    >
      <View style={styles.container}>
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
          {renderIcon()}
        </View>

        {/* Security badge */}
        <View style={[styles.securityBadge, { backgroundColor: colors.muted }]}>
          <Shield size={16} color={colors.primary} />
          <Text style={[styles.securityText, { color: colors.mutedForeground }]}>
            {t('Secured with device encryption', 'مؤمن بتشفير الجهاز')}
          </Text>
        </View>

        {/* Enable button */}
        <TouchableOpacity
          style={[styles.enableButton, { backgroundColor: colors.primary }]}
          onPress={handleEnable}
          disabled={isEnabling}
        >
          {isEnabling ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <>
              {renderIcon()}
              <Text style={[styles.enableButtonText, { color: colors.primaryForeground }]}>
                {t(`Enable ${getBiometricName()}`, `تفعيل ${getBiometricName()}`)}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Skip button */}
        <TouchableOpacity
          style={[styles.skipButton, { borderColor: colors.border }]}
          onPress={onSkip}
          disabled={isEnabling}
        >
          <Text style={[styles.skipButtonText, { color: colors.foreground }]}>
            {t('Not Now', 'ليس الآن')}
          </Text>
        </TouchableOpacity>

        {/* Don't ask again link */}
        <TouchableOpacity
          style={styles.dontAskButton}
          onPress={onDontAskAgain}
          disabled={isEnabling}
        >
          <Text style={[styles.dontAskText, { color: colors.mutedForeground }]}>
            {t("Don't ask again", 'لا تسألني مرة أخرى')}
          </Text>
        </TouchableOpacity>
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 24,
  },
  securityText: {
    fontSize: 12,
    fontWeight: '500',
  },
  enableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  enableButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  dontAskButton: {
    padding: 8,
  },
  dontAskText: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});

export default BiometricEnrollmentModal;
