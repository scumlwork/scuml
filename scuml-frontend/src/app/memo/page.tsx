'use client';

import {
  Box,
  Input,
  Text,
  Textarea,
  FormControl,
  FormLabel,
  Heading,
  Container,
  Card,
  CardBody,
  Button,
  HStack,
  VStack,
  IconButton,
  Image,
  Spinner,
  useToast,
} from '@chakra-ui/react';
import { ArrowBackIcon } from '@chakra-ui/icons';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useAuth } from '@/context/AuthContext';

// "30th July, 2026" — matches the date format used on every other letter.
function ordinalSuffix(day: number) {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}
function formatOrdinalDate(date: Date) {
  const day = date.getDate();
  const month = date.toLocaleString('en-US', { month: 'long' });
  const year = date.getFullYear();
  return `${day}${ordinalSuffix(day)} ${month}, ${year}`;
}

// Fixed signature image used on every generated document — see
// public/IBRAHIM_signature.png.
const SIGNATURE_SRC = '/IBRAHIM_signature.png';

export default function MyMemoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const editId = searchParams.get('id');

  // 🔹 Staff and superadmin may use My Memo (not guest).
  useEffect(() => {
    if (!authLoading && user && user.role === 'guest') {
      router.replace('/');
    }
  }, [authLoading, user, router]);

  const [to, setTo] = useState('');
  const [through, setThrough] = useState('');
  const [from, setFrom] = useState('Zonal Coordinator, SCUML Benin');
  const [refNo, setRefNo] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [generated, setGenerated] = useState(false);
  const [todayStr, setTodayStr] = useState(() => formatOrdinalDate(new Date()));
  const [loadingExisting, setLoadingExisting] = useState(!!editId);

  // Editing an existing memo — prefill the form (including its original
  // date, not today's) from the saved record.
  useEffect(() => {
    if (!editId) return;
    const fetchExisting = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/memos/${editId}`,
          { withCredentials: true }
        );
        const m = res.data;
        setTo(m.to || '');
        setThrough(m.through || '');
        setFrom(m.from || '');
        setRefNo(m.refNo || '');
        setSubject(m.subject || '');
        setMessage(m.message || '');
        if (m.date) setTodayStr(m.date);
      } catch (err) {
        console.error('Failed to load memo for editing:', err);
      } finally {
        setLoadingExisting(false);
      }
    };
    fetchExisting();
  }, [editId]);

  // Records the memo so it shows up on the home page, the Admin page, and
  // Recent Activity, same as every other record type. Editing an existing
  // memo updates it in place and regenerates the letter with the new
  // content, instead of creating a separate record.
  const handleGenerate = async () => {
    setGenerated(true);
    try {
      const csrfRes = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
        { withCredentials: true }
      );
      const payload = { to, through, from, date: todayStr, refNo, subject, message };
      if (editId) {
        await axios.put(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/memos/${editId}`,
          payload,
          { withCredentials: true, headers: { 'X-CSRF-Token': csrfRes.data.csrfToken } }
        );
      } else {
        await axios.post(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/memos`,
          payload,
          { withCredentials: true, headers: { 'X-CSRF-Token': csrfRes.data.csrfToken } }
        );
      }
    } catch (err) {
      console.error('Failed to record memo:', err);
    }
  };

  if (user?.role === 'guest') return null;

  if (loadingExisting) {
    return (
      <Box h="100vh" display="flex" alignItems="center" justifyContent="center">
        <Spinner size="xl" />
      </Box>
    );
  }

  if (generated) {
    return (
      <GeneratedMemo
        to={to}
        through={through}
        from={from}
        todayStr={todayStr}
        refNo={refNo}
        subject={subject}
        message={message}
        onBack={() => setGenerated(false)}
      />
    );
  }

  return (
    <Container maxW="4xl" py={10} className="no-print">
      <Card shadow="lg" borderRadius="2xl">
        <CardBody>
          <HStack mb={4}>
            <IconButton
              aria-label="Back to Memo Drafts"
              icon={<ArrowBackIcon />}
              onClick={() => router.push('/memo-drafts')}
              variant="ghost"
            />
            <Heading size="lg" flex="1" textAlign="center" color="red.500" mr={10}>
              {editId ? 'Edit Memo' : 'My Memo'}
            </Heading>
          </HStack>

          <VStack spacing={5} align="stretch">
            <FormControl>
              <FormLabel>To</FormLabel>
              <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="e.g. Director, SCUML" />
            </FormControl>

            <FormControl>
              <FormLabel>Through</FormLabel>
              <Input value={through} onChange={(e) => setThrough(e.target.value)} placeholder="e.g. D. Director, SCUML" />
            </FormControl>

            <FormControl>
              <FormLabel>From</FormLabel>
              <Input value={from} onChange={(e) => setFrom(e.target.value)} />
            </FormControl>

            <FormControl>
              <FormLabel>Date</FormLabel>
              <Input value={todayStr} isReadOnly cursor="not-allowed" bg="gray.100" />
            </FormControl>

            <FormControl>
              <FormLabel>Ref. No.</FormLabel>
              <Input value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="e.g. CB:4000/EFCC/BNZ/SCUML/VOL.1/41" />
            </FormControl>

            <FormControl>
              <FormLabel>Subject</FormLabel>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </FormControl>

            <FormControl>
              <FormLabel>Message</FormLabel>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write the body of the memo..."
                minH="200px"
              />
            </FormControl>

            <Button colorScheme="red" size="lg" onClick={handleGenerate}>
              {editId ? 'Update & Generate Memo' : 'Generate Memo'}
            </Button>
          </VStack>
        </CardBody>
      </Card>
    </Container>
  );
}

function GeneratedMemo({
  to,
  through,
  from,
  todayStr,
  refNo,
  subject,
  message,
  onBack,
}: {
  to: string;
  through: string;
  from: string;
  todayStr: string;
  refNo: string;
  subject: string;
  message: string;
  onBack: () => void;
}) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  const fileName = `Memo_${(subject || 'Untitled').replace(/\s+/g, '_')}.pdf`;

  const buildPdfBlob = async () => {
    const page = document.querySelector<HTMLElement>('.memo-page');
    if (!page) throw new Error('Memo page not found');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const canvas = await html2canvas(page, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
    return pdf.output('blob') as Blob;
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await buildPdfBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast({ title: 'Failed to generate the PDF.', status: 'error', duration: 4000, isClosable: true });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Box bg="gray.100" minH="100vh" py={8}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
          .memo-page { box-shadow: none !important; margin: 0 !important; }
        }
        @page { size: A4; margin: 15mm; }
      `}</style>

      <HStack maxW="900px" mx="auto" mb={4} className="no-print" spacing={2} flexWrap="wrap" justify="center">
        <Button size="sm" leftIcon={<ArrowBackIcon />} onClick={onBack} variant="outline">
          Back to Form
        </Button>
        <Button size="sm" colorScheme="purple" onClick={handleDownload} isLoading={downloading} loadingText="Preparing…">
          Download
        </Button>
        <Button size="sm" colorScheme="red" onClick={() => window.print()}>Print</Button>
      </HStack>

      <Box className="print-area" maxW="794px" mx="auto" px={{ base: 3, md: 0 }}>
        <Box
          className="memo-page"
          position="relative"
          bg="white"
          shadow="lg"
          p={{ base: 4, sm: 6, md: '20mm' }}
          minH="1123px"
          overflow="hidden"
          fontFamily="Georgia, serif"
          color="gray.800"
          fontSize="sm"
          lineHeight="1.8"
        >
          {/* Background watermark — the "To" field, same diagonal style as
              the reference memo's own "DIRECTOR SCUML" watermark. */}
          {to && (
            <Text
              position="absolute"
              top="50%"
              left="50%"
              transform="translate(-50%, -50%) rotate(-35deg)"
              transformOrigin="center"
              fontSize="7xl"
              fontWeight="bold"
              color="red.400"
              opacity={0.18}
              whiteSpace="nowrap"
              zIndex={0}
              pointerEvents="none"
              userSelect="none"
            >
              {to.toUpperCase()}
            </Text>
          )}

          <Box position="relative" zIndex={1} display="flex" flexDirection="column" flex="1" minH="inherit">
          <Text textAlign="center" fontWeight="bold" fontSize="xs" letterSpacing="wide">
            RESTRICTED
          </Text>

          <VStack spacing={1} mb={4} mt={2}>
            <Image src="/scuml-logo.PNG" alt="EFCC" boxSize="90px" />
            <Text fontWeight="bold" fontSize="lg" textAlign="center">
              ECONOMIC AND FINANCIAL CRIMES COMMISSION
            </Text>
            <Text fontStyle="italic" color="red.600" fontWeight="bold" fontSize="xl" textAlign="center">
              Special Control Unit against Money Laundering
            </Text>
            <Text fontWeight="bold" fontStyle="italic" textAlign="center">
              INTERNAL MEMORANDUM
            </Text>
          </VStack>

          <VStack align="stretch" spacing={1} mb={6}>
            <HStack align="start">
              <Text fontWeight="bold" minW="90px">To:</Text>
              <Text>{to || 'N/A'}</Text>
            </HStack>
            <HStack align="start">
              <Text fontWeight="bold" minW="90px">Through:</Text>
              <Text>{through || 'N/A'}</Text>
            </HStack>
            <HStack align="start">
              <Text fontWeight="bold" minW="90px">From:</Text>
              <Text>{from || 'N/A'}</Text>
            </HStack>
            <HStack align="start">
              <Text fontWeight="bold" minW="90px">Date:</Text>
              <Text>{todayStr}</Text>
            </HStack>
            <HStack align="start">
              <Text fontWeight="bold" minW="90px">Ref.:</Text>
              <Text>{refNo || 'N/A'}</Text>
            </HStack>
            <HStack align="start">
              <Text fontWeight="bold" minW="90px">Subject:</Text>
              <Text fontWeight="bold" textDecoration="underline">{subject || 'N/A'}</Text>
            </HStack>
          </VStack>

          <Text whiteSpace="pre-wrap" textAlign="justify" mb={8}>
            {message}
          </Text>

          <Box mt="auto">
            <Box mb={4}>
              <Image
                src={SIGNATURE_SRC}
                alt="Signature"
                maxH="60px"
                maxW="180px"
                objectFit="contain"
                display="block"
                ml="-8px"
                mb={-1}
              />
              <Text fontWeight="bold">SE Ibrahim Boyi</Text>
              <Text>Zonal Coordinator SCUML, Benin</Text>
            </Box>
            <Text textAlign="center" fontWeight="bold" fontSize="xs" letterSpacing="wide">
              RESTRICTED
            </Text>
          </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
