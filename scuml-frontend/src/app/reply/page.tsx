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

// Splits text into lines of at most `size` words each — same wrapping used
// on Initiate Letters' company address block.
function chunkWords(text: string, size: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += size) {
    lines.push(words.slice(i, i + size).join(' '));
  }
  return lines;
}

// Fixed signature image used on every generated document — see
// public/IBRAHIM_signature.png.
const SIGNATURE_SRC = '/IBRAHIM_signature.png';

export default function ReplyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const editId = searchParams.get('id');

  // 🔹 Staff and superadmin may use Reply (not guest).
  useEffect(() => {
    if (!authLoading && user && user.role === 'guest') {
      router.replace('/');
    }
  }, [authLoading, user, router]);

  const [title, setTitle] = useState('');
  const [refNo, setRefNo] = useState('');
  const [address, setAddress] = useState('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [generated, setGenerated] = useState(false);
  const [todayStr, setTodayStr] = useState(() => formatOrdinalDate(new Date()));
  const [loadingExisting, setLoadingExisting] = useState(!!editId);

  // Editing an existing reply — prefill the form (including its original
  // date, not today's) from the saved record.
  useEffect(() => {
    if (!editId) return;
    const fetchExisting = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/replies/${editId}`,
          { withCredentials: true }
        );
        const r = res.data;
        setTitle(r.title || '');
        setRefNo(r.refNo || '');
        setAddress(r.address || '');
        setTo(r.to || '');
        setSubject(r.subject || '');
        setMessage(r.message || '');
        if (r.date) setTodayStr(r.date);
      } catch (err) {
        console.error('Failed to load reply for editing:', err);
      } finally {
        setLoadingExisting(false);
      }
    };
    fetchExisting();
  }, [editId]);

  // Records the reply so it shows up on the home page, the Admin page, and
  // Recent Activity, same as every other record type. Editing an existing
  // one updates it in place and regenerates the letter with the new
  // content, instead of creating a separate record.
  const handleGenerate = async () => {
    setGenerated(true);
    try {
      const csrfRes = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
        { withCredentials: true }
      );
      const payload = { title, refNo, date: todayStr, address, to, subject, message };
      if (editId) {
        await axios.put(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/replies/${editId}`,
          payload,
          { withCredentials: true, headers: { 'X-CSRF-Token': csrfRes.data.csrfToken } }
        );
      } else {
        await axios.post(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/replies`,
          payload,
          { withCredentials: true, headers: { 'X-CSRF-Token': csrfRes.data.csrfToken } }
        );
      }
    } catch (err) {
      console.error('Failed to record reply:', err);
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
      <GeneratedReply
        title={title}
        refNo={refNo}
        address={address}
        to={to}
        todayStr={todayStr}
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
              aria-label="Back to Memo/Replies"
              icon={<ArrowBackIcon />}
              onClick={() => router.push('/memo-drafts')}
              variant="ghost"
            />
            <Heading size="lg" flex="1" textAlign="center" color="red.500" mr={10}>
              {editId ? 'Edit Reply' : 'Reply'}
            </Heading>
          </HStack>

          <VStack spacing={5} align="stretch">
            <FormControl>
              <FormLabel>Title</FormLabel>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. THE DIRECTOR" />
            </FormControl>

            <FormControl>
              <FormLabel>Reference Number</FormLabel>
              <Input
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
                placeholder="e.g. CB:4000/EFCC/BNZ/SCUML/VOL.1/41"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Date</FormLabel>
              <Input value={todayStr} isReadOnly cursor="not-allowed" bg="gray.100" />
            </FormControl>

            <FormControl>
              <FormLabel>Address</FormLabel>
              <Textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter the recipient's address"
                minH="80px"
              />
            </FormControl>

            <FormControl>
              <FormLabel>To</FormLabel>
              <Input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="Email address the letter will be sent to"
              />
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
                placeholder="Write the body of the letter..."
                minH="200px"
              />
            </FormControl>

            <Button colorScheme="red" size="lg" onClick={handleGenerate}>
              {editId ? 'Update & Generate Letter' : 'Generate Letter'}
            </Button>
          </VStack>
        </CardBody>
      </Card>
    </Container>
  );
}

function GeneratedReply({
  title,
  refNo,
  address,
  to,
  todayStr,
  subject,
  message,
  onBack,
}: {
  title: string;
  refNo: string;
  address: string;
  to: string;
  todayStr: string;
  subject: string;
  message: string;
  onBack: () => void;
}) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);

  const fileName = `Reply_${(subject || 'Untitled').replace(/\s+/g, '_')}.pdf`;
  const addressLines = chunkWords(address || '', 5);

  const buildPdfBlob = async () => {
    const page = document.querySelector<HTMLElement>('.reply-page');
    if (!page) throw new Error('Letter page not found');
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

  // Sends the letter directly from the server with the PDF as a real
  // attachment, to the email address entered in the "To" field.
  const handleSendEmail = async () => {
    if (!to) {
      toast({ title: 'Enter an email address in the "To" field first.', status: 'warning', duration: 4000, isClosable: true });
      return;
    }
    setSending(true);
    try {
      const blob = await buildPdfBlob();
      const csrfRes = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
        { withCredentials: true }
      );
      const formData = new FormData();
      formData.append('pdf', blob, fileName);
      formData.append('to', to);
      formData.append('subject', subject || 'SCUML Correspondence');
      formData.append('text', `Please find attached: ${subject || 'the letter'}.`);
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/replies/send-email`,
        formData,
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfRes.data.csrfToken } }
      );
      toast({ title: `Email sent to ${res.data.sentTo}.`, status: 'success', duration: 4000, isClosable: true });
    } catch (err: unknown) {
      console.error('Email send failed:', err);
      const msg = (axios.isAxiosError(err) && err.response?.data?.error) || 'Failed to send the email.';
      toast({ title: msg, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setSending(false);
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
          .reply-page { box-shadow: none !important; margin: 0 !important; }
        }
        @page { size: A4; margin: 15mm; }
      `}</style>

      <HStack maxW="900px" mx="auto" mb={4} className="no-print" spacing={2} flexWrap="wrap" justify="center">
        <Button size="sm" leftIcon={<ArrowBackIcon />} onClick={onBack} variant="outline">
          Back to Form
        </Button>
        <Button size="sm" colorScheme="green" onClick={handleSendEmail} isLoading={sending} loadingText="Sending…">
          Send Email
        </Button>
        <Button size="sm" colorScheme="purple" onClick={handleDownload} isLoading={downloading} loadingText="Preparing…">
          Download
        </Button>
        <Button size="sm" colorScheme="red" onClick={() => window.print()}>Print</Button>
      </HStack>

      <Box className="print-area" maxW="794px" mx="auto" px={{ base: 3, md: 0 }}>
        <Box
          className="reply-page"
          bg="white"
          shadow="lg"
          p={{ base: 4, sm: 6, md: '20mm' }}
          minH="1123px"
          display="flex"
          flexDirection="column"
          fontFamily="Georgia, serif"
          color="gray.800"
          fontSize="sm"
          lineHeight="1.8"
        >
          {/* Letterhead — logo, EFCC name, and unit heading, same as
              Letter of Invitation / Warning Letter. */}
          <VStack spacing={1} mb={4}>
            <Image src="/scuml-logo.PNG" alt="EFCC" boxSize="90px" />
            <Text fontWeight="bold" fontSize="lg" textAlign="center">
              ECONOMIC AND FINANCIAL CRIMES COMMISSION
            </Text>
            <Text fontWeight="bold" color="red.600" textAlign="center">
              SPECIAL CONTROL UNIT AGAINST MONEY LAUNDERING
            </Text>
            <Box borderTopWidth="2px" borderColor="black" w="100%" mt={2} pt={1}>
              <Text textAlign="center" fontSize="xs">
                Edo: No. 2 Court Road, By Reservation Road, GRA,Oka,Benin City,Edo State.
              </Text>
              <Text textAlign="center" fontSize="xs" fontWeight="bold">
                Tel: 0803 0728 895  Email: edoscuml@efcc.gov.org
              </Text>
            </Box>
            <Box borderTopWidth="1px" borderColor="black" w="100%" />
          </VStack>

          {/* Date, top right — same layout as Initiate Letters. */}
          <HStack justify="flex-end" mb={4}>
            <Text fontWeight="bold">{todayStr}</Text>
          </HStack>

          {/* Reference number, above the recipient title/address block. */}
          <Text fontWeight="bold" mb={2}>{refNo || 'N/A'}</Text>

          <Box mb={4}>
            <Text fontWeight="bold">{title || 'N/A'},</Text>
            {addressLines.map((line, i) => (
              <Text key={i}>{line}</Text>
            ))}
          </Box>

          <Text fontWeight="bold" textDecoration="underline" mb={8}>
            {subject || 'N/A'}
          </Text>

          <Text whiteSpace="pre-wrap" textAlign="justify" mb={8}>
            {message}
          </Text>

          <Box mt="auto">
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
        </Box>
      </Box>
    </Box>
  );
}
