'use client';

import {
  Box,
  Button,
  Input,
  Select,
  FormControl,
  FormLabel,
  VStack,
  Heading,
  useToast,
  Container,
  Card,
  CardBody,
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

interface Company {
  _id: string;
  companyName: string;
}


export default function LettersPage() {
  const toast = useToast();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Company[]>([]);
const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);


  const [formData, setFormData] = useState({
    companyName: '',
    typeOfLetter: '',
    customType: '',
    receiverName: '',
    phone: '',
    email: '',
    dateOfReporting: '',
  });

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
  setFormData({ ...formData, companyName: company.companyName });
  setSuggestions([]);
  setQuery(company.companyName);
};


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // 🔹 Fetch CSRF token
      const csrfRes = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
        { withCredentials: true }
      );
      const csrfToken = csrfRes.data.csrfToken;

      const payload = {
        ...formData,
        typeOfLetter:
          formData.typeOfLetter === 'Others' ? formData.customType : formData.typeOfLetter,
      };

      await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/letters`,
        payload,
        {
          withCredentials: true,
          headers: { 'X-CSRF-Token': csrfToken },
        }
      );

      toast({
        title: 'Letter submitted.',
        description: 'The letter has been successfully saved.',
        status: 'success',
        duration: 4000,
        isClosable: true,
      });

      router.push('/');
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Something went wrong while submitting.',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  };

  return (
    <Container maxW="4xl" py={10}>
      <Card shadow="lg" borderRadius="2xl">
        <CardBody>
          <Heading size="lg" textAlign="center" mb={8} color="red.500">
            Letters
          </Heading>

          {/* 🔎 Search field */}
          <Box mb={6}>
            <FormControl>
              <FormLabel>Search Company</FormLabel>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
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
            <form onSubmit={handleSubmit}>
              <VStack spacing={5} align="stretch">
                <FormControl isRequired>
                  <FormLabel>Company Name</FormLabel>
                  <Input name="companyName" value={formData.companyName} isReadOnly />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Type of Letter</FormLabel>
                  <Select
                    name="typeOfLetter"
                    value={formData.typeOfLetter}
                    onChange={handleChange}
                    placeholder="Select type"
                  >
                    <option value="Letter of inspection">Letter of inspection</option>
                    <option value="Letter of sanctions">Letter of sanctions</option>
                    <option value="Response to invitation">Response to invitation</option>
                    <option value="Sanction payment">Sanction payment</option>
                    <option value="Warning Letter">Warning Letter</option>
                    <option value="Training request">Training request</option>
                    <option value="Others">Others</option>
                  </Select>
                </FormControl>

                {formData.typeOfLetter === 'Others' && (
                  <FormControl isRequired>
                    <FormLabel>Custom Letter Type</FormLabel>
                    <Input
                      name="customType"
                      value={formData.customType}
                      onChange={handleChange}
                      placeholder="Enter letter type"
                    />
                  </FormControl>
                )}

                <FormControl isRequired>
                  <FormLabel>Receiver Name</FormLabel>
                  <Input
                    name="receiverName"
                    value={formData.receiverName}
                    onChange={handleChange}
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Phone</FormLabel>
                  <Input
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Email (optional)</FormLabel>
                  <Input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Date of Reporting</FormLabel>
                  <Input
                    type="date"
                    name="dateOfReporting"
                    value={formData.dateOfReporting}
                    onChange={handleChange}
                  />
                </FormControl>

                <Button type="submit" size="lg" colorScheme="red" borderRadius="xl">
                  Submit Letter
                </Button>
              </VStack>
            </form>
          )}
        </CardBody>
      </Card>
    </Container>
  );
}
