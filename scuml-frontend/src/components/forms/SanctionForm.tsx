'use client';

import {
  Box,
  Input,
  Button,
  VStack,
  FormControl,
  FormLabel,
  Select,
  useToast,
} from '@chakra-ui/react';
import { useState, useRef } from 'react';
import axios from 'axios';
import type { CompanyFormProps } from './LetterForm';

interface SanctionFormProps extends CompanyFormProps {
  initialNatureOfBusiness?: string;
}

export default function SanctionForm({
  companyId,
  initialNatureOfBusiness = '',
  onSuccess,
}: SanctionFormProps) {
  const [natureOfBusiness, setNatureOfBusiness] = useState(initialNatureOfBusiness);
  const [amount, setAmount] = useState('');
  const [modeOfPayment, setModeOfPayment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);
  const toast = useToast();

  const handleSubmit = async () => {
    if (!natureOfBusiness || !amount || !modeOfPayment) {
      toast({ title: 'Please fill all fields', status: 'warning', duration: 3000, isClosable: true });
      return;
    }

    setSubmitting(true);
    try {
      const csrfRes = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
        { withCredentials: true }
      );
      const csrfToken = csrfRes.data.csrfToken;

      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/sanctions`,
        {
          company: companyId,
          natureOfBusiness,
          amount: Number(amount.replace(/[^0-9]/g, '')),
          modeOfPayment,
        },
        { withCredentials: true, headers: { 'CSRF-Token': csrfToken } }
      );

      if (receiptFile) {
        try {
          const formData = new FormData();
          formData.append('receipt', receiptFile);
          await axios.post(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/sanctions/${res.data._id}/receipt`,
            formData,
            { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } }
          );
        } catch (uploadErr) {
          console.error('Receipt upload failed:', uploadErr);
          toast({
            title: 'Sanction saved, but the receipt upload failed.',
            description: 'You can re-upload it later from the admin panel.',
            status: 'warning',
            duration: 5000,
            isClosable: true,
          });
        }
      }

      toast({
        title: 'Sanction saved.',
        description: 'The sanction record has been successfully saved.',
        status: 'success',
        duration: 4000,
        isClosable: true,
      });
      onSuccess();
    } catch (err) {
      console.error('Failed to save sanction:', err);
      toast({ title: 'Failed to save sanction.', status: 'error', duration: 4000, isClosable: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <VStack spacing={4} align="stretch">
      <FormControl>
        <FormLabel>Nature of Business</FormLabel>
        <Input
          value={natureOfBusiness}
          onChange={(e) => setNatureOfBusiness(e.target.value)}
          placeholder="Nature of business"
        />
      </FormControl>

      <FormControl>
        <FormLabel>Amount</FormLabel>
        <Input
          type="text"
          value={amount}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9]/g, '');
            if (!raw) {
              setAmount('');
              return;
            }
            setAmount(
              new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: 'NGN',
                minimumFractionDigits: 0,
              }).format(Number(raw))
            );
          }}
          placeholder="₦0.00"
        />
      </FormControl>

      <FormControl>
        <FormLabel>Mode of Payment</FormLabel>
        <Select value={modeOfPayment} onChange={(e) => setModeOfPayment(e.target.value)}>
          <option value="">Select</option>
          <option value="Cash">Cash</option>
          <option value="Bank Transfer">Bank Transfer</option>
          <option value="Bank Draft">Bank Draft</option>
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel>Upload Receipt</FormLabel>
        <Input
          ref={receiptInputRef}
          type="file"
          accept="image/*,application/pdf"
          p={1}
          onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
        />
      </FormControl>

      <Box>
        <Button colorScheme="red" onClick={handleSubmit} isLoading={submitting}>
          Save Sanction
        </Button>
      </Box>
    </VStack>
  );
}
