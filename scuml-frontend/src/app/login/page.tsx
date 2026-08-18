'use client';

import { useState, useEffect, type ChangeEvent } from 'react';
import { Box, Button, Input, Text, VStack, Image } from '@chakra-ui/react';
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');

  // Step 2 — only superadmin accounts with 2FA set up ever reach this
  const [needsTotp, setNeedsTotp] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  // ✅ Ensure axios always sends cookies + same-site headers
  axios.defaults.withCredentials = true;

  // ✅ Fetch CSRF token once
  useEffect(() => {
    const fetchCsrf = async () => {
      try {
        const { data } = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
          { withCredentials: true } // 🔑 make sure cookies flow
        );
        setCsrfToken(data.csrfToken);
      } catch (err) {
        console.error('❌ Failed to fetch CSRF token:', err);
      }
    };
    fetchCsrf();
  }, []);

  // ✅ If already logged in, redirect
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/me`,
          { withCredentials: true } // 🔑 include cookies
        );
        setUser?.(data);
        router.replace('/');
      } catch {
        // Not logged in → stay here
      }
    };
    checkSession();
  }, [router, setUser]);

  const finishLogin = async () => {
    const me = await axios.get(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/me`,
      { withCredentials: true }
    );
    setUser?.(me.data);
    router.replace('/');
  };

  const handleSubmit = async () => {
    try {
      setError('');
      setSubmitting(true);

      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/login`,
        { username, password },
        {
          headers: {
            'CSRF-Token': csrfToken,
          },
          withCredentials: true, // 🔑 include cookies in login
        }
      );

      if (res.data?.requiresTotp) {
        setNeedsTotp(true);
        return;
      }

      await finishLogin();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data;
        const remaining = data?.attemptsRemaining;
        if (typeof remaining === 'number') {
          setError(
            `${data?.error || 'Invalid credentials'}. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`
          );
        } else {
          setError(data?.error || 'Login failed');
        }
      } else {
        setError('Login failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyTotp = async () => {
    try {
      setError('');
      setSubmitting(true);

      await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/verify-totp-login`,
        { code: totpCode },
        {
          headers: { 'CSRF-Token': csrfToken },
          withCredentials: true,
        }
      );

      await finishLogin();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data;
        const remaining = data?.attemptsRemaining;
        if (typeof remaining === 'number') {
          setError(
            `${data?.error || 'Invalid code'}. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`
          );
        } else {
          setError(data?.error || 'Verification failed');
        }
      } else {
        setError('Verification failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      minH="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="black"
      px={4}
      py={8}
    >
      <VStack
        gap={4}
        bg="white"
        p={{ base: 6, sm: 8 }}
        borderRadius="xl"
        boxShadow="lg"
        w="full"
        maxW="sm"
      >
        {/* Round Logo */}
        <Image
          src="/scuml-logo.PNG"
          alt="SCUML Logo"
          borderRadius="full"
          boxSize="80px"
          objectFit="cover"
        />

        <Text fontSize="2xl" fontWeight="bold" color="red.500">
          SCUML Login
        </Text>

        {!needsTotp ? (
          <>
            <Input
              placeholder="Username"
              value={username}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setUsername(e.target.value)
              }
            />

            <Box position="relative" w="full">
              <Input
                placeholder="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setPassword(e.target.value)
                }
                pr="10"
              />
              <Button
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                variant="ghost"
                size="sm"
                onClick={() => setShowPassword((s) => !s)}
                position="absolute"
                top="50%"
                right="6px"
                transform="translateY(-50%)"
                p="0"
                w="32px"
                h="32px"
                minW="32px"
              >
                {showPassword ? <ViewOffIcon /> : <ViewIcon />}
              </Button>
            </Box>

            {error && <Text color="red.400">{error}</Text>}

            <Button
              colorScheme="red"
              onClick={handleSubmit}
              w="full"
              disabled={!username || !password || submitting || !csrfToken}
            >
              {submitting ? 'Logging in…' : 'Login'}
            </Button>
          </>
        ) : (
          <>
            <Text fontSize="sm" color="gray.600" textAlign="center">
              Enter the 6-digit code from Google Authenticator for <b>{username}</b>.
            </Text>

            <Input
              placeholder="123456"
              inputMode="numeric"
              maxLength={6}
              value={totpCode}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setTotpCode(e.target.value.replace(/[^0-9]/g, ''))
              }
              textAlign="center"
              fontSize="xl"
              letterSpacing="0.3em"
            />

            {error && <Text color="red.400">{error}</Text>}

            <Button
              colorScheme="red"
              onClick={handleVerifyTotp}
              w="full"
              disabled={totpCode.length !== 6 || submitting || !csrfToken}
            >
              {submitting ? 'Verifying…' : 'Verify'}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setNeedsTotp(false);
                setTotpCode('');
                setError('');
              }}
            >
              Back
            </Button>
          </>
        )}
      </VStack>
    </Box>
  );
}
