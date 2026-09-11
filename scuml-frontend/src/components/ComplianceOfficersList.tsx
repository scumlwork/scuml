'use client';

// Renders a company's compliance officers with inline Edit / Delete per
// officer. Used in the main Company Compliance Record and in the admin
// "Company Records" modal, so the edit/delete logic lives in one place.
// Each mutation hits the registration's compliance-officer sub-routes and
// the parent is handed the fresh list via onChange.
import {
  Box,
  Button,
  HStack,
  Input,
  Text,
  VStack,
  FormControl,
  FormLabel,
  useToast,
  useDisclosure,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
} from '@chakra-ui/react';
import { useRef, useState } from 'react';
import axios from 'axios';

export type ComplianceOfficer = {
  _id?: string;
  name?: string;
  position?: string;
  phone?: string;
  email?: string;
};

type Draft = { name: string; position: string; phone: string; email: string };

export default function ComplianceOfficersList({
  companyId,
  officers,
  canEdit,
  onChange,
  headingColor = 'red.600',
  headingSize = 'lg',
}: {
  companyId: string;
  officers: ComplianceOfficer[];
  canEdit: boolean;
  onChange: (officers: ComplianceOfficer[]) => void;
  headingColor?: string;
  headingSize?: string;
}) {
  const toast = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: '', position: '', phone: '', email: '' });
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ComplianceOfficer | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);

  if (!officers || officers.length === 0) return null;

  const startEdit = (o: ComplianceOfficer) => {
    setEditingId(o._id || null);
    setDraft({
      name: o.name || '',
      position: o.position || '',
      phone: o.phone || '',
      email: o.email || '',
    });
  };

  const csrf = async () => {
    const res = await axios.get(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`, {
      withCredentials: true,
    });
    return res.data.csrfToken as string;
  };

  const saveEdit = async (officerId: string) => {
    if (!draft.name.trim() && !draft.position.trim() && !draft.phone.trim() && !draft.email.trim()) {
      toast({ title: 'Enter at least one field.', status: 'warning', duration: 3000, isClosable: true });
      return;
    }
    setBusy(true);
    try {
      const token = await csrf();
      const res = await axios.put(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/registrations/${companyId}/compliance-officers/${officerId}`,
        draft,
        { withCredentials: true, headers: { 'X-CSRF-Token': token } }
      );
      onChange(res.data.complianceOfficers || []);
      setEditingId(null);
      toast({ title: 'Compliance officer updated.', status: 'success', duration: 3000, isClosable: true });
    } catch (err) {
      console.error('Failed to update compliance officer:', err);
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : 'Failed to update compliance officer.';
      toast({ title: message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete?._id) return;
    setBusy(true);
    try {
      const token = await csrf();
      const res = await axios.delete(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/registrations/${companyId}/compliance-officers/${pendingDelete._id}`,
        { withCredentials: true, headers: { 'X-CSRF-Token': token } }
      );
      onChange(res.data.complianceOfficers || []);
      toast({ title: 'Compliance officer removed.', status: 'success', duration: 3000, isClosable: true });
    } catch (err) {
      console.error('Failed to delete compliance officer:', err);
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : 'Failed to delete compliance officer.';
      toast({ title: message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setBusy(false);
      setPendingDelete(null);
      onClose();
    }
  };

  return (
    <Box mt={4}>
      <Text fontSize={headingSize} fontWeight="bold" color={headingColor} mb={1}>
        Compliance Officers
      </Text>
      {officers.map((o, i) => {
        const officerId = o._id;
        const isEditing = !!officerId && editingId === officerId;
        return (
          <Box key={officerId || i} borderWidth="1px" borderRadius="md" p={2} mb={2} fontSize="sm">
            {isEditing ? (
              <VStack spacing={2} align="stretch">
                <FormControl>
                  <FormLabel fontSize="xs" mb={0}>Name</FormLabel>
                  <Input size="sm" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="xs" mb={0}>Position</FormLabel>
                  <Input size="sm" value={draft.position} onChange={(e) => setDraft({ ...draft, position: e.target.value })} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="xs" mb={0}>Phone</FormLabel>
                  <Input size="sm" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="xs" mb={0}>Email</FormLabel>
                  <Input size="sm" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                </FormControl>
                <HStack justify="flex-end">
                  <Button size="xs" variant="ghost" onClick={() => setEditingId(null)} isDisabled={busy}>Cancel</Button>
                  <Button size="xs" colorScheme="green" onClick={() => saveEdit(officerId!)} isLoading={busy}>Save</Button>
                </HStack>
              </VStack>
            ) : (
              <HStack justify="space-between" align="start">
                <Box>
                  <Text><b>Name:</b> {o.name || 'N/A'}</Text>
                  <Text><b>Position:</b> {o.position || 'N/A'}</Text>
                  <Text><b>Phone:</b> {o.phone || 'N/A'}</Text>
                  <Text><b>Email:</b> {o.email || 'N/A'}</Text>
                </Box>
                {canEdit && officerId && (
                  <HStack spacing={1}>
                    <Button size="xs" colorScheme="blue" variant="outline" onClick={() => startEdit(o)}>Edit</Button>
                    <Button
                      size="xs"
                      colorScheme="red"
                      variant="outline"
                      onClick={() => { setPendingDelete(o); onOpen(); }}
                    >
                      Delete
                    </Button>
                  </HStack>
                )}
              </HStack>
            )}
          </Box>
        );
      })}

      <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent mx={4}>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">Remove compliance officer</AlertDialogHeader>
            <AlertDialogBody>
              Remove <b>{pendingDelete?.name || 'this officer'}</b>
              {pendingDelete?.position ? ` (${pendingDelete.position})` : ''} from this company? This cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} variant="ghost" onClick={onClose} isDisabled={busy}>Cancel</Button>
              <Button colorScheme="red" ml={3} onClick={confirmDelete} isLoading={busy}>Remove</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}
