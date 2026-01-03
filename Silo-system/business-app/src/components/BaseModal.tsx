import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useLocalization } from '../localization/LocalizationContext';

interface BaseModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
  height?: '50%' | '75%' | '90%' | 'auto';
  scrollable?: boolean;
}

export const BaseModal: React.FC<BaseModalProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  showCloseButton = true,
  height = '75%',
  scrollable = true,
}) => {
  const { colors } = useTheme();
  const { isRTL } = useLocalization();

  const content = (
    <View
      style={[
        styles.content,
        {
          backgroundColor: colors.card,
          height: height === 'auto' ? undefined : height,
          maxHeight: '90%',
        },
      ]}
    >
      {/* Header */}
      {(title || showCloseButton) && (
        <View style={[styles.header, isRTL && styles.rtlRow]}>
          <View style={{ flex: 1 }}>
            {title && (
              <Text
                style={[
                  styles.title,
                  { color: colors.foreground },
                  isRTL && styles.rtlText,
                ]}
              >
                {title}
              </Text>
            )}
            {subtitle && (
              <Text
                style={[
                  styles.subtitle,
                  { color: colors.mutedForeground },
                  isRTL && styles.rtlText,
                ]}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            )}
          </View>
          {showCloseButton && (
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={24} color={colors.foreground} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Content */}
      {scrollable ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {content}
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    // NO dark background overlay - per user requirement
  },
  content: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    // Shadow for depth without overlay
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  rtlText: {
    textAlign: 'right',
  },
});

export default BaseModal;
