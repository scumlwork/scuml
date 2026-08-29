'use client';

import {
  Box,
  Flex,
  Text,
  VStack,
  Button,
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

export default function MemoDraftsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null);
  const { isOpen: isViewOpen, onOpen: onViewOpen, onClose: onViewClose } = useDisclosure();

  // 🔹 Staff and superadmin may view Memo Drafts (not guest).
  useEffect(() => {
    if (!authLoading && user && user.role === 'guest') {
      router.replace('/');
    }
  }, [authLoading, user, router]);

  const fetchMemos = async () => {
    try {
      setLoading(true);
      const res = await axios.get<Memo[]>(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/memos`, {
        withCredentials: true,
      });
      setMemos(res.data || []);
    } catch (err) {
      console.error('Failed to fetch memos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user && user.role !== 'guest') {
      fetchMemos();
    }
  }, [authLoading, user]);

  const handleView = (memo: Memo) => {
    setSelectedMemo(memo);
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
            Memo Drafts
          </Text>
          <VStack align="stretch" spacing={2} w="full">
            <Button size="md" variant="outline" onClick={() => router.push('/')}>
              Back to Home
            </Button>
            <Button size="md" colorScheme="pink" onClick={() => router.push('/memo')}>
              + My Memo
            </Button>
          </VStack>
        </VStack>

        {/* Right column: the card section — sits at the same top level as
            the left column, independent of it. */}
        <Box flex="1" maxW="900px" ml={{ base: 0, md: 24 }} bg="white" borderRadius="xl" boxShadow="lg" p={{ base: 4, md: 6 }}>
        <Text fontSize="lg" fontWeight="bold" mb={4}>
          {memos.length} {memos.length === 1 ? 'memo' : 'memos'}
        </Text>

        {loading ? (
          <Spinner />
        ) : memos.length === 0 ? (
          <Text color="gray.500">No memos yet.</Text>
        ) : (
          <VStack align="stretch" spacing={2}>
            {memos.map((memo) => (
              <Flex
                key={memo._id}
                align="center"
                gap={2}
                p={3}
                bg="gray.50"
                borderRadius="md"
                shadow="xs"
                cursor="pointer"
                _hover={{ bg: 'gray.100' }}
                onClick={() => handleView(memo)}
              >
                <Box flex="1">
                  <Text fontWeight="bold" fontSize="sm">
                    {memo.subject || 'Untitled Memo'}
                  </Text>
                  <Text fontSize="xs" color="gray.600" fontWeight="semibold">
                    Entered by: {memo.createdBy || 'N/A'} | Date:{' '}
                    {new Date(memo.createdAt).toLocaleString()} | Ref: {memo.refNo || 'N/A'}
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
          <ModalHeader>{selectedMemo?.subject || 'Memo'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody overflowY="auto" pb={6}>
            {selectedMemo && (
              <VStack align="stretch" spacing={1} fontSize="sm">
                <Text><b>To:</b> {selectedMemo.to || 'N/A'}</Text>
                <Text><b>Through:</b> {selectedMemo.through || 'N/A'}</Text>
                <Text><b>From:</b> {selectedMemo.from || 'N/A'}</Text>
                <Text><b>Date:</b> {selectedMemo.date || 'N/A'}</Text>
                <Text><b>Ref:</b> {selectedMemo.refNo || 'N/A'}</Text>
                <Text><b>Subject:</b> {selectedMemo.subject || 'N/A'}</Text>
                <Text whiteSpace="pre-wrap" mt={2}><b>Message:</b>{'\n'}{selectedMemo.message || 'N/A'}</Text>
                <Text fontSize="xs" color="gray.500" mt={2}>
                  Entered by: {selectedMemo.createdBy || 'N/A'} —{' '}
                  {new Date(selectedMemo.createdAt).toLocaleString()}
                </Text>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}
