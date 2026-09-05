'use client';

import {
  Box,
  Button,
  Input,
  Textarea,
  VStack,
  HStack,
  Text,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  useToast,
} from '@chakra-ui/react';
import { useState, useRef } from 'react';
import { AddIcon, DeleteIcon } from '@chakra-ui/icons';
import axios from 'axios';
import type { CompanyFormProps } from './LetterForm';

const DOCUMENT_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx';

function fileExtension(name: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(name);
  return match ? match[1].toLowerCase() : '';
}

// Word/Excel/legacy .doc can't be rendered natively by a browser — the only
// way to show one looking exactly like it does in Word/Excel is Microsoft's
// own online viewer. That only works on a file that's already sitting at a
// public URL, so for these formats the file is uploaded immediately on
// "Continue" (not deferred until Save) — Replace/Discard below let the user
// correct or back out before clicking Done. PDFs don't need any of this:
// browsers already render them natively, so that path stays local-preview
// then upload-on-save.
function isOfficeFormat(name: string): boolean {
  return ['doc', 'docx', 'xls', 'xlsx'].includes(fileExtension(name));
}

type Shareholder = {
  name: string;
  pepStatus: string;
  nonResident: string;
  foreigner: string;
  sanctionList: string;
};

export default function OffSiteInspectionForm({ companyId, onSuccess }: CompanyFormProps) {
  const [mode, setMode] = useState<'form' | 'document'>('form');
  const [document, setDocument] = useState<File | null>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  // PDF path — local blob preview, nothing uploaded until Save.
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  // Word/Excel/.doc path — uploaded immediately (on "Continue") so Microsoft's
  // viewer has a real URL to render; the record already exists at this point,
  // so Replace/Discard act on it directly rather than on local-only state.
  const [savedInspectionId, setSavedInspectionId] = useState<string | null>(null);
  const [savedDocumentUrl, setSavedDocumentUrl] = useState<string | null>(null);

  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [replacingDocument, setReplacingDocument] = useState(false);
  const [discardingDocument, setDiscardingDocument] = useState(false);

  const [shareholders, setShareholders] = useState<Shareholder[]>([
    { name: '', pepStatus: '', nonResident: '', foreigner: '', sanctionList: '' },
  ]);

  const [examinationDate, setExaminationDate] = useState(new Date().toISOString().split('T')[0]);
  const [introduction, setIntroduction] = useState('');
  const [contact, setContact] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [telephone, setTelephone] = useState('');
  const [sources, setSources] = useState('');
  const [complianceStatus, setComplianceStatus] = useState('');
  const [rc, setRc] = useState('');
  const [scuml, setScuml] = useState('');
  const [tin, setTin] = useState('');
  const [transactionReporting, setTransactionReporting] = useState('');
  const [politicallyExposed, setPoliticallyExposed] = useState('');
  const [affiliates, setAffiliates] = useState('');
  const [legalIssues, setLegalIssues] = useState('');
  const [locations, setLocations] = useState('');
  const [products, setProducts] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const addShareholder = () => {
    setShareholders([
      ...shareholders,
      { name: '', pepStatus: '', nonResident: '', foreigner: '', sanctionList: '' },
    ]);
  };

  const removeShareholder = (index: number) => {
    const updated = [...shareholders];
    updated.splice(index, 1);
    setShareholders(updated);
  };

  const updateShareholder = (index: number, field: keyof Shareholder, value: string) => {
    const updated = [...shareholders];
    updated[index][field] = value;
    setShareholders(updated);
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const csrfRes = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
        { withCredentials: true }
      );
      const csrfToken = csrfRes.data.csrfToken;

      await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/offsite-inspections`,
        {
          company: companyId,
          examinationDate,
          introduction,
          contact,
          officeAddress,
          telephone,
          sources,
          complianceStatus,
          rc,
          scuml,
          tin,
          transactionReporting,
          shareholders,
          politicallyExposed,
          affiliates,
          legalIssues,
          locations,
          products,
          recommendation,
        },
        { withCredentials: true, headers: { 'CSRF-Token': csrfToken } }
      );

      toast({ title: 'Report saved successfully!', status: 'success', duration: 4000, isClosable: true });
      onSuccess();
    } catch (err) {
      console.error('Failed to save report:', err);
      toast({ title: 'Error saving report.', status: 'error', duration: 4000, isClosable: true });
    } finally {
      setSubmitting(false);
    }
  };

  // Discards whatever local, not-yet-uploaded pick is in progress (used for
  // the PDF path, and as the very first step before anything is uploaded).
  const resetLocalPick = () => {
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfPreviewUrl(null);
    setDocument(null);
    if (documentInputRef.current) documentInputRef.current.value = '';
  };

  // "Continue" — for PDFs this just previews locally (upload waits for
  // Save, unchanged from before); for Word/Excel/.doc it uploads right away
  // so Microsoft's viewer can render the real thing.
  const handleContinue = async () => {
    if (!document) {
      toast({ title: 'Choose a document first.', status: 'warning', duration: 3000, isClosable: true });
      return;
    }
    if (!isOfficeFormat(document.name)) {
      setPdfPreviewUrl(URL.createObjectURL(document));
      return;
    }
    setUploadingDocument(true);
    try {
      const csrfRes = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
        { withCredentials: true }
      );
      const formData = new FormData();
      formData.append('company', companyId);
      formData.append('document', document);
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/offsite-inspections/upload`,
        formData,
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfRes.data.csrfToken } }
      );
      setSavedInspectionId(res.data._id);
      setSavedDocumentUrl(res.data.documentUrl);
    } catch (err) {
      console.error('Failed to upload document:', err);
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : 'Error uploading document.';
      toast({ title: message, status: 'error', duration: 5000, isClosable: true });
    } finally {
      setUploadingDocument(false);
    }
  };

  // Final commit for the PDF path only — Word/Excel/.doc are already saved
  // by the time their preview shows (see handleContinue/handleDone below).
  const handleSavePdf = async () => {
    if (!document) return;
    setUploadingDocument(true);
    try {
      const csrfRes = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
        { withCredentials: true }
      );
      const formData = new FormData();
      formData.append('company', companyId);
      formData.append('document', document);
      await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/offsite-inspections/upload`,
        formData,
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfRes.data.csrfToken } }
      );
      toast({ title: 'Document saved successfully!', status: 'success', duration: 4000, isClosable: true });
      onSuccess();
    } catch (err) {
      console.error('Failed to upload document:', err);
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : 'Error uploading document.';
      toast({ title: message, status: 'error', duration: 5000, isClosable: true });
    } finally {
      setUploadingDocument(false);
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    }
  };

  // Replaces the file on the already-saved Word/Excel/.doc record in place —
  // same record, new Cloudinary asset, old one destroyed server-side.
  const handleReplaceSavedDocument = async (file: File) => {
    if (!savedInspectionId) return;
    setReplacingDocument(true);
    try {
      const csrfRes = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
        { withCredentials: true }
      );
      const formData = new FormData();
      formData.append('document', file);
      const res = await axios.put(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/offsite-inspections/${savedInspectionId}/document`,
        formData,
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfRes.data.csrfToken } }
      );
      setSavedDocumentUrl(res.data.documentUrl);
      toast({ title: 'Document replaced.', status: 'success', duration: 3000, isClosable: true });
    } catch (err) {
      console.error('Failed to replace document:', err);
      toast({ title: 'Failed to replace document.', status: 'error', duration: 4000, isClosable: true });
    } finally {
      setReplacingDocument(false);
    }
  };

  // Backs out of an already-uploaded Word/Excel/.doc record entirely —
  // deletes it (and its Cloudinary asset) so nothing orphaned is left behind.
  const handleDiscardSavedDocument = async () => {
    if (!savedInspectionId) return;
    setDiscardingDocument(true);
    try {
      const csrfRes = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
        { withCredentials: true }
      );
      await axios.delete(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/offsite-inspections/${savedInspectionId}`,
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfRes.data.csrfToken } }
      );
    } catch (err) {
      console.error('Failed to discard document:', err);
    } finally {
      setDiscardingDocument(false);
      setSavedInspectionId(null);
      setSavedDocumentUrl(null);
      resetLocalPick();
    }
  };

  const handleDoneWithSavedDocument = () => {
    toast({ title: 'Document saved successfully!', status: 'success', duration: 4000, isClosable: true });
    onSuccess();
  };

  // Leaving "Upload Document" mode (or switching file) while a Word/Excel/
  // .doc record is already saved discards it rather than stranding it.
  const handleLeaveDocumentMode = () => {
    if (savedInspectionId) {
      handleDiscardSavedDocument();
    } else {
      resetLocalPick();
    }
  };

  return (
    <VStack align="stretch" spacing={6}>
      <HStack>
        <Button
          size="sm"
          colorScheme={mode === 'form' ? 'purple' : 'gray'}
          variant={mode === 'form' ? 'solid' : 'outline'}
          onClick={() => { handleLeaveDocumentMode(); setMode('form'); }}
        >
          Fill Form
        </Button>
        <Button size="sm" colorScheme={mode === 'document' ? 'purple' : 'gray'} variant={mode === 'document' ? 'solid' : 'outline'} onClick={() => setMode('document')}>
          Upload Document
        </Button>
      </HStack>

      {mode === 'document' && !pdfPreviewUrl && !savedInspectionId && (
        <Box>
          <Text mb={1} fontWeight="bold">Upload Document</Text>
          <Text fontSize="sm" color="gray.600" mb={2}>
            Attach a Word, Excel, or PDF report instead of filling the form below.
          </Text>
          <Input
            ref={documentInputRef}
            type="file"
            accept={DOCUMENT_ACCEPT}
            p={1}
            mb={3}
            onChange={(e) => setDocument(e.target.files?.[0] || null)}
          />
          <Button colorScheme="purple" size="md" onClick={handleContinue} isLoading={uploadingDocument}>
            Continue
          </Button>
        </Box>
      )}

      {mode === 'document' && pdfPreviewUrl && (
        <Box>
          <Text mb={1} fontWeight="bold">Review Document</Text>
          <Text fontSize="sm" color="gray.600" mb={3}>
            Make sure this is the right file before saving — you can still go back and pick a different one.
          </Text>
          <Box as="iframe" src={pdfPreviewUrl} w="full" h="500px" border="1px solid" borderColor="gray.200" borderRadius="md" mb={3} title="Document preview" />
          <HStack>
            <Button variant="outline" size="md" onClick={resetLocalPick} isDisabled={uploadingDocument}>
              Change File
            </Button>
            <Button colorScheme="red" size="md" onClick={handleSavePdf} isLoading={uploadingDocument}>
              Save Document
            </Button>
          </HStack>
        </Box>
      )}

      {mode === 'document' && savedInspectionId && savedDocumentUrl && (
        <Box>
          <Text mb={1} fontWeight="bold">Preview</Text>
          <Text fontSize="sm" color="gray.600" mb={1}>
            Rendered by Microsoft&apos;s online viewer, so it looks exactly like it would in Word/Excel. Wrong file? Replace it below — nothing is final until you click Done.
          </Text>
          <Text fontSize="xs" color="gray.500" mb={3}>
            Note: the document is sent to Microsoft&apos;s servers to generate this preview.
          </Text>
          <Box
            as="iframe"
            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(savedDocumentUrl)}`}
            w="full"
            h="600px"
            border="1px solid"
            borderColor="gray.200"
            borderRadius="md"
            mb={3}
            title="Document preview"
          />
          <HStack>
            <Button as="label" variant="outline" size="md" isLoading={replacingDocument} cursor="pointer">
              Replace File
              <Input
                type="file"
                accept={DOCUMENT_ACCEPT}
                display="none"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleReplaceSavedDocument(file);
                }}
              />
            </Button>
            <Button variant="outline" colorScheme="red" size="md" onClick={handleDiscardSavedDocument} isLoading={discardingDocument}>
              Discard
            </Button>
            <Button colorScheme="green" size="md" onClick={handleDoneWithSavedDocument}>
              Done
            </Button>
          </HStack>
        </Box>
      )}

      {mode === 'form' && (
      <>
      <Box>
        <Text mb={1} fontWeight="bold">Examination Date</Text>
        <Input type="date" value={examinationDate} onChange={(e) => setExaminationDate(e.target.value)} />
      </Box>

      <Box>
        <Text mb={1} fontWeight="bold">Introduction</Text>
        <Textarea value={introduction} onChange={(e) => setIntroduction(e.target.value)} placeholder="Write introduction..." minH="150px" />
      </Box>

      <Box>
        <Text mb={1} fontWeight="bold">Contact</Text>
        <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact Person" />
      </Box>

      <Box>
        <Text mb={1} fontWeight="bold">Office Address</Text>
        <Input value={officeAddress} onChange={(e) => setOfficeAddress(e.target.value)} placeholder="Office Address" mb={2} />
        <Input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Telephone" />
      </Box>

      <Box>
        <Text mb={1} fontWeight="bold">Sources (URLs)</Text>
        <Textarea value={sources} onChange={(e) => setSources(e.target.value)} placeholder="Enter URLs separated by commas or lines" minH="100px" />
      </Box>

      <Box>
        <Text mb={1} fontWeight="bold">Compliance Status with the Laws and Regulations</Text>
        <Textarea value={complianceStatus} onChange={(e) => setComplianceStatus(e.target.value)} placeholder="Write compliance status..." minH="150px" mb={4} />
        <Box overflowX="auto">
          <Table variant="simple" size="sm" minW="500px">
            <Thead>
              <Tr>
                <Th>RC</Th>
                <Th>SCUML No.</Th>
                <Th>TIN No.</Th>
              </Tr>
            </Thead>
            <Tbody>
              <Tr>
                <Td><Input value={rc} onChange={(e) => setRc(e.target.value)} placeholder="Enter RC No." /></Td>
                <Td><Input value={scuml} onChange={(e) => setScuml(e.target.value)} placeholder="Enter SCUML No." /></Td>
                <Td><Input value={tin} onChange={(e) => setTin(e.target.value)} placeholder="Enter TIN No." /></Td>
              </Tr>
            </Tbody>
          </Table>
        </Box>
      </Box>

      <Box>
        <Text mb={1} fontWeight="bold">Transaction Reporting Obligation</Text>
        <Textarea value={transactionReporting} onChange={(e) => setTransactionReporting(e.target.value)} placeholder="Write details..." minH="150px" />
      </Box>

      <Box>
        <Text mb={2} fontWeight="bold">Shareholders / Directors Of The Company</Text>
        <Textarea placeholder="General notes..." minH="100px" mb={4} />
        <Box overflowX="auto">
          <Table variant="simple" size="sm" minW="900px">
            <Thead>
              <Tr>
                <Th>S/N</Th>
                <Th>Name</Th>
                <Th>PEP Status</Th>
                <Th>Non Resident Nigerian</Th>
                <Th>Foreigner</Th>
                <Th>SANC. List</Th>
                <Th>Action</Th>
              </Tr>
            </Thead>
            <Tbody>
              {shareholders.map((s, idx) => (
                <Tr key={idx}>
                  <Td>{idx + 1}</Td>
                  <Td><Input value={s.name} onChange={(e) => updateShareholder(idx, 'name', e.target.value)} /></Td>
                  <Td><Input value={s.pepStatus} onChange={(e) => updateShareholder(idx, 'pepStatus', e.target.value)} /></Td>
                  <Td><Input value={s.nonResident} onChange={(e) => updateShareholder(idx, 'nonResident', e.target.value)} /></Td>
                  <Td><Input value={s.foreigner} onChange={(e) => updateShareholder(idx, 'foreigner', e.target.value)} /></Td>
                  <Td><Input value={s.sanctionList} onChange={(e) => updateShareholder(idx, 'sanctionList', e.target.value)} /></Td>
                  <Td>
                    <IconButton aria-label="Remove" icon={<DeleteIcon />} size="sm" colorScheme="red" onClick={() => removeShareholder(idx)} isDisabled={shareholders.length === 1} />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
        <Button leftIcon={<AddIcon />} size="sm" mt={2} onClick={addShareholder}>Add Shareholder</Button>
      </Box>

      <Box>
        <Text mb={1} fontWeight="bold">Politically Exposed Persons</Text>
        <Textarea value={politicallyExposed} onChange={(e) => setPoliticallyExposed(e.target.value)} placeholder="Write politically exposed persons..." minH="150px" />
      </Box>
      <Box>
        <Text mb={1} fontWeight="bold">Affiliates And Subsidiaries</Text>
        <Textarea value={affiliates} onChange={(e) => setAffiliates(e.target.value)} placeholder="Write affiliates and subsidiaries..." minH="150px" />
      </Box>
      <Box>
        <Text mb={1} fontWeight="bold">Legal Issues</Text>
        <Textarea value={legalIssues} onChange={(e) => setLegalIssues(e.target.value)} placeholder="Write legal issues..." minH="150px" />
      </Box>
      <Box>
        <Text mb={1} fontWeight="bold">Locations</Text>
        <Textarea value={locations} onChange={(e) => setLocations(e.target.value)} placeholder="Write locations..." minH="150px" />
      </Box>
      <Box>
        <Text mb={1} fontWeight="bold">Products</Text>
        <Textarea value={products} onChange={(e) => setProducts(e.target.value)} placeholder="Write products..." minH="150px" />
      </Box>
      <Box>
        <Text mb={1} fontWeight="bold">Recommendation / Conclusion</Text>
        <Textarea value={recommendation} onChange={(e) => setRecommendation(e.target.value)} placeholder="Write recommendation / conclusion..." minH="150px" />
      </Box>

      <Button colorScheme="red" size="md" alignSelf="flex-start" onClick={handleSave} isLoading={submitting}>
        Save Report
      </Button>
      </>
      )}
    </VStack>
  );
}
