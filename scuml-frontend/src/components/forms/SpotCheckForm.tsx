'use client';

import {
  Button,
  Input,
  Select,
  VStack,
  HStack,
  Text,
  FormControl,
  FormLabel,
  useToast,
} from '@chakra-ui/react';
import { useState } from 'react';
import axios from 'axios';
import type { CompanyFormProps } from './LetterForm';

type YesNoCustom = { value: string; custom: string };
const emptyYNC = (): YesNoCustom => ({ value: '', custom: '' });

// The recurring "Yes / No / Custom (+ free text if Custom)" field.
function YesNoCustomField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: YesNoCustom;
  onChange: (next: YesNoCustom) => void;
}) {
  return (
    <FormControl>
      <FormLabel>{label}</FormLabel>
      <Select
        value={value.value}
        onChange={(e) => onChange({ ...value, value: e.target.value })}
        placeholder="Select"
      >
        <option value="Yes">Yes</option>
        <option value="No">No</option>
        <option value="Custom">Custom</option>
      </Select>
      {value.value === 'Custom' && (
        <Input
          mt={2}
          value={value.custom}
          onChange={(e) => onChange({ ...value, custom: e.target.value })}
          placeholder="Enter details"
        />
      )}
    </FormControl>
  );
}

const SECTORS = ['Hotel & Hospitality Industries', 'Automobile/Car Dealers', 'Other Business'];
const PARTY_TYPES = ['Individuals', 'Corporate Organizations', 'MDAs', 'Combination'];

