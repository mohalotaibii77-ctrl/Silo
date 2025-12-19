import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import { useLocalization } from '../localization/LocalizationContext';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingBag, 
  ClipboardList, 
  Users, 
  BarChart3, 
  LogOut,
  ChevronRight
} from 'lucide-react-native';

export default function PMDashboardScreen({ navigation }: any) {
  const { t, isRTL } = useLocalization();
  
  const handleLogout = async () => {
    await AsyncStorage.clear();
    navigation.replace('Login');
  };

  const MenuItem = ({ icon: Icon, title, subtitle, onPress }: any) => (
    <TouchableOpacity style={[styles.menuItem, isRTL && styles.rtlRow]} onPress={onPress}>
      {isRTL ? (
        <>
          <View style={[styles.menuIconContainer, { marginRight: 0, marginLeft: 12 }]}>
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Silo Business</Text>
          <Text style={styles.headerSubtitle}>Operations Dashboard</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Operations</Text>
          <View style={styles.card}>
            <MenuItem 
              icon={LayoutDashboard} 
              title="Operations Overview" 
              subtitle="Manage daily activities"
            />
            <View style={styles.divider} />
            <MenuItem 
              icon={BarChart3} 
              title="Daily Reports" 
              subtitle="View performance metrics"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}>{t('management')}</Text>
          <View style={styles.card}>
            <MenuItem 
              icon={Package} 
              title={t('itemsAndProducts')} 
              subtitle={t('manageItemsProducts')}
              onPress={() => navigation.navigate('ItemsProducts')}
            />
            <View style={styles.divider} />
            <MenuItem icon={ShoppingBag} title={t('orders')} subtitle={t('trackProcessOrders')} />
            <View style={styles.divider} />
            <MenuItem icon={ClipboardList} title={t('inventory')} subtitle={t('stockLevelsSuppliers')} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Team</Text>
          <View style={styles.card}>
            <MenuItem icon={Users} title="Staff Scheduling" />
          </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  logoutButton: {
    padding: 8,
    backgroundColor: colors.secondary,
    borderRadius: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 4,
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
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.card,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
    marginLeft: 64,
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  rtlText: {
    textAlign: 'right',
  },
  sectionTitleRTL: {
    textAlign: 'right',
    marginLeft: 0,
    marginRight: 4,
  },
});
