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
} from 'react-native';
import { useTheme, ThemeColors } from '../theme/ThemeContext';
import { useLocalization } from '../localization/LocalizationContext';
import { safeGoBack } from '../utils/navigationHelpers';
import { attendanceService, AttendanceHistoryItem, AttendanceSummary } from '../services/AttendanceService';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarOff,
  Receipt,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Coffee,
  Calendar,
  ChevronRight,
} from 'lucide-react-native';

type TabType = 'sop' | 'leaves' | 'payslip' | 'attendance';

// Skeleton component
const Skeleton = ({ width: w, height, borderRadius = 8, style, colors }: { width: number | string; height: number; borderRadius?: number; style?: any; colors: ThemeColors }) => {
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

const AttendanceCardSkeleton = ({ styles, colors }: { styles: any; colors: ThemeColors }) => (
  <View style={styles.attendanceCard}>
    <View style={styles.attendanceCardContent}>
      <View style={{ flex: 1 }}>
        <Skeleton width="50%" height={16} style={{ marginBottom: 8 }} colors={colors} />
        <Skeleton width="70%" height={14} colors={colors} />
      </View>
      <Skeleton width={70} height={24} borderRadius={12} colors={colors} />
    </View>
  </View>
);

export default function HRScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t, isRTL, language } = useLocalization();
  const styles = createStyles(colors);

  const [activeTab, setActiveTab] = useState<TabType>('attendance');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Attendance data
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceHistoryItem[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);

  const tabs: { key: TabType; label: string; labelAr: string; icon: any }[] = [
    { key: 'sop', label: 'SOP', labelAr: 'الإجراءات', icon: BookOpen },
    { key: 'leaves', label: 'Leaves', labelAr: 'الإجازات', icon: CalendarOff },
    { key: 'payslip', label: 'Payslip', labelAr: 'الراتب', icon: Receipt },
    { key: 'attendance', label: 'Attendance', labelAr: 'الحضور', icon: Clock },
  ];

  useEffect(() => {
    loadData(false);
  }, [activeTab]);

  const loadData = async (forceRefresh = false) => {
    try {
      switch (activeTab) {
        case 'attendance':
          await loadAttendanceHistory(forceRefresh);
          break;
        // Other tabs will be implemented later
        default:
          setLoading(false);
          break;
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const loadAttendanceHistory = async (forceRefresh = false) => {
    if (!forceRefresh && attendanceRecords.length > 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Get last 30 days of attendance
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const result = await attendanceService.getHistory(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      if (result.success && result.data) {
        setAttendanceRecords(result.data.records || []);
        setAttendanceSummary(result.data.summary || null);
      }
    } catch (error) {
      console.error('Failed to load attendance history:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [activeTab]);

  const getStatusBadge = (status: string, lateMinutes: number = 0) => {
    switch (status) {
      case 'on_time':
        return {
          label: language === 'ar' ? 'في الوقت' : 'On Time',
          color: '#059669',
          bgColor: '#d1fae5',
          icon: CheckCircle2,
        };
      case 'late':
        return {
          label: language === 'ar' ? `متأخر ${lateMinutes}د` : `Late ${lateMinutes}m`,
          color: '#d97706',
          bgColor: '#fef3c7',
          icon: AlertCircle,
        };
      case 'absent':
        return {
          label: language === 'ar' ? 'غائب' : 'Absent',
          color: '#dc2626',
          bgColor: '#fee2e2',
          icon: XCircle,
        };
      case 'rest_day':
        return {
          label: language === 'ar' ? 'يوم راحة' : 'Rest Day',
          color: '#71717a',
          bgColor: '#f4f4f5',
          icon: Coffee,
        };
      case 'checked_in':
        return {
          label: language === 'ar' ? 'مسجل دخول' : 'Checked In',
          color: '#2563eb',
          bgColor: '#dbeafe',
          icon: Clock,
        };
      default:
        return {
          label: status,
          color: '#71717a',
          bgColor: '#f4f4f5',
          icon: Clock,
        };
    }
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '--:--';
    const date = new Date(timeStr);
    return date.toLocaleTimeString(language === 'ar' ? 'ar-KW' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === 'ar' ? 'ar-KW' : 'en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatHours = (hours: number | null) => {
    if (!hours) return '--';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const renderAttendanceSummary = () => {
    if (!attendanceSummary) return null;

    return (
      <View style={styles.summaryContainer}>
        <View style={[styles.summaryItem, { backgroundColor: '#d1fae5' }]}>
          <Text style={[styles.summaryValue, { color: '#059669' }]}>{attendanceSummary.on_time}</Text>
          <Text style={styles.summaryLabel}>{language === 'ar' ? 'في الوقت' : 'On Time'}</Text>
        </View>
        <View style={[styles.summaryItem, { backgroundColor: '#fef3c7' }]}>
          <Text style={[styles.summaryValue, { color: '#d97706' }]}>{attendanceSummary.late}</Text>
          <Text style={styles.summaryLabel}>{language === 'ar' ? 'متأخر' : 'Late'}</Text>
        </View>
        <View style={[styles.summaryItem, { backgroundColor: '#fee2e2' }]}>
          <Text style={[styles.summaryValue, { color: '#dc2626' }]}>{attendanceSummary.absent}</Text>
          <Text style={styles.summaryLabel}>{language === 'ar' ? 'غائب' : 'Absent'}</Text>
        </View>
        <View style={[styles.summaryItem, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.summaryValue, { color: colors.foreground }]}>{attendanceSummary.total_days}</Text>
          <Text style={styles.summaryLabel}>{language === 'ar' ? 'المجموع' : 'Total'}</Text>
        </View>
      </View>
    );
  };

  const renderAttendanceCard = (record: AttendanceHistoryItem) => {
    const badge = getStatusBadge(record.status, record.late_minutes);
    const BadgeIcon = badge.icon;

    return (
      <View key={record.date} style={styles.attendanceCard}>
        <View style={[styles.attendanceCardContent, isRTL && styles.rtlRow]}>
          <View style={[styles.dateIconContainer, { backgroundColor: colors.secondary }]}>
            <Calendar size={20} color={colors.foreground} />
          </View>
          <View style={[styles.attendanceInfo, isRTL && { alignItems: 'flex-end' }]}>
            <Text style={[styles.attendanceDate, isRTL && styles.rtlText]}>
              {formatDate(record.date)}
            </Text>
            {record.status !== 'rest_day' && record.status !== 'absent' ? (
              <View style={[styles.attendanceTimes, isRTL && styles.rtlRow]}>
                <Text style={styles.attendanceTimeLabel}>
                  {language === 'ar' ? 'دخول: ' : 'In: '}
                  <Text style={styles.attendanceTimeValue}>{formatTime(record.checkin_time)}</Text>
                </Text>
                <Text style={styles.attendanceTimeSeparator}>•</Text>
                <Text style={styles.attendanceTimeLabel}>
                  {language === 'ar' ? 'خروج: ' : 'Out: '}
                  <Text style={styles.attendanceTimeValue}>{formatTime(record.checkout_time)}</Text>
                </Text>
              </View>
            ) : (
              <Text style={styles.attendanceNoRecord}>
                {record.status === 'rest_day'
                  ? (language === 'ar' ? 'يوم راحة' : 'Rest Day')
                  : (language === 'ar' ? 'لا يوجد تسجيل' : 'No check-in recorded')}
              </Text>
            )}
            {record.total_hours && (
              <Text style={styles.attendanceTotalHours}>
                {language === 'ar' ? 'المجموع: ' : 'Total: '}{formatHours(record.total_hours)}
              </Text>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: badge.bgColor }]}>
            <BadgeIcon size={14} color={badge.color} />
            <Text style={[styles.statusBadgeText, { color: badge.color }]}>
              {badge.label}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderAttendanceContent = () => {
    if (loading) {
      return (
        <>
          {renderAttendanceSummary()}
          <AttendanceCardSkeleton styles={styles} colors={colors} />
          <AttendanceCardSkeleton styles={styles} colors={colors} />
          <AttendanceCardSkeleton styles={styles} colors={colors} />
        </>
      );
    }

    if (attendanceRecords.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Clock size={48} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>
            {language === 'ar' ? 'لا يوجد سجلات حضور' : 'No attendance records found'}
          </Text>
          <Text style={styles.emptySubtext}>
            {language === 'ar' ? 'سجل حضورك لرؤية السجلات هنا' : 'Check in to see your records here'}
          </Text>
        </View>
      );
    }

    return (
      <>
        {renderAttendanceSummary()}
        {attendanceRecords.map(record => renderAttendanceCard(record))}
      </>
    );
  };

  const renderSOPContent = () => (
    <View style={styles.comingSoonContainer}>
      <BookOpen size={48} color={colors.mutedForeground} />
      <Text style={styles.comingSoonText}>
        {language === 'ar' ? 'قريباً' : 'Coming Soon'}
      </Text>
      <Text style={styles.comingSoonSubtext}>
        {language === 'ar' ? 'سيتم إضافة إجراءات التشغيل القياسية قريباً' : 'Standard Operating Procedures will be available soon'}
      </Text>
    </View>
  );

  const renderLeavesContent = () => (
    <View style={styles.comingSoonContainer}>
      <CalendarOff size={48} color={colors.mutedForeground} />
      <Text style={styles.comingSoonText}>
        {language === 'ar' ? 'قريباً' : 'Coming Soon'}
      </Text>
      <Text style={styles.comingSoonSubtext}>
        {language === 'ar' ? 'سيتم إضافة إدارة الإجازات قريباً' : 'Leave management will be available soon'}
      </Text>
    </View>
  );

  const renderPayslipContent = () => (
    <View style={styles.comingSoonContainer}>
      <Receipt size={48} color={colors.mutedForeground} />
      <Text style={styles.comingSoonText}>
        {language === 'ar' ? 'قريباً' : 'Coming Soon'}
      </Text>
      <Text style={styles.comingSoonSubtext}>
        {language === 'ar' ? 'سيتم إضافة كشوف الرواتب قريباً' : 'Payslips will be available soon'}
      </Text>
    </View>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'attendance':
        return renderAttendanceContent();
      case 'sop':
        return renderSOPContent();
      case 'leaves':
        return renderLeavesContent();
      case 'payslip':
        return renderPayslipContent();
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
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
            {language === 'ar' ? 'الموارد البشرية' : 'HR'}
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScrollContainer}
        contentContainerStyle={[styles.tabContainer, isRTL && { flexDirection: 'row-reverse' }]}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Icon size={18} color={isActive ? colors.background : colors.mutedForeground} />
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {language === 'ar' ? tab.labelAr : tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.listContainer}>
          {renderContent()}
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
    alignItems: 'center',
    justifyContent: 'space-between',
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
  tabScrollContainer: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    maxHeight: 56,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.secondary,
    gap: 6,
  },
  tabActive: {
    backgroundColor: colors.foreground,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  tabTextActive: {
    color: colors.background,
  },
  content: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  // Summary styles
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 10,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  // Attendance card styles
  attendanceCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  attendanceCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  dateIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendanceInfo: {
    flex: 1,
  },
  attendanceDate: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  attendanceTimes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  attendanceTimeLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  attendanceTimeValue: {
    fontWeight: '500',
    color: colors.foreground,
  },
  attendanceTimeSeparator: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  attendanceNoRecord: {
    fontSize: 12,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
  attendanceTotalHours: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 4,
    textAlign: 'center',
  },
  // Coming soon
  comingSoonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  comingSoonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: 16,
  },
  comingSoonSubtext: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  // RTL styles
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  rtlText: {
    textAlign: 'right',
  },
});
