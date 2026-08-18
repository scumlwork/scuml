'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Text,
  HStack,
  VStack,
  SimpleGrid,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Checkbox,
  Badge,
  Button,
  Spinner,
  useToast,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  useDisclosure,
} from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';

type AuditEntry = {
  _id: string;
  eventType:
    | 'login_success'
    | 'login_failed'
    | 'brute_force_lockout'
    | 'totp_failed'
    | 'injection_attempt'
    | 'malware_blocked';
  username: string;
  ip: string;
  location: string;
  userAgent: string;
  createdAt: string;
};

const EVENT_LABELS: Record<AuditEntry['eventType'], string> = {
  login_success: 'Successful Login',
  login_failed: 'Failed Login',
  brute_force_lockout: 'Brute Force Lockout',
  totp_failed: 'Failed 2FA Code',
  injection_attempt: 'Injection Attempt',
  malware_blocked: 'Malware Blocked',
};

const EVENT_COLORS: Record<AuditEntry['eventType'], string> = {
  login_success: 'green',
  login_failed: 'orange',
  brute_force_lockout: 'red',
  totp_failed: 'red',
  injection_attempt: 'purple',
  malware_blocked: 'purple',
};

// Any non-success event counts as an "attack" — a failed attempt, the system
// actively blocking one after too many tries, a request caught trying to
// smuggle a database operator into a field (NoSQL injection), or an infected
// file caught before it reached storage.
//
// There's no "attacks that got through" figure here on purpose: every one of
// these defenses is unconditional (the operator is always stripped, the
// account always locks at 3 tries, an infected file is always rejected), not
// a filter with a pass-through rate — so that number would always be zero
// and isn't worth a card of its own.
const ATTACK_TYPES: AuditEntry['eventType'][] = [
  'login_failed',
  'brute_force_lockout',
  'totp_failed',
  'injection_attempt',
  'malware_blocked',
];

// The per-type breakdown grid — deliberately excludes login_failed (still
// counted in "Stopped by Defense" and still visible in the table below, just
// not given its own summary tile).
const BREAKDOWN_TYPES: AuditEntry['eventType'][] = [
  'brute_force_lockout',
  'totp_failed',
  'injection_attempt',
  'malware_blocked',
];


