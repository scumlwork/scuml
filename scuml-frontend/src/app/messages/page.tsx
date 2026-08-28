'use client';

import {
  Box,
  Text,
  HStack,
  VStack,
  Badge,
  Button,
  Spinner,
  Select,
  Grid,
  GridItem,
} from '@chakra-ui/react';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import ChatThread from '@/components/ChatThread';

type Conversation = {
  username: string;
  role: string;
  lastMessage: string;
  lastMessageAt: string | null;
  lastMessageFromMe: boolean;
  unreadCount: number;
};

type Contact = { username: string; role: string };

export default function MessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newChatTarget, setNewChatTarget] = useState('');

  const fetchConversations = useCallback(async () => {
    try {
      const res = await axios.get<Conversation[]>(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/messages/conversations`,
        { withCredentials: true }
      );
      setConversations(res.data || []);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      fetchConversations();
      const interval = setInterval(fetchConversations, 10000);
      return () => clearInterval(interval);
    }
  }, [authLoading, user, fetchConversations]);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const res = await axios.get<Contact[]>(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/messages/contacts`,
          { withCredentials: true }
        );
        setContacts(res.data || []);
      } catch (err) {
        console.error('Failed to load contacts:', err);
      }
    };
    if (!authLoading && user) fetchContacts();
  }, [authLoading, user]);

  if (authLoading || !user) {
    return (
      <Box h="100vh" display="flex" alignItems="center" justifyContent="center">
        <Spinner size="xl" />
      </Box>
    );
  }

  const contactsNotInConversation = contacts.filter(
    (c) => !conversations.some((conv) => conv.username === c.username)
  );

  const handleStartNewChat = () => {
    if (!newChatTarget) return;
    setSelected(newChatTarget);
    setNewChatTarget('');
  };

  return (
    <Box p={5}>
      <HStack justify="center" spacing={4} mb={6}>
        <Text fontSize="2xl" fontWeight="bold" color="red.500">
          Messages
        </Text>
        <Button size="sm" variant="outline" onClick={() => router.push('/')}>
          Back to Home
        </Button>
      </HStack>

      <Grid templateColumns={{ base: '1fr', md: '320px 1fr' }} gap={4} maxW="1100px" mx="auto">
        <GridItem bg="white" borderRadius="xl" boxShadow="lg" p={4}>
          <Text fontWeight="bold" mb={2}>
            Start a new chat
          </Text>
          <HStack mb={4}>
            <Select
              placeholder="Select a user"
              size="sm"
              value={newChatTarget}
              onChange={(e) => setNewChatTarget(e.target.value)}
            >
              {contactsNotInConversation.map((c) => (
                <option key={c.username} value={c.username}>
                  {c.username} ({c.role})
                </option>
              ))}
            </Select>
            <Button size="sm" colorScheme="blue" onClick={handleStartNewChat} isDisabled={!newChatTarget}>
              Chat
            </Button>
          </HStack>

          <Text fontWeight="bold" mb={2}>
            Conversations
          </Text>
          {loading ? (
            <Spinner size="sm" />
          ) : conversations.length === 0 ? (
            <Text fontSize="sm" color="gray.500">
              No conversations yet.
            </Text>
          ) : (
            <VStack align="stretch" spacing={1}>
              {conversations.map((c) => (
                <Box
                  key={c.username}
                  p={2}
                  borderRadius="md"
                  cursor="pointer"
                  bg={selected === c.username ? 'blue.50' : 'transparent'}
                  _hover={{ bg: 'gray.100' }}
                  onClick={() => setSelected(c.username)}
                >
                  <HStack justify="space-between">
                    <HStack>
                      <Text fontWeight="semibold" fontSize="sm">
                        {c.username}
                      </Text>
                      <Badge colorScheme={c.role === 'superadmin' ? 'purple' : c.role === 'guest' ? 'yellow' : 'gray'} fontSize="0.6rem">
                        {c.role}
                      </Badge>
                    </HStack>
                    {c.unreadCount > 0 && (
                      <Badge colorScheme="red" borderRadius="full">
                        {c.unreadCount}
                      </Badge>
                    )}
                  </HStack>
                  <Text fontSize="xs" color="gray.600" noOfLines={1}>
                    {c.lastMessageAt ? (
                      <>
                        {c.lastMessageFromMe ? 'You: ' : ''}
                        {c.lastMessage}
                      </>
                    ) : (
                      'No messages yet'
                    )}
                  </Text>
                  {c.lastMessageAt && (
                    <Text fontSize="xs" color="gray.400">
                      {new Date(c.lastMessageAt).toLocaleString()}
                    </Text>
                  )}
                </Box>
              ))}
            </VStack>
          )}
        </GridItem>

        <GridItem bg="white" borderRadius="xl" boxShadow="lg" p={4}>
          {selected ? (
            <ChatThread
              key={selected}
              otherUsername={selected}
              onMessageSent={fetchConversations}
              onChatDeleted={() => setSelected(null)}
            />
          ) : (
            <Box display="flex" alignItems="center" justifyContent="center" h="100%" minH="300px">
              <Text color="gray.500">Select a conversation or start a new chat.</Text>
            </Box>
          )}
        </GridItem>
      </Grid>
    </Box>
  );
}
