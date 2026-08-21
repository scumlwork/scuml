'use client';

import {
  Box,
  Button,
  Input,
  Textarea,
  VStack,
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
import { useState } from 'react';
import { AddIcon, DeleteIcon } from '@chakra-ui/icons';
import axios from 'axios';
import type { CompanyFormProps } from './LetterForm';

type Shareholder = {
  name: string;
  pepStatus: string;
  nonResident: string;
  foreigner: string;
  sanctionList: string;
};

export default function OffSiteInspectionForm({ companyId, onSuccess }: CompanyFormProps) {
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

  return (
    <VStack align="stretch" spacing={6}>
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
    </VStack>
  );
}
