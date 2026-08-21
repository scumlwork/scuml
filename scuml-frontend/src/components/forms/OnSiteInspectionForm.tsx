'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Textarea,
  Input,
  useToast,
} from '@chakra-ui/react';
import axios from 'axios';
import type { CompanyFormProps } from './LetterForm';

export default function OnSiteInspectionForm({ companyId, onSuccess }: CompanyFormProps) {
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<'low' | 'medium' | 'high'>('low');
  const [riskVulnerabilities, setRiskVulnerabilities] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  // --- Obligations (stateful with prefilled remark) ---
  const [obligations, setObligations] = useState(
    [
      {
        obligation: 'Registration with SCUML',
        complianceStatus: '',
        remark: 'SC. No., Date of issuance, Collection office, Place and Name of Collector:',
      },
      {
        obligation: 'Appointment of Compliance Officer',
        complianceStatus: '',
        remark: 'Name, Rank, Date Appointed, Date of Employment:',
      },
      {
        obligation: 'Anti-Money Laundering Counter Terrorism Financing Policy Document',
        complianceStatus: '',
        remark: 'Date of First Issued, Content:',
      },
      {
        obligation: 'Know Your Customer / Customer Identification & Customer Due Diligence',
        complianceStatus: '',
        remark: 'Sufficiency of the Information, Copies of ID Card, Evidence of Verification:',
      },
      {
        obligation: 'Transactions Reporting',
        complianceStatus: '',
        remark: 'Reporting Procedure, Copies of Acknowledgment, Date of Last Report:',
      },
      {
        obligation: 'Cash Payment, Anti-Money Laundering Notice',
        complianceStatus: '',
        remark: 'Cash Acceptance Policy, Acceptance Threshold Notice Display, AML Notice:',
      },
      {
        obligation:
          'Cooperation With Professional Bodies, Associations, Regulators and Law Enforcement Agency',
        complianceStatus: '',
        remark:
          'Membership of Association/Professional Body, Last date meeting attended, response/report to other law enforcement:',
      },
      {
        obligation: 'Design and Implement Compressive Training Program',
        complianceStatus: '',
        remark: 'Last Date of Training, evidence notification to SCUML, training plans:',
      },
      {
        obligation: 'Sanction Screening',
        complianceStatus: '',
        remark: 'Date of Subscription, date of last update:',
      },
      {
        obligation:
          'Anti-Money Laundering/Counter Terrorism Financing Risk Assessment Framework',
        complianceStatus: '',
        remark: 'Customer risk classification, appointment of internal auditor:',
      },
      {
        obligation: 'Other Statutory Report to SCUML',
        complianceStatus: '',
        remark: 'PEP Reporting, Public Sector Reporting, Employee Training Reporting:',
      },
    ] as { obligation: string; complianceStatus: string; remark: string }[]
  );

  const handleObligationChange = (
    index: number,
    field: 'complianceStatus' | 'remark',
    value: string
  ) => {
    const updated = [...obligations];
    updated[index][field] = value;
    setObligations(updated);
  };

  // --- Organization Profile (stateful with prefilled remark) ---
  const [orgProfile, setOrgProfile] = useState(
    [
      {
        desc: 'Commencement of Business & Source of Funding',
        remark: 'Date of Registration, Date of Commencement, Source of Funding:',
      },
      { desc: 'Nature of Business', remark: 'Description of Activities:' },
      { desc: 'Branch Offices', remark: 'Branch Locations and No of Staff:' },
      {
        desc: 'Directors/Proprietors/Trustee',
        remark: 'Name, Address, Occupation, NIN, BVN, Other Business:',
      },
      {
        desc: 'Managing Director/General Manager (If Different from above)',
        remark: 'Name, Address, Occupation, NIN, BVN, Other Business:',
      },
      {
        desc: 'Total No. of Employee',
        remark:
          'Board Members:\nManagement Staff:\nProfessionals (eg, Lawyers, Accountants, Taxation, etc):\nJunior workers including Security and Cleaners:\nOthers:',
      },
      { desc: 'Turn Over', remark: 'Monthly:\nAnnually:' },
      {
        desc: 'Tax Remittance',
        remark:
          'TIN No, VAT, PAYE, INCOME TAX, Consumption Tax, Withholding Tax, Directors Income, Employee Payroll, Last Payment Date, Amount Paid, Payment Location/Tax Office.\nTax clearance certificate:',
      },
      {
        desc: 'Bank Details',
        remark: 'Bank, Account No (including domiciliary), Signatories:',
      },
      {
        desc: 'Total Number of Reportable Transactions',
        remark:
          'Transaction Type, Name of beneficiary/customer, service, amount, mode of payment and date of transaction:',
      },
    ] as { desc: string; remark: string }[]
  );

  const handleOrgProfileChange = (index: number, value: string) => {
    const updated = [...orgProfile];
    updated[index].remark = value;
    setOrgProfile(updated);
  };

  // --- Attendance ---
  const [attendance, setAttendance] = useState([
    { name: '', organization: '', position: '', phone: '', sign: '' },
  ]);
  const addRow = () => {
    setAttendance([...attendance, { name: '', organization: '', position: '', phone: '', sign: '' }]);
  };

  const handleAttendanceChange = (
    index: number,
    field: keyof (typeof attendance)[0],
    value: string
  ) => {
    const newAttendance = [...attendance];
    newAttendance[index][field] = value;
    setAttendance(newAttendance);
  };

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
        obligations,
        orgProfile,
        riskClassification: { level: selectedRiskLevel, vulnerabilities: riskVulnerabilities },
        attendance,
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

  return (
    <Box fontSize="xs">
      {/* --- Compliance with the Law --- */}
      <Box mb={10}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
          Compliance with the Law and Regulation
        </h2>
        <Box overflowX="auto">
          <Table variant="striped" size="sm" minW="900px">
            <Thead>
              <Tr>
                <Th w="50px">S/N</Th>
                <Th w="200px">Obligation</Th>
                <Th w="400px">Compliance Status</Th>
                <Th w="500px">Remark/Observation</Th>
              </Tr>
            </Thead>
            <Tbody>
              {obligations.map((o, i) => (
                <Tr key={i}>
                  <Td>{i + 1}</Td>
                  <Td fontSize={{ base: '2xs', md: 'xs' }}>{o.obligation}</Td>
                  <Td>
                    <Textarea
                      placeholder="Enter compliance status..."
                      value={o.complianceStatus}
                      onChange={(e) => handleObligationChange(i, 'complianceStatus', e.target.value)}
                      minH="150px"
                      w="100%"
                      fontSize={{ base: '2xs', md: 'xs' }}
                    />
                  </Td>
                  <Td>
                    <Textarea
                      value={o.remark}
                      onChange={(e) => handleObligationChange(i, 'remark', e.target.value)}
                      minH="150px"
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

      {/* --- Organization Profile --- */}
      <Box mb={10}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
          Organization Profile
        </h2>
        <Box overflowX="auto">
          <Table variant="striped" size="sm" minW="900px">
            <Thead>
              <Tr>
                <Th w="50px">S/N</Th>
                <Th w="200px">Description</Th>
                <Th w="700px">Remark</Th>
              </Tr>
            </Thead>
            <Tbody>
              {orgProfile.map((o, i) => (
                <Tr key={i}>
                  <Td>{i + 1}</Td>
                  <Td fontSize={{ base: '2xs', md: 'xs' }}>{o.desc}</Td>
                  <Td>
                    <Textarea
                      value={o.remark}
                      onChange={(e) => handleOrgProfileChange(i, e.target.value)}
                      minH="150px"
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

      {/* --- Money Laundering Risk Classification --- */}
      <Box mb={10}>
        <h2 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>
          Money Laundering Risk Classification
        </h2>
        <Box overflowX="auto">
          <Table variant="striped" size="sm" minW="700px">
            <Thead>
              <Tr>
                <Th w="300px">Money Laundering Risk Classification</Th>
                <Th w="200px">Level</Th>
                <Th>Description of Money Laundering Vulnerabilities</Th>
              </Tr>
            </Thead>
            <Tbody>
              <Tr>
                <Td>Select classification</Td>
                <Td>
                  <select
                    style={{ width: '100%' }}
                    value={selectedRiskLevel}
                    onChange={(e) => setSelectedRiskLevel(e.target.value as 'low' | 'medium' | 'high')}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </Td>
                <Td>
                  <Textarea
                    placeholder="Enter vulnerabilities..."
                    minH="150px"
                    w="100%"
                    fontSize={{ base: '2xs', md: 'xs' }}
                    value={riskVulnerabilities}
                    onChange={(e) => setRiskVulnerabilities(e.target.value)}
                  />
                </Td>
              </Tr>
            </Tbody>
          </Table>
        </Box>
      </Box>

      {/* --- Attendance --- */}
      <Box mb={10}>
        <h2 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>
          Attendance
        </h2>
        <Box overflowX="auto">
          <Table variant="striped" size="sm" minW="700px">
            <Thead>
              <Tr>
                <Th w="5%">S/N</Th>
                <Th w="20%">Name</Th>
                <Th w="20%">Organization</Th>
                <Th w="15%">Position</Th>
                <Th w="15%">Phone No.</Th>
                <Th w="10%">Sign.</Th>
              </Tr>
            </Thead>
            <Tbody>
              {attendance.map((a, i) => (
                <Tr key={i}>
                  <Td>{i + 1}</Td>
                  <Td>
                    <Input value={a.name} onChange={(e) => handleAttendanceChange(i, 'name', e.target.value)} fontSize={{ base: '2xs', md: 'xs' }} w="100%" />
                  </Td>
                  <Td>
                    <Input value={a.organization} onChange={(e) => handleAttendanceChange(i, 'organization', e.target.value)} fontSize={{ base: '2xs', md: 'xs' }} w="100%" />
                  </Td>
                  <Td>
                    <Input value={a.position} onChange={(e) => handleAttendanceChange(i, 'position', e.target.value)} fontSize={{ base: '2xs', md: 'xs' }} w="100%" />
                  </Td>
                  <Td>
                    <Input value={a.phone} onChange={(e) => handleAttendanceChange(i, 'phone', e.target.value)} fontSize={{ base: '2xs', md: 'xs' }} w="100%" />
                  </Td>
                  <Td>
                    <Input value={a.sign} onChange={(e) => handleAttendanceChange(i, 'sign', e.target.value)} fontSize={{ base: '2xs', md: 'xs' }} w="100%" />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
        <Button mt={3} size="sm" onClick={addRow} colorScheme="blue">
          + Add Row
        </Button>
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
