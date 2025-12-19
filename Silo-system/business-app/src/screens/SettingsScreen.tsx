import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  I18nManager,
  Animated
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import api from '../api/client';
import { CACHE_KEYS } from '../services/DataPreloader';
import { useLocalization } from '../localization/LocalizationContext';
import { 
  ArrowLeft,
  Store,
  Globe,
  Percent,
  ChevronRight,
  Check,
  Building2,
  Phone,
  Mail,
  MapPin,
  Save
} from 'lucide-react-native';

// Skeleton component
const Skeleton = ({ width: w, height, borderRadius = 8, style }: { width: number | string; height: number; borderRadius?: number; style?: any }) => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[{ width: w, height, borderRadius, backgroundColor: colors.border, opacity: pulseAnim }, style]}
    />
  );
};

const SettingsSkeleton = ({ isRTL }: { isRTL: boolean }) => (
  <View style={{ padding: 16 }}>
    {/* Section Title */}
    <Skeleton width={150} height={18} style={{ marginBottom: 16 }} />
    
    {/* Input Fields */}
    {[1, 2, 3, 4].map((_, i) => (
      <View key={i} style={{ marginBottom: 20 }}>
        <Skeleton width={100} height={14} style={{ marginBottom: 8 }} />
        <Skeleton width="100%" height={48} borderRadius={12} />
      </View>
    ))}
    
    {/* Second Section */}
    <Skeleton width={180} height={18} style={{ marginTop: 24, marginBottom: 16 }} />
    
    {[1, 2].map((_, i) => (
      <View key={i} style={{ marginBottom: 20 }}>
        <Skeleton width={80} height={14} style={{ marginBottom: 8 }} />
        <Skeleton width="100%" height={48} borderRadius={12} />
      </View>
    ))}
  </View>
);

interface Business {
  id: number;
  name: string;
  slug: string;
  description?: string;
  phone?: string;
  email?: string;
  address?: string;
  logo_url?: string;
  currency: string;
  language: string;
  timezone: string;
  vat_enabled: boolean;
  tax_rate: number;
}

type SettingsTab = 'profile' | 'localization' | 'tax';

const CURRENCIES = [
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KD' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'SR' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED' },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'QR' },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: 'BD' },
  { code: 'OMR', name: 'Omani Rial', symbol: 'OMR' },
];

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ar', name: 'العربية (Arabic)' },
];

const TIMEZONES = [
  { code: 'Asia/Kuwait', name: 'Kuwait (GMT+3)' },
  { code: 'Asia/Riyadh', name: 'Saudi Arabia (GMT+3)' },
  { code: 'Asia/Dubai', name: 'UAE (GMT+4)' },
  { code: 'Asia/Qatar', name: 'Qatar (GMT+3)' },
  { code: 'Asia/Bahrain', name: 'Bahrain (GMT+3)' },
  { code: 'Europe/London', name: 'London (GMT+0)' },
  { code: 'America/New_York', name: 'New York (GMT-5)' },
];

