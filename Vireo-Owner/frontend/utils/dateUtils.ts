/**
 * Date utility functions for consistent date formatting across the app
 */

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 */
export const getTodayString = (): string => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Convert a Date object to ISO date string (YYYY-MM-DD)
 */
export const getDateString = (date: Date): string => {
  return date.toISOString().split('T')[0];
};
