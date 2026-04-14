import React, { createContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types/user';
import * as authService from '../services/authService';
import { authEventEmitter } from '../services/api';

const TOKEN_KEY = 'auth_token';
const REFRESH_KEY = 'refresh_token';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  requestRegistration: (email: string, password: string, displayName: string) => Promise<{ message: string; dev_code?: string }>;
  verifyRegistration: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: { preferred_style?: string; display_name?: string }) => Promise<void>;
  uploadProfileImage: (imageUri: string) => Promise<void>;
  requestEmailChange: (newEmail: string) => Promise<{ message: string; dev_code?: string }>;
  verifyEmailChange: (newEmail: string, code: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  requestRegistration: async () => ({ message: '' }),
  verifyRegistration: async () => {},
  logout: async () => {},
  updateUser: async () => {},
  uploadProfileImage: async () => {},
  requestEmailChange: async () => ({ message: '' }),
  verifyEmailChange: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // ── Load stored auth on mount ─────────────────────────────────────────
  useEffect(() => {
    loadStoredAuth();
  }, []);

  // ── Listen for force-logout events from the API interceptor ───────────
  useEffect(() => {
    const handleForceLogout = () => {
      setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
    };

    authEventEmitter.on('force-logout', handleForceLogout);
    return () => {
      authEventEmitter.off('force-logout', handleForceLogout);
    };
  }, []);

  const loadStoredAuth = async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) {
        const user = await authService.getMe();
        const currentToken = await AsyncStorage.getItem(TOKEN_KEY);
        setState({ user, token: currentToken, isAuthenticated: true, isLoading: false });
      } else {
        setState((s) => ({ ...s, isLoading: false }));
      }
    } catch {
      await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY]);
      setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    const { access_token, refresh_token } = await authService.login(email, password);
    await AsyncStorage.setItem(TOKEN_KEY, access_token);
    await AsyncStorage.setItem(REFRESH_KEY, refresh_token);
    const user = await authService.getMe();
    setState({ user, token: access_token, isAuthenticated: true, isLoading: false });
  }, []);

  // Legacy direct registration (no email verification)
  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const { access_token, refresh_token } = await authService.register(email, password, displayName);
    await AsyncStorage.setItem(TOKEN_KEY, access_token);
    await AsyncStorage.setItem(REFRESH_KEY, refresh_token);
    const user = await authService.getMe();
    setState({ user, token: access_token, isAuthenticated: true, isLoading: false });
  }, []);

  // Two-step registration: Step 1 — request code
  const requestRegistration = useCallback(async (email: string, password: string, displayName: string) => {
    const result = await authService.requestRegistration(email, password, displayName);
    return result;
  }, []);

  // Two-step registration: Step 2 — verify code and log in
  const verifyRegistration = useCallback(async (email: string, code: string) => {
    const { access_token, refresh_token } = await authService.verifyRegistration(email, code);
    await AsyncStorage.setItem(TOKEN_KEY, access_token);
    await AsyncStorage.setItem(REFRESH_KEY, refresh_token);
    const user = await authService.getMe();
    setState({ user, token: access_token, isAuthenticated: true, isLoading: false });
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY]);
    setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
  }, []);

  const updateUser = useCallback(async (data: { preferred_style?: string; display_name?: string }) => {
    const updated = await authService.updateMe(data);
    setState((s) => ({ ...s, user: updated }));
  }, []);

  const uploadProfileImage = useCallback(async (imageUri: string) => {
    const updated = await authService.uploadProfileImage(imageUri);
    setState((s) => ({ ...s, user: updated }));
  }, []);

  const requestEmailChange = useCallback(async (newEmail: string) => {
    const result = await authService.requestEmailChange(newEmail);
    return result;
  }, []);

  const verifyEmailChange = useCallback(async (newEmail: string, code: string) => {
    const updated = await authService.verifyEmailChange(newEmail, code);
    setState((s) => ({ ...s, user: updated }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        requestRegistration,
        verifyRegistration,
        logout,
        updateUser,
        uploadProfileImage,
        requestEmailChange,
        verifyEmailChange,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
