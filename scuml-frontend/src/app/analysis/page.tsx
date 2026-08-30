'use client';

import {
  Box,
  Text,
  HStack,
  VStack,
  Button,
  Spinner,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';

type SectionType = 'identification' | 'action' | 'sanction' | 'violation' | 'training' | 'onsite' | 'offsite' | 'generatedLetter' | 'spotcheck' | 'memo';
type Period = 'day' | 'week' | 'month' | 'year' | 'allTime';

type SectionTally = Record<SectionType, number>;

type UserTotal = {
  username: string;
  role: string;
  day: number;
  week: number;
  month: number;
  year: number;
  allTime: number;
};

type AnalysisData = {
  sectionTotals: Record<Period, SectionTally>;
  userTotals: UserTotal[];
  leaders: Record<Period, string | null>;
  generatedAt: string;
};

const SECTION_LABELS: Record<SectionType, string> = {
  identification: 'Identification',
  action: 'Action',
  sanction: 'Sanction',
  violation: 'Violation',
  training: 'Training',
  onsite: 'On-Site Inspection',
  offsite: 'Off-Site Inspection',
  generatedLetter: 'Initiated Letter',
  spotcheck: 'Spot Check',
  memo: 'Memo',
};

const SECTION_ORDER: SectionType[] = [
  'identification', 'action', 'sanction', 'violation', 'training',
  'onsite', 'offsite', 'generatedLetter', 'spotcheck', 'memo',
];

const PERIOD_LABELS: Record<Period, string> = {
  day: 'Today',
  week: 'This Week',
  month: 'This Month',
  year: 'This Year',
  allTime: 'All Time',
};

const PERIODS: Period[] = ['day', 'week', 'month', 'year', 'allTime'];

export default function AnalysisPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

  // 🔹 Only a superadmin may view Analysis.
  useEffect(() => {
    if (!authLoading && user && user.role !== 'superadmin') {
      router.replace('/');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (authLoading || user?.role !== 'superadmin') return;
    const fetchAnalysis = async () => {
      try {
        setLoading(true);
        const res = await axios.get<AnalysisData>(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/analysis`,
          { withCredentials: true }
        );
        setData(res.data);
      } catch (err) {
        console.error('Failed to load analysis:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalysis();
  }, [authLoading, user]);

  if (authLoading || !user) {
    return (
      <Box h="100vh" display="flex" alignItems="center" justifyContent="center">
        <Spinner size="xl" />
      </Box>
    );
  }

  if (user.role !== 'superadmin') return null;

  // Which section leads each period — for bolding the max cell per column.
  const topSectionOf = (period: Period): SectionType | null => {
    if (!data) return null;
    const tally = data.sectionTotals[period];
    let best: SectionType | null = null;
    for (const s of SECTION_ORDER) {
      if (best === null || tally[s] > tally[best]) best = s;
    }
    return best && tally[best] > 0 ? best : null;
  };

  return (
    <Box p={5}>
      <HStack justify="center" mb={6} flexWrap="wrap" gap={4}>
        <Text fontSize="2xl" fontWeight="bold" color="red.500">
          Analysis
        </Text>
        <Button size="sm" variant="outline" onClick={() => router.push('/')}>
          Back to Home
        </Button>
      </HStack>

      {loading || !data ? (
        <Spinner />
      ) : (
        <VStack align="stretch" spacing={8} maxW="1100px" mx="auto">
          {/* 🔹 Entries by section */}
          <Box bg="white" borderRadius="xl" boxShadow="lg" p={{ base: 4, md: 6 }}>
            <Text fontSize="lg" fontWeight="bold" mb={1}>Entries by Section</Text>
            <Text fontSize="xs" color="gray.500" mb={4}>
              How many entries came in per section, tallied for each period. The busiest section in each column is highlighted.
            </Text>
            <TableContainer overflowX="auto">
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Section</Th>
                    {PERIODS.map((p) => (
                      <Th key={p} isNumeric>{PERIOD_LABELS[p]}</Th>
                    ))}
                  </Tr>
                </Thead>
                <Tbody>
                  {SECTION_ORDER.map((section) => (
                    <Tr key={section}>
                      <Td fontWeight="medium">{SECTION_LABELS[section]}</Td>
                      {PERIODS.map((p) => {
                        const isTop = topSectionOf(p) === section;
                        return (
                          <Td key={p} isNumeric fontWeight={isTop ? 'bold' : 'normal'} color={isTop ? 'red.500' : undefined}>
                            {data.sectionTotals[p][section]}
                            {isTop && ' 🏆'}
                          </Td>
                        );
                      })}
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          </Box>

          {/* 🔹 User work rate */}
          <Box bg="white" borderRadius="xl" boxShadow="lg" p={{ base: 4, md: 6 }}>
            <Text fontSize="lg" fontWeight="bold" mb={1}>Key Performance Indicator (KPI)</Text>
            <Text fontSize="xs" color="gray.500" mb={4}>
              Every user, ranked by total entries submitted. 🏆 marks whoever leads that specific period.
            </Text>
            <TableContainer overflowX="auto">
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Rank</Th>
                    <Th>User</Th>
                    <Th>Role</Th>
                    {PERIODS.map((p) => (
                      <Th key={p} isNumeric>{PERIOD_LABELS[p]}</Th>
                    ))}
                  </Tr>
                </Thead>
                <Tbody>
                  {data.userTotals.map((u, idx) => (
                    <Tr key={u.username}>
                      <Td>{idx + 1}</Td>
                      <Td fontWeight="semibold">{u.username}</Td>
                      <Td>
                        <Badge colorScheme={u.role === 'superadmin' ? 'purple' : u.role === 'staff' ? 'blue' : 'gray'} fontSize="0.65rem">
                          {u.role}
                        </Badge>
                      </Td>
                      {PERIODS.map((p) => {
                        const isLeader = data.leaders[p] === u.username && u[p] > 0;
                        return (
                          <Td key={p} isNumeric fontWeight={isLeader ? 'bold' : 'normal'} color={isLeader ? 'red.500' : undefined}>
                            {u[p]}
                            {isLeader && ' 🏆'}
                          </Td>
                        );
                      })}
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          </Box>
        </VStack>
      )}
    </Box>
  );
}
