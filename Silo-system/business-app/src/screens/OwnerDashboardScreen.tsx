import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Modal, Alert, RefreshControl, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, ThemeColors } from '../theme/ThemeContext';
import api from '../api/client';
import { dataPreloader } from '../services/DataPreloader';
import { useLocalization } from '../localization/LocalizationContext';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  ClipboardList,
  Users,
  BarChart3,
  Settings,
  LogOut,
  ChevronRight,
  ChevronDown,
  Bell,
  Building2,
  Check,
  Layers,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  MapPin,
  FileText,
  Command,
  FolderTree,
  Boxes,
  Armchair,
  Car,
  Truck,
  Percent,
  Moon,
  Sun
} from 'lucide-react-native';

interface Branch {
  id: number;
  name: string;
  is_main: boolean;
  is_active: boolean;
}

interface Business {
  id: number;
  name: string;
  slug: string;
  currency?: string;
  branches?: Branch[];
}

interface DashboardStats {
  ordersToday: number;
  activeOrders: number;
  completedToday: number;
  totalRevenue: number;
  lowStockItems: number;
  currency: string;
}

type TimePeriod = 'today' | 'week' | 'month' | 'year' | 'all';

// Skeleton component for loading states
const Skeleton = ({ width, height, borderRadius = 8, style, colors }: { width: number | string; height: number; borderRadius?: number; style?: any; colors: ThemeColors }) => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.border,
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
};

// Skeleton stat card
const StatCardSkeleton = ({ isRTL, colors }: { isRTL: boolean; colors: ThemeColors }) => {
  const skeletonStyles = createSkeletonStyles(colors);
  return (
    <View style={[skeletonStyles.statCard, isRTL && skeletonStyles.statCardRTL]}>
      <Skeleton width={40} height={40} borderRadius={10} style={{ marginBottom: 12, alignSelf: isRTL ? 'flex-end' : 'flex-start' }} colors={colors} />
      <Skeleton width={80} height={28} borderRadius={6} style={{ marginBottom: 8, alignSelf: isRTL ? 'flex-end' : 'flex-start' }} colors={colors} />
      <Skeleton width={60} height={14} borderRadius={4} style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }} colors={colors} />
    </View>
  );
};

const createSkeletonStyles = (colors: ThemeColors) => StyleSheet.create({
  statCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    width: '48%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statCardRTL: {
    alignItems: 'flex-end',
  },
});

