import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Platform, 
  RefreshControl,
  Animated,
  Modal,
  TextInput,
  Alert,
  Switch
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { colors as staticColors } from '../theme/colors';
import api from '../api/client';
import { cacheManager, CACHE_TTL, CacheKeys } from '../services/CacheManager';
import { useLocalization } from '../localization/LocalizationContext';
import { safeGoBack } from '../utils/navigationHelpers';
import { 
  ArrowLeft,
  ArrowRight,
  Search,
  X,
  Plus,
  Edit2,
  Trash2,
  Key,
  Crown,
  Shield,
  User,
  Monitor,
  ChefHat,
  AlertCircle,
  ChevronDown,
  Check
} from 'lucide-react-native';

// Types
interface UserPermissions {
  menu_edit: boolean;
  inventory: boolean;
  delivery: boolean;
  tables: boolean;
  drivers: boolean;
  orders: boolean;
  discounts: boolean;
  pos_access: boolean;
}

interface BusinessUser {
  id: number;
  business_id: number;
  username: string;
  role: 'owner' | 'manager' | 'employee' | 'pos' | 'kitchen_display';
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  status: 'active' | 'inactive' | 'suspended';
  permissions?: UserPermissions;
  created_at: string;
}

const DEFAULT_MANAGER_PERMISSIONS: UserPermissions = {
  menu_edit: true,
  inventory: true,
  delivery: true,
  tables: true,
  drivers: true,
  orders: true,
  discounts: true,
  pos_access: true,
};

const DEFAULT_EMPLOYEE_PERMISSIONS: UserPermissions = {
  menu_edit: false,
  inventory: false,
  delivery: false,
  tables: false,
  drivers: false,
  orders: false,
  discounts: false,
  pos_access: false,
};

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
      style={[{ width: w, height, borderRadius, backgroundColor: staticColors.border, opacity: pulseAnim }, style]}
    />
  );
};

const UserSkeleton = ({ styles }: { styles: any }) => (
  <View style={styles.userCard}>
    <View style={styles.userCardContent}>
      <Skeleton width={48} height={48} borderRadius={12} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Skeleton width="60%" height={18} style={{ marginBottom: 6 }} />
        <Skeleton width="40%" height={14} />
      </View>
      <Skeleton width={32} height={32} borderRadius={8} />
    </View>
  </View>
);

