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
  FormControl,
  FormLabel,
  Select,
  Input,
  Progress,
  useToast,
  IconButton,
  Checkbox,
  CheckboxGroup,
  SimpleGrid,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { CloseIcon } from '@chakra-ui/icons';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';

type SectionType = 'identification' | 'action' | 'sanction' | 'violation' | 'training' | 'onsite' | 'offsite' | 'generatedLetter' | 'spotcheck' | 'memo' | 'reply';
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

type NatureTotal = {
  nature: string;
  day: number;
  week: number;
  month: number;
  year: number;
  allTime: number;
};

type TargetPeriod = 'day' | 'week' | 'month' | 'year';

type Target = {
  _id: string;
  username: string;
  period: TargetPeriod;
  goal: number;
  sections: SectionType[];
  actual: number;
  progress: number;
  completed: boolean;
  createdBy: string;
  createdAt: string;
};

type AnalysisData = {
  sectionTotals: Record<Period, SectionTally>;
  userTotals: UserTotal[];
  leaders: Record<Period, string | null>;
  natureTotals: NatureTotal[];
  targets: Target[];
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
  reply: 'Reply',
};

const SECTION_ORDER: SectionType[] = [
  'identification', 'action', 'sanction', 'violation', 'training',
  'onsite', 'offsite', 'generatedLetter', 'spotcheck', 'memo', 'reply',
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
  const toast = useToast();

  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [csrfToken, setCsrfToken] = useState('');

  // 🔹 Target form
  const [targetUsername, setTargetUsername] = useState('');
  const [targetPeriod, setTargetPeriod] = useState<TargetPeriod>('month');
  const [targetGoal, setTargetGoal] = useState('');
  const [targetSections, setTargetSections] = useState<SectionType[]>([]);
  const [savingTarget, setSavingTarget] = useState(false);

  // 🔹 Only a superadmin may view Analysis.
  useEffect(() => {
    if (!authLoading && user && user.role !== 'superadmin') {
      router.replace('/');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    const fetchCsrf = async () => {
      try {
        const res = await axios.get(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`, {
          withCredentials: true,
        });
        setCsrfToken(res.data.csrfToken);
      } catch (err) {
        console.error('Failed to fetch CSRF token:', err);
      }
    };
    fetchCsrf();
  }, []);

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      const res = await axios.get<AnalysisData>(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/analysis`,
        { withCredentials: true }
      );
      setData(res.data);
      if (!targetUsername && res.data.userTotals.length > 0) {
        setTargetUsername(res.data.userTotals[0].username);
      }
    } catch (err) {
      console.error('Failed to load analysis:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || user?.role !== 'superadmin') return;
    fetchAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const handleSaveTarget = async () => {
    if (!targetUsername || !targetGoal || Number(targetGoal) <= 0) {
      toast({ title: 'Choose a user and enter a goal greater than 0.', status: 'warning', duration: 3000, isClosable: true });
      return;
    }
    if (targetSections.length === 0) {
      toast({ title: 'Select at least one section for this target to count.', status: 'warning', duration: 3000, isClosable: true });
      return;
    }
    setSavingTarget(true);
    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/analysis/targets`,
        { username: targetUsername, period: targetPeriod, goal: Number(targetGoal), sections: targetSections },
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } }
      );
      toast({ title: 'Target saved.', status: 'success', duration: 3000, isClosable: true });
      setTargetGoal('');
      setTargetSections([]);
      fetchAnalysis();
    } catch (err) {
      console.error('Failed to save target:', err);
      toast({ title: 'Failed to save target.', status: 'error', duration: 4000, isClosable: true });
    } finally {
      setSavingTarget(false);
    }
  };

  const handleDeleteTarget = async (id: string) => {
    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/analysis/targets/${id}`,
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } }
      );
      setData((prev) => (prev ? { ...prev, targets: prev.targets.filter((t) => t._id !== id) } : prev));
    } catch (err) {
      console.error('Failed to delete target:', err);
      toast({ title: 'Failed to delete target.', status: 'error', duration: 4000, isClosable: true });
    }
  };

  // Colour grows warmer→cooler with progress, then turns green the moment
  // the goal is actually met — a visibly distinct "done" state rather than
  // just the top of the same gradient.
  const progressColor = (pct: number, completed: boolean) => {
    if (completed) return 'green';
    if (pct >= 75) return 'blue';
    if (pct >= 50) return 'yellow';
    if (pct >= 25) return 'orange';
    return 'red';
  };

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

  // Same idea for Nature of Business — which one leads each period.
  const topNatureOf = (period: Period): string | null => {
    if (!data || data.natureTotals.length === 0) return null;
    const best = data.natureTotals.reduce((b, n) => (n[period] > (b?.[period] ?? -1) ? n : b), data.natureTotals[0]);
    return best[period] > 0 ? best.nature : null;
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

          {/* 🔹 Nature of Business */}
          <Box bg="white" borderRadius="xl" boxShadow="lg" p={{ base: 4, md: 6 }}>
            <Text fontSize="lg" fontWeight="bold" mb={1}>Companies by Nature of Business</Text>
            <Text fontSize="xs" color="gray.500" mb={4}>
              How many companies were registered under each nature of business, tallied for each period.
            </Text>
            <TableContainer overflowX="auto">
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Nature of Business</Th>
                    {PERIODS.map((p) => (
                      <Th key={p} isNumeric>{PERIOD_LABELS[p]}</Th>
                    ))}
                  </Tr>
                </Thead>
                <Tbody>
                  {data.natureTotals.map((n) => (
                    <Tr key={n.nature}>
                      <Td fontWeight="medium">{n.nature}</Td>
                      {PERIODS.map((p) => {
                        const isTop = topNatureOf(p) === n.nature;
                        return (
                          <Td key={p} isNumeric fontWeight={isTop ? 'bold' : 'normal'} color={isTop ? 'red.500' : undefined}>
                            {n[p]}
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

          {/* 🔹 Targets */}
          <Box bg="white" borderRadius="xl" boxShadow="lg" p={{ base: 4, md: 6 }}>
            <Text fontSize="lg" fontWeight="bold" mb={1}>Targets</Text>
            <Text fontSize="xs" color="gray.500" mb={4}>
              Set an entry-count goal for a user over a period. Progress is colour-coded as it grows, turning green once the goal is met.
            </Text>

            <HStack spacing={3} mb={4} flexWrap="wrap" align="flex-end">
              <FormControl w={{ base: 'full', sm: '200px' }}>
                <FormLabel fontSize="xs">User</FormLabel>
                <Select size="sm" value={targetUsername} onChange={(e) => setTargetUsername(e.target.value)}>
                  {data.userTotals.map((u) => (
                    <option key={u.username} value={u.username}>{u.username}</option>
                  ))}
                </Select>
              </FormControl>
              <FormControl w={{ base: 'full', sm: '140px' }}>
                <FormLabel fontSize="xs">Period</FormLabel>
                <Select size="sm" value={targetPeriod} onChange={(e) => setTargetPeriod(e.target.value as TargetPeriod)}>
                  <option value="day">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="year">This Year</option>
                </Select>
              </FormControl>
              <FormControl w={{ base: 'full', sm: '120px' }}>
                <FormLabel fontSize="xs">Goal</FormLabel>
                <Input size="sm" type="number" min={1} value={targetGoal} onChange={(e) => setTargetGoal(e.target.value)} placeholder="e.g. 50" />
              </FormControl>
            </HStack>

            <FormControl mb={4}>
              <HStack justify="space-between" mb={1}>
                <FormLabel fontSize="xs" mb={0}>
                  Which forms count toward this target? Select all, or just one or two.
                </FormLabel>
                <HStack spacing={2}>
                  <Button size="xs" variant="link" onClick={() => setTargetSections(SECTION_ORDER)}>
                    Select all
                  </Button>
                  <Button size="xs" variant="link" onClick={() => setTargetSections([])}>
                    Clear
                  </Button>
                </HStack>
              </HStack>
              <CheckboxGroup
                value={targetSections}
                onChange={(vals) => setTargetSections(vals as SectionType[])}
              >
                <SimpleGrid columns={{ base: 2, sm: 3, md: 5 }} spacing={2}>
                  {SECTION_ORDER.map((s) => (
                    <Checkbox key={s} value={s} size="sm">
                      <Text fontSize="xs">{SECTION_LABELS[s]}</Text>
                    </Checkbox>
                  ))}
                </SimpleGrid>
              </CheckboxGroup>
            </FormControl>

            <Button size="sm" colorScheme="red" onClick={handleSaveTarget} isLoading={savingTarget} mb={5}>
              Set Target
            </Button>

            {data.targets.length === 0 ? (
              <Text color="gray.500" fontSize="sm">No targets set yet.</Text>
            ) : (
              <VStack align="stretch" spacing={3}>
                {data.targets.map((t) => (
                  <Box key={t._id} p={3} bg="gray.50" borderRadius="md" shadow="xs">
                    <HStack justify="space-between" mb={1}>
                      <HStack>
                        <Text fontWeight="bold" fontSize="sm">{t.username}</Text>
                        <Badge fontSize="0.65rem" colorScheme="gray">{PERIOD_LABELS[t.period]}</Badge>
                        {t.completed && <Badge fontSize="0.65rem" colorScheme="green">✅ Completed</Badge>}
                      </HStack>
                      <IconButton
                        aria-label="Remove target"
                        icon={<CloseIcon boxSize={2.5} />}
                        size="xs"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => handleDeleteTarget(t._id)}
                      />
                    </HStack>
                    <Wrap mb={2} spacing={1}>
                      {t.sections.map((s) => (
                        <WrapItem key={s}>
                          <Badge fontSize="0.6rem" colorScheme="cyan" variant="subtle">{SECTION_LABELS[s]}</Badge>
                        </WrapItem>
                      ))}
                    </Wrap>
                    <Progress
                      value={Math.min(t.progress, 100)}
                      size="sm"
                      borderRadius="full"
                      colorScheme={progressColor(t.progress, t.completed)}
                      mb={1}
                    />
                    <Text fontSize="xs" color="gray.600">
                      {t.actual} / {t.goal} entries ({t.progress}%)
                    </Text>
                  </Box>
                ))}
              </VStack>
            )}
          </Box>
        </VStack>
      )}
    </Box>
  );
}
