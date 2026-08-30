'use client';

import {
  Box,
  Text,
  HStack,
  VStack,
  Flex,
  Button,
  Input,
  FormControl,
  FormLabel,
  Spinner,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  useDisclosure,
  Checkbox,
} from '@chakra-ui/react';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';

type LibraryDoc = {
  _id: string;
  library?: string;
  title?: string;
  originalName?: string;
  fileSize?: number;
  createdBy: string;
  createdAt: string;
};

const formatSize = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function LibraryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [library, setLibrary] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [docs, setDocs] = useState<LibraryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [csrfToken, setCsrfToken] = useState('');

  // View modal — fetched once as a blob so Download/Print/Share can all
  // reuse the same bytes instead of re-fetching per action.
  const [selectedDoc, setSelectedDoc] = useState<LibraryDoc | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [opening, setOpening] = useState(false);
  const { isOpen: isViewOpen, onOpen: onViewOpen, onClose: onViewCloseRaw } = useDisclosure();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingSelected, setDeletingSelected] = useState(false);

  // 🔹 Only a superadmin may view the Library.
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

  const fetchDocs = async () => {
    try {
      setLoading(true);
      const res = await axios.get<LibraryDoc[]>(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/library`, {
        withCredentials: true,
      });
      setDocs(res.data || []);
    } catch (err) {
      console.error('Failed to fetch library documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user?.role === 'superadmin') {
      fetchDocs();
    }
  }, [authLoading, user]);

  const handleSubmit = async () => {
    if (!file) {
      toast({ title: 'Choose a PDF file first.', status: 'warning', duration: 3000, isClosable: true });
      return;
    }
    setSubmitting(true);
    try {
      const csrfRes = await axios.get(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`, {
        withCredentials: true,
      });
      const formData = new FormData();
      formData.append('library', library);
      formData.append('title', title);
      formData.append('pdf', file);

      await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/library`, formData, {
        withCredentials: true,
        headers: { 'X-CSRF-Token': csrfRes.data.csrfToken },
      });

      toast({ title: 'Document saved.', status: 'success', duration: 3000, isClosable: true });
      setLibrary('');
      setTitle('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchDocs();
    } catch (err) {
      console.error('Failed to upload document:', err);
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : 'Failed to save document.';
      toast({ title: message, status: 'error', duration: 5000, isClosable: true });
    } finally {
      setSubmitting(false);
    }
  };

  const onViewClose = () => {
    onViewCloseRaw();
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(null);
    setBlob(null);
    setSelectedDoc(null);
  };

  const handleOpen = async (doc: LibraryDoc) => {
    setSelectedDoc(doc);
    setOpening(true);
    onViewOpen();
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/library/${doc._id}/file`,
        { withCredentials: true, responseType: 'blob' }
      );
      const b = res.data as Blob;
      setBlob(b);
      setBlobUrl(URL.createObjectURL(b));
    } catch (err) {
      console.error('Failed to load document:', err);
      toast({ title: 'Failed to load document.', status: 'error', duration: 4000, isClosable: true });
    } finally {
      setOpening(false);
    }
  };

  const handleDownload = () => {
    if (!blob || !selectedDoc) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = selectedDoc.originalName || `${selectedDoc.title || 'document'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handlePrint = () => {
    if (!blobUrl) return;
    const printWindow = window.open(blobUrl, '_blank');
    if (!printWindow) {
      toast({ title: 'Pop-up blocked — allow pop-ups to print.', status: 'warning', duration: 4000, isClosable: true });
      return;
    }
    printWindow.addEventListener('load', () => {
      printWindow.print();
    });
  };

  const handleShare = async () => {
    if (!blob || !selectedDoc) return;
    const fileToShare = new File(
      [blob],
      selectedDoc.originalName || `${selectedDoc.title || 'document'}.pdf`,
      { type: 'application/pdf' }
    );
    if (navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
      try {
        await navigator.share({
          files: [fileToShare],
          title: selectedDoc.title || selectedDoc.originalName || 'Document',
        });
      } catch (err) {
        // AbortError just means the user cancelled the share sheet.
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    } else {
      toast({ title: 'Sharing files is not supported on this browser — use Download instead.', status: 'info', duration: 5000, isClosable: true });
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      prev.size === docs.length ? new Set() : new Set(docs.map((d) => d._id))
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const confirmDelete = window.confirm(
      `Permanently delete ${selectedIds.size} document(s)? This cannot be undone.`
    );
    if (!confirmDelete) return;

    setDeletingSelected(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          axios.delete(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/library/${id}`, {
            withCredentials: true,
            headers: { 'X-CSRF-Token': csrfToken || '' },
          })
        )
      );
      toast({ title: `${selectedIds.size} document(s) deleted.`, status: 'success', duration: 4000, isClosable: true });
      setDocs((prev) => prev.filter((d) => !selectedIds.has(d._id)));
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to delete selected documents:', err);
      toast({ title: 'Failed to delete some documents.', status: 'error', duration: 4000, isClosable: true });
    } finally {
      setDeletingSelected(false);
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
      <HStack justify="center" mb={6}>
        <Text fontSize="2xl" fontWeight="bold" color="red.500">
          Library
        </Text>
        <Button size="sm" variant="outline" onClick={() => router.push('/')} ml={4}>
          Back to Home
        </Button>
      </HStack>

      <Box maxW="600px" mx="auto" bg="white" borderRadius="xl" boxShadow="lg" p={{ base: 4, md: 6 }} mb={8}>
        <VStack spacing={4} align="stretch">
          <FormControl>
            <FormLabel>Library</FormLabel>
            <Input value={library} onChange={(e) => setLibrary(e.target.value)} placeholder="e.g. Compliance Circulars" />
          </FormControl>

          <FormControl>
            <FormLabel>Title</FormLabel>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" />
          </FormControl>

          <FormControl>
            <FormLabel>Upload PDF</FormLabel>
            <Input
              type="file"
              accept="application/pdf"
              ref={fileInputRef}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              p={1}
            />
          </FormControl>

          <Button colorScheme="red" onClick={handleSubmit} isLoading={submitting}>
            Submit
          </Button>
        </VStack>
      </Box>

      <Box maxW="900px" mx="auto" bg="white" borderRadius="xl" boxShadow="lg" p={{ base: 4, md: 6 }}>
        <Text fontSize="lg" fontWeight="bold" mb={4}>
          {docs.length} {docs.length === 1 ? 'document' : 'documents'}
        </Text>

        {loading ? (
          <Spinner />
        ) : docs.length === 0 ? (
          <Text color="gray.500">No documents yet.</Text>
        ) : (
          <>
            <Flex justify="space-between" align="center" mb={2}>
              <Checkbox
                size="sm"
                isChecked={selectedIds.size === docs.length}
                isIndeterminate={selectedIds.size > 0 && selectedIds.size < docs.length}
                onChange={toggleSelectAll}
              >
                <Text fontSize="xs">Select All</Text>
              </Checkbox>
              <Button
                size="xs"
                colorScheme="red"
                isDisabled={selectedIds.size === 0}
                isLoading={deletingSelected}
                onClick={handleDeleteSelected}
              >
                Delete Selected ({selectedIds.size})
              </Button>
            </Flex>
            <VStack align="stretch" spacing={2}>
              {docs.map((doc) => (
                <Flex
                  key={doc._id}
                  align="center"
                  gap={2}
                  p={3}
                  bg="gray.50"
                  borderRadius="md"
                  shadow="xs"
                  cursor="pointer"
                  _hover={{ bg: 'gray.100' }}
                  onClick={() => handleOpen(doc)}
                >
                  <Box onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      size="sm"
                      isChecked={selectedIds.has(doc._id)}
                      onChange={() => toggleSelected(doc._id)}
                    />
                  </Box>
                  <Box flex="1">
                    <Text fontWeight="bold" fontSize="sm">
                      {doc.title || doc.originalName || 'Untitled Document'}
                    </Text>
                    <Text fontSize="xs" color="gray.600" fontWeight="semibold">
                      {doc.library ? `${doc.library} | ` : ''}Entered by: {doc.createdBy || 'N/A'} | Date:{' '}
                      {new Date(doc.createdAt).toLocaleString()} | {formatSize(doc.fileSize)}
                    </Text>
                  </Box>
                </Flex>
              ))}
            </VStack>
          </>
        )}
      </Box>

      {/* 🔹 View / Download / Share / Print */}
      <Modal isOpen={isViewOpen} onClose={onViewClose} size="4xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent mx={4} h="85vh">
          <ModalHeader pr={12}>
            <Text noOfLines={1}>{selectedDoc?.title || selectedDoc?.originalName || 'Document'}</Text>
            <HStack mt={2} spacing={2}>
              <Button size="xs" colorScheme="purple" onClick={handleDownload} isDisabled={!blob}>
                Download
              </Button>
              <Button size="xs" colorScheme="cyan" onClick={handleShare} isDisabled={!blob}>
                Share
              </Button>
              <Button size="xs" colorScheme="red" onClick={handlePrint} isDisabled={!blobUrl}>
                Print
              </Button>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody p={0}>
            {opening ? (
              <Box display="flex" alignItems="center" justifyContent="center" h="full">
                <Spinner size="xl" />
              </Box>
            ) : blobUrl ? (
              <Box as="iframe" src={blobUrl} w="full" h="full" border="none" title="Document preview" />
            ) : (
              <Box p={4}>
                <Text color="gray.500">Unable to load this document.</Text>
              </Box>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}
