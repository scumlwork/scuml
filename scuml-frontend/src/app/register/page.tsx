'use client';

import { useState, useEffect, type ChangeEvent } from 'react';
import {
  Box,
  Button,
  Flex,
  Input,
  Select,
  Text,
  VStack,
  Image,
  HStack,
  Spinner,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

type ManagedUser = {
  id: string;
  username: string;
  role: 'superadmin' | 'staff';
  isActive: boolean;
  online: boolean;
  createdAt: string;
};

// Mirrors server/src/utils/passwordRules.js — kept in sync so the checklist
// only shows "all met" when the backend will actually accept the password.
const PASSWORD_CRITERIA = [
  { id: 'length', label: 'At least 10 characters', test: (p: string) => p.length >= 10 },
  { id: 'uppercase', label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lowercase', label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { id: 'number', label: 'One number', test: (p: string) => /[0-9]/.test(p) },
  { id: 'special', label: 'One special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];
function isPasswordValid(password: string) {
  return PASSWORD_CRITERIA.every((c) => c.test(password));
}
function PasswordChecklist({ password }: { password: string }) {
  return (
    <HStack spacing={3} rowGap={0.5} mt={1} mb={2} flexWrap="wrap">
      {PASSWORD_CRITERIA.map((c) => {
        const met = c.test(password);
        return (
          <HStack key={c.id} spacing={1}>
            <Text fontSize="xs" color={met ? 'green.500' : 'gray.400'}>
              {met ? '✓' : '○'}
            </Text>
            <Text fontSize="xs" color={met ? 'green.600' : 'gray.500'} whiteSpace="nowrap">
              {c.label}
            </Text>
          </HStack>
        );
      })}
    </HStack>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading: authLoading, setUser } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'staff' | 'superadmin'>('staff');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 🔹 CSRF state
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [csrfLoading, setCsrfLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  // 🔹 User management (list, deactivate, delete, reset password)
  const toast = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetting, setResetting] = useState(false);
  const {
    isOpen: isResetOpen,
    onOpen: onResetOpen,
    onClose: onResetClose,
  } = useDisclosure();

  // 🔹 2FA setup — shown right after creating a new superadmin, or on demand
  // for an existing one (self-service, own account only) via "Set Up 2FA"
  const [totpSetup, setTotpSetup] = useState<{ qrCodeDataUrl: string; manualEntryKey: string } | null>(null);
  const [settingUpTotp, setSettingUpTotp] = useState(false);
  const {
    isOpen: isTotpOpen,
    onOpen: onTotpOpen,
    onClose: onTotpClose,
  } = useDisclosure();

  const handleSetupTotp = async () => {
    if (!csrfToken) return;
    setSettingUpTotp(true);
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/totp-setup`,
        {},
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } }
      );
      setTotpSetup(res.data);
      onTotpOpen();
    } catch (err) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.error
          ? err.response.data.error
          : 'Failed to set up two-factor authentication.';
      toast({ title: message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setSettingUpTotp(false);
    }
  };

  const [renameTarget, setRenameTarget] = useState<ManagedUser | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const {
    isOpen: isRenameOpen,
    onOpen: onRenameOpen,
    onClose: onRenameClose,
  } = useDisclosure();

  // 🔹 Fetch CSRF token on mount
  useEffect(() => {
    const fetchCsrf = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
          { withCredentials: true }
        );
        setCsrfToken(res.data.csrfToken);
      } catch (err) {
        console.error('Failed to fetch CSRF token:', err);
        setError('⚠️ Security initialization failed. Please refresh.');
      } finally {
        setCsrfLoading(false);
      }
    };
    fetchCsrf();
  }, []);

  // 🔸 Admin TOTP session check — DISABLED. Kept commented out (not deleted)
  // so it can be re-enabled later if needed. Access is now gated solely by
  // the superadmin role check below.
  // useEffect(() => {
  //   const checkAdmin = async () => {
  //     try {
  //       await axios.get(
  //         `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin/protected/register`,
  //         { withCredentials: true }
  //       );
  //       setAuthChecked(true); // ✅ Authorized
  //     } catch {
  //       router.replace('/register-auth'); // 🚪 Redirect if not authorized
  //     }
  //   };
  //   checkAdmin();
  // }, [router]);
  useEffect(() => {
    setAuthChecked(true);
  }, []);

  // 🔹 Only a super admin may reach the Create User page, even with a valid TOTP code
  useEffect(() => {
    if (authChecked && !authLoading && user && user.role !== 'superadmin') {
      router.replace('/');
    }
  }, [authChecked, authLoading, user, router]);

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const res = await axios.get<ManagedUser[]>(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users`,
        { withCredentials: true }
      );
      setUsers(res.data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (authChecked && !authLoading && user?.role === 'superadmin') {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, authLoading, user]);

  const handleSubmit = async () => {
    if (!csrfToken) {
      setError('Security token missing, please refresh and try again.');
      return;
    }

    try {
      setError('');
      setSuccess('');
      setSubmitting(true);

      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/register`,
        { username, password, role },
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
        }
      );

      if (res.status === 201 || res.status === 200) {
        setSuccess('✅ Registration successful!');
        setUsername('');
        setPassword('');
        setRole('staff');
        fetchUsers();

        if (res.data?.totpSetup) {
          setTotpSetup(res.data.totpSetup);
          onTotpOpen();
        }
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        console.error('Register error:', err.response?.data);
        setError(
          err.response?.data?.error ||
            err.response?.data?.message ||
            'Registration failed'
        );
      } else {
        setError('Registration failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 🔹 Deactivate / reactivate a user
  const handleToggleActive = async (target: ManagedUser) => {
    if (!csrfToken) return;
    try {
      const res = await axios.put(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users/${target.id}/toggle-active`,
        {},
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } }
      );
      toast({
        title: res.data.isActive ? `${target.username} reactivated.` : `${target.username} deactivated.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      fetchUsers();
    } catch (err) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.error
          ? err.response.data.error
          : 'Action failed.';
      toast({ title: message, status: 'error', duration: 4000, isClosable: true });
    }
  };

  // 🔹 Delete a user
  const handleDeleteUser = async (target: ManagedUser) => {
    if (!csrfToken) return;
    const confirmDelete = window.confirm(
      `Delete ${target.username}? This cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users/${target.id}`,
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } }
      );
      toast({ title: `${target.username} deleted.`, status: 'success', duration: 3000, isClosable: true });
      fetchUsers();
    } catch (err) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.error
          ? err.response.data.error
          : 'Failed to delete user.';
      toast({ title: message, status: 'error', duration: 4000, isClosable: true });
    }
  };

  // 🔹 Reset a user's password (superadmin sets it directly)
  const handleOpenReset = (target: ManagedUser) => {
    setResetTarget(target);
    setResetPasswordValue('');
    setShowResetPassword(false);
    onResetOpen();
  };

  const handleResetPassword = async () => {
    if (!resetTarget || !csrfToken) return;
    if (!isPasswordValid(resetPasswordValue)) {
      toast({ title: 'Password does not meet all requirements.', status: 'warning', duration: 3000, isClosable: true });
      return;
    }

    setResetting(true);
    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users/${resetTarget.id}/reset-password`,
        { newPassword: resetPasswordValue },
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } }
      );
      toast({ title: `Password reset for ${resetTarget.username}.`, status: 'success', duration: 4000, isClosable: true });
      onResetClose();
    } catch (err) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.error
          ? err.response.data.error
          : 'Failed to reset password.';
      toast({ title: message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setResetting(false);
    }
  };

  // 🔹 Change a user's username — independent of their password
  const handleOpenRename = (target: ManagedUser) => {
    setRenameTarget(target);
    setRenameValue(target.username);
    onRenameOpen();
  };

  const handleRenameUsername = async () => {
    if (!renameTarget || !csrfToken) return;
    if (renameValue.trim().length < 3) {
      toast({ title: 'Username must be at least 3 characters.', status: 'warning', duration: 3000, isClosable: true });
      return;
    }

    setRenaming(true);
    try {
      const res = await axios.put(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users/${renameTarget.id}/username`,
        { newUsername: renameValue.trim() },
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } }
      );
      toast({
        title: `Username updated to "${res.data.username}".`,
        status: 'success',
        duration: 4000,
        isClosable: true,
      });

      // If renaming ourselves, update the session context immediately so the
      // sidebar etc. reflect it without needing to log out and back in.
      if (renameTarget.id === user?.id) {
        setUser(user ? { ...user, username: res.data.username } : user);
      }

      onRenameClose();
      fetchUsers();
    } catch (err) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.error
          ? err.response.data.error
          : 'Failed to update username.';
      toast({ title: message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setRenaming(false);
    }
  };

  if (!authChecked || authLoading || !user || user.role !== 'superadmin') {
    return (
      <Box
        h="100vh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        bg="black"
      >
        <Spinner size="xl" color="white" />
      </Box>
    );
  }

  return (
    <Box minH="100vh" bg="black" px={4} pt={{ base: 16, md: 24 }} pb={8}>
      <Box
        bg="white"
        p={{ base: 6, sm: 8 }}
        borderRadius="xl"
        boxShadow="lg"
        w="full"
        maxW="900px"
        mx="auto"
      >
        <HStack spacing={4} mb={6} justify="center">
          <Image
            src="/scuml-logo.PNG"
            alt="SCUML Logo"
            borderRadius="full"
            boxSize="60px"
            objectFit="cover"
          />
          <Text fontSize="2xl" fontWeight="bold" color="red.500">
            SCUML Register
          </Text>
        </HStack>

        <Flex direction={{ base: 'column', md: 'row' }} gap={4} align="flex-start">
          {/* Username */}
          <Box flex="1" minW={0}>
            <Input
              placeholder="Username"
              value={username}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setUsername(e.target.value)
              }
            />
          </Box>

          {/* Password with toggle */}
          <Box flex="1" minW={0} position="relative">
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
              aria-label="Toggle password visibility"
              variant="ghost"
              size="sm"
              onClick={() => setShowPassword(!showPassword)}
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
        </Flex>

        <Flex direction={{ base: 'column', md: 'row' }} gap={4} align="center" mt={4}>
          {/* Role */}
          <Box flex="1" minW={0}>
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as 'staff' | 'superadmin')}
            >
              <option value="staff">Staff</option>
              <option value="superadmin">Super Admin</option>
            </Select>
          </Box>

          {/* Action button */}
          <Button
            colorScheme="red"
            onClick={handleSubmit}
            flexShrink={0}
            w={{ base: 'full', md: 'auto' }}
            disabled={
              !username ||
              !password ||
              !isPasswordValid(password) ||
              submitting ||
              !csrfToken ||
              csrfLoading
            }
          >
            {submitting ? 'Registering…' : 'Register'}
          </Button>
        </Flex>

        {password && <PasswordChecklist password={password} />}

        {/* Loading & messages */}
        {csrfLoading && <Spinner size="sm" mt={2} />}
        {error && <Text color="red.400" mt={2}>{error}</Text>}
        {success && <Text color="green.500" mt={2}>{success}</Text>}
      </Box>

      {/* 🔹 User Management */}
      <Box
        mt={10}
        mx="auto"
        w="full"
        maxW="900px"
        bg="white"
        borderRadius="xl"
        boxShadow="lg"
        p={{ base: 4, md: 6 }}
      >
        <Text fontSize="xl" fontWeight="bold" color="red.500" mb={4}>
          All Users
        </Text>

        {usersLoading ? (
          <Spinner />
        ) : (
          <Box overflowX="auto">
            <Table size="sm" variant="simple">
              <Thead>
                <Tr>
                  <Th>Username</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>Presence</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {users.map((u) => (
                  <Tr key={u.id}>
                    <Td>
                      {u.username}
                      {u.id === user.id && (
                        <Text as="span" fontSize="xs" color="gray.500"> (you)</Text>
                      )}
                    </Td>
                    <Td>
                      <Badge colorScheme={u.role === 'superadmin' ? 'purple' : 'gray'}>
                        {u.role === 'superadmin' ? 'Super Admin' : 'Staff'}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge colorScheme={u.isActive ? 'green' : 'red'}>
                        {u.isActive ? 'Active' : 'Deactivated'}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge colorScheme={u.online ? 'green' : 'gray'} variant={u.online ? 'solid' : 'outline'}>
                        {u.online ? 'Online' : 'Offline'}
                      </Badge>
                    </Td>
                    <Td>
                      <HStack spacing={2}>
                        <Button size="xs" colorScheme="teal" onClick={() => handleOpenRename(u)}>
                          Edit Username
                        </Button>
                        <Button size="xs" colorScheme="blue" onClick={() => handleOpenReset(u)}>
                          Reset Password
                        </Button>
                        {u.role === 'superadmin' && u.id === user.id && (
                          <Button
                            size="xs"
                            colorScheme="purple"
                            onClick={handleSetupTotp}
                            isLoading={settingUpTotp}
                          >
                            Set Up 2FA
                          </Button>
                        )}
                        <Button
                          size="xs"
                          colorScheme={u.isActive ? 'orange' : 'green'}
                          onClick={() => handleToggleActive(u)}
                          isDisabled={u.id === user.id}
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          size="xs"
                          colorScheme="red"
                          onClick={() => handleDeleteUser(u)}
                          isDisabled={u.id === user.id}
                        >
                          Delete
                        </Button>
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </Box>

      {/* 🔹 Reset Password Modal */}
      <Modal isOpen={isResetOpen} onClose={onResetClose}>
        <ModalOverlay />
        <ModalContent mx={4}>
          <ModalHeader>
            Reset Password{resetTarget ? ` — ${resetTarget.username}` : ''}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontSize="sm" mb={1}>New Password</Text>
            <Box position="relative">
              <Input
                type={showResetPassword ? 'text' : 'password'}
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                pr="10"
              />
              <Button
                aria-label={showResetPassword ? 'Hide password' : 'Show password'}
                variant="ghost"
                size="sm"
                onClick={() => setShowResetPassword((s) => !s)}
                position="absolute"
                top="50%"
                right="6px"
                transform="translateY(-50%)"
                p="0"
                w="32px"
                h="32px"
                minW="32px"
              >
                {showResetPassword ? <ViewOffIcon /> : <ViewIcon />}
              </Button>
            </Box>
            {resetPasswordValue && <PasswordChecklist password={resetPasswordValue} />}
          </ModalBody>
          <ModalFooter>
            <Button onClick={onResetClose} mr={3} variant="ghost">
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleResetPassword}
              isLoading={resetting}
              isDisabled={!isPasswordValid(resetPasswordValue)}
            >
              Reset
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 🔹 Edit Username Modal */}
      <Modal isOpen={isRenameOpen} onClose={onRenameClose}>
        <ModalOverlay />
        <ModalContent mx={4}>
          <ModalHeader>
            Edit Username{renameTarget ? ` — ${renameTarget.username}` : ''}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontSize="sm" mb={1}>New Username</Text>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
            />
          </ModalBody>
          <ModalFooter>
            <Button onClick={onRenameClose} mr={3} variant="ghost">
              Cancel
            </Button>
            <Button colorScheme="teal" onClick={handleRenameUsername} isLoading={renaming}>
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 🔹 Two-Factor Setup — shown once, right after a superadmin is created */}
      <Modal isOpen={isTotpOpen} onClose={onTotpClose} closeOnOverlayClick={false} closeOnEsc={false} isCentered>
        <ModalOverlay />
        <ModalContent mx={4}>
          <ModalHeader>Set Up Two-Factor Authentication</ModalHeader>
          <ModalBody>
            <VStack spacing={3} align="stretch">
              <Text fontSize="sm" color="gray.600">
                This account is a Super Admin, so it needs Google Authenticator for extra
                security on every future login.
              </Text>
              <VStack spacing={1} align="start" fontSize="sm" color="gray.700">
                <Text>1. Install <b>Google Authenticator</b> on your phone (App Store / Play Store).</Text>
                <Text>2. Open the app and tap the <b>+</b> button.</Text>
                <Text>3. Choose <b>Scan a QR code</b> and point your camera at the code below.</Text>
                <Text>4. From now on, enter the 6-digit code it shows each time you log in.</Text>
              </VStack>

              {totpSetup?.qrCodeDataUrl && (
                <Box textAlign="center" py={2}>
                  <Image
                    src={totpSetup.qrCodeDataUrl}
                    alt="Google Authenticator QR code"
                    boxSize="200px"
                    mx="auto"
                    borderWidth="1px"
                    borderRadius="md"
                    p={2}
                  />
                </Box>
              )}

              <Box>
                <Text fontSize="xs" color="gray.500" mb={1}>
                  Can&apos;t scan? Enter this key manually in the app instead:
                </Text>
                <Text
                  fontSize="sm"
                  fontFamily="monospace"
                  bg="gray.100"
                  p={2}
                  borderRadius="md"
                  wordBreak="break-all"
                >
                  {totpSetup?.manualEntryKey}
                </Text>
              </Box>

              <Text fontSize="xs" color="red.500">
                This code won&apos;t be shown again — set it up now before closing this window.
              </Text>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="red" onClick={() => { onTotpClose(); setTotpSetup(null); }}>
              I&apos;ve Set It Up
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
