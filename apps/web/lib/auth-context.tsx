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
  isImpersonating: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  impersonate: (token: string, user: User) => void;
  returnToAdmin: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    // Check if token exists in cookies
    try {
      const allCookies = document.cookie;

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
      // Check if currently impersonating
      setIsImpersonating(!!localStorage.getItem('admin_token_backup'));
    } catch (err) {
      console.error('Error initializing auth:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = () => {
    sessionStorage.removeItem('user');
    // Clear auth cookie
    document.cookie = 'auth-token=; Max-Age=0; path=/;';
    // Clear API client token
    apiClient.setToken(null);
    setToken(null);
    setUser(null);
  };

  const setAuth = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    // Sync token to API client
    apiClient.setToken(newToken);
    // Also set cookie as backup
    document.cookie = `auth-token=${encodeURIComponent(newToken)}; path=/`;
    sessionStorage.setItem('user', JSON.stringify(newUser));
  };

  const impersonate = (newToken: string, newUser: User) => {
    // Back up current admin session before switching
    if (token) localStorage.setItem('admin_token_backup', token);
    if (user) localStorage.setItem('admin_user_backup', JSON.stringify(user));
    setAuth(newToken, newUser);
    setIsImpersonating(true);
  };

  const returnToAdmin = () => {
    const adminToken = localStorage.getItem('admin_token_backup');
    const adminUserStr = localStorage.getItem('admin_user_backup');
    if (adminToken && adminUserStr) {
      try {
        const adminUser = JSON.parse(adminUserStr) as User;
        setAuth(adminToken, adminUser);
      } catch { /* ignore parse error */ }
    }
    localStorage.removeItem('admin_token_backup');
    localStorage.removeItem('admin_user_backup');
    setIsImpersonating(false);
  };

  const value: AuthContextType = {
    user,
    token,
    loading,
    isAuthenticated: !!token,
    isImpersonating,
    logout,
    setAuth,
    impersonate,
    returnToAdmin,
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
