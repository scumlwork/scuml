'use client';

import {
  Box,
  Heading,
  Input,
  Text,
  List,
  ListItem,
  Spinner,
} from '@chakra-ui/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import OffSiteInspectionForm from '@/components/forms/OffSiteInspectionForm';

type Company = {
  _id: string;
  companyName: string;
};

export default function OffSiteInspectionPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const router = useRouter();

  // 🔍 Search companies
  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (value.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/registrations/search?query=${encodeURIComponent(value)}`,
        { withCredentials: true }
      );
      setSearchResults(res.data || []);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box p={6} maxW="1200px" mx="auto">
      <Heading fontSize="xl" mb={6} color="red.500">
        Off-Site Inspection Report
      </Heading>

      {/* 🔍 Search Company */}
      <Box mb={6}>
        <Text fontWeight="bold" mb={2}>
          Search Company
        </Text>
        <Input
          placeholder="Type company name..."
          value={searchQuery}
          onChange={handleSearch}
        />
        {loading && <Spinner size="sm" mt={2} />}
        {searchResults.length > 0 && (
          <List
            border="1px solid #ccc"
            borderRadius="md"
            mt={2}
            maxH="150px"
            overflowY="auto"
          >
            {searchResults.map((company) => (
              <ListItem
                key={company._id}
                px={3}
                py={2}
                _hover={{ bg: 'gray.100', cursor: 'pointer' }}
                onClick={() => {
                  setSelectedCompany(company);
                  setSearchResults([]);
                  setSearchQuery(company.companyName);
                }}
              >
                {company.companyName}
              </ListItem>
            ))}
          </List>
        )}
        {selectedCompany && (
          <Text mt={2} fontSize="sm" color="green.600">
            Selected: {selectedCompany.companyName}
          </Text>
        )}
      </Box>

      {selectedCompany && (
        <OffSiteInspectionForm
          companyId={selectedCompany._id}
          companyName={selectedCompany.companyName}
          onSuccess={() => router.push('/')}
        />
      )}
    </Box>
  );
}
