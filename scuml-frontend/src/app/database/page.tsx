"use client";

import { useEffect, useState, useRef, ReactNode } from "react";
import axios from "axios";
import {
  Box,
  Input,
  Select,
  Textarea,
  VStack,
  Text,
  Link,
  Image,
  Spinner,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  IconButton,
  Button,
  useDisclosure,
  HStack,
  Flex,
  Heading,   // ✅ add this
  useToast,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from "@chakra-ui/react";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ChevronLeftIcon, ChevronRightIcon } from "@chakra-ui/icons";
import { LGA_BY_STATE } from "@/lib/nigeriaLocations";
import { NATURE_OF_BUSINESS_OPTIONS } from "@/lib/natureOfBusiness";

// 🔹 Types
interface Letter {
  _id: string;
  typeOfLetter: string;
  receiverName?: string;
  phone?: string;
  email?: string;
  remark?: string;
  photos?: string[];
  dateOfReporting?: string;
  createdBy: string;
}

interface Sanction {
  _id: string;
  natureOfBusiness: string;
  amount: number;
  modeOfPayment: string;
  receiptUrl?: string;
  createdBy: string;
}

interface Violation {
  _id: string;
  amountSanctioned: number;
  amountPaid: number;
  payments?: { amount: number; date: string; enteredBy?: string }[];
  createdBy: string;
  createdAt?: string;
}

// Violations may carry a chunk of amountPaid from before payment history was
// tracked (or before a given payment was recorded individually). Whatever
// portion of amountPaid isn't accounted for by the recorded payments is
// shown as one implied entry dated at creation, attributed to whoever
// created the violation record (the best information available for it).
function violationPayments(v: Violation): { amount: number; date: string; enteredBy: string }[] {
  const recorded = v.payments || [];
  const recordedSum = recorded.reduce((sum, p) => sum + p.amount, 0);
  const legacy = v.amountPaid - recordedSum;
  const result: { amount: number; date: string; enteredBy: string }[] = [];
  if (legacy > 0) result.push({ amount: legacy, date: v.createdAt || '', enteredBy: v.createdBy });
  return [...result, ...recorded.map((p) => ({ ...p, enteredBy: p.enteredBy || v.createdBy }))];
}

// One card per payment — the first card also carries the original sanctioned
// amount (matching how a single violation entry originally looked), each
// card shows the running balance left after that payment was subtracted and
// the username of whoever actually recorded that specific payment.
type ViolationCard = {
  isFirst: boolean;
  payment: { amount: number; date: string; enteredBy: string } | null;
  balance: number;
  enteredBy: string;
};
function violationCards(v: Violation): ViolationCard[] {
  const payments = violationPayments(v);
  if (payments.length === 0) {
    return [{ isFirst: true, payment: null, balance: v.amountSanctioned, enteredBy: v.createdBy }];
  }
  let running = v.amountSanctioned;
  return payments.map((p, idx) => {
    running -= p.amount;
    return { isFirst: idx === 0, payment: p, balance: running, enteredBy: p.enteredBy };
  });
}

interface Shareholder {
  name: string;
  pepStatus?: string;
  nonResident?: string;
  foreigner?: string;
  sanctionList?: string;
}



interface OffSiteInspection {
  _id: string;
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
  locations?: string;
  products?: string;
  recommendation?: string;
  createdBy: string;
}



interface Obligation {
  obligation: string;
  complianceStatus: string;
  remark: string;
}

interface OrgProfile {
  desc: string;
  remark: string;
}

interface RiskClassification {
  level: "low" | "medium" | "high";
  vulnerabilities: string;
}

interface Attendance {
  name: string;
  organization: string;
  position: string;
  phone: string;
  sign: string;
}

interface OnSiteInspection {
  _id: string;
  obligations: Obligation[];
  orgProfile: OrgProfile[];
  riskClassification?: RiskClassification;   // ✅ now defined
  attendance: Attendance[];
  createdBy?: string;

  // backward compatibility with old schema
  riskLevel?: "Low" | "Medium" | "High"; 
}




interface Training {
  _id: string;
  company: string;     // company ID ref
  date: string;        // Date of training
  facilitator: string; // Name of facilitator
  participants: number;// No. of participants
  topic: string;       // Topic of training
  createdBy: string;
}







interface Registration {
  _id: string;
  serialNumber?: string;
  companyName: string;
  officerName: string;
  dateOfIdentification?: string;
  natureOfBusiness?: string;
  companySize?: string;
  modeOfIdentification?: string;
  address: string;
  state?: string;
  city?: string;
  email: string;
  phone: string;
  photos?: string[];
  createdBy: string;
  createdAt: string;
  letters: Letter[];
  sanctions: Sanction[];
  offSiteInspections: OffSiteInspection[]; // ✅ added
  onSiteInspections: OnSiteInspection[]; 
  trainings: Training[];
  violations: Violation[];
}

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

