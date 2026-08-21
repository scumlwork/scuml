"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, Input } from "@chakra-ui/react";
import axios from "axios";
import OnSiteInspectionForm from "@/components/forms/OnSiteInspectionForm";

type Company = {
  _id: string;
  companyName: string;
};

export default function OnSiteInspectionPage() {
  // --- Company Search State ---
  const [searchTerm, setSearchTerm] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
  }, []);

  // --- Live Search Companies ---
  useEffect(() => {
    const fetchCompanies = async () => {
      if (searchTerm.length < 2) {
        setCompanies([]);
        return;
      }
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/registrations/search?query=${encodeURIComponent(
            searchTerm
          )}`,
          { withCredentials: true }
        );
        setCompanies(res.data || []);
      } catch (err) {
        console.error("Error fetching companies:", err);
      }
    };

    fetchCompanies();
  }, [searchTerm]);

  return (
    <Box p={6} fontSize="xs">
      {/* Page Title */}
      <h1
        style={{
          color: "red",
          fontSize: "20px",
          fontWeight: "bold",
          marginBottom: "20px",
          textAlign: "center",
        }}
      >
        On-Site Inspection
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
          width={{ base: "100%", md: "60%" }}
          mb={2}
        />

        {/* Autocomplete results */}
        {isClient && companies.length > 0 && (
          <Box
            border="1px solid #ccc"
            borderRadius="md"
            maxH="200px"
            overflowY="auto"
            width={{ base: "100%", md: "60%" }}
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
        <OnSiteInspectionForm
          companyId={selectedCompany._id}
          companyName={selectedCompany.companyName}
          onSuccess={() => router.push("/")}
        />
      )}
    </Box>
  );
}
