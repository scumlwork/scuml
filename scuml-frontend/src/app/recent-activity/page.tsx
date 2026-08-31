'use client';

import {
  Box,
  Text,
  HStack,
  VStack,
  Badge,
  Button,
  Spinner,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  useDisclosure,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
} from '@chakra-ui/react';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import ChatThread, { type ReferencedEntry } from '@/components/ChatThread';

type ActivityType = 'identification' | 'action' | 'sanction' | 'violation' | 'training' | 'onsite' | 'offsite' | 'generatedLetter' | 'spotcheck' | 'memo';

type Activity = {
  _id: string;
  type: ActivityType;
  refId: string;
  companyId?: string;
  companyName: string;
  summary: string;
  createdBy: string;
  createdAt: string;
};

const TYPE_LABELS: Record<ActivityType, string> = {
  identification: 'Identification',
  action: 'Action',
  sanction: 'Sanction',
  violation: 'Violation',
  training: 'Training',
  onsite: 'On-Site Inspection',
  offsite: 'Off-Site Inspection',
  generatedLetter: 'Initiated Letter',
  spotcheck: 'Spot Check',
  memo: 'Memo',
};

const TYPE_COLORS: Record<ActivityType, string> = {
  identification: 'green',
  action: 'blue',
  sanction: 'orange',
  violation: 'red',
  training: 'teal',
  onsite: 'purple',
  offsite: 'pink',
  generatedLetter: 'yellow',
  spotcheck: 'cyan',
  memo: 'pink',
};

// Each type's own single-record API path, used both to fetch details for
// "View" and to actually delete the underlying record.
const API_PATH: Record<ActivityType, string> = {
  identification: 'registrations',
  action: 'letters',
  sanction: 'sanctions',
  violation: 'violations',
  training: 'trainings',
  onsite: 'on-site-inspections',
  offsite: 'offsite-inspections',
  generatedLetter: 'generated-letters',
  spotcheck: 'spot-checks',
  memo: 'memos',
};

const DATE_KEYS = new Set(['createdAt', 'updatedAt', 'dateOfReporting']);
const CURRENCY_KEYS = new Set(['amount', 'amountSanctioned', 'amountPaid']);

const formatNaira = (n: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(n);

function formatDetailValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return 'N/A';

  // Populated company reference — show its name instead of the raw object.
  if (key === 'company' && typeof value === 'object' && value !== null && 'companyName' in value) {
    const c = value as { companyName?: string; natureOfBusiness?: string };
    return `${c.companyName || 'N/A'}${c.natureOfBusiness ? ` (${c.natureOfBusiness})` : ''}`;
  }

  // Monetary amounts — comma-separated with the Naira sign.
  if (CURRENCY_KEYS.has(key) && typeof value === 'number') {
    return formatNaira(value);
  }

  // Timestamps — show a readable local date/time instead of raw ISO text.
  if (DATE_KEYS.has(key) && typeof value === 'string') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toLocaleString();
  }

  // Contact list — one line per contact instead of a JSON blob.
  if (key === 'contacts' && Array.isArray(value)) {
    if (value.length === 0) return 'None';
    return value
      .map((c: { name?: string; position?: string; phone?: string; email?: string }, i: number) =>
        `${i + 1}. ${c.name || ''}${c.position ? ` (${c.position})` : ''} — ${c.phone || ''}${c.email ? ` — ${c.email}` : ''}`
      )
      .join('; ');
  }

  // Payment history — same idea.
  if (key === 'payments' && Array.isArray(value)) {
    if (value.length === 0) return 'None';
    return value
      .map((p: { amount?: number; date?: string }) =>
        `${formatNaira(p.amount ?? 0)} on ${p.date ? new Date(p.date).toLocaleDateString() : 'N/A'}`
      )
      .join('; ');
  }

  // Cited offences on a Violation — offence, fine label, and which category
  // (Professions/Businesses) it was cited under.
  if (key === 'selectedViolations' && Array.isArray(value)) {
    if (value.length === 0) return 'None';
    return value
      .map((sv: { sn?: number; offence?: string; label?: string; category?: string }) =>
        `${sv.sn}. ${sv.offence} — ${sv.label} (${sv.category === 'professions' ? 'Professions' : 'Businesses'})`
      )
      .join('; ');
  }

  // Plain array of ids/strings (photos, related-record references) — a
  // count reads better than a wall of ObjectIds.
  if (Array.isArray(value)) {
    if (value.length === 0) return 'None';
    if (value.every((v) => typeof v === 'string')) return `${value.length} item(s)`;
    return JSON.stringify(value);
  }

  if (typeof value === 'object') return JSON.stringify(value);

  return String(value);
}

