export const COLORS = {
  // Main colors as per spec - NO GRAY ALLOWED
  white: '#FFFFFF',
  teal: '#0D4633',
  gold: '#D9D0AC',
  charcoal: '#121212',
  
  // Status colors
  error: '#DC2626',
  success: '#16A34A',
  warning: '#F59E0B',
  info: '#3B82F6',
  
  // Legacy gray mappings - NOW USE TEAL/GOLD/WHITE ONLY
  gray50: '#FFFFFF',     // → white
  gray100: '#FFFFFF',    // → white
  gray200: '#D9D0AC',    // → gold (light borders)
  gray300: '#D9D0AC',    // → gold
  gray400: '#D9D0AC',    // → gold (inactive)
  gray500: '#0D4633',    // → teal
  gray600: '#0D4633',    // → teal
  gray700: '#0D4633',    // → teal (dark text)
  gray800: '#0D4633',    // → teal
  gray900: '#0D4633',    // → teal (darkest)
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FONT_SIZE = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const SHADOW = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
};
