// src/app/database-auth/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Input,
  Text,
  VStack,
  Spinner,
} from "@chakra-ui/react";
import axios from "axios";

export default function DatabaseAuthPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [csrfLoading, setCsrfLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchCsrf = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
          { withCredentials: true }
        );
        setCsrfToken(res.data.csrfToken);
      } catch (err) {
        console.error("Failed to fetch CSRF token:", err);
        setError("⚠️ Security initialization failed. Please refresh.");
      } finally {
        setCsrfLoading(false);
      }
    };
    fetchCsrf();
  }, []);

  const handleSubmit = async () => {
    if (!csrfToken) {
      setError("Security token missing, please refresh and try again.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin/verify-totp`,
        { code },
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
        }
      );

      if (res.status === 200 && res.data.success) {
        router.replace("/database"); // 👈 redirect to DATABASE instead of /register
      } else {
        setError(res.data.message || "Invalid code");
      }
    } catch (err) {
      console.error("Verify error:", err);
      setError("❌ Invalid or expired code");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      minH="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="black"
      px={4}
      py={8}
    >
      <VStack
        bg="white"
        p={{ base: 6, sm: 8 }}
        borderRadius="xl"
        boxShadow="lg"
        gap={4}
        w="full"
        maxW="sm"
      >
        <Text fontSize="2xl" fontWeight="bold" color="red.500">
          Database Access Required
        </Text>

        {csrfLoading ? (
          <Spinner />
        ) : (
          <>
            <Input
              placeholder="Enter 6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxW="200px"
              textAlign="center"
              maxLength={6}
            />
            <Button
              colorScheme="green"
              onClick={handleSubmit}
              isLoading={submitting}
              isDisabled={!code || csrfLoading}
              w="full"
            >
              Verify Code
            </Button>
            {error && <Text color="red.500">{error}</Text>}
          </>
        )}
      </VStack>
    </Box>
  );
}
