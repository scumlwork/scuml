'use client';

import {
  Box,
  Text,
  Input,
  VStack,
  FormControl,
  FormLabel,
  HStack,
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import ViolationForm from '@/components/forms/ViolationForm';
import { useAuth } from '@/context/AuthContext';

type Company = {
  _id: string;
  companyName: string;
  outstandingBalance?: number;
};

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
  const router = useRouter();
  const { user } = useAuth();

  // Guest accounts may only act on the Identification section.
  useEffect(() => {
    if (user && user.role === 'guest') router.replace('/');
  }, [user, router]);

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

        {selectedCompany && (
          <ViolationForm
            companyId={selectedCompany._id}
            companyName={selectedCompany.companyName}
            onSuccess={() => router.push('/')}
          />
        )}
      </VStack>
    </Box>
  );
}
