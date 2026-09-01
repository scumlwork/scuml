'use client';

import {
  Box,
  Input,
  Select,
  Text,
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
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from '@chakra-ui/react';
import { ArrowBackIcon } from '@chakra-ui/icons';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useAuth } from '@/context/AuthContext';

interface Company {
  _id: string;
  companyName: string;
  address?: string;
  city?: string;
  state?: string;
  serialNumber?: string;
  email?: string;
  phone?: string;
}

const LETTER_TYPES = ['Letter of Invitation', 'Warning Letter'];

// Addressee titles for the Title field.
const TITLES = [
  'THE MANAGING DIRECTOR/CEO',
  'CHIEF EXECUTIVE OFFICER',
  'GENERAL MANAGER',
  'THE EXECUTIVE CHAIRMAN',
  'THE DIRECTOR GENERAL',
  'THE DIRECTOR',
  'CHIEF OPERATING OFFICER',
  'THE GENERAL OVERSEER',
];

// "30th July, 2026" — matches the date format used on the printed letter.
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
function formatOrdinalDateString(dateStr: string) {
  if (!dateStr) return '';
  // Parse as local date (not UTC) so the displayed day doesn't shift.
  const [y, m, d] = dateStr.split('-').map(Number);
  return formatOrdinalDate(new Date(y, m - 1, d));
}

// Fixed signature image used on every generated letter — see
// public/IBRAHIM_signature.png.
const SIGNATURE_SRC = '/IBRAHIM_signature.png';

