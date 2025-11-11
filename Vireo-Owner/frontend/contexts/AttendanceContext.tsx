import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { getTodayAttendanceAndShifts } from '../services/api';
import { useAuth } from './AuthContext';

interface AttendanceContextType {
  attendance: any[];
  shifts: any[];
  today: string;
  loading: boolean;
  error: string | null;  // Changed from Error to string
  refetch: () => Promise<void>;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

interface AttendanceProviderProps {
  children: ReactNode;
}

const CACHE_KEY = 'attendanceCache';

export function AttendanceProvider({ children }: AttendanceProviderProps) {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [today, setToday] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);  // Changed from Error to string

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    loadCacheAndFetch();
    const interval = setInterval(() => fetchData(), 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [user]);

  const loadCacheAndFetch = async () => {
    // Load cache first for instant display
    await loadFromCache();
    // Then fetch fresh data in background
    await fetchData();
  };

  const loadFromCache = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        setAttendance(data.attendance || []);
        setShifts(data.shifts || []);
        setToday(data.today || '');
        if (__DEV__) {
          console.log('Loaded attendance data from cache');
        }
      }
    } catch (err) {
      console.error('Failed to load cache:', err);
    }
  };

  const saveToCache = async (data: any) => {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
      if (__DEV__) {
        console.log('Saved attendance data to cache');
      }
    } catch (err) {
      console.error('Failed to save cache:', err);
    }
  };

  const fetchData = async () => {
    // Only fetch if user is authenticated
    if (!user) {
      setLoading(false);
      return;
    }

    // Check network connectivity
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      if (__DEV__) {
        console.log('Offline - serving cached data');
      }
      setLoading(false);
      return; // Serve cached data, skip fetch
    }

    try {
      const data = await getTodayAttendanceAndShifts();
      setAttendance(data.attendance);
      setShifts(data.shifts);
      setToday(data.today);
      setError(null);

      // Persist to cache for offline access
      await saveToCache(data);
    } catch (err) {
      const errorObj = err as Error;
      setError(errorObj?.message || 'Failed to fetch data');  // Set error message, not object
      
      if (__DEV__) {
        console.error('Failed to fetch attendance/shifts:', errorObj);
      }
    } finally {
      setLoading(false);
    }
  };

  const value: AttendanceContextType = {
    attendance,
    shifts,
    today,
    loading,
    error,  // Now it's already a string, not an Error object
    refetch: fetchData,
  };

  return (
    <AttendanceContext.Provider value={value}>
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendanceData() {
  const context = useContext(AttendanceContext);
  if (context === undefined) {
    throw new Error('useAttendanceData must be used within an AttendanceProvider');
  }
  return context;
}
