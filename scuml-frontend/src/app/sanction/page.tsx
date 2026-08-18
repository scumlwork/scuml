'use client';

import {
  Box,
  Text,
  Input,
  Button,
  VStack,
  FormControl,
  FormLabel,
  Select,
  HStack,
  useToast,
} from '@chakra-ui/react';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

type Company = {
  _id: string;
  companyName: string;
  natureOfBusiness?: string; // make optional just in case backend doesn't always send it
};

export default function SanctionPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [query, setQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [natureOfBusiness, setNatureOfBusiness] = useState('');
  const [amount, setAmount] = useState('');
  const [modeOfPayment, setModeOfPayment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string>(''); // ✅ CSRF state
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);
  const toast = useToast();
  const router = useRouter();

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

  // 🔹 Handle search
  useEffect(() => {
    const fetchCompanies = async () => {
      if (!query) return setCompanies([]);
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/registrations/search?query=${query}`,
          { withCredentials: true }
        );
        setCompanies(res.data || []);
      } catch (err) {
        console.error('Company search failed:', err);
      }
    };
    fetchCompanies();
  }, [query]);

  // 🔹 Handle form submit
  const handleSubmit = async () => {
    if (!selectedCompany || !natureOfBusiness || !amount || !modeOfPayment) {
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
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/sanctions`,
        {
          company: selectedCompany._id,
          natureOfBusiness,
          amount: Number(amount.replace(/[^0-9]/g, "")), // ✅ send raw number
          modeOfPayment,
        },
        {
          withCredentials: true, // include session cookie
          headers: { "CSRF-Token": csrfToken }, // ✅ send token
        }
      );

      // Receipt is optional — upload it as a second step once the sanction exists
      if (receiptFile) {
        try {
          const formData = new FormData();
          formData.append('receipt', receiptFile);
          await axios.post(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/sanctions/${res.data._id}/receipt`,
            formData,
            {
              withCredentials: true,
              headers: { 'X-CSRF-Token': csrfToken },
            }
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
      router.push('/');
    } catch (err) {
      console.error('Failed to save sanction:', err);
      toast({
        title: 'Failed to save sanction.',
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
      {/* Header centered */}
      <HStack justify="center" spacing={4} mb={6}>
        <Text fontSize="2xl" fontWeight="bold" color="red.500">
          Sanction & Payment
        </Text>
        <Text fontSize="md" color="gray.600">
          {new Date().toLocaleDateString()}
        </Text>
      </HStack>

      {/* Company search */}
      <VStack spacing={4} align="stretch" maxW="500px" mx="auto">
        <FormControl position="relative">
          <FormLabel>Name of Company</FormLabel>
          <Input
            value={query ?? ''}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedCompany(null);
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
                    setNatureOfBusiness(c.natureOfBusiness || ''); // ✅ prevent undefined
                    setQuery(c.companyName || '');
                    setCompanies([]);
                  }}
                >
                  {c.companyName}
                </Box>
              ))}
            </Box>
          )}
        </FormControl>

        {/* Render the rest of the form only when a company is selected */}
        {selectedCompany && (
          <>
            <FormControl>
              <FormLabel>Nature of Business</FormLabel>
              <Input
                value={natureOfBusiness ?? ''} // ✅ safe controlled value
                onChange={(e) => setNatureOfBusiness(e.target.value)}
                placeholder="Nature of business"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Amount</FormLabel>
              <Input
                type="text" // change from number to text
                value={amount}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, ""); // keep only digits
                  if (!raw) {
                    setAmount("");
                    return;
                  }
                  const formatted = new Intl.NumberFormat("en-NG", {
                    style: "currency",
                    currency: "NGN",
                    minimumFractionDigits: 0,
                  }).format(Number(raw));
                  setAmount(formatted);
                }}
                placeholder="₦0.00"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Mode of Payment</FormLabel>
              <Select
                value={modeOfPayment ?? ''} // ✅ safe controlled value
                onChange={(e) => setModeOfPayment(e.target.value)}
              >
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

            <Button
              colorScheme="red"
              onClick={handleSubmit}
              isLoading={submitting}
            >
              Save Sanction
            </Button>
          </>
        )}
      </VStack>
    </Box>
  );
}
