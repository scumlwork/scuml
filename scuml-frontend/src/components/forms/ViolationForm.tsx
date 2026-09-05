'use client';

import {
  Box,
  Text,
  Input,
  Button,
  VStack,
  HStack,
  FormControl,
  FormLabel,
  useToast,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Checkbox,
  TableContainer,
  Image,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from '@chakra-ui/react';
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { CompanyFormProps } from './LetterForm';
import { VIOLATIONS_LIST } from '@/lib/violationFines';
import { nairaAmountInWords } from '@/lib/numberToWords';

type OpenViolationInfo = {
  outstandingBalance?: number;
  openViolationId?: string | null;
  amountSanctioned?: number | null;
  amountPaidSoFar?: number | null;
};

type Company = {
  _id: string;
  companyName: string;
  address?: string;
  serialNumber?: string;
  email?: string;
  phone?: string;
};

type SelectedViolation = { sn: number; offence: string; category: 'professions' | 'businesses'; amount: number; label: string };

const formatNaira = (raw: string) => {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(Number(digits));
};

const parseAmount = (formatted: string) => {
  const digits = formatted.replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
};

const formatSignedNaira = (n: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(n);

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

function chunkWords(text: string, size: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += size) {
    lines.push(words.slice(i, i + size).join(' '));
  }
  return lines;
}

// Self-contained — looks up whether this company already has an open
// (unpaid) violation itself, rather than requiring the caller to know that,
// so it behaves identically whether the company came from a search-select
// step (the standalone page) or was already known (embedded in the
// Company Compliance Record modal).
export default function ViolationForm({ companyId, companyName, onSuccess }: CompanyFormProps) {
  const [openInfo, setOpenInfo] = useState<OpenViolationInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [company, setCompany] = useState<Company | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // When a company already has an open violation, "+ Add More" defaults to
  // reopening the full checklist (to cite further offences against the same
  // record) rather than the payment view — payment is still reachable via
  // the toggle below.
  const [mode, setMode] = useState<'checklist' | 'payment'>('checklist');
  const toast = useToast();

  // Checked fines — keyed "<sn>-professions" / "<sn>-businesses" — selected
  // from the official DNFBP sanctions schedule instead of a manual amount.
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const toggleFine = (key: string) =>
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));

  // The notice letter, generated the moment offences are saved — holds
  // exactly what was just cited (not the company's full violation history).
  const [generatedNotice, setGeneratedNotice] = useState<{
    selectedViolations: SelectedViolation[];
    totalFines: number;
  } | null>(null);
  // Tracks what handleSubmit just did, so "Back to Form" can undo it safely
  // instead of duplicating on the next save: a brand-new record can just be
  // deleted and recreated (a real edit); a batch appended to an already-
  // existing open violation can't be safely un-appended without more
  // backend support, so that case only clears the checklist instead.
  const [lastSave, setLastSave] = useState<{ violationId: string; wasFreshCreate: boolean } | null>(null);

  const selectedViolations = useMemo(() => {
    const result: SelectedViolation[] = [];
    for (const v of VIOLATIONS_LIST) {
      if (checked[`${v.sn}-professions`]) {
        result.push({ sn: v.sn, offence: v.offence, category: 'professions', amount: v.professions.amount, label: v.professions.label });
      }
      if (checked[`${v.sn}-businesses`]) {
        result.push({ sn: v.sn, offence: v.offence, category: 'businesses', amount: v.businesses.amount, label: v.businesses.label });
      }
    }
    return result;
  }, [checked]);

  const totalFines = selectedViolations.reduce((sum, v) => sum + v.amount, 0);

  const hasOpenViolation = !!openInfo?.openViolationId;
  const remainingAfterPayment = hasOpenViolation
    ? (openInfo?.outstandingBalance || 0) - parseAmount(paymentAmount)
    : 0;

  useEffect(() => {
    let cancelled = false;
    const fetchOpenInfo = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/violations/search?query=${encodeURIComponent(companyName)}`,
          { withCredentials: true }
        );
        const match = (res.data || []).find((c: { _id: string }) => c._id === companyId);
        if (!cancelled) setOpenInfo(match || null);
      } catch (err) {
        console.error('Failed to check existing violation:', err);
      } finally {
        if (!cancelled) setLoadingInfo(false);
      }
    };
    fetchOpenInfo();
    return () => {
      cancelled = true;
    };
  }, [companyId, companyName]);

  // Needed for the notice letter's letterhead (address, reference number) —
  // fetched once regardless of whether a letter ends up being generated.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/registrations/${companyId}`,
          { withCredentials: true }
        );
        if (!cancelled) setCompany(res.data);
      } catch (err) {
        console.error('Failed to load company details:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const handleSubmit = async () => {
    const csrfRes = await axios.get(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
      { withCredentials: true }
    );
    const csrfToken = csrfRes.data.csrfToken;

    if (hasOpenViolation && mode === 'payment') {
      if (!paymentAmount || parseAmount(paymentAmount) <= 0) {
        toast({ title: 'Please enter a payment amount', status: 'warning', duration: 3000, isClosable: true });
        return;
      }

      setSubmitting(true);
      try {
        await axios.put(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/violations/${openInfo!.openViolationId}/pay`,
          { paymentAmount: parseAmount(paymentAmount) },
          { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } }
        );
        toast({ title: 'Payment recorded.', description: 'The balance has been updated.', status: 'success', duration: 4000, isClosable: true });
        onSuccess();
      } catch (err) {
        console.error('Failed to record payment:', err);
        toast({ title: 'Failed to record payment.', status: 'error', duration: 4000, isClosable: true });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (selectedViolations.length === 0) {
      toast({ title: 'Select at least one violation', status: 'warning', duration: 3000, isClosable: true });
      return;
    }

    setSubmitting(true);
    try {
      if (hasOpenViolation) {
        // Append to the existing open violation instead of creating a
        // separate record for the same company.
        await axios.put(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/violations/${openInfo!.openViolationId}/add-violations`,
          { selectedViolations },
          { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } }
        );
        toast({ title: 'Violations added.', description: 'The additional offences have been added to the existing record.', status: 'success', duration: 4000, isClosable: true });
        setLastSave({ violationId: openInfo!.openViolationId!, wasFreshCreate: false });
      } else {
        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/violations`,
          {
            company: companyId,
            amountSanctioned: totalFines,
            amountPaid: 0,
            selectedViolations,
          },
          { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } }
        );
        toast({ title: 'Violation saved.', description: 'The violation record has been successfully saved.', status: 'success', duration: 4000, isClosable: true });
        setLastSave({ violationId: res.data._id, wasFreshCreate: true });
      }
      // The offences just cited become the notice letter — generated right
      // after saving, same as every other record type in this app.
      setGeneratedNotice({ selectedViolations, totalFines });
    } catch (err) {
      console.error('Failed to save violation:', err);
      toast({ title: 'Failed to save violation.', status: 'error', duration: 4000, isClosable: true });
    } finally {
      setSubmitting(false);
    }
  };

  // "Back to Form" from the generated notice — a brand-new record can be
  // deleted and recreated on the next save (a real edit); a batch appended
  // to an already-existing open violation can't be safely un-appended, so
  // that case just clears the checklist so a resubmit can't double-count it.
  const handleBackToForm = async () => {
    if (lastSave?.wasFreshCreate) {
      try {
        const csrfRes = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
          { withCredentials: true }
        );
        await axios.delete(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/violations/${lastSave.violationId}`,
          { withCredentials: true, headers: { 'X-CSRF-Token': csrfRes.data.csrfToken } }
        );
      } catch (err) {
        console.error('Failed to remove the draft violation for editing:', err);
      }
    } else if (lastSave) {
      setChecked({});
    }
    setLastSave(null);
    setGeneratedNotice(null);
  };

  if (generatedNotice && company) {
    return (
      <ViolationNoticeLetter
        company={company}
        selectedViolations={generatedNotice.selectedViolations}
        totalFines={generatedNotice.totalFines}
        onBack={handleBackToForm}
        onDone={onSuccess}
      />
    );
  }

  if (loadingInfo) {
    return <Text fontSize="sm" color="gray.500">Checking existing balance…</Text>;
  }

  const checklistView = (
    <>
      <Text fontSize="sm" color="gray.600">
        Select every offence that applies, under whichever column (Professions or
        Businesses) fits this company. The total below updates automatically.
      </Text>

      <TableContainer maxH="420px" overflowY="auto" borderWidth="1px" borderRadius="md">
        <Table size="sm">
          <Thead position="sticky" top={0} bg="white" zIndex={1}>
            <Tr>
              <Th w="8">S/N</Th>
              <Th>Offence</Th>
              <Th>Professions</Th>
              <Th>Businesses</Th>
            </Tr>
          </Thead>
          <Tbody>
            {VIOLATIONS_LIST.map((v) => (
              <Tr key={v.sn}>
                <Td verticalAlign="top">{v.sn}.</Td>
                <Td whiteSpace="normal" fontSize="xs" minW="220px" verticalAlign="top">
                  {v.offence}
                </Td>
                <Td whiteSpace="normal" fontSize="xs" verticalAlign="top">
                  <Checkbox
                    isChecked={!!checked[`${v.sn}-professions`]}
                    onChange={() => toggleFine(`${v.sn}-professions`)}
                  >
                    {v.professions.label}
                  </Checkbox>
                </Td>
                <Td whiteSpace="normal" fontSize="xs" verticalAlign="top">
                  <Checkbox
                    isChecked={!!checked[`${v.sn}-businesses`]}
                    onChange={() => toggleFine(`${v.sn}-businesses`)}
                  >
                    {v.businesses.label}
                  </Checkbox>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>

      <Box p={3} borderWidth="1px" borderRadius="md" bg="red.50" borderColor="red.200">
        <Text fontWeight="bold" color="red.600">
          Total Sanctioned Amount: {formatSignedNaira(totalFines)}
        </Text>
        <Text fontSize="xs" color="red.600">
          {selectedViolations.length} violation{selectedViolations.length === 1 ? '' : 's'} selected
        </Text>
      </Box>

      <Button colorScheme="red" onClick={handleSubmit} isLoading={submitting}>
        {hasOpenViolation ? 'Add Selected Violations' : 'Save Violation'}
      </Button>
    </>
  );

  return (
    <VStack spacing={4} align="stretch">
      {hasOpenViolation && (
        <Box p={3} borderWidth="1px" borderRadius="md" bg="red.50" borderColor="red.200">
          <Text fontWeight="bold" color="red.600">
            Existing Outstanding Balance: {formatSignedNaira(openInfo?.outstandingBalance || 0)}
          </Text>
          <Text fontSize="xs" color="red.600">
            Sanctioned {formatSignedNaira(openInfo?.amountSanctioned || 0)} · Paid so far{' '}
            {formatSignedNaira(openInfo?.amountPaidSoFar || 0)}
          </Text>
        </Box>
      )}

      {hasOpenViolation && (
        <Box>
          <Button
            size="sm"
            variant={mode === 'checklist' ? 'solid' : 'outline'}
            colorScheme="red"
            mr={2}
            onClick={() => setMode('checklist')}
          >
            Add More Violations
          </Button>
          <Button
            size="sm"
            variant={mode === 'payment' ? 'solid' : 'outline'}
            colorScheme="red"
            onClick={() => setMode('payment')}
          >
            Record Payment
          </Button>
        </Box>
      )}

      {hasOpenViolation && mode === 'payment' ? (
        <>
          <FormControl>
            <FormLabel>Payment Amount</FormLabel>
            <Input
              type="text"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(formatNaira(e.target.value))}
              placeholder="₦0.00"
            />
          </FormControl>

          <Box
            p={3}
            borderWidth="1px"
            borderRadius="md"
            bg={remainingAfterPayment > 0 ? 'red.50' : 'green.50'}
            borderColor={remainingAfterPayment > 0 ? 'red.200' : 'green.200'}
          >
            <Text fontWeight="bold" color={remainingAfterPayment > 0 ? 'red.600' : 'green.600'}>
              Balance After This Payment: {formatSignedNaira(remainingAfterPayment)}
            </Text>
          </Box>

          <Button colorScheme="red" onClick={handleSubmit} isLoading={submitting}>
            Record Payment
          </Button>
        </>
      ) : (
        checklistView
      )}
    </VStack>
  );
}

// The formal "Notice of Penalties for Non-Compliance" letter — same
// letterhead, colors, and signature as Letter of Invitation / Warning
// Letter, with the reference number, company name, address, and today's
// date filled in automatically. Length varies with how many offences were
// selected, so unlike the fixed 2-page letters this renders as one
// naturally-flowing page and gets sliced into as many A4 pages as needed
// for PDF/print.
function ViolationNoticeLetter({
  company,
  selectedViolations,
  totalFines,
  onBack,
  onDone,
}: {
  company: Company;
  selectedViolations: SelectedViolation[];
  totalFines: number;
  onBack: () => void | Promise<void>;
  onDone: () => void;
}) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [backing, setBacking] = useState(false);
  const [todayStr] = useState(() => formatOrdinalDate(new Date()));

  const handleBack = async () => {
    setBacking(true);
    try {
      await onBack();
    } finally {
      setBacking(false);
    }
  };

  const refNumber = `CR:4000/EFCC/BNZ/SCUML/VOL.1/${company.serialNumber || ''}`;
  const addressLines = chunkWords(company.address || '', 5);
  const fileName = `Violation_Notice_${company.companyName.replace(/\s+/g, '_')}.pdf`;
  const subject = `Notice of Penalties for Non-Compliance - ${company.companyName}`;

  // Renders the whole notice as one tall canvas, then slices it into
  // however many A4-height pages the content actually needs — the row
  // count here varies with how many offences were selected (1 to 23),
  // unlike every other letter in this app which is always a fixed length.
  const buildPdfBlob = async () => {
    const page = document.querySelector<HTMLElement>('.violation-letter');
    if (!page) throw new Error('Letter page not found');
    const canvas = await html2canvas(page, { scale: 2, useCORS: true });
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageHeightPx = Math.floor((canvas.width * 297) / 210);
    let renderedPx = 0;
    let first = true;
    while (renderedPx < canvas.height) {
      const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sliceHeightPx;
      const ctx = slice.getContext('2d');
      ctx?.drawImage(canvas, 0, renderedPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
      const imgData = slice.toDataURL('image/jpeg', 0.92);
      if (!first) pdf.addPage();
      first = false;
      const sliceHeightMm = (sliceHeightPx / canvas.width) * 210;
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, sliceHeightMm);
      renderedPx += sliceHeightPx;
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
      const formData = new FormData();
      formData.append('pdf', blob, fileName);
      formData.append('companyId', company._id);
      formData.append('subject', 'EFCC-SCUML Notice of Penalties for Non-Compliance');
      formData.append(
        'text',
        'Please find attached a formal Notice of Penalties for Non-Compliance from the Special Control Unit against Money Laundering (SCUML), Benin Zonal Directorate.'
      );
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
          if (shareErr instanceof Error && shareErr.name === 'AbortError') return;
        }
      }
      const csrfRes = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
        { withCredentials: true }
      );
      const formData = new FormData();
      formData.append('pdf', blob, fileName);
      const uploadRes = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/letters/upload-letter-pdf`,
        formData,
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfRes.data.csrfToken } }
      );
      const digits = company.phone.replace(/[^\d]/g, '');
      const message = `${subject}\n\nDownload the document here: ${uploadRes.data.url}`;
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('WhatsApp share failed:', err);
      toast({ title: 'Failed to prepare the document for sharing.', status: 'error', duration: 4000, isClosable: true });
    } finally {
      setSharing(false);
    }
  };

  return (
    <Box bg="gray.100" py={8} mx={-4}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
          .violation-letter { box-shadow: none !important; }
        }
        @page { size: A4; margin: 15mm; }
      `}</style>

      <HStack maxW="900px" mx="auto" mb={4} className="no-print" spacing={2} flexWrap="wrap" justify="center">
        <Button size="sm" onClick={handleBack} isLoading={backing} loadingText="Preparing…" variant="outline">
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
        <Button size="sm" colorScheme="blue" onClick={onDone}>Done</Button>
      </HStack>

      <Box className="print-area" maxW="794px" mx="auto" px={{ base: 3, md: 0 }}>
        <Box
          className="violation-letter"
          bg="white"
          shadow="lg"
          p={{ base: 4, sm: 6, md: '20mm' }}
          fontFamily="Georgia, serif"
          color="gray.800"
          fontSize="sm"
          lineHeight="1.8"
        >
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
            <Text fontWeight="bold">The Managing Director,</Text>
            <Text>{company.companyName}</Text>
            {addressLines.map((line, i) => (
              <Text key={i}>{line}</Text>
            ))}
          </Box>

          <Text fontWeight="bold" textDecoration="underline" mb={8} textAlign="center">
            NOTICE OF PENALTIES FOR NON-COMPLIANCE WITH THE PROVISION MONEY LAUNDERING ACT,
            2022 &amp; EFCC (AML/CFT/CPF FOR DNFBPs) REGULATION 2022
          </Text>

          <Text mb={8} textAlign="justify">
            In line with the mandate of Special Control Unit against Money Laundering (SCUML)
            for the Monitoring, Supervision and Regulation of Designated Non – Financial
            Businesses and Professions (DNFBPs) against Money Laundering and Financing of
            Terrorism.
          </Text>

          <Text mb={8} textAlign="justify">
            <b>2.</b> The Inspection exercise conducted on your organisation on the {todayStr}{' '}
            revealed that your organisation is not complying with the Provisions of Money
            Laundering (Prevention and Prohibition) Act, 2022 and Economic and Financial Crimes
            Commission (AML/CFT/CPF for DNFBPs) Regulation 2022.
          </Text>

          <Text mb={4}>
            <b>3.</b> Below is the breakdown of breach identified and applicable sanction/penalties.
          </Text>

          <Box mb={8} overflowX="auto">
            <Table size="sm" variant="simple" borderWidth="1px">
              <Thead>
                <Tr>
                  <Th>S/N</Th>
                  <Th>Violations</Th>
                  <Th isNumeric>Administrative Sanctions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {selectedViolations.map((sv, i) => (
                  <Tr key={i}>
                    <Td verticalAlign="top">{i + 1}.</Td>
                    <Td whiteSpace="normal" minW="220px">{sv.offence}</Td>
                    <Td isNumeric whiteSpace="nowrap">
                      {sv.amount > 0 ? `₦${sv.amount.toLocaleString()}.00` : sv.label}
                    </Td>
                  </Tr>
                ))}
                <Tr fontWeight="bold">
                  <Td colSpan={2}>TOTAL</Td>
                  <Td isNumeric whiteSpace="nowrap">₦{totalFines.toLocaleString()}.00</Td>
                </Tr>
              </Tbody>
            </Table>
          </Box>

          <Text mb={8} textAlign="justify">
            <b>4.</b> In view of the above, you are required to take necessary steps to address
            all non-compliance issues raised during the inspection exercise and to pay to the
            Federal Government of Nigeria through Bank draft in the name of{' '}
            <b><u>EFCC Recovery Account</u></b> the total sum of{' '}
            <b>{nairaAmountInWords(totalFines)} (₦{totalFines.toLocaleString()}.00)</b> as
            administrative penalties for the violation stated above. Failure to comply with
            this notice within seven working days (7days) would attract further legal or
            administrative sanctions including closure of business premises, withdrawal of
            license or cancellation of business registration and possible prosecution.
          </Text>

          <Text mb={8} textAlign="justify">
            <b>5.</b> This request is made pursuant to the provision of section 17(2)(a-h) of
            Money Laundering (Prevention and Prohibition) Act, 2022 and 39(2 &amp; 8) of EFCC
            (AML/CFT/CPF for DNFBPs) Regulation 2022.
          </Text>

          <Box mt={8}>
            <Image
              src="/IBRAHIM_signature.png"
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
