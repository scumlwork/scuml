'use client';

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import axios from 'axios';
import { Center, Spinner } from '@chakra-ui/react';
import { playMessageAlert } from '@/lib/alertSound';

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

  // 🔊 Alert tone on every new message, for every logged-in account,
  // everywhere in the app — AuthProvider wraps every page (there's no
  // single shared layout otherwise), so this is the one place that can
  // poll globally instead of only on the home page. `null` on the ref
  // means "no baseline yet" — the first poll after login just records the
  // count, so an already-existing unread count doesn't play a sound on
  // every page load; only a genuine increase after that does.
  const previousUnreadCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (!user) {
      previousUnreadCountRef.current = null;
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/messages/unread-count`,
          { withCredentials: true }
        );
        if (cancelled) return;
        const count: number = res.data?.count ?? 0;
        const prev = previousUnreadCountRef.current;
        if (prev !== null && count > prev) {
          playMessageAlert();
        }
        previousUnreadCountRef.current = count;
      } catch {
        // A stale/expired session shouldn't spam anything here.
      }
    };
    poll();
    const interval = setInterval(poll, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

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