// Builds Google Calendar's event-creation URL for the Reporting Date, with
// a note reading "Meeting with {companyName} today" — an all-day event
// since there's no time field, just a date.
function buildGoogleCalendarUrl(companyName: string, dateStr: string) {
  const start = dateStr.replace(/-/g, '');
  const endDateObj = new Date(dateStr);
  endDateObj.setDate(endDateObj.getDate() + 1);
  const end = endDateObj.toISOString().split('T')[0].replace(/-/g, '');
  const note = `Meeting with ${companyName} today`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: note,
    dates: `${start}/${end}`,
    details: note,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function InitiateLettersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // Staff and superadmin may initiate letters (not guest).
  useEffect(() => {
    if (user && user.role === 'guest') router.replace('/');
  }, [user, router]);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<{ _id: string; companyName: string }[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const editId = searchParams.get('id');
  const [loadingExisting, setLoadingExisting] = useState(!!editId);

  // Arriving from a company's own record (e.g. the Company Compliance
  // Record modal) skips the search step — the company is already known.
  useEffect(() => {
    const companyId = searchParams.get('company');
    if (!companyId) return;
    (async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/registrations/${companyId}`,
          { withCredentials: true }
        );
        setCompany(res.data);
        setQuery(res.data.companyName);
      } catch (err) {
        console.error(err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [letterType, setLetterType] = useState('');
  const [title, setTitle] = useState('');
  const [reportingDate, setReportingDate] = useState('');
  const [generated, setGenerated] = useState(false);
  const [todayStr] = useState(() => formatOrdinalDate(new Date()));

  // Editing an existing generated-letter record — prefill from the saved
  // record (and its company) rather than starting from a search.
  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/generated-letters/${editId}`,
          { withCredentials: true }
        );
        const record = res.data;
        const companyId = record.company?._id || record.company;
        const companyRes = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/registrations/${companyId}`,
          { withCredentials: true }
        );
        setCompany(companyRes.data);
        setQuery(companyRes.data.companyName);
        setLetterType(record.letterType || '');
        setTitle(record.title || '');
        setReportingDate(record.reportingDate || '');
      } catch (err) {
        console.error('Failed to load letter for editing:', err);
      } finally {
        setLoadingExisting(false);
      }
    })();
  }, [editId]);

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

  const handleSelectCompany = async (c: { _id: string; companyName: string }) => {
    setSuggestions([]);
    setQuery(c.companyName);
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/registrations/${c._id}`,
        { withCredentials: true }
      );
      setCompany(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const canGenerate =
    !!company &&
    (letterType === 'Letter of Invitation' || letterType === 'Warning Letter') &&
    title.trim() &&
    reportingDate;

  // Records that a letter was generated so it shows up on the company's
  // Compliance Record and in Recent Activity, same as every other record
  // type — best-effort: a logging failure shouldn't block the user from
  // seeing/sharing the letter they just generated.
  const handleGenerate = async () => {
    if (!company) return;
    setGenerated(true);

    // Open the calendar tab synchronously, inside the click's trusted-event
    // window — opening it later (after the async work) gets silently
    // blocked as a popup by Chrome.
    const calendarWindow = window.open('', '_blank');

    try {
      const refNumber = `CR:3000/EFCC/BNZ /SCUML /002/${company.serialNumber || ''}`;
      const csrfRes = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
        { withCredentials: true }
      );
      if (editId) {
        await axios.put(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/generated-letters/${editId}`,
          { letterType, title, reportingDate, refNumber },
          { withCredentials: true, headers: { 'X-CSRF-Token': csrfRes.data.csrfToken } }
        );
      } else {
        await axios.post(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/generated-letters`,
          { companyId: company._id, letterType, title, reportingDate, refNumber },
          { withCredentials: true, headers: { 'X-CSRF-Token': csrfRes.data.csrfToken } }
        );
      }
    } catch (err) {
      console.error('Failed to record generated letter:', err);
    } finally {
      if (calendarWindow) {
        if (reportingDate) {
          calendarWindow.location.href = buildGoogleCalendarUrl(company.companyName, reportingDate);
        } else {
          calendarWindow.close();
        }
      }
    }
  };

  if (loadingExisting) {
    return (
      <Box h="100vh" display="flex" alignItems="center" justifyContent="center">
        <Spinner size="xl" />
      </Box>
    );
  }

  if (generated && company) {
    return (
      <GeneratedLetter
        letterType={letterType}
        company={company}
        title={title}
        todayStr={todayStr}
        reportingDateStr={formatOrdinalDateString(reportingDate)}
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
              aria-label="Back to Actions"
              icon={<ArrowBackIcon />}
              onClick={() => {
                const companyId = editId ? company?._id : searchParams.get('company');
                router.push(companyId ? `/?company=${companyId}` : '/letters');
              }}
              variant="ghost"
            />
            <Heading size="lg" flex="1" textAlign="center" color="red.500" mr={10}>
              {editId ? 'Edit Letter' : 'Initiate Letters'}
            </Heading>
          </HStack>

          {/* Company search — skipped when editing an existing letter,
              since the company it belongs to isn't changeable here. */}
          {!editId && (
          <Box mb={6} position="relative">
            <FormControl>
              <FormLabel>Search Company</FormLabel>
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCompany(null);
                }}
                placeholder="Type company name..."
              />
            </FormControl>
            {suggestions.length > 0 && (
              <Box mt={2} border="1px solid #e2e8f0" borderRadius="md" bg="white" shadow="sm">
                {suggestions.map((c) => (
                  <Box
                    key={c._id}
                    px={3}
                    py={2}
                    cursor="pointer"
                    _hover={{ bg: 'gray.100' }}
                    onClick={() => handleSelectCompany(c)}
                  >
                    {c.companyName}
                  </Box>
                ))}
              </Box>
            )}
          </Box>
          )}

          {company && (
            <VStack spacing={5} align="stretch">
              <FormControl isRequired>
                <FormLabel>Type of Letters</FormLabel>
                <Select
                  value={letterType}
                  onChange={(e) => setLetterType(e.target.value)}
                  placeholder="Select letter type"
                >
                  {LETTER_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
              </FormControl>

              {(letterType === 'Letter of Invitation' || letterType === 'Warning Letter') && (
                <>
                  <FormControl isRequired>
                    <FormLabel>Title</FormLabel>
                    <Select
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Select title"
                    >
                      {TITLES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel>Date</FormLabel>
                    <Input value={todayStr} isReadOnly cursor="not-allowed" bg="gray.100" />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Address (from registration)</FormLabel>
                    <Input
                      value={company.address || ''}
                      isReadOnly
                      cursor="not-allowed"
                      bg="gray.100"
                    />
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel>Reporting Date</FormLabel>
                    <Input
                      type="date"
                      value={reportingDate}
                      onChange={(e) => setReportingDate(e.target.value)}
                    />
                  </FormControl>

                  <Button
                    colorScheme="red"
                    size="lg"
                    isDisabled={!canGenerate}
                    onClick={handleGenerate}
                  >
                    {editId ? 'Update & Generate Letter' : 'Generate Letter'}
                  </Button>
                </>
              )}
            </VStack>
          )}
        </CardBody>
      </Card>
    </Container>
  );
}

// Splits text into lines of at most `size` words each — used to keep the
// company address from running the full width of the letter.
function chunkWords(text: string, size: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += size) {
    lines.push(words.slice(i, i + size).join(' '));
  }
  return lines;
}

// Shared letterhead + recipient block used by every letter type.
function LetterHeader({
  refNumber,
  todayStr,
  title,
  company,
}: {
  refNumber: string;
  todayStr: string;
  title: string;
  company: Company;
}) {
  const addressLines = chunkWords(company.address || '', 5);

  return (
    <>
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

      <HStack justify="space-between" mb={4} align="start">
        <Text fontWeight="bold" textDecoration="underline">{refNumber}</Text>
        <Text fontWeight="bold">{todayStr}</Text>
      </HStack>

      <Box mb={4}>
        <Text fontWeight="bold">{title},</Text>
        <Text>{company.companyName}</Text>
        {addressLines.map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
      </Box>
    </>
  );
}

// Shared signature block used at the end of every letter type — always the
// same fixed signature image, permanently, on every generated letter.
function SignatureBlock() {
  return (
    <Box>
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
  );
}

function LetterPage({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <Box
      className="letter-page"
      bg="white"
      shadow="lg"
      mb={last ? 0 : 8}
      p={{ base: 4, sm: 6, md: "20mm" }}
      minH="1123px"
      display="flex"
      flexDirection="column"
      fontFamily="Georgia, serif"
      color="gray.800"
      fontSize="sm"
      lineHeight="1.8"
    >
      {children}
    </Box>
  );
}

function LetterOfInvitationBody({ reportingDateStr }: { reportingDateStr: string }) {
  return (
    <>
      <Text fontWeight="bold" textDecoration="underline" mb={0}>LETTER OF INVITATION</Text>
      <Text fontWeight="bold" textDecoration="underline" mb={8}>
        ANTI- MONEY LAUNDERING COMPLIANCE EXAMINATION
      </Text>

      <Text mb={8} textAlign="justify">
        In accordance with the provisions of Money Laundering (Prevention and Prohibition) Act,
        2022, we wish to inform you that the Commission will conduct a compliance examination on
        your organization. The purpose of the examination is to ascertain your level of compliance
        with the provisions of Money Laundering (Prohibition and Prevention) Act, 2022 and Economic
        and Financial Crimes Commission (AML/CFT/CPF) for Designated Non – Financial Business and
        Professions Regulation, 2022.
      </Text>

      <Text mb={8} textAlign="justify">
        <b>2.</b> In view of the above, you are requested to report alongside with any other
        registered director of the company to the Head, SCUML Benin on {reportingDateStr} at{" "}
        <b>No. 1A High Court Road, G.R.A, Benin – City, Edo State.</b>
      </Text>

      <Text mb={8}>
        <b>3.</b> Kindly provide copies of the following documents for the examination.
      </Text>

      <Text mb={8}>i. Corporate Affairs Commission (CAC) Registration documents.</Text>

      <Text textAlign="center" color="red.600" fontWeight="bold" mt="auto">
        www.scuml.org
      </Text>
    </>
  );
}

function LetterOfInvitationPage2() {
  return (
    <>
      <VStack align="stretch" spacing={7} mb={8}>
        <Text>ii. Special Control Unit against Money Laundering (SCUML) Registration Certificate.</Text>
        <Text>iii. Copies of Transaction Reports File to SCUML.</Text>
        <Text>iv. Three years statement of all your bank accounts including domiciliary accounts.</Text>
        <Text>v. Three years record of transfer &amp; remittances to or from a foreign Country.</Text>
        <Text>vi. Three years Sales Records/ Sales Receipts/Sales Agreements/Contracts Received.</Text>
        <Text>vii. Three years Tax Clearance and VAT Remittance Receipts.</Text>
        <Text>viii. Three years Audited Financial Report.</Text>
        <Text>xi. License to Operate/Professional Body Membership Certificate.</Text>
        <Text>x. Names and Addresses of your affiliate businesses and partner(s).</Text>
        <Text>
          xi. Copy of compliance policy documents and evidence of employee training program on
          Anti – Money Laundering/Counter Financing of Terrorism (AML/CFT).
        </Text>
      </VStack>

      <Text mb={8} textAlign="justify">
        <b>4.</b> This request is made pursuant to <b>Section 38(1) &amp; (2) of the Economic and
        Financial Crime Commission (Establishment) Act, 2004 and Section 11 &amp; 17 of the Money
        Laundering (Prohibition &amp; Prevention) Act, 2022.</b>
      </Text>

      <Text mb={8}>
        <b>5.</b> Your cooperation in this regard would be highly appreciated, please.
      </Text>

      <Box mt="auto">
        <SignatureBlock />
      </Box>
    </>
  );
}

function WarningLetterBody({ reportingDateStr }: { reportingDateStr: string }) {
  return (
    <>
      <Text fontWeight="bold" textDecoration="underline" mb={8}>
        FINAL ANTI- MONEY LAUNDERING COMPLIANCE EXAMINATION NOTICE
      </Text>

      <Text mb={8} textAlign="justify">
        The Special Control Unit against Money Laundering (SCUML) has observed that you did not
        honor the invitation extended to your organization.
      </Text>

      <Text mb={8} textAlign="justify">
        <b>2.</b> In view of the above, you are to report alongside with the registered
        Director(s) of the Company to the Head, SCUML Benin on {reportingDateStr} at{" "}
        <b>No. 1A High Court Road, G.R.A, Benin – City, Edo State.</b>
      </Text>

      <Text mb={8} textAlign="justify">
        <b>3.</b> Failure to comply would attract <b>Legal/Administrative Sanctions</b> includes;
        closure of business premises, recommendation for withdrawal of business licenses or
        cancelation of business registration and possible prosecution in accordance with the
        provision of Economic and Financial Crimes (Anti-Money Laundering Regulations 2024).
      </Text>

      <Text mb={8}>
        <b>4.</b> Kindly provide copies of the following documents for the examination.
      </Text>

      <Text mb={8}>i. Corporate Affairs Commission (CAC) Registration documents.</Text>

      <Text textAlign="center" color="red.600" fontWeight="bold" mt="auto">
        www.scuml.org
      </Text>
    </>
  );
}

function WarningLetterPage2() {
  return (
    <>
      <VStack align="stretch" spacing={7} mb={8}>
        <Text>ii. Special Control Unit against Money Laundering (SCUML) Registration Certificate.</Text>
        <Text>iii. Copies of Transaction Reports File to SCUML.</Text>
        <Text>iv. Three years statement of all your bank accounts including domiciliary accounts.</Text>
        <Text>v. Three years record of transfer &amp; remittances to or from a foreign Country.</Text>
        <Text>vi. Three years Sales Records/ Sales Receipts/Sales Agreements/Contracts Received.</Text>
        <Text>vii. Three years Tax Clearance and VAT Remittance Receipts.</Text>
        <Text>viii. Three years Audited Financial Report.</Text>
        <Text>xi. License to Operate/Professional Body Membership Certificate.</Text>
        <Text>x. Names and Addresses of your affiliate businesses and partner(s).</Text>
        <Text>
          xi. Name(s), Address (es), BVN, Bank Name and Account Number of the Registered
          Director(s) of the organization.
        </Text>
      </VStack>

      <Text mb={8} textAlign="justify">
        <b>5.</b> This request is made pursuant to <b>Section 38(1) &amp; (2) of the Economic and
        Financial Crime Commission (Establishment) Act, 2004 and Section 11 &amp; 17 of the Money
        Laundering (Prohibition &amp; Prevention) Act, 2022.</b>
      </Text>

      <Text mb={8}>
        <b>6.</b> Your cooperation in this regard would be highly appreciated, please.
      </Text>

      <Box mt="auto">
        <SignatureBlock />
      </Box>
    </>
  );
}

function GeneratedLetter({
  letterType,
  company,
  title,
  todayStr,
  reportingDateStr,
  onBack,
}: {
  letterType: string;
  company: Company;
  title: string;
  todayStr: string;
  reportingDateStr: string;
  onBack: () => void;
}) {
  const refNumber = `CR:3000/EFCC/BNZ /SCUML /002/${company.serialNumber || ''}`;
  const isWarning = letterType === 'Warning Letter';
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const subject = `${letterType} - ${company.companyName}`;
  const fileName = `${letterType.replace(/\s+/g, '_')}_${company.companyName.replace(/\s+/g, '_')}.pdf`;

  // Rasterizes both A4 pages into one PDF — shared by Download and Share.
  const buildPdfBlob = async () => {
    const pages = Array.from(document.querySelectorAll<HTMLElement>('.letter-page'));
    const pdf = new jsPDF('p', 'mm', 'a4');
    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], { scale: 2, useCORS: true });
      // JPEG at high quality keeps this a fraction of the size an
      // uncompressed PNG raster would be — a plain PNG page at this
      // resolution can easily exceed the upload limit.
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
    }
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

  // Uploads the generated PDF once (as a real hosted document, not a data
  // URL) and reuses the link for whichever channel needs it — currently only
  // the WhatsApp desktop fallback, since email now sends the file directly.
  const ensurePdfUrl = async (blob?: Blob): Promise<string> => {
    if (pdfUrl) return pdfUrl;
    const b = blob ?? (await buildPdfBlob());
    const csrfRes = await axios.get(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
      { withCredentials: true }
    );
    const formData = new FormData();
    formData.append('pdf', b, fileName);
    const res = await axios.post(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/letters/upload-letter-pdf`,
      formData,
      { withCredentials: true, headers: { 'X-CSRF-Token': csrfRes.data.csrfToken } }
    );
    setPdfUrl(res.data.url);
    return res.data.url;
  };

  // Hands the real PDF file to the device's native share sheet (WhatsApp,
  // Gmail, Drive, etc. can all receive it as an actual attachment) — only
  // supported on mobile browsers over HTTPS. Desktop browsers don't support
  // sharing files this way, and a wa.me link can never attach a file either,
  // so there the best available fallback is a message containing a real
  // download link.
  const handleShareWhatsApp = async () => {
    if (!company.phone) {
      toast({ title: 'No phone number on file for this company.', status: 'warning', duration: 4000, isClosable: true });
      return;
    }
    setSharing(true);
    try {
      const blob = await buildPdfBlob();
      const file = new File([blob], fileName, { type: 'application/pdf' });

      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: subject, text: subject });
          return;
        } catch (shareErr: unknown) {
          if (shareErr instanceof Error && shareErr.name === 'AbortError') return; // user closed the share sheet — not an error
          // Any other native-share failure: fall through to the link fallback below.
        }
      }

      const url = await ensurePdfUrl(blob);
      const digits = company.phone.replace(/[^\d]/g, '');
      const message = `${subject}\n\nDownload the document here: ${url}`;
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('WhatsApp share failed:', err);
      toast({ title: 'Failed to prepare the document for sharing.', status: 'error', duration: 4000, isClosable: true });
    } finally {
      setSharing(false);
    }
  };

  // Sends the letter directly from the server with the PDF as a real
  // attachment — a Gmail compose link has no way to pre-attach a file, so
  // this is the only way the recipient gets an actual document, not a link.
  const handleSendEmail = async () => {
    if (!company.email) {
      toast({ title: 'No email on file for this company.', status: 'warning', duration: 4000, isClosable: true });
      return;
    }
    setSharing(true);
    try {
      const blob = await buildPdfBlob();
      const csrfRes = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
        { withCredentials: true }
      );
      const isInvitation = letterType === 'Letter of Invitation';
      const isWarning = letterType === 'Warning Letter';
      const emailSubject = isInvitation
        ? 'EFCC- SCUML Invitation'
        : isWarning
        ? 'EFCC- SCUML Final Warning'
        : subject;
      const emailText = isInvitation
        ? 'The Special Control Unit against Money Laundering (SCUML) of The Economic and Financial Crimes Commission, Benin Zonal Directorate, has scheduled Anti-Money Laundering compliance examination for your organization/ Company.\n\n' +
          'You are kindly requested to report to EFCC Office, at No. 2 High Court Road, GRA, Benin City by 10:00am on the date stated in your letter along with soft copy of the request documents in a flash drive.\n\n' +
          'Below you will find an attached formal Invitation letter. Please.'
        : isWarning
        ? 'The Special Control Unit against Money Laundering (SCUML) of The Economic and Financial Crimes Commission, Benin Zonal Directorate, has observed that you failed to respond to earlier invitation letters send to your company.\n\n' +
          'Please note  that failure to comply may attract Administrative Fines and Possible Prosecution Directors among other things.\n\n' +
          'Find attached a formal Invitation letter for your kind response and provide the required documentation in soft copy in a flash drive'
        : `Please find attached the ${letterType} for ${company.companyName}.`;

      const formData = new FormData();
      formData.append('pdf', blob, fileName);
      formData.append('companyId', company._id);
      formData.append('subject', emailSubject);
      formData.append('text', emailText);
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/letters/send-letter-email`,
        formData,
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfRes.data.csrfToken } }
      );
      toast({ title: `Email sent to ${res.data.sentTo}.`, status: 'success', duration: 4000, isClosable: true });
    } catch (err: unknown) {
      console.error('Email send failed:', err);
      const message = (axios.isAxiosError(err) && err.response?.data?.error) || 'Failed to send the email.';
      toast({ title: message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setSharing(false);
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
          .letter-page { box-shadow: none !important; margin: 0 !important; page-break-after: always; }
        }
        @page { size: A4; margin: 15mm; }
      `}</style>

      <HStack maxW="900px" mx="auto" mb={4} className="no-print" spacing={2} flexWrap="wrap" justify="center">
        <Button size="sm" leftIcon={<ArrowBackIcon />} onClick={onBack} variant="outline">
          Back to Form
        </Button>
        <Menu>
          <MenuButton as={Button} size="sm" colorScheme="green" isLoading={sharing} loadingText="Preparing…">
            Share
          </MenuButton>
          <MenuList>
            <MenuItem onClick={handleShareWhatsApp}>Share via WhatsApp</MenuItem>
            <MenuItem onClick={handleSendEmail}>Send via Email</MenuItem>
          </MenuList>
        </Menu>
        <Button size="sm" colorScheme="purple" onClick={handleDownload} isLoading={downloading} loadingText="Preparing…">
          Download
        </Button>
        <Button size="sm" colorScheme="red" onClick={() => window.print()}>Print</Button>
      </HStack>

      <Box className="print-area" maxW="794px" mx="auto" px={{ base: 3, md: 0 }}>
        <LetterPage>
          <LetterHeader refNumber={refNumber} todayStr={todayStr} title={title} company={company} />
          {isWarning ? (
            <WarningLetterBody reportingDateStr={reportingDateStr} />
          ) : (
            <LetterOfInvitationBody reportingDateStr={reportingDateStr} />
          )}
        </LetterPage>

        <LetterPage last>
          {isWarning ? (
            <WarningLetterPage2 />
          ) : (
            <LetterOfInvitationPage2 />
          )}
        </LetterPage>
      </Box>
    </Box>
  );
}
