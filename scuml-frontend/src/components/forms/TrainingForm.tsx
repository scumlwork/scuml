'use client';

import { useState } from 'react';
import { Box, Button, Input, FormControl, FormLabel, useToast } from '@chakra-ui/react';
import type { CompanyFormProps } from './LetterForm';

const today = new Date().toISOString().split('T')[0];

export default function TrainingForm({ companyId, onSuccess }: CompanyFormProps) {
  const [formData, setFormData] = useState({
    date: today,
    facilitator: '',
    participants: '',
    topic: '',
  });
  const [csrfToken, setCsrfToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let token = csrfToken;
      if (!token) {
        const csrfRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`, {
          credentials: 'include',
        });
        token = (await csrfRes.json()).csrfToken;
        setCsrfToken(token);
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/trainings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': token,
        },
        body: JSON.stringify({ company: companyId, ...formData }),
        credentials: 'include',
      });

      if (res.ok) {
        toast({
          title: 'Training record saved successfully!',
          status: 'success',
          duration: 2500,
          isClosable: true,
        });
        onSuccess();
      } else {
        const errText = await res.text();
        toast({
          title: 'Failed to save training record.',
          description: errText,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (err) {
      console.error('Error saving training:', err);
      toast({ title: 'Error saving training.', status: 'error', duration: 4000, isClosable: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box fontSize="xs">
      <FormControl mb={4}>
        <FormLabel fontSize="sm">Date of Training</FormLabel>
        <Input type="date" name="date" value={formData.date} onChange={handleChange} />
      </FormControl>

      <FormControl mb={4}>
        <FormLabel fontSize="sm">Name of Facilitator</FormLabel>
        <Input
          type="text"
          name="facilitator"
          placeholder="Enter facilitator's name"
          value={formData.facilitator}
          onChange={handleChange}
        />
      </FormControl>

      <FormControl mb={4}>
        <FormLabel fontSize="sm">No. of Participants</FormLabel>
        <Input
          type="number"
          name="participants"
          placeholder="Enter number of participants"
          value={formData.participants}
          onChange={handleChange}
        />
      </FormControl>

      <FormControl mb={6}>
        <FormLabel fontSize="sm">Topic of Training</FormLabel>
        <Input
          type="text"
          name="topic"
          placeholder="Enter training topic"
          value={formData.topic}
          onChange={handleChange}
        />
      </FormControl>

      <Box textAlign="center">
        <Button colorScheme="green" size="lg" onClick={handleSubmit} isLoading={submitting}>
          Submit
        </Button>
      </Box>
    </Box>
  );
}
