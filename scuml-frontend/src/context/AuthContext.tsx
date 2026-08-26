'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import axios from 'axios';
import { Center, Spinner } from '@chakra-ui/react';

type User = {
  id: string;
  username: string;
  email?: string;     // (optional, if you store email)
  photoUrl?: string;  // ✅ profile photo
  role?: 'superadmin' | 'staff' | 'guest';
  isOwner?: boolean;  // exclusive access to user management + audit log
};


type AuthContextType = {
  user: User | null;
  setUser: (user: User | null) => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 🔑 Helper to fetch CSRF token
  const getCsrfToken = async () => {
    const res = await axios.get(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
      { withCredentials: true }
    );
    return res.data.csrfToken;
  };




  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await axios.get(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/me`, {
          withCredentials: true,
        });
        setUser(res.data);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (username: string, password: string) => {
    const csrfToken = await getCsrfToken(); // 🔑 must fetch first

    await axios.post(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/login`,
      { username, password },
      {
        withCredentials: true,
        headers: { 'CSRF-Token': csrfToken },
      }
    );

    const res = await axios.get(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/me`, {
      withCredentials: true,
    });
    setUser(res.data);
  };

  const logout = async () => {
    const csrfToken = await getCsrfToken(); // 🔑 must fetch first

    await axios.post(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/logout`,
      {},
      {
        withCredentials: true,
        headers: { 'CSRF-Token': csrfToken },
      }
    );
    setUser(null);
  };







  

  if (loading) {
    return (
      <Center h="100vh" w="100vw">
        <Spinner size="xl" color="blue.500" />
      </Center>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
