import React, { useState, useEffect } from 'react';
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
  I18nManager
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import api from '../api/client';
import { CACHE_KEYS } from '../services/DataPreloader';
import { useLocalization } from '../localization/LocalizationContext';
import { safeGoBack } from '../utils/navigationHelpers';
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
  Save,
  Settings,
  Clock
} from 'lucide-react-native';

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

type SettingsTab = 'profile' | 'localization' | 'tax' | 'operational';

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
  const [currency, setCurrency] = useState('');
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('Asia/Kuwait');
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatRate, setVatRate] = useState('0');

  // Operational settings state
  const [orderNumberPrefix, setOrderNumberPrefix] = useState('ORD');
  const [autoAcceptOrders, setAutoAcceptOrders] = useState(false);
  const [orderPrepTime, setOrderPrepTime] = useState('15');
  const [enableOrderNotifications, setEnableOrderNotifications] = useState(true);
  const [kitchenDisplayAutoClear, setKitchenDisplayAutoClear] = useState('30');
  const [kitchenOperationMode, setKitchenOperationMode] = useState<'display' | 'receipt_scan'>('display');
  const [requireCustomerPhone, setRequireCustomerPhone] = useState(false);
  const [allowOrderNotes, setAllowOrderNotes] = useState(true);
  const [openingTime, setOpeningTime] = useState('09:00');
  const [closingTime, setClosingTime] = useState('22:00');
  const [posOpeningFloatFixed, setPosOpeningFloatFixed] = useState(false);
  const [posOpeningFloatAmount, setPosOpeningFloatAmount] = useState('0');
  const [showKitchenModePicker, setShowKitchenModePicker] = useState(false);

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
    
    // Validate currency exists - no fallback allowed
    if (!b.currency) {
      Alert.alert(
        'Configuration Error',
        'Business currency not set. Please contact your administrator.',
        [{ text: 'OK' }]
      );
    }
    setCurrency(b.currency || '');
    
    setLanguage(b.language || 'en');
    setTimezone(b.timezone || 'Asia/Kuwait');
    setVatEnabled(b.vat_enabled || false);
    setVatRate(String(b.tax_rate || 0));
  };

  const loadOperationalSettings = async () => {
    try {
      const response = await api.get('/business-settings/operational');
      if (response.data.success) {
        const settings = response.data.data;
        setOrderNumberPrefix(settings.order_number_prefix || 'ORD');
        setAutoAcceptOrders(settings.auto_accept_orders || false);
        setOrderPrepTime(String(settings.order_preparation_time || 15));
        setEnableOrderNotifications(settings.enable_order_notifications !== false);
        setKitchenDisplayAutoClear(String(settings.kitchen_display_auto_clear || 30));
        setKitchenOperationMode(settings.kitchen_operation_mode || 'display');
        setRequireCustomerPhone(settings.require_customer_phone || false);
        setAllowOrderNotes(settings.allow_order_notes !== false);
        setOpeningTime(settings.opening_time || '09:00');
        setClosingTime(settings.closing_time || '22:00');
        setPosOpeningFloatFixed(settings.pos_opening_float_fixed || false);
        setPosOpeningFloatAmount(String(settings.pos_opening_float_amount || 0));
      }
    } catch (error) {
      console.error('Failed to load operational settings:', error);
    }
  };

  // Load operational settings when tab changes to operational
  useEffect(() => {
    if (activeTab === 'operational') {
      loadOperationalSettings();
    }
  }, [activeTab]);

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
        const currencyChanged = currency !== business.currency;
        const languageChanged = language !== (business.language || 'en');
        const timezoneChanged = timezone !== (business.timezone || 'Asia/Kuwait');
        
        if (!currencyChanged && !languageChanged && !timezoneChanged) {
          Alert.alert('No Changes', 'No localization changes detected');
          setSaving(false);
          return;
        }

        // Language and timezone can be updated directly (user preferences)
        if (languageChanged || timezoneChanged) {
          const userSettings: any = {};
          if (languageChanged) userSettings.language = language;
          if (timezoneChanged) userSettings.timezone = timezone;
          
          await api.put('/business-settings', userSettings);
          
          // Update local storage
          const updatedBusiness = { ...business, ...userSettings };
          await AsyncStorage.setItem('business', JSON.stringify(updatedBusiness));
          setBusiness(updatedBusiness);
          
          // Update global language state for immediate UI update
          if (languageChanged) {
            await setGlobalLanguage(language as 'en' | 'ar');
          }
          
          // Handle RTL for Arabic language
          if (languageChanged) {
            const isArabic = language === 'ar';
            const currentRTL = I18nManager.isRTL;
            
            if (isArabic !== currentRTL) {
              I18nManager.allowRTL(isArabic);
              I18nManager.forceRTL(isArabic);
              
              // Need to reload the app for RTL changes to take effect
              Alert.alert(
                isArabic ? 'تم تغيير اللغة' : 'Language Changed',
                isArabic ? 'يرجى إغلاق التطبيق وإعادة فتحه لتطبيق التغييرات' : 'Please close and reopen the app to apply the layout changes.',
                [{ text: isArabic ? 'حسناً' : 'OK' }]
              );
            }
          }
        }

        // Only currency requires admin approval
        if (currencyChanged) {
          try {
            await api.post('/business-settings/change-requests', {
              request_type: 'localization',
              new_currency: currency,
            });
            Alert.alert(
              'Settings Updated', 
              'Language and timezone saved. Currency change has been submitted for admin approval.',
              [{ text: 'OK' }]
            );
          } catch (error: any) {
            if (error.response?.data?.error?.includes('pending request')) {
              Alert.alert('Partial Success', 'Language and timezone saved. You already have a pending currency change request.');
            } else {
              throw error;
            }
          }
        } else {
          Alert.alert('Success', 'Localization settings saved successfully');
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
      } else if (activeTab === 'operational') {
        // Operational settings can be updated directly
        const settingsData = {
          order_number_prefix: orderNumberPrefix,
          auto_accept_orders: autoAcceptOrders,
          order_preparation_time: parseInt(orderPrepTime) || 15,
          enable_order_notifications: enableOrderNotifications,
          kitchen_display_auto_clear: parseInt(kitchenDisplayAutoClear) || 30,
          kitchen_operation_mode: kitchenOperationMode,
          require_customer_phone: requireCustomerPhone,
          allow_order_notes: allowOrderNotes,
          opening_time: openingTime,
          closing_time: closingTime,
          pos_opening_float_fixed: posOpeningFloatFixed,
          pos_opening_float_amount: parseFloat(posOpeningFloatAmount) || 0,
        };
        
        await api.put('/business-settings/operational', settingsData);
        Alert.alert('Success', 'Operational settings saved successfully');
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
      <Icon size={18} color={activeTab === tab ? colors.background : colors.mutedForeground} />
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.foreground} />
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
        <TouchableOpacity style={styles.backButton} onPress={() => safeGoBack(navigation)}>
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={[styles.tabBarContent, isRTL && { flexDirection: 'row-reverse' }]}
      >
        <TabButton tab="profile" title={t('storeProfile')} icon={Store} />
        <TabButton tab="localization" title={t('localization')} icon={Globe} />
        <TabButton tab="tax" title={t('taxVat')} icon={Percent} />
        <TabButton tab="operational" title={language === 'ar' ? 'العمليات' : 'Operations'} icon={Settings} />
      </ScrollView>

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

        {/* Operational Settings Tab */}
        {activeTab === 'operational' && (
          <View style={styles.formSection}>
            <Text style={[styles.formSectionTitle, isRTL && { textAlign: 'right' }]}>
              {language === 'ar' ? 'إعدادات الطلبات' : 'Order Settings'}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>
                {language === 'ar' ? 'بادئة رقم الطلب' : 'Order Number Prefix'}
              </Text>
              <View style={[styles.inputContainer, isRTL && { flexDirection: 'row-reverse' }]}>
                <TextInput
                  style={[styles.input, isRTL && { textAlign: 'right' }]}
                  value={orderNumberPrefix}
                  onChangeText={setOrderNumberPrefix}
                  placeholder="ORD"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            </View>

            <View style={[styles.switchRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <View style={[styles.switchInfo, isRTL && { alignItems: 'flex-end' }]}>
                <Text style={[styles.switchLabel, isRTL && { textAlign: 'right' }]}>
                  {language === 'ar' ? 'قبول الطلبات تلقائيًا' : 'Auto Accept Orders'}
                </Text>
                <Text style={[styles.switchDescription, isRTL && { textAlign: 'right' }]}>
                  {language === 'ar' ? 'قبول الطلبات الواردة تلقائيًا' : 'Automatically accept incoming orders'}
                </Text>
              </View>
              <Switch
                value={autoAcceptOrders}
                onValueChange={setAutoAcceptOrders}
                trackColor={{ false: colors.muted, true: colors.foreground }}
                thumbColor={colors.background}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>
                {language === 'ar' ? 'وقت تحضير الطلب (دقائق)' : 'Order Preparation Time (minutes)'}
              </Text>
              <View style={[styles.inputContainer, isRTL && { flexDirection: 'row-reverse' }]}>
                <Clock size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, isRTL && { textAlign: 'right' }]}
                  value={orderPrepTime}
                  onChangeText={setOrderPrepTime}
                  placeholder="15"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={[styles.switchRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <View style={[styles.switchInfo, isRTL && { alignItems: 'flex-end' }]}>
                <Text style={[styles.switchLabel, isRTL && { textAlign: 'right' }]}>
                  {language === 'ar' ? 'إشعارات الطلبات' : 'Order Notifications'}
                </Text>
                <Text style={[styles.switchDescription, isRTL && { textAlign: 'right' }]}>
                  {language === 'ar' ? 'تلقي إشعارات الطلبات الجديدة' : 'Receive new order notifications'}
                </Text>
              </View>
              <Switch
                value={enableOrderNotifications}
                onValueChange={setEnableOrderNotifications}
                trackColor={{ false: colors.muted, true: colors.foreground }}
                thumbColor={colors.background}
              />
            </View>

            <Text style={[styles.formSectionTitle, { marginTop: 24 }, isRTL && { textAlign: 'right' }]}>
              {language === 'ar' ? 'إعدادات المطبخ' : 'Kitchen Settings'}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>
                {language === 'ar' ? 'وضع تشغيل المطبخ' : 'Kitchen Operation Mode'}
              </Text>
              <TouchableOpacity 
                style={[styles.selector, isRTL && { flexDirection: 'row-reverse' }]}
                onPress={() => setShowKitchenModePicker(!showKitchenModePicker)}
              >
                <Text style={[styles.selectorText, isRTL && { textAlign: 'right' }]}>
                  {kitchenOperationMode === 'display' 
                    ? (language === 'ar' ? 'شاشة العرض' : 'Display Screen')
                    : (language === 'ar' ? 'مسح الإيصال' : 'Receipt Scan')}
                </Text>
                <ChevronRight size={18} color={colors.mutedForeground} style={{ transform: [{ rotate: showKitchenModePicker ? '90deg' : (isRTL ? '180deg' : '0deg') }] }} />
              </TouchableOpacity>
              {showKitchenModePicker && (
                <View style={styles.pickerList}>
                  <TouchableOpacity
                    style={[styles.pickerOption, kitchenOperationMode === 'display' && styles.pickerOptionActive]}
                    onPress={() => {
                      setKitchenOperationMode('display');
                      setShowKitchenModePicker(false);
                    }}
                  >
                    <Text style={[styles.pickerOptionText, kitchenOperationMode === 'display' && styles.pickerOptionTextActive]}>
                      {language === 'ar' ? 'شاشة العرض' : 'Display Screen'}
                    </Text>
                    {kitchenOperationMode === 'display' && <Check size={18} color={colors.foreground} />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pickerOption, kitchenOperationMode === 'receipt_scan' && styles.pickerOptionActive]}
                    onPress={() => {
                      setKitchenOperationMode('receipt_scan');
                      setShowKitchenModePicker(false);
                    }}
                  >
                    <Text style={[styles.pickerOptionText, kitchenOperationMode === 'receipt_scan' && styles.pickerOptionTextActive]}>
                      {language === 'ar' ? 'مسح الإيصال' : 'Receipt Scan'}
                    </Text>
                    {kitchenOperationMode === 'receipt_scan' && <Check size={18} color={colors.foreground} />}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>
                {language === 'ar' ? 'مسح تلقائي لشاشة المطبخ (دقائق)' : 'Kitchen Display Auto Clear (minutes)'}
              </Text>
              <View style={[styles.inputContainer, isRTL && { flexDirection: 'row-reverse' }]}>
                <Clock size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, isRTL && { textAlign: 'right' }]}
                  value={kitchenDisplayAutoClear}
                  onChangeText={setKitchenDisplayAutoClear}
                  placeholder="30"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <Text style={[styles.formSectionTitle, { marginTop: 24 }, isRTL && { textAlign: 'right' }]}>
              {language === 'ar' ? 'إعدادات العملاء' : 'Customer Settings'}
            </Text>

            <View style={[styles.switchRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <View style={[styles.switchInfo, isRTL && { alignItems: 'flex-end' }]}>
                <Text style={[styles.switchLabel, isRTL && { textAlign: 'right' }]}>
                  {language === 'ar' ? 'طلب رقم هاتف العميل' : 'Require Customer Phone'}
                </Text>
                <Text style={[styles.switchDescription, isRTL && { textAlign: 'right' }]}>
                  {language === 'ar' ? 'إلزامي إدخال رقم هاتف العميل' : 'Make customer phone number mandatory'}
                </Text>
              </View>
              <Switch
                value={requireCustomerPhone}
                onValueChange={setRequireCustomerPhone}
                trackColor={{ false: colors.muted, true: colors.foreground }}
                thumbColor={colors.background}
              />
            </View>

            <View style={[styles.switchRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <View style={[styles.switchInfo, isRTL && { alignItems: 'flex-end' }]}>
                <Text style={[styles.switchLabel, isRTL && { textAlign: 'right' }]}>
                  {language === 'ar' ? 'السماح بملاحظات الطلب' : 'Allow Order Notes'}
                </Text>
                <Text style={[styles.switchDescription, isRTL && { textAlign: 'right' }]}>
                  {language === 'ar' ? 'السماح للعملاء بإضافة ملاحظات' : 'Allow customers to add notes to orders'}
                </Text>
              </View>
              <Switch
                value={allowOrderNotes}
                onValueChange={setAllowOrderNotes}
                trackColor={{ false: colors.muted, true: colors.foreground }}
                thumbColor={colors.background}
              />
            </View>

            <Text style={[styles.formSectionTitle, { marginTop: 24 }, isRTL && { textAlign: 'right' }]}>
              {language === 'ar' ? 'ساعات العمل' : 'Operating Hours'}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>
                {language === 'ar' ? 'وقت الافتتاح' : 'Opening Time'}
              </Text>
              <View style={[styles.inputContainer, isRTL && { flexDirection: 'row-reverse' }]}>
                <Clock size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, isRTL && { textAlign: 'right' }]}
                  value={openingTime}
                  onChangeText={setOpeningTime}
                  placeholder="09:00"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>
                {language === 'ar' ? 'وقت الإغلاق' : 'Closing Time'}
              </Text>
              <View style={[styles.inputContainer, isRTL && { flexDirection: 'row-reverse' }]}>
                <Clock size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, isRTL && { textAlign: 'right' }]}
                  value={closingTime}
                  onChangeText={setClosingTime}
                  placeholder="22:00"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            </View>

            <Text style={[styles.formSectionTitle, { marginTop: 24 }, isRTL && { textAlign: 'right' }]}>
              {language === 'ar' ? 'إعدادات نقاط البيع' : 'POS Settings'}
            </Text>

            <View style={[styles.switchRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <View style={[styles.switchInfo, isRTL && { alignItems: 'flex-end' }]}>
                <Text style={[styles.switchLabel, isRTL && { textAlign: 'right' }]}>
                  {language === 'ar' ? 'رصيد افتتاحي ثابت' : 'Fixed Opening Float'}
                </Text>
                <Text style={[styles.switchDescription, isRTL && { textAlign: 'right' }]}>
                  {language === 'ar' ? 'استخدام رصيد افتتاحي ثابت لكل جلسة' : 'Use fixed opening float for each session'}
                </Text>
              </View>
              <Switch
                value={posOpeningFloatFixed}
                onValueChange={setPosOpeningFloatFixed}
                trackColor={{ false: colors.muted, true: colors.foreground }}
                thumbColor={colors.background}
              />
            </View>

            {posOpeningFloatFixed && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>
                  {language === 'ar' ? 'مبلغ الرصيد الافتتاحي' : 'Opening Float Amount'}
                </Text>
                <View style={[styles.inputContainer, isRTL && { flexDirection: 'row-reverse' }]}>
                  <TextInput
                    style={[styles.input, isRTL && { textAlign: 'right' }]}
                    value={posOpeningFloatAmount}
                    onChangeText={setPosOpeningFloatAmount}
                    placeholder="0"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            )}
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
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabBarContent: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.secondary,
  },
  tabButtonActive: {
    backgroundColor: colors.foreground,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
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

