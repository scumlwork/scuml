'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  Input,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Textarea,
  useToast,
} from '@chakra-ui/react';
import axios from 'axios';
import type { CompanyFormProps } from './LetterForm';
import {
  AML_CFT_REQUIREMENTS,
  TPPA_REQUIREMENTS,
  blankObservations,
  blankDocumentsRequested,
  type ObservationRow,
  type DocumentRequestRow,
} from '@/lib/onSiteInspectionRequirements';

// Matches the Exam Report template: Risk Assessment (management team
// interviewed + documents requested/provided), Specific Findings, Material
// Exception, PEP/STR/TFS, the AML/CFT Requirements Observations table (plus
// its Terrorism Prevention and Prohibition Act, 2022 section), and
// Conclusion/Recommendations.
export default function OnSiteInspectionForm({ companyId, onSuccess }: CompanyFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  // --- Cover page ---
  const [coveragePeriod, setCoveragePeriod] = useState('');
  const [dateOfExamination, setDateOfExamination] = useState(new Date().toISOString().split('T')[0]);
  const [areasCovered, setAreasCovered] = useState('');
  const [structure, setStructure] = useState('');

  // --- Risk Assessment ---
  const [managementTeamInterviewed, setManagementTeamInterviewed] = useState('');
  const [documentsRequested, setDocumentsRequested] = useState<DocumentRequestRow[]>(
    blankDocumentsRequested()
  );
  const handleDocumentChange = (index: number, value: string) => {
    const updated = [...documentsRequested];
    updated[index] = { ...updated[index], provided: value };
    setDocumentsRequested(updated);
  };

  // --- Specific Findings / Material Exception ---
  const [specificFindings, setSpecificFindings] = useState('');
  const [materialException, setMaterialException] = useState('');

  // --- PEP / STR / TFS ---
  const [politicallyExposedPersons, setPoliticallyExposedPersons] = useState('');
  const [suspiciousTransactionReporting, setSuspiciousTransactionReporting] = useState('');
  const [targetedFinancialSanctions, setTargetedFinancialSanctions] = useState('');

  // --- Observations (AML/CFT Requirements, then Terrorism Prevention and
  // Prohibition Act, 2022) ---
  const [amlObservations, setAmlObservations] = useState<ObservationRow[]>(
    blankObservations(AML_CFT_REQUIREMENTS)
  );
  const [tppaObservations, setTppaObservations] = useState<ObservationRow[]>(
    blankObservations(TPPA_REQUIREMENTS)
  );
  const handleObservationChange = (
    rows: ObservationRow[],
    setRows: (rows: ObservationRow[]) => void,
    index: number,
    field: 'observation' | 'recommendation',
    value: string
  ) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: value };
    setRows(updated);
  };

  // --- Conclusion / Recommendations ---
  const [conclusionRecommendations, setConclusionRecommendations] = useState('');

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const csrfRes = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
        { withCredentials: true }
      );
      const csrfToken = csrfRes.data?.csrfToken;

      const payload = {
        company: companyId,
        coveragePeriod,
        dateOfExamination,
        areasCovered,
        structure,
        managementTeamInterviewed,
        documentsRequested,
        specificFindings,
        materialException,
        politicallyExposedPersons,
        suspiciousTransactionReporting,
        targetedFinancialSanctions,
        observations: [...amlObservations, ...tppaObservations],
        conclusionRecommendations,
      };

      await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/on-site-inspections`,
        payload,
        { withCredentials: true, headers: { 'CSRF-Token': csrfToken } }
      );

      toast({ title: 'On-Site Inspection saved successfully!', status: 'success', duration: 2500, isClosable: true });
      onSuccess();
    } catch (err) {
      console.error('Error saving inspection:', err);
      toast({ title: 'Error saving inspection.', status: 'error', duration: 4000, isClosable: true });
    } finally {
      setSubmitting(false);
    }
  };

  const sectionHeading = (text: string, size = '18px') => (
    <h2 style={{ fontSize: size, fontWeight: 'bold', marginBottom: '10px' }}>{text}</h2>
  );

  return (
    <Box fontSize="xs">
      {/* --- Cover page --- */}
      <Box mb={10}>
        <Box mb={3}>
          <Box fontWeight="semibold" mb={1}>Coverage/Period</Box>
          <Input value={coveragePeriod} onChange={(e) => setCoveragePeriod(e.target.value)} />
        </Box>
        <Box mb={3}>
          <Box fontWeight="semibold" mb={1}>Date of Examination</Box>
          <Input type="date" value={dateOfExamination} onChange={(e) => setDateOfExamination(e.target.value)} />
        </Box>
        <Box mb={3}>
          <Box fontWeight="semibold" mb={1}>Areas Covered</Box>
          <Input value={areasCovered} onChange={(e) => setAreasCovered(e.target.value)} />
        </Box>
        <Box>
          <Box fontWeight="semibold" mb={1}>Structure</Box>
          <Textarea
            value={structure}
            onChange={(e) => setStructure(e.target.value)}
            minH="120px"
            fontSize={{ base: '2xs', md: 'xs' }}
          />
        </Box>
      </Box>

      {/* --- Risk Assessment --- */}
      <Box mb={10}>
        {sectionHeading('Risk Assessment')}
        <Box mb={4}>
          <Box fontWeight="semibold" mb={1}>Management Team Interviewed</Box>
          <Textarea
            placeholder="Names and roles of management team interviewed..."
            value={managementTeamInterviewed}
            onChange={(e) => setManagementTeamInterviewed(e.target.value)}
            minH="100px"
            fontSize={{ base: '2xs', md: 'xs' }}
          />
        </Box>
        <Box overflowX="auto">
          <Table variant="striped" size="sm" minW="700px">
            <Thead>
              <Tr>
                <Th w="50px">S/N</Th>
                <Th w="300px">Documents Requested</Th>
                <Th>Documents Provided/Reviewed</Th>
              </Tr>
            </Thead>
            <Tbody>
              {documentsRequested.map((d, i) => (
                <Tr key={i}>
                  <Td>{i + 1}</Td>
                  <Td fontSize={{ base: '2xs', md: 'xs' }}>{d.document}</Td>
                  <Td>
                    <Textarea
                      value={d.provided}
                      onChange={(e) => handleDocumentChange(i, e.target.value)}
                      minH="80px"
                      w="100%"
                      fontSize={{ base: '2xs', md: 'xs' }}
                    />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </Box>

      {/* --- Specific Findings --- */}
      <Box mb={10}>
        {sectionHeading('Specific Findings')}
        <Textarea
          value={specificFindings}
          onChange={(e) => setSpecificFindings(e.target.value)}
          minH="150px"
          fontSize={{ base: '2xs', md: 'xs' }}
        />
      </Box>

      {/* --- Material Exception --- */}
      <Box mb={10}>
        {sectionHeading('Material Exception')}
        <Textarea
          value={materialException}
          onChange={(e) => setMaterialException(e.target.value)}
          minH="150px"
          fontSize={{ base: '2xs', md: 'xs' }}
        />
      </Box>

      {/* --- Politically Exposed Persons (PEP) --- */}
      <Box mb={10}>
        {sectionHeading('Politically Exposed Persons (PEP)')}
        <Textarea
          value={politicallyExposedPersons}
          onChange={(e) => setPoliticallyExposedPersons(e.target.value)}
          minH="120px"
          fontSize={{ base: '2xs', md: 'xs' }}
        />
      </Box>

      {/* --- Suspicious Transaction Reporting (STR) --- */}
      <Box mb={10}>
        {sectionHeading('Suspicious Transaction Reporting (STR)')}
        <Textarea
          value={suspiciousTransactionReporting}
          onChange={(e) => setSuspiciousTransactionReporting(e.target.value)}
          minH="120px"
          fontSize={{ base: '2xs', md: 'xs' }}
        />
      </Box>

      {/* --- Targeted Financial Sanctions (TFS) --- */}
      <Box mb={10}>
        {sectionHeading('Targeted Financial Sanctions (TFS)')}
        <Textarea
          value={targetedFinancialSanctions}
          onChange={(e) => setTargetedFinancialSanctions(e.target.value)}
          minH="120px"
          fontSize={{ base: '2xs', md: 'xs' }}
        />
      </Box>

      {/* --- Observations: AML/CFT Requirements --- */}
      <Box mb={10}>
        {sectionHeading('Observations')}
        <Box fontWeight="semibold" mb={2}>AML/CFT Requirements</Box>
        <Box overflowX="auto">
          <Table variant="striped" size="sm" minW="900px">
            <Thead>
              <Tr>
                <Th w="50px">S/N</Th>
                <Th w="280px">AML/CFT Requirements</Th>
                <Th w="300px">Observation</Th>
                <Th>Recommendations/Remedial Action</Th>
              </Tr>
            </Thead>
            <Tbody>
              {amlObservations.map((o, i) => (
                <Tr key={i}>
                  <Td>{i + 1}</Td>
                  <Td fontSize={{ base: '2xs', md: 'xs' }}>{o.requirement}</Td>
                  <Td>
                    <Textarea
                      value={o.observation}
                      onChange={(e) =>
                        handleObservationChange(amlObservations, setAmlObservations, i, 'observation', e.target.value)
                      }
                      minH="120px"
                      w="100%"
                      fontSize={{ base: '2xs', md: 'xs' }}
                    />
                  </Td>
                  <Td>
                    <Textarea
                      value={o.recommendation}
                      onChange={(e) =>
                        handleObservationChange(amlObservations, setAmlObservations, i, 'recommendation', e.target.value)
                      }
                      minH="120px"
                      w="100%"
                      fontSize={{ base: '2xs', md: 'xs' }}
                    />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </Box>

      {/* --- Observations: Terrorism Prevention and Prohibition Act, 2022 --- */}
      <Box mb={10}>
        <Box fontWeight="semibold" mb={2}>Terrorism Prevention and Prohibition Act, 2022</Box>
        <Box overflowX="auto">
          <Table variant="striped" size="sm" minW="900px">
            <Thead>
              <Tr>
                <Th w="50px">S/N</Th>
                <Th w="280px">Requirement</Th>
                <Th w="300px">Observation</Th>
                <Th>Recommendations/Remedial Action</Th>
              </Tr>
            </Thead>
            <Tbody>
              {tppaObservations.map((o, i) => (
                <Tr key={i}>
                  <Td>{i + 1}</Td>
                  <Td fontSize={{ base: '2xs', md: 'xs' }}>{o.requirement}</Td>
                  <Td>
                    <Textarea
                      value={o.observation}
                      onChange={(e) =>
                        handleObservationChange(tppaObservations, setTppaObservations, i, 'observation', e.target.value)
                      }
                      minH="120px"
                      w="100%"
                      fontSize={{ base: '2xs', md: 'xs' }}
                    />
                  </Td>
                  <Td>
                    <Textarea
                      value={o.recommendation}
                      onChange={(e) =>
                        handleObservationChange(tppaObservations, setTppaObservations, i, 'recommendation', e.target.value)
                      }
                      minH="120px"
                      w="100%"
                      fontSize={{ base: '2xs', md: 'xs' }}
                    />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </Box>

      {/* --- Conclusion/Recommendations --- */}
      <Box mb={10}>
        {sectionHeading('Conclusion/Recommendations')}
        <Textarea
          value={conclusionRecommendations}
          onChange={(e) => setConclusionRecommendations(e.target.value)}
          minH="150px"
          fontSize={{ base: '2xs', md: 'xs' }}
        />
      </Box>

      {/* --- Submit --- */}
      <Box textAlign="center" mt={6}>
        <Button colorScheme="green" size="lg" onClick={handleSubmit} isLoading={submitting}>
          Submit
        </Button>
      </Box>
    </Box>
  );
}
