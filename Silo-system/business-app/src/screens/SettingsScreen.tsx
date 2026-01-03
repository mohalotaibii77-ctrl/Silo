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
import { useTheme } from '../theme/ThemeContext';
import api from '../api/client';
import { CACHE_KEYS } from '../services/DataPreloader';
import { useLocalization } from '../localization/LocalizationContext';
import { safeGoBack } from '../utils/navigationHelpers';
import locationService from '../services/LocationService';
import MapPicker from '../components/MapPicker';
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
  Clock,
  Hash,
  Timer,
  Bell,
  DollarSign,
  Monitor,
  ScanLine,
  ChefHat,
  Users,
  Calendar,
  Navigation,
  UserCog,
  X,
  Trash2,
  User,
  Shield,
  ScanFace,
  Fingerprint,
} from 'lucide-react-native';
import { useBiometricAuth } from '../hooks/useBiometricAuth';

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

type SettingsTab = 'profile' | 'localization' | 'tax' | 'operational' | 'security';

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
  const { colors } = useTheme();
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

  // Working days and GPS check-in settings
  const [workingDays, setWorkingDays] = useState<string[]>(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);
  const [requireGpsCheckin, setRequireGpsCheckin] = useState(false);
  const [geofenceRadiusMeters, setGeofenceRadiusMeters] = useState('100');
  const [gpsAccuracyThresholdMeters, setGpsAccuracyThresholdMeters] = useState('50');
  const [checkinBufferMinutesBefore, setCheckinBufferMinutesBefore] = useState('15');
  const [checkinBufferMinutesAfter, setCheckinBufferMinutesAfter] = useState('30');

  // Checkout Restriction Settings
  const [requireCheckoutRestrictions, setRequireCheckoutRestrictions] = useState(true);
  const [minShiftHours, setMinShiftHours] = useState('4');
  const [checkoutBufferMinutesBefore, setCheckoutBufferMinutesBefore] = useState('30');

  // POS Session Access Control
  const [posSessionAllowedUserIds, setPosSessionAllowedUserIds] = useState<number[]>([]);
  const [posUsers, setPosUsers] = useState<Array<{id: number; username: string; name: string; role: string}>>([]);

  // Biometric authentication
  const biometric = useBiometricAuth();
  const [biometricToggleLoading, setBiometricToggleLoading] = useState(false);

  // Dropdown states
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showTimezonePicker, setShowTimezonePicker] = useState(false);

  // Branch and Employee states for GPS check-in configuration
  interface BranchData {
    id: number;
    name: string;
    code: string;
    latitude: number | null;
    longitude: number | null;
    geofence_radius_meters: number;
    geofence_enabled: boolean;
  }
  interface EmployeeData {
    id: number;
    username: string;
    name: string;
    role: string;
  }
  interface ScheduleOverrideData {
    id?: number;
    employee_id: number;
    working_days: string[] | null;
    opening_time: string | null;
    closing_time: string | null;
    is_active: boolean;
  }
  const [branches, setBranches] = useState<BranchData[]>([]);
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [scheduleOverrides, setScheduleOverrides] = useState<ScheduleOverrideData[]>([]);
  const [editingBranchId, setEditingBranchId] = useState<number | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [savingBranch, setSavingBranch] = useState(false);
  const [gettingBranchLocation, setGettingBranchLocation] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);
  const [currentBranchId, setCurrentBranchId] = useState<number | null>(null); // Auto-loaded from context
  const [currentBranchName, setCurrentBranchName] = useState<string | null>(null);

  const styles = createStyles(colors);

  useEffect(() => {
    loadCurrentBranch();

    // Refresh data when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      loadCurrentBranch();
    });

    return unsubscribe;
  }, [navigation]);

  // Load current branch from AsyncStorage (set by dashboard when user selects a branch)
  const loadCurrentBranch = async () => {
    try {
      const branchStr = await AsyncStorage.getItem('branch');
      if (branchStr) {
        const branch = JSON.parse(branchStr);
        setCurrentBranchId(branch.id);
        setCurrentBranchName(branch.name);
        // Load business data with branch context
        loadBusinessData(branch.id);
      } else {
        // No branch context - load business defaults
        loadBusinessData(null);
      }
    } catch (error) {
      console.error('Error loading current branch:', error);
      loadBusinessData(null);
    }
  };

  const loadBusinessData = async (branchId?: number | null) => {
    try {
      const businessStr = await AsyncStorage.getItem('business');
      if (businessStr) {
        const businessData = JSON.parse(businessStr);

        // Try cache first for instant display (only if no branch context)
        if (!branchId) {
          const cachedDetails = await AsyncStorage.getItem(CACHE_KEYS.BUSINESS_DETAILS);
          if (cachedDetails) {
            try {
              const { data } = JSON.parse(cachedDetails);
              if (data) {
                populateBusinessFields(data);
              }
            } catch {}
          }
        }

        // Fetch settings from API - branch-specific if branchId provided
        const settingsUrl = branchId
          ? `/business-settings?branch_id=${branchId}`
          : '/business-settings';

        const response = await api.get(settingsUrl);
        if (response.data.data) {
          const b = response.data.data;
          populateBusinessFields(b);

          // Only update cache if not branch-specific
          if (!branchId) {
            AsyncStorage.setItem(CACHE_KEYS.BUSINESS_DETAILS, JSON.stringify({
              data: b,
              timestamp: Date.now(),
            })).catch(console.error);
          }
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

  const loadOperationalSettings = async (branchId: number | null = null) => {
    try {
      // Build URL with optional branch_id
      const operationalUrl = branchId
        ? `/business-settings/operational?branch_id=${branchId}`
        : '/business-settings/operational';

      // Fetch operational settings, POS users, branches, employees, and overrides in parallel
      const [settingsRes, posUsersRes, branchesRes, employeesRes, overridesRes] = await Promise.all([
        api.get(operationalUrl),
        api.get('/pos-sessions/employees').catch(() => ({ data: { data: [] } })),
        api.get('/business-settings/branches/geofence').catch(() => ({ data: { data: [] } })),
        api.get('/business-users').catch(() => ({ data: { data: [] } })),
        api.get('/hr/schedule-overrides').catch(() => ({ data: { data: [] } })),
      ]);

      if (settingsRes.data.success) {
        const settings = settingsRes.data.data;
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
        // Working days and GPS settings
        setWorkingDays(settings.working_days || ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);
        setRequireGpsCheckin(settings.require_gps_checkin || false);
        setGeofenceRadiusMeters(String(settings.geofence_radius_meters || 100));
        setGpsAccuracyThresholdMeters(String(settings.gps_accuracy_threshold_meters || 50));
        setCheckinBufferMinutesBefore(String(settings.checkin_buffer_minutes_before || 15));
        setCheckinBufferMinutesAfter(String(settings.checkin_buffer_minutes_after || 30));
        // Checkout restriction settings
        setRequireCheckoutRestrictions(settings.require_checkout_restrictions !== false);
        setMinShiftHours(String(settings.min_shift_hours || 4));
        setCheckoutBufferMinutesBefore(String(settings.checkout_buffer_minutes_before || 30));
        // POS session access control
        setPosSessionAllowedUserIds(settings.pos_session_allowed_user_ids || []);
      }

      // Load POS users
      if (posUsersRes.data.data) {
        setPosUsers(posUsersRes.data.data);
      }

      // Load branches
      if (branchesRes.data.data) {
        setBranches(branchesRes.data.data);
      }

      // Load employees (filter out owners)
      if (employeesRes.data.data) {
        setEmployees(employeesRes.data.data.filter((u: EmployeeData) =>
          u.role !== 'owner' && u.role !== 'super_admin'
        ));
      }

      // Load schedule overrides
      if (overridesRes.data.data) {
        setScheduleOverrides(overridesRes.data.data);
      }
    } catch (error) {
      console.error('Failed to load operational settings:', error);
    }
  };

  // Load operational settings when tab changes to operational or branch changes
  useEffect(() => {
    if (activeTab === 'operational') {
      loadOperationalSettings(currentBranchId);
    }
  }, [activeTab, currentBranchId]);

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
        // Localization settings are now branch-specific - save directly
        const localizationData: Record<string, any> = {
          currency,
          language,
          timezone,
        };

        // Include branch_id if in branch context
        if (currentBranchId) {
          localizationData.branch_id = currentBranchId;
        }

        await api.put('/business-settings/localization', localizationData);

        // Update local storage
        const updatedBusiness = { ...business, currency, language, timezone };
        await AsyncStorage.setItem('business', JSON.stringify(updatedBusiness));
        setBusiness(updatedBusiness);

        // Update global language state for immediate UI update
        if (language !== (business.language || 'en')) {
          await setGlobalLanguage(language as 'en' | 'ar');

          // Handle RTL for Arabic language
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
            return; // Don't show another alert
          }
        }

        const branchText = currentBranchName ? ` for ${currentBranchName}` : '';
        Alert.alert('Success', `Localization settings saved successfully${branchText}`);
      } else if (activeTab === 'tax') {
        // Tax settings are now branch-specific - save directly
        const taxData: Record<string, any> = {
          vat_enabled: vatEnabled,
          tax_rate: parseFloat(vatRate) || 0,
        };

        // Include branch_id if in branch context
        if (currentBranchId) {
          taxData.branch_id = currentBranchId;
        }

        await api.put('/business-settings', taxData);

        // Update local storage
        const updatedBusiness = { ...business, vat_enabled: vatEnabled, tax_rate: parseFloat(vatRate) || 0 };
        await AsyncStorage.setItem('business', JSON.stringify(updatedBusiness));
        setBusiness(updatedBusiness);

        const branchText = currentBranchName ? ` for ${currentBranchName}` : '';
        Alert.alert('Success', `Tax settings saved successfully${branchText}`);
      } else if (activeTab === 'operational') {
        // Operational settings can be updated directly (branch-specific)
        const settingsData: Record<string, any> = {
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
          // Working days and GPS settings
          working_days: workingDays,
          require_gps_checkin: requireGpsCheckin,
          geofence_radius_meters: parseInt(geofenceRadiusMeters) || 100,
          gps_accuracy_threshold_meters: parseInt(gpsAccuracyThresholdMeters) || 50,
          checkin_buffer_minutes_before: parseInt(checkinBufferMinutesBefore) || 15,
          checkin_buffer_minutes_after: parseInt(checkinBufferMinutesAfter) || 30,
          // Checkout restriction settings
          require_checkout_restrictions: requireCheckoutRestrictions,
          min_shift_hours: parseFloat(minShiftHours) || 4,
          checkout_buffer_minutes_before: parseInt(checkoutBufferMinutesBefore) || 30,
          // POS session access control
          pos_session_allowed_user_ids: posSessionAllowedUserIds,
        };

        // Include branch_id if we're in a specific branch context
        if (currentBranchId) {
          settingsData.branch_id = currentBranchId;
        }

        await api.put('/business-settings/operational', settingsData);
        const branchText = currentBranchName ? ` for ${currentBranchName}` : '';
        Alert.alert('Success', `Operational settings saved successfully${branchText}`);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Branch geofence handlers
  const updateBranch = (branchId: number, field: keyof BranchData, value: any) => {
    setBranches(prev => prev.map(b =>
      b.id === branchId ? { ...b, [field]: value } : b
    ));
  };

  const saveBranchGeofence = async (branchId: number) => {
    setSavingBranch(true);
    const branch = branches.find(b => b.id === branchId);
    if (!branch) return;

    try {
      await api.put(`/business-settings/branches/${branchId}/geofence`, {
        latitude: branch.latitude,
        longitude: branch.longitude,
        geofence_radius_meters: branch.geofence_radius_meters,
        geofence_enabled: branch.geofence_enabled,
      });
      setEditingBranchId(null);
      Alert.alert('Success', language === 'ar' ? 'تم حفظ موقع الفرع!' : 'Branch location saved!');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to save branch geofence');
    } finally {
      setSavingBranch(false);
    }
  };

  // Schedule override handlers
  const getOverrideForEmployee = (employeeId: number): ScheduleOverrideData | undefined => {
    return scheduleOverrides.find(o => o.employee_id === employeeId);
  };

  const updateOverride = (employeeId: number, field: keyof ScheduleOverrideData, value: any) => {
    setScheduleOverrides(prev => {
      const existing = prev.find(o => o.employee_id === employeeId);
      if (existing) {
        return prev.map(o => o.employee_id === employeeId ? { ...o, [field]: value } : o);
      } else {
        return [...prev, {
          employee_id: employeeId,
          working_days: null,
          opening_time: null,
          closing_time: null,
          is_active: true,
          [field]: value,
        }];
      }
    });
  };

  const saveScheduleOverride = async (employeeId: number) => {
    setSavingOverride(true);
    const override = getOverrideForEmployee(employeeId);

    try {
      await api.put(`/hr/schedule-overrides/${employeeId}`, override || {
        working_days: null,
        opening_time: null,
        closing_time: null,
        is_active: true,
      });
      setEditingEmployeeId(null);
      Alert.alert('Success', language === 'ar' ? 'تم حفظ جدول الموظف!' : 'Employee schedule saved!');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to save schedule');
    } finally {
      setSavingOverride(false);
    }
  };

  const deleteScheduleOverride = async (employeeId: number) => {
    try {
      await api.delete(`/hr/schedule-overrides/${employeeId}`);
      setScheduleOverrides(prev => prev.filter(o => o.employee_id !== employeeId));
      setEditingEmployeeId(null);
      Alert.alert('Success', language === 'ar' ? 'تم إزالة التخصيص' : 'Override removed, using business defaults');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to remove override');
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
        <TabButton tab="security" title={language === 'ar' ? 'الأمان' : 'Security'} icon={Shield} />
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
          <View style={{ gap: 16 }}>
            {/* Order Settings Section */}
            <View style={styles.formSection}>
              <View style={[styles.sectionHeader, isRTL && { flexDirection: 'row-reverse' }]}>
                <View style={styles.sectionIconContainer}>
                  <Hash size={20} color={colors.mutedForeground} />
                </View>
                <View style={[styles.sectionHeaderText, isRTL && { alignItems: 'flex-end' }]}>
                  <Text style={[styles.sectionTitle, isRTL && { textAlign: 'right' }]}>
                    {language === 'ar' ? 'إعدادات الطلبات' : 'Order Settings'}
                  </Text>
                  <Text style={[styles.sectionSubtitle, isRTL && { textAlign: 'right' }]}>
                    {language === 'ar' ? 'إعداد ترقيم الطلبات والتعامل معها' : 'Configure order numbering and handling'}
                  </Text>
                </View>
              </View>

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

              <View style={[styles.switchRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <View style={[styles.switchInfo, isRTL && { alignItems: 'flex-end' }]}>
                  <Text style={[styles.switchLabel, isRTL && { textAlign: 'right' }]}>
                    {language === 'ar' ? 'طلب رقم هاتف العميل' : 'Require Customer Phone'}
                  </Text>
                  <Text style={[styles.switchDescription, isRTL && { textAlign: 'right' }]}>
                    {language === 'ar' ? 'إلزامي إدخال رقم هاتف العميل' : 'Phone number is required for orders'}
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
                    {language === 'ar' ? 'السماح للعملاء بإضافة ملاحظات' : 'Customers can add notes to orders'}
                  </Text>
                </View>
                <Switch
                  value={allowOrderNotes}
                  onValueChange={setAllowOrderNotes}
                  trackColor={{ false: colors.muted, true: colors.foreground }}
                  thumbColor={colors.background}
                />
              </View>
            </View>

            {/* Timing Settings Section */}
            <View style={styles.formSection}>
              <View style={[styles.sectionHeader, isRTL && { flexDirection: 'row-reverse' }]}>
                <View style={styles.sectionIconContainer}>
                  <Timer size={20} color={colors.mutedForeground} />
                </View>
                <View style={[styles.sectionHeaderText, isRTL && { alignItems: 'flex-end' }]}>
                  <Text style={[styles.sectionTitle, isRTL && { textAlign: 'right' }]}>
                    {language === 'ar' ? 'إعدادات التوقيت' : 'Timing Settings'}
                  </Text>
                  <Text style={[styles.sectionSubtitle, isRTL && { textAlign: 'right' }]}>
                    {language === 'ar' ? 'إعداد أوقات التحضير والمسح التلقائي' : 'Configure preparation times and auto-clear'}
                  </Text>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>
                  {language === 'ar' ? 'وقت تحضير الطلب (دقائق)' : 'Default Preparation Time (minutes)'}
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

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>
                  {language === 'ar' ? 'مسح تلقائي لشاشة المطبخ (دقائق)' : 'Kitchen Display Auto-clear (minutes)'}
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
                <Text style={[styles.inputHint, isRTL && { textAlign: 'right' }]}>
                  {language === 'ar' ? 'سيتم مسح الطلبات المكتملة من شاشة المطبخ بعد هذا الوقت' : 'Completed orders will be cleared from kitchen display after this time'}
                </Text>
              </View>
            </View>

            {/* Kitchen Operations Section */}
            <View style={styles.formSection}>
              <View style={[styles.sectionHeader, isRTL && { flexDirection: 'row-reverse' }]}>
                <View style={styles.sectionIconContainer}>
                  <ChefHat size={20} color={colors.mutedForeground} />
                </View>
                <View style={[styles.sectionHeaderText, isRTL && { alignItems: 'flex-end' }]}>
                  <Text style={[styles.sectionTitle, isRTL && { textAlign: 'right' }]}>
                    {language === 'ar' ? 'عمليات المطبخ' : 'Kitchen Operations'}
                  </Text>
                  <Text style={[styles.sectionSubtitle, isRTL && { textAlign: 'right' }]}>
                    {language === 'ar' ? 'اختر كيف يتم تحديد الطلبات كمكتملة' : 'Choose how orders are marked as completed'}
                  </Text>
                </View>
              </View>

              {/* Kitchen Display Option */}
              <TouchableOpacity
                style={[
                  styles.modeOptionCard,
                  kitchenOperationMode === 'display' && styles.modeOptionCardActive
                ]}
                onPress={() => setKitchenOperationMode('display')}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.modeOptionIcon,
                  kitchenOperationMode === 'display' && styles.modeOptionIconActive
                ]}>
                  <Monitor size={24} color={kitchenOperationMode === 'display' ? colors.background : colors.mutedForeground} />
                </View>
                <View style={[styles.modeOptionContent, isRTL && { alignItems: 'flex-end' }]}>
                  <View style={[styles.modeOptionTitleRow, isRTL && { flexDirection: 'row-reverse' }]}>
                    <Text style={[styles.modeOptionTitle, isRTL && { textAlign: 'right' }]}>
                      {language === 'ar' ? 'شاشة المطبخ' : 'Kitchen Display'}
                    </Text>
                    {kitchenOperationMode === 'display' && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>{language === 'ar' ? 'نشط' : 'Active'}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.modeOptionDescription, isRTL && { textAlign: 'right' }]}>
                    {language === 'ar'
                      ? 'شاشة مخصصة في المطبخ تعرض الطلبات. طاقم المطبخ يضغط "جاهز" لإتمام الطلبات.'
                      : 'Dedicated screen in kitchen shows orders. Kitchen staff taps "Ready" to complete orders.'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Receipt Scan Option */}
              <TouchableOpacity
                style={[
                  styles.modeOptionCard,
                  kitchenOperationMode === 'receipt_scan' && styles.modeOptionCardActive
                ]}
                onPress={() => setKitchenOperationMode('receipt_scan')}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.modeOptionIcon,
                  kitchenOperationMode === 'receipt_scan' && styles.modeOptionIconActive
                ]}>
                  <ScanLine size={24} color={kitchenOperationMode === 'receipt_scan' ? colors.background : colors.mutedForeground} />
                </View>
                <View style={[styles.modeOptionContent, isRTL && { alignItems: 'flex-end' }]}>
                  <View style={[styles.modeOptionTitleRow, isRTL && { flexDirection: 'row-reverse' }]}>
                    <Text style={[styles.modeOptionTitle, isRTL && { textAlign: 'right' }]}>
                      {language === 'ar' ? 'مسح الإيصال' : 'Receipt Scan'}
                    </Text>
                    {kitchenOperationMode === 'receipt_scan' && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>{language === 'ar' ? 'نشط' : 'Active'}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.modeOptionDescription, isRTL && { textAlign: 'right' }]}>
                    {language === 'ar'
                      ? 'رمز QR مطبوع على الإيصال. الموظف يمسح رمز QR من صفحة الطلبات عند جاهزية الطلب.'
                      : 'QR code printed on receipt. Employee scans QR code from Orders page when order is ready.'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Info Box */}
              <View style={styles.infoBox}>
                <Text style={[styles.infoBoxText, isRTL && { textAlign: 'right' }]}>
                  <Text style={styles.infoBoxBold}>{language === 'ar' ? 'كيف يعمل: ' : 'How it works: '}</Text>
                  {kitchenOperationMode === 'display'
                    ? (language === 'ar'
                        ? 'تظهر الطلبات على شاشة عرض مخصصة في المطبخ. عندما يكون الطلب جاهزاً، يضغط طاقم المطبخ على زر "جاهز" على الشاشة لتحديده كمكتمل.'
                        : 'Orders appear on a dedicated kitchen display screen. When an order is ready, kitchen staff taps the "Ready" button on the display to mark it complete.')
                    : (language === 'ar'
                        ? 'سيتم طباعة رمز QR على كل إيصال. عندما يكون الطلب جاهزاً، يمكن لأي موظف لديه صلاحية "الطلبات" مسح رمز QR من صفحة الطلبات في تطبيق العمل لتحديده كمكتمل.'
                        : 'A QR code will be printed on each receipt. When the order is ready, any employee with "Orders" permission can scan the QR code from the Orders page in the Business App to mark it complete.')}
                </Text>
              </View>
            </View>

            {/* Business Working Days/Hours Section */}
            <View style={styles.formSection}>
              <View style={[styles.sectionHeader, isRTL && { flexDirection: 'row-reverse' }]}>
                <View style={styles.sectionIconContainer}>
                  <Calendar size={20} color={colors.mutedForeground} />
                </View>
                <View style={[styles.sectionHeaderText, isRTL && { alignItems: 'flex-end' }]}>
                  <Text style={[styles.sectionTitle, isRTL && { textAlign: 'right' }]}>
                    {language === 'ar' ? 'أيام وساعات العمل' : 'Business Working Days/Hours'}
                  </Text>
                  <Text style={[styles.sectionSubtitle, isRTL && { textAlign: 'right' }]}>
                    {language === 'ar' ? 'تعيين جدول عمل المتجر' : 'Set your store operating schedule'}
                  </Text>
                </View>
              </View>

              <View style={[styles.timeInputsRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <View style={styles.timeInputGroup}>
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
                <View style={styles.timeInputGroup}>
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
              </View>

              {/* Working Days Selection */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>
                  {language === 'ar' ? 'أيام العمل' : 'Working Days'}
                </Text>
                <View style={[styles.workingDaysRow, isRTL && { flexDirection: 'row-reverse' }]}>
                  {[
                    { key: 'sunday', en: 'Sun', ar: 'أحد' },
                    { key: 'monday', en: 'Mon', ar: 'إثنين' },
                    { key: 'tuesday', en: 'Tue', ar: 'ثلاثاء' },
                    { key: 'wednesday', en: 'Wed', ar: 'أربعاء' },
                    { key: 'thursday', en: 'Thu', ar: 'خميس' },
                    { key: 'friday', en: 'Fri', ar: 'جمعة' },
                    { key: 'saturday', en: 'Sat', ar: 'سبت' },
                  ].map((day) => {
                    const isSelected = workingDays.includes(day.key);
                    return (
                      <TouchableOpacity
                        key={day.key}
                        style={[
                          styles.dayButton,
                          isSelected && styles.dayButtonActive
                        ]}
                        onPress={() => {
                          if (isSelected) {
                            setWorkingDays(workingDays.filter(d => d !== day.key));
                          } else {
                            setWorkingDays([...workingDays, day.key]);
                          }
                        }}
                      >
                        <Text style={[
                          styles.dayButtonText,
                          isSelected && styles.dayButtonTextActive
                        ]}>
                          {language === 'ar' ? day.ar : day.en}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={[styles.inputHint, isRTL && { textAlign: 'right' }]}>
                  {language === 'ar'
                    ? 'حدد أيام عمل نشاطك التجاري. لا يمكن للموظفين تسجيل الحضور في أيام الراحة.'
                    : 'Select which days your business operates. Employees cannot check in on non-working days.'}
                </Text>
              </View>
            </View>

            {/* POS Operation Section */}
            <View style={styles.formSection}>
              <View style={[styles.sectionHeader, isRTL && { flexDirection: 'row-reverse' }]}>
                <View style={styles.sectionIconContainer}>
                  <DollarSign size={20} color={colors.mutedForeground} />
                </View>
                <View style={[styles.sectionHeaderText, isRTL && { alignItems: 'flex-end' }]}>
                  <Text style={[styles.sectionTitle, isRTL && { textAlign: 'right' }]}>
                    {language === 'ar' ? 'تشغيل نقطة البيع' : 'POS Operation'}
                  </Text>
                  <Text style={[styles.sectionSubtitle, isRTL && { textAlign: 'right' }]}>
                    {language === 'ar' ? 'إعداد فتح جلسة نقطة البيع والتحكم في الوصول' : 'Configure POS session opening and access control'}
                  </Text>
                </View>
              </View>

              <View style={[styles.switchRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <View style={[styles.switchInfo, isRTL && { alignItems: 'flex-end' }]}>
                  <Text style={[styles.switchLabel, isRTL && { textAlign: 'right' }]}>
                    {language === 'ar' ? 'رصيد افتتاحي ثابت' : 'Fixed Opening Float'}
                  </Text>
                  <Text style={[styles.switchDescription, isRTL && { textAlign: 'right' }]}>
                    {language === 'ar' ? 'استخدام مبلغ ثابت لرصيد افتتاح الجلسة' : 'Use a fixed amount for session opening float'}
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
                      placeholder="0.00"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <Text style={[styles.inputHint, isRTL && { textAlign: 'right' }]}>
                    {language === 'ar' ? 'سيتم استخدام هذا المبلغ تلقائياً عند فتح جلسة نقطة البيع' : 'This amount will be used automatically when opening a POS session'}
                  </Text>
                </View>
              )}

              {/* Session Access Control */}
              <View style={{ marginTop: 8 }}>
                <Text style={[styles.switchLabel, { marginBottom: 4 }, isRTL && { textAlign: 'right' }]}>
                  {language === 'ar' ? 'التحكم في الوصول للجلسة' : 'Session Access Control'}
                </Text>
                <Text style={[styles.switchDescription, { marginBottom: 12 }, isRTL && { textAlign: 'right' }]}>
                  {language === 'ar' ? 'التحكم في من يمكنه فتح/إغلاق جلسات نقطة البيع' : 'Control who can open/close POS sessions'}
                </Text>

                {posUsers.length === 0 ? (
                  <View style={styles.infoBox}>
                    <Text style={[styles.infoBoxText, { textAlign: 'center' }]}>
                      {language === 'ar'
                        ? 'لم يتم العثور على مستخدمين لديهم صلاحية نقطة البيع'
                        : 'No users with POS permission found'}
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* Restrict Access Toggle */}
                    <View style={[styles.switchRow, isRTL && { flexDirection: 'row-reverse' }]}>
                      <View style={[styles.switchInfo, isRTL && { alignItems: 'flex-end' }]}>
                        <Text style={[styles.switchLabel, isRTL && { textAlign: 'right' }]}>
                          {language === 'ar' ? 'تقييد الوصول' : 'Restrict Access'}
                        </Text>
                        <Text style={[styles.switchDescription, isRTL && { textAlign: 'right' }]}>
                          {language === 'ar'
                            ? 'المستخدمون المحددون فقط يمكنهم فتح/إغلاق الجلسات'
                            : 'Only selected users can open/close sessions'}
                        </Text>
                      </View>
                      <Switch
                        value={posSessionAllowedUserIds.length > 0}
                        onValueChange={(enabled) => {
                          if (enabled) {
                            setPosSessionAllowedUserIds(posUsers.map(u => u.id));
                          } else {
                            setPosSessionAllowedUserIds([]);
                          }
                        }}
                        trackColor={{ false: colors.muted, true: colors.foreground }}
                        thumbColor={colors.background}
                      />
                    </View>

                    {/* User list - only show when restricted mode is ON */}
                    {posSessionAllowedUserIds.length > 0 && (
                      <View style={{ gap: 8, marginTop: 8 }}>
                        {posUsers.map((user) => {
                          const isSelected = posSessionAllowedUserIds.includes(user.id);
                          return (
                            <TouchableOpacity
                              key={user.id}
                              style={[
                                styles.userSelectionCard,
                                isSelected && styles.userSelectionCardActive
                              ]}
                              onPress={() => {
                                if (isSelected) {
                                  setPosSessionAllowedUserIds(posSessionAllowedUserIds.filter(id => id !== user.id));
                                } else {
                                  setPosSessionAllowedUserIds([...posSessionAllowedUserIds, user.id]);
                                }
                              }}
                            >
                              <View style={[
                                styles.userSelectionIcon,
                                isSelected && styles.userSelectionIconActive
                              ]}>
                                <Users size={20} color={isSelected ? colors.background : colors.mutedForeground} />
                              </View>
                              <View style={[styles.userSelectionContent, isRTL && { alignItems: 'flex-end' }]}>
                                <Text style={[styles.userSelectionName, isRTL && { textAlign: 'right' }]}>
                                  {user.name}
                                </Text>
                                <Text style={[styles.userSelectionRole, isRTL && { textAlign: 'right' }]}>
                                  @{user.username} • {user.role}
                                </Text>
                              </View>
                              {isSelected && (
                                <View style={styles.userSelectionCheck}>
                                  <Check size={14} color="#fff" />
                                </View>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {/* Info box */}
                    <View style={[styles.infoBox, { marginTop: 12 }]}>
                      <Text style={[styles.infoBoxText, isRTL && { textAlign: 'right' }]}>
                        <Text style={styles.infoBoxBold}>
                          {language === 'ar' ? 'الإعداد الحالي: ' : 'Current setting: '}
                        </Text>
                        {posSessionAllowedUserIds.length === 0
                          ? (language === 'ar'
                              ? 'جميع المستخدمين الذين لديهم صلاحية نقطة البيع يمكنهم فتح/إغلاق الجلسات'
                              : 'All users with POS permission can open/close sessions')
                          : (language === 'ar'
                              ? `يمكن لـ ${posSessionAllowedUserIds.length} مستخدم محدد فقط فتح/إغلاق الجلسات`
                              : `Only ${posSessionAllowedUserIds.length} selected user(s) can open/close sessions`)}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* GPS Check-in Settings Section */}
            <View style={styles.formSection}>
              <View style={[styles.sectionHeader, isRTL && { flexDirection: 'row-reverse' }]}>
                <View style={styles.sectionIconContainer}>
                  <Navigation size={20} color={colors.mutedForeground} />
                </View>
                <View style={[styles.sectionHeaderText, isRTL && { alignItems: 'flex-end' }]}>
                  <Text style={[styles.sectionTitle, isRTL && { textAlign: 'right' }]}>
                    {language === 'ar' ? 'إعدادات تسجيل الحضور GPS' : 'GPS Check-in Settings'}
                  </Text>
                  <Text style={[styles.sectionSubtitle, isRTL && { textAlign: 'right' }]}>
                    {language === 'ar' ? 'إعداد تسجيل حضور الموظفين بناءً على الموقع' : 'Configure location-based employee check-in'}
                  </Text>
                </View>
              </View>

              {/* Require GPS Check-in Toggle */}
              <View style={[styles.switchRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <View style={[styles.switchInfo, isRTL && { alignItems: 'flex-end' }]}>
                  <Text style={[styles.switchLabel, isRTL && { textAlign: 'right' }]}>
                    {language === 'ar' ? 'طلب GPS لتسجيل الحضور' : 'Require GPS for Check-in'}
                  </Text>
                  <Text style={[styles.switchDescription, isRTL && { textAlign: 'right' }]}>
                    {language === 'ar' ? 'يجب أن يكون الموظفون في موقع الفرع لتسجيل الحضور' : 'Employees must be at branch location to check in'}
                  </Text>
                </View>
                <Switch
                  value={requireGpsCheckin}
                  onValueChange={setRequireGpsCheckin}
                  trackColor={{ false: colors.muted, true: colors.foreground }}
                  thumbColor={colors.background}
                />
              </View>

              {/* GPS Settings - only shown when enabled */}
              {requireGpsCheckin && (
                <>
                  <View style={[styles.timeInputsRow, isRTL && { flexDirection: 'row-reverse' }]}>
                    <View style={styles.timeInputGroup}>
                      <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>
                        {language === 'ar' ? 'نطاق السياج الجغرافي (متر)' : 'Geofence Radius (meters)'}
                      </Text>
                      <View style={[styles.inputContainer, isRTL && { flexDirection: 'row-reverse' }]}>
                        <TextInput
                          style={[styles.input, isRTL && { textAlign: 'right' }]}
                          value={geofenceRadiusMeters}
                          onChangeText={setGeofenceRadiusMeters}
                          placeholder="100"
                          placeholderTextColor={colors.mutedForeground}
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>
                    <View style={styles.timeInputGroup}>
                      <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>
                        {language === 'ar' ? 'دقة GPS المطلوبة (متر)' : 'GPS Accuracy Threshold (meters)'}
                      </Text>
                      <View style={[styles.inputContainer, isRTL && { flexDirection: 'row-reverse' }]}>
                        <TextInput
                          style={[styles.input, isRTL && { textAlign: 'right' }]}
                          value={gpsAccuracyThresholdMeters}
                          onChangeText={setGpsAccuracyThresholdMeters}
                          placeholder="50"
                          placeholderTextColor={colors.mutedForeground}
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>
                  </View>

                  <View style={[styles.timeInputsRow, { marginTop: 8 }, isRTL && { flexDirection: 'row-reverse' }]}>
                    <View style={styles.timeInputGroup}>
                      <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>
                        {language === 'ar' ? 'المهلة قبل الافتتاح (دقائق)' : 'Buffer Before Opening (minutes)'}
                      </Text>
                      <View style={[styles.inputContainer, isRTL && { flexDirection: 'row-reverse' }]}>
                        <TextInput
                          style={[styles.input, isRTL && { textAlign: 'right' }]}
                          value={checkinBufferMinutesBefore}
                          onChangeText={setCheckinBufferMinutesBefore}
                          placeholder="15"
                          placeholderTextColor={colors.mutedForeground}
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>
                    <View style={styles.timeInputGroup}>
                      <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>
                        {language === 'ar' ? 'المهلة بعد الافتتاح (دقائق)' : 'Buffer After Opening (minutes)'}
                      </Text>
                      <View style={[styles.inputContainer, isRTL && { flexDirection: 'row-reverse' }]}>
                        <TextInput
                          style={[styles.input, isRTL && { textAlign: 'right' }]}
                          value={checkinBufferMinutesAfter}
                          onChangeText={setCheckinBufferMinutesAfter}
                          placeholder="30"
                          placeholderTextColor={colors.mutedForeground}
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>
                  </View>

                  {/* How it works info box */}
                  <View style={[styles.infoBox, { marginTop: 12 }]}>
                    <Text style={[styles.infoBoxText, isRTL && { textAlign: 'right' }]}>
                      <Text style={styles.infoBoxBold}>
                        {language === 'ar' ? 'كيف يعمل: ' : 'How it works: '}
                      </Text>
                      {language === 'ar'
                        ? `يمكن للموظفين تسجيل الحضور بدءًا من ${checkinBufferMinutesBefore} دقيقة قبل وقت الافتتاح. سيتم تحديد تسجيلات الحضور بعد وقت الافتتاح على أنها "متأخر" حتى ${checkinBufferMinutesAfter} دقيقة.`
                        : `Employees can check in starting ${checkinBufferMinutesBefore} minutes before opening time. Check-ins after opening time will be marked as "Late" up to ${checkinBufferMinutesAfter} minutes.`}
                    </Text>
                  </View>

                  {/* Branch Location - Integrated into GPS Settings */}
                  {branches.length > 0 && (() => {
                    const branch = currentBranchId
                      ? branches.find(b => b.id === currentBranchId)
                      : branches[0];
                    if (!branch) return null;

                    const hasLocation = branch.latitude && branch.longitude;

                    return (
                      <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                        <View style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, isRTL && { flexDirection: 'row-reverse' }]}>
                          <View style={isRTL ? { alignItems: 'flex-end' } : {}}>
                            <Text style={[styles.inputLabel, { fontSize: 15, fontWeight: '600', marginBottom: 2 }, isRTL && { textAlign: 'right' }]}>
                              {language === 'ar' ? 'موقع الفرع' : 'Branch Location'}
                            </Text>
                            <Text style={[styles.switchDescription, isRTL && { textAlign: 'right' }]}>
                              {language === 'ar' ? 'تعيين موقع GPS لتسجيل الحضور' : 'Set GPS location for check-in'}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.branchSaveButton, { paddingHorizontal: 12, paddingVertical: 8 }, savingBranch && { opacity: 0.6 }]}
                            onPress={() => saveBranchGeofence(branch.id)}
                            disabled={savingBranch}
                          >
                            {savingBranch ? (
                              <ActivityIndicator size="small" color={colors.background} />
                            ) : (
                              <>
                                <Save size={14} color={colors.background} />
                                <Text style={[styles.branchSaveButtonText, { fontSize: 13 }]}>
                                  {language === 'ar' ? 'حفظ' : 'Save'}
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>

                        {/* Location Status */}
                        <View style={[
                          styles.infoBox,
                          { marginBottom: 12 },
                          hasLocation
                            ? { backgroundColor: colors.foreground + '10', borderColor: colors.foreground + '30' }
                            : { backgroundColor: '#FFA50015', borderColor: '#FFA50030' }
                        ]}>
                          <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, isRTL && { flexDirection: 'row-reverse' }]}>
                            <MapPin size={18} color={hasLocation ? colors.foreground : '#FFA500'} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.infoBoxText, { fontWeight: '600', marginBottom: 2 }, isRTL && { textAlign: 'right' }]}>
                                {hasLocation
                                  ? (language === 'ar' ? 'تم تعيين الموقع' : 'Location set')
                                  : (language === 'ar' ? 'الموقع غير محدد' : 'Location not set')}
                              </Text>
                              <Text style={[{ fontSize: 12, color: colors.mutedForeground }, isRTL && { textAlign: 'right' }]}>
                                {hasLocation
                                  ? `${branch.latitude?.toFixed(6)}, ${branch.longitude?.toFixed(6)}`
                                  : (language === 'ar' ? 'استخدم موقعك الحالي أو أدخل الإحداثيات' : 'Use your current location or enter coordinates')}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Map Picker */}
                        <MapPicker
                          latitude={branch.latitude}
                          longitude={branch.longitude}
                          radiusMeters={branch.geofence_radius_meters || parseInt(geofenceRadiusMeters) || 100}
                          onLocationSelect={(lat, lng) => {
                            updateBranch(branch.id, 'latitude', lat);
                            updateBranch(branch.id, 'longitude', lng);
                            // Auto-enable geofence when location is set
                            if (!branch.geofence_enabled) {
                              updateBranch(branch.id, 'geofence_enabled', true);
                            }
                          }}
                          isRTL={isRTL}
                          language={language}
                          colors={colors}
                        />
                      </View>
                    );
                  })()}
                </>
              )}

              {/* Checkout Restrictions - inside GPS Check-in Settings */}
              <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                <View style={[styles.switchRow, isRTL && { flexDirection: 'row-reverse' }]}>
                  <View style={[{ flex: 1 }, isRTL && { alignItems: 'flex-end' }]}>
                    <Text style={[styles.switchLabel, isRTL && { textAlign: 'right' }]}>
                      {language === 'ar' ? 'قيود تسجيل الخروج' : 'Checkout Restrictions'}
                    </Text>
                    <Text style={[styles.switchDescription, isRTL && { textAlign: 'right' }]}>
                      {language === 'ar' ? 'يجب على الموظفين استيفاء المتطلبات للخروج' : 'Employees must meet requirements to check out'}
                    </Text>
                  </View>
                  <Switch
                    value={requireCheckoutRestrictions}
                    onValueChange={setRequireCheckoutRestrictions}
                    trackColor={{ false: colors.border, true: colors.foreground }}
                    thumbColor={colors.background}
                  />
                </View>

                {requireCheckoutRestrictions && (
                  <>
                    <View style={{ marginTop: 12, marginBottom: 12 }}>
                      <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>
                        {language === 'ar' ? 'الحد الأدنى لساعات العمل' : 'Minimum Shift Hours'}
                      </Text>
                      <View style={[styles.inputContainer, isRTL && { flexDirection: 'row-reverse' }]}>
                        <TextInput
                          style={[styles.input, isRTL && { textAlign: 'right' }]}
                          value={minShiftHours}
                          onChangeText={setMinShiftHours}
                          placeholder="4"
                          placeholderTextColor={colors.mutedForeground}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>

                    <View style={{ marginBottom: 12 }}>
                      <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>
                        {language === 'ar' ? 'مهلة الخروج (دقائق)' : 'Checkout Buffer (minutes)'}
                      </Text>
                      <View style={[styles.inputContainer, isRTL && { flexDirection: 'row-reverse' }]}>
                        <TextInput
                          style={[styles.input, isRTL && { textAlign: 'right' }]}
                          value={checkoutBufferMinutesBefore}
                          onChangeText={setCheckoutBufferMinutesBefore}
                          placeholder="30"
                          placeholderTextColor={colors.mutedForeground}
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={[styles.infoBoxText, isRTL && { textAlign: 'right' }]}>
                        <Text style={{ fontWeight: '600' }}>
                          {language === 'ar' ? 'كيف يعمل: ' : 'How it works: '}
                        </Text>
                        {language === 'ar'
                          ? `يجب على الموظفين العمل على الأقل ${minShiftHours} ساعات ويمكنهم تسجيل الخروج فقط بدءًا من ${checkoutBufferMinutesBefore} دقيقة قبل وقت الإغلاق.`
                          : `Employees must work at least ${minShiftHours} hours AND can only check out starting ${checkoutBufferMinutesBefore} minutes before closing time.`}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {/* Employee Schedule Overrides - inside GPS Check-in Settings */}
              {employees.length > 0 && (
                <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <View style={[{ marginBottom: 12 }, isRTL && { alignItems: 'flex-end' }]}>
                    <Text style={[styles.inputLabel, { fontSize: 15, fontWeight: '600', marginBottom: 2 }, isRTL && { textAlign: 'right' }]}>
                      {language === 'ar' ? 'جداول الموظفين المخصصة' : 'Employee Schedule Overrides'}
                    </Text>
                    <Text style={[styles.switchDescription, isRTL && { textAlign: 'right' }]}>
                      {language === 'ar' ? 'تعيين ساعات/أيام عمل مخصصة لموظفين محددين' : 'Set custom working hours/days for specific employees'}
                    </Text>
                  </View>

                {employees.map((employee) => {
                  const override = getOverrideForEmployee(employee.id);
                  const hasOverride = override && (override.working_days || override.opening_time || override.closing_time);
                  const isEditing = editingEmployeeId === employee.id;

                  return (
                    <View
                      key={employee.id}
                      style={[
                        styles.employeeCard,
                        isEditing && styles.employeeCardEditing
                      ]}
                    >
                      <View style={[styles.employeeHeader, isRTL && { flexDirection: 'row-reverse' }]}>
                        <View style={styles.employeeIconWrapper}>
                          <User size={20} color={colors.mutedForeground} />
                        </View>
                        <View style={[styles.employeeInfo, isRTL && { alignItems: 'flex-end' }]}>
                          <Text style={[styles.employeeName, isRTL && { textAlign: 'right' }]}>
                            {employee.name}
                          </Text>
                          <Text style={[styles.employeeRole, isRTL && { textAlign: 'right' }]}>
                            @{employee.username} • {employee.role}
                            {hasOverride && (language === 'ar' ? ' • جدول مخصص' : ' • Custom Schedule')}
                          </Text>
                        </View>
                        {isEditing ? (
                          <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setEditingEmployeeId(null)}
                          >
                            <X size={18} color={colors.mutedForeground} />
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={styles.editButton}
                            onPress={() => setEditingEmployeeId(employee.id)}
                          >
                            <Text style={styles.editButtonText}>
                              {language === 'ar' ? 'تعديل' : 'Edit'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {isEditing && (
                        <View style={styles.employeeEditForm}>
                          {/* Custom Working Days */}
                          <View style={styles.inputGroup}>
                            <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>
                              {language === 'ar' ? 'أيام عمل مخصصة (اتركها فارغة لاستخدام الافتراضي)' : 'Custom Working Days (leave empty for default)'}
                            </Text>
                            <View style={[styles.workingDaysRow, isRTL && { flexDirection: 'row-reverse' }]}>
                              {[
                                { key: 'sunday', en: 'Sun', ar: 'أحد' },
                                { key: 'monday', en: 'Mon', ar: 'إثنين' },
                                { key: 'tuesday', en: 'Tue', ar: 'ثلاثاء' },
                                { key: 'wednesday', en: 'Wed', ar: 'أربعاء' },
                                { key: 'thursday', en: 'Thu', ar: 'خميس' },
                                { key: 'friday', en: 'Fri', ar: 'جمعة' },
                                { key: 'saturday', en: 'Sat', ar: 'سبت' },
                              ].map((day) => {
                                const days = override?.working_days || [];
                                const isSelected = days.includes(day.key);
                                return (
                                  <TouchableOpacity
                                    key={day.key}
                                    style={[
                                      styles.dayButton,
                                      isSelected && styles.dayButtonActive
                                    ]}
                                    onPress={() => {
                                      const newDays = isSelected
                                        ? days.filter(d => d !== day.key)
                                        : [...days, day.key];
                                      updateOverride(employee.id, 'working_days', newDays.length > 0 ? newDays : null);
                                    }}
                                  >
                                    <Text style={[
                                      styles.dayButtonText,
                                      isSelected && styles.dayButtonTextActive
                                    ]}>
                                      {language === 'ar' ? day.ar : day.en}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>

                          {/* Custom Working Hours */}
                          <View style={[styles.timeInputsRow, { marginTop: 8 }, isRTL && { flexDirection: 'row-reverse' }]}>
                            <View style={styles.timeInputGroup}>
                              <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>
                                {language === 'ar' ? 'وقت البدء المخصص' : 'Custom Start Time'}
                              </Text>
                              <View style={[styles.inputContainer, isRTL && { flexDirection: 'row-reverse' }]}>
                                <Clock size={18} color={colors.mutedForeground} />
                                <TextInput
                                  style={[styles.input, isRTL && { textAlign: 'right' }]}
                                  value={override?.opening_time || ''}
                                  onChangeText={(val) => updateOverride(employee.id, 'opening_time', val || null)}
                                  placeholder={openingTime || '09:00'}
                                  placeholderTextColor={colors.mutedForeground}
                                />
                              </View>
                            </View>
                            <View style={styles.timeInputGroup}>
                              <Text style={[styles.inputLabel, isRTL && { textAlign: 'right' }]}>
                                {language === 'ar' ? 'وقت الانتهاء المخصص' : 'Custom End Time'}
                              </Text>
                              <View style={[styles.inputContainer, isRTL && { flexDirection: 'row-reverse' }]}>
                                <Clock size={18} color={colors.mutedForeground} />
                                <TextInput
                                  style={[styles.input, isRTL && { textAlign: 'right' }]}
                                  value={override?.closing_time || ''}
                                  onChangeText={(val) => updateOverride(employee.id, 'closing_time', val || null)}
                                  placeholder={closingTime || '22:00'}
                                  placeholderTextColor={colors.mutedForeground}
                                />
                              </View>
                            </View>
                          </View>

                          {/* Action Buttons */}
                          <View style={[styles.employeeActionButtons, isRTL && { flexDirection: 'row-reverse' }]}>
                            {hasOverride && (
                              <TouchableOpacity
                                style={styles.deleteOverrideButton}
                                onPress={() => deleteScheduleOverride(employee.id)}
                              >
                                <Trash2 size={16} color="#ef4444" />
                                <Text style={styles.deleteOverrideButtonText}>
                                  {language === 'ar' ? 'إزالة التخصيص' : 'Remove Override'}
                                </Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              style={[styles.saveOverrideButton, savingOverride && { opacity: 0.6 }]}
                              onPress={() => saveScheduleOverride(employee.id)}
                              disabled={savingOverride}
                            >
                              {savingOverride ? (
                                <ActivityIndicator size="small" color={colors.background} />
                              ) : (
                                <>
                                  <Save size={16} color={colors.background} />
                                  <Text style={styles.saveOverrideButtonText}>
                                    {language === 'ar' ? 'حفظ' : 'Save'}
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}

                <View style={styles.infoBox}>
                  <Text style={[styles.infoBoxText, isRTL && { textAlign: 'right' }]}>
                    <Text style={styles.infoBoxBold}>
                      {language === 'ar' ? 'ملاحظة: ' : 'Note: '}
                    </Text>
                    {language === 'ar'
                      ? 'الموظفون بدون جدول مخصص سيستخدمون ساعات/أيام العمل الافتراضية للمتجر.'
                      : 'Employees without a custom schedule will use the default business working hours/days.'}
                  </Text>
                </View>
              </View>
            )}
            </View>

            {/* Notifications Section */}
            <View style={styles.formSection}>
              <View style={[styles.sectionHeader, isRTL && { flexDirection: 'row-reverse' }]}>
                <View style={styles.sectionIconContainer}>
                  <Bell size={20} color={colors.mutedForeground} />
                </View>
                <View style={[styles.sectionHeaderText, isRTL && { alignItems: 'flex-end' }]}>
                  <Text style={[styles.sectionTitle, isRTL && { textAlign: 'right' }]}>
                    {language === 'ar' ? 'الإشعارات' : 'Notifications'}
                  </Text>
                  <Text style={[styles.sectionSubtitle, isRTL && { textAlign: 'right' }]}>
                    {language === 'ar' ? 'إعداد إشعارات الطلبات' : 'Configure order notifications'}
                  </Text>
                </View>
              </View>

              <View style={[styles.switchRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <View style={[styles.switchInfo, isRTL && { alignItems: 'flex-end' }]}>
                  <Text style={[styles.switchLabel, isRTL && { textAlign: 'right' }]}>
                    {language === 'ar' ? 'إشعارات الطلبات' : 'Order Notifications'}
                  </Text>
                  <Text style={[styles.switchDescription, isRTL && { textAlign: 'right' }]}>
                    {language === 'ar' ? 'تنبيهات صوتية للطلبات الجديدة' : 'Sound alerts for new orders'}
                  </Text>
                </View>
                <Switch
                  value={enableOrderNotifications}
                  onValueChange={setEnableOrderNotifications}
                  trackColor={{ false: colors.muted, true: colors.foreground }}
                  thumbColor={colors.background}
                />
              </View>
            </View>
          </View>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <View style={styles.formSection}>
            {/* Biometric Authentication Section */}
            <View style={[styles.sectionHeader, isRTL && { flexDirection: 'row-reverse' }]}>
              <View style={styles.sectionIconContainer}>
                {biometric.biometricType === 'face' ? (
                  <ScanFace size={20} color={colors.mutedForeground} />
                ) : (
                  <Fingerprint size={20} color={colors.mutedForeground} />
                )}
              </View>
              <View style={[styles.sectionHeaderText, isRTL && { alignItems: 'flex-end' }]}>
                <Text style={[styles.sectionTitle, isRTL && { textAlign: 'right' }]}>
                  {language === 'ar' ? 'المصادقة البيومترية' : 'Biometric Authentication'}
                </Text>
                <Text style={[styles.sectionSubtitle, isRTL && { textAlign: 'right' }]}>
                  {language === 'ar'
                    ? 'استخدم بصمة الوجه أو الإصبع لتسجيل الدخول'
                    : 'Use Face ID or fingerprint to sign in'}
                </Text>
              </View>
            </View>

            {biometric.isLoading ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : !biometric.isAvailable ? (
              <View style={[styles.infoBox, { backgroundColor: colors.muted }]}>
                <Text style={[styles.infoBoxText, isRTL && { textAlign: 'right' }]}>
                  {language === 'ar'
                    ? 'المصادقة البيومترية غير متوفرة على هذا الجهاز أو لم يتم إعدادها.'
                    : 'Biometric authentication is not available on this device or not set up.'}
                </Text>
              </View>
            ) : (
              <>
                <View style={[styles.switchRow, isRTL && { flexDirection: 'row-reverse' }]}>
                  <View style={[styles.switchInfo, isRTL && { alignItems: 'flex-end' }]}>
                    <Text style={[styles.switchLabel, isRTL && { textAlign: 'right' }]}>
                      {language === 'ar'
                        ? `استخدام ${biometric.getBiometricTypeName('ar')}`
                        : `Use ${biometric.getBiometricTypeName('en')}`}
                    </Text>
                    <Text style={[styles.switchDescription, isRTL && { textAlign: 'right' }]}>
                      {language === 'ar'
                        ? 'تسجيل دخول سريع وآمن باستخدام البيومتري'
                        : 'Quick and secure sign-in with biometrics'}
                    </Text>
                  </View>
                  {biometricToggleLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Switch
                      value={biometric.isEnabled}
                      onValueChange={async (value) => {
                        setBiometricToggleLoading(true);
                        try {
                          const userStr = await AsyncStorage.getItem('user');
                          if (!userStr) return;
                          const user = JSON.parse(userStr);
                          const userId = user.id?.toString();

                          if (value) {
                            // Enable - need to get credentials first
                            // For now, just show a message that they need to re-login
                            Alert.alert(
                              language === 'ar' ? 'تفعيل المصادقة البيومترية' : 'Enable Biometric',
                              language === 'ar'
                                ? 'لتفعيل المصادقة البيومترية، يرجى تسجيل الخروج ثم تسجيل الدخول مرة أخرى. سيُطلب منك تفعيل البيومتري بعد تسجيل الدخول.'
                                : 'To enable biometric authentication, please log out and log in again. You will be prompted to enable biometrics after signing in.',
                              [{ text: language === 'ar' ? 'حسناً' : 'OK' }]
                            );
                          } else {
                            // Disable
                            await biometric.disableBiometric(userId);
                            Alert.alert(
                              language === 'ar' ? 'تم التعطيل' : 'Disabled',
                              language === 'ar'
                                ? 'تم تعطيل المصادقة البيومترية.'
                                : 'Biometric authentication has been disabled.'
                            );
                          }
                        } catch (error) {
                          console.error('Error toggling biometric:', error);
                          Alert.alert(
                            language === 'ar' ? 'خطأ' : 'Error',
                            language === 'ar'
                              ? 'حدث خطأ أثناء تغيير إعدادات البيومتري.'
                              : 'An error occurred while changing biometric settings.'
                          );
                        } finally {
                          setBiometricToggleLoading(false);
                        }
                      }}
                      trackColor={{ false: colors.muted, true: colors.foreground }}
                      thumbColor={colors.background}
                    />
                  )}
                </View>

                {biometric.isEnabled && (
                  <View style={[styles.infoBox, { backgroundColor: colors.primary + '15', marginTop: 12 }]}>
                    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
                      <Shield size={16} color={colors.primary} />
                      <Text style={[styles.infoBoxText, { color: colors.primary }, isRTL && { textAlign: 'right' }]}>
                        {language === 'ar'
                          ? 'بيانات الاعتماد الخاصة بك مخزنة بشكل آمن على هذا الجهاز.'
                          : 'Your credentials are stored securely on this device.'}
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
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
    flexGrow: 0,
    flexShrink: 0,
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
  // Section header styles for operational settings
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  // Mode option card styles (for kitchen operations)
  modeOptionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: 12,
    gap: 12,
  },
  modeOptionCardActive: {
    borderColor: colors.foreground,
    backgroundColor: colors.muted,
  },
  modeOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeOptionIconActive: {
    backgroundColor: colors.foreground,
  },
  modeOptionContent: {
    flex: 1,
  },
  modeOptionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  modeOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  modeOptionDescription: {
    fontSize: 13,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  activeBadge: {
    backgroundColor: colors.foreground,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.background,
  },
  // Info box styles
  infoBox: {
    backgroundColor: colors.muted,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoBoxText: {
    fontSize: 13,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  infoBoxBold: {
    fontWeight: '600',
    color: colors.foreground,
  },
  // Time inputs row
  timeInputsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeInputGroup: {
    flex: 1,
  },
  // Working days selection
  workingDaysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.muted,
  },
  dayButtonActive: {
    backgroundColor: colors.foreground,
  },
  dayButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  dayButtonTextActive: {
    color: colors.background,
  },
  // User selection card styles
  userSelectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    gap: 12,
  },
  userSelectionCardActive: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  userSelectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userSelectionIconActive: {
    backgroundColor: '#22c55e',
  },
  userSelectionContent: {
    flex: 1,
  },
  userSelectionName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  userSelectionRole: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  userSelectionCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Branch card styles
  branchCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  branchCardEditing: {
    borderColor: colors.foreground,
    backgroundColor: colors.muted,
  },
  branchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  branchInfo: {
    flex: 1,
  },
  branchName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  branchCode: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  branchEditForm: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  branchSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.foreground,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  branchSaveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background,
  },
  // Employee card styles
  employeeCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  employeeCardEditing: {
    borderColor: colors.foreground,
    backgroundColor: colors.muted,
  },
  employeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  employeeIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  employeeRole: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  employeeEditForm: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  employeeActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  deleteOverrideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  deleteOverrideButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ef4444',
  },
  saveOverrideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.foreground,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveOverrideButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.background,
  },
  // Edit/Close buttons
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.muted,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
