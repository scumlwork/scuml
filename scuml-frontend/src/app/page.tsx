'use client';

import {
  Box,
  Text,
  Flex,
  Button,
  Image,
  Spinner,
  IconButton,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  DrawerHeader,
  DrawerBody,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  VStack,
  Checkbox,
  Link,
  useToast,
  Table,        // ✅ added
  Thead,        // ✅ added
  Tbody,        // ✅ added
  Tr,           // ✅ added
  Th,           // ✅ added
  Td            // ✅ added
} from '@chakra-ui/react';

import { HamburgerIcon, ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, ReactNode } from 'react';
import axios from 'axios';

const DEFAULT_AVATAR =
  "https://res.cloudinary.com/dtseei2ze/image/upload/v1756982016/default-avatar_w9umu2.jpg";

type Letter = {
  _id: string;
  typeOfLetter: string;
  receiverName: string;
  phone: string;
  email: string;
  dateOfReporting: string;
};

type Sanction = {
  _id: string;
  company: string; // company ID
  natureOfBusiness: string;
  amount: number;
  modeOfPayment: string;
};

type Violation = {
  _id: string;
  company: string; // company ID
  amountSanctioned: number;
  amountPaid: number;
  payments?: { amount: number; date: string }[];
  createdAt?: string;
};

// Violations may carry a chunk of amountPaid from before payment history was
// tracked (or before a given payment was recorded individually). Whatever
// portion of amountPaid isn't accounted for by the recorded payments is
// shown as one implied entry dated at creation, followed by the real ones.
function violationPayments(v: Violation): { amount: number; date: string }[] {
  const recorded = v.payments || [];
  const recordedSum = recorded.reduce((sum, p) => sum + p.amount, 0);
  const legacy = v.amountPaid - recordedSum;
  const result: { amount: number; date: string }[] = [];
  if (legacy > 0) result.push({ amount: legacy, date: v.createdAt || '' });
  return [...result, ...recorded];
}

// One card per payment — the first card also carries the original sanctioned
// amount (matching how a single violation entry originally looked), each
// card shows the running balance left after that payment was subtracted.
type ViolationCard = { isFirst: boolean; payment: { amount: number; date: string } | null; balance: number };
function violationCards(v: Violation): ViolationCard[] {
  const payments = violationPayments(v);
  if (payments.length === 0) {
    return [{ isFirst: true, payment: null, balance: v.amountSanctioned }];
  }
  let running = v.amountSanctioned;
  return payments.map((p, idx) => {
    running -= p.amount;
    return { isFirst: idx === 0, payment: p, balance: running };
  });
}


type Obligation = {
  obligation: string;
  complianceStatus: string;
  remark: string;
};

type OrgProfile = {
  desc: string;
  remark: string;
};

type RiskClassification = {
  level: "low" | "medium" | "high";
  vulnerabilities: string;
};

type Attendance = {
  name: string;
  organization: string;
  position: string;
  phone: string;
  sign: string;
};

type OnSiteInspection = {
  _id: string;
  obligations?: Obligation[];
  orgProfile?: OrgProfile[];
  riskClassification?: RiskClassification;
  attendance?: Attendance[];
  createdBy?: string;
};

type Training = {
  _id: string;
  topic: string;
  date: string;
  facilitator: string;
  participants: number;
  createdBy: string;
};

// 🔹 Add this type
type Shareholder = {
  name: string;
  pepStatus: string;
  nonResident: string;
  foreigner: string;
  sanctionList: string;
};

type OffSiteInspection = {
  _id: string;
  examinationDate: string;
  introduction: string;
  contact: string;
  officeAddress: string;
  telephone: string;
  sources: string;
  complianceStatus: string;
  rc: string;
  scuml: string;
  tin: string;
  transactionReporting: string;
  shareholders: Shareholder[];
  politicallyExposed: { name: string }[] | string; // 👈 allow array OR string
  affiliates: { name: string }[] | string;         // 👈 allow array OR string
  legalIssues: string;
  locations: string[] | string;                    // 👈 backend might send string
  products: string[] | string;                     // 👈 backend might send string
  recommendation: string;
  createdBy: string;
};