export default function RecentActivityPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [csrfToken, setCsrfToken] = useState('');

  const [viewDetail, setViewDetail] = useState<Record<string, unknown> | null>(null);
  const [viewing, setViewing] = useState(false);
  const { isOpen: isViewOpen, onOpen: onViewOpen, onClose: onViewClose } = useDisclosure();

  const [pendingDelete, setPendingDelete] = useState<Activity | null>(null);
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  const [chatActivity, setChatActivity] = useState<Activity | null>(null);
  const { isOpen: isChatOpen, onOpen: onChatOpen, onClose: onChatClose } = useDisclosure();

  // 🔹 Only a superadmin may view Recent Activity.
  useEffect(() => {
    if (!authLoading && user && user.role !== 'superadmin') {
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

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const res = await axios.get<Activity[]>(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/recent-activity`,
        { withCredentials: true }
      );
      setActivities(res.data || []);
    } catch (err) {
      console.error('Failed to fetch recent activity:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user?.role === 'superadmin') {
      fetchActivities();
    }
  }, [authLoading, user]);

  const handleView = async (activity: Activity) => {
    setViewing(true);
    onViewOpen();
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/${API_PATH[activity.type]}/${activity.refId}`,
        { withCredentials: true }
      );
      setViewDetail(res.data);
    } catch (err) {
      console.error('Failed to load record:', err);
      toast({ title: 'Failed to load record details.', status: 'error', duration: 4000, isClosable: true });
    } finally {
      setViewing(false);
    }
  };

  const handleEdit = (activity: Activity) => {
    // Memos aren't tied to a company — editing one takes you to the same
    // page that creates a memo, in edit mode, so saving also regenerates
    // the letter with the updated content.
    if (activity.type === 'memo') {
      router.push(`/memo?id=${activity.refId}`);
      return;
    }
    // Reuse the admin database page's own edit UI — deep-link to the company.
    router.push(`/database?company=${activity.companyId}`);
  };

  const handleClose = async (activity: Activity) => {
    if (!csrfToken) return;
    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/recent-activity/${activity._id}/dismiss`,
        {},
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } }
      );
      setActivities((prev) => prev.filter((a) => a._id !== activity._id));
    } catch (err) {
      console.error('Failed to close activity:', err);
      toast({ title: 'Failed to close entry.', status: 'error', duration: 4000, isClosable: true });
    }
  };

  const handleDelete = (activity: Activity) => {
    setPendingDelete(activity);
    onDeleteOpen();
  };

  const handleOpenChat = (activity: Activity) => {
    setChatActivity(activity);
    onChatOpen();
  };

  const performDelete = async () => {
    if (!pendingDelete || !csrfToken) return;
    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/${API_PATH[pendingDelete.type]}/${pendingDelete.refId}`,
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } }
      );
      setActivities((prev) => prev.filter((a) => a._id !== pendingDelete._id));
      toast({ title: 'Record deleted.', status: 'success', duration: 3000, isClosable: true });
    } catch (err) {
      console.error('Failed to delete record:', err);
      toast({ title: 'Failed to delete record.', status: 'error', duration: 4000, isClosable: true });
    } finally {
      setPendingDelete(null);
      onDeleteClose();
    }
  };

  if (authLoading || !user) {
    return (
      <Box h="100vh" display="flex" alignItems="center" justifyContent="center">
        <Spinner size="xl" />
      </Box>
    );
  }

  if (user.role !== 'superadmin') return null;

  return (
    <Box p={5}>
      <HStack justify="center" spacing={4} mb={6}>
        <Text fontSize="2xl" fontWeight="bold" color="red.500">
          Recent Activity
        </Text>
      </HStack>

      <Box maxW="900px" mx="auto" bg="white" borderRadius="xl" boxShadow="lg" p={{ base: 4, md: 6 }}>
        <Text fontSize="lg" fontWeight="bold" mb={4}>
          {activities.length} active {activities.length === 1 ? 'entry' : 'entries'}
        </Text>

        {loading ? (
          <Spinner />
        ) : activities.length === 0 ? (
          <Text color="gray.500">No new activity.</Text>
        ) : (
          <VStack align="stretch" spacing={3}>
            {activities.map((activity) => (
              <Box key={activity._id} p={3} borderWidth="1px" borderRadius="md">
                <HStack justify="space-between" align="start" flexWrap="wrap" gap={2}>
                  <Box>
                    <HStack mb={1}>
                      <Badge colorScheme={TYPE_COLORS[activity.type]}>
                        {TYPE_LABELS[activity.type]}
                      </Badge>
                      <Text fontWeight="semibold">{activity.companyName}</Text>
                    </HStack>
                    <Text fontSize="sm" color="gray.700">{activity.summary}</Text>
                    <Text fontSize="xs" color="gray.500">
                      Entered by: {activity.createdBy || 'N/A'} —{' '}
                      {new Date(activity.createdAt).toLocaleString()}
                    </Text>
                  </Box>
                  <HStack>
                    {activity.createdBy && activity.createdBy !== user.username && (
                      <Button size="xs" colorScheme="cyan" onClick={() => handleOpenChat(activity)}>
                        Chat
                      </Button>
                    )}
                    <Button size="xs" colorScheme="gray" onClick={() => handleView(activity)}>
                      View
                    </Button>
                    <Button size="xs" colorScheme="blue" onClick={() => handleEdit(activity)}>
                      Edit
                    </Button>
                    <Button size="xs" colorScheme="red" onClick={() => handleDelete(activity)}>
                      Delete
                    </Button>
                    <Button size="xs" variant="outline" onClick={() => handleClose(activity)}>
                      Close
                    </Button>
                  </HStack>
                </HStack>
              </Box>
            ))}
          </VStack>
        )}
      </Box>

      {/* 🔹 View modal */}
      <Modal isOpen={isViewOpen} onClose={onViewClose} scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent mx={4} maxH="80vh">
          <ModalHeader>Record Details</ModalHeader>
          <ModalCloseButton />
          <ModalBody overflowY="auto" pb={6}>
            {viewing ? (
              <Spinner />
            ) : viewDetail ? (
              <VStack align="stretch" spacing={1}>
                {Object.entries(viewDetail)
                  .filter(([key]) => !['__v', '_id'].includes(key))
                  .map(([key, value]) => (
                    <Text key={key} fontSize="sm">
                      <b>{key}:</b> {formatDetailValue(key, value)}
                    </Text>
                  ))}
              </VStack>
            ) : (
              <Text color="gray.500">No details available.</Text>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* 🔹 Delete confirmation */}
      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent mx={4}>
            <AlertDialogHeader>Delete this record?</AlertDialogHeader>
            <AlertDialogBody>
              This permanently deletes {pendingDelete ? TYPE_LABELS[pendingDelete.type] : 'the'} record for{' '}
              {pendingDelete?.companyName}. This cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>Cancel</Button>
              <Button colorScheme="red" onClick={performDelete} ml={3}>
                Yes, delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* 🔹 Chat with whoever made this entry — the entry itself rides
          along as context on the first message. */}
      <Modal isOpen={isChatOpen} onClose={onChatClose} size="md">
        <ModalOverlay />
        <ModalContent mx={4}>
          <ModalHeader>Chat with {chatActivity?.createdBy}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={4}>
            {chatActivity && (
              <ChatThread
                otherUsername={chatActivity.createdBy}
                initialReferencedEntry={{
                  type: chatActivity.type,
                  refId: chatActivity.refId,
                  companyId: chatActivity.companyId,
                  companyName: chatActivity.companyName,
                  summary: chatActivity.summary,
                }}
                onChatDeleted={onChatClose}
              />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}
