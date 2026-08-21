'use client';

import {
  Button,
  Input,
  Select,
  FormControl,
  FormLabel,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { useState } from 'react';
import axios from 'axios';

// Shared props across every "add a record to this company" form — used both
// on its own standalone page (after a company search/select step) and
// embedded directly in the Company Compliance Record modal, where the
// company is already known. companyId isn't used here (the letters API
// looks the company up by name, not id) but stays in the signature so every
// form component has the same call shape.
export interface CompanyFormProps {
  companyId: string;
  companyName: string;
  onSuccess: () => void;
}

const ACTIVITY_OPTIONS = ['Invitation', 'Inspection', 'Training', 'Warning', 'Sanction'];

const today = new Date().toISOString().split('T')[0];

export default function LetterForm({ companyName, onSuccess }: CompanyFormProps) {
  const toast = useToast();
  const [activity, setActivity] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const csrfRes = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
        { withCredentials: true }
      );
      const csrfToken = csrfRes.data.csrfToken;

      await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/letters`,
        {
          companyName,
          typeOfLetter: activity,
          receiverName,
          phone,
          email,
          dateOfReporting: today,
        },
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } }
      );

      toast({
        title: 'Action submitted.',
        description: 'The action has been successfully saved.',
        status: 'success',
        duration: 4000,
        isClosable: true,
      });
      onSuccess();
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Something went wrong while submitting.',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <VStack spacing={5} align="stretch">
        <FormControl isRequired>
          <FormLabel>Company Name</FormLabel>
          <Input value={companyName} isReadOnly cursor="not-allowed" bg="gray.100" />
        </FormControl>

        <FormControl isRequired>
          <FormLabel>Activities</FormLabel>
          <Select
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            placeholder="Select activity"
          >
            {ACTIVITY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Select>
        </FormControl>

        <FormControl isRequired>
          <FormLabel>Receiver Name</FormLabel>
          <Input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
        </FormControl>

        <FormControl isRequired>
          <FormLabel>Phone</FormLabel>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </FormControl>

        <FormControl>
          <FormLabel>Email (optional)</FormLabel>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormControl>

        <FormControl isRequired>
          <FormLabel>Date of Reporting</FormLabel>
          <Input type="date" value={today} isReadOnly cursor="not-allowed" bg="gray.100" />
        </FormControl>

        <Button type="submit" size="lg" colorScheme="red" borderRadius="xl" isLoading={submitting}>
          Submit Action
        </Button>
      </VStack>
    </form>
  );
}
