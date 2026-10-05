'use client';

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
} from '@chakra-ui/react';
import { useState } from 'react';
import axios from 'axios';
import type { CompanyFormProps } from './LetterForm';

type Officer = { name: string; position: string; phone: string; email: string };
const blankOfficer = (): Officer => ({ name: '', position: '', phone: '', email: '' });

// Add one or more AML/CFT/CPF compliance officers to a company. "ADD More"
// appends another blank set of fields so several officers can be entered in
// one go; each is appended to whatever is already on file.
export default function ComplianceOfficerForm({ companyId, onSuccess }: CompanyFormProps) {
  const toast = useToast();
  const [officers, setOfficers] = useState<Officer[]>([blankOfficer()]);
  const [submitting, setSubmitting] = useState(false);

  const updateOfficer = (index: number, field: keyof Officer, value: string) => {
    setOfficers((prev) => prev.map((o, i) => (i === index ? { ...o, [field]: value } : o)));
  };
  const addOfficer = () => setOfficers((prev) => [...prev, blankOfficer()]);
  const removeOfficer = (index: number) => setOfficers((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    const filled = officers.filter((o) => o.name.trim() || o.position.trim() || o.phone.trim() || o.email.trim());
    if (filled.length === 0) {
      toast({ title: 'Enter at least one compliance officer.', status: 'warning', duration: 3000, isClosable: true });
      return;
    }
    setSubmitting(true);
    try {
      const csrfRes = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
        { withCredentials: true }
      );
      await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/registrations/${companyId}/compliance-officers`,
        { officers: filled },
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfRes.data.csrfToken } }
      );
      toast({ title: 'Compliance officer(s) saved.', status: 'success', duration: 4000, isClosable: true });
      onSuccess();
    } catch (err) {
      console.error('Failed to save compliance officers:', err);
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : 'Failed to save compliance officers.';
      toast({ title: message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <VStack spacing={4} align="stretch">
      {officers.map((officer, index) => (
        <Box key={index} borderWidth="1px" borderRadius="md" p={3}>
          <HStack justify="space-between" mb={2}>
            <Text fontSize="sm" fontWeight="semibold">Compliance Officer {index + 1}</Text>
            {officers.length > 1 && (
              <Button size="xs" variant="ghost" colorScheme="red" onClick={() => removeOfficer(index)}>
                Remove
              </Button>
            )}
          </HStack>
          <VStack spacing={2} align="stretch">
            <FormControl>
              <FormLabel fontSize="sm">Name</FormLabel>
              <Input value={officer.name} onChange={(e) => updateOfficer(index, 'name', e.target.value)} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Position</FormLabel>
              <Input value={officer.position} onChange={(e) => updateOfficer(index, 'position', e.target.value)} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Phone</FormLabel>
              <Input value={officer.phone} onChange={(e) => updateOfficer(index, 'phone', e.target.value)} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Email Address</FormLabel>
              <Input type="email" value={officer.email} onChange={(e) => updateOfficer(index, 'email', e.target.value)} />
            </FormControl>
          </VStack>
        </Box>
      ))}

      <Button size="sm" variant="outline" onClick={addOfficer}>
        + ADD More
      </Button>

      <Button colorScheme="red" onClick={handleSubmit} isLoading={submitting}>
        Submit
      </Button>
    </VStack>
  );
}
