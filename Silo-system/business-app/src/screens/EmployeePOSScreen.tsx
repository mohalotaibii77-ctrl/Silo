import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import { 
  ClipboardList,
  Clock,
  LogIn,
  LogOut,
  BookOpen,
  FileText,
  CalendarDays,
  Receipt,
  GraduationCap,
  ChevronRight,
  User,
  CheckCircle2,
  Circle
} from 'lucide-react-native';

interface Task {
  id: number;
  title: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  dueTime?: string;
}

export default function EmployeePOSScreen({ navigation }: any) {
  const [userName, setUserName] = useState('Employee');
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
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        setUserName(user.name || user.username || 'Employee');
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

  const MenuItem = ({ icon: Icon, title, subtitle, onPress }: any) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuIconContainer}>
        <Icon size={20} color={colors.foreground} />
      </View>
      <View style={styles.menuTextContainer}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <ChevronRight size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
  );

  const incompleteTasks = tasks.filter(t => !t.completed).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarContainer}>
            <User size={20} color={colors.foreground} />
          </View>
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={18} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Clock In/Out Card */}
        <View style={styles.clockCard}>
          <View style={styles.clockHeader}>
            <Clock size={20} color={colors.foreground} />
            <Text style={styles.clockTitle}>Time Clock</Text>
          </View>
          
          {isClockedIn ? (
            <View style={styles.clockedInContainer}>
              <View style={styles.clockedInInfo}>
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Clocked In</Text>
                </View>
                <Text style={styles.clockedInTime}>Since {clockInTime}</Text>
              </View>
              <TouchableOpacity 
                style={[styles.punchButton, styles.punchOutButton]} 
                onPress={handlePunchOut}
              >
                <LogOut size={18} color={colors.background} />
                <Text style={styles.punchButtonText}>Punch Out</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.punchButton, styles.punchInButton]} 
              onPress={handlePunchIn}
            >
              <LogIn size={18} color={colors.background} />
              <Text style={styles.punchButtonText}>Punch In</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Assigned Tasks */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Assigned Tasks</Text>
            {incompleteTasks > 0 && (
              <View style={styles.taskBadge}>
                <Text style={styles.taskBadgeText}>{incompleteTasks}</Text>
              </View>
            )}
          </View>
          <View style={styles.card}>
            {tasks.map((task, index) => (
              <View key={task.id}>
                <TouchableOpacity style={styles.taskItem} activeOpacity={0.7}>
                  {task.completed ? (
                    <CheckCircle2 size={20} color={colors.foreground} />
                  ) : (
                    <Circle size={20} color={colors.mutedForeground} />
                  )}
                  <View style={styles.taskContent}>
                    <Text style={[
                      styles.taskTitle,
                      task.completed && styles.taskCompleted
                    ]}>
                      {task.title}
                    </Text>
                    {task.dueTime && !task.completed && (
                      <Text style={styles.taskDueTime}>Due: {task.dueTime}</Text>
                    )}
                  </View>
                  {!task.completed && (
                    <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(task.priority) }]} />
                  )}
                </TouchableOpacity>
                {index < tasks.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
            <TouchableOpacity style={styles.viewAllButton}>
              <Text style={styles.viewAllText}>View All Tasks</Text>
              <ChevronRight size={16} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* HR Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>HR</Text>
          <View style={styles.card}>
            <MenuItem 
              icon={BookOpen} 
              title="SOP" 
              subtitle="Standard Operating Procedures"
            />
            <View style={styles.divider} />
            <MenuItem 
              icon={CalendarDays} 
              title="Leaves" 
              subtitle="Request & view leaves"
            />
            <View style={styles.divider} />
            <MenuItem 
              icon={Receipt} 
              title="Payslip" 
              subtitle="View your payslips"
            />
          </View>
        </View>

        {/* Training Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Training</Text>
          <View style={styles.card}>
            <MenuItem 
              icon={GraduationCap} 
              title="Training Modules" 
              subtitle="Complete your training"
            />
            <View style={styles.divider} />
            <MenuItem 
              icon={FileText} 
              title="Certifications" 
              subtitle="View your certificates"
            />
          </View>
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 40 }} />
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  welcomeText: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  userName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: 2,
  },
  logoutButton: {
    padding: 10,
    backgroundColor: colors.secondary,
    borderRadius: 10,
  },
  content: {
    flex: 1,
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
    backgroundColor: colors.foreground,
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
});
