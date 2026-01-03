'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserCog, Plus, Edit2, Trash2, Crown, Shield, User, Key, X, AlertCircle, Monitor, ChefHat, Hash } from 'lucide-react';
import { PageLayout } from '@/components/page-layout';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';
import { getUsers, createUser, updateUser, deleteUser, resetUserPassword, resetUserPIN, type BusinessUser, type CreateUserData, type UserPermissions, DEFAULT_PERMISSIONS } from '@/lib/users-api';
import { getBranches, type Branch } from '@/lib/branches-api';

// User roles (real people)
type UserRole = 'manager' | 'employee';
// Terminal types (devices/screens)
type TerminalType = 'pos' | 'kitchen_display';

export default function UsersRolesPage() {
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const [allUsers, setAllUsers] = useState<BusinessUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [maxUsers, setMaxUsers] = useState(5);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<BusinessUser | null>(null);
  const [modalMode, setModalMode] = useState<'user' | 'terminal'>('user');

  // Form state
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('employee');
  const [terminalType, setTerminalType] = useState<TerminalType>('pos');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS.employee);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Split users and terminals
  const users = allUsers.filter(u => ['owner', 'manager', 'employee'].includes(u.role));
  const terminals = allUsers.filter(u => ['pos', 'kitchen_display'].includes(u.role));

  // Check if user is owner, redirect if not
  useEffect(() => {
    const storedUser = localStorage.getItem('setup_user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser.role !== 'owner') {
          router.push('/items');
          return;
        }
      } catch {
        router.push('/login');
        return;
      }
    }
    loadUsers();
  }, [router]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const [usersResponse, branchesResponse] = await Promise.all([
        getUsers(),
        getBranches()
      ]);
      // Sort: owner first, then managers, then employees
      const sortedUsers = [...usersResponse.data].sort((a, b) => {
        const roleOrder: Record<string, number> = { owner: 0, manager: 1, employee: 2, pos: 3, kitchen_display: 4 };
        return (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99);
      });
      setAllUsers(sortedUsers);
      setMaxUsers(usersResponse.max_users);
      setCurrentUserId(usersResponse.current_user_id);
      setBranches(branchesResponse || []);
    } catch (err: any) {
      console.error('Failed to load users:', err);
      if (err.response?.status === 403) {
        setError(t('Only owners can manage users', 'فقط المالك يمكنه إدارة المستخدمين'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenUserModal = (user?: BusinessUser) => {
    setModalMode('user');
    if (user) {
      setEditingUser(user);
      setUsername(user.username);
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setRole(user.role === 'owner' ? 'manager' : user.role as UserRole);
      setStatus(user.status === 'suspended' ? 'inactive' : user.status as 'active' | 'inactive');
      setBranchId(user.branch_id || null);
      if (user.permissions) {
        const defaultPerms = (user.role === 'manager' || user.role === 'employee')
          ? DEFAULT_PERMISSIONS[user.role as 'manager' | 'employee']
          : DEFAULT_PERMISSIONS.employee;
        setPermissions({ ...defaultPerms, ...user.permissions });
      } else if (user.role === 'manager' || user.role === 'employee') {
        setPermissions(DEFAULT_PERMISSIONS[user.role as 'manager' | 'employee']);
      } else {
        setPermissions(DEFAULT_PERMISSIONS.employee);
      }
    } else {
      resetForm();
      setRole('employee');
      setPermissions(DEFAULT_PERMISSIONS.employee);
      const storedBranch = localStorage.getItem('setup_branch');
      if (storedBranch) {
        try {
          const branch = JSON.parse(storedBranch);
          setBranchId(branch.id || null);
        } catch {
          setBranchId(branches.length > 0 ? branches[0].id : null);
        }
      } else {
        setBranchId(branches.length > 0 ? branches[0].id : null);
      }
    }
    setError(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenTerminalModal = (terminal?: BusinessUser) => {
    setModalMode('terminal');
    if (terminal) {
      setEditingUser(terminal);
      setUsername(terminal.username);
      setFirstName(terminal.first_name || '');
      setLastName(terminal.last_name || '');
      setTerminalType(terminal.role as TerminalType);
      setStatus(terminal.status === 'suspended' ? 'inactive' : terminal.status as 'active' | 'inactive');
    } else {
      resetForm();
      setTerminalType('pos');
    }
    setError(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingUser(null);
    setUsername('');
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setStatus('active');
    setBranchId(null);
  };

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    setPermissions(DEFAULT_PERMISSIONS[newRole]);
  };

  const handlePermissionToggle = (key: keyof UserPermissions) => {
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setError(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async () => {
    if (!username.trim()) {
      setError(t('Username is required', 'اسم المستخدم مطلوب'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (modalMode === 'user') {
        // Handle user (manager/employee)
        let currentBranchId: number | null = branchId;
        if (!currentBranchId) {
          const storedBranch = localStorage.getItem('setup_branch');
          if (storedBranch) {
            try {
              const branch = JSON.parse(storedBranch);
              currentBranchId = branch.id || null;
            } catch {}
          }
        }

        if (editingUser) {
          await updateUser(editingUser.id, {
            username: username.trim(),
            role: editingUser.role === 'owner' ? undefined : role,
            first_name: firstName.trim() || undefined,
            last_name: lastName.trim() || undefined,
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
            status: editingUser.role === 'owner' ? undefined : status,
            permissions,
            branch_id: currentBranchId || undefined,
          });
          setSuccessMessage(t('User updated successfully', 'تم تحديث المستخدم بنجاح'));
        } else {
          const result = await createUser({
            username: username.trim(),
            role,
            first_name: firstName.trim() || undefined,
            last_name: lastName.trim() || undefined,
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
            permissions,
            branch_id: currentBranchId || undefined,
          });
          setSuccessMessage(t(`User created! Default password: ${result.default_password}`, `تم إنشاء المستخدم! كلمة المرور الافتراضية: ${result.default_password}`));
        }
      } else {
        // Handle terminal (pos/kitchen_display)
        if (editingUser) {
          await updateUser(editingUser.id, {
            username: username.trim(),
            role: terminalType,
            first_name: firstName.trim() || undefined,
            last_name: lastName.trim() || undefined,
            status,
          });
          setSuccessMessage(t('Terminal updated successfully', 'تم تحديث الجهاز بنجاح'));
        } else {
          const result = await createUser({
            username: username.trim(),
            role: terminalType,
            first_name: firstName.trim() || undefined,
            last_name: lastName.trim() || undefined,
          });
          setSuccessMessage(t(`Terminal created! Default password: ${result.default_password}`, `تم إنشاء الجهاز! كلمة المرور الافتراضية: ${result.default_password}`));
        }
      }

      loadUsers();
      setTimeout(() => {
        handleCloseModal();
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || t('Failed to save', 'فشل في الحفظ'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (user: BusinessUser) => {
    if (user.role === 'owner') {
      alert(t('Cannot delete owner account', 'لا يمكن حذف حساب المالك'));
      return;
    }

    const isTerminal = ['pos', 'kitchen_display'].includes(user.role);
    const confirmMsg = isTerminal
      ? t('Are you sure you want to delete this terminal?', 'هل أنت متأكد من حذف هذا الجهاز؟')
      : t('Are you sure you want to delete this user?', 'هل أنت متأكد من حذف هذا المستخدم؟');

    if (!confirm(confirmMsg)) return;

    try {
      await deleteUser(user.id);
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || t('Failed to delete', 'فشل في الحذف'));
    }
  };

  const handleResetPassword = async (user: BusinessUser) => {
    if (!confirm(t('Reset password to default (90074007)?', 'إعادة تعيين كلمة المرور إلى الافتراضية (90074007)؟'))) {
      return;
    }

    try {
      const result = await resetUserPassword(user.id);
      alert(t(`Password reset to: ${result.default_password}`, `تم إعادة تعيين كلمة المرور إلى: ${result.default_password}`));
    } catch (err: any) {
      alert(err.response?.data?.error || t('Failed to reset password', 'فشل في إعادة تعيين كلمة المرور'));
    }
  };

  const handleResetPIN = async (user: BusinessUser) => {
    if (!confirm(t('Generate a new POS PIN for this user?', 'إنشاء رمز PIN جديد لنقطة البيع لهذا المستخدم؟'))) {
      return;
    }

    try {
      const result = await resetUserPIN(user.id);
      alert(t(`New POS PIN: ${result.pos_pin}`, `رمز PIN الجديد: ${result.pos_pin}`));
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || t('Failed to reset PIN', 'فشل في إعادة تعيين رمز PIN'));
    }
  };

  // Check if user has POS access (needs a PIN) - only real users, not terminals
  const userHasPosAccess = (user: BusinessUser): boolean => {
    return user.role === 'owner' ||
           user.role === 'manager' ||
           (user.role === 'employee' && (user.permissions?.pos_access ?? false));
  };

  const getRoleIcon = (userRole: string) => {
    switch (userRole) {
      case 'owner': return <Crown className="w-4 h-4 text-amber-500" />;
      case 'manager': return <Shield className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />;
      case 'pos': return <Monitor className="w-4 h-4 text-emerald-500" />;
      case 'kitchen_display': return <ChefHat className="w-4 h-4 text-orange-500" />;
      default: return <User className="w-4 h-4 text-zinc-400" />;
    }
  };

  const getRoleBadge = (userRole: string) => {
    switch (userRole) {
      case 'owner':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
      case 'manager':
        return 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300';
      case 'pos':
        return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400';
      case 'kitchen_display':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400';
      default:
        return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400';
    }
  };

  const canAddUsers = allUsers.length < maxUsers;

  return (
    <PageLayout searchPlaceholder={{ en: 'Search users...', ar: 'البحث في المستخدمين...' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto space-y-8"
      >
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              {t('Users & Roles', 'المستخدمين والصلاحيات')}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              {t('Manage staff access and terminals', 'إدارة صلاحيات الموظفين والأجهزة')}
            </p>
          </div>
          <span className="text-sm text-zinc-500">
            {allUsers.length} / {maxUsers} {t('total accounts', 'حساب إجمالي')}
          </span>
        </div>

        {!canAddUsers && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {t('You have reached the maximum number of accounts for your plan. Contact support to upgrade.', 'لقد وصلت إلى الحد الأقصى لعدد الحسابات في خطتك. تواصل مع الدعم للترقية.')}
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ============================================ */}
            {/* USERS SECTION */}
            {/* ============================================ */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                    <User className="w-5 h-5" />
                    {t('Users', 'المستخدمين')}
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {t('Staff members who can login and perform actions', 'الموظفين الذين يمكنهم تسجيل الدخول وتنفيذ العمليات')}
                  </p>
                </div>
                <button
                  onClick={() => handleOpenUserModal()}
                  disabled={!canAddUsers}
                  className={`inline-flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-xl font-medium transition-colors text-sm ${!canAddUsers ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Plus className="w-4 h-4" />
                  {t('Add User', 'إضافة مستخدم')}
                </button>
              </div>

              {users.length === 0 ? (
                <div className="p-8 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
                  <UserCog className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-600 mb-3" />
                  <p className="text-zinc-500 dark:text-zinc-400">
                    {t('No users yet. Add managers and employees.', 'لا يوجد مستخدمين. أضف مديرين وموظفين.')}
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {users.map((user) => (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${
                            user.role === 'owner'
                              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}>
                            {user.username[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-zinc-900 dark:text-white">
                                {user.first_name && user.last_name
                                  ? `${user.first_name} ${user.last_name}`
                                  : user.username}
                              </h3>
                              <span className={`text-xs px-2 py-0.5 rounded-full capitalize flex items-center gap-1 ${getRoleBadge(user.role)}`}>
                                {getRoleIcon(user.role)}
                                {t(
                                  user.role === 'owner' ? 'Owner' :
                                  user.role === 'manager' ? 'Manager' : 'Employee',
                                  user.role === 'owner' ? 'مالك' :
                                  user.role === 'manager' ? 'مدير' : 'موظف'
                                )}
                              </span>
                              {user.status !== 'active' && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                  {t('Inactive', 'غير نشط')}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                              @{user.username}
                              {user.email && ` • ${user.email}`}
                            </p>
                            {/* Show POS PIN if user has POS access */}
                            {userHasPosAccess(user) && user.pos_pin && (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-mono">
                                  <Hash className="w-3 h-3" />
                                  PIN: {user.pos_pin}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Reset PIN - only for users with POS access */}
                          {userHasPosAccess(user) && (
                            <button
                              onClick={() => handleResetPIN(user)}
                              className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                              title={t('Reset POS PIN', 'إعادة تعيين رمز PIN')}
                            >
                              <Hash className="w-4 h-4" />
                            </button>
                          )}
                          {/* Reset password */}
                          {(user.role !== 'owner' || user.id === currentUserId) && (
                            <button
                              onClick={() => handleResetPassword(user)}
                              className="p-2 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                              title={t('Reset Password', 'إعادة تعيين كلمة المرور')}
                            >
                              <Key className="w-4 h-4" />
                            </button>
                          )}
                          {/* Edit */}
                          {(user.role !== 'owner' || user.id === currentUserId) && (
                            <button
                              onClick={() => handleOpenUserModal(user)}
                              className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {/* Delete - only for non-owners */}
                          {user.role !== 'owner' && (
                            <button
                              onClick={() => handleDelete(user)}
                              className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </section>

            {/* ============================================ */}
            {/* TERMINALS SECTION */}
            {/* ============================================ */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Monitor className="w-5 h-5" />
                    {t('Terminals', 'الأجهزة')}
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {t('POS and Kitchen Display screens - users login to these devices', 'شاشات نقطة البيع والمطبخ - يسجل المستخدمون الدخول إلى هذه الأجهزة')}
                  </p>
                </div>
                <button
                  onClick={() => handleOpenTerminalModal()}
                  disabled={!canAddUsers}
                  className={`inline-flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-xl font-medium transition-colors text-sm ${!canAddUsers ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Plus className="w-4 h-4" />
                  {t('Add Terminal', 'إضافة جهاز')}
                </button>
              </div>

              {terminals.length === 0 ? (
                <div className="p-8 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
                  <Monitor className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-600 mb-3" />
                  <p className="text-zinc-500 dark:text-zinc-400">
                    {t('No terminals yet. Add POS or Kitchen Display screens.', 'لا يوجد أجهزة. أضف شاشات نقطة البيع أو المطبخ.')}
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {terminals.map((terminal) => (
                    <motion.div
                      key={terminal.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            terminal.role === 'pos'
                              ? 'bg-emerald-100 dark:bg-emerald-900/30'
                              : 'bg-orange-100 dark:bg-orange-900/30'
                          }`}>
                            {terminal.role === 'pos'
                              ? <Monitor className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                              : <ChefHat className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                            }
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-zinc-900 dark:text-white">
                                {terminal.first_name || terminal.username}
                              </h3>
                              <span className={`text-xs px-2 py-0.5 rounded-full capitalize flex items-center gap-1 ${getRoleBadge(terminal.role)}`}>
                                {getRoleIcon(terminal.role)}
                                {t(
                                  terminal.role === 'pos' ? 'POS Terminal' : 'Kitchen Display',
                                  terminal.role === 'pos' ? 'نقطة بيع' : 'شاشة المطبخ'
                                )}
                              </span>
                              {terminal.status !== 'active' && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                  {t('Inactive', 'غير نشط')}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                              @{terminal.username}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Reset password */}
                          <button
                            onClick={() => handleResetPassword(terminal)}
                            className="p-2 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                            title={t('Reset Password', 'إعادة تعيين كلمة المرور')}
                          >
                            <Key className="w-4 h-4" />
                          </button>
                          {/* Edit */}
                          <button
                            onClick={() => handleOpenTerminalModal(terminal)}
                            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(terminal)}
                            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </motion.div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && handleCloseModal()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl max-h-[90vh] flex flex-col"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                  {modalMode === 'user'
                    ? (editingUser ? t('Edit User', 'تعديل المستخدم') : t('Add User', 'إضافة مستخدم'))
                    : (editingUser ? t('Edit Terminal', 'تعديل الجهاز') : t('Add Terminal', 'إضافة جهاز'))
                  }
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                    {error}
                  </div>
                )}

                {successMessage && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm">
                    {successMessage}
                  </div>
                )}

                {editingUser?.role === 'owner' && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
                    <Crown className="w-4 h-4" />
                    {t('Owner role and status cannot be changed', 'لا يمكن تغيير دور المالك أو حالته')}
                  </div>
                )}

                {/* Terminal info notice */}
                {modalMode === 'terminal' && (
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 text-sm flex items-center gap-2">
                    <Monitor className="w-4 h-4 flex-shrink-0" />
                    <span>
                      {t('Terminals are devices where users login. Actions are recorded by the logged-in user, not the terminal.', 'الأجهزة هي شاشات يسجل المستخدمون الدخول إليها. تُسجل العمليات باسم المستخدم المسجل، وليس الجهاز.')}
                    </span>
                  </div>
                )}

                {/* Username */}
                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {modalMode === 'terminal' ? t('Terminal ID', 'معرف الجهاز') : t('Username', 'اسم المستخدم')} *
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={modalMode === 'terminal' ? t('e.g., pos_main, kitchen_1', 'مثال: pos_main, kitchen_1') : t('e.g., john_doe', 'مثال: john_doe')}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  />
                </div>

                {/* Name fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                      {modalMode === 'terminal' ? t('Display Name', 'اسم العرض') : t('First Name', 'الاسم الأول')}
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder={modalMode === 'terminal' ? t('e.g., Main POS', 'مثال: نقطة البيع الرئيسية') : ''}
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    />
                  </div>
                  {modalMode === 'user' && (
                    <div>
                      <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                        {t('Last Name', 'الاسم الأخير')}
                      </label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                      />
                    </div>
                  )}
                  {modalMode === 'terminal' && editingUser && (
                    <SearchableSelect
                      label={t('Status', 'الحالة')}
                      value={status}
                      onChange={(val) => setStatus((val || 'active') as 'active' | 'inactive')}
                      options={[
                        { id: 'active', name: t('Active', 'نشط') },
                        { id: 'inactive', name: t('Inactive', 'غير نشط') },
                      ]}
                      placeholder={t('Select status', 'اختر الحالة')}
                    />
                  )}
                </div>

                {/* Role/Type selection */}
                {(!editingUser || editingUser.role !== 'owner') && (
                  <div className="grid grid-cols-2 gap-4">
                    {modalMode === 'user' ? (
                      <>
                        <SearchableSelect
                          label={`${t('Role', 'الدور')} *`}
                          value={role}
                          onChange={(val) => handleRoleChange((val || 'employee') as UserRole)}
                          options={[
                            { id: 'manager', name: t('Manager', 'مدير') },
                            { id: 'employee', name: t('Employee', 'موظف') },
                          ]}
                          placeholder={t('Select role', 'اختر الدور')}
                        />
                        {editingUser && (
                          <SearchableSelect
                            label={t('Status', 'الحالة')}
                            value={status}
                            onChange={(val) => setStatus((val || 'active') as 'active' | 'inactive')}
                            options={[
                              { id: 'active', name: t('Active', 'نشط') },
                              { id: 'inactive', name: t('Inactive', 'غير نشط') },
                            ]}
                            placeholder={t('Select status', 'اختر الحالة')}
                          />
                        )}
                      </>
                    ) : (
                      <SearchableSelect
                        label={`${t('Terminal Type', 'نوع الجهاز')} *`}
                        value={terminalType}
                        onChange={(val) => setTerminalType((val || 'pos') as TerminalType)}
                        options={[
                          { id: 'pos', name: t('POS Terminal', 'نقطة بيع') },
                          { id: 'kitchen_display', name: t('Kitchen Display', 'شاشة المطبخ') },
                        ]}
                        placeholder={t('Select type', 'اختر النوع')}
                      />
                    )}
                  </div>
                )}

                {/* Permissions Section - Only for Users (Manager/Employee) */}
                {modalMode === 'user' && (!editingUser || editingUser.role !== 'owner') && (
                  <div className="space-y-3">
                    <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <label className={`text-sm font-medium text-zinc-700 dark:text-zinc-300 ${isRTL ? 'text-right' : ''}`}>
                        {t('Permissions (for Business App)', 'الصلاحيات (لتطبيق الأعمال)')}
                      </label>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {role === 'manager' ? t('Manager defaults: All enabled', 'افتراضي المدير: الكل مفعل') : t('Employee defaults: All disabled', 'افتراضي الموظف: الكل معطل')}
                      </span>
                    </div>
                    <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 space-y-3">
                      {/* Orders */}
                      <label className={`flex items-center gap-3 cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <input
                          type="checkbox"
                          checked={permissions.orders}
                          onChange={() => handlePermissionToggle('orders')}
                          className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white focus:ring-zinc-500"
                        />
                        <div className={`flex-1 ${isRTL ? 'text-right' : ''}`}>
                          <span className="text-sm font-medium text-zinc-900 dark:text-white">{t('Orders', 'الطلبات')}</span>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('View and manage orders', 'عرض وإدارة الطلبات')}</p>
                        </div>
                      </label>

                      {/* Menu Edit */}
                      <label className={`flex items-center gap-3 cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <input
                          type="checkbox"
                          checked={permissions.menu_edit}
                          onChange={() => handlePermissionToggle('menu_edit')}
                          className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white focus:ring-zinc-500"
                        />
                        <div className={`flex-1 ${isRTL ? 'text-right' : ''}`}>
                          <span className="text-sm font-medium text-zinc-900 dark:text-white">{t('Menu Edit', 'تعديل القائمة')}</span>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('Items, Products, Bundles, Categories', 'المواد، المنتجات، الباقات، الفئات')}</p>
                        </div>
                      </label>

                      {/* Inventory */}
                      <label className={`flex items-center gap-3 cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <input
                          type="checkbox"
                          checked={permissions.inventory}
                          onChange={() => handlePermissionToggle('inventory')}
                          className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white focus:ring-zinc-500"
                        />
                        <div className={`flex-1 ${isRTL ? 'text-right' : ''}`}>
                          <span className="text-sm font-medium text-zinc-900 dark:text-white">{t('Inventory', 'المخزون')}</span>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('PO, Transfers, Vendors, Counts', 'أوامر الشراء، التحويلات، الموردين، الجرد')}</p>
                        </div>
                      </label>

                      {/* Delivery */}
                      <label className={`flex items-center gap-3 cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <input
                          type="checkbox"
                          checked={permissions.delivery}
                          onChange={() => handlePermissionToggle('delivery')}
                          className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white focus:ring-zinc-500"
                        />
                        <div className={`flex-1 ${isRTL ? 'text-right' : ''}`}>
                          <span className="text-sm font-medium text-zinc-900 dark:text-white">{t('Delivery', 'التوصيل')}</span>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('Delivery Partners', 'شركاء التوصيل')}</p>
                        </div>
                      </label>

                      {/* Tables */}
                      <label className={`flex items-center gap-3 cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <input
                          type="checkbox"
                          checked={permissions.tables}
                          onChange={() => handlePermissionToggle('tables')}
                          className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white focus:ring-zinc-500"
                        />
                        <div className={`flex-1 ${isRTL ? 'text-right' : ''}`}>
                          <span className="text-sm font-medium text-zinc-900 dark:text-white">{t('Tables', 'الطاولات')}</span>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('Table Management', 'إدارة الطاولات')}</p>
                        </div>
                      </label>

                      {/* Drivers */}
                      <label className={`flex items-center gap-3 cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <input
                          type="checkbox"
                          checked={permissions.drivers}
                          onChange={() => handlePermissionToggle('drivers')}
                          className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white focus:ring-zinc-500"
                        />
                        <div className={`flex-1 ${isRTL ? 'text-right' : ''}`}>
                          <span className="text-sm font-medium text-zinc-900 dark:text-white">{t('Drivers', 'السائقين')}</span>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('Driver Management', 'إدارة السائقين')}</p>
                        </div>
                      </label>

                      {/* Discounts */}
                      <label className={`flex items-center gap-3 cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <input
                          type="checkbox"
                          checked={permissions.discounts}
                          onChange={() => handlePermissionToggle('discounts')}
                          className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white focus:ring-zinc-500"
                        />
                        <div className={`flex-1 ${isRTL ? 'text-right' : ''}`}>
                          <span className="text-sm font-medium text-zinc-900 dark:text-white">{t('Discounts', 'الخصومات')}</span>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('Discount Management', 'إدارة الخصومات')}</p>
                        </div>
                      </label>

                      {/* POS Access */}
                      <label className={`flex items-center gap-3 cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <input
                          type="checkbox"
                          checked={permissions.pos_access ?? false}
                          onChange={() => handlePermissionToggle('pos_access')}
                          className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white focus:ring-zinc-500"
                        />
                        <div className={`flex-1 ${isRTL ? 'text-right' : ''}`}>
                          <span className="text-sm font-medium text-zinc-900 dark:text-white">{t('POS Access', 'الوصول لنقطة البيع')}</span>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('Can login to POS Terminal with PIN', 'يمكنه تسجيل الدخول لجهاز نقطة البيع برمز PIN')}</p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* User contact info - only for users */}
                {modalMode === 'user' && (
                  <>
                    <div>
                      <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                        {t('Email', 'البريد الإلكتروني')}
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                      />
                    </div>

                    <div>
                      <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                        {t('Phone', 'الهاتف')}
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                      />
                    </div>
                  </>
                )}

                {!editingUser && (
                  <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm text-zinc-600 dark:text-zinc-400">
                    {t('Default password will be: ', 'كلمة المرور الافتراضية ستكون: ')}
                    <code className="font-mono bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded">90074007</code>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 rounded-b-2xl">
                <button
                  onClick={handleCloseModal}
                  className="px-5 py-2.5 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-medium transition-colors"
                >
                  {t('Cancel', 'إلغاء')}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !!successMessage}
                  className="px-6 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting
                    ? t('Saving...', 'جاري الحفظ...')
                    : editingUser
                      ? t('Update', 'تحديث')
                      : t('Create', 'إنشاء')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageLayout>
  );
}
