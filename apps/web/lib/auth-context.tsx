'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from './api-client';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if token exists in cookies
    try {
      console.log('AuthProvider: Reading cookies...');
      const allCookies = document.cookie;
      console.log('All cookies:', allCookies);

      let tokenFromCookie: string | undefined;
      if (allCookies) {
        const cookieParts = allCookies.split(';');
        for (const cookie of cookieParts) {
          const [key, value] = cookie.split('=');
          if (key?.trim() === 'auth-token' && value) {
            tokenFromCookie = decodeURIComponent(value.trim());
            break;
          }
        }
      }

      const userFromSession = sessionStorage.getItem('user');
      
      console.log('AuthProvider: Initialized', {
        hasTokenCookie: !!tokenFromCookie,
        hasUserSession: !!userFromSession,
      });
      
      if (tokenFromCookie && userFromSession) {
        setToken(tokenFromCookie);
        // Sync token to API client
        apiClient.setToken(tokenFromCookie);
        if (userFromSession) {
          try {
            setUser(JSON.parse(userFromSession));
          } catch (e) {
            console.error('Failed to parse user:', e);
            sessionStorage.removeItem('user');
          }
        }
      }
    } catch (err) {
      console.error('Error initializing auth:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = () => {
    console.log('AuthProvider: Logging out');
    sessionStorage.removeItem('user');
    // Clear auth cookie
    document.cookie = 'auth-token=; Max-Age=0; path=/;';
    // Clear API client token
    apiClient.setToken(null);
    setToken(null);
    setUser(null);
  };

  const setAuth = (newToken: string, newUser: User) => {
    console.log('AuthProvider: setAuth called with', { token: newToken, user: newUser });
    setToken(newToken);
    setUser(newUser);
    // Sync token to API client
    apiClient.setToken(newToken);
    // Also set cookie as backup
    document.cookie = `auth-token=${encodeURIComponent(newToken)}; path=/`;
    sessionStorage.setItem('user', JSON.stringify(newUser));
  };

  const value: AuthContextType = {
    user,
    token,
    loading,
    isAuthenticated: !!token,
    logout,
    setAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
