'use client';

import {
  Box,
  Flex,
  Text,
  VStack,
  Button,
  Badge,
  Spinner,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  useDisclosure,
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';

type Memo = {
  _id: string;
  kind: 'memo';
  to?: string;
  through?: string;
  from?: string;
  date?: string;
  refNo?: string;
  subject?: string;
  message?: string;
  createdBy: string;
  createdAt: string;
};

type Reply = {
  _id: string;
  kind: 'reply';
  title?: string;
  refNo?: string;
  date?: string;
  address?: string;
  to?: string;
  subject?: string;
  message?: string;
  createdBy: string;
  createdAt: string;
};

type Entry = Memo | Reply;

export default function MemoDraftsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const { isOpen: isViewOpen, onOpen: onViewOpen, onClose: onViewClose } = useDisclosure();

  // 🔹 Staff and superadmin may view this page (not guest).
  useEffect(() => {
    if (!authLoading && user && user.role === 'guest') {
      router.replace('/');
    }
  }, [authLoading, user, router]);

  // Memos and Replies are separate collections/routes, but every reply sent
  // shows up here alongside memos — merged and sorted newest-first — rather
  // than only on its own separate page.
  const fetchEntries = async () => {
    try {
      setLoading(true);
      const [memosRes, repliesRes] = await Promise.all([
        axios.get<Omit<Memo, 'kind'>[]>(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/memos`, {
          withCredentials: true,
        }),
        axios.get<Omit<Reply, 'kind'>[]>(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/replies`, {
          withCredentials: true,
        }),
      ]);
      const merged: Entry[] = [
        ...(memosRes.data || []).map((m) => ({ ...m, kind: 'memo' as const })),
        ...(repliesRes.data || []).map((r) => ({ ...r, kind: 'reply' as const })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setEntries(merged);
    } catch (err) {
      console.error('Failed to fetch memos/replies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user && user.role !== 'guest') {
      fetchEntries();
    }
  }, [authLoading, user]);

  const handleView = (entry: Entry) => {
    setSelectedEntry(entry);
    onViewOpen();
  };

  if (authLoading || !user) {
    return (
      <Box h="100vh" display="flex" alignItems="center" justifyContent="center">
        <Spinner size="xl" />
      </Box>
    );
  }

  if (user.role === 'guest') return null;

  return (
    <Box p={5}>
      <Flex
        align={{ base: 'stretch', md: 'flex-start' }}
        direction={{ base: 'column', md: 'row' }}
        gap={{ base: 4, md: 8 }}
        mt={{ base: 10, md: 20 }}
      >
        {/* Left column: title + nav buttons — a separate flex item, not
            nested inside the card, so moving one never shifts the other. */}
        <VStack align="start" spacing={3} minW={{ md: '170px' }}>
          <Text fontSize="2xl" fontWeight="bold" color="red.500">
            Memo/Replies
          </Text>
          <VStack align="stretch" spacing={2} w="full">
            <Button size="md" variant="outline" onClick={() => router.push('/')}>
              Back to Home
            </Button>
            <Button size="md" colorScheme="pink" onClick={() => router.push('/memo')}>
              + My Memo
            </Button>
            <Button size="md" colorScheme="teal" onClick={() => router.push('/reply')}>
              + Reply
            </Button>
          </VStack>
        </VStack>

        {/* Right column: the card section — sits at the same top level as
            the left column, independent of it. */}
        <Box flex="1" maxW="900px" ml={{ base: 0, md: 24 }} bg="white" borderRadius="xl" boxShadow="lg" p={{ base: 4, md: 6 }}>
        <Text fontSize="lg" fontWeight="bold" mb={4}>
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </Text>

        {loading ? (
          <Spinner />
        ) : entries.length === 0 ? (
          <Text color="gray.500">No memos or replies yet.</Text>
        ) : (
          <VStack align="stretch" spacing={2}>
            {entries.map((entry) => (
              <Flex
                key={`${entry.kind}-${entry._id}`}
                align="center"
                gap={2}
                p={3}
                bg="gray.50"
                borderRadius="md"
                shadow="xs"
                cursor="pointer"
                _hover={{ bg: 'gray.100' }}
                onClick={() => handleView(entry)}
              >
                <Box flex="1">
                  <Flex align="center" gap={2}>
                    <Badge colorScheme={entry.kind === 'memo' ? 'pink' : 'teal'} fontSize="0.6em">
                      {entry.kind === 'memo' ? 'Memo' : 'Reply'}
                    </Badge>
                    <Text fontWeight="bold" fontSize="sm">
                      {entry.subject || (entry.kind === 'memo' ? 'Untitled Memo' : 'Untitled Reply')}
                    </Text>
                  </Flex>
                  <Text fontSize="xs" color="gray.600" fontWeight="semibold">
                    Entered by: {entry.createdBy || 'N/A'} | Date:{' '}
                    {new Date(entry.createdAt).toLocaleString()} |{' '}
                    {entry.kind === 'memo' ? `Ref: ${entry.refNo || 'N/A'}` : `To: ${entry.to || 'N/A'}`}
                  </Text>
                </Box>
              </Flex>
            ))}
          </VStack>
        )}
        </Box>
      </Flex>

      {/* 🔹 View modal */}
      <Modal isOpen={isViewOpen} onClose={onViewClose} scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent mx={4} maxH="80vh">
          <ModalHeader>{selectedEntry?.subject || (selectedEntry?.kind === 'memo' ? 'Memo' : 'Reply')}</ModalHeader>
          <ModalCloseButton />
          <ModalBody overflowY="auto" pb={6}>
            {selectedEntry && selectedEntry.kind === 'memo' && (
              <VStack align="stretch" spacing={1} fontSize="sm">
                <Text><b>To:</b> {selectedEntry.to || 'N/A'}</Text>
                <Text><b>Through:</b> {selectedEntry.through || 'N/A'}</Text>
                <Text><b>From:</b> {selectedEntry.from || 'N/A'}</Text>
                <Text><b>Date:</b> {selectedEntry.date || 'N/A'}</Text>
                <Text><b>Ref:</b> {selectedEntry.refNo || 'N/A'}</Text>
                <Text><b>Subject:</b> {selectedEntry.subject || 'N/A'}</Text>
                <Text whiteSpace="pre-wrap" mt={2}><b>Message:</b>{'\n'}{selectedEntry.message || 'N/A'}</Text>
                <Text fontSize="xs" color="gray.500" mt={2}>
                  Entered by: {selectedEntry.createdBy || 'N/A'} —{' '}
                  {new Date(selectedEntry.createdAt).toLocaleString()}
                </Text>
              </VStack>
            )}
            {selectedEntry && selectedEntry.kind === 'reply' && (
              <VStack align="stretch" spacing={1} fontSize="sm">
                <Text><b>Title:</b> {selectedEntry.title || 'N/A'}</Text>
                <Text><b>Ref:</b> {selectedEntry.refNo || 'N/A'}</Text>
                <Text><b>Date:</b> {selectedEntry.date || 'N/A'}</Text>
                <Text whiteSpace="pre-wrap"><b>Address:</b> {selectedEntry.address || 'N/A'}</Text>
                <Text><b>To:</b> {selectedEntry.to || 'N/A'}</Text>
                <Text><b>Subject:</b> {selectedEntry.subject || 'N/A'}</Text>
                <Text whiteSpace="pre-wrap" mt={2}><b>Message:</b>{'\n'}{selectedEntry.message || 'N/A'}</Text>
                <Text fontSize="xs" color="gray.500" mt={2}>
                  Entered by: {selectedEntry.createdBy || 'N/A'} —{' '}
                  {new Date(selectedEntry.createdAt).toLocaleString()}
                </Text>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}
