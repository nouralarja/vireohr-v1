import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  User as FirebaseUser,
  signInWithEmailLink,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { User, UserRole } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  sendMagicLink: (email: string) => Promise<void>;
  signInWithLink: (email: string, link: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const actionCodeSettings = {
  url: process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001',
  handleCodeInApp: true,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (uid: string, forceRefresh: boolean = false): Promise<User | null> => {
    try {
      // Force token refresh to get latest claims
      if (forceRefresh && auth.currentUser) {
        await auth.currentUser.getIdToken(true);
      }
      
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        // Ensure role is never undefined - default to EMPLOYEE
        if (!userData.role) {
          userData.role = UserRole.EMPLOYEE;
          // Update Firestore with default role
          await setDoc(doc(db, 'users', uid), { ...userData, role: UserRole.EMPLOYEE }, { merge: true });
        }
        
        // Cache-bust: store user data with timestamp
        await AsyncStorage.setItem(`user_${uid}`, JSON.stringify({
          ...userData,
          cachedAt: Date.now()
        }));
        
        return userData;
      } else {
        // User document doesn't exist, create it with default role
        const newUser: User = {
          uid,
          email: auth.currentUser?.email || '',
          name: auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'User',
          role: UserRole.EMPLOYEE,
        };
        await setDoc(doc(db, 'users', uid), newUser);
        return newUser;
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  };

  const refreshUser = async () => {
    if (firebaseUser) {
      const userData = await fetchUserData(firebaseUser.uid);
      setUser(userData);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      if (firebaseUser) {
        // Force refresh token to get latest role
        const userData = await fetchUserData(firebaseUser.uid, true);
        setUser(userData);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Check if signing in with email link
  useEffect(() => {
    const checkEmailLink = async () => {
      // Only run on web platform where window is available
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        if (isSignInWithEmailLink(auth, window.location.href)) {
          let email = await AsyncStorage.getItem('emailForSignIn');
          if (!email) {
            email = window.prompt('Please provide your email for confirmation');
          }
          if (email) {
            try {
              await signInWithLink(email, window.location.href);
              await AsyncStorage.removeItem('emailForSignIn');
            } catch (error) {
              console.error('Error signing in with email link:', error);
            }
          }
        }
      }
    };
    checkEmailLink();
  }, []);

  const sendMagicLink = async (email: string) => {
    try {
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      await AsyncStorage.setItem('emailForSignIn', email);
    } catch (error: any) {
      console.error('Send magic link error:', error);
      throw new Error(error.message);
    }
  };

  const signInWithLink = async (email: string, link: string) => {
    try {
      const userCredential = await signInWithEmailLink(auth, email, link);
      const userData = await fetchUserData(userCredential.user.uid);
      setUser(userData);
    } catch (error: any) {
      console.error('Sign in with link error:', error);
      throw new Error(error.message);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setFirebaseUser(null);
    } catch (error: any) {
      console.error('Sign out error:', error);
      throw new Error(error.message);
    }
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, sendMagicLink, signInWithLink, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
