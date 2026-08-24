'use client';

import {
  Box,
  Input,
  Text,
  FormControl,
  FormLabel,
  Heading,
  Container,
  Card,
  CardBody,
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import LetterForm from '@/components/forms/LetterForm';

interface Company {
  _id: string;
  companyName: string;
}

export default function LettersPage() {
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [entryDateTime] = useState(() => new Date());

  // 🔎 Fetch company suggestions as user types
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/registrations/search?query=${query}`,
          { withCredentials: true }
        );
        setSuggestions(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchSuggestions();
  }, [query]);

  const handleSelectCompany = (company: Company) => {
    setSelectedCompany(company);
    setSuggestions([]);
    setQuery(company.companyName);
  };

  return (
    <Container maxW="4xl" py={10}>
      <Card shadow="lg" borderRadius="2xl">
        <CardBody>
          <Heading size="lg" textAlign="center" mb={2} color="red.500">
            Actions
          </Heading>

          <Text fontSize="sm" color="gray.500" textAlign="center" mb={6}>
            Entry Date & Time: {entryDateTime.toLocaleDateString()}{' '}
            {entryDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>

          {/* 🔎 Search field */}
          <Box mb={6}>
            <FormControl>
              <FormLabel>Search Company</FormLabel>
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedCompany(null);
                }}
                placeholder="Type company name..."
              />
            </FormControl>

            {suggestions.length > 0 && (
              <Box mt={2} border="1px solid #e2e8f0" borderRadius="md" bg="white" shadow="sm">
                {suggestions.map((company, idx) => (
                  <Box
                    key={idx}
                    px={3}
                    py={2}
                    cursor="pointer"
                    _hover={{ bg: 'gray.100' }}
                    onClick={() => handleSelectCompany(company)}
                  >
                    {company.companyName}
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          {selectedCompany && (
            <LetterForm
              companyId={selectedCompany._id}
              companyName={selectedCompany.companyName}
              onSuccess={() => router.push('/')}
            />
          )}
        </CardBody>
      </Card>
    </Container>
  );
}