// 🔹 Extend Registration
type Registration = {
  _id: string;
  officerName: string;
  dateOfIdentification: string;
  companyName: string;
  natureOfBusiness: string;
  address: string;
  state: string;
  city?: string;
  modeOfIdentification: string;
  phone: string;
  email: string;
  photos?: string[];
  time?: string;
  letters?: Letter[];
  sanctions?: Sanction[];
  onSiteInspections?: OnSiteInspection[];
  offSiteInspections?: OffSiteInspection[]; // ✅ add this
  trainings?: Training[];
  violations?: Violation[];
};

// Label on the left, value on the right — long values wrap within their own
// column instead of dropping below the label.
function InspectionField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Flex mb={1.5} gap={2} align="flex-start">
      <Text fontWeight="bold" minW="170px" flexShrink={0}>
        {label}:
      </Text>
      <Text whiteSpace="pre-wrap" flex="1">
        {value}
      </Text>
    </Flex>
  );
}

// Cloudinary can resize/compress on the fly — full-resolution phone photos
// were causing the lag; this asks for a display-sized, auto-optimized version.
function optimizedPhotoUrl(url: string) {
  return url.includes("/upload/") ? url.replace("/upload/", "/upload/q_auto,f_auto,w_1400/") : url;
}

// Click-through photo viewer: one photo at a time, with left/right navigation.
function PhotoLightbox({
  photos,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  photos: string[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setLoaded(false);
  }, [index]);

  // Preload the neighbors so Prev/Next feels instant once you're on a photo.
  useEffect(() => {
    [photos[(index + 1) % photos.length], photos[(index - 1 + photos.length) % photos.length]].forEach(
      (url) => {
        const img = new window.Image();
        img.src = optimizedPhotoUrl(url);
      }
    );
  }, [index, photos]);

  return (
    <Modal isOpen onClose={onClose} size="4xl" isCentered>
      <ModalOverlay />
      <ModalContent bg="black" maxW={{ base: "95vw", md: "800px" }}>
        <ModalCloseButton color="white" zIndex={1} />
        <ModalBody
          display="flex"
          alignItems="center"
          justifyContent="center"
          position="relative"
          p={4}
          minH="60vh"
        >
          <IconButton
            aria-label="Previous photo"
            icon={<ChevronLeftIcon boxSize={8} />}
            position="absolute"
            left={2}
            top="50%"
            transform="translateY(-50%)"
            onClick={onPrev}
            isDisabled={photos.length <= 1}
            colorScheme="whiteAlpha"
            variant="ghost"
            zIndex={1}
          />
          {!loaded && <Spinner color="white" size="xl" position="absolute" />}
          <Image
            key={index}
            src={optimizedPhotoUrl(photos[index])}
            alt={`Photo ${index + 1}`}
            maxH="75vh"
            maxW="100%"
            objectFit="contain"
            opacity={loaded ? 1 : 0}
            transition="opacity 0.15s ease-in"
            onLoad={() => setLoaded(true)}
          />
          <IconButton
            aria-label="Next photo"
            icon={<ChevronRightIcon boxSize={8} />}
            position="absolute"
            right={2}
            top="50%"
            transform="translateY(-50%)"
            onClick={onNext}
            isDisabled={photos.length <= 1}
            colorScheme="whiteAlpha"
            variant="ghost"
            zIndex={1}
          />
        </ModalBody>
        <ModalFooter justifyContent="center">
          <Text color="white" fontSize="sm">
            {index + 1} / {photos.length}
          </Text>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default function HomePage() {
  const { user, loading, logout, setUser } = useAuth();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  // 🔹 Registrations state
  const [registrations, setRegistrations] = useState<Registration[]>([]);
const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);

  const {
    isOpen: isModalOpen,
    onOpen: onModalOpen,
    onClose: onModalClose,
  } = useDisclosure();

  // 🔹 Super admin: select + permanently delete registrations (cascades everywhere)
  const toast = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingSelected, setDeletingSelected] = useState(false);

  // 🔹 Photo lightbox
  const [lightboxPhotos, setLightboxPhotos] = useState<string[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const openLightbox = (photos: string[]) => {
    setLightboxPhotos(photos);
    setLightboxIndex(0);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      prev.size === registrations.length ? new Set() : new Set(registrations.map((r) => r._id))
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const confirmDelete = window.confirm(
      `Permanently delete ${selectedIds.size} record(s) and everything linked to them (letters, sanctions, inspections, trainings)? This cannot be undone.`
    );
    if (!confirmDelete) return;

    setDeletingSelected(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          axios.delete(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/registrations/${id}`, {
            withCredentials: true,
            headers: { 'X-CSRF-Token': csrfToken || '' },
          })
        )
      );
      toast({
        title: `${selectedIds.size} record(s) deleted.`,
        status: 'success',
        duration: 4000,
        isClosable: true,
      });
      setRegistrations((prev) => prev.filter((r) => !selectedIds.has(r._id)));
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to delete selected registrations:', err);
      toast({ title: 'Some records failed to delete.', status: 'error', duration: 4000, isClosable: true });
    } finally {
      setDeletingSelected(false);
    }
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  // Fetch CSRF token on mount
  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
          { withCredentials: true }
        );
        setCsrfToken(res.data.csrfToken);
      } catch (err) {
        console.error("Failed to fetch CSRF token:", err);
      }
    };
    fetchCsrfToken();
  }, []);

  // Fetch profile photo once when user is first available
  useEffect(() => {
    const fetchPhoto = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/profile/photo`,
          { withCredentials: true }
        );

        if (res.data?.photoUrl) {
          setUser(user ? { ...user, photoUrl: res.data.photoUrl } : user);
        } else {
          setUser(user ? { ...user, photoUrl: DEFAULT_AVATAR } : user);
        }
      } catch (err) {
        console.error("Failed to fetch photo:", err);
        setUser(user ? { ...user, photoUrl: DEFAULT_AVATAR } : user);
      }
    };

    if (user && !user.photoUrl) {
      fetchPhoto();
    }
  }, [user, setUser]);

  // 🔹 Fetch registrations
  useEffect(() => {
    const fetchRegistrations = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/registrations`,
          { withCredentials: true }
        );
        setRegistrations(res.data || []);
      } catch (err) {
        console.error("Failed to fetch registrations:", err);
      }
    };

    if (user) {
      fetchRegistrations();
    }
  }, [user]);

  if (loading) {
    return (
      <Box minH="100vh" display="flex" alignItems="center" justifyContent="center">
        <Spinner size="xl" />
      </Box>
    );
  }

  if (!user) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);

      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/profile/photo`,
        formData,
        {
          withCredentials: true,
          headers: {
            "X-CSRF-Token": csrfToken || "",
          },
        }
      );

      setUser({ ...user, photoUrl: res.data.photoUrl });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        console.error("Upload failed:", err.response?.data || err.message);
      } else if (err instanceof Error) {
        console.error("Upload failed:", err.message);
      } else {
        console.error("Upload failed: Unknown error", err);
      }
    } finally {
      setUploading(false);
    }
  };

  const SidebarContent = () => (
    <Box
      w={{ base: "100%", md: "250px" }}
      h="100%"
      minH="100vh"
      maxW="100vw"
      bg="black"
      color="white"
      px={{ base: 3, md: 4 }}
      pb={{ base: 3, md: 4 }}
      pt={{ base: 14, md: 16 }}
      display="flex"
      flexDirection="column"
      alignItems="center"
      boxSizing="border-box"
      overflowX="hidden"    // ensure no horizontal scroll inside
    >
      {/* Profile Photo */}
      <Box
        position="relative"
        cursor="pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <Image
          src={user?.photoUrl || DEFAULT_AVATAR}
          alt={user?.username || 'User'}
          boxSize="72px"
          maxW="100%"
          borderRadius="full"
          mb={2}
          border={uploading ? "3px solid blue" : "3px solid white"}
          opacity={uploading ? 0.6 : 1}
          boxSizing="border-box"
        />
        {uploading && (
          <Box
            position="absolute"
            top="0"
            left="0"
            w="100%"
            h="100%"
            display="flex"
            alignItems="center"
            justifyContent="center"
            borderRadius="full"
            bg="rgba(0,0,0,0.4)"
          >
            <Spinner size="sm" color="white" />
          </Box>
        )}
      </Box>
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <Text fontWeight="bold" mb={3} textAlign="center" wordBreak="break-word" px={2}>
        {user.username}
      </Text>


      
{/* Menu buttons */}
<Box
  w="full"
  display="flex"
  flexDirection="column"
  gap={2}
  px={1}
  boxSizing="border-box"
>
  {[
    { label: "Identification", path: "registration", superadminOnly: false, ownerOnly: false }, // ✅ links to /registration
    { label: "Letters", path: "letters", superadminOnly: false, ownerOnly: false },
    { label: "On-Site Inspection", path: "on-site-inspection", superadminOnly: false, ownerOnly: false },
    { label: "Off-Site Inspection", path: "off-site-inspection", superadminOnly: false, ownerOnly: false },
    { label: "Sanction", path: "sanction", superadminOnly: false, ownerOnly: false },
    { label: "Violations", path: "violations", superadminOnly: false, ownerOnly: false },
    { label: "Training", path: "training", superadminOnly: false, ownerOnly: false },
    { label: "Admin", path: "database", superadminOnly: true, ownerOnly: false },      // ✅ links to /database
    { label: "Create User", path: "register", superadminOnly: true, ownerOnly: false },
    { label: "Audit Log", path: "audit-log", superadminOnly: true, ownerOnly: true },
  ]
    .filter((item) => !item.superadminOnly || user.role === "superadmin")
    .filter((item) => !item.ownerOnly || user.isOwner)
    .map((item) => (
    <Button
      key={item.label}
      size="sm"
      w="90%"
      mx="auto"
      px={3}
      py={2}
      bg="red.500"
      color="white"
      _hover={{ bg: "red.600" }}
      boxSizing="border-box"
      onClick={() => {
        router.push(`/${item.path}`);
      }}
    >
      {item.label}
    </Button>
  ))}
</Box>




      {/* Logout */}
      <Button mt={4} onClick={logout} colorScheme="gray" size="sm" h="36px" w="90%" mx="auto">
        Logout
      </Button>
    </Box>
  );

  return (
    <Box
      minH="100vh"
      display="flex"
      flexDir={{ base: 'column', md: 'row' }}
      bg="white"
      position="relative"
      overflowX="hidden"
    >
      {/* Hamburger button (mobile only) */}
      <IconButton
        aria-label="Open menu"
        icon={<HamburgerIcon />}
        display={{ base: "block", md: "none" }}
        position="absolute"
        top="10px"
        left="10px"
        onClick={onOpen}
        zIndex={10}
      />

      {/* Sidebar (desktop) */}
      <Box
        display={{ base: "none", md: "block" }}
        position="fixed"
        top="0"
        left="0"
        h="100vh"
        w="250px"
        minW="250px"
        overflowY="auto"
        overflowX="hidden"
        zIndex={1}
        boxSizing="border-box"
      >
        <SidebarContent />
      </Box>

      {/* Drawer (mobile sidebar) */}
      <Drawer isOpen={isOpen} placement="left" onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>Menu</DrawerHeader>
          <DrawerBody p={0}>
            <SidebarContent />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Main content area */}
      <Box
        flex="1"
        ml={{ base: 0, md: "250px" }}
        overflowY="auto"
        overflowX="hidden"
        h="100vh"
        boxSizing="border-box"
        sx={{
          '&::-webkit-scrollbar': { width: '8px' },
          '&::-webkit-scrollbar-thumb': { background: '#c53030', borderRadius: '8px' },
          '&::-webkit-scrollbar-thumb:hover': { background: '#9b2c2c' },
          '&::-webkit-scrollbar-track': { background: '#f7fafc' },
          scrollbarWidth: 'thin',
          scrollbarColor: '#c53030 #f7fafc',
        }}
      >
        {/* Watermark */}
        <Box
          position="fixed"
          top="50%"
          left={{ base: "50%", md: "calc(125px + 50vw)" }}
          transform="translate(-50%, -50%)"
          opacity={0.07}
          pointerEvents="none"
          zIndex={0}
        >
          <Image
            src="/scuml-logo.PNG"
            alt="SCUML watermark"
            boxSize={{ base: "150px", md: "300px" }}
            objectFit="contain"
            borderRadius="full"
            maxW={{ base: "80vw", md: "calc(100vw - 300px)" }}
          />
        </Box>

        {/* Header */}
        <Box flex="1" textAlign="center" mt={{ base: 2, md: 2 }} p={2} zIndex={1}>
          <Image
            src="/scuml-logo.PNG"
            alt="SCUML logo"
            boxSize={{ base: "56px", md: "72px" }}
            mx="auto"
            mb={2}
            borderRadius="full"
            maxW="100%"
          />
          <Text fontSize={{ base: "lg", md: "xl" }} color="green.300" fontWeight="semibold">
            Economic And Financial Crime Commission
          </Text>
          <Text fontSize={{ base: "sm", md: "md" }} color="red.300">
            Special Control Unit Against Money Laundering
          </Text>
        </Box>

