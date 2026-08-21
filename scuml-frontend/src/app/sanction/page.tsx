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
import SanctionForm from '@/components/forms/SanctionForm';

type Company = {
  _id: string;
  companyName: string;
  natureOfBusiness?: string;
};

export default function SanctionPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [query, setQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const router = useRouter();

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

        {selectedCompany && (
          <SanctionForm
            companyId={selectedCompany._id}
            companyName={selectedCompany.companyName}
            initialNatureOfBusiness={selectedCompany.natureOfBusiness || ''}
            onSuccess={() => router.push('/')}
          />
        )}
      </VStack>
    </Box>
  );
}
