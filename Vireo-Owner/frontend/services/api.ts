import axios from 'axios';
import { auth } from '../config/firebase';
import { getTodayString } from '../utils/dateUtils';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // 15 second timeout to prevent hanging
});

api.interceptors.request.use(
  async (config) => {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Fetch today's attendance and shifts in parallel
 * Returns combined data for better performance
 */
export const getTodayAttendanceAndShifts = async () => {
  const today = getTodayString();
  const [attendanceRes, shiftsRes] = await Promise.all([
    api.get(`/attendance?date=${today}`),
    api.get(`/shifts?date=${today}`)
  ]);
  return {
    attendance: attendanceRes.data,
    shifts: shiftsRes.data,
    today
  };
};

export default api;