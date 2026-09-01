'use client';

import {
  Box,
  Text,
  Button,
  Input,
  Select,
  FormControl,
  FormLabel,
  VStack,
  HStack,
  Heading,
  useToast,
  Container,
  Card,
  CardBody,
} from '@chakra-ui/react';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { NATURE_OF_BUSINESS_OPTIONS } from '@/lib/natureOfBusiness';
import { useAuth } from '@/context/AuthContext';

export default function RegistrationPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  const photosInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    officerName: '',
    dateOfIdentification: today,
    companyName: '',
    natureOfBusiness: '',
    address: '',
    state: '',
    modeOfIdentification: '',
    phone: '',
    email: '',
    website: '',
  });
  const [photos, setPhotos] = useState<FileList | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Identification Officer defaults to the logged-in user, but stays editable.
  useEffect(() => {
    if (user?.username) {
      setFormData((prev) =>
        prev.officerName ? prev : { ...prev, officerName: user.username }
      );
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (e.target.name === 'companyName') {
      setDuplicateAccepted(null);
    }
  };

  // 🔹 Duplicate-company check — as the officer types a company name, look
  // for an existing registration with the same name so they can confirm it
  // before accidentally registering the same company twice.
  const [duplicateMatches, setDuplicateMatches] = useState<
    { _id: string; companyName: string }[]
  >([]);
  const [duplicateAccepted, setDuplicateAccepted] = useState<
    { _id: string; companyName: string } | null
  >(null);

  useEffect(() => {
    const name = formData.companyName.trim();
    if (duplicateAccepted || name.length < 2) {
      setDuplicateMatches([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/registrations/search?query=${encodeURIComponent(name)}`,
          { withCredentials: true }
        );
        setDuplicateMatches(res.data || []);
      } catch (err) {
        console.error('Company duplicate check failed:', err);
      }
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.companyName, duplicateAccepted]);

  // Uploads the photo gallery without blocking navigation — photos can take a
  // while for real, full-size images, and the record already exists by this point.
  const uploadPhotosInBackground = async (registrationId: string, csrfToken: string) => {
    if (!photos || photos.length === 0) return;
    try {
      const photoData = new FormData();
      Array.from(photos).forEach((file) => photoData.append("photos", file));
      await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/registrations/${registrationId}/photos`,
        photoData,
        {
          withCredentials: true,
          headers: { "X-CSRF-Token": csrfToken },
        }
      );
    } catch (photoErr) {
      console.error("Photo upload failed:", photoErr);
      toast({
        title: "Registration saved, but photo upload failed.",
        description: "You can try uploading the photos again later.",
        status: "warning",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (submitting) return;

  setSubmitting(true);
  try {
    // 1. Fetch CSRF token first
    const csrfRes = await axios.get(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
      { withCredentials: true }
    );
    const csrfToken = csrfRes.data.csrfToken;

    // 2. Submit form with CSRF header
    const res = await axios.post(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/registrations`,
      formData,
      {
        withCredentials: true,
        headers: { "X-CSRF-Token": csrfToken },
      }
    );

    toast({
      title: "Registration submitted.",
      description: "The registration has been successfully saved.",
      status: "success",
      duration: 4000,
      isClosable: true,
    });

    // 3. Optional photo gallery — fire in the background, don't block navigation
    if (photos && photos.length > 0) {
      uploadPhotosInBackground(res.data._id, csrfToken);
    }

    router.push("/"); // redirect to homepage
  } catch (err) {
    console.error(err);
    const message =
      axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : "Something went wrong while submitting.";
    toast({
      title: "Error",
      description: message,
      status: "error",
      duration: 4000,
      isClosable: true,
    });
  } finally {
    setSubmitting(false);
  }
};


  return (
    <Container maxW="4xl" py={10}>
      <Card shadow="lg" borderRadius="2xl">
        <CardBody>
          <Heading
            size="lg"
            textAlign="center"
            mb={8}
            color="red.500"
          >
            Registration
          </Heading>

          <form onSubmit={handleSubmit}>
            <VStack spacing={5} align="stretch">
              <FormControl isRequired>
                <FormLabel>Identification Officer</FormLabel>
                <Input
                  name="officerName"
                  value={formData.officerName}
                  isReadOnly
                  cursor="not-allowed"
                  bg="gray.100"
                  placeholder="Enter identification officer"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Date of Identification</FormLabel>
                <Input
                  type="date"
                  name="dateOfIdentification"
                  value={formData.dateOfIdentification}
                  isReadOnly
                  cursor="not-allowed"
                  bg="gray.100"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Company Name</FormLabel>
                <Input
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  placeholder="Enter company name"
                />
              </FormControl>

              {duplicateMatches.length > 0 && !duplicateAccepted && (
                <Box borderWidth="1px" borderRadius="md" p={3} bg="yellow.50">
                  <Text fontSize="sm" fontWeight="bold" mb={2}>
                    A company with a similar name already exists. Do you mean this company?
                  </Text>
                  <VStack align="stretch" spacing={2} mb={2}>
                    {duplicateMatches.map((m) => (
                      <HStack key={m._id} justify="space-between" bg="white" p={2} borderRadius="md">
                        <Text fontSize="sm">{m.companyName}</Text>
                        <Button
                          size="xs"
                          colorScheme="orange"
                          onClick={() => setDuplicateAccepted(m)}
                        >
                          Yes, this is it
                        </Button>
                      </HStack>
                    ))}
                  </VStack>
                  <Button size="xs" variant="ghost" onClick={() => setDuplicateMatches([])}>
                    Cancel — this is a different company
                  </Button>
                </Box>
              )}

              {duplicateAccepted && (
                <Box borderWidth="1px" borderRadius="md" p={3} bg="red.50" borderColor="red.300">
                  <Text fontSize="sm" color="red.700">
                    &quot;{duplicateAccepted.companyName}&quot; is already registered. To avoid
                    a duplicate entry, please find it on the home page instead of submitting a
                    new registration.
                  </Text>
                  <Button
                    size="xs"
                    mt={2}
                    variant="ghost"
                    onClick={() => setDuplicateAccepted(null)}
                  >
                    Actually, it&apos;s a different company
                  </Button>
                </Box>
              )}

              <FormControl isRequired>
                <FormLabel>Nature of Business</FormLabel>
                <Select
                  name="natureOfBusiness"
                  value={formData.natureOfBusiness}
                  onChange={handleChange}
                  placeholder="Select nature of business"
                >
                  {NATURE_OF_BUSINESS_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </Select>
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Address</FormLabel>
                <Input
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Enter address"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>State</FormLabel>
                <Select
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  placeholder="Select state"
                >
                  <option value="Edo">Edo</option>
                  <option value="Delta">Delta</option>
                  <option value="Ondo">Ondo</option>
                </Select>
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Mode of Identification</FormLabel>
                <Select
                  name="modeOfIdentification"
                  value={formData.modeOfIdentification}
                  onChange={handleChange}
                  placeholder="Select mode"
                >
                  <option value="Physical">Physical</option>
                  <option value="Online">Online</option>
                  <option value="Social Media">Social Media</option>
                  <option value="Newspaper">Newspaper</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Phone Number</FormLabel>
                <Input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Enter phone number"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Email Address</FormLabel>
                <Input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter email address"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Website</FormLabel>
                <Input
                  type="text"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  placeholder="Enter website (e.g. www.example.com)"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Photos</FormLabel>
                <Input
                  ref={photosInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  p={1}
                  onChange={(e) => setPhotos(e.target.files)}
                />
              </FormControl>

              <Button
                type="submit"
                size="lg"
                colorScheme="red"
                w="full"
                borderRadius="xl"
                _hover={{ bg: 'red.600' }}
                isLoading={submitting}
                loadingText="Submitting…"
                isDisabled={submitting || !!duplicateAccepted}
              >
                Submit Registration
              </Button>
            </VStack>
          </form>
        </CardBody>
      </Card>
    </Container>
  );
}
