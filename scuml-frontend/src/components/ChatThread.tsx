'use client';

import {
  Box,
  VStack,
  HStack,
  Text,
  Textarea,
  Button,
  Spinner,
  Badge,
  useToast,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  useDisclosure,
} from '@chakra-ui/react';
import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';

export type ReferencedEntry = {
  type:
    | 'identification'
    | 'action'
    | 'sanction'
    | 'violation'
    | 'training'
    | 'onsite'
    | 'offsite'
    | 'generatedLetter'
    | 'spotcheck';
  refId?: string;
  companyId?: string;
  companyName?: string;
  summary?: string;
};

type Message = {
  _id: string;
  from: string;
  to: string;
  text: string;
  read: boolean;
  referencedEntry?: ReferencedEntry;
  createdAt: string;
};

const TYPE_LABELS: Record<ReferencedEntry['type'], string> = {
  identification: 'Identification',
  action: 'Action',
  sanction: 'Sanction',
  violation: 'Violation',
  training: 'Training',
  onsite: 'On-Site Inspection',
  offsite: 'Off-Site Inspection',
  generatedLetter: 'Initiated Letter',
  spotcheck: 'Spot Check',
};

// Shared chat UI — used inside the Messages page (every role) and the
// "Chat" modal on the User section. Talks to whichever user `otherUsername`
// names; the backend enforces who's actually allowed to see the thread.
export default function ChatThread({
  otherUsername,
  initialReferencedEntry,
  onMessageSent,
  onChatDeleted,
}: {
  otherUsername: string;
  // When opening a chat from a specific record (Identification, Action,
  // Sanction, etc.), this rides along on the *first* message sent in this
  // session so the conversation stays tied to what it was opened from.
  initialReferencedEntry?: ReferencedEntry;
  onMessageSent?: () => void;
  // Called after a superadmin deletes this chat — the parent should
  // deselect it, since it no longer exists.
  onChatDeleted?: () => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');
  const [pendingEntry, setPendingEntry] = useState<ReferencedEntry | undefined>(initialReferencedEntry);
  const bottomRef = useRef<HTMLDivElement | null>(null);

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

  const fetchThread = useCallback(async () => {
    try {
      const res = await axios.get<Message[]>(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/messages/thread/${encodeURIComponent(otherUsername)}`,
        { withCredentials: true }
      );
      setMessages(res.data || []);
    } catch (err) {
      console.error('Failed to load chat thread:', err);
    } finally {
      setLoading(false);
    }
  }, [otherUsername]);

  const markRead = useCallback(async () => {
    if (!csrfToken) return; // wait for the CSRF token to load — this is a PUT, so it's required
    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/messages/thread/${encodeURIComponent(otherUsername)}/read`,
        {},
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } }
      );
    } catch (err) {
      console.error('Failed to mark thread read:', err);
    }
  }, [otherUsername, csrfToken]);

  useEffect(() => {
    fetchThread();
    markRead();
    // Keep the thread current while it's open — new replies show up without
    // needing to close and reopen it.
    const interval = setInterval(fetchThread, 10000);
    return () => clearInterval(interval);
  }, [fetchThread, markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || !csrfToken) return;
    setSending(true);
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/messages`,
        { to: otherUsername, text: text.trim(), referencedEntry: pendingEntry },
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } }
      );
      setText('');
      setPendingEntry(undefined); // only the first message in this session carries it
      await fetchThread();
      onMessageSent?.();
    } catch (err) {
      console.error('Failed to send message:', err);
      const message =
        axios.isAxiosError(err) && err.response?.data?.error
          ? err.response.data.error
          : 'Failed to send message.';
      toast({ title: message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setSending(false);
    }
  };

  const [closing, setClosing] = useState(false);
  const handleCloseChat = async () => {
    if (!csrfToken) return;
    setClosing(true);
    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/messages/thread/${encodeURIComponent(otherUsername)}/close`,
        {},
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } }
      );
      toast({
        title: `Chat closed — you're hidden from ${otherUsername} again until you message them.`,
        status: 'success',
        duration: 4000,
        isClosable: true,
      });
    } catch (err) {
      console.error('Failed to close chat:', err);
      toast({ title: 'Failed to close chat.', status: 'error', duration: 4000, isClosable: true });
    } finally {
      setClosing(false);
    }
  };

  // Clear: deletes every message but leaves the conversation listed
  // (empty). Delete: deletes the messages *and* removes it from both
  // participants' Conversations lists entirely. Both superadmin-only.
  const [confirmAction, setConfirmAction] = useState<'clear' | 'delete' | null>(null);
  const { isOpen: isConfirmOpen, onOpen: onConfirmOpen, onClose: onConfirmClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const performConfirmedAction = async () => {
    if (!csrfToken || !confirmAction) return;
    setActionLoading(true);
    try {
      const suffix = confirmAction === 'clear' ? '/clear' : '';
      await axios.delete(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/messages/thread/${encodeURIComponent(otherUsername)}${suffix}`,
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } }
      );
      if (confirmAction === 'clear') {
        setMessages([]);
        toast({ title: 'Chat cleared.', status: 'success', duration: 3000, isClosable: true });
      } else {
        toast({ title: 'Chat deleted.', status: 'success', duration: 3000, isClosable: true });
        onChatDeleted?.();
      }
      onMessageSent?.(); // refresh whatever conversation list is showing this
    } catch (err) {
      console.error(`Failed to ${confirmAction} chat:`, err);
      toast({ title: `Failed to ${confirmAction} chat.`, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
      onConfirmClose();
    }
  };

  return (
    <VStack align="stretch" spacing={3} h="100%">
      {(user?.isOwner || user?.role === 'superadmin') && (
        <HStack justify="flex-end" flexWrap="wrap">
          {user?.role === 'superadmin' && (
            <>
              <Button
                size="xs"
                variant="outline"
                colorScheme="orange"
                onClick={() => {
                  setConfirmAction('clear');
                  onConfirmOpen();
                }}
              >
                Clear Chat
              </Button>
              <Button
                size="xs"
                variant="outline"
                colorScheme="red"
                onClick={() => {
                  setConfirmAction('delete');
                  onConfirmOpen();
                }}
              >
                Delete Chat
              </Button>
            </>
          )}
          {user?.isOwner && (
            <Button size="xs" variant="outline" colorScheme="gray" onClick={handleCloseChat} isLoading={closing}>
              Close Chat
            </Button>
          )}
        </HStack>
      )}
      <Box flex="1" overflowY="auto" minH="300px" maxH="50vh" borderWidth="1px" borderRadius="md" p={3}>
        {loading ? (
          <Spinner size="sm" />
        ) : messages.length === 0 ? (
          <Text color="gray.500" fontSize="sm">
            No messages yet — say hello.
          </Text>
        ) : (
          <VStack align="stretch" spacing={2}>
            {messages.map((m) => {
              const mine = m.from === user?.username;
              return (
                <Box key={m._id} alignSelf={mine ? 'flex-end' : 'flex-start'} maxW="80%">
                  {m.referencedEntry && (
                    <Box
                      mb={1}
                      p={2}
                      borderRadius="md"
                      bg="gray.100"
                      fontSize="xs"
                      borderLeftWidth="3px"
                      borderLeftColor="blue.400"
                    >
                      <Badge colorScheme="blue" mr={1}>
                        {TYPE_LABELS[m.referencedEntry.type]}
                      </Badge>
                      {m.referencedEntry.companyName && (
                        <Text as="span" fontWeight="semibold">
                          {m.referencedEntry.companyName}
                        </Text>
                      )}
                      {m.referencedEntry.summary && (
                        <Text mt={0.5} color="gray.600">
                          {m.referencedEntry.summary}
                        </Text>
                      )}
                    </Box>
                  )}
                  <Box
                    px={3}
                    py={2}
                    borderRadius="lg"
                    bg={mine ? 'blue.500' : 'gray.100'}
                    color={mine ? 'white' : 'gray.800'}
                  >
                    <Text fontSize="sm" whiteSpace="pre-wrap">
                      {m.text}
                    </Text>
                  </Box>
                  <Text fontSize="xs" color="gray.500" mt={0.5} textAlign={mine ? 'right' : 'left'}>
                    {mine ? 'You' : m.from} · {new Date(m.createdAt).toLocaleString()}
                  </Text>
                </Box>
              );
            })}
            <div ref={bottomRef} />
          </VStack>
        )}
      </Box>
      {pendingEntry && (
        <Box p={2} borderRadius="md" bg="blue.50" fontSize="xs" borderLeftWidth="3px" borderLeftColor="blue.400">
          <HStack justify="space-between">
            <Box>
              <Badge colorScheme="blue" mr={1}>
                {TYPE_LABELS[pendingEntry.type]}
              </Badge>
              {pendingEntry.companyName && <Text as="span" fontWeight="semibold">{pendingEntry.companyName}</Text>}
              {pendingEntry.summary && <Text color="gray.600">{pendingEntry.summary}</Text>}
            </Box>
            <Button size="xs" variant="ghost" onClick={() => setPendingEntry(undefined)}>
              Remove
            </Button>
          </HStack>
        </Box>
      )}
      <HStack>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          size="sm"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button colorScheme="blue" size="sm" onClick={handleSend} isLoading={sending} isDisabled={!text.trim()}>
          Send
        </Button>
      </HStack>

      <AlertDialog isOpen={isConfirmOpen} leastDestructiveRef={cancelRef} onClose={onConfirmClose}>
        <AlertDialogOverlay>
          <AlertDialogContent mx={4}>
            <AlertDialogHeader>
              {confirmAction === 'clear' ? 'Clear this chat?' : 'Delete this chat?'}
            </AlertDialogHeader>
            <AlertDialogBody>
              {confirmAction === 'clear'
                ? `This permanently deletes every message with ${otherUsername}. The conversation stays in your list, just empty. This cannot be undone.`
                : `This permanently deletes every message with ${otherUsername} and removes them from the Conversations list entirely, for both of you, until a new message is sent. This cannot be undone.`}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onConfirmClose}>
                Cancel
              </Button>
              <Button
                colorScheme={confirmAction === 'clear' ? 'orange' : 'red'}
                onClick={performConfirmedAction}
                ml={3}
                isLoading={actionLoading}
              >
                Yes, {confirmAction === 'clear' ? 'clear' : 'delete'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </VStack>
  );
}
