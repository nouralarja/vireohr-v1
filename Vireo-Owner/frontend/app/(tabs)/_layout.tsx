import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useAttendanceData } from '../../contexts/AttendanceContext';
import { UserRole } from '../../types';

export default function TabLayout() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const { attendance, shifts } = useAttendanceData();
  const [isActiveSupervisor, setIsActiveSupervisor] = useState(false);

  // Check if user is currently a shift supervisor
  useEffect(() => {
    if (!user) {
      setIsActiveSupervisor(false);
      return;
    }
    
    // Check if user has active attendance where they are supervisor
    const activeSupervisorRecord = attendance.find(
      (record: any) => 
        record.employeeId === user.uid && 
        record.status === 'CLOCKED_IN' &&
        record.shiftId
    );
    
    if (activeSupervisorRecord) {
      // Check if they are supervisor for this shift
      const shift = shifts.find((s: any) => s.id === activeSupervisorRecord.shiftId);
      
      if (shift && shift.supervisorId === user.uid) {
        setIsActiveSupervisor(true);
      } else {
        setIsActiveSupervisor(false);
      }
    } else {
      setIsActiveSupervisor(false);
    }
  }, [user, attendance, shifts]);

  // Convert role to string for comparison
  const userRole = user ? String(user.role || 'EMPLOYEE').toUpperCase() : '';
  
  // Role checks
  const isOwner = userRole === 'OWNER';
  const isCO = userRole === 'CO';
  const isManager = userRole === 'MANAGER';
  const isAccountant = userRole === 'ACCOUNTANT';
  const isEmployee = userRole === 'EMPLOYEE';
  
  // Management roles (Owner/CO/Manager)
  const isManagement = isOwner || isCO || isManager;

  // Don't render tabs until user is loaded - but must keep hooks consistent
  if (loading || !user) {
    return <></>;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.teal,
        tabBarInactiveTintColor: COLORS.gold,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.gold,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}
    >
      {/* HOME - Always visible */}
      <Tabs.Screen
        name="home"
        options={{
          title: t('navigation.home'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      {/* ATTENDANCE - Owner/CO/Manager/Accountant */}
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          href: (isManagement || isAccountant) ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />

      {/* CLOCK - Employees and Supervisors only (not Management/Accountant) */}
      <Tabs.Screen
        name="clock"
        options={{
          title: t('navigation.attendance'),
          href: (!isManagement && !isAccountant) ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />

      {/* LEAVE - Employees and Supervisors only (not Management/Accountant) */}
      <Tabs.Screen
        name="leave"
        options={{
          title: 'Leave',
          href: (!isManagement && !isAccountant) ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-clear-outline" size={size} color={color} />
          ),
        }}
      />

      {/* INGREDIENTS - Active shift supervisors only */}
      <Tabs.Screen
        name="ingredients"
        options={{
          title: 'Ingredients',
          href: isActiveSupervisor ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="restaurant-outline" size={size} color={color} />
          ),
        }}
      />

      {/* STORES - Owner/CO only (Managers see stores in Schedule/Attendance) */}
      <Tabs.Screen
        name="stores"
        options={{
          title: t('navigation.stores'),
          href: (isOwner || isCO) ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="storefront-outline" size={size} color={color} />
          ),
        }}
      />

      {/* EMPLOYEES - Owner/CO/Manager only */}
      <Tabs.Screen
        name="employees"
        options={{
          title: t('navigation.employees'),
          href: isManagement ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />

      {/* REQUESTS - Manager+ only (Leave & Day-Off approvals) */}
      <Tabs.Screen
        name="requests"
        options={{
          title: "Requests",
          href: isManagement ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="clipboard-outline" size={size} color={color} />
          ),
        }}
      />

      {/* CREATE SCHEDULE - Managers can create schedules for employees */}
      <Tabs.Screen
        name="create-schedule"
        options={{
          title: 'Schedule',
          href: isManagement ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />

      {/* REPORTS - Owner/CO/Accountant only */}
      <Tabs.Screen
        name="reports"
        options={{
          title: t('navigation.reports'),
          href: (isOwner || isCO || isAccountant) ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        }}
      />

      {/* PAYROLL - Owner/CO/Accountant */}
      <Tabs.Screen
        name="payroll"
        options={{
          title: 'Payroll',
          href: (isOwner || isCO || isAccountant) ? undefined : null,
          tabBarIcon: ({ color, size}) => (
            <Ionicons name="wallet-outline" size={size} color={color} />
          ),
        }}
      />

      {/* SETTINGS - Always visible */}
      <Tabs.Screen
        name="settings"
        options={{
          title: t('navigation.settings'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />

      {/* HIDDEN SCREEN - Keep for routing but don't show in tabs */}
      <Tabs.Screen
        name="schedule"
        options={{
          href: null,
          title: 'Schedule',
        }}
      />
    </Tabs>
  );
}
