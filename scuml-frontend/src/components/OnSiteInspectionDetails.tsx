'use client';

// Shared on-screen display for one On-Site Inspection record — used in both
// the main Company Compliance Record and the admin Company Records modal,
// so a future field change only has to happen once. Renders the current
// (Exam Report-based) structure when present; falls back to the pre-redesign
// fields for inspections saved under the old form, so historical records
// still display in full.
import { Box, Table, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';
import { AML_CFT_REQUIREMENTS } from '@/lib/onSiteInspectionRequirements';

type ObservationRow = { requirement: string; observation?: string; recommendation?: string };
type DocumentRequestRow = { document: string; provided?: string };

type LegacyObligation = { obligation: string; complianceStatus?: string; remark?: string };
type LegacyOrgProfile = { desc: string; remark?: string };
type LegacyAttendance = { name?: string; organization?: string; position?: string; phone?: string; sign?: string };

export type OnSiteInspectionLike = {
  _id: string;
  createdBy?: string;

  coveragePeriod?: string;
  dateOfExamination?: string;
  areasCovered?: string;
  structure?: string;

  managementTeamInterviewed?: string;
  documentsRequested?: DocumentRequestRow[];
  specificFindings?: string;
  materialException?: string;
  politicallyExposedPersons?: string;
  suspiciousTransactionReporting?: string;
  targetedFinancialSanctions?: string;
  observations?: ObservationRow[];
  conclusionRecommendations?: string;

  // Legacy (pre-redesign) fields — only present on older records.
  obligations?: LegacyObligation[];
  orgProfile?: LegacyOrgProfile[];
  riskClassification?: { level?: string; vulnerabilities?: string };
  riskLevel?: string;
  attendance?: LegacyAttendance[];
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box mb={3}>
      <Text fontWeight="bold" mb={1}>{title}</Text>
      {children}
    </Box>
  );
}

