import React, { createContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types/user';
import { mockUser } from '../data/mockUser';

const USE_MOCK = true;
const TOKEN_KEY = 'auth_token';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) {
        if (USE_MOCK) {
          setState({ user: mockUser, token, isAuthenticated: true, isLoading: false });
        } else {
          // TODO: call authService.getMe() with stored token
          setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
      } else {
        setState((s) => ({ ...s, isLoading: false }));
      }
    } catch {
      setState((s) => ({ ...s, isLoading: false }));
    }
  };

  const login = useCallback(async (email: string, _password: string) => {
    if (USE_MOCK) {
      const token = 'mock-jwt-token';
      await AsyncStorage.setItem(TOKEN_KEY, token);
      setState({
        user: { ...mockUser, email },
        token,
        isAuthenticated: true,
        isLoading: false,
      });
      return;
    }
    // TODO: call authService.login(email, password)
  }, []);

  const register = useCallback(async (email: string, _password: string, displayName: string) => {
    if (USE_MOCK) {
      const token = 'mock-jwt-token';
      await AsyncStorage.setItem(TOKEN_KEY, token);
      setState({
        user: { ...mockUser, email, display_name: displayName },
        token,
        isAuthenticated: true,
        isLoading: false,
      });
      return;
    }
    // TODO: call authService.register(email, password, displayName)
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
