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
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Checkbox,
  TableContainer,
} from '@chakra-ui/react';
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import type { CompanyFormProps } from './LetterForm';
import { VIOLATIONS_LIST } from '@/lib/violationFines';

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
  const [paymentAmount, setPaymentAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // When a company already has an open violation, "+ Add More" defaults to
  // reopening the full checklist (to cite further offences against the same
  // record) rather than the payment view — payment is still reachable via
  // the toggle below.
  const [mode, setMode] = useState<'checklist' | 'payment'>('checklist');
  const toast = useToast();

  // Checked fines — keyed "<sn>-professions" / "<sn>-businesses" — selected
  // from the official DNFBP sanctions schedule instead of a manual amount.
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const toggleFine = (key: string) =>
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));

  const selectedViolations = useMemo(() => {
    const result: { sn: number; offence: string; category: 'professions' | 'businesses'; amount: number; label: string }[] = [];
    for (const v of VIOLATIONS_LIST) {
      if (checked[`${v.sn}-professions`]) {
        result.push({ sn: v.sn, offence: v.offence, category: 'professions', amount: v.professions.amount, label: v.professions.label });
      }
      if (checked[`${v.sn}-businesses`]) {
        result.push({ sn: v.sn, offence: v.offence, category: 'businesses', amount: v.businesses.amount, label: v.businesses.label });
      }
    }
    return result;
  }, [checked]);

  const totalFines = selectedViolations.reduce((sum, v) => sum + v.amount, 0);

  const hasOpenViolation = !!openInfo?.openViolationId;
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

    if (hasOpenViolation && mode === 'payment') {
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

    if (selectedViolations.length === 0) {
      toast({ title: 'Select at least one violation', status: 'warning', duration: 3000, isClosable: true });
      return;
    }

    setSubmitting(true);
    try {
      if (hasOpenViolation) {
        // Append to the existing open violation instead of creating a
        // separate record for the same company.
        await axios.put(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/violations/${openInfo!.openViolationId}/add-violations`,
          { selectedViolations },
          { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } }
        );
        toast({ title: 'Violations added.', description: 'The additional offences have been added to the existing record.', status: 'success', duration: 4000, isClosable: true });
      } else {
        await axios.post(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/violations`,
          {
            company: companyId,
            amountSanctioned: totalFines,
            amountPaid: 0,
            selectedViolations,
          },
          { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } }
        );
        toast({ title: 'Violation saved.', description: 'The violation record has been successfully saved.', status: 'success', duration: 4000, isClosable: true });
      }
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

  const checklistView = (
    <>
      <Text fontSize="sm" color="gray.600">
        Select every offence that applies, under whichever column (Professions or
        Businesses) fits this company. The total below updates automatically.
      </Text>

      <TableContainer maxH="420px" overflowY="auto" borderWidth="1px" borderRadius="md">
        <Table size="sm">
          <Thead position="sticky" top={0} bg="white" zIndex={1}>
            <Tr>
              <Th w="8">S/N</Th>
              <Th>Offence</Th>
              <Th>Professions</Th>
              <Th>Businesses</Th>
            </Tr>
          </Thead>
          <Tbody>
            {VIOLATIONS_LIST.map((v) => (
              <Tr key={v.sn}>
                <Td verticalAlign="top">{v.sn}.</Td>
                <Td whiteSpace="normal" fontSize="xs" minW="220px" verticalAlign="top">
                  {v.offence}
                </Td>
                <Td whiteSpace="normal" fontSize="xs" verticalAlign="top">
                  <Checkbox
                    isChecked={!!checked[`${v.sn}-professions`]}
                    onChange={() => toggleFine(`${v.sn}-professions`)}
                  >
                    {v.professions.label}
                  </Checkbox>
                </Td>
                <Td whiteSpace="normal" fontSize="xs" verticalAlign="top">
                  <Checkbox
                    isChecked={!!checked[`${v.sn}-businesses`]}
                    onChange={() => toggleFine(`${v.sn}-businesses`)}
                  >
                    {v.businesses.label}
                  </Checkbox>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>

      <Box p={3} borderWidth="1px" borderRadius="md" bg="red.50" borderColor="red.200">
        <Text fontWeight="bold" color="red.600">
          Total Sanctioned Amount: {formatSignedNaira(totalFines)}
        </Text>
        <Text fontSize="xs" color="red.600">
          {selectedViolations.length} violation{selectedViolations.length === 1 ? '' : 's'} selected
        </Text>
      </Box>

      <Button colorScheme="red" onClick={handleSubmit} isLoading={submitting}>
        {hasOpenViolation ? 'Add Selected Violations' : 'Save Violation'}
      </Button>
    </>
  );

  return (
    <VStack spacing={4} align="stretch">
      {hasOpenViolation && (
        <Box p={3} borderWidth="1px" borderRadius="md" bg="red.50" borderColor="red.200">
          <Text fontWeight="bold" color="red.600">
            Existing Outstanding Balance: {formatSignedNaira(openInfo?.outstandingBalance || 0)}
          </Text>
          <Text fontSize="xs" color="red.600">
            Sanctioned {formatSignedNaira(openInfo?.amountSanctioned || 0)} · Paid so far{' '}
            {formatSignedNaira(openInfo?.amountPaidSoFar || 0)}
          </Text>
        </Box>
      )}

      {hasOpenViolation && (
        <Box>
          <Button
            size="sm"
            variant={mode === 'checklist' ? 'solid' : 'outline'}
            colorScheme="red"
            mr={2}
            onClick={() => setMode('checklist')}
          >
            Add More Violations
          </Button>
          <Button
            size="sm"
            variant={mode === 'payment' ? 'solid' : 'outline'}
            colorScheme="red"
            onClick={() => setMode('payment')}
          >
            Record Payment
          </Button>
        </Box>
      )}

      {hasOpenViolation && mode === 'payment' ? (
        <>
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
        checklistView
      )}
    </VStack>
  );
}
