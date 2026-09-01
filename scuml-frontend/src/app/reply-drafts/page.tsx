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

type Reply = {
  _id: string;
  title?: string;
  refNo?: string;
  address?: string;
  to?: string;
  date?: string;
  subject?: string;
  message?: string;
  createdBy: string;
  createdAt: string;
};

export default function ReplyDraftsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedReply, setSelectedReply] = useState<Reply | null>(null);
  const { isOpen: isViewOpen, onOpen: onViewOpen, onClose: onViewClose } = useDisclosure();

  // 🔹 Staff and superadmin may view Reply Drafts (not guest).
  useEffect(() => {
    if (!authLoading && user && user.role === 'guest') {
      router.replace('/');
    }
  }, [authLoading, user, router]);

  const fetchReplies = async () => {
    try {
      setLoading(true);
      const res = await axios.get<Reply[]>(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/replies`, {
        withCredentials: true,
      });
      setReplies(res.data || []);
    } catch (err) {
      console.error('Failed to fetch replies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user && user.role !== 'guest') {
      fetchReplies();
    }
  }, [authLoading, user]);

  const handleView = (reply: Reply) => {
    setSelectedReply(reply);
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
            Reply Drafts
          </Text>
          <VStack align="stretch" spacing={2} w="full">
            <Button size="md" variant="outline" onClick={() => router.push('/')}>
              Back to Home
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
          {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
        </Text>

        {loading ? (
          <Spinner />
        ) : replies.length === 0 ? (
          <Text color="gray.500">No replies yet.</Text>
        ) : (
          <VStack align="stretch" spacing={2}>
            {replies.map((reply) => (
              <Flex
                key={reply._id}
                align="center"
                gap={2}
                p={3}
                bg="gray.50"
                borderRadius="md"
                shadow="xs"
                cursor="pointer"
                _hover={{ bg: 'gray.100' }}
                onClick={() => handleView(reply)}
              >
                <Box flex="1">
                  <Text fontWeight="bold" fontSize="sm">
                    {reply.subject || 'Untitled Reply'}
                  </Text>
                  <Text fontSize="xs" color="gray.600" fontWeight="semibold">
                    Entered by: {reply.createdBy || 'N/A'} | Date:{' '}
                    {new Date(reply.createdAt).toLocaleString()} | To: {reply.to || 'N/A'}
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
          <ModalHeader>{selectedReply?.subject || 'Reply'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody overflowY="auto" pb={6}>
            {selectedReply && (
              <VStack align="stretch" spacing={1} fontSize="sm">
                <Text><b>Title:</b> {selectedReply.title || 'N/A'}</Text>
                <Text><b>Ref:</b> {selectedReply.refNo || 'N/A'}</Text>
                <Text><b>Date:</b> {selectedReply.date || 'N/A'}</Text>
                <Text><b>Address:</b> {selectedReply.address || 'N/A'}</Text>
                <Text><b>To:</b> {selectedReply.to || 'N/A'}</Text>
                <Text><b>Subject:</b> {selectedReply.subject || 'N/A'}</Text>
                <Text whiteSpace="pre-wrap" mt={2}><b>Message:</b>{'\n'}{selectedReply.message || 'N/A'}</Text>
                <Text fontSize="xs" color="gray.500" mt={2}>
                  Entered by: {selectedReply.createdBy || 'N/A'} —{' '}
                  {new Date(selectedReply.createdAt).toLocaleString()}
                </Text>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}