export default function OwnerDashboardScreen({ navigation }: any) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { t, isRTL, formatCurrency } = useLocalization();
  const styles = createStyles(colors);

  // Time periods with translations
  const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
    { value: 'today', label: t('today') },
    { value: 'week', label: t('thisWeek') },
    { value: 'month', label: t('thisMonth') },
    { value: 'year', label: t('thisYear') },
    { value: 'all', label: t('allTime') },
  ];
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [showBusinessPicker, setShowBusinessPicker] = useState(false);
  const [isAllWorkspaces, setIsAllWorkspaces] = useState(false);
  const [isAllBranches, setIsAllBranches] = useState(true); // View all branches of a business
  const [expandedBusinessId, setExpandedBusinessId] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('today');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const filterScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadBusinessData();

    // Prefetch management screens data in background for instant navigation
    dataPreloader.prefetch([
      'Items', 'Products', 'Orders', 'Inventory',
      'Categories', 'Bundles', 'StaffManagement',
      'DeliveryPartners', 'Tables', 'Drivers', 'Discounts'
    ]).catch(() => {});

    // Refresh data when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      loadBusinessData();
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (currentBusiness || isAllWorkspaces) {
      fetchDashboardStats();
    }
  }, [currentBusiness, isAllWorkspaces, selectedPeriod]);

  const loadBusinessData = async () => {
    try {
      const businessStr = await AsyncStorage.getItem('business');
      const businessesStr = await AsyncStorage.getItem('businesses');
      const branchStr = await AsyncStorage.getItem('branch');

      if (businessStr) {
        setCurrentBusiness(JSON.parse(businessStr));
      }
      if (branchStr) {
        const branch = JSON.parse(branchStr);
        setCurrentBranch(branch);
        setIsAllBranches(false);
      }
      if (businessesStr) {
        const businessList = JSON.parse(businessesStr);
        // Fetch branches for each business
        const businessesWithBranches = await Promise.all(
          businessList.map(async (business: Business) => {
            try {
              const response = await api.get(`/businesses/${business.id}/branches`);
              return {
                ...business,
                branches: response.data.branches || []
              };
            } catch (err) {
              return { ...business, branches: [] };
            }
          })
        );
        setBusinesses(businessesWithBranches);
      }
    } catch (error) {
      console.error('Error loading business data:', error);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const response = await api.get('/analytics/dashboard', {
        params: {
          period: selectedPeriod,
          combined: isAllWorkspaces ? 'true' : 'false',
        },
      });

      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardStats();
  }, [selectedPeriod, isAllWorkspaces]);

  const switchBusiness = async (business: Business | null, branch: Branch | null = null, allBranches: boolean = true) => {
    try {
      if (business === null) {
        // Switch to "All Workspaces" mode
        setIsAllWorkspaces(true);
        setCurrentBusiness(null);
        setCurrentBranch(null);
        setIsAllBranches(true);
        await AsyncStorage.removeItem('business');
        await AsyncStorage.removeItem('branch');
      } else {
        setIsAllWorkspaces(false);
        await AsyncStorage.setItem('business', JSON.stringify(business));
        setCurrentBusiness(business);

        if (allBranches) {
          // View all branches of this business
          setIsAllBranches(true);
          setCurrentBranch(null);
          await AsyncStorage.removeItem('branch');
        } else if (branch) {
          // View specific branch
          setIsAllBranches(false);
          setCurrentBranch(branch);
          await AsyncStorage.setItem('branch', JSON.stringify(branch));
        }
      }
      setShowBusinessPicker(false);
      setExpandedBusinessId(null);
      setLoading(true);
    } catch (error) {
      console.error('Error switching business:', error);
    }
  };

  const toggleBusinessExpand = (businessId: number) => {
    setExpandedBusinessId(expandedBusinessId === businessId ? null : businessId);
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    navigation.replace('Login');
  };

  const getPeriodLabel = () => {
    const period = TIME_PERIODS.find(p => p.value === selectedPeriod);
    return period?.label || 'Today';
  };

  const MenuItem = ({ icon: Icon, title, subtitle, isLast, onPress }: any) => (
    <TouchableOpacity style={[styles.menuItem, isLast && styles.menuItemLast, isRTL && styles.rtlRow]} onPress={onPress}>
      {/* With row-reverse: first element goes RIGHT, last element goes LEFT */}
      {/* RTL visual: Icon (right) -> Text -> Arrow (left) */}
      {/* LTR visual: Icon (left) -> Text -> Arrow (right) */}
      {isRTL ? (
        <>
          <View style={[styles.menuIconContainer, { marginRight: 0, marginLeft: 16 }]}>
            <Icon size={22} color={colors.foreground} />
          </View>
          <View style={[styles.menuTextContainer, { alignItems: 'flex-end' }]}>
            <Text style={[styles.menuTitle, styles.rtlText]}>{title}</Text>
            {subtitle && <Text style={[styles.menuSubtitle, styles.rtlText]}>{subtitle}</Text>}
          </View>
          <View style={styles.menuArrowContainer}>
            <ChevronRight size={18} color={colors.mutedForeground} style={{ transform: [{ rotate: '180deg' }] }} />
          </View>
        </>
      ) : (
        <>
          <View style={styles.menuIconContainer}>
            <Icon size={22} color={colors.foreground} />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuTitle}>{title}</Text>
            {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
          </View>
          <View style={styles.menuArrowContainer}>
            <ChevronRight size={18} color={colors.mutedForeground} />
          </View>
        </>
      )}
    </TouchableOpacity>
  );

  const StatCard = ({ icon: Icon, title, value, subtitle, color }: any) => (
    <View style={[styles.statCard, isRTL && styles.statCardRTL]}>
      <View style={[styles.statIconContainer, { backgroundColor: `${color}15` }, isRTL && { alignSelf: 'flex-end' }]}>
        <Icon size={20} color={color} />
      </View>
      <Text style={[styles.statValue, isRTL && styles.rtlText]}>{value}</Text>
      <Text style={[styles.statTitle, isRTL && styles.rtlText]}>{title}</Text>
      {subtitle && <Text style={[styles.statSubtitle, isRTL && styles.rtlText]}>{subtitle}</Text>}
    </View>
  );

  const displayName = isAllWorkspaces
    ? t('allWorkspaces')
    : currentBranch
      ? `${currentBusiness?.name} - ${currentBranch.name}`
      : (currentBusiness?.name || 'Silo Business');

  const displaySubtitle = isAllWorkspaces
    ? 'Combined View'
    : currentBranch
      ? 'Branch View'
      : 'All Branches';

  return (
    <View style={styles.container}>
      {/* Business Picker Modal */}
      <Modal
        visible={showBusinessPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBusinessPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowBusinessPicker(false)}
        >
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>{t('selectWorkspace')}</Text>

            {/* All Workspaces Option */}
            {businesses.length > 1 && (
              <TouchableOpacity
                style={[
                  styles.businessOption,
                  isAllWorkspaces && styles.businessOptionActive,
                  isRTL && styles.rtlRow
                ]}
                onPress={() => switchBusiness(null)}
              >
                <Layers size={20} color={isAllWorkspaces ? colors.primary : colors.mutedForeground} />
                <Text style={[
                  styles.businessOptionText,
                  isAllWorkspaces && styles.businessOptionTextActive,
                  isRTL && styles.rtlText
                ]}>
                  {t('allWorkspaces')}
                </Text>
                {isAllWorkspaces && (
                  <Check size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}

            {/* Individual Businesses with Branches */}
            <ScrollView style={styles.businessList} showsVerticalScrollIndicator={false}>
              {businesses.map((business) => (
                <View key={business.id}>
                  {/* Business Header - Click to expand */}
                  <TouchableOpacity
                    style={[
                      styles.businessOption,
                      !isAllWorkspaces && currentBusiness?.id === business.id && isAllBranches && styles.businessOptionActive
                    ]}
                    onPress={() => {
                      if (business.branches && business.branches.length > 0) {
                        toggleBusinessExpand(business.id);
                      } else {
                        switchBusiness(business, null, true);
                      }
                    }}
                    onLongPress={() => switchBusiness(business, null, true)}
                  >
                    <Building2 size={20} color={!isAllWorkspaces && currentBusiness?.id === business.id ? colors.primary : colors.mutedForeground} />
                    <Text style={[
                      styles.businessOptionText,
                      !isAllWorkspaces && currentBusiness?.id === business.id && styles.businessOptionTextActive
                    ]}>
                      {business.name}
                    </Text>
                    {business.branches && business.branches.length > 0 && (
                      <View style={styles.expandIcon}>
                        {expandedBusinessId === business.id ? (
                          <ChevronDown size={18} color={colors.mutedForeground} />
                        ) : (
                          <ChevronRight size={18} color={colors.mutedForeground} />
                        )}
                      </View>
                    )}
                    {!isAllWorkspaces && currentBusiness?.id === business.id && isAllBranches && (
                      <Check size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>

                  {/* Expanded Branches */}
                  {expandedBusinessId === business.id && business.branches && (
                    <View style={styles.branchesContainer}>
                      {/* All Branches Option */}
                      <TouchableOpacity
                        style={[
                          styles.branchOption,
                          !isAllWorkspaces && currentBusiness?.id === business.id && isAllBranches && styles.branchOptionActive,
                          isRTL && styles.rtlRow
                        ]}
                        onPress={() => switchBusiness(business, null, true)}
                      >
                        <Layers size={16} color={!isAllWorkspaces && currentBusiness?.id === business.id && isAllBranches ? colors.primary : colors.mutedForeground} />
                        <Text style={[
                          styles.branchOptionText,
                          !isAllWorkspaces && currentBusiness?.id === business.id && isAllBranches && styles.branchOptionTextActive,
                          isRTL && styles.rtlText
                        ]}>
                          {t('allBranches')}
                        </Text>
                        {!isAllWorkspaces && currentBusiness?.id === business.id && isAllBranches && (
                          <Check size={16} color={colors.primary} />
                        )}
                      </TouchableOpacity>

                      {/* Individual Branches */}
                      {business.branches.filter(b => b.is_active).map((branch) => (
                        <TouchableOpacity
                          key={branch.id}
                          style={[
                            styles.branchOption,
                            !isAllWorkspaces && currentBusiness?.id === business.id && currentBranch?.id === branch.id && styles.branchOptionActive,
                            isRTL && styles.rtlRow
                          ]}
                          onPress={() => switchBusiness(business, branch, false)}
                        >
                          <MapPin size={16} color={currentBranch?.id === branch.id ? colors.primary : colors.mutedForeground} />
                          <View style={[styles.branchTextContainer, isRTL && { alignItems: 'flex-end' }]}>
                            <Text style={[
                              styles.branchOptionText,
                              currentBranch?.id === branch.id && styles.branchOptionTextActive,
                              isRTL && styles.rtlText
                            ]}>
                              {branch.name}
                            </Text>
                            {branch.is_main && (
                              <View style={styles.mainBadge}>
                                <Text style={styles.mainBadgeText}>{t('mainBranch')}</Text>
                              </View>
                            )}
                          </View>
                          {!isAllWorkspaces && currentBranch?.id === branch.id && (
                            <Check size={16} color={colors.primary} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
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
              <TouchableOpacity style={styles.iconButton} onPress={toggleTheme}>
                {isDark ? (
                  <Sun size={20} color={colors.foreground} />
                ) : (
                  <Moon size={20} color={colors.foreground} />
                )}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconButton, styles.logoutButton]} onPress={handleLogout}>
                <LogOut size={20} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Workspace switcher row */}
          <TouchableOpacity
            style={[styles.workspaceSwitcher, isRTL && styles.rtlRow]}
            onPress={() => businesses.length > 0 && setShowBusinessPicker(true)}
            activeOpacity={businesses.length > 0 ? 0.7 : 1}
          >
            <View style={[styles.workspaceInfo, isRTL && { alignItems: 'flex-end' }]}>
              <Text
                style={[styles.headerBrand, isRTL && styles.rtlText]}
                numberOfLines={1}
              >
                {displayName}
              </Text>
              <Text style={[styles.headerRole, isRTL && styles.rtlText]}>{t('ownerWorkspace')}</Text>
            </View>
            {businesses.length > 1 && (
              <View style={[styles.switchBadge, isAllWorkspaces && styles.switchBadgeAll]}>
                <Text style={styles.switchBadgeText}>{isAllWorkspaces ? t('combined') : t('switch')}</Text>
                <ChevronDown size={12} color={colors.primaryForeground} style={{ marginLeft: 2 }} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
        {/* Time Period Filter */}
        <ScrollView
          ref={filterScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={[styles.filterContainer, isRTL && styles.filterContainerRTL]}
          onContentSizeChange={(contentWidth) => {
            // In RTL, scroll to the right end so "Today" is visible first
            if (isRTL && filterScrollRef.current) {
              filterScrollRef.current.scrollToEnd({ animated: false });
            }
          }}
        >
          {TIME_PERIODS.map((period) => (
            <TouchableOpacity
              key={period.value}
              style={[
                styles.filterChip,
                selectedPeriod === period.value && styles.filterChipActive
              ]}
              onPress={() => {
                setSelectedPeriod(period.value);
                setLoading(true);
              }}
            >
              <Text style={[
                styles.filterChipText,
                selectedPeriod === period.value && styles.filterChipTextActive
              ]}>
                {period.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Stats Grid */}
        {loading ? (
          <View style={styles.statsGrid}>
            <StatCardSkeleton isRTL={isRTL} colors={colors} />
            <StatCardSkeleton isRTL={isRTL} colors={colors} />
            <StatCardSkeleton isRTL={isRTL} colors={colors} />
            <StatCardSkeleton isRTL={isRTL} colors={colors} />
          </View>
        ) : stats ? (
          <>
            <View style={styles.statsGrid}>
              <StatCard
                icon={ShoppingBag}
                title={t('orders')}
                value={stats.ordersToday}
                subtitle={t('today')}
                color="#3b82f6"
              />
              <StatCard
                icon={Clock}
                title={t('activeNow')}
                value={stats.activeOrders}
                subtitle={t('inProgress')}
                color="#f59e0b"
              />
              <StatCard
                icon={CheckCircle}
                title={t('completed')}
                value={stats.completedToday}
                subtitle={t('today')}
                color="#22c55e"
              />
              <StatCard
                icon={TrendingUp}
                title={t('revenue')}
                value={formatCurrency(stats.totalRevenue, stats.currency)}
                subtitle={t('today')}
                color="#8b5cf6"
              />
            </View>

            {/* Low Stock Alert */}
            {stats.lowStockItems > 0 && (
              <View style={[styles.alertCard, isRTL && styles.rtlRow]}>
                <View style={styles.alertIconContainer}>
                  <AlertTriangle size={20} color="#ef4444" />
                </View>
                <View style={[styles.alertTextContainer, isRTL && { alignItems: 'flex-end' }]}>
                  <Text style={[styles.alertTitle, isRTL && styles.rtlText]}>{t('lowStock')}</Text>
                  <Text style={[styles.alertSubtitle, isRTL && styles.rtlText]}>{stats.lowStockItems} {t('items')}</Text>
                </View>
                <ChevronRight size={18} color={colors.mutedForeground} style={isRTL ? { transform: [{ rotate: '180deg' }] } : undefined} />
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('loading')}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>{t('overview')}</Text>
          <View style={styles.card}>
            <MenuItem
              icon={LayoutDashboard}
              title={t('dashboardAnalytics')}
              subtitle={t('realtimeInsights')}
            />
            <View style={styles.divider} />
            <MenuItem
              icon={BarChart3}
              title={t('reports')}
              subtitle={t('salesPerformance')}
              isLast
            />
          </View>
        </View>

        {/* Operation Management - Same as StaffDashboardScreen but without permission restrictions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>{t('operationManagement')}</Text>
          <View style={styles.card}>
            <MenuItem
              icon={ShoppingBag}
              title={t('orders')}
              subtitle={t('manageOrders')}
              onPress={() => navigation.navigate('Orders')}
            />
            <View style={[styles.divider, isRTL && { marginLeft: 0, marginRight: 70 }]} />
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
            <MenuItem
              icon={ClipboardList}
              title={t('inventory')}
              subtitle={t('manageInventory')}
              onPress={() => navigation.navigate('Inventory')}
            />
            <View style={[styles.divider, isRTL && { marginLeft: 0, marginRight: 70 }]} />
            <MenuItem
              icon={Truck}
              title={t('delivery')}
              subtitle={t('deliveryManagement')}
              onPress={() => navigation.navigate('DeliveryPartners')}
            />
            <View style={[styles.divider, isRTL && { marginLeft: 0, marginRight: 70 }]} />
            <MenuItem
              icon={Armchair}
              title={t('tables')}
              subtitle={t('tableManagement')}
              onPress={() => navigation.navigate('Tables')}
            />
            <View style={[styles.divider, isRTL && { marginLeft: 0, marginRight: 70 }]} />
            <MenuItem
              icon={Car}
              title={t('drivers')}
              subtitle={t('driverManagement')}
              onPress={() => navigation.navigate('Drivers')}
            />
            <View style={[styles.divider, isRTL && { marginLeft: 0, marginRight: 70 }]} />
            <MenuItem
              icon={Percent}
              title={t('discounts')}
              subtitle={t('discountManagement')}
              onPress={() => navigation.navigate('Discounts')}
              isLast
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>{t('staffAndSettings')}</Text>
          <View style={styles.card}>
            <MenuItem icon={Users} title={t('staffManagement')} subtitle={t('rolesPermissions')} onPress={() => navigation.navigate('StaffManagement')} />
            <View style={styles.divider} />
            <MenuItem icon={Settings} title={t('systemSettings')} subtitle={t('configureYourBusiness')} onPress={() => navigation.navigate('Settings')} />
            <View style={styles.divider} />
            <MenuItem icon={FileText} title={t('myRequests')} subtitle={t('trackChangeRequests')} isLast onPress={() => navigation.navigate('Requests')} />
          </View>
        </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('appVersion')}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
  scrollView: {
    flex: 1,
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
  switchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 12,
  },
  switchBadgeAll: {
    backgroundColor: '#8b5cf6',
  },
  switchBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryForeground,
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
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  scrollContent: {
  },
  // Filter styles
  filterScroll: {
    marginBottom: 24,
    marginHorizontal: -24,
  },
  filterContainer: {
    paddingHorizontal: 24,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  filterChipTextActive: {
    color: colors.background,
  },
  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    width: '48%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  statSubtitle: {
    fontSize: 11,
    color: colors.mutedForeground,
    opacity: 0.7,
    marginTop: 2,
  },
  // Alert card
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  alertIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  alertTextContainer: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 2,
  },
  alertSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  // Sections
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.mutedForeground,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.card,
  },
  menuItemLast: {},
  menuIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
    fontWeight: '400',
  },
  menuArrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 80,
  },
  footer: {
    alignItems: 'center',
    marginTop: 10,
  },
  footerText: {
    fontSize: 12,
    color: colors.mutedForeground,
    opacity: 0.5,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 16,
    textAlign: 'center',
  },
  businessOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.secondary,
    marginBottom: 8,
    gap: 12,
  },
  businessOptionActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  businessOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.foreground,
  },
  businessOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  businessList: {
    maxHeight: 350,
  },
  expandIcon: {
    marginLeft: 'auto',
    marginRight: 8,
  },
  branchesContainer: {
    marginLeft: 24,
    marginBottom: 8,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    paddingLeft: 12,
  },
  branchOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.muted,
    marginBottom: 6,
    gap: 10,
  },
  branchOptionActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  branchTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  branchOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  branchOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  mainBadge: {
    backgroundColor: colors.foreground + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mainBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.foreground,
  },
  // RTL Styles
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  rtlText: {
    textAlign: 'right',
  },
  filterContainerRTL: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
  },
  sectionTitleRTL: {
    textAlign: 'right',
    marginLeft: 0,
    marginRight: 4,
  },
  statCardRTL: {
    alignItems: 'flex-end',
  },
});
