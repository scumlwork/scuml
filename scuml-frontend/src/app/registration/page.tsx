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
  Heading,
  useToast,
  Container,
  Card,
  CardBody,
} from '@chakra-ui/react';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function RegistrationPage() {
  const router = useRouter();
  const toast = useToast();
  const today = new Date().toISOString().split('T')[0];
  const photosInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    officerName: '',
    dateOfIdentification: today,
    companyName: '',
    natureOfBusiness: '',
    address: '',
    state: '',
    city: '',
    modeOfIdentification: '',
    phone: '',
    email: '',
  });
  const [photos, setPhotos] = useState<FileList | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

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
                <FormLabel>Identification Office</FormLabel>
                <Input
                  name="officerName"
                  value={formData.officerName}
                  onChange={handleChange}
                  placeholder="Enter identification office"
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

              <FormControl isRequired>
                <FormLabel>Nature of Business</FormLabel>
                <Input
                  name="natureOfBusiness"
                  value={formData.natureOfBusiness}
                  onChange={handleChange}
                  placeholder="Enter nature of business"
                />
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
                <FormLabel>City</FormLabel>
                <Input
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Enter city"
                />
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
                isDisabled={submitting}
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
