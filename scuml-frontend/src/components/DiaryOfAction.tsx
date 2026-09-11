'use client';

// The company's action log — every entry recorded against it (Off-Site /
// On-Site Inspection, Sanction, Violation, Training, Spot Check, Initiated
// Letter, Compliance Officer, Identification, ...) in one numbered table,
// oldest first, with the date/time it was entered. "Add Entry" lets a
// superadmin type a free-text Description of Activity straight in; it saves
// like any auto-logged action (also shows in Recent Activity).
import {
  Box,
  Button,
  HStack,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  TableContainer,
  useToast,
} from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import PrintPortal from '@/components/PrintPortal';

type DiaryEntry = {
  _id: string;
  type: string;
  summary: string;
  createdBy: string;
  createdAt: string;
};

const TYPE_LABELS: Record<string, string> = {
  identification: 'Identification',
  action: 'Action',
  sanction: 'Sanction',
  violation: 'Violation',
  training: 'Training',
  onsite: 'On-Site Inspection',
  offsite: 'Off-Site Inspection',
  generatedLetter: 'Initiated Letter',
  spotcheck: 'Spot Check',
  complianceOfficer: 'Compliance Officer',
  manualEntry: 'Manual Entry',
  memo: 'Memo',
  reply: 'Reply',
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default function DiaryOfAction({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const toast = useToast();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/recent-activity/company/${companyId}`,
        { withCredentials: true }
      );
      setEntries(res.data || []);
    } catch (err) {
      console.error('Failed to load diary of action:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleSave = async () => {
    const text = description.trim();
    if (!text) {
      toast({ title: 'Enter a description of activity.', status: 'warning', duration: 3000, isClosable: true });
      return;
    }
    setSaving(true);
    try {
      const csrfRes = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
        { withCredentials: true }
      );
      await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/recent-activity/company/${companyId}`,
        { description: text },
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfRes.data.csrfToken } }
      );
      toast({ title: 'Entry saved.', status: 'success', duration: 3000, isClosable: true });
      setDescription('');
      setAdding(false);
      await loadEntries();
    } catch (err) {
      console.error('Failed to save diary entry:', err);
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : 'Failed to save entry.';
      toast({ title: message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner size="sm" />;

  const table = entries.length === 0 ? (
    <Text color="gray.500" fontSize="sm">No actions recorded for this company yet.</Text>
  ) : (
    <TableContainer borderWidth="1px" borderRadius="md">
      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            <Th w="10">S/N</Th>
            <Th whiteSpace="nowrap">Date &amp; Time</Th>
            <Th>Description of Activity</Th>
          </Tr>
        </Thead>
        <Tbody>
          {entries.map((e, i) => (
            <Tr key={e._id}>
              <Td verticalAlign="top">{i + 1}.</Td>
              <Td verticalAlign="top" whiteSpace="nowrap">{formatDateTime(e.createdAt)}</Td>
              <Td whiteSpace="normal">{e.summary || TYPE_LABELS[e.type] || e.type}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableContainer>
  );

  return (
    <Box>
      <HStack justify="space-between" mb={3}>
        <Text fontWeight="bold">{companyName}</Text>
        <HStack spacing={2}>
          <Button
            size="xs"
            colorScheme="green"
            onClick={() => setAdding((v) => !v)}
          >
            {adding ? 'Close' : 'Add Entry'}
          </Button>
          <Button size="xs" colorScheme="red" onClick={() => window.print()}>Print</Button>
        </HStack>
      </HStack>

      {adding && (
        <Box borderWidth="1px" borderRadius="md" p={3} mb={3} bg="gray.50">
          <Text fontSize="sm" fontWeight="semibold" mb={1}>Description of Activity</Text>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Type the activity carried out on this company..."
            rows={3}
            bg="white"
          />
          <HStack mt={2} justify="flex-end">
            <Button size="xs" variant="ghost" onClick={() => { setAdding(false); setDescription(''); }}>
              Cancel
            </Button>
            <Button size="xs" colorScheme="green" onClick={handleSave} isLoading={saving}>
              Save
            </Button>
          </HStack>
        </Box>
      )}

      {table}

      {/* A dedicated, print-only copy — kept out of the way on screen (the
          table above already covers that) and shown only while printing,
          in its own isolated node so window.print() paginates against just
          this table, not whatever else is open behind it. */}
      <PrintPortal screenVisible={false}>
        <Box bg="white" p="15mm" fontFamily="Georgia, serif" color="gray.800">
          <style>{`
            @page { size: A4; margin: 0; }
            @media print { tr { break-inside: avoid; page-break-inside: avoid; } }
          `}</style>
          <Text fontSize="lg" fontWeight="bold" mb={1}>Diary of Action</Text>
          <Text fontSize="sm" color="gray.600" mb={4}>{companyName}</Text>
          {table}
        </Box>
      </PrintPortal>
    </Box>
  );
}