export default function SettingsScreen({ navigation }: any) {
  const { t, isRTL, setLanguage: setGlobalLanguage } = useLocalization();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [currency, setCurrency] = useState(''); // Loaded from business settings
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('Asia/Kuwait');
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatRate, setVatRate] = useState('0');

  // Dropdown states
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showTimezonePicker, setShowTimezonePicker] = useState(false);

  useEffect(() => {
    loadBusinessData();
    
    // Refresh data when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      loadBusinessData();
    });
    
    return unsubscribe;
  }, [navigation]);

  const loadBusinessData = async () => {
    try {
      const businessStr = await AsyncStorage.getItem('business');
      if (businessStr) {
        const businessData = JSON.parse(businessStr);
        
        // Try cache first for instant display
        const cachedDetails = await AsyncStorage.getItem(CACHE_KEYS.BUSINESS_DETAILS);
        if (cachedDetails) {
          try {
            const { data } = JSON.parse(cachedDetails);
            if (data) {
              populateBusinessFields(data);
            }
          } catch {}
        }
        
        // Fetch full business details from API
        const response = await api.get(`/businesses/${businessData.id}`);
        if (response.data.business) {
          const b = response.data.business;
          populateBusinessFields(b);
          
          // Update cache
          AsyncStorage.setItem(CACHE_KEYS.BUSINESS_DETAILS, JSON.stringify({
            data: b,
            timestamp: Date.now(),
          })).catch(console.error);
        }
      }
    } catch (error) {
      console.error('Error loading business:', error);
      Alert.alert('Error', 'Failed to load business settings');
    } finally {
      setLoading(false);
    }
  };
  
  const populateBusinessFields = (b: Business) => {
    setBusiness(b);
    setName(b.name || '');
    setDescription(b.description || '');
    setPhone(b.phone || '');
    setEmail(b.email || '');
    setAddress(b.address || '');
    setCurrency(b.currency || '');
    setLanguage(b.language || 'en');
    setTimezone(b.timezone || 'Asia/Kuwait');
    setVatEnabled(b.vat_enabled || false);
    setVatRate(String(b.tax_rate || 0));
  };

  const handleSave = async () => {
    if (!business) return;
    
    setSaving(true);
    try {
      if (activeTab === 'profile') {
        // Profile changes require admin approval - submit as change request
        const changeData: any = {
          request_type: 'profile',
        };
        
        // Only include fields that have changed
        if (name !== business.name) changeData.new_name = name;
        if (email !== (business.email || '')) changeData.new_email = email;
        if (phone !== (business.phone || '')) changeData.new_phone = phone;
        if (address !== (business.address || '')) changeData.new_address = address;
        
        // Check if there are any changes
        const hasChanges = changeData.new_name || changeData.new_email || changeData.new_phone || changeData.new_address;
        
        if (!hasChanges) {
          Alert.alert('No Changes', 'No profile changes detected');
          setSaving(false);
          return;
        }

        try {
          await api.post('/business-settings/change-requests', changeData);
          Alert.alert(
            'Request Submitted', 
            'Your profile changes have been submitted for admin approval. You will be notified once reviewed.',
            [{ text: 'OK' }]
          );
        } catch (error: any) {
          if (error.response?.data?.error?.includes('pending request')) {
            Alert.alert('Pending Request', 'You already have a pending profile change request. Please wait for it to be reviewed.');
          } else {
            throw error;
          }
        }
      } else if (activeTab === 'localization') {
        const currencyChanged = currency !== (business.currency || '');
        const languageChanged = language !== (business.language || 'en');
        const timezoneChanged = timezone !== (business.timezone || 'Asia/Kuwait');
        
        if (!currencyChanged && !languageChanged && !timezoneChanged) {
          Alert.alert(t('noChanges'), t('noChangesDetected'));
          setSaving(false);
          return;
        }

        // Language is a USER preference (saved to user settings, not business-wide)
        if (languageChanged) {
          // setGlobalLanguage saves to user settings via API and updates local storage
          await setGlobalLanguage(language as 'en' | 'ar');
          
          // Handle RTL for Arabic language
          const isArabic = language === 'ar';
          const currentRTL = I18nManager.isRTL;
          
          if (isArabic !== currentRTL) {
            I18nManager.allowRTL(isArabic);
            I18nManager.forceRTL(isArabic);
            
            // Need to reload the app for RTL changes to take effect
            Alert.alert(
              t('languageChanged'),
              t('restartAppMessage'),
              [{ text: t('ok') }]
            );
          }
        }
        
        // Timezone is a business setting (saved directly)
        if (timezoneChanged) {
          await api.put('/business-settings', { timezone });
          
          // Update local storage
          const updatedBusiness = { ...business, timezone };
          await AsyncStorage.setItem('business', JSON.stringify(updatedBusiness));
          setBusiness(updatedBusiness);
        }

        // Currency requires admin approval
        if (currencyChanged) {
          try {
            await api.post('/business-settings/change-requests', {
              request_type: 'localization',
              new_currency: currency,
            });
            Alert.alert(
              t('success'), 
              languageChanged || timezoneChanged 
                ? 'Settings saved. Currency change has been submitted for admin approval.'
                : 'Currency change has been submitted for admin approval.',
              [{ text: t('ok') }]
            );
          } catch (error: any) {
            if (error.response?.data?.error?.includes('pending request')) {
              Alert.alert(
                t('success'), 
                languageChanged || timezoneChanged
                  ? 'Settings saved. You already have a pending currency change request.'
                  : 'You already have a pending currency change request.'
              );
            } else {
              throw error;
            }
          }
        } else if (languageChanged || timezoneChanged) {
          Alert.alert(t('success'), t('localizationSaved'));
        }
      } else if (activeTab === 'tax') {
        // Tax/VAT changes require admin approval
        const vatEnabledChanged = vatEnabled !== (business.vat_enabled || false);
        const vatRateChanged = parseFloat(vatRate) !== (business.tax_rate || 0);
        
        const hasChanges = vatEnabledChanged || vatRateChanged;
        
        if (!hasChanges) {
          Alert.alert('No Changes', 'No tax settings changes detected');
          setSaving(false);
          return;
        }

        // Always include both values so the request shows complete tax settings
        const changeData = {
          request_type: 'tax',
          new_vat_enabled: vatEnabled,
          new_vat_rate: parseFloat(vatRate) || 0,
        };

        try {
          await api.post('/business-settings/change-requests', changeData);
          Alert.alert(
            'Request Submitted', 
            'Your tax settings changes have been submitted for admin approval. You will be notified once reviewed.',
            [{ text: 'OK' }]
          );
        } catch (error: any) {
          if (error.response?.data?.error?.includes('pending request')) {
            Alert.alert('Pending Request', 'You already have a pending tax change request. Please wait for it to be reviewed.');
          } else {
            throw error;
          }
        }
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const TabButton = ({ tab, title, icon: Icon }: { tab: SettingsTab; title: string; icon: any }) => (
    <TouchableOpacity
      style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
      onPress={() => setActiveTab(tab)}
    >
      <Icon size={16} color={activeTab === tab ? colors.background : colors.mutedForeground} />
      <Text style={[styles.tabButtonText, activeTab === tab && styles.tabButtonTextActive]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  const PickerOption = ({ 
    value, 
    label, 
    selected, 
    onSelect 
  }: { 
    value: string; 
    label: string; 
    selected: boolean; 
    onSelect: () => void;
  }) => (
    <TouchableOpacity
      style={[styles.pickerOption, selected && styles.pickerOptionActive]}
      onPress={onSelect}
    >
      <Text style={[styles.pickerOptionText, selected && styles.pickerOptionTextActive]}>
        {label}
      </Text>
      {selected && <Check size={18} color={colors.foreground} />}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color={colors.foreground} style={isRTL ? { transform: [{ rotate: '180deg' }] } : undefined} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isRTL && { textAlign: 'right' }]}>{t('settings')}</Text>
          <View style={{ width: 80 }} />
        </View>
        
        {/* Tab Bar Skeleton */}
        <View style={[styles.tabBar, isRTL && { flexDirection: 'row-reverse' }]}>
          {[1, 2, 3].map((_, i) => (
            <View key={i} style={[styles.tab, i === 0 && styles.tabActive]}>
              <Skeleton width={20} height={20} borderRadius={4} />
              <Skeleton width={60} height={12} style={{ marginTop: 4 }} />
            </View>
          ))}
        </View>
        
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <SettingsSkeleton isRTL={isRTL} />
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={colors.foreground} style={isRTL ? { transform: [{ rotate: '180deg' }] } : undefined} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isRTL && { textAlign: 'right' }]}>{t('settings')}</Text>
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]} 
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <>
              <Save size={18} color={colors.background} />
              <Text style={styles.saveButtonText}>
                {activeTab === 'localization' ? t('save') : t('submit')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View style={[styles.tabBar, isRTL && { flexDirection: 'row-reverse' }]}>
        <TabButton tab="profile" title={t('storeProfile')} icon={Store} />
        <TabButton tab="localization" title={t('localization')} icon={Globe} />
        <TabButton tab="tax" title={t('taxVat')} icon={Percent} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Store Profile Tab */}
        {activeTab === 'profile' && (
          <View style={styles.formSection}>
            <Text style={[styles.formSectionTitle, isRTL && { textAlign: 'right' }]}>{t('businessInformation')}</Text>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>{t('businessName')}</Text>
              <View style={[styles.inputContainer, isRTL && { flexDirection: 'row-reverse' }]}>
                <Building2 size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, isRTL && { textAlign: 'right' }]}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('businessName')}
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>{t('description')}</Text>
              <TextInput
                style={[styles.input, styles.textArea, isRTL && { textAlign: 'right' }]}
                value={description}
                onChangeText={setDescription}
                placeholder={t('briefDescription')}
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
              />
            </View>

            <Text style={[styles.formSectionTitle, { marginTop: 24 }, isRTL && { textAlign: 'right' }]}>{t('contactInformation')}</Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>{t('phone')}</Text>
              <View style={[styles.inputContainer, isRTL && { flexDirection: 'row-reverse' }]}>
                <Phone size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, isRTL && { textAlign: 'right' }]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+965 XXXX XXXX"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>{t('email')}</Text>
              <View style={[styles.inputContainer, isRTL && { flexDirection: 'row-reverse' }]}>
                <Mail size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, isRTL && { textAlign: 'right' }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="contact@business.com"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>{t('address')}</Text>
              <View style={[styles.inputContainer, isRTL && { flexDirection: 'row-reverse' }]}>
                <MapPin size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, isRTL && { textAlign: 'right' }]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder={t('address')}
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            </View>
          </View>
        )}

        {/* Localization Tab */}
        {activeTab === 'localization' && (
          <View style={styles.formSection}>
            {/* Info Notice */}
            <View style={[styles.approvalNotice, { backgroundColor: '#eff6ff', borderLeftColor: '#3b82f6' }]}>
              <Text style={[styles.approvalNoticeText, { color: '#1d4ed8' }, isRTL && { textAlign: 'right' }]}>
                {t('languageTimezoneNote')}
              </Text>
            </View>
            
            <Text style={[styles.formSectionTitle, isRTL && { textAlign: 'right' }]}>{t('regionalSettings')}</Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>{t('currency')}</Text>
              <TouchableOpacity 
                style={styles.selector}
                onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}
              >
                <Text style={styles.selectorText}>
                  {CURRENCIES.find(c => c.code === currency)?.name || currency}
                </Text>
                <ChevronRight size={18} color={colors.mutedForeground} style={{ transform: [{ rotate: showCurrencyPicker ? '90deg' : '0deg' }] }} />
              </TouchableOpacity>
              {showCurrencyPicker && (
                <View style={styles.pickerList}>
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }} showsVerticalScrollIndicator>
                    {CURRENCIES.map((c) => (
                      <PickerOption
                        key={c.code}
                        value={c.code}
                        label={`${c.name} (${c.symbol})`}
                        selected={currency === c.code}
                        onSelect={() => {
                          setCurrency(c.code);
                          setShowCurrencyPicker(false);
                        }}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>{t('language')}</Text>
              <TouchableOpacity 
                style={[styles.selector, isRTL && { flexDirection: 'row-reverse' }]}
                onPress={() => setShowLanguagePicker(!showLanguagePicker)}
              >
                <Text style={[styles.selectorText, isRTL && { textAlign: 'right' }]}>
                  {LANGUAGES.find(l => l.code === language)?.name || language}
                </Text>
                <ChevronRight size={18} color={colors.mutedForeground} style={{ transform: [{ rotate: showLanguagePicker ? '90deg' : (isRTL ? '180deg' : '0deg') }] }} />
              </TouchableOpacity>
              {showLanguagePicker && (
                <View style={styles.pickerList}>
                  {LANGUAGES.map((l) => (
                    <PickerOption
                      key={l.code}
                      value={l.code}
                      label={l.name}
                      selected={language === l.code}
                      onSelect={() => {
                        setLanguage(l.code);
                        setShowLanguagePicker(false);
                      }}
                    />
                  ))}
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>{t('timezone')}</Text>
              <TouchableOpacity 
                style={[styles.selector, isRTL && { flexDirection: 'row-reverse' }]}
                onPress={() => setShowTimezonePicker(!showTimezonePicker)}
              >
                <Text style={[styles.selectorText, isRTL && { textAlign: 'right' }]}>
                  {TIMEZONES.find(tz => tz.code === timezone)?.name || timezone}
                </Text>
                <ChevronRight size={18} color={colors.mutedForeground} style={{ transform: [{ rotate: showTimezonePicker ? '90deg' : (isRTL ? '180deg' : '0deg') }] }} />
              </TouchableOpacity>
              {showTimezonePicker && (
                <View style={styles.pickerList}>
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }} showsVerticalScrollIndicator>
                    {TIMEZONES.map((tz) => (
                      <PickerOption
                        key={tz.code}
                        value={tz.code}
                        label={tz.name}
                        selected={timezone === tz.code}
                        onSelect={() => {
                          setTimezone(tz.code);
                          setShowTimezonePicker(false);
                        }}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Tax / VAT Tab */}
        {activeTab === 'tax' && (
          <View style={styles.formSection}>
            {/* Admin Approval Notice */}
            <View style={styles.approvalNotice}>
              <Text style={[styles.approvalNoticeText, isRTL && { textAlign: 'right' }]}>
                {t('taxChangesRequireApproval')}
              </Text>
            </View>
            
            <Text style={[styles.formSectionTitle, isRTL && { textAlign: 'right' }]}>{t('taxConfiguration')}</Text>

            <View style={[styles.switchRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <View style={[styles.switchInfo, isRTL && { alignItems: 'flex-end' }]}>
                <Text style={[styles.switchLabel, isRTL && { textAlign: 'right' }]}>{t('enableVat')}</Text>
                <Text style={[styles.switchDescription, isRTL && { textAlign: 'right' }]}>
                  {t('applyVatToOrders')}
                </Text>
              </View>
              <Switch
                value={vatEnabled}
                onValueChange={setVatEnabled}
                trackColor={{ false: colors.muted, true: colors.foreground }}
                thumbColor={colors.background}
              />
            </View>

            {vatEnabled && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>{t('vatRate')}</Text>
                <View style={[styles.inputContainer, isRTL && { flexDirection: 'row-reverse' }]}>
                  <Percent size={18} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.input, isRTL && { textAlign: 'right' }]}
                    value={vatRate}
                    onChangeText={setVatRate}
                    placeholder="0"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                </View>
                <Text style={[styles.inputHint, isRTL && { textAlign: 'right' }]}>
                  {t('commonRates')}
                </Text>
              </View>
            )}

            <View style={styles.infoCard}>
              <Text style={[styles.infoCardTitle, isRTL && { textAlign: 'right' }]}>{t('taxInfo')}</Text>
              <Text style={[styles.infoCardText, isRTL && { textAlign: 'right' }]}>
                {t('taxInfoText')}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    paddingBottom: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.foreground,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: colors.muted,
  },
  tabButtonActive: {
    backgroundColor: colors.foreground,
  },
  tabButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  tabButtonTextActive: {
    color: colors.background,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  formSection: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  approvalNotice: {
    backgroundColor: colors.muted,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  approvalNoticeText: {
    fontSize: 13,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.foreground,
  },
  textArea: {
    backgroundColor: colors.muted,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.foreground,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputHint: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 6,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.muted,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  selectorText: {
    fontSize: 15,
    color: colors.foreground,
  },
  pickerList: {
    backgroundColor: colors.muted,
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerOptionActive: {
    backgroundColor: colors.foreground + '10',
  },
  pickerOptionText: {
    fontSize: 15,
    color: colors.foreground,
  },
  pickerOptionTextActive: {
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.muted,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  switchInfo: {
    flex: 1,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  switchDescription: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  infoCard: {
    backgroundColor: colors.muted,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  infoCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 6,
  },
  infoCardText: {
    fontSize: 13,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
});

