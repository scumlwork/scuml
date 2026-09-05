'use client';

// Shown wherever an already-saved Off-Site Inspection document needs to be
// viewed and (optionally) replaced — the Company Compliance Record, the
// Admin page's Off-Site Records tab, and Recent Activity's detail view.
// Word/Excel/.doc render through Microsoft's online viewer so they look
// exactly like they would in Word/Excel; PDFs render natively in an iframe
// (no external viewer needed — browsers already handle PDFs).
import { Box, Button, HStack, Input, Link, Text, useToast } from '@chakra-ui/react';
import axios from 'axios';
import { useRef, useState } from 'react';

function formatFileSize(bytes = 0): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExtension(name = ''): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(name);
  return match ? match[1].toLowerCase() : '';
}

const DOCUMENT_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx';

type ReplacedDocument = { documentUrl: string; documentOriginalName: string; documentFileSize: number };

export default function OffsiteDocumentPanel({
  inspectionId,
  documentUrl,
  documentOriginalName,
  documentFileSize,
  onReplaced,
  allowReplace = true,
  showStorageLocation = false,
}: {
  inspectionId: string;
  documentUrl?: string;
  documentOriginalName?: string;
  documentFileSize?: number;
  onReplaced?: (updated: ReplacedDocument) => void;
  allowReplace?: boolean;
  showStorageLocation?: boolean;
}) {
  const toast = useToast();
  const [replacing, setReplacing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReplace = async (file: File) => {
    setReplacing(true);
    try {
      const csrfRes = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
        { withCredentials: true }
      );
      const formData = new FormData();
      formData.append('document', file);
      const res = await axios.put(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/offsite-inspections/${inspectionId}/document`,
        formData,
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfRes.data.csrfToken } }
      );
      toast({ title: 'Document replaced.', status: 'success', duration: 4000, isClosable: true });
      onReplaced?.(res.data);
    } catch (err) {
      console.error('Failed to replace document:', err);
      toast({ title: 'Failed to replace document.', status: 'error', duration: 4000, isClosable: true });
    } finally {
      setReplacing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!documentUrl) {
    return <Text color="gray.500">No document attached.</Text>;
  }

  const isPdf = fileExtension(documentOriginalName) === 'pdf';

  return (
    <Box>
      <HStack justify="space-between" mb={2} flexWrap="wrap">
        <Link color="blue.600" fontWeight="medium" href={documentUrl} isExternal>
          {documentOriginalName || 'Open document'} ({formatFileSize(documentFileSize)})
        </Link>
        {allowReplace && (
          <HStack>
            <Button size="xs" colorScheme="blue" isLoading={replacing} onClick={() => fileInputRef.current?.click()}>
              Replace Document
            </Button>
            <Input
              ref={fileInputRef}
              type="file"
              accept={DOCUMENT_ACCEPT}
              display="none"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleReplace(file);
              }}
            />
          </HStack>
        )}
      </HStack>

      <Box
        as="iframe"
        src={
          isPdf
            ? documentUrl
            : `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(documentUrl)}`
        }
        w="full"
        h="500px"
        border="1px solid"
        borderColor="gray.200"
        borderRadius="md"
        title="Document preview"
      />
      {!isPdf && (
        <Text fontSize="xs" color="gray.500" mt={1}>
          Rendered by Microsoft&apos;s online viewer — the document is sent to their servers to generate this preview.
        </Text>
      )}

      {showStorageLocation && (
        <Box mt={2} p={2} bg="gray.50" borderRadius="md">
          <Text fontSize="xs" color="gray.500" mb={1}>Storage location:</Text>
          <Text fontSize="xs" wordBreak="break-all" fontFamily="mono">{documentUrl}</Text>
        </Box>
      )}
    </Box>
  );
}