{/* 🔹 Registrations list */}
<Box p={3} zIndex={1}>
  {registrations.length === 0 ? (
    <Text fontSize="xs" color="gray.500">
      No registrations yet.
    </Text>
  ) : (
    <>
      {user.role === "superadmin" && (
        <Flex justify="space-between" align="center" mb={2}>
          <Checkbox
            size="sm"
            isChecked={selectedIds.size === registrations.length}
            isIndeterminate={selectedIds.size > 0 && selectedIds.size < registrations.length}
            onChange={toggleSelectAll}
          >
            <Text fontSize="xs">Select All</Text>
          </Checkbox>
          <Button
            size="xs"
            colorScheme="red"
            isDisabled={selectedIds.size === 0}
            isLoading={deletingSelected}
            onClick={handleDeleteSelected}
          >
            Delete Selected ({selectedIds.size})
          </Button>
        </Flex>
      )}
      <VStack align="stretch" spacing={1.5}>
        {registrations.map((reg) => (
          <Flex
            key={reg._id}
            align="center"
            gap={2}
            p={1.5}
            bg="gray.50"
            borderRadius="sm"
            shadow="xs"
            cursor="pointer"
            _hover={{ bg: "gray.100" }}
            onClick={() => {
              setSelectedRegistration(reg);
              onModalOpen();
            }}
          >
            {user.role === "superadmin" && (
              <Box onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  size="sm"
                  isChecked={selectedIds.has(reg._id)}
                  onChange={() => toggleSelected(reg._id)}
                />
              </Box>
            )}
            <Box flex="1">
              <Text fontWeight="medium" fontSize="xs">
                {reg.companyName}
              </Text>
              <Text fontSize="2xs" color="gray.600">
                Office: {reg.officerName} | Date: {reg.dateOfIdentification}{" "}
                {reg.time || ""}
              </Text>
            </Box>
          </Flex>
        ))}
      </VStack>
    </>
  )}