export default function OnSiteInspectionDetails({ insp }: { insp: OnSiteInspectionLike }) {
  const isCurrentFormat =
    (insp.observations && insp.observations.length > 0) ||
    (insp.documentsRequested && insp.documentsRequested.length > 0);

  if (isCurrentFormat) {
    const amlRows = (insp.observations || []).slice(0, AML_CFT_REQUIREMENTS.length);
    const tppaRows = (insp.observations || []).slice(AML_CFT_REQUIREMENTS.length);

    return (
      <Box>
        {insp.coveragePeriod && (
          <Section title="Coverage/Period">
            <Text whiteSpace="pre-wrap">{insp.coveragePeriod}</Text>
          </Section>
        )}

        {insp.dateOfExamination && (
          <Section title="Date of Examination">
            <Text>{insp.dateOfExamination}</Text>
          </Section>
        )}

        {insp.areasCovered && (
          <Section title="Areas Covered">
            <Text whiteSpace="pre-wrap">{insp.areasCovered}</Text>
          </Section>
        )}

        {insp.structure && (
          <Section title="Structure">
            <Text whiteSpace="pre-wrap">{insp.structure}</Text>
          </Section>
        )}

        {insp.managementTeamInterviewed && (
          <Section title="Management Team Interviewed">
            <Text whiteSpace="pre-wrap">{insp.managementTeamInterviewed}</Text>
          </Section>
        )}

        {insp.documentsRequested && insp.documentsRequested.length > 0 && (
          <Section title="Documents Requested">
            <Table size="sm" variant="simple">
              <Thead>
                <Tr>
                  <Th>Documents Requested</Th>
                  <Th>Documents Provided/Reviewed</Th>
                </Tr>
              </Thead>
              <Tbody>
                {insp.documentsRequested.map((d, idx) => (
                  <Tr key={idx}>
                    <Td>{d.document}</Td>
                    <Td whiteSpace="pre-wrap">{d.provided || 'N/A'}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Section>
        )}

        {insp.specificFindings && (
          <Section title="Specific Findings">
            <Text whiteSpace="pre-wrap">{insp.specificFindings}</Text>
          </Section>
        )}

        {insp.materialException && (
          <Section title="Material Exception">
            <Text whiteSpace="pre-wrap">{insp.materialException}</Text>
          </Section>
        )}

        {insp.politicallyExposedPersons && (
          <Section title="Politically Exposed Persons (PEP)">
            <Text whiteSpace="pre-wrap">{insp.politicallyExposedPersons}</Text>
          </Section>
        )}

        {insp.suspiciousTransactionReporting && (
          <Section title="Suspicious Transaction Reporting (STR)">
            <Text whiteSpace="pre-wrap">{insp.suspiciousTransactionReporting}</Text>
          </Section>
        )}

        {insp.targetedFinancialSanctions && (
          <Section title="Targeted Financial Sanctions (TFS)">
            <Text whiteSpace="pre-wrap">{insp.targetedFinancialSanctions}</Text>
          </Section>
        )}

        {amlRows.length > 0 && (
          <Section title="Observations — AML/CFT Requirements">
            <Table size="sm" variant="simple">
              <Thead>
                <Tr>
                  <Th>Requirement</Th>
                  <Th>Observation</Th>
                  <Th>Recommendations/Remedial Action</Th>
                </Tr>
              </Thead>
              <Tbody>
                {amlRows.map((o, idx) => (
                  <Tr key={idx}>
                    <Td>{o.requirement}</Td>
                    <Td whiteSpace="pre-wrap">{o.observation || 'N/A'}</Td>
                    <Td whiteSpace="pre-wrap">{o.recommendation || 'N/A'}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Section>
        )}

        {tppaRows.length > 0 && (
          <Section title="Observations — Terrorism Prevention and Prohibition Act, 2022">
            <Table size="sm" variant="simple">
              <Thead>
                <Tr>
                  <Th>Requirement</Th>
                  <Th>Observation</Th>
                  <Th>Recommendations/Remedial Action</Th>
                </Tr>
              </Thead>
              <Tbody>
                {tppaRows.map((o, idx) => (
                  <Tr key={idx}>
                    <Td>{o.requirement}</Td>
                    <Td whiteSpace="pre-wrap">{o.observation || 'N/A'}</Td>
                    <Td whiteSpace="pre-wrap">{o.recommendation || 'N/A'}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Section>
        )}

        {insp.conclusionRecommendations && (
          <Section title="Conclusion/Recommendations">
            <Text whiteSpace="pre-wrap">{insp.conclusionRecommendations}</Text>
          </Section>
        )}

        <Text fontSize="xs" color="gray.500" mt={2}>Entered by: {insp.createdBy || 'N/A'}</Text>
      </Box>
    );
  }

  // --- Legacy (pre-redesign) format ---
  return (
    <Box>
      {insp.obligations && insp.obligations.length > 0 && (
        <Section title="Compliance with the Law & Regulation">
          <Table size="sm" variant="simple">
            <Thead>
              <Tr>
                <Th>Obligation</Th>
                <Th>Compliance Status</Th>
                <Th>Remark</Th>
              </Tr>
            </Thead>
            <Tbody>
              {insp.obligations.map((o, idx) => (
                <Tr key={idx}>
                  <Td>{o.obligation}</Td>
                  <Td>{o.complianceStatus || 'N/A'}</Td>
                  <Td>{o.remark || 'N/A'}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Section>
      )}

      {insp.orgProfile && insp.orgProfile.length > 0 && (
        <Section title="Organization Profile">
          <Table size="sm" variant="simple">
            <Thead>
              <Tr>
                <Th>Description</Th>
                <Th>Remark</Th>
              </Tr>
            </Thead>
            <Tbody>
              {insp.orgProfile.map((p, idx) => (
                <Tr key={idx}>
                  <Td>{p.desc}</Td>
                  <Td>{p.remark || 'N/A'}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Section>
      )}

      <Text><b>Risk Level:</b> {insp.riskClassification?.level || insp.riskLevel || 'N/A'}</Text>
      <Text mb={3}><b>Vulnerabilities:</b> {insp.riskClassification?.vulnerabilities || 'N/A'}</Text>

      {insp.attendance && insp.attendance.length > 0 && (
        <Section title="Attendance">
          <Table size="sm" variant="simple">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Organization</Th>
                <Th>Position</Th>
                <Th>Phone</Th>
              </Tr>
            </Thead>
            <Tbody>
              {insp.attendance.map((a, idx) => (
                <Tr key={idx}>
                  <Td>{a.name || 'N/A'}</Td>
                  <Td>{a.organization || 'N/A'}</Td>
                  <Td>{a.position || 'N/A'}</Td>
                  <Td>{a.phone || 'N/A'}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Section>
      )}

      <Text fontSize="xs" color="gray.500" mt={2}>Entered by: {insp.createdBy || 'N/A'}</Text>
    </Box>
  );
}
