import { useState } from 'react';
import Toast from 'react-native-toast-message';
import api from '../services/api';

interface UseApiOptions {
  showError?: boolean;
  errorMessage?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

/**
 * Hook for making API calls with standardized error handling
 * Returns Apollo-style { data, error, loading }
 */
export function useApi() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = async <T = any>(
    apiCall: () => Promise<any>,
    options: UseApiOptions = {}
  ): Promise<T | null> => {
    const {
      showError = true,
      errorMessage = 'An error occurred',
      onSuccess,
      onError,
    } = options;

    setLoading(true);
    setError(null);

    try {
      const response = await apiCall();
      const responseData = response.data;
      setData(responseData);

      if (onSuccess) {
        onSuccess(responseData);
      }

      return responseData;
    } catch (err: any) {
      const errorObj = err as Error;
      setError(errorObj);

      // Dev logging
      if (__DEV__) {
        console.error('API Error:', {
          message: errorObj.message,
          response: err.response?.data,
          status: err.response?.status,
          stack: errorObj.stack,
        });
      }

      // User-friendly toast
      if (showError) {
        const userMessage = err.response?.data?.detail || errorMessage;
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: userMessage,
          visibilityTime: 4000,
          position: 'top',
        });
      }

      if (onError) {
        onError(err);
      }

      return null;
    } finally {
      setLoading(false);
    }
  };

  return { data, error, loading, execute };
}

/**
 * Helper function for one-off API calls without hook state
 */
export async function apiCall<T = any>(
  apiFunction: () => Promise<any>,
  options: UseApiOptions = {}
): Promise<T | null> {
  const {
    showError = true,
    errorMessage = 'An error occurred',
    onSuccess,
    onError,
  } = options;

  try {
    const response = await apiFunction();
    const data = response.data;

    if (onSuccess) {
      onSuccess(data);
    }

    return data;
  } catch (err: any) {
    const error = err as Error;

    // Dev logging
    if (__DEV__) {
      console.error('API Error:', {
        message: error.message,
        response: err.response?.data,
        status: err.response?.status,
        stack: error.stack,
      });
    }

    // User-friendly toast
    if (showError) {
      const userMessage = err.response?.data?.detail || errorMessage;
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: userMessage,
        visibilityTime: 4000,
        position: 'top',
      });
    }

    if (onError) {
      onError(err);
    }

    return null;
  }
}