export default function SpotCheckForm({ companyId, onSuccess }: CompanyFormProps) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [registrationWithScuml, setRegistrationWithScuml] = useState<YesNoCustom>(emptyYNC());
  const [scumlCertificateDisplay, setScumlCertificateDisplay] = useState<YesNoCustom>(emptyYNC());
  const [amlNoticeDisplay, setAmlNoticeDisplay] = useState<YesNoCustom>(emptyYNC());
  const [dateOfCommencement, setDateOfCommencement] = useState('');
  const [dateOfSpotCheck, setDateOfSpotCheck] = useState('');
  const [sector, setSector] = useState('');

  // Hotel & Hospitality Industries
  const [totalRooms, setTotalRooms] = useState('');
  const [roomRateLowest, setRoomRateLowest] = useState('');
  const [roomRateHighest, setRoomRateHighest] = useState('');
  const [facility, setFacility] = useState('');
  const [facilityRateLowest, setFacilityRateLowest] = useState('');
  const [facilityRateHighest, setFacilityRateHighest] = useState('');
  const [occupancyRate, setOccupancyRate] = useState('');
  const [occupiedRooms, setOccupiedRooms] = useState('');
  const [scumlReporting, setScumlReporting] = useState<YesNoCustom>(emptyYNC());
  const [staffScumlAwareness, setStaffScumlAwareness] = useState<YesNoCustom>(emptyYNC());

  // Automobile/Car Dealers
  const [avgVehicleType, setAvgVehicleType] = useState('');
  const [avgVehicleNumber, setAvgVehicleNumber] = useState('');
  const [avgPriceLowest, setAvgPriceLowest] = useState('');
  const [avgPriceHighest, setAvgPriceHighest] = useState('');
  const [customers, setCustomers] = useState('');

  // Other Business
  const [typesOfServices, setTypesOfServices] = useState('');
  const [customersClients, setCustomersClients] = useState('');
  const [majorCustomersClients, setMajorCustomersClients] = useState('');
  const [majorProjects, setMajorProjects] = useState('');
  const [highestAmountReceived, setHighestAmountReceived] = useState('');
  const [dateOfLastTransaction, setDateOfLastTransaction] = useState('');

  // Shown under every sector
  const [contactPerson, setContactPerson] = useState('');
  const [position, setPosition] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [initiateLetter, setInitiateLetter] = useState<YesNoCustom>(emptyYNC());
  const [companySize, setCompanySize] = useState('');

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const csrfRes = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
        { withCredentials: true }
      );
      const csrfToken = csrfRes.data.csrfToken;

      const toNumber = (v: string) => (v.trim() === '' ? undefined : Number(v));

      await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/spot-checks`,
        {
          company: companyId,
          registrationWithScuml,
          scumlCertificateDisplay,
          amlNoticeDisplay,
          dateOfCommencement,
          dateOfSpotCheck,
          sector,
          ...(sector === 'Hotel & Hospitality Industries' && {
            totalRooms,
            roomRateLowest: toNumber(roomRateLowest),
            roomRateHighest: toNumber(roomRateHighest),
            facility,
            facilityRateLowest: toNumber(facilityRateLowest),
            facilityRateHighest: toNumber(facilityRateHighest),
            occupancyRate,
            occupiedRooms,
            scumlReporting,
            staffScumlAwareness,
          }),
          ...(sector === 'Automobile/Car Dealers' && {
            avgVehicleType,
            avgVehicleNumber,
            avgPriceLowest: toNumber(avgPriceLowest),
            avgPriceHighest: toNumber(avgPriceHighest),
            customers,
          }),
          ...(sector === 'Other Business' && {
            typesOfServices,
            customersClients,
            majorCustomersClients,
            majorProjects,
            highestAmountReceived: toNumber(highestAmountReceived),
            dateOfLastTransaction,
          }),
          contactPerson,
          position,
          phone,
          email,
          initiateLetter,
          companySize,
        },
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } }
      );

      toast({ title: 'Spot Check saved.', status: 'success', duration: 4000, isClosable: true });
      onSuccess();
    } catch (err) {
      console.error('Failed to save spot check:', err);
      toast({ title: 'Failed to save Spot Check.', status: 'error', duration: 4000, isClosable: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <VStack align="stretch" spacing={5}>
      <YesNoCustomField label="Registration with SCUML" value={registrationWithScuml} onChange={setRegistrationWithScuml} />
      <YesNoCustomField label="SCUML Certificate Display" value={scumlCertificateDisplay} onChange={setScumlCertificateDisplay} />
      <YesNoCustomField label="Anti Money Laundering Notice Display" value={amlNoticeDisplay} onChange={setAmlNoticeDisplay} />

      <FormControl>
        <FormLabel>Date of Commencement of Business</FormLabel>
        <Input type="date" value={dateOfCommencement} onChange={(e) => setDateOfCommencement(e.target.value)} />
      </FormControl>

      <FormControl>
        <FormLabel>Date Spot Check</FormLabel>
        <Input type="date" value={dateOfSpotCheck} onChange={(e) => setDateOfSpotCheck(e.target.value)} />
      </FormControl>

      <FormControl>
        <FormLabel>Sector</FormLabel>
        <Select value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Select sector">
          {SECTORS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </FormControl>

      {sector === 'Hotel & Hospitality Industries' && (
        <VStack align="stretch" spacing={5} p={4} borderWidth="1px" borderRadius="md" bg="gray.50">
          <Text fontWeight="bold" color="purple.700">Hotel & Hospitality Industries</Text>

          <FormControl>
            <FormLabel>Total No. Of Rooms</FormLabel>
            <Input value={totalRooms} onChange={(e) => setTotalRooms(e.target.value)} />
          </FormControl>

          <FormControl>
            <FormLabel>Room Rate</FormLabel>
            <HStack>
              <Input type="number" placeholder="Lowest" value={roomRateLowest} onChange={(e) => setRoomRateLowest(e.target.value)} />
              <Input type="number" placeholder="Highest" value={roomRateHighest} onChange={(e) => setRoomRateHighest(e.target.value)} />
            </HStack>
          </FormControl>

          <FormControl>
            <FormLabel>Facility</FormLabel>
            <Input
              value={facility}
              onChange={(e) => setFacility(e.target.value)}
              placeholder="e.g. Event Hall, Club, Restaurant"
            />
          </FormControl>

          <FormControl>
            <FormLabel>Facility Rates</FormLabel>
            <HStack>
              <Input type="number" placeholder="Lowest" value={facilityRateLowest} onChange={(e) => setFacilityRateLowest(e.target.value)} />
              <Input type="number" placeholder="Highest" value={facilityRateHighest} onChange={(e) => setFacilityRateHighest(e.target.value)} />
            </HStack>
          </FormControl>

          <FormControl>
            <FormLabel>Occupancy Rates</FormLabel>
            <Input value={occupancyRate} onChange={(e) => setOccupancyRate(e.target.value)} placeholder="%" />
          </FormControl>

          <FormControl>
            <FormLabel>Number of Currently Occupied Rooms</FormLabel>
            <Input value={occupiedRooms} onChange={(e) => setOccupiedRooms(e.target.value)} />
          </FormControl>

          <YesNoCustomField label="Scuml Reporting" value={scumlReporting} onChange={setScumlReporting} />
          <YesNoCustomField label="Staff Scuml Awareness" value={staffScumlAwareness} onChange={setStaffScumlAwareness} />
        </VStack>
      )}

      {sector === 'Automobile/Car Dealers' && (
        <VStack align="stretch" spacing={5} p={4} borderWidth="1px" borderRadius="md" bg="gray.50">
          <Text fontWeight="bold" color="purple.700">Automobile/Car Dealers</Text>

          <FormControl>
            <FormLabel>Average Type Vehicle Available</FormLabel>
            <Select value={avgVehicleType} onChange={(e) => setAvgVehicleType(e.target.value)} placeholder="Select">
              <option value="New">New</option>
              <option value="Foreign Use">Foreign Use</option>
              <option value="Nigerian Use">Nigerian Use</option>
              <option value="Heavy Duty & Machinery">Heavy Duty & Machinery</option>
            </Select>
          </FormControl>

          <FormControl>
            <FormLabel>Average Number Vehicle</FormLabel>
            <Select value={avgVehicleNumber} onChange={(e) => setAvgVehicleNumber(e.target.value)} placeholder="Select">
              <option value="Below 10">Below 10</option>
              <option value="Above 20">Above 20</option>
              <option value="30 and above">30 and above</option>
            </Select>
          </FormControl>

          <FormControl>
            <FormLabel>Average Price</FormLabel>
            <HStack>
              <Input type="number" placeholder="Lowest Price" value={avgPriceLowest} onChange={(e) => setAvgPriceLowest(e.target.value)} />
              <Input type="number" placeholder="Highest Price" value={avgPriceHighest} onChange={(e) => setAvgPriceHighest(e.target.value)} />
            </HStack>
          </FormControl>

          <FormControl>
            <FormLabel>Customers</FormLabel>
            <Select value={customers} onChange={(e) => setCustomers(e.target.value)} placeholder="Select">
              {PARTY_TYPES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
          </FormControl>
        </VStack>
      )}

      {sector === 'Other Business' && (
        <VStack align="stretch" spacing={5} p={4} borderWidth="1px" borderRadius="md" bg="gray.50">
          <Text fontWeight="bold" color="purple.700">Other Business</Text>

          <FormControl>
            <FormLabel>Types of Services</FormLabel>
            <Input value={typesOfServices} onChange={(e) => setTypesOfServices(e.target.value)} />
          </FormControl>

          <FormControl>
            <FormLabel>Customers/Clients</FormLabel>
            <Select value={customersClients} onChange={(e) => setCustomersClients(e.target.value)} placeholder="Select">
              {PARTY_TYPES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
          </FormControl>

          <FormControl>
            <FormLabel>Major Customers/Clients</FormLabel>
            <Select value={majorCustomersClients} onChange={(e) => setMajorCustomersClients(e.target.value)} placeholder="Select">
              {PARTY_TYPES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
          </FormControl>

          <FormControl>
            <FormLabel>Major Projects for the last 3 years</FormLabel>
            <Input value={majorProjects} onChange={(e) => setMajorProjects(e.target.value)} />
          </FormControl>

          <FormControl>
            <FormLabel>Highest Amount Received last 3 years</FormLabel>
            <Input type="number" value={highestAmountReceived} onChange={(e) => setHighestAmountReceived(e.target.value)} />
          </FormControl>

          <FormControl>
            <FormLabel>Date of last transaction</FormLabel>
            <Input type="date" value={dateOfLastTransaction} onChange={(e) => setDateOfLastTransaction(e.target.value)} />
          </FormControl>
        </VStack>
      )}

      <FormControl>
        <FormLabel>Contact Person</FormLabel>
        <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
      </FormControl>

      <FormControl>
        <FormLabel>Position</FormLabel>
        <Input value={position} onChange={(e) => setPosition(e.target.value)} />
      </FormControl>

      <FormControl>
        <FormLabel>Phone</FormLabel>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </FormControl>

      <FormControl>
        <FormLabel>Email</FormLabel>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </FormControl>

      <YesNoCustomField label="Initiate Letter" value={initiateLetter} onChange={setInitiateLetter} />

      <FormControl>
        <FormLabel>Size of Business</FormLabel>
        <Select value={companySize} onChange={(e) => setCompanySize(e.target.value)} placeholder="Select size">
          <option value="Small">Small</option>
          <option value="Medium">Medium</option>
          <option value="Large">Large</option>
        </Select>
      </FormControl>

      <Button colorScheme="red" size="lg" alignSelf="flex-start" onClick={handleSubmit} isLoading={submitting}>
        Submit
      </Button>
    </VStack>
  );
}