export default function AuditLogPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [csrfToken, setCsrfToken] = useState('');
  const [deleting, setDeleting] = useState(false);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  // 🔹 Only the owner account may view this page, even if logged in as a
  // regular superadmin.
  useEffect(() => {
    if (!authLoading && user && !user.isOwner) {
      router.replace('/');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    const fetchCsrf = async () => {
      try {
        const res = await axios.get(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`, {
          withCredentials: true,
        });
        setCsrfToken(res.data.csrfToken);
      } catch (err) {
        console.error('Failed to fetch CSRF token:', err);
      }
    };
    fetchCsrf();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await axios.get<AuditEntry[]>(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/audit-log`, {
        withCredentials: true,
      });
      setLogs(res.data || []);
    } catch (err) {
      console.error('Failed to fetch audit log:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user?.isOwner) {
      fetchLogs();
    }
  }, [authLoading, user]);

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = logs.length > 0 && selectedIds.size === logs.length;
  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(logs.map((l) => l._id)));
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0 || !csrfToken) return;
    setDeleting(true);
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/audit-log`, {
        withCredentials: true,
        headers: { 'X-CSRF-Token': csrfToken },
        data: { ids: Array.from(selectedIds) },
      });
      toast({
        title: `${selectedIds.size} log entr${selectedIds.size === 1 ? 'y' : 'ies'} permanently deleted.`,
        status: 'success',
        duration: 4000,
        isClosable: true,
      });
      setSelectedIds(new Set());
      onClose();
      fetchLogs();
    } catch (err) {
      console.error('Failed to delete log entries:', err);
      toast({ title: 'Failed to delete log entries.', status: 'error', duration: 4000, isClosable: true });
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <Box h="100vh" display="flex" alignItems="center" justifyContent="center">
        <Spinner size="xl" />
      </Box>
    );
  }

  if (!user.isOwner) return null;

  const totalAttacks = logs.filter((l) => ATTACK_TYPES.includes(l.eventType)).length;
  const attackBreakdown = BREAKDOWN_TYPES.map((type) => ({
    type,
    count: logs.filter((l) => l.eventType === type).length,
  }));

  return (
    <Box p={5}>
      <HStack justify="center" spacing={4} mb={6}>
        <Text fontSize="2xl" fontWeight="bold" color="red.500">
          Audit Log
        </Text>
      </HStack>

      {/* 🔹 Total stopped — every defense here is unconditional (operator always
          stripped, account always locks at 3 tries, infected file always
          rejected), so there's no "got through" figure to show alongside it. */}
      <SimpleGrid columns={{ base: 1 }} spacing={4} mb={4} maxW="900px" mx="auto">
        <Box p={4} borderWidth="1px" borderRadius="md" bg="red.50" borderColor="red.200">
          <Text fontSize="sm" color="red.600">Stopped by Defense</Text>
          <Text fontSize="2xl" fontWeight="bold" color="red.700">{totalAttacks}</Text>
        </Box>
      </SimpleGrid>

      {/* 🔹 Attack type breakdown */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6} maxW="900px" mx="auto">
        {attackBreakdown.map(({ type, count }) => (
          <Box key={type} p={4} borderWidth="1px" borderRadius="md">
            <Text fontSize="sm" color="gray.600">{EVENT_LABELS[type]}</Text>
            <Text fontSize="2xl" fontWeight="bold">{count}</Text>
          </Box>
        ))}
      </SimpleGrid>

      <Box maxW="1100px" mx="auto" bg="white" borderRadius="xl" boxShadow="lg" p={{ base: 4, md: 6 }}>
        <HStack justify="space-between" mb={4} flexWrap="wrap" gap={2}>
          <Text fontSize="lg" fontWeight="bold">
            {logs.length} log {logs.length === 1 ? 'entry' : 'entries'}
          </Text>
          <Button
            size="sm"
            colorScheme="red"
            onClick={onOpen}
            isDisabled={selectedIds.size === 0}
          >
            Delete Selected ({selectedIds.size})
          </Button>
        </HStack>

        {loading ? (
          <Spinner />
        ) : logs.length === 0 ? (
          <Text color="gray.500">No log entries yet.</Text>
        ) : (
          <Box overflowX="auto">
            <Table size="sm" variant="simple">
              <Thead>
                <Tr>
                  <Th><Checkbox isChecked={allSelected} onChange={toggleAll} /></Th>
                  <Th>Event</Th>
                  <Th>Username</Th>
                  <Th>IP Address</Th>
                  <Th>Location</Th>
                  <Th>Date &amp; Time</Th>
                </Tr>
              </Thead>
              <Tbody>
                {logs.map((log) => (
                  <Tr key={log._id}>
                    <Td>
                      <Checkbox
                        isChecked={selectedIds.has(log._id)}
                        onChange={() => toggleOne(log._id)}
                      />
                    </Td>
                    <Td>
                      <Badge colorScheme={EVENT_COLORS[log.eventType]}>
                        {EVENT_LABELS[log.eventType] || log.eventType}
                      </Badge>
                    </Td>
                    <Td>{log.username || 'N/A'}</Td>
                    <Td>{log.ip || 'N/A'}</Td>
                    <Td>{log.location || 'N/A'}</Td>
                    <Td whiteSpace="nowrap">{new Date(log.createdAt).toLocaleString()}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </Box>

      {/* 🔹 Permanent delete confirmation */}
      <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose}>
        <AlertDialogOverlay>
          <AlertDialogContent mx={4}>
            <AlertDialogHeader>Delete {selectedIds.size} log {selectedIds.size === 1 ? 'entry' : 'entries'}?</AlertDialogHeader>
            <AlertDialogBody>
              <VStack align="start" spacing={2}>
                <Text>This permanently removes the selected entries from the database. This cannot be undone.</Text>
              </VStack>
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>Cancel</Button>
              <Button colorScheme="red" onClick={handleDeleteSelected} ml={3} isLoading={deleting}>
                Delete Permanently
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}