export default function StaffManagementScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const modalStyles = createModalStyles(colors);
  const { t, isRTL, language } = useLocalization();
  
  const [users, setUsers] = useState<BusinessUser[]>([]);
  const [maxUsers, setMaxUsers] = useState(5);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<BusinessUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Form state
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'manager' | 'employee' | 'pos' | 'kitchen_display'>('employee');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [permissions, setPermissions] = useState<UserPermissions>({ ...DEFAULT_EMPLOYEE_PERMISSIONS });
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  const roleOptions = [
    { id: 'manager', label: language === 'ar' ? 'مدير' : 'Manager' },
    { id: 'employee', label: language === 'ar' ? 'موظف' : 'Employee' },
    { id: 'pos', label: language === 'ar' ? 'نقطة بيع' : 'POS Terminal' },
    { id: 'kitchen_display', label: language === 'ar' ? 'شاشة المطبخ' : 'Kitchen Display' },
  ];

  const statusOptions = [
    { id: 'active', label: language === 'ar' ? 'نشط' : 'Active' },
    { id: 'inactive', label: language === 'ar' ? 'غير نشط' : 'Inactive' },
  ];

  useEffect(() => {
    loadUsers(false); // Use cache if available
  }, []);

  const loadUsers = async (forceRefresh = false) => {
    const cacheKey = CacheKeys.staffUsers();
    
    // Check cache first to avoid skeleton flash
    if (!forceRefresh) {
      const cached = await cacheManager.get<{ users: BusinessUser[], maxUsers: number, currentUserId: number | null }>(cacheKey);
      // Ensure cached data has valid structure
      if (cached && cached.users && Array.isArray(cached.users)) {
        setUsers(cached.users);
        setMaxUsers(cached.maxUsers || 5);
        setCurrentUserId(cached.currentUserId || null);
        setLoading(false);
        // Refresh in background
        api.get('/business-users')
          .then(response => {
            if (response.data.success !== false) {
              const sortedUsers = [...(response.data.data || [])].sort((a: BusinessUser, b: BusinessUser) => {
                const roleOrder: Record<string, number> = { owner: 0, manager: 1, employee: 2, pos: 3, kitchen_display: 4 };
                return (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99);
              });
              const newData = { users: sortedUsers, maxUsers: response.data.max_users || 5, currentUserId: response.data.current_user_id || null };
              if (JSON.stringify(sortedUsers) !== JSON.stringify(cached.users)) {
                setUsers(sortedUsers);
                setMaxUsers(newData.maxUsers);
                setCurrentUserId(newData.currentUserId);
                cacheManager.set(cacheKey, newData, CACHE_TTL.MEDIUM);
              }
            }
          })
          .catch(() => {})
          .finally(() => setRefreshing(false));
        return;
      }
    }
    
    try {
      setLoading(true);
      const response = await api.get('/business-users');
      if (response.data.success !== false) {
        const sortedUsers = [...(response.data.data || [])].sort((a: BusinessUser, b: BusinessUser) => {
          const roleOrder: Record<string, number> = { owner: 0, manager: 1, employee: 2, pos: 3, kitchen_display: 4 };
          return (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99);
        });
        setUsers(sortedUsers);
        setMaxUsers(response.data.max_users || 5);
        setCurrentUserId(response.data.current_user_id || null);
        await cacheManager.set(cacheKey, { users: sortedUsers, maxUsers: response.data.max_users || 5, currentUserId: response.data.current_user_id || null }, CACHE_TTL.MEDIUM);
      }
    } catch (error: any) {
      console.error('Failed to load users:', error);
      if (error.response?.status === 403) {
        setError(language === 'ar' ? 'فقط المالك يمكنه إدارة المستخدمين' : 'Only owners can manage users');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadUsers(true); // Force refresh on pull-to-refresh
  }, []);

  const openModal = (user?: BusinessUser) => {
    if (user) {
      setEditingUser(user);
      setUsername(user.username);
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setRole(user.role === 'owner' ? 'manager' : user.role as 'manager' | 'employee' | 'pos' | 'kitchen_display');
      setStatus(user.status === 'suspended' ? 'inactive' : user.status as 'active' | 'inactive');
      // Merge with defaults to ensure new permission fields (like pos_access) have a value
      if (user.permissions) {
        const defaultPerms = user.role === 'manager' ? DEFAULT_MANAGER_PERMISSIONS : DEFAULT_EMPLOYEE_PERMISSIONS;
        setPermissions({ ...defaultPerms, ...user.permissions });
      } else {
        setPermissions(user.role === 'manager' ? { ...DEFAULT_MANAGER_PERMISSIONS } : { ...DEFAULT_EMPLOYEE_PERMISSIONS });
      }
    } else {
      setEditingUser(null);
      setUsername('');
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setRole('employee');
      setStatus('active');
      setPermissions({ ...DEFAULT_EMPLOYEE_PERMISSIONS });
    }
    setError(null);
    setSuccessMessage(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setError(null);
    setSuccessMessage(null);
    setShowRolePicker(false);
    setShowStatusPicker(false);
  };

  const handleRoleChange = (newRole: 'manager' | 'employee' | 'pos' | 'kitchen_display') => {
    setRole(newRole);
    setShowRolePicker(false);
    if (newRole === 'manager') {
      setPermissions({ ...DEFAULT_MANAGER_PERMISSIONS });
    } else if (newRole === 'employee') {
      setPermissions({ ...DEFAULT_EMPLOYEE_PERMISSIONS });
    }
  };

  const handleSave = async () => {
    if (!username.trim()) {
      setError(language === 'ar' ? 'اسم المستخدم مطلوب' : 'Username is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const shouldIncludePermissions = role === 'manager' || role === 'employee';
      
      if (editingUser) {
        await api.put(`/business-users/${editingUser.id}`, {
          username: username.trim(),
          role: editingUser.role === 'owner' ? undefined : role,
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          status: editingUser.role === 'owner' ? undefined : status,
          permissions: shouldIncludePermissions && editingUser.role !== 'owner' ? permissions : undefined,
        });
        setSuccessMessage(language === 'ar' ? 'تم تحديث المستخدم بنجاح' : 'User updated successfully');
      } else {
        const result = await api.post('/business-users', {
          username: username.trim(),
          role,
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          permissions: shouldIncludePermissions ? permissions : undefined,
        });
        const defaultPassword = result.data.default_password || '90074007';
        setSuccessMessage(
          language === 'ar' 
            ? `تم إنشاء المستخدم! كلمة المرور الافتراضية: ${defaultPassword}`
            : `User created! Default password: ${defaultPassword}`
        );
      }
      await cacheManager.invalidate(CacheKeys.staffUsers());
      loadUsers(true); // Force refresh after mutation
      setTimeout(() => closeModal(), 2000);
    } catch (error: any) {
      setError(error.response?.data?.error || (language === 'ar' ? 'فشل في حفظ المستخدم' : 'Failed to save user'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (user: BusinessUser) => {
    if (user.role === 'owner') {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'لا يمكن حذف حساب المالك' : 'Cannot delete owner account'
      );
      return;
    }

    Alert.alert(
      language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete',
      language === 'ar' ? 'هل أنت متأكد من حذف هذا المستخدم؟' : 'Are you sure you want to delete this user?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: language === 'ar' ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/business-users/${user.id}`);
              await cacheManager.invalidate(CacheKeys.staffUsers());
              loadUsers(true); // Force refresh after mutation
            } catch (error: any) {
              Alert.alert(
                t('error'),
                error.response?.data?.error || (language === 'ar' ? 'فشل في حذف المستخدم' : 'Failed to delete user')
              );
            }
          }
        }
      ]
    );
  };

  const handleResetPassword = (user: BusinessUser) => {
    Alert.alert(
      language === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Reset Password',
      language === 'ar' 
        ? 'إعادة تعيين كلمة المرور إلى الافتراضية (90074007)؟' 
        : 'Reset password to default (90074007)?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: language === 'ar' ? 'إعادة تعيين' : 'Reset',
          onPress: async () => {
            try {
              const result = await api.post(`/business-users/${user.id}/reset-password`);
              Alert.alert(
                t('success'),
                language === 'ar' 
                  ? `تم إعادة تعيين كلمة المرور إلى: ${result.data.default_password}`
                  : `Password reset to: ${result.data.default_password}`
              );
            } catch (error: any) {
              Alert.alert(
                t('error'),
                error.response?.data?.error || (language === 'ar' ? 'فشل في إعادة تعيين كلمة المرور' : 'Failed to reset password')
              );
            }
          }
        }
      ]
    );
  };

  const getRoleIcon = (userRole: string) => {
    const iconProps = { size: 16 };
    switch (userRole) {
      case 'owner': return <Crown {...iconProps} color="#f59e0b" />;
      case 'manager': return <Shield {...iconProps} color="#71717a" />;
      case 'pos': return <Monitor {...iconProps} color="#059669" />;
      case 'kitchen_display': return <ChefHat {...iconProps} color="#ea580c" />;
      default: return <User {...iconProps} color="#a1a1aa" />;
    }
  };

  const getRoleBadgeColor = (userRole: string) => {
    switch (userRole) {
      case 'owner': return { bg: '#fef3c7', text: '#d97706' };
      case 'manager': return { bg: '#f4f4f5', text: '#52525b' };
      case 'pos': return { bg: '#d1fae5', text: '#059669' };
      case 'kitchen_display': return { bg: '#ffedd5', text: '#ea580c' };
      default: return { bg: '#f4f4f5', text: '#71717a' };
    }
  };

  const getRoleLabel = (userRole: string) => {
    const labels: Record<string, { en: string; ar: string }> = {
      owner: { en: 'Owner', ar: 'مالك' },
      manager: { en: 'Manager', ar: 'مدير' },
      employee: { en: 'Employee', ar: 'موظف' },
      pos: { en: 'POS Terminal', ar: 'نقطة بيع' },
      kitchen_display: { en: 'Kitchen Display', ar: 'شاشة المطبخ' },
    };
    const label = labels[userRole];
    return label ? (language === 'ar' ? label.ar : label.en) : userRole;
  };

  // Filter users
  const filteredUsers = (users || []).filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.username?.toLowerCase().includes(query) ||
      user.first_name?.toLowerCase().includes(query) ||
      user.last_name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query)
    );
  });

  const canAddUsers = (users || []).length < maxUsers;

  const renderUserCard = (user: BusinessUser) => {
    const roleBadge = getRoleBadgeColor(user.role);
    const displayName = user.first_name && user.last_name 
      ? `${user.first_name} ${user.last_name}` 
      : user.username;
    
    return (
      <View key={user.id} style={styles.userCard}>
        <View style={[styles.userCardContent, isRTL && styles.rtlRow]}>
          <View style={[
            styles.userAvatar, 
            { backgroundColor: user.role === 'owner' ? '#fef3c7' : '#f4f4f5' }
          ]}>
            <Text style={[
              styles.userAvatarText,
              { color: user.role === 'owner' ? '#d97706' : '#71717a' }
            ]}>
              {user.username[0].toUpperCase()}
            </Text>
          </View>
          
          <View style={[styles.userInfo, isRTL && { alignItems: 'flex-end' }]}>
            <View style={[styles.userNameRow, isRTL && styles.rtlRow]}>
              <Text style={[styles.userName, isRTL && styles.rtlText]} numberOfLines={1}>
                {displayName}
              </Text>
              <View style={[styles.roleBadge, { backgroundColor: roleBadge.bg }]}>
                {getRoleIcon(user.role)}
                <Text style={[styles.roleBadgeText, { color: roleBadge.text }]}>
                  {getRoleLabel(user.role)}
                </Text>
              </View>
            </View>
            <Text style={[styles.userUsername, isRTL && styles.rtlText]}>
              @{user.username}
              {user.email && ` • ${user.email}`}
            </Text>
            {user.status !== 'active' && (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveBadgeText}>
                  {language === 'ar' ? 'غير نشط' : 'Inactive'}
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.userActions}>
            {(user.role !== 'owner' || user.id === currentUserId) && (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => handleResetPassword(user)}
              >
                <Key size={16} color="#d97706" />
              </TouchableOpacity>
            )}
            {(user.role !== 'owner' || user.id === currentUserId) && (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => openModal(user)}
              >
                <Edit2 size={16} color={colors.primary} />
              </TouchableOpacity>
            )}
            {user.role !== 'owner' && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.deleteActionButton]}
                onPress={() => handleDelete(user)}
              >
                <Trash2 size={16} color={colors.destructive} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Users List - scrolls with header */}
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header - scrolls with content */}
        <View style={styles.header}>
          <View style={[styles.headerTop, isRTL && styles.rtlRow]}>
            <TouchableOpacity style={styles.backButton} onPress={() => safeGoBack(navigation)}>
              {isRTL ? (
                <ArrowRight size={24} color={colors.foreground} />
              ) : (
                <ArrowLeft size={24} color={colors.foreground} />
              )}
            </TouchableOpacity>
            <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
              {t('staffManagement')}
            </Text>
            <TouchableOpacity
              style={[styles.headerAddButton, !canAddUsers && styles.addButtonDisabled]}
              onPress={() => openModal()}
              disabled={!canAddUsers}
            >
              <Plus size={20} color={colors.background} />
            </TouchableOpacity>
          </View>
          
          {/* Search */}
          <View style={[styles.searchContainer, isRTL && styles.rtlRow]}>
            <Search size={20} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, isRTL && styles.rtlText]}
              placeholder={language === 'ar' ? 'بحث عن المستخدمين...' : 'Search users...'}
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
              textAlign={isRTL ? 'right' : 'left'}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* User Count */}
        <View style={[styles.userCountBar, isRTL && styles.rtlRow]}>
          <Text style={styles.userCountText}>
            {(users || []).length} / {maxUsers} {language === 'ar' ? 'مستخدم' : 'users'}
          </Text>
        </View>

        {/* Max users warning */}
        {!canAddUsers && (
          <View style={styles.warningBanner}>
            <AlertCircle size={18} color="#d97706" />
            <Text style={[styles.warningText, isRTL && styles.rtlText]}>
              {language === 'ar' 
                ? 'لقد وصلت إلى الحد الأقصى لعدد المستخدمين. تواصل مع الدعم للترقية.'
                : 'You have reached the maximum number of users. Contact support to upgrade.'}
            </Text>
          </View>
        )}

        <View style={styles.usersList}>
          {loading ? (
            <>
              <UserSkeleton styles={styles} />
              <UserSkeleton styles={styles} />
              <UserSkeleton styles={styles} />
            </>
          ) : (filteredUsers || []).length === 0 ? (
            <View style={styles.emptyState}>
              <User size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                {language === 'ar' ? 'لا يوجد مستخدمين' : 'No users found'}
              </Text>
            </View>
          ) : (
            (filteredUsers || []).map(user => renderUserCard(user))
          )}
        </View>
      </ScrollView>

      {/* Add/Edit User Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={modalStyles.overlay}>
          <View style={modalStyles.container}>
            <View style={[modalStyles.header, isRTL && styles.rtlRow]}>
              <Text style={[modalStyles.title, isRTL && styles.rtlText]}>
                {editingUser 
                  ? (language === 'ar' ? 'تعديل المستخدم' : 'Edit User')
                  : (language === 'ar' ? 'إضافة مستخدم' : 'Add User')}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <X size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView style={modalStyles.content} showsVerticalScrollIndicator={false}>
              {error && (
                <View style={modalStyles.errorBox}>
                  <Text style={modalStyles.errorText}>{error}</Text>
                </View>
              )}

              {successMessage && (
                <View style={modalStyles.successBox}>
                  <Text style={modalStyles.successText}>{successMessage}</Text>
                </View>
              )}

              {editingUser?.role === 'owner' && (
                <View style={modalStyles.ownerWarning}>
                  <Crown size={16} color="#d97706" />
                  <Text style={[modalStyles.ownerWarningText, isRTL && styles.rtlText]}>
                    {language === 'ar' 
                      ? 'لا يمكن تغيير دور المالك أو حالته'
                      : 'Owner role and status cannot be changed'}
                  </Text>
                </View>
              )}

              {/* Username */}
              <View style={modalStyles.field}>
                <Text style={[modalStyles.label, isRTL && styles.rtlText]}>
                  {language === 'ar' ? 'اسم المستخدم *' : 'Username *'}
                </Text>
                <TextInput
                  style={[modalStyles.input, isRTL && styles.rtlText]}
                  value={username}
                  onChangeText={setUsername}
                  placeholder={language === 'ar' ? 'مثال: john_doe' : 'e.g., john_doe'}
                  placeholderTextColor={colors.mutedForeground}
                  textAlign={isRTL ? 'right' : 'left'}
                />
              </View>

              {/* First & Last Name */}
              <View style={[modalStyles.row, isRTL && styles.rtlRow]}>
                <View style={[modalStyles.field, { flex: 1, marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }]}>
                  <Text style={[modalStyles.label, isRTL && styles.rtlText]}>
                    {language === 'ar' ? 'الاسم الأول' : 'First Name'}
                  </Text>
                  <TextInput
                    style={[modalStyles.input, isRTL && styles.rtlText]}
                    value={firstName}
                    onChangeText={setFirstName}
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                </View>
                <View style={[modalStyles.field, { flex: 1 }]}>
                  <Text style={[modalStyles.label, isRTL && styles.rtlText]}>
                    {language === 'ar' ? 'الاسم الأخير' : 'Last Name'}
                  </Text>
                  <TextInput
                    style={[modalStyles.input, isRTL && styles.rtlText]}
                    value={lastName}
                    onChangeText={setLastName}
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                </View>
              </View>

              {/* Role (not for owner) */}
              {(!editingUser || editingUser.role !== 'owner') && (
                <View style={modalStyles.field}>
                  <Text style={[modalStyles.label, isRTL && styles.rtlText]}>
                    {language === 'ar' ? 'الدور *' : 'Role *'}
                  </Text>
                  <TouchableOpacity
                    style={[modalStyles.picker, isRTL && styles.rtlRow]}
                    onPress={() => setShowRolePicker(!showRolePicker)}
                  >
                    <Text style={[modalStyles.pickerText, isRTL && styles.rtlText]}>
                      {roleOptions.find(r => r.id === role)?.label}
                    </Text>
                    <ChevronDown size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  {showRolePicker && (
                    <View style={modalStyles.pickerOptions}>
                      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                        {roleOptions.map(option => (
                          <TouchableOpacity
                            key={option.id}
                            style={[modalStyles.pickerOption, role === option.id && modalStyles.pickerOptionActive]}
                            onPress={() => handleRoleChange(option.id as any)}
                          >
                            <Text style={[
                              modalStyles.pickerOptionText,
                              role === option.id && modalStyles.pickerOptionTextActive
                            ]}>
                              {option.label}
                            </Text>
                            {role === option.id && <Check size={16} color={colors.primary} />}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}

              {/* Status (only for editing non-owner) */}
              {editingUser && editingUser.role !== 'owner' && (
                <View style={modalStyles.field}>
                  <Text style={[modalStyles.label, isRTL && styles.rtlText]}>
                    {language === 'ar' ? 'الحالة' : 'Status'}
                  </Text>
                  <TouchableOpacity
                    style={[modalStyles.picker, isRTL && styles.rtlRow]}
                    onPress={() => setShowStatusPicker(!showStatusPicker)}
                  >
                    <Text style={[modalStyles.pickerText, isRTL && styles.rtlText]}>
                      {statusOptions.find(s => s.id === status)?.label}
                    </Text>
                    <ChevronDown size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  {showStatusPicker && (
                    <View style={modalStyles.pickerOptions}>
                      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                        {statusOptions.map(option => (
                          <TouchableOpacity
                            key={option.id}
                            style={[modalStyles.pickerOption, status === option.id && modalStyles.pickerOptionActive]}
                            onPress={() => { setStatus(option.id as any); setShowStatusPicker(false); }}
                          >
                            <Text style={[
                              modalStyles.pickerOptionText,
                              status === option.id && modalStyles.pickerOptionTextActive
                            ]}>
                              {option.label}
                            </Text>
                            {status === option.id && <Check size={16} color={colors.primary} />}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}

              {/* Permissions (only for manager/employee) */}
              {(!editingUser || editingUser.role !== 'owner') && (role === 'manager' || role === 'employee') && (
                <View style={modalStyles.field}>
                  <Text style={[modalStyles.label, isRTL && styles.rtlText]}>
                    {language === 'ar' ? 'الصلاحيات' : 'Permissions'}
                  </Text>
                  <View style={modalStyles.permissionsContainer}>
                    {Object.entries(permissions).map(([key, value]) => {
                      const permLabels: Record<string, { en: string; ar: string }> = {
                        orders: { en: 'Orders', ar: 'الطلبات' },
                        menu_edit: { en: 'Menu Edit', ar: 'تعديل القائمة' },
                        inventory: { en: 'Inventory', ar: 'المخزون' },
                        delivery: { en: 'Delivery Partners', ar: 'شركاء التوصيل' },
                        tables: { en: 'Tables', ar: 'الطاولات' },
                        drivers: { en: 'Drivers', ar: 'السائقين' },
                        discounts: { en: 'Discounts', ar: 'الخصومات' },
                        pos_access: { en: 'POS Access', ar: 'الوصول لنقطة البيع' },
                      };
                      const label = permLabels[key];
                      return (
                        <View key={key} style={[modalStyles.permissionRow, isRTL && styles.rtlRow]}>
                          <Text style={[modalStyles.permissionLabel, isRTL && styles.rtlText]}>
                            {label ? (language === 'ar' ? label.ar : label.en) : key}
                          </Text>
                          <Switch
                            value={value}
                            onValueChange={(v) => setPermissions(prev => ({ ...prev, [key]: v }))}
                            trackColor={{ false: colors.border, true: colors.primary }}
                            thumbColor="#fff"
                          />
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* POS/Kitchen info */}
              {(!editingUser || editingUser.role !== 'owner') && (role === 'pos' || role === 'kitchen_display') && (
                <View style={modalStyles.infoBox}>
                  <Text style={[modalStyles.infoText, isRTL && styles.rtlText]}>
                    {role === 'pos'
                      ? (language === 'ar' ? 'مستخدمو نقطة البيع لديهم وصول ثابت للطلبات فقط.' : 'POS Terminal users have fixed access to Orders only.')
                      : (language === 'ar' ? 'مستخدمو شاشة المطبخ لديهم وصول ثابت للطلبات فقط.' : 'Kitchen Display users have fixed access to Orders only.')
                    }
                  </Text>
                </View>
              )}

              {/* Email */}
              <View style={modalStyles.field}>
                <Text style={[modalStyles.label, isRTL && styles.rtlText]}>
                  {language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                </Text>
                <TextInput
                  style={[modalStyles.input, isRTL && styles.rtlText]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="user@example.com"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  textAlign={isRTL ? 'right' : 'left'}
                />
              </View>

              {/* Phone */}
              <View style={modalStyles.field}>
                <Text style={[modalStyles.label, isRTL && styles.rtlText]}>
                  {language === 'ar' ? 'الهاتف' : 'Phone'}
                </Text>
                <TextInput
                  style={[modalStyles.input, isRTL && styles.rtlText]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+1 (555) 000-0000"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="phone-pad"
                  textAlign={isRTL ? 'right' : 'left'}
                />
              </View>

              {/* Default password info */}
              {!editingUser && (
                <View style={modalStyles.infoBox}>
                  <Text style={[modalStyles.infoText, isRTL && styles.rtlText]}>
                    {language === 'ar' ? 'كلمة المرور الافتراضية ستكون: ' : 'Default password will be: '}
                    <Text style={modalStyles.infoCode}>90074007</Text>
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={modalStyles.footer}>
              <TouchableOpacity style={modalStyles.cancelButton} onPress={closeModal}>
                <Text style={modalStyles.cancelButtonText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[modalStyles.saveButton, saving && { opacity: 0.7 }]} 
                onPress={handleSave}
                disabled={saving || !!successMessage}
              >
                <Text style={modalStyles.saveButtonText}>
                  {saving 
                    ? t('loading')
                    : editingUser 
                      ? (language === 'ar' ? 'تحديث' : 'Update')
                      : (language === 'ar' ? 'إنشاء' : 'Create')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.foreground,
  },
  userCountBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  userCountText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  headerAddButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.foreground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#fcd34d',
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#92400e',
  },
  content: {
    flex: 1,
  },
  usersList: {
    padding: 16,
    paddingBottom: 40,
  },
  userCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  userCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  userUsername: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  inactiveBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  inactiveBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#dc2626',
  },
  userActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteActionButton: {
    backgroundColor: '#fee2e2',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    color: colors.mutedForeground,
    marginTop: 12,
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  rtlText: {
    textAlign: 'right',
  },
});

const createModalStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 40,
  },
  container: {
    backgroundColor: colors.card,
    borderRadius: 24,
    maxHeight: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  content: {
    padding: 20,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerText: {
    fontSize: 15,
    color: colors.foreground,
  },
  pickerOptions: {
    marginTop: 8,
    backgroundColor: colors.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 200,
    overflow: 'hidden',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerOptionActive: {
    backgroundColor: `${colors.primary}15`,
  },
  pickerOptionText: {
    fontSize: 14,
    color: colors.foreground,
  },
  pickerOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  permissionsContainer: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  permissionLabel: {
    fontSize: 14,
    color: colors.foreground,
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#dc2626',
  },
  successBox: {
    backgroundColor: '#d1fae5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    fontSize: 13,
    color: '#059669',
  },
  ownerWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  ownerWarningText: {
    flex: 1,
    fontSize: 12,
    color: '#92400e',
  },
  infoBox: {
    backgroundColor: colors.secondary,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  infoCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: colors.muted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});

