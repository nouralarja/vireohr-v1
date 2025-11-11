import { useCallback } from 'react';
import Toast from 'react-native-toast-message';
import { AxiosError } from 'axios';

interface ErrorHandlerOptions {
  silent?: boolean;
  customMessage?: string;
}

export function useErrorHandler() {
  const handleError = useCallback((error: any, options: ErrorHandlerOptions = {}) => {
    console.error('Error occurred:', error);
    
    if (options.silent) {
      return;
    }

    let errorMessage = options.customMessage || 'An unexpected error occurred';
    let errorTitle = 'Error';

    // Handle Axios errors
    if (error?.isAxiosError || error?.response) {
      const axiosError = error as AxiosError<any>;
      const status = axiosError.response?.status;
      const data = axiosError.response?.data;

      switch (status) {
        case 400:
          errorMessage = data?.detail || data?.message || 'Invalid request';
          break;
        case 401:
          errorMessage = 'Session expired. Please sign in again.';
          errorTitle = 'Authentication Required';
          break;
        case 403:
          errorMessage = 'You do not have permission to perform this action';
          errorTitle = 'Access Denied';
          break;
        case 404:
          errorMessage = data?.detail || 'Resource not found';
          break;
        case 429:
          errorMessage = 'Too many requests. Please wait a moment and try again.';
          errorTitle = 'Rate Limit';
          break;
        case 500:
        case 502:
        case 503:
          errorMessage = 'Server error. Please try again later.';
          errorTitle = 'Server Error';
          break;
        default:
          errorMessage = data?.detail || data?.message || errorMessage;
      }
    }
    // Handle Firebase errors
    else if (error?.code) {
      switch (error.code) {
        case 'permission-denied':
          errorMessage = 'Permission denied';
          break;
        case 'unavailable':
          errorMessage = 'Service temporarily unavailable';
          break;
        case 'not-found':
          errorMessage = 'Resource not found';
          break;
        default:
          errorMessage = error.message || errorMessage;
      }
    }
    // Handle generic errors
    else if (error?.message) {
      errorMessage = error.message;
    }

    // Show toast notification
    Toast.show({
      type: 'error',
      text1: errorTitle,
      text2: errorMessage,
      position: 'top',
      visibilityTime: 4000,
    });

    // TODO: Log to Sentry or error tracking service in production
    // if (process.env.NODE_ENV === 'production') {
    //   Sentry.captureException(error);
    // }

    return errorMessage;
  }, []);

  const handleSuccess = useCallback((message: string, title: string = 'Success') => {
    Toast.show({
      type: 'success',
      text1: title,
      text2: message,
      position: 'top',
      visibilityTime: 3000,
    });
  }, []);

  const handleWarning = useCallback((message: string, title: string = 'Warning') => {
    Toast.show({
      type: 'info',
      text1: title,
      text2: message,
      position: 'top',
      visibilityTime: 3000,
    });
  }, []);

  return {
    handleError,
    handleSuccess,
    handleWarning,
  };
}