</Box>

      </Box>

      {/* 🔹 Modal for full details */}
     <Modal isOpen={isModalOpen} onClose={onModalClose} size="6xl">
        <ModalOverlay />
        <ModalContent
          maxW="90vw"        // responsive width (90% of viewport width)
          maxH="90vh"        // responsive height (90% of viewport height)
          overflowY="auto"   // enable vertical scrolling if content is taller than screen
          p={5}
        >
          <ModalHeader textAlign="center" color="red.500">
            Company Compliance Record
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedRegistration && (
                <Box>
                  {/* Registration Details */}
                  <Text fontSize="lg" fontWeight="bold" mt={2} mb={1} color="red.600">
                    Registration Details
                  </Text>
                  <Text><b>Identification Office:</b> {selectedRegistration.officerName}</Text>
                  <Text><b>Date of Identification:</b> {selectedRegistration.dateOfIdentification}</Text>
                  <Text><b>Company Name:</b> {selectedRegistration.companyName}</Text>
                  <Text><b>Nature of Business:</b> {selectedRegistration.natureOfBusiness}</Text>
                  <Text><b>Address:</b> {selectedRegistration.address}</Text>
                  <Text><b>State:</b> {selectedRegistration.state}</Text>
                  <Text><b>City:</b> {selectedRegistration.city || "N/A"}</Text>
                  <Text><b>Mode of Identification:</b> {selectedRegistration.modeOfIdentification}</Text>
                  <Text><b>Phone:</b> {selectedRegistration.phone || "N/A"}</Text>
                  <Text><b>Email:</b> {selectedRegistration.email || "N/A"}</Text>

                  {/* Photos */}
                  {selectedRegistration.photos && selectedRegistration.photos.length > 0 && (
                    <Link
                      color="blue.600"
                      fontWeight="medium"
                      onClick={() => openLightbox(selectedRegistration.photos!)}
                    >
                      View Photos ({selectedRegistration.photos.length})
                    </Link>
                  )}

                  {/* Letters */}
                  {selectedRegistration.letters && selectedRegistration.letters.length > 0 && (
                    <Box mt={4}>
                      <Text fontSize="lg" fontWeight="bold" mb={2} color="blue.600">
                        Letters
                      </Text>
                      {selectedRegistration.letters.map((letter) => (
                        <Box key={letter._id} p={2} borderWidth="1px" borderRadius="md" mb={2}>
                          <Text><b>Type:</b> {letter.typeOfLetter}</Text>
                          <Text><b>Receiver:</b> {letter.receiverName}</Text>
                          <Text><b>Phone:</b> {letter.phone}</Text>
                          <Text><b>Email:</b> {letter.email}</Text>
                          <Text><b>Date:</b> {letter.dateOfReporting}</Text>
                        </Box>
                      ))}
                    </Box>
                  )}

                 {/* Sanctions */}
{selectedRegistration.sanctions && selectedRegistration.sanctions.length > 0 && (
  <Box mt={4}>
    <Text fontSize="lg" fontWeight="bold" mb={2} color="orange.600">
      Sanctions
    </Text>
    {selectedRegistration.sanctions.map((sanction) => (
      <Box key={sanction._id} p={2} borderWidth="1px" borderRadius="md" mb={2}>
        <Text><b>Nature of Business:</b> {sanction.natureOfBusiness}</Text>
        <Text><b>Amount:</b> ₦{sanction.amount?.toLocaleString()}</Text>
        <Text><b>Mode of Payment:</b> {sanction.modeOfPayment}</Text>
      </Box>
    ))}
  </Box>
)}

{selectedRegistration.violations && selectedRegistration.violations.length > 0 && (
  <Box mt={4}>
    <Text fontSize="lg" fontWeight="bold" mb={2} color="orange.700">
      Violations
    </Text>
    {selectedRegistration.violations.map((violation) =>
      violationCards(violation).map((card, idx) => (
        <Box key={`${violation._id}-${idx}`} p={2} borderWidth="1px" borderRadius="md" mb={2}>
          {card.isFirst && (
            <Text><b>Amount Sanctioned:</b> ₦{violation.amountSanctioned?.toLocaleString()}</Text>
          )}
          {card.payment && (
            <Text><b>Payment:</b> ₦{card.payment.amount.toLocaleString()}</Text>
          )}
          <Text>
            <b>Balance:</b> ₦{card.balance.toLocaleString()}
          </Text>
        </Box>
      ))
    )}
  </Box>
)}

                  {/* On-Site Inspections */}
                  {selectedRegistration.onSiteInspections && selectedRegistration.onSiteInspections.length > 0 && (
                    <Box mt={4}>
                      <Text fontSize="lg" fontWeight="bold" mb={2} color="green.600">
                        On-Site Inspections
                      </Text>
                      {selectedRegistration.onSiteInspections.map((insp) => (
                        <Box key={insp._id} p={3} borderWidth="1px" borderRadius="md" mb={3} overflowX="auto">
                          {insp.obligations && insp.obligations.length > 0 && (
                            <Box mb={3}>
                              <Text fontWeight="bold" mb={1}>Compliance with the Law & Regulation</Text>
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
                                      <Td>{o.complianceStatus || "N/A"}</Td>
                                      <Td>{o.remark || "N/A"}</Td>
                                    </Tr>
                                  ))}
                                </Tbody>
                              </Table>
                            </Box>
                          )}

                          {insp.orgProfile && insp.orgProfile.length > 0 && (
                            <Box mb={3}>
                              <Text fontWeight="bold" mb={1}>Organization Profile</Text>
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
                                      <Td>{p.remark || "N/A"}</Td>
                                    </Tr>
                                  ))}
                                </Tbody>
                              </Table>
                            </Box>
                          )}

                          <Text>
                            <b>Risk Level:</b> {insp.riskClassification?.level || "N/A"}
                          </Text>
                          <Text mb={3}>
                            <b>Vulnerabilities:</b> {insp.riskClassification?.vulnerabilities || "N/A"}
                          </Text>

                          {insp.attendance && insp.attendance.length > 0 && (
                            <Box mb={2}>
                              <Text fontWeight="bold" mb={1}>Attendance</Text>
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
                                      <Td>{a.name || "N/A"}</Td>
                                      <Td>{a.organization || "N/A"}</Td>
                                      <Td>{a.position || "N/A"}</Td>
                                      <Td>{a.phone || "N/A"}</Td>
                                    </Tr>
                                  ))}
                                </Tbody>
                              </Table>
                            </Box>
                          )}
                        </Box>
                      ))}
                    </Box>
                  )}

                  {/* Trainings */}
                  {selectedRegistration.trainings && selectedRegistration.trainings.length > 0 && (
                    <Box mt={4}>
                      <Text fontSize="lg" fontWeight="bold" mb={2} color="teal.600">
                        Trainings
                      </Text>
                      {selectedRegistration.trainings.map((t) => (
                        <Box key={t._id} p={2} borderWidth="1px" borderRadius="md" mb={2}>
                          <Text><b>Topic:</b> {t.topic}</Text>
                          <Text><b>Date:</b> {t.date}</Text>
                          <Text><b>Facilitator:</b> {t.facilitator}</Text>
                          <Text><b>Participants:</b> {t.participants}</Text>
                        </Box>
                      ))}
                    </Box>
                  )}





                 {/* Off-Site Inspections */}
{selectedRegistration.offSiteInspections && selectedRegistration.offSiteInspections.length > 0 && (
  <Box mt={4}>
    <Text fontSize="lg" fontWeight="bold" mb={2} color="purple.600">
      Off-Site Inspections
    </Text>

    {selectedRegistration.offSiteInspections.map((insp) => (
      <Box
        key={insp._id}
        p={2}
        borderWidth="1px"
        borderRadius="md"
        mb={3}
      >
        <InspectionField label="Examination Date" value={insp.examinationDate || "N/A"} />
        <InspectionField label="Introduction" value={insp.introduction || "N/A"} />
        <InspectionField label="Contact" value={insp.contact || "N/A"} />
        <InspectionField label="Office Address" value={insp.officeAddress || "N/A"} />
        <InspectionField label="Telephone" value={insp.telephone || "N/A"} />
        <InspectionField label="Sources" value={insp.sources || "N/A"} />
        <InspectionField label="Compliance Status" value={insp.complianceStatus || "N/A"} />
        <InspectionField label="RC" value={insp.rc || "N/A"} />
        <InspectionField label="SCUML" value={insp.scuml || "N/A"} />
        <InspectionField label="TIN" value={insp.tin || "N/A"} />
        <InspectionField label="Transaction Reporting" value={insp.transactionReporting || "N/A"} />

        {/* Shareholders */}
        {Array.isArray(insp.shareholders) && insp.shareholders.length > 0 && (
          <Box mt={2} mb={1.5}>
            <Text fontWeight="bold" mb={2}>Shareholders / Directors</Text>
            <Box overflowX="auto">
              <Table size="sm" variant="simple">
                <Thead>
                  <Tr>
                    <Th>S/N</Th>
                    <Th>Name</Th>
                    <Th>PEP Status</Th>
                    <Th>Non Resident Nigerian</Th>
                    <Th>Foreigner</Th>
                    <Th>SANC. List</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {insp.shareholders.map((s, idx) => (
                    <Tr key={idx}>
                      <Td>{idx + 1}</Td>
                      <Td>{s.name || "N/A"}</Td>
                      <Td>{s.pepStatus || "N/A"}</Td>
                      <Td>{s.nonResident || "N/A"}</Td>
                      <Td>{s.foreigner || "N/A"}</Td>
                      <Td>{s.sanctionList || "N/A"}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </Box>
        )}

   {/* ✅ Politically exposed persons */}
<InspectionField
  label="Politically Exposed"
  value={
    Array.isArray(insp.politicallyExposed) && insp.politicallyExposed.length > 0
      ? insp.politicallyExposed.map((p) => p.name).join(", ")
      : typeof insp.politicallyExposed === "string" && insp.politicallyExposed.trim() !== ""
        ? insp.politicallyExposed
        : "N/A"
  }
/>

{/* ✅ Affiliates */}
<InspectionField
  label="Affiliates"
  value={
    Array.isArray(insp.affiliates) && insp.affiliates.length > 0
      ? insp.affiliates.map((a) => a.name).join(", ")
      : typeof insp.affiliates === "string" && insp.affiliates.trim() !== ""
        ? insp.affiliates
        : "N/A"
  }
/>

        <InspectionField label="Legal Issues" value={insp.legalIssues || "N/A"} />
        <InspectionField
          label="Locations"
          value={Array.isArray(insp.locations) ? insp.locations.join(", ") : insp.locations || "N/A"}
        />
        <InspectionField
          label="Products"
          value={Array.isArray(insp.products) ? insp.products.join(", ") : insp.products || "N/A"}
        />
        <InspectionField label="Recommendation" value={insp.recommendation || "N/A"} />
      </Box>
    ))}
  </Box>
)}














                </Box>
              )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* 🔹 Photo Lightbox */}
      {lightboxPhotos && (
        <PhotoLightbox
          photos={lightboxPhotos}
          index={lightboxIndex}
          onClose={() => setLightboxPhotos(null)}
          onPrev={() => setLightboxIndex((i) => (i - 1 + lightboxPhotos.length) % lightboxPhotos.length)}
          onNext={() => setLightboxIndex((i) => (i + 1) % lightboxPhotos.length)}
        />
      )}
    </Box>
  );
}

