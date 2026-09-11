'use client';

// Turns an existing Off-Site or On-Site Inspection record into a printable
// cover letter — same letterhead, fields, and signature as My Memo (To,
// Through, From, Date, Ref. No., Subject — no free-text message), with the
// inspection's own saved entries filled in below the Subject line instead.
// Nothing here is saved back to the server; it only formats data that was
// already recorded on the inspection.
import {
  Box,
  Input,
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
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  useToast,
} from '@chakra-ui/react';
import { ArrowBackIcon } from '@chakra-ui/icons';
import { useState, useEffect, ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import jsPDF from 'jspdf';
import { useAuth } from '@/context/AuthContext';
import PrintPortal from '@/components/PrintPortal';
import PagedA4Document, { type A4Slice, A4_PAGE_HEIGHT_PX, KEEP_TOGETHER_CLASS } from '@/components/PagedA4Document';

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

const SIGNATURE_SRC = '/IBRAHIM_signature.png';

type Shareholder = { name?: string; pepStatus?: string; nonResident?: string; foreigner?: string; sanctionList?: string };
type Obligation = { obligation?: string; complianceStatus?: string; remark?: string };
type OrgProfile = { desc?: string; remark?: string };
type Attendance = { name?: string; organization?: string; position?: string; phone?: string; sign?: string };

type OffSiteData = {
  _id: string;
  company?: { companyName?: string; natureOfBusiness?: string } | string;
  mode?: string;
  examinationDate?: string;
  introduction?: string;
  contact?: string;
  officeAddress?: string;
  telephone?: string;
  sources?: string;
  complianceStatus?: string;
  rc?: string;
  scuml?: string;
  tin?: string;
  transactionReporting?: string;
  shareholders?: Shareholder[];
  politicallyExposed?: string;
  affiliates?: string;
  legalIssues?: string;
  locations?: string | string[];
  products?: string | string[];
  recommendation?: string;
};

type OnSiteData = {
  _id: string;
  company?: { companyName?: string; natureOfBusiness?: string } | string;
  obligations?: Obligation[];
  orgProfile?: OrgProfile[];
  riskClassification?: { level?: string; vulnerabilities?: string };
  riskLevel?: string;
  attendance?: Attendance[];
};

const TYPE_LABEL: Record<string, string> = { offsite: 'Off-Site Inspection', onsite: 'On-Site Inspection' };

export default function InspectionReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();

  const inspectionType = searchParams.get('type') === 'onsite' ? 'onsite' : 'offsite';
  const inspectionId = searchParams.get('id');
  const typeLabel = TYPE_LABEL[inspectionType];

  useEffect(() => {
    if (!authLoading && user && user.role === 'guest') router.replace('/');
  }, [authLoading, user, router]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [offSite, setOffSite] = useState<OffSiteData | null>(null);
  const [onSite, setOnSite] = useState<OnSiteData | null>(null);
  const [companyName, setCompanyName] = useState('');

  const [to, setTo] = useState('');
  const [through, setThrough] = useState('');
  const [from, setFrom] = useState('Zonal Coordinator, SCUML Benin');
  const [refNo, setRefNo] = useState('');
  const [subject, setSubject] = useState('');
  const [todayStr] = useState(() => formatOrdinalDate(new Date()));
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    if (!inspectionId) {
      setLoadError('No inspection selected.');
      setLoading(false);
      return;
    }
    const fetchData = async () => {
      try {
        const path = inspectionType === 'onsite' ? 'on-site-inspections' : 'offsite-inspections';
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/${path}/${inspectionId}`,
          { withCredentials: true }
        );
        const data = res.data;
        const name = typeof data.company === 'object' && data.company ? data.company.companyName : '';
        setCompanyName(name || '');
        setSubject(`${typeLabel} Report – ${name || ''}`.trim());
        if (inspectionType === 'onsite') {
          setOnSite(data);
        } else {
          if (data.mode === 'document') {
            setLoadError('This Off-Site Inspection was uploaded as a document, not filled in as a form — there are no individual fields to build a report from.');
          }
          setOffSite(data);
        }
      } catch (err) {
        console.error('Failed to load inspection:', err);
        setLoadError('Failed to load this inspection record.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId, inspectionType]);

  if (user?.role === 'guest') return null;

  if (loading) {
    return (
      <Box h="100vh" display="flex" alignItems="center" justifyContent="center">
        <Spinner size="xl" />
      </Box>
    );
  }

  if (loadError) {
    return (
      <Container maxW="2xl" py={10}>
        <Card shadow="lg" borderRadius="2xl">
          <CardBody>
            <HStack mb={4}>
              <IconButton aria-label="Back" icon={<ArrowBackIcon />} onClick={() => router.back()} variant="ghost" />
              <Heading size="md" color="red.500">Cannot generate report</Heading>
            </HStack>
            <Text>{loadError}</Text>
          </CardBody>
        </Card>
      </Container>
    );
  }

  if (generated) {
    return (
      <GeneratedInspectionReport
        to={to}
        through={through}
        from={from}
        todayStr={todayStr}
        refNo={refNo}
        subject={subject}
        companyName={companyName}
        typeLabel={typeLabel}
        offSite={offSite}
        onSite={onSite}
        onBack={() => setGenerated(false)}
      />
    );
  }

  const handleGenerate = () => {
    if (!to.trim() || !subject.trim()) {
      toast({ title: 'Fill in at least To and Subject.', status: 'warning', duration: 3000, isClosable: true });
      return;
    }
    setGenerated(true);
  };

  return (
    <Container maxW="4xl" py={10} className="no-print">
      <Card shadow="lg" borderRadius="2xl">
        <CardBody>
          <HStack mb={4}>
            <IconButton aria-label="Back" icon={<ArrowBackIcon />} onClick={() => router.back()} variant="ghost" />
            <Heading size="lg" flex="1" textAlign="center" color="red.500" mr={10}>
              Generate {typeLabel} Report
            </Heading>
          </HStack>

          <Text fontSize="sm" color="gray.500" mb={5} textAlign="center">
            For {companyName || 'this company'}
          </Text>

          <VStack spacing={5} align="stretch">
            <FormControl isRequired>
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

            <FormControl isRequired>
              <FormLabel>Subject</FormLabel>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </FormControl>

            <Button colorScheme="red" size="lg" onClick={handleGenerate}>
              Generate
            </Button>
          </VStack>
        </CardBody>
      </Card>
    </Container>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <HStack align="start" mb={1.5} className={KEEP_TOGETHER_CLASS}>
      <Text fontWeight="bold" minW="180px" flexShrink={0}>{label}:</Text>
      <Text whiteSpace="pre-wrap">{value}</Text>
    </HStack>
  );
}

function GeneratedInspectionReport({
  to,
  through,
  from,
  todayStr,
  refNo,
  subject,
  companyName,
  typeLabel,
  offSite,
  onSite,
  onBack,
}: {
  to: string;
  through: string;
  from: string;
  todayStr: string;
  refNo: string;
  subject: string;
  companyName: string;
  typeLabel: string;
  offSite: OffSiteData | null;
  onSite: OnSiteData | null;
  onBack: () => void;
}) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const [slices, setSlices] = useState<A4Slice[]>([]);

  const fileName = `${typeLabel.replace(/\s+/g, '_')}_Report_${(companyName || 'Company').replace(/\s+/g, '_')}.pdf`;
  const inspectionId = offSite?._id || onSite?._id || '';

  // The same A4-sliced images shown on screen (see PagedA4Document) go
  // straight into the PDF — download always matches what's on screen and
  // what prints.
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

  const locations = Array.isArray(offSite?.locations) ? offSite?.locations.join(', ') : offSite?.locations;
  const products = Array.isArray(offSite?.products) ? offSite?.products.join(', ') : offSite?.products;

  const pageContent = (
    <Box
      bg="white"
      p={{ base: 4, sm: 6, md: '20mm' }}
      fontFamily="Georgia, serif"
      color="gray.800"
      fontSize="sm"
      lineHeight="1.8"
      position="relative"
    >
      {/* Background watermark — the "To" field, same diagonal style used
          on My Memo. Anchored to the first A4_PAGE_HEIGHT_PX band only (not
          centered in the whole, possibly multi-page, flow) so a long
          report never splits it across a page boundary — it only ever
          appears on page 1. */}
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

          {/* Off-Site Inspection entries */}
          {offSite && (
            <Box mb={6}>
              <Field label="Company" value={companyName || 'N/A'} />
              <Field label="Examination Date" value={offSite.examinationDate || 'N/A'} />
              <Field label="Introduction" value={offSite.introduction || 'N/A'} />
              <Field label="Contact" value={offSite.contact || 'N/A'} />
              <Field label="Office Address" value={offSite.officeAddress || 'N/A'} />
              <Field label="Telephone" value={offSite.telephone || 'N/A'} />
              <Field label="Sources" value={offSite.sources || 'N/A'} />
              <Field label="Compliance Status" value={offSite.complianceStatus || 'N/A'} />
              <Field label="RC" value={offSite.rc || 'N/A'} />
              <Field label="SCUML" value={offSite.scuml || 'N/A'} />
              <Field label="TIN" value={offSite.tin || 'N/A'} />
              <Field label="Transaction Reporting" value={offSite.transactionReporting || 'N/A'} />

              {Array.isArray(offSite.shareholders) && offSite.shareholders.length > 0 && (
                <Box my={3}>
                  <Text fontWeight="bold" mb={2}>Shareholders / Directors</Text>
                  <Table size="sm" variant="simple" fontFamily="Georgia, serif">
                    <Thead>
                      <Tr>
                        <Th>S/N</Th>
                        <Th>Name</Th>
                        <Th>PEP Status</Th>
                        <Th>Non Resident</Th>
                        <Th>Foreigner</Th>
                        <Th>SANC. List</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {offSite.shareholders.map((s, idx) => (
                        <Tr key={idx} className={KEEP_TOGETHER_CLASS}>
                          <Td>{idx + 1}</Td>
                          <Td>{s.name || 'N/A'}</Td>
                          <Td>{s.pepStatus || 'N/A'}</Td>
                          <Td>{s.nonResident || 'N/A'}</Td>
                          <Td>{s.foreigner || 'N/A'}</Td>
                          <Td>{s.sanctionList || 'N/A'}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              )}

              <Field label="Politically Exposed" value={offSite.politicallyExposed || 'N/A'} />
              <Field label="Affiliates" value={offSite.affiliates || 'N/A'} />
              <Field label="Legal Issues" value={offSite.legalIssues || 'N/A'} />
              <Field label="Locations" value={locations || 'N/A'} />
              <Field label="Products" value={products || 'N/A'} />
              <Field label="Recommendation" value={offSite.recommendation || 'N/A'} />
            </Box>
          )}

          {/* On-Site Inspection entries */}
          {onSite && (
            <Box mb={6}>
              <Field label="Company" value={companyName || 'N/A'} />

              <Text fontWeight="bold" mt={3} mb={2}>Compliance with the Law &amp; Regulation</Text>
              {Array.isArray(onSite.obligations) && onSite.obligations.length > 0 ? (
                <Table size="sm" variant="simple" fontFamily="Georgia, serif" mb={3}>
                  <Thead>
                    <Tr><Th>Obligation</Th><Th>Compliance Status</Th><Th>Remark</Th></Tr>
                  </Thead>
                  <Tbody>
                    {onSite.obligations.map((o, idx) => (
                      <Tr key={idx} className={KEEP_TOGETHER_CLASS}>
                        <Td>{o.obligation || 'N/A'}</Td>
                        <Td>{o.complianceStatus || 'N/A'}</Td>
                        <Td>{o.remark || 'N/A'}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              ) : (
                <Text mb={3}>N/A</Text>
              )}

              <Text fontWeight="bold" mb={2}>Organization Profile</Text>
              {Array.isArray(onSite.orgProfile) && onSite.orgProfile.length > 0 ? (
                <Table size="sm" variant="simple" fontFamily="Georgia, serif" mb={3}>
                  <Thead>
                    <Tr><Th>Description</Th><Th>Remark</Th></Tr>
                  </Thead>
                  <Tbody>
                    {onSite.orgProfile.map((p, idx) => (
                      <Tr key={idx} className={KEEP_TOGETHER_CLASS}>
                        <Td>{p.desc || 'N/A'}</Td>
                        <Td>{p.remark || 'N/A'}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              ) : (
                <Text mb={3}>N/A</Text>
              )}

              <Text fontWeight="bold" mb={2}>Money Laundering Risk Classification</Text>
              <Field label="Level" value={onSite.riskClassification?.level || onSite.riskLevel || 'N/A'} />
              <Field label="Vulnerabilities" value={onSite.riskClassification?.vulnerabilities || 'N/A'} />

              <Text fontWeight="bold" mt={3} mb={2}>Attendance</Text>
              {Array.isArray(onSite.attendance) && onSite.attendance.length > 0 ? (
                <Table size="sm" variant="simple" fontFamily="Georgia, serif">
                  <Thead>
                    <Tr><Th>Name</Th><Th>Organization</Th><Th>Position</Th><Th>Phone</Th><Th>Sign</Th></Tr>
                  </Thead>
                  <Tbody>
                    {onSite.attendance.map((a, idx) => (
                      <Tr key={idx} className={KEEP_TOGETHER_CLASS}>
                        <Td>{a.name || 'N/A'}</Td>
                        <Td>{a.organization || 'N/A'}</Td>
                        <Td>{a.position || 'N/A'}</Td>
                        <Td>{a.phone || 'N/A'}</Td>
                        <Td>{a.sign || 'N/A'}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              ) : (
                <Text>N/A</Text>
              )}
            </Box>
          )}

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

        <PagedA4Document pageContent={pageContent} contentKey={inspectionId} onSlicesReady={setSlices} />
      </Box>
    </PrintPortal>
  );
}
