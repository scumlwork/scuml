'use client';

import {
  Box,
  Text,
  Input,
  Button,
  VStack,
  FormControl,
  FormLabel,
  HStack,
  useToast,
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

type Company = {
  _id: string;
  companyName: string;
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

// Unlike formatNaira (built for stripping live keystrokes), this formats a
// already-computed signed number correctly, including negative balances.
const formatSignedNaira = (n: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(n);

export default function ViolationsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [query, setQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [amountSanctioned, setAmountSanctioned] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');
  const toast = useToast();
  const router = useRouter();

  // An open (not yet fully paid) violation already exists for this company —
  // any amount entered here is a part-payment against that same balance,
  // not a brand new sanction.
  const hasOpenViolation = !!selectedCompany?.openViolationId;

  const balance = parseAmount(amountSanctioned) - parseAmount(amountPaid);
  const remainingAfterPayment = hasOpenViolation
    ? (selectedCompany?.outstandingBalance || 0) - parseAmount(paymentAmount)
    : 0;

  // 🔹 Fetch CSRF token on mount
  useEffect(() => {
    const fetchCsrf = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
          { withCredentials: true }
        );
        setCsrfToken(res.data.csrfToken);
      } catch (err) {
        console.error('Failed to fetch CSRF token:', err);
      }
    };
    fetchCsrf();
  }, []);

  // 🔹 Handle company search — includes each company's existing open violation, if any
  useEffect(() => {
    const fetchCompanies = async () => {
      if (!query) return setCompanies([]);
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/violations/search?query=${query}`,
          { withCredentials: true }
        );
        setCompanies(res.data || []);
      } catch (err) {
        console.error('Company search failed:', err);
      }
    };
    fetchCompanies();
  }, [query]);

  const handleSubmit = async () => {
    if (!selectedCompany) return;

    if (hasOpenViolation) {
      if (!paymentAmount || parseAmount(paymentAmount) <= 0) {
        toast({
          title: 'Please enter a payment amount',
          status: 'warning',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      setSubmitting(true);
      try {
        await axios.put(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/violations/${selectedCompany.openViolationId}/pay`,
          { paymentAmount: parseAmount(paymentAmount) },
          {
            withCredentials: true,
            headers: { 'X-CSRF-Token': csrfToken },
          }
        );

        toast({
          title: 'Payment recorded.',
          description: 'The balance has been updated.',
          status: 'success',
          duration: 4000,
          isClosable: true,
        });
        router.push('/');
      } catch (err) {
        console.error('Failed to record payment:', err);
        toast({
          title: 'Failed to record payment.',
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!amountSanctioned || !amountPaid) {
      toast({
        title: 'Please fill all fields',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/violations`,
        {
          company: selectedCompany._id,
          amountSanctioned: parseAmount(amountSanctioned),
          amountPaid: parseAmount(amountPaid),
        },
        {
          withCredentials: true,
          headers: { 'X-CSRF-Token': csrfToken },
        }
      );

      toast({
        title: 'Violation saved.',
        description: 'The violation record has been successfully saved.',
        status: 'success',
        duration: 4000,
        isClosable: true,
      });
      router.push('/');
    } catch (err) {
      console.error('Failed to save violation:', err);
      toast({
        title: 'Failed to save violation.',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box p={5}>
      <HStack justify="center" spacing={4} mb={6}>
        <Text fontSize="2xl" fontWeight="bold" color="red.500">
          Violations
        </Text>
        <Text fontSize="md" color="gray.600">
          {new Date().toLocaleDateString()}
        </Text>
      </HStack>

      <VStack spacing={4} align="stretch" maxW="500px" mx="auto">
        <FormControl position="relative">
          <FormLabel>Name of Company</FormLabel>
          <Input
            value={query ?? ''}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedCompany(null);
              setAmountSanctioned('');
              setAmountPaid('');
              setPaymentAmount('');
            }}
            placeholder="Search company..."
          />
          {companies.length > 0 && (
            <Box
              borderWidth="1px"
              borderRadius="md"
              mt={1}
              maxH="150px"
              overflowY="auto"
              bg="white"
              zIndex={10}
              position="absolute"
              w="full"
            >
              {companies.map((c) => (
                <Box
                  key={c._id}
                  p={2}
                  _hover={{ bg: 'gray.100' }}
                  cursor="pointer"
                  onClick={() => {
                    setSelectedCompany(c);
                    setQuery(c.companyName || '');
                    setCompanies([]);
                    setPaymentAmount('');
                    setAmountSanctioned('');
                    setAmountPaid('');
                  }}
                >
                  <Text>{c.companyName}</Text>
                  {!!c.outstandingBalance && c.outstandingBalance > 0 && (
                    <Text fontSize="xs" color="red.600" fontWeight="medium">
                      Outstanding: {formatSignedNaira(c.outstandingBalance)}
                    </Text>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </FormControl>

        {selectedCompany && hasOpenViolation && (
          <>
            <Box p={3} borderWidth="1px" borderRadius="md" bg="red.50" borderColor="red.200">
              <Text fontWeight="bold" color="red.600">
                Existing Outstanding Balance: {formatSignedNaira(selectedCompany.outstandingBalance || 0)}
              </Text>
              <Text fontSize="xs" color="red.600">
                Sanctioned {formatSignedNaira(selectedCompany.amountSanctioned || 0)} · Paid so far{' '}
                {formatSignedNaira(selectedCompany.amountPaidSoFar || 0)}
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
        )}

        {selectedCompany && !hasOpenViolation && (
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
    </Box>
  );
}
