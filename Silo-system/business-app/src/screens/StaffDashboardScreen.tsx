import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import { dataPreloader } from '../services/DataPreloader';
import { useLocalization } from '../localization/LocalizationContext';
import { 
  Clock,
  LogIn,
  LogOut,
  BookOpen,
  CalendarDays,
  Receipt,
  GraduationCap,
  FileText,
  ChevronRight,
  User,
  CheckCircle2,
  Circle,
  ShoppingBag,
  Package,
  ClipboardList,
  Truck,
  Armchair,
  Car,
  Percent,
  Bell,
  FolderTree,
  Boxes,
  Command
} from 'lucide-react-native';

interface Task {
  id: number;
  title: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  dueTime?: string;
}

interface UserPermissions {
  orders?: boolean;
  menu_edit?: boolean;
  inventory?: boolean;
  delivery?: boolean;
  tables?: boolean;
  drivers?: boolean;
  discounts?: boolean;
  pos_access?: boolean;
}

interface UserData {
  name?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  role: string;
  permissions?: UserPermissions;
}

export default function StaffDashboardScreen({ navigation }: any) {
  const { t, isRTL } = useLocalization();
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState<string>('employee');
  const [permissions, setPermissions] = useState<UserPermissions>({});
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  
  // Sample tasks - in production these would come from the API
  const [tasks] = useState<Task[]>([
    { id: 1, title: 'Complete opening checklist', priority: 'high', completed: false, dueTime: '9:00 AM' },
    { id: 2, title: 'Restock condiments station', priority: 'medium', completed: false, dueTime: '11:00 AM' },
    { id: 3, title: 'Clean prep area', priority: 'low', completed: true },
  ]);

  useEffect(() => {
    loadUserData();
    
    // Prefetch management screens data in background for instant navigation
    dataPreloader.prefetch([
      'Orders', 'Items', 'Products', 'Inventory',
      'DeliveryPartners', 'Tables', 'Drivers', 'Discounts'
    ]).catch(() => {});
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user: UserData = JSON.parse(userData);
        const displayName = user.first_name 
          ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
          : user.name || user.username || 'Staff';
        setUserName(displayName);
        setUserRole(user.role || 'employee');
        setPermissions(user.permissions || {});
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    navigation.replace('Login');
  };

  const handlePunchIn = () => {
    const now = new Date();
    setClockInTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    setIsClockedIn(true);
    // TODO: API call to record punch-in
  };

  const handlePunchOut = () => {
    setIsClockedIn(false);
    setClockInTime(null);
    // TODO: API call to record punch-out
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return colors.foreground;
      case 'medium': return colors.mutedForeground;
      case 'low': return colors.border;
      default: return colors.mutedForeground;
    }
  };

  const MenuItem = ({ icon: Icon, title, subtitle, onPress, isLast }: any) => (
    <TouchableOpacity 
      style={[styles.menuItem, isLast && styles.menuItemLast, isRTL && styles.rtlRow]} 
      onPress={onPress} 
      activeOpacity={0.7}
    >
      {isRTL ? (
        <>
          <View style={[styles.menuIconContainer, { marginRight: 0, marginLeft: 14 }]}>
            <Icon size={20} color={colors.foreground} />
          </View>
          <View style={[styles.menuTextContainer, { alignItems: 'flex-end' }]}>
            <Text style={[styles.menuTitle, styles.rtlText]}>{title}</Text>
            {subtitle && <Text style={[styles.menuSubtitle, styles.rtlText]}>{subtitle}</Text>}
          </View>
          <ChevronRight size={16} color={colors.mutedForeground} style={{ transform: [{ rotate: '180deg' }] }} />
        </>
      ) : (
        <>
          <View style={styles.menuIconContainer}>
            <Icon size={20} color={colors.foreground} />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>{title}</Text>
            {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
          </View>
          <ChevronRight size={16} color={colors.mutedForeground} />
        </>
      )}
    </TouchableOpacity>
  );

  const incompleteTasks = tasks.filter(t => !t.completed).length;
  const isManager = userRole === 'manager' || userRole === 'operations_manager';

  // Check if user has any operation management permissions
  const hasAnyOperationPermission = 
    permissions.orders || 
    permissions.menu_edit || 
    permissions.inventory || 
    permissions.delivery || 
    permissions.tables || 
    permissions.drivers || 
    permissions.discounts;

  const workspaceLabel = isManager ? t('managerWorkspace') : t('staffWorkspace');

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          {/* Top row: Logo + Actions */}
          <View style={[styles.headerTop, isRTL && styles.rtlRow]}>
            {/* Logo + Brand name on leading side */}
            <View style={[styles.logoSection, isRTL && styles.rtlRow]}>
              <View style={styles.logoContainer}>
                <Command size={28} color={colors.foreground} />
              </View>
              <Text style={[styles.brandName, isRTL && { marginLeft: 0, marginRight: 10 }]}>Sylo</Text>
            </View>
            
            {/* Actions on trailing side */}
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.iconButton}>
                <Bell size={20} color={colors.foreground} />
                <View style={styles.badge} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconButton, styles.logoutButton]} onPress={handleLogout}>
                <LogOut size={20} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Workspace info row */}
          <View style={[styles.workspaceSwitcher, isRTL && styles.rtlRow]}>
            <View style={[styles.workspaceInfo, isRTL && { alignItems: 'flex-end' }]}>
              <Text style={[styles.headerBrand, isRTL && styles.rtlText]} numberOfLines={1}>
                {userName}
              </Text>
              <Text style={[styles.headerRole, isRTL && styles.rtlText]}>{workspaceLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
        {/* Time Clock Card */}
        <View style={styles.clockCard}>
          <View style={[styles.clockHeader, isRTL && styles.rtlRow]}>
            <Clock size={20} color={colors.foreground} />
            <Text style={[styles.clockTitle, isRTL && { marginLeft: 0, marginRight: 10 }]}>{t('timeClock')}</Text>
          </View>
          
          {isClockedIn ? (
            <View style={[styles.clockedInContainer, isRTL && styles.rtlRow]}>
              <View style={[styles.clockedInInfo, isRTL && { alignItems: 'flex-end' }]}>
                <View style={[styles.statusBadge, isRTL && styles.rtlRow]}>
                  <View style={[styles.statusDot, isRTL && { marginRight: 0, marginLeft: 8 }]} />
                  <Text style={styles.statusText}>{t('clockedIn')}</Text>
                </View>
                <Text style={[styles.clockedInTime, isRTL && styles.rtlText]}>{t('since')} {clockInTime}</Text>
              </View>
              <TouchableOpacity 
                style={[styles.punchButton, styles.punchOutButton]} 
                onPress={handlePunchOut}
              >
                <LogOut size={18} color={colors.background} />
                <Text style={styles.punchButtonText}>{t('punchOut')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.punchButton, styles.punchInButton]} 
              onPress={handlePunchIn}
            >
              <LogIn size={18} color={colors.background} />
              <Text style={styles.punchButtonText}>{t('punchIn')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Assigned Tasks */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, isRTL && styles.rtlRow]}>
            <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>{t('assignedTasks')}</Text>
            {incompleteTasks > 0 && (
              <View style={styles.taskBadge}>
                <Text style={styles.taskBadgeText}>{incompleteTasks}</Text>
              </View>
            )}
          </View>
          <View style={styles.card}>
            {tasks.map((task, index) => (
              <View key={task.id}>
                <TouchableOpacity style={[styles.taskItem, isRTL && styles.rtlRow]} activeOpacity={0.7}>
                  {task.completed ? (
                    <CheckCircle2 size={20} color={colors.foreground} />
                  ) : (
                    <Circle size={20} color={colors.mutedForeground} />
                  )}
                  <View style={[styles.taskContent, isRTL && { alignItems: 'flex-end' }]}>
                    <Text style={[
                      styles.taskTitle,
                      task.completed && styles.taskCompleted,
                      isRTL && styles.rtlText
                    ]}>
                      {task.title}
                    </Text>
                    {task.dueTime && !task.completed && (
                      <Text style={[styles.taskDueTime, isRTL && styles.rtlText]}>{t('due')}: {task.dueTime}</Text>
                    )}
                  </View>
                  {!task.completed && (
                    <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(task.priority) }]} />
                  )}
                </TouchableOpacity>
                {index < tasks.length - 1 && <View style={[styles.divider, isRTL && { marginLeft: 0, marginRight: 70 }]} />}
              </View>
            ))}
            <TouchableOpacity style={[styles.viewAllButton, isRTL && styles.rtlRow]}>
              <Text style={styles.viewAllText}>{t('viewAllTasks')}</Text>
              <ChevronRight size={16} color={colors.foreground} style={isRTL ? { transform: [{ rotate: '180deg' }] } : undefined} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Operation Management - Only show if user has any permissions */}
        {hasAnyOperationPermission && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>{t('operationManagement')}</Text>
            <View style={styles.card}>
              {permissions.orders && (
                <>
                  <MenuItem 
                    icon={ShoppingBag} 
                    title={t('orders')} 
                    subtitle={t('manageOrders')}
                    onPress={() => navigation.navigate('Orders')}
                  />
                  <View style={[styles.divider, isRTL && { marginLeft: 0, marginRight: 70 }]} />
                </>
              )}
              {permissions.menu_edit && (
                <>
                  <MenuItem 
                    icon={Package} 
                    title={t('items')} 
                    subtitle={t('rawAndCompositeItems')}
                    onPress={() => navigation.navigate('Items')}
                  />
                  <View style={[styles.divider, isRTL && { marginLeft: 0, marginRight: 70 }]} />
                  <MenuItem 
                    icon={ShoppingBag} 
                    title={t('products')} 
                    subtitle={t('menuProducts')}
                    onPress={() => navigation.navigate('Products')}
                  />
                  <View style={[styles.divider, isRTL && { marginLeft: 0, marginRight: 70 }]} />
                  <MenuItem 
                    icon={Boxes} 
                    title={t('bundles')} 
                    subtitle={t('productBundlesSoldTogether')}
                    onPress={() => navigation.navigate('Bundles')}
                  />
                  <View style={[styles.divider, isRTL && { marginLeft: 0, marginRight: 70 }]} />
                  <MenuItem 
                    icon={FolderTree} 
                    title={t('categories')} 
                    subtitle={t('organizeMenuStructure')}
                    onPress={() => navigation.navigate('Categories')}
                  />
                  <View style={[styles.divider, isRTL && { marginLeft: 0, marginRight: 70 }]} />
                </>
              )}
              {permissions.inventory && (
                <>
                  <MenuItem 
                    icon={ClipboardList} 
                    title={t('inventory')} 
                    subtitle={t('manageInventory')}
                    onPress={() => navigation.navigate('Inventory')}
                  />
                  <View style={[styles.divider, isRTL && { marginLeft: 0, marginRight: 70 }]} />
                </>
              )}
              {permissions.delivery && (
                <>
                  <MenuItem 
                    icon={Truck} 
                    title={t('delivery')} 
                    subtitle={t('deliveryManagement')}
                    onPress={() => navigation.navigate('DeliveryPartners')}
                  />
                  <View style={[styles.divider, isRTL && { marginLeft: 0, marginRight: 70 }]} />
                </>
              )}
              {permissions.tables && (
                <>
                  <MenuItem 
                    icon={Armchair} 
                    title={t('tables')} 
                    subtitle={t('tableManagement')}
                    onPress={() => navigation.navigate('Tables')}
                  />
                  <View style={[styles.divider, isRTL && { marginLeft: 0, marginRight: 70 }]} />
                </>
              )}
              {permissions.drivers && (
                <>
                  <MenuItem 
                    icon={Car} 
                    title={t('drivers')} 
                    subtitle={t('driverManagement')}
                    onPress={() => navigation.navigate('Drivers')}
                  />
                  <View style={[styles.divider, isRTL && { marginLeft: 0, marginRight: 70 }]} />
                </>
              )}
              {permissions.discounts && (
                <MenuItem 
                  icon={Percent} 
                  title={t('discounts')} 
                  subtitle={t('discountManagement')}
                  onPress={() => navigation.navigate('Discounts')}
                  isLast
                />
              )}
            </View>
          </View>
        )}

        {/* HR Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>{t('hr')}</Text>
          <View style={styles.card}>
            <MenuItem 
              icon={BookOpen} 
              title={t('sop')} 
              subtitle={t('standardOperatingProcedures')}
            />
            <View style={[styles.divider, isRTL && { marginLeft: 0, marginRight: 70 }]} />
            <MenuItem 
              icon={CalendarDays} 
              title={t('leaves')} 
              subtitle={t('requestViewLeaves')}
            />
            <View style={[styles.divider, isRTL && { marginLeft: 0, marginRight: 70 }]} />
            <MenuItem 
              icon={Receipt} 
              title={t('payslip')} 
              subtitle={t('viewPayslips')}
              isLast
            />
          </View>
        </View>

        {/* Training Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>{t('training')}</Text>
          <View style={styles.card}>
            <MenuItem 
              icon={GraduationCap} 
              title={t('trainingModules')} 
              subtitle={t('completeYourTraining')}
            />
            <View style={[styles.divider, isRTL && { marginLeft: 0, marginRight: 70 }]} />
            <MenuItem 
              icon={FileText} 
              title={t('certifications')} 
              subtitle={t('viewCertificates')}
              isLast
            />
          </View>
        </View>

          {/* Bottom spacing */}
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.foreground,
    marginLeft: 10,
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.destructive,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  workspaceSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  workspaceInfo: {
    flex: 1,
  },
  headerBrand: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  headerRole: {
    fontSize: 12,
    color: colors.mutedForeground,
    fontWeight: '500',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  clockCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  clockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  clockTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginLeft: 10,
  },
  clockedInContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clockedInInfo: {
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  clockedInTime: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  punchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  punchInButton: {
    backgroundColor: colors.foreground,
  },
  punchOutButton: {
    backgroundColor: colors.mutedForeground,
  },
  punchButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.background,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 4,
    marginBottom: 12,
  },
  sectionTitleRTL: {
    textAlign: 'right',
    marginLeft: 0,
    marginRight: 4,
  },
  taskBadge: {
    backgroundColor: colors.foreground,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  taskBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.background,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.foreground,
  },
  taskCompleted: {
    textDecorationLine: 'line-through',
    color: colors.mutedForeground,
  },
  taskDueTime: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 3,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.card,
  },
  menuItemLast: {},
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.foreground,
  },
  menuSubtitle: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 70,
  },
  // RTL styles
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  rtlText: {
    textAlign: 'right',
  },
});

