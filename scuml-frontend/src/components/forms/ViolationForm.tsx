'use client';

import {
  Box,
  Text,
  Input,
  Button,
  VStack,
  FormControl,
  FormLabel,
  useToast,
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import type { CompanyFormProps } from './LetterForm';

type OpenViolationInfo = {
  outstandingBalance?: number;
  openViolationId?: string | null;
  amountSanctioned?: number | null;
  amountPaidSoFar?: number | null;
};

const formatNaira = (raw: string) => {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(Number(digits));
};

const parseAmount = (formatted: string) => {
  const digits = formatted.replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
};

const formatSignedNaira = (n: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(n);

// Self-contained — looks up whether this company already has an open
// (unpaid) violation itself, rather than requiring the caller to know that,
// so it behaves identically whether the company came from a search-select
// step (the standalone page) or was already known (embedded in the
// Company Compliance Record modal).
export default function ViolationForm({ companyId, companyName, onSuccess }: CompanyFormProps) {
  const [openInfo, setOpenInfo] = useState<OpenViolationInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [amountSanctioned, setAmountSanctioned] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const hasOpenViolation = !!openInfo?.openViolationId;
  const balance = parseAmount(amountSanctioned) - parseAmount(amountPaid);
  const remainingAfterPayment = hasOpenViolation
    ? (openInfo?.outstandingBalance || 0) - parseAmount(paymentAmount)
    : 0;

  useEffect(() => {
    let cancelled = false;
    const fetchOpenInfo = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/violations/search?query=${encodeURIComponent(companyName)}`,
          { withCredentials: true }
        );
        const match = (res.data || []).find((c: { _id: string }) => c._id === companyId);
        if (!cancelled) setOpenInfo(match || null);
      } catch (err) {
        console.error('Failed to check existing violation:', err);
      } finally {
        if (!cancelled) setLoadingInfo(false);
      }
    };
    fetchOpenInfo();
    return () => {
      cancelled = true;
    };
  }, [companyId, companyName]);

  const handleSubmit = async () => {
    const csrfRes = await axios.get(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
      { withCredentials: true }
    );
    const csrfToken = csrfRes.data.csrfToken;

    if (hasOpenViolation) {
      if (!paymentAmount || parseAmount(paymentAmount) <= 0) {
        toast({ title: 'Please enter a payment amount', status: 'warning', duration: 3000, isClosable: true });
        return;
      }

      setSubmitting(true);
      try {
        await axios.put(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/violations/${openInfo!.openViolationId}/pay`,
          { paymentAmount: parseAmount(paymentAmount) },
          { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } }
        );
        toast({ title: 'Payment recorded.', description: 'The balance has been updated.', status: 'success', duration: 4000, isClosable: true });
        onSuccess();
      } catch (err) {
        console.error('Failed to record payment:', err);
        toast({ title: 'Failed to record payment.', status: 'error', duration: 4000, isClosable: true });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!amountSanctioned || !amountPaid) {
      toast({ title: 'Please fill all fields', status: 'warning', duration: 3000, isClosable: true });
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/violations`,
        {
          company: companyId,
          amountSanctioned: parseAmount(amountSanctioned),
          amountPaid: parseAmount(amountPaid),
        },
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } }
      );
      toast({ title: 'Violation saved.', description: 'The violation record has been successfully saved.', status: 'success', duration: 4000, isClosable: true });
      onSuccess();
    } catch (err) {
      console.error('Failed to save violation:', err);
      toast({ title: 'Failed to save violation.', status: 'error', duration: 4000, isClosable: true });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInfo) {
    return <Text fontSize="sm" color="gray.500">Checking existing balance…</Text>;
  }

  return (
    <VStack spacing={4} align="stretch">
      {hasOpenViolation ? (
        <>
          <Box p={3} borderWidth="1px" borderRadius="md" bg="red.50" borderColor="red.200">
            <Text fontWeight="bold" color="red.600">
              Existing Outstanding Balance: {formatSignedNaira(openInfo?.outstandingBalance || 0)}
            </Text>
            <Text fontSize="xs" color="red.600">
              Sanctioned {formatSignedNaira(openInfo?.amountSanctioned || 0)} · Paid so far{' '}
              {formatSignedNaira(openInfo?.amountPaidSoFar || 0)}
            </Text>
          </Box>

          <FormControl>
            <FormLabel>Payment Amount</FormLabel>
            <Input
              type="text"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(formatNaira(e.target.value))}
              placeholder="₦0.00"
            />
          </FormControl>

          <Box
            p={3}
            borderWidth="1px"
            borderRadius="md"
            bg={remainingAfterPayment > 0 ? 'red.50' : 'green.50'}
            borderColor={remainingAfterPayment > 0 ? 'red.200' : 'green.200'}
          >
            <Text fontWeight="bold" color={remainingAfterPayment > 0 ? 'red.600' : 'green.600'}>
              Balance After This Payment: {formatSignedNaira(remainingAfterPayment)}
            </Text>
          </Box>

          <Button colorScheme="red" onClick={handleSubmit} isLoading={submitting}>
            Record Payment
          </Button>
        </>
      ) : (
        <>
          <FormControl>
            <FormLabel>Amount Sanctioned</FormLabel>
            <Input
              type="text"
              value={amountSanctioned}
              onChange={(e) => setAmountSanctioned(formatNaira(e.target.value))}
              placeholder="₦0.00"
            />
          </FormControl>

          <FormControl>
            <FormLabel>Amount Paid</FormLabel>
            <Input
              type="text"
              value={amountPaid}
              onChange={(e) => setAmountPaid(formatNaira(e.target.value))}
              placeholder="₦0.00"
            />
          </FormControl>

          <Box
            p={3}
            borderWidth="1px"
            borderRadius="md"
            bg={balance > 0 ? 'red.50' : 'green.50'}
            borderColor={balance > 0 ? 'red.200' : 'green.200'}
          >
            <Text fontWeight="bold" color={balance > 0 ? 'red.600' : 'green.600'}>
              Balance: {formatSignedNaira(balance)}
            </Text>
          </Box>

          <Button colorScheme="red" onClick={handleSubmit} isLoading={submitting}>
            Save Violation
          </Button>
        </>
      )}
    </VStack>
  );
}