export default function DatabasePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // 🔒 TOTP verification state
  // null = checking, true = allowed, false = not allowed (we redirect)
  const [isVerified, setIsVerified] = useState<boolean | null>(null);

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Pick<Registration, "_id" | "companyName">[]
  >([]);
  const [selectedCompany, setSelectedCompany] = useState<Registration | null>(
    null
  );

  // CSRF token state
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  const [isClearOpen, setIsClearOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  // Single-record delete confirmation
  const [pendingDelete, setPendingDelete] = useState<{
    type: "letter" | "sanction" | "inspection" | "onsite" | "training" | "violation";
    id: string;
  } | null>(null);
  const {
    isOpen: isDeleteConfirmOpen,
    onOpen: onDeleteConfirmOpen,
    onClose: onDeleteConfirmClose,
  } = useDisclosure();
  const cancelDeleteRef = useRef<HTMLButtonElement | null>(null);

  // 🔹 Photo lightbox
  const [lightboxPhotos, setLightboxPhotos] = useState<string[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const openLightbox = (photos: string[]) => {
    setLightboxPhotos(photos);
    setLightboxIndex(0);
  };

  const toast = useToast();

  const { isOpen, onOpen, onClose } = useDisclosure();

  // Edit modal state
  const {
    isOpen: isEditOpen,
    onOpen: onEditOpen,
    onClose: onEditClose,
  } = useDisclosure();
  const [editItem, setEditItem] = useState<
  Letter | Sanction | OffSiteInspection | OnSiteInspection | Training | Violation | Registration | null
>(null);

const [editType, setEditType] = useState<
  "letter" | "sanction" | "inspection" | "onsite" | "training" | "violation" | "registration" | null
>(null);


  const companyRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // -------------------------
  // 🔸 TOTP check — DISABLED. Kept commented out (not deleted) so it can be
  // re-enabled later if needed. Access is now gated solely by the superadmin
  // role check below.
  // -------------------------
  // useEffect(() => {
  //   const checkTOTP = async () => {
  //     try {
  //      const res = await axios.get(
  //         `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin/protected/register`,
  //         { withCredentials: true }
  //       );

  //       if (res.status === 200 && res.data?.message) {
  //         setIsVerified(true);
  //       } else {
  //         setIsVerified(false);
  //         router.replace("/database-auth");
  //       }
  //     } catch (_err) {
  //       // not verified or error -> redirect to auth page
  //       setIsVerified(false);
  //       router.replace("/database-auth");
  //     }
  //   };

  //   checkTOTP();
  //   // run once on mount
  // }, [router]);
  useEffect(() => {
    setIsVerified(true);
  }, []);

  // 🔹 Only a super admin may view the admin database, even with a valid TOTP code
  useEffect(() => {
    if (isVerified && !authLoading && user && user.role !== "superadmin") {
      router.replace("/");
    }
  }, [isVerified, authLoading, user, router]);

  // 🔹 Fetch CSRF token on mount (always safe)
  useEffect(() => {
    const fetchCsrf = async () => {
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
    fetchCsrf();
  }, []);

  // 🔹 Fetch all registrations — run only after verification
  useEffect(() => {
    if (isVerified !== true) {
      // don't fetch until verified; also ensures hooks ordering stays consistent
      return;
    }

    const fetchRegs = async () => {
      try {
        const res = await axios.get<Registration[]>(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/registrations`,
          { withCredentials: true }
        );
        setRegistrations(res.data || []);
      } catch (err) {
        console.error("❌ Error fetching registrations:", err);
        toast({ title: "Failed to load records.", status: "error" });
      } finally {
        setLoading(false);
      }
    };
    fetchRegs();
    // We intentionally do NOT add `toast` to dependencies beyond this point to avoid reruns;
    // toast is stable from Chakra and this runs after verification once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVerified]);

  // While checking TOTP, show spinner (hooks already declared above so no conditional hooks)
  if (isVerified === null || authLoading) {
    return (
      <Box minH="100vh" display="flex" justifyContent="center" alignItems="center">
        <Spinner size="lg" />
      </Box>
    );
  }

  // if not verified we already redirected in the effect; render nothing here
  if (!isVerified) return null;

  // non-superadmins are redirected in the effect above; render nothing here
  if (!user || user.role !== "superadmin") return null;

  // -------------------------
  // Helper to build headers with CSRF
  // -------------------------
  const headersWithCsrf = () => ({
    withCredentials: true,
    headers: { "X-CSRF-Token": csrfToken || "" },
  });

  // 🔹 Search API
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await axios.get<
        Pick<Registration, "_id" | "companyName">[]
      >(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/registrations/search?query=${query}`,
        { withCredentials: true }
      );
      setSearchResults(res.data || []);
    } catch (err) {
      console.error("❌ Error searching:", err);
      toast({ title: "Search failed.", status: "error" });
    }
  };

  // 🔹 Scroll to company + open details
  const handleSelectCompany = (companyId: string) => {
    const ref = companyRefs.current[companyId];
    if (ref) {
      ref.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const company = registrations.find((r) => r._id === companyId) || null;
    if (company) {
      setSelectedCompany(company);
      onOpen();
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  // 🔹 Delete (asks for confirmation first)
  const handleDelete = (
    type: "letter" | "sanction" | "inspection" | "onsite" | "training" | "violation",
    id: string
  ) => {
    setPendingDelete({ type, id });
    onDeleteConfirmOpen();
  };

  const performDelete = async () => {
    if (!pendingDelete) return;
    const { type, id } = pendingDelete;
  try {
    await axios.delete(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/${getApiPath(type)}/${id}`,
      headersWithCsrf()
    );

    const newRegs = registrations.map((r) => {
      if (r._id !== selectedCompany?._id) return r;

      if (type === "letter") {
        return { ...r, letters: r.letters.filter((l) => l._id !== id) };
      }

      if (type === "sanction") {
        return { ...r, sanctions: r.sanctions.filter((s) => s._id !== id) };
      }

      if (type === "inspection") {
        return {
          ...r,
          offSiteInspections: r.offSiteInspections.filter((i) => i._id !== id),
        };
      }

      if (type === "onsite") {
        return {
          ...r,
          onSiteInspections: r.onSiteInspections.filter((o) => o._id !== id),
        };
      }

      if (type === "training") {
        return {
          ...r,
          trainings: r.trainings.filter((t) => t._id !== id),
        };
      }

      if (type === "violation") {
        return {
          ...r,
          violations: r.violations.filter((v) => v._id !== id),
        };
      }

      return r;
    });

    setRegistrations(newRegs);
    setSelectedCompany(
      newRegs.find((r) => r._id === selectedCompany?._id) || null
    );

    toast({ title: `${type} deleted.`, status: "success" });
  } catch (err) {
    console.error(`❌ Error deleting ${type}:`, err);
    toast({ title: `Failed to delete ${type}.`, status: "error" });
  } finally {
    setPendingDelete(null);
    onDeleteConfirmClose();
  }
};

// 🔹 Edit handler
const handleEdit = (
  type:
    | "letter"
    | "sanction"
    | "inspection"
    | "onsite"
    | "training"
    | "violation"
    | "registration",
  item: Letter | Sanction | OffSiteInspection | OnSiteInspection | Training | Violation | Registration
) => {
  setEditType(type);
  setEditItem(item);
  onEditOpen();
};

// 🔹 Map frontend type to backend API path
const getApiPath = (
  type: "letter" | "sanction" | "inspection" | "onsite" | "training" | "violation" | "registration"
) => {
  if (type === "inspection") return "offsite-inspections";
  if (type === "onsite") return "on-site-inspections";
  if (type === "training") return "trainings";
  if (type === "registration") return "registrations";
  return `${type}s`; // letters, sanctions
};

// 🔹 Save edit
const handleSaveEdit = async () => {
  if (!editItem || !editType) return;

  try {
    // Use the server's returned document (not the local editItem) — the
    // backend stamps createdBy with whoever just made this edit, and the
    // local editItem never carried that field, so it would otherwise revert
    // the "Entered by" display back to the stale pre-edit value.
    const res = await axios.put(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/${getApiPath(editType)}/${editItem._id}`,
      editItem,
      headersWithCsrf()
    );
    const updated = res.data;

    const newRegs = registrations.map((r) => {
      if (r._id !== selectedCompany?._id) return r;

      if (editType === "letter") {
        return {
          ...r,
          letters: r.letters.map((l) =>
            l._id === editItem._id ? (updated as Letter) : l
          ),
        };
      }

      if (editType === "sanction") {
        return {
          ...r,
          sanctions: r.sanctions.map((s) =>
            s._id === editItem._id ? (updated as Sanction) : s
          ),
        };
      }

      if (editType === "inspection") {
        return {
          ...r,
          offSiteInspections: r.offSiteInspections.map((i) =>
            i._id === editItem._id ? (updated as OffSiteInspection) : i
          ),
        };
      }

      if (editType === "onsite") {
        return {
          ...r,
          onSiteInspections: r.onSiteInspections.map((o) =>
            o._id === editItem._id ? (updated as OnSiteInspection) : o
          ),
        };
      }

      if (editType === "training") {
        return {
          ...r,
          trainings: r.trainings.map((t) =>
            t._id === editItem._id ? (updated as Training) : t
          ),
        };
      }

      if (editType === "violation") {
        return {
          ...r,
          violations: r.violations.map((v) =>
            v._id === editItem._id ? (updated as Violation) : v
          ),
        };
      }

      if (editType === "registration") {
        // The PUT /registrations/:id response has no populated sub-arrays
        // (letters/sanctions/etc come back as raw ids, not objects) — only
        // take the registration's own scalar fields from it, keep r's
        // already-populated arrays as they are.
        const u = updated as Registration;
        return {
          ...r,
          officerName: u.officerName,
          dateOfIdentification: u.dateOfIdentification,
          companyName: u.companyName,
          natureOfBusiness: u.natureOfBusiness,
          companySize: u.companySize,
          address: u.address,
          state: u.state,
          city: u.city,
          modeOfIdentification: u.modeOfIdentification,
          phone: u.phone,
          email: u.email,
        };
      }

      return r;
    });

    setRegistrations(newRegs);
    setSelectedCompany(
      newRegs.find((r) => r._id === selectedCompany?._id) || null
    );

    toast({ title: `${editType} updated.`, status: "success" });
    onEditClose();
  } catch (err) {
    console.error(`❌ Error updating ${editType}:`, err);
    toast({ title: `Failed to update ${editType}.`, status: "error" });
  }
};



  // 🔹 Clear all data
  const handleClearAll = async () => {
    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin/clear-all`,
        headersWithCsrf()
      );
      setRegistrations([]);
      setSelectedCompany(null);
      toast({ title: "All records cleared.", status: "warning" });
    } catch (err) {
      console.error("❌ Error clearing all:", err);
      toast({ title: "Failed to clear records.", status: "error" });
    } finally {
      setIsClearOpen(false);
    }
  };

  return (
    <Box p={6}>
      {/* 🔹 Header */}
      <Text fontSize="lg" fontWeight="semibold" mb={3}>
        Total Compliance Records: {registrations.length}
      </Text>

      {/* 🔍 Search Bar */}
      <Box mb={4} position="relative">
        <Input
          placeholder="Search company..."
          size="sm"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
        />
        {searchResults.length > 0 && (
          <Box
            position="absolute"
            bg="white"
            boxShadow="md"
            w="100%"
            zIndex="10"
            borderRadius="md"
          >
            {searchResults.map((c) => (
              <Box
                key={c._id}
                px={4}
                py={2}
                _hover={{ bg: "gray.100", cursor: "pointer" }}
                onClick={() => handleSelectCompany(c._id)}
              >
                {c.companyName}
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* 🔹 Registrations List */}
      {loading ? (
        <Spinner />
      ) : (
        <VStack align="stretch" gap={2}>
          {registrations.map((reg) => (
            <Box
              key={reg._id}
              ref={(el) => {
                companyRefs.current[reg._id] = el;
              }}
              p={3}
              borderWidth="1px"
              borderRadius="md"
              onClick={() => handleSelectCompany(reg._id)}
              _hover={{ bg: "gray.50", cursor: "pointer" }}
            >
              <Text fontWeight="bold" fontSize="sm">
                {reg.serialNumber ? `${reg.serialNumber} — ` : ""}{reg.companyName}
              </Text>
              <Text fontSize="xs">{reg.officerName}</Text>
              <Text fontSize="xs" color="gray.500">
                {new Date(reg.createdAt).toLocaleDateString()}
              </Text>
            </Box>
          ))}
        </VStack>
      )}

      {/* 🔹 Modal */}
      {selectedCompany && (
        <Modal isOpen={isOpen} onClose={onClose} size="4xl">
          <ModalOverlay />
          <ModalContent maxW={{ base: "94vw", md: "800px" }} mx="auto" maxH="90vh" overflowY="auto">
            <ModalHeader fontSize="lg">{selectedCompany.companyName}</ModalHeader>
            <ModalBody>
              <VStack align="start" spacing={4} fontSize="sm">
                {/* 📌 Registration Info */}
                <Box w="full">
                  <HStack justify="space-between">
                    <Text fontWeight="bold">Registration</Text>
                    <Button
                      size="xs"
                      colorScheme="blue"
                      onClick={() => handleEdit("registration", selectedCompany)}
                    >
                      Edit
                    </Button>
                  </HStack>
                  <Text>Serial Number: {selectedCompany.serialNumber || "N/A"}</Text>
                  <Text>Identification Officer: {selectedCompany.officerName}</Text>
                  <Text>Date of Identification: {selectedCompany.dateOfIdentification || "N/A"}</Text>
                  <Text>Company Name: {selectedCompany.companyName}</Text>
                  <Text>Nature of Business: {selectedCompany.natureOfBusiness || "N/A"}</Text>
                  <Text>Company Size: {selectedCompany.companySize || "N/A"}</Text>
                  <Text>Address: {selectedCompany.address}</Text>
                  <Text>State: {selectedCompany.state || "N/A"}</Text>
                  <Text>City: {selectedCompany.city || "N/A"}</Text>
                  <Text>Mode of Identification: {selectedCompany.modeOfIdentification || "N/A"}</Text>
                  <Text>Phone: {selectedCompany.phone || "N/A"}</Text>
                  <Text>Email: {selectedCompany.email || "N/A"}</Text>

                  {selectedCompany.photos && selectedCompany.photos.length > 0 && (
                    <Link
                      color="blue.600"
                      fontWeight="medium"
                      onClick={() => openLightbox(selectedCompany.photos!)}
                    >
                      View Photos ({selectedCompany.photos.length})
                    </Link>
                  )}

                  <Text fontSize="xs" color="gray.500">
                    Entered by: {selectedCompany.createdBy}
                  </Text>
                </Box>

                {/* 📌 Letters */}
                <Box w="full">
                  <Text fontWeight="bold">Letters</Text>
                  {selectedCompany.letters.length > 0 ? (
                    selectedCompany.letters.map((letter) => (
                      <Flex
                        key={letter._id}
                        p={3}
                        borderWidth="1px"
                        my={2}
                        justify="space-between"
                        align="center"
                      >
                        <Box>
                          <Text>Type: {letter.typeOfLetter}</Text>
                          <Text>Contact Person: {letter.receiverName}</Text>
                          <Text>Phone: {letter.phone || "N/A"}</Text>
                          <Text>Email: {letter.email || "N/A"}</Text>
                          <Text>Appointment Remark: {letter.remark || "N/A"}</Text>
                          <Text>Date: {letter.dateOfReporting}</Text>
                          <Text fontSize="xs" color="gray.500">
                            Entered by: {letter.createdBy}
                          </Text>
                        </Box>
                        <HStack>
                          <Button
                            size="xs"
                            colorScheme="blue"
                            onClick={() => handleEdit("letter", letter)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="xs"
                            colorScheme="red"
                            onClick={() => handleDelete("letter", letter._id)}
                          >
                            Delete
                          </Button>
                        </HStack>
                      </Flex>
                    ))
                  ) : (
                    <Text>No letters</Text>
                  )}
                </Box>

                {/* 📌 Sanctions */}
                <Box w="full">
                  <Text fontWeight="bold">Sanctions</Text>
                  {selectedCompany.sanctions.length > 0 ? (
                    selectedCompany.sanctions.map((s) => (
                      <Flex
                        key={s._id}
                        p={3}
                        borderWidth="1px"
                        my={2}
                        justify="space-between"
                        align="center"
                      >
                        <Box>
                          <Text>Nature: {s.natureOfBusiness}</Text>
                          <Text>Amount: ₦{s.amount.toLocaleString()}</Text>
                          <Text>Payment: {s.modeOfPayment}</Text>
                          {s.receiptUrl && (
                            <Link
                              href={s.receiptUrl}
                              isExternal
                              color="blue.600"
                              fontSize="sm"
                              fontWeight="medium"
                            >
                              View Receipt
                            </Link>
                          )}
                          <Text fontSize="xs" color="gray.500">
                            Entered by: {s.createdBy}
                          </Text>
                        </Box>
                        <HStack>
                          <Button
                            size="xs"
                            colorScheme="blue"
                            onClick={() => handleEdit("sanction", s)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="xs"
                            colorScheme="red"
                            onClick={() => handleDelete("sanction", s._id)}
                          >
                            Delete
                          </Button>
                        </HStack>
                      </Flex>
                    ))
                  ) : (
                    <Text>No sanctions</Text>
                  )}
                </Box>

                {/* 📌 Violations */}
                <Box w="full">
                  <Text fontWeight="bold">Violations</Text>
                  {selectedCompany.violations.length > 0 ? (
                    selectedCompany.violations.map((v) => {
                      const cards = violationCards(v);
                      return cards.map((card, idx) => (
                        <Flex
                          key={`${v._id}-${idx}`}
                          p={3}
                          borderWidth="1px"
                          my={2}
                          justify="space-between"
                          align="center"
                        >
                          <Box>
                            {card.isFirst && (
                              <Text>Amount Sanctioned: ₦{v.amountSanctioned.toLocaleString()}</Text>
                            )}
                            {card.payment && (
                              <Text>Payment: ₦{card.payment.amount.toLocaleString()}</Text>
                            )}
                            <Text fontWeight="bold">
                              Balance: ₦{card.balance.toLocaleString()}
                            </Text>
                            {card.payment?.date && (
                              <Text fontSize="xs" color="gray.500">
                                {new Date(card.payment.date).toLocaleString()}
                              </Text>
                            )}
                            <Text fontSize="xs" color="gray.500">
                              Entered by: {card.enteredBy}
                            </Text>
                          </Box>
                          {idx === cards.length - 1 && (
                            <HStack>
                              <Button
                                size="xs"
                                colorScheme="blue"
                                onClick={() => handleEdit("violation", v)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="xs"
                                colorScheme="red"
                                onClick={() => handleDelete("violation", v._id)}
                              >
                                Delete
                              </Button>
                            </HStack>
                          )}
                        </Flex>
                      ));
                    })
                  ) : (
                    <Text>No violations</Text>
                  )}
                </Box>

 {/* 📌 Off-Site Inspections */}
<Box w="full">
  <Text fontWeight="bold" mb={2}>Off-Site Inspections</Text>

  {selectedCompany.offSiteInspections.length > 0 ? (
    selectedCompany.offSiteInspections.map((insp) => (
      <Flex
        key={insp._id}
        p={3}
        borderWidth="1px"
        my={2}
        direction="column"
        gap={2}
        borderRadius="md"
      >
        <Box>
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

          {/* ✅ Shareholders / Directors */}
          <Box mt={2} mb={1.5}>
            <Text fontWeight="bold" mb={2}>Shareholders / Directors</Text>

            {Array.isArray(insp.shareholders) && insp.shareholders.length > 0 ? (
              <Box overflowX="auto"> {/* ✅ make table scrollable */}
                <Table size="sm" variant="simple">
                  <Thead>
                    <Tr>
                      <Th minW="50px">S/N</Th>
                      <Th minW={{ base: "200px", md: "250px" }}>Name</Th>
                      <Th minW="150px">PEP Status</Th>
                      <Th minW="180px">Non Resident Nigerian</Th>
                      <Th minW="120px">Foreigner</Th>
                      <Th minW="120px">SANC. List</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {insp.shareholders?.map((s: Shareholder, idx: number) => (
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
            ) : (
              <Text>N/A</Text>
            )}
          </Box>

          {/* ✅ Politically exposed persons */}
          <InspectionField
            label="Politically Exposed"
            value={
              insp.politicallyExposed && insp.politicallyExposed.trim() !== ""
                ? insp.politicallyExposed
                : "N/A"
            }
          />

          {/* ✅ Affiliates */}
          <InspectionField
            label="Affiliates"
            value={
              insp.affiliates && insp.affiliates.trim() !== ""
                ? insp.affiliates
                : "N/A"
            }
          />

          <InspectionField label="Legal Issues" value={insp.legalIssues || "N/A"} />

          {/* ✅ Locations */}
          <InspectionField
            label="Locations"
            value={
              Array.isArray(insp.locations) && insp.locations.length > 0
                ? insp.locations.join(", ")
                : insp.locations || "N/A"
            }
          />

          {/* ✅ Products */}
          <InspectionField
            label="Products"
            value={
              Array.isArray(insp.products) && insp.products.length > 0
                ? insp.products.join(", ")
                : insp.products || "N/A"
            }
          />

          <InspectionField label="Recommendation" value={insp.recommendation || "N/A"} />

          <Text fontSize="xs" color="gray.500" mt={2}>
            Entered by: {insp.createdBy || "N/A"}
          </Text>
        </Box>

        {/* Action buttons (edit & delete) */}
        <Flex gap={2} mt={2}>
          <Button
            size="sm"
            colorScheme="yellow"
            onClick={() => handleEdit("inspection", insp)}
          >
            Edit
          </Button>
          <Button
            size="sm"
            colorScheme="red"
            onClick={() => handleDelete("inspection", insp._id)}
          >
            Delete
          </Button>
        </Flex>
      </Flex>
    ))
  ) : (
    <Text>No inspections</Text>
  )}
</Box>




{/* On-Site Inspections */}
<Box mt={6}>
  <Heading size="md" mb={2}>On-Site Inspections</Heading>

  {selectedCompany?.onSiteInspections && selectedCompany.onSiteInspections.length > 0 ? (
    selectedCompany.onSiteInspections.map((insp: OnSiteInspection) => (
      <Box
        key={insp._id}
        borderWidth="1px"
        p={4}
        rounded="md"
        mb={4}
        overflowX="auto"
      >
        {/* Compliance / Obligations */}
        <Heading size="sm" mb={2}>Compliance with the Law & Regulation</Heading>
        <Table size="sm" mb={4}>
          <Thead>
            <Tr>
              <Th>Obligation</Th>
              <Th>Compliance Status</Th>
              <Th>Remark</Th>
            </Tr>
          </Thead>
          <Tbody>
            {insp.obligations?.map((o: Obligation, idx: number) => (
              <Tr key={idx}>
                <Td>{o.obligation}</Td>
                <Td>{o.complianceStatus || ""}</Td>
                <Td>{o.remark || ""}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>

        {/* Organization Profile */}
        <Heading size="sm" mb={2}>Organization Profile</Heading>
        <Table size="sm" mb={4}>
          <Thead>
            <Tr>
              <Th>Description</Th>
              <Th>Remark</Th>
            </Tr>
          </Thead>
          <Tbody>
            {insp.orgProfile?.map((p: OrgProfile, idx: number) => (
              <Tr key={idx}>
                <Td>{p.desc}</Td>
                <Td>{p.remark || ""}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>

        {/* Risk Classification */}
        <Heading size="sm" mb={2}>Money Laundering Risk Classification</Heading>
        <Text><b>Level:</b> {insp.riskClassification?.level || insp.riskLevel || "N/A"}</Text>
        <Text><b>Vulnerabilities:</b> {insp.riskClassification?.vulnerabilities || "N/A"}</Text>


        {/* Attendance */}
        <Heading size="sm" mb={2} mt={4}>Attendance</Heading>
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Organization</Th>
              <Th>Position</Th>
              <Th>Phone</Th>
              <Th>Sign</Th>
            </Tr>
          </Thead>
          <Tbody>
            {insp.attendance?.map((a: Attendance, idx: number) => (
              <Tr key={idx}>
                <Td>{a.name || ""}</Td>
                <Td>{a.organization || ""}</Td>
                <Td>{a.position || ""}</Td>
                <Td>{a.phone || ""}</Td>
                <Td>{a.sign || ""}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>

       {/* Entered by */}
      <Text mt={2}><b>Entered by:</b> {insp.createdBy || "N/A"}</Text>

      {/* Actions */}
      <Flex gap={2} mt={3}>
        <Button
          size="sm"
          colorScheme="yellow"
          onClick={() => handleEdit("onsite", insp)}
        >
          Edit
        </Button>
        <Button
          size="sm"
          colorScheme="red"
          onClick={() => handleDelete("onsite", insp._id)}
        >
          Delete
        </Button>
        </Flex>
      </Box>
    ))
  ) : (
    <Text>No On-Site Inspections recorded.</Text>
  )}
</Box>




{/* 📌 Trainings */}
<Box w="full" mt={4}>
  <Text fontWeight="bold" fontSize="lg" mb={2}>
    Trainings
  </Text>

  {selectedCompany.trainings.length > 0 ? (
    selectedCompany.trainings.map((t) => (
      <Flex key={t._id} p={3} borderWidth="1px" borderRadius="md" my={2} direction="column">
        <Text fontWeight="semibold">Topic: {t.topic}</Text>
        <Text>Date: {t.date}</Text>
        <Text>Facilitator: {t.facilitator}</Text>
        <Text>Participants: {t.participants}</Text>
        <Text fontSize="xs" color="gray.500">Entered by: {t.createdBy}</Text>

        <HStack justify="flex-end" mt={2}>
          <Button size="xs" colorScheme="blue" onClick={() => handleEdit("training", t)}>Edit</Button>
          <Button size="xs" colorScheme="red" onClick={() => handleDelete("training", t._id)}>Delete</Button>
        </HStack>
      </Flex>
    ))
  ) : (
    <Text>No trainings recorded.</Text>
  )}
</Box>












              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button onClick={onClose} size="sm">
                Close
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}

      {/* 🔹 Edit Modal */}
      {editItem && (
        <Modal isOpen={isEditOpen} onClose={onEditClose} scrollBehavior="inside">
          <ModalOverlay />
          <ModalContent
            maxW={{ base: "94vw", md: editType === "onsite" || editType === "inspection" ? "800px" : "500px" }}
            mx="auto"
            maxH="80vh"
          >
            <ModalHeader>Edit {editType}</ModalHeader>
            <ModalBody overflowY="auto">
              {editType === "registration" && (
                <>
                  <Input
                    placeholder="Identification Officer"
                    value={(editItem as Registration).officerName}
                    onChange={(e) =>
                      setEditItem({ ...(editItem as Registration), officerName: e.target.value })
                    }
                    mb={2}
                  />
                  <Input
                    type="date"
                    placeholder="Date of Identification"
                    value={(editItem as Registration).dateOfIdentification || ""}
                    onChange={(e) =>
                      setEditItem({ ...(editItem as Registration), dateOfIdentification: e.target.value })
                    }
                    mb={2}
                  />
                  <Input
                    placeholder="Company Name"
                    value={(editItem as Registration).companyName}
                    onChange={(e) =>
                      setEditItem({ ...(editItem as Registration), companyName: e.target.value })
                    }
                    mb={2}
                  />
                  <Select
                    placeholder="Select nature of business"
                    value={(editItem as Registration).natureOfBusiness || ""}
                    onChange={(e) =>
                      setEditItem({ ...(editItem as Registration), natureOfBusiness: e.target.value })
                    }
                    mb={2}
                  >
                    {NATURE_OF_BUSINESS_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </Select>
                  <Select
                    placeholder="Select company size"
                    value={(editItem as Registration).companySize || ""}
                    onChange={(e) =>
                      setEditItem({ ...(editItem as Registration), companySize: e.target.value })
                    }
                    mb={2}
                  >
                    <option value="Small">Small</option>
                    <option value="Medium">Medium</option>
                    <option value="Large">Large</option>
                  </Select>
                  <Input
                    placeholder="Address"
                    value={(editItem as Registration).address}
                    onChange={(e) =>
                      setEditItem({ ...(editItem as Registration), address: e.target.value })
                    }
                    mb={2}
                  />
                  <Select
                    placeholder="Select state"
                    value={(editItem as Registration).state || ""}
                    onChange={(e) =>
                      setEditItem({ ...(editItem as Registration), state: e.target.value, city: "" })
                    }
                    mb={2}
                  >
                    <option value="Edo">Edo</option>
                    <option value="Delta">Delta</option>
                    <option value="Ondo">Ondo</option>
                  </Select>
                  <Select
                    placeholder={(editItem as Registration).state ? "Select city" : "Select a state first"}
                    value={(editItem as Registration).city || ""}
                    isDisabled={!(editItem as Registration).state}
                    onChange={(e) =>
                      setEditItem({ ...(editItem as Registration), city: e.target.value })
                    }
                    mb={2}
                  >
                    {(LGA_BY_STATE[(editItem as Registration).state || ""] || []).map((lga) => (
                      <option key={lga} value={lga}>{lga}</option>
                    ))}
                  </Select>
                  <Select
                    placeholder="Select mode of identification"
                    value={(editItem as Registration).modeOfIdentification || ""}
                    onChange={(e) =>
                      setEditItem({ ...(editItem as Registration), modeOfIdentification: e.target.value })
                    }
                    mb={2}
                  >
                    <option value="Physical">Physical</option>
                    <option value="Online">Online</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Newspaper">Newspaper</option>
                  </Select>
                  <Input
                    placeholder="Phone"
                    value={(editItem as Registration).phone || ""}
                    onChange={(e) =>
                      setEditItem({ ...(editItem as Registration), phone: e.target.value })
                    }
                    mb={2}
                  />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={(editItem as Registration).email || ""}
                    onChange={(e) =>
                      setEditItem({ ...(editItem as Registration), email: e.target.value })
                    }
                    mb={2}
                  />
                </>
              )}

              {editType === "letter" && (
                <>
                  <Input
                    placeholder="Type of Letter"
                    value={(editItem as Letter).typeOfLetter}
                    onChange={(e) =>
                      setEditItem({ ...(editItem as Letter), typeOfLetter: e.target.value })
                    }
                    mb={2}
                  />
                  <Input
                    placeholder="Contact Person"
                    value={(editItem as Letter).receiverName || ""}
                    onChange={(e) =>
                      setEditItem({ ...(editItem as Letter), receiverName: e.target.value })
                    }
                    mb={2}
                  />
                  <Input
                    placeholder="Phone"
                    value={(editItem as Letter).phone || ""}
                    onChange={(e) =>
                      setEditItem({ ...(editItem as Letter), phone: e.target.value })
                    }
                    mb={2}
                  />
                  <Input
                    placeholder="Email"
                    value={(editItem as Letter).email || ""}
                    onChange={(e) =>
                      setEditItem({ ...(editItem as Letter), email: e.target.value })
                    }
                    mb={2}
                  />
                  <Textarea
                    placeholder="Appointment Remark (optional)"
                    value={(editItem as Letter).remark || ""}
                    onChange={(e) =>
                      setEditItem({ ...(editItem as Letter), remark: e.target.value })
                    }
                    mb={2}
                  />
                  <Input
                    type="date"
                    placeholder="Appointment Date"
                    value={(editItem as Letter).dateOfReporting || ""}
                    onChange={(e) =>
                      setEditItem({ ...(editItem as Letter), dateOfReporting: e.target.value })
                    }
                    mb={2}
                  />
                </>
              )}

              {editType === "sanction" && (
                <>
                  <Input
                    placeholder="Nature of Business"
                    value={(editItem as Sanction).natureOfBusiness}
                    onChange={(e) =>
                      setEditItem({
                        ...(editItem as Sanction),
                        natureOfBusiness: e.target.value,
                      })
                    }
                    mb={2}
                  />
                  <Input
                    placeholder="Amount"
                    type="number"
                    value={(editItem as Sanction).amount}
                    onChange={(e) =>
                      setEditItem({
                        ...(editItem as Sanction),
                        amount: Number(e.target.value),
                      })
                    }
                    mb={2}
                  />
                  <Input
                    placeholder="Mode of Payment"
                    value={(editItem as Sanction).modeOfPayment}
                    onChange={(e) =>
                      setEditItem({
                        ...(editItem as Sanction),
                        modeOfPayment: e.target.value,
                      })
                    }
                    mb={2}
                  />
                </>
              )}

              {editType === "violation" && (
                <>
                  <Input
                    placeholder="Amount Sanctioned"
                    type="number"
                    value={(editItem as Violation).amountSanctioned}
                    onChange={(e) =>
                      setEditItem({
                        ...(editItem as Violation),
                        amountSanctioned: Number(e.target.value),
                      })
                    }
                    mb={2}
                  />
                  <Input
                    placeholder="Amount Paid"
                    type="number"
                    value={(editItem as Violation).amountPaid}
                    onChange={(e) =>
                      setEditItem({
                        ...(editItem as Violation),
                        amountPaid: Number(e.target.value),
                      })
                    }
                    mb={2}
                  />
                  <Text fontWeight="bold">
                    Balance: ₦
                    {(
                      (editItem as Violation).amountSanctioned - (editItem as Violation).amountPaid
                    ).toLocaleString()}
                  </Text>
                </>
              )}



{editType === "inspection" && (
  <Box>
    <Text fontSize="lg" fontWeight="bold" mb={4}>
      Off-Site Inspection
    </Text>

    {/* ===== Inputs Section ===== */}
    <Box mb={3}>
      <Text fontWeight="medium" mb={1}>Examination Date</Text>
      <Input
        type="date"
        value={(editItem as OffSiteInspection).examinationDate || ""}
        onChange={(e) =>
          setEditItem({ ...(editItem as OffSiteInspection), examinationDate: e.target.value })
        }
      />
    </Box>

    <Box mb={3}>
      <Text fontWeight="medium" mb={1}>Introduction</Text>
      <Textarea
        minH="150px"
        value={(editItem as OffSiteInspection).introduction || ""}
        onChange={(e) =>
          setEditItem({ ...(editItem as OffSiteInspection), introduction: e.target.value })
        }
      />
    </Box>

    <Box mb={3}>
      <Text fontWeight="medium" mb={1}>Contact</Text>
      <Input
        value={(editItem as OffSiteInspection).contact || ""}
        onChange={(e) =>
          setEditItem({ ...(editItem as OffSiteInspection), contact: e.target.value })
        }
      />
    </Box>

    <Box mb={3}>
      <Text fontWeight="medium" mb={1}>Office Address</Text>
      <Input
        value={(editItem as OffSiteInspection).officeAddress || ""}
        onChange={(e) =>
          setEditItem({ ...(editItem as OffSiteInspection), officeAddress: e.target.value })
        }
      />
    </Box>

    <Box mb={3}>
      <Text fontWeight="medium" mb={1}>Telephone</Text>
      <Input
        value={(editItem as OffSiteInspection).telephone || ""}
        onChange={(e) =>
          setEditItem({ ...(editItem as OffSiteInspection), telephone: e.target.value })
        }
      />
    </Box>

    <Box mb={3}>
      <Text fontWeight="medium" mb={1}>Sources</Text>
      <Textarea
        minH="100px"
        value={(editItem as OffSiteInspection).sources || ""}
        onChange={(e) =>
          setEditItem({ ...(editItem as OffSiteInspection), sources: e.target.value })
        }
      />
    </Box>

    <Box mb={3}>
      <Text fontWeight="medium" mb={1}>Compliance Status</Text>
      <Textarea
        minH="150px"
        value={(editItem as OffSiteInspection).complianceStatus || ""}
        onChange={(e) =>
          setEditItem({ ...(editItem as OffSiteInspection), complianceStatus: e.target.value })
        }
      />
    </Box>

    <Box mb={3}>
      <Text fontWeight="medium" mb={1}>RC</Text>
      <Input
        value={(editItem as OffSiteInspection).rc || ""}
        onChange={(e) =>
          setEditItem({ ...(editItem as OffSiteInspection), rc: e.target.value })
        }
      />
    </Box>

    <Box mb={3}>
      <Text fontWeight="medium" mb={1}>SCUML</Text>
      <Input
        value={(editItem as OffSiteInspection).scuml || ""}
        onChange={(e) =>
          setEditItem({ ...(editItem as OffSiteInspection), scuml: e.target.value })
        }
      />
    </Box>

    <Box mb={3}>
      <Text fontWeight="medium" mb={1}>TIN</Text>
      <Input
        value={(editItem as OffSiteInspection).tin || ""}
        onChange={(e) =>
          setEditItem({ ...(editItem as OffSiteInspection), tin: e.target.value })
        }
      />
    </Box>

    <Box mb={3}>
      <Text fontWeight="medium" mb={1}>Transaction Reporting Obligation</Text>
      <Textarea
        minH="150px"
        value={(editItem as OffSiteInspection).transactionReporting || ""}
        onChange={(e) =>
          setEditItem({
            ...(editItem as OffSiteInspection),
            transactionReporting: e.target.value,
          })
        }
      />
    </Box>

 {/* ===== Shareholders / Directors (Editable as Text, Responsive) ===== */}
<Box mt={6}>
  <Text fontSize="md" fontWeight="semibold" mb={2}>
    Shareholders / Directors
  </Text>

  {/* ✅ Make table horizontally scrollable on smaller devices */}
  <Box overflowX="auto">
    <Table variant="simple" size="sm">
      <Thead>
        <Tr>
          <Th>S/N</Th>
          <Th minW={{ base: "200px", md: "300px" }}>Name</Th>
          <Th minW="150px">PEP Status</Th>
          <Th minW="180px">Non Resident Nigerian</Th>
          <Th minW="120px">Foreigner</Th>
          <Th minW="120px">SANC. List</Th>
        </Tr>
      </Thead>
      <Tbody>
        {(editItem as OffSiteInspection).shareholders?.map((s, idx) => (
          <Tr key={idx}>
            <Td>{idx + 1}</Td>
            <Td>
              <Input
                w="full"
                size="sm"
                value={s.name || ""}
                onChange={(e) => {
                  const updated = [...((editItem as OffSiteInspection).shareholders || [])];
                  updated[idx] = { ...s, name: e.target.value };
                  setEditItem({ ...(editItem as OffSiteInspection), shareholders: updated });
                }}
              />
            </Td>
            <Td>
              <Input
                w="full"
                size="sm"
                placeholder="Yes / No"
                value={s.pepStatus || ""}
                onChange={(e) => {
                  const updated = [...((editItem as OffSiteInspection).shareholders || [])];
                  updated[idx] = { ...s, pepStatus: e.target.value };
                  setEditItem({ ...(editItem as OffSiteInspection), shareholders: updated });
                }}
              />
            </Td>
            <Td>
              <Input
                w="full"
                size="sm"
                placeholder="Yes / No"
                value={s.nonResident || ""}
                onChange={(e) => {
                  const updated = [...((editItem as OffSiteInspection).shareholders || [])];
                  updated[idx] = { ...s, nonResident: e.target.value };
                  setEditItem({ ...(editItem as OffSiteInspection), shareholders: updated });
                }}
              />
            </Td>
            <Td>
              <Input
                w="full"
                size="sm"
                placeholder="Yes / No"
                value={s.foreigner || ""}
                onChange={(e) => {
                  const updated = [...((editItem as OffSiteInspection).shareholders || [])];
                  updated[idx] = { ...s, foreigner: e.target.value };
                  setEditItem({ ...(editItem as OffSiteInspection), shareholders: updated });
                }}
              />
            </Td>
            <Td>
              <Input
                w="full"
                size="sm"
                placeholder="Yes / No"
                value={s.sanctionList || ""}
                onChange={(e) => {
                  const updated = [...((editItem as OffSiteInspection).shareholders || [])];
                  updated[idx] = { ...s, sanctionList: e.target.value };
                  setEditItem({ ...(editItem as OffSiteInspection), shareholders: updated });
                }}
              />
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  </Box>
</Box>


    {/* ===== Continue Other Fields ===== */}
    <Box mb={3} mt={6}>
      <Text fontWeight="medium" mb={1}>Politically Exposed</Text>
      <Textarea
        minH="150px"
        value={(editItem as OffSiteInspection).politicallyExposed || ""}
        onChange={(e) =>
          setEditItem({ ...(editItem as OffSiteInspection), politicallyExposed: e.target.value })
        }
      />
    </Box>

    <Box mb={3}>
      <Text fontWeight="medium" mb={1}>Affiliates</Text>
      <Textarea
        minH="150px"
        value={(editItem as OffSiteInspection).affiliates || ""}
        onChange={(e) =>
          setEditItem({ ...(editItem as OffSiteInspection), affiliates: e.target.value })
        }
      />
    </Box>

    <Box mb={3}>
      <Text fontWeight="medium" mb={1}>Legal Issues</Text>
      <Textarea
        minH="150px"
        value={(editItem as OffSiteInspection).legalIssues || ""}
        onChange={(e) =>
          setEditItem({ ...(editItem as OffSiteInspection), legalIssues: e.target.value })
        }
      />
    </Box>

    <Box mb={3}>
      <Text fontWeight="medium" mb={1}>Locations</Text>
      <Textarea
        minH="150px"
        value={(editItem as OffSiteInspection).locations || ""}
        onChange={(e) =>
          setEditItem({ ...(editItem as OffSiteInspection), locations: e.target.value })
        }
      />
    </Box>

    <Box mb={3}>
      <Text fontWeight="medium" mb={1}>Products</Text>
      <Textarea
        minH="150px"
        value={(editItem as OffSiteInspection).products || ""}
        onChange={(e) =>
          setEditItem({ ...(editItem as OffSiteInspection), products: e.target.value })
        }
      />
    </Box>

    <Box mb={3}>
      <Text fontWeight="medium" mb={1}>Recommendation</Text>
      <Textarea
        minH="150px"
        value={(editItem as OffSiteInspection).recommendation || ""}
        onChange={(e) =>
          setEditItem({ ...(editItem as OffSiteInspection), recommendation: e.target.value })
        }
      />
    </Box>
  </Box>
)}

{editType === "training" && (
  <>
    <Input
      placeholder="Topic"
      value={(editItem as Training).topic || ""}
      onChange={(e) =>
        setEditItem({ ...(editItem as Training), topic: e.target.value })
      }
      mb={2}
    />
    <Input
      placeholder="Facilitator"
      value={(editItem as Training).facilitator || ""}
      onChange={(e) =>
        setEditItem({ ...(editItem as Training), facilitator: e.target.value })
      }
      mb={2}
    />
    <Input
      placeholder="Participants"
      type="number"
      value={(editItem as Training).participants ?? ""}
      onChange={(e) =>
        setEditItem({
          ...(editItem as Training),
          participants: Number(e.target.value),
        })
      }
      mb={2}
    />
    <Input
      type="date"
      value={(editItem as Training).date || ""}
      onChange={(e) =>
        setEditItem({ ...(editItem as Training), date: e.target.value })
      }
      mb={2}
    />
  </>
)}

{editType === "onsite" && (
  <Box>
    <Text fontSize="lg" fontWeight="bold" mb={4}>
      On-Site Inspection
    </Text>

    <Text fontWeight="semibold" mb={2}>Compliance with the Law &amp; Regulation</Text>
    <Box overflowX="auto" mb={6}>
      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            <Th minW="200px">Obligation</Th>
            <Th minW="200px">Compliance Status</Th>
            <Th minW="200px">Remark</Th>
          </Tr>
        </Thead>
        <Tbody>
          {(editItem as OnSiteInspection).obligations?.map((o, idx) => (
            <Tr key={idx}>
              <Td>{o.obligation}</Td>
              <Td>
                <Textarea
                  size="sm"
                  minH="100px"
                  minW="220px"
                  value={o.complianceStatus || ""}
                  onChange={(e) => {
                    const updated = [...(editItem as OnSiteInspection).obligations];
                    updated[idx] = { ...o, complianceStatus: e.target.value };
                    setEditItem({ ...(editItem as OnSiteInspection), obligations: updated });
                  }}
                />
              </Td>
              <Td>
                <Textarea
                  size="sm"
                  minH="100px"
                  minW="220px"
                  value={o.remark || ""}
                  onChange={(e) => {
                    const updated = [...(editItem as OnSiteInspection).obligations];
                    updated[idx] = { ...o, remark: e.target.value };
                    setEditItem({ ...(editItem as OnSiteInspection), obligations: updated });
                  }}
                />
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>

    <Text fontWeight="semibold" mb={2}>Organization Profile</Text>
    <Box overflowX="auto" mb={6}>
      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            <Th minW="200px">Description</Th>
            <Th minW="250px">Remark</Th>
          </Tr>
        </Thead>
        <Tbody>
          {(editItem as OnSiteInspection).orgProfile?.map((p, idx) => (
            <Tr key={idx}>
              <Td>{p.desc}</Td>
              <Td>
                <Textarea
                  size="sm"
                  minH="100px"
                  minW="220px"
                  value={p.remark || ""}
                  onChange={(e) => {
                    const updated = [...(editItem as OnSiteInspection).orgProfile];
                    updated[idx] = { ...p, remark: e.target.value };
                    setEditItem({ ...(editItem as OnSiteInspection), orgProfile: updated });
                  }}
                />
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>

    <Text fontWeight="semibold" mb={2}>Money Laundering Risk Classification</Text>
    <Box mb={3}>
      <Text fontSize="sm" mb={1}>Level</Text>
      <select
        style={{ width: "100%", padding: "6px" }}
        value={(editItem as OnSiteInspection).riskClassification?.level || "low"}
        onChange={(e) =>
          setEditItem({
            ...(editItem as OnSiteInspection),
            riskClassification: {
              level: e.target.value as RiskClassification["level"],
              vulnerabilities:
                (editItem as OnSiteInspection).riskClassification?.vulnerabilities || "",
            },
          })
        }
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
    </Box>
    <Box mb={6}>
      <Text fontSize="sm" mb={1}>Vulnerabilities</Text>
      <Textarea
        minH="150px"
        value={(editItem as OnSiteInspection).riskClassification?.vulnerabilities || ""}
        onChange={(e) =>
          setEditItem({
            ...(editItem as OnSiteInspection),
            riskClassification: {
              level: (editItem as OnSiteInspection).riskClassification?.level || "low",
              vulnerabilities: e.target.value,
            },
          })
        }
      />
    </Box>

    <Text fontWeight="semibold" mb={2}>Attendance</Text>
    <Box overflowX="auto">
      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            <Th minW="150px">Name</Th>
            <Th minW="150px">Organization</Th>
            <Th minW="120px">Position</Th>
            <Th minW="120px">Phone</Th>
            <Th minW="100px">Sign</Th>
          </Tr>
        </Thead>
        <Tbody>
          {(editItem as OnSiteInspection).attendance?.map((a, idx) => (
            <Tr key={idx}>
              {(["name", "organization", "position", "phone", "sign"] as const).map((field) => (
                <Td key={field}>
                  <Input
                    size="sm"
                    value={a[field] || ""}
                    onChange={(e) => {
                      const updated = [...(editItem as OnSiteInspection).attendance];
                      updated[idx] = { ...a, [field]: e.target.value };
                      setEditItem({ ...(editItem as OnSiteInspection), attendance: updated });
                    }}
                  />
                </Td>
              ))}
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  </Box>
)}

            </ModalBody>
            <ModalFooter>
              <Button onClick={onEditClose} mr={3}>
                Cancel
              </Button>
              <Button colorScheme="blue" onClick={handleSaveEdit}>
                Save
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}

      

      {/* 🔹 Clear All Button */}
      <Box textAlign="center" mt={6}>
        <Button
          colorScheme="red"
          variant="outline"
          size="sm"
          onClick={() => setIsClearOpen(true)}
        >
          Clear All Records
        </Button>
      </Box>

      {/* 🔹 Single Record Delete Confirm */}
      <AlertDialog
        isOpen={isDeleteConfirmOpen}
        leastDestructiveRef={cancelDeleteRef}
        onClose={() => {
          setPendingDelete(null);
          onDeleteConfirmClose();
        }}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete this record?
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete this {pendingDelete?.type}? This cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button
                ref={cancelDeleteRef}
                onClick={() => {
                  setPendingDelete(null);
                  onDeleteConfirmClose();
                }}
              >
                Cancel
              </Button>
              <Button colorScheme="red" ml={3} onClick={performDelete}>
                Yes, delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* 🔹 Clear All Confirm */}
      <AlertDialog
        isOpen={isClearOpen}
        leastDestructiveRef={cancelRef}
        onClose={() => setIsClearOpen(false)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Everything?
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to clear ALL records? This cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setIsClearOpen(false)}>
                Cancel
              </Button>
              <Button colorScheme="red" ml={3} onClick={handleClearAll}>
                Yes, clear all
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

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
