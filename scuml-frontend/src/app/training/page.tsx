"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, Input } from "@chakra-ui/react";
import TrainingForm from "@/components/forms/TrainingForm";
import { useAuth } from "@/context/AuthContext";

type Company = {
  _id: string;
  companyName: string;
};

export default function TrainingPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const router = useRouter();
  const { user } = useAuth();

  // Guest accounts may only act on the Identification section.
  useEffect(() => {
    if (user && user.role === "guest") router.replace("/");
  }, [user, router]);

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

      {selectedCompany && (
        <TrainingForm
          companyId={selectedCompany._id}
          companyName={selectedCompany.companyName}
          onSuccess={() => router.push("/")}
        />
      )}
    </Box>
  );
}
