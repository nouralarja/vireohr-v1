import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager, Platform } from 'react-native';

// Import translations
import en from '../locales/en.json';
import ar from '../locales/ar.json';

const LANGUAGE_STORAGE_KEY = '@gosta_language';

// Language resources
const resources = {
  en: { translation: en },
  ar: { translation: ar },
};

// Check if we're in a browser/client environment
const isClient = typeof window !== 'undefined';

// Initialize i18n
const initI18n = async () => {
  let savedLanguage = 'en'; // Default language
  
  // Only access AsyncStorage in client environment
  if (isClient) {
    try {
      savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY) || 'en';
    } catch (error) {
      console.log('Could not load saved language, using default');
    }
  }
  
  // If no saved language, detect from device (only in client)
  if (!savedLanguage || savedLanguage === 'en') {
    if (isClient && Localization.getLocales) {
      const deviceLocale = Localization.getLocales()[0];
      savedLanguage = deviceLocale?.languageCode === 'ar' ? 'ar' : 'en';
    }
  }

  // Configure RTL for Arabic
  // Note: I18nManager.forceRTL() disabled for Expo Go compatibility
  // RTL styling is handled via i18n.dir() in components
  const isRTL = savedLanguage === 'ar';

  await i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: savedLanguage,
      fallbackLng: 'en',
      compatibilityJSON: 'v3',
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });

  return savedLanguage;
};

// Change language function
export const changeLanguage = async (language: 'en' | 'ar') => {
  if (isClient) {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch (error) {
      console.log('Could not save language preference');
    }
  }
  await i18n.changeLanguage(language);
  
  // Note: RTL changes handled via i18n.dir() in components (Expo Go compatible)
  return language === 'ar';
};

// Get current language
export const getCurrentLanguage = () => i18n.language;

// Check if current language is RTL
export const isRTL = () => i18n.language === 'ar';

// Only initialize in client environment
if (isClient) {
  initI18n();
}

export default i18n;
