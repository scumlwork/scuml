"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Input,
  FormControl,
  FormLabel,
  useToast,
} from "@chakra-ui/react";

type Company = {
  _id: string;
  companyName: string;
};

export default function TrainingPage() {
  const today = new Date().toISOString().split("T")[0]; // yyyy-mm-dd

  const [formData, setFormData] = useState({
    date: today,
    facilitator: "",
    participants: "",
    topic: "",
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // 🔹 CSRF token
  const [csrfToken, setCsrfToken] = useState("");
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    // fetch CSRF token on mount
    const fetchCsrf = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`, {
          credentials: "include",
        });
        const data = await res.json();
        setCsrfToken(data.csrfToken);
      } catch (err) {
        console.error("Error fetching CSRF token:", err);
      }
    };
    fetchCsrf();
  }, []);

  // --- Live Search Companies ---
  useEffect(() => {
    const fetchCompanies = async () => {
      if (searchTerm.length < 2) {
        setCompanies([]);
        return;
      }
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/registrations/search?query=${searchTerm}`,
          { credentials: "include" }
        );
        const data = await res.json();
        setCompanies(data);
      } catch (err) {
        console.error("Error fetching companies:", err);
      }
    };

    fetchCompanies();
  }, [searchTerm]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async () => {
    if (!selectedCompany) {
      toast({
        title: "Please select a company before submitting.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      const payload = {
        company: selectedCompany._id,
        ...formData,
      };

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/trainings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CSRF-Token": csrfToken,   // 🔹 include CSRF token
        },
        body: JSON.stringify(payload),
        credentials: "include",      // 🔹 include session cookie
      });

      if (res.ok) {
        toast({
          title: "Training record saved successfully!",
          status: "success",
          duration: 2500,
          isClosable: true,
        });
        router.push("/"); // toast persists through client-side navigation
      } else {
        const errText = await res.text();
        toast({
          title: "Failed to save training record.",
          description: errText,
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (err) {
      console.error("Error saving training:", err);
      toast({
        title: "Error saving training.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    }
  };

  return (
    <Box p={6} maxW="600px" mx="auto" fontSize="xs">
      <h1
        style={{
          color: "red",
          fontSize: "20px",
          fontWeight: "bold",
          marginBottom: "20px",
          textAlign: "center",
        }}
      >
        Training Record
      </h1>

      {/* Company Search */}
      <Box mb={6} textAlign="center">
        <Input
          placeholder="Search company..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setSelectedCompany(null);
          }}
          width="100%"
          mb={2}
        />

        {companies.length > 0 && (
          <Box
            border="1px solid #ccc"
            borderRadius="md"
            maxH="200px"
            overflowY="auto"
            width="100%"
            mx="auto"
            bg="white"
            zIndex={10}
          >
            {companies.map((c) => (
              <Box
                key={c._id}
                p={2}
                _hover={{ bg: "gray.100", cursor: "pointer" }}
                onClick={() => {
                  setSelectedCompany(c);
                  setSearchTerm(c.companyName);
                  setCompanies([]);
                }}
              >
                {c.companyName}
              </Box>
            ))}
          </Box>
        )}

        {selectedCompany && (
          <Box mt={2} fontSize="sm" color="green.600">
            ✅ Selected Company: <b>{selectedCompany.companyName}</b>
          </Box>
        )}
      </Box>

      {/* Date */}
      <FormControl mb={4}>
        <FormLabel fontSize="sm">Date of Training</FormLabel>
        <Input
          type="date"
          name="date"
          value={formData.date}
          onChange={handleChange}
          fontSize={{ base: "3xs", md: "xs" }}
        />
      </FormControl>

      {/* Facilitator */}
      <FormControl mb={4}>
        <FormLabel fontSize="sm">Name of Facilitator</FormLabel>
        <Input
          type="text"
          name="facilitator"
          placeholder="Enter facilitator's name"
          value={formData.facilitator}
          onChange={handleChange}
          fontSize={{ base: "3xs", md: "xs" }}
        />
      </FormControl>

      {/* Participants */}
      <FormControl mb={4}>
        <FormLabel fontSize="sm">No. of Participants</FormLabel>
        <Input
          type="number"
          name="participants"
          placeholder="Enter number of participants"
          value={formData.participants}
          onChange={handleChange}
          fontSize={{ base: "3xs", md: "xs" }}
        />
      </FormControl>

      {/* Topic */}
      <FormControl mb={6}>
        <FormLabel fontSize="sm">Topic of Training</FormLabel>
        <Input
          type="text"
          name="topic"
          placeholder="Enter training topic"
          value={formData.topic}
          onChange={handleChange}
          fontSize={{ base: "3xs", md: "xs" }}
        />
      </FormControl>

      <Box textAlign="center">
        <Button colorScheme="green" size="lg" onClick={handleSubmit}>
          Submit
        </Button>
      </Box>
    </Box>
  );
}
