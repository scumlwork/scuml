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
  useDisclosure,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
} from '@chakra-ui/react';
import { ArrowBackIcon } from '@chakra-ui/icons';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import jsPDF from 'jspdf';
import { useAuth } from '@/context/AuthContext';
import PrintPortal from '@/components/PrintPortal';
import PagedA4Document, { type A4Slice, A4_PAGE_HEIGHT_PX, KEEP_TOGETHER_CLASS } from '@/components/PagedA4Document';

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
  const toast = useToast();
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
  const [saving, setSaving] = useState(false);

  // When editing, "Update & Generate Memo" first asks: replace this memo, or
  // keep it as-is and spin off a new one with the changes?
  const { isOpen: isEditChoiceOpen, onOpen: openEditChoice, onClose: closeEditChoice } = useDisclosure();
  const editChoiceCancelRef = useRef<HTMLButtonElement>(null);

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
  // Recent Activity, same as every other record type.
  //  • New memo            → POST (creates the record + activity entry)
  //  • Edit, "update"      → PUT  (replaces this memo in place)
  //  • Edit, "duplicate"   → POST (leaves the original untouched, saves a
  //                                 brand-new memo carrying the changes)
  const saveMemo = async (mode: 'new' | 'update' | 'duplicate') => {
    const memoDate = mode === 'duplicate' ? formatOrdinalDate(new Date()) : todayStr;
    if (mode === 'duplicate') setTodayStr(memoDate);
    setSaving(true);
    try {
      const csrfRes = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
        { withCredentials: true }
      );
      const payload = { to, through, from, date: memoDate, refNo, subject, message };
      if (mode === 'update' && editId) {
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
      if (mode === 'duplicate') {
        toast({ title: 'Original memo kept — a new memo was created with your changes.', status: 'success', duration: 5000, isClosable: true });
      }
      setGenerated(true);
    } catch (err) {
      console.error('Failed to record memo:', err);
      toast({ title: 'Failed to save the memo.', status: 'error', duration: 4000, isClosable: true });
    } finally {
      setSaving(false);
      closeEditChoice();
    }
  };

  const handleGenerate = () => {
    if (editId) {
      openEditChoice();
    } else {
      saveMemo('new');
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
              aria-label="Back to Memo/Replies"
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

            <Button colorScheme="red" size="lg" onClick={handleGenerate} isLoading={saving}>
              {editId ? 'Edit & Generate Memo' : 'Generate Memo'}
            </Button>
          </VStack>
        </CardBody>
      </Card>

      <AlertDialog
        isOpen={isEditChoiceOpen}
        leastDestructiveRef={editChoiceCancelRef}
        onClose={closeEditChoice}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent mx={4}>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Edit this memo, or save a new copy?
            </AlertDialogHeader>
            <AlertDialogBody>
              <Text mb={2}>
                <b>Edit &amp; generate</b> replaces this memo with your changes and regenerates it.
              </Text>
              <Text>
                <b>Keep original &amp; save new</b> leaves this memo exactly as it is and creates a
                separate, duplicated memo that carries your changes.
              </Text>
            </AlertDialogBody>
            <AlertDialogFooter flexWrap="wrap" gap={2}>
              <Button ref={editChoiceCancelRef} variant="ghost" onClick={closeEditChoice} isDisabled={saving}>
                Cancel
              </Button>
              <Button colorScheme="blue" onClick={() => saveMemo('duplicate')} isLoading={saving}>
                Keep original &amp; save new
              </Button>
              <Button colorScheme="red" onClick={() => saveMemo('update')} isLoading={saving}>
                Edit &amp; generate
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
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
  const [slices, setSlices] = useState<A4Slice[]>([]);

  const fileName = `Memo_${(subject || 'Untitled').replace(/\s+/g, '_')}.pdf`;
  const contentKey = `${refNo}|${subject}|${message}`;

  // The same A4-sliced images shown on screen (see PagedA4Document) go
  // straight into the PDF — download always matches what's on screen and
  // what prints, and a long memo now spans as many pages as it needs
  // instead of getting squeezed into one.
  const handleDownload = async () => {
    if (slices.length === 0) return;
    setDownloading(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      slices.forEach((s, i) => {
        if (i > 0) pdf.addPage();
        pdf.addImage(s.dataUrl, 'JPEG', 0, 0, 210, s.heightMm);
      });
      const blob = pdf.output('blob') as Blob;
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

  const pageContent = (
    <Box
      position="relative"
      bg="white"
      p={{ base: 4, sm: 6, md: '20mm' }}
      fontFamily="Georgia, serif"
      color="gray.800"
      fontSize="sm"
      lineHeight="1.8"
    >
      {/* Background watermark — the "To" field, same diagonal style as
          the reference memo's own "DIRECTOR SCUML" watermark. Anchored to
          the first A4_PAGE_HEIGHT_PX band only (not centered in the whole,
          possibly multi-page, flow) so a long memo never splits it across
          a page boundary — it only ever appears on page 1. */}
      {to && (
        <Box position="absolute" top="0" left="0" w="100%" h={`${A4_PAGE_HEIGHT_PX}px`} zIndex={0} pointerEvents="none">
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
            userSelect="none"
          >
            {to.toUpperCase()}
          </Text>
        </Box>
      )}

      <Box position="relative" zIndex={1}>
      <Text textAlign="center" fontWeight="bold" fontSize="xs" letterSpacing="wide">
        RESTRICTED
      </Text>

      <VStack spacing={1} mb={4} mt={2} className={KEEP_TOGETHER_CLASS}>
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

      <VStack align="stretch" spacing={1} mb={6} className={KEEP_TOGETHER_CLASS}>
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

      {/* Blank lines between paragraphs collapse to a small gap instead of a full empty line. */}
      <Box mb={4}>
        {message.split(/\n\s*\n/).map((para, i) => (
          <Text key={i} whiteSpace="pre-wrap" textAlign="justify" mb={0.5}>
            {para}
          </Text>
        ))}
      </Box>

      <Box mt={8} className={KEEP_TOGETHER_CLASS}>
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
  );

  return (
    <PrintPortal>
      <Box bg="gray.100" minH="100vh" py={8}>
        <style>{`
          @media print {
            .no-print { display: none !important; }
            .a4-page { box-shadow: none !important; }
          }
          @page { size: A4; margin: 0; }
        `}</style>

        <HStack maxW="900px" mx="auto" mb={4} className="no-print" spacing={2} flexWrap="wrap" justify="center">
          <Button size="sm" leftIcon={<ArrowBackIcon />} onClick={onBack} variant="outline">
            Back to Form
          </Button>
          <Button size="sm" colorScheme="purple" onClick={handleDownload} isLoading={downloading} loadingText="Preparing…" isDisabled={slices.length === 0}>
            Download
          </Button>
          <Button size="sm" colorScheme="red" onClick={() => window.print()} isDisabled={slices.length === 0}>Print</Button>
        </HStack>

        <PagedA4Document pageContent={pageContent} contentKey={contentKey} onSlicesReady={setSlices} />
      </Box>
    </PrintPortal>
  );
}
