'use client';

import {
  Button,
  Input,
  Select,
  Textarea,
  FormControl,
  FormLabel,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { useState, useRef } from 'react';
import axios from 'axios';

// Shared props across every "add a record to this company" form — used both
// on its own standalone page (after a company search/select step) and
// embedded directly in the Company Compliance Record modal, where the
// company is already known. companyId isn't used here (the letters API
// looks the company up by name, not id) but stays in the signature so every
// form component has the same call shape.
export interface CompanyFormProps {
  companyId: string;
  companyName: string;
  onSuccess: () => void;
}

const ACTIVITY_OPTIONS = [
  'Invitation',
  'Inspection',
  'Training',
  'Warning',
  'Sanction',
  'Visitation',
  'Reminder',
  'Follow Up',
  'Appointment/Next Appointment',
];

const today = new Date().toISOString().split('T')[0];

// Builds Google Calendar's event-creation URL, pre-filled with the
// appointment date and remark — an all-day event since there's no time
// field, just a date.
function buildGoogleCalendarUrl(companyName: string, dateStr: string, remark: string) {
  const start = dateStr.replace(/-/g, '');
  const endDateObj = new Date(dateStr);
  endDateObj.setDate(endDateObj.getDate() + 1);
  const end = endDateObj.toISOString().split('T')[0].replace(/-/g, '');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `SCUML Appointment — ${companyName}`,
    dates: `${start}/${end}`,
    details: remark || 'No remark provided.',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function LetterForm({ companyName, onSuccess }: CompanyFormProps) {
  const toast = useToast();
  const [activity, setActivity] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [remark, setRemark] = useState('');
  const [dateOfReporting, setDateOfReporting] = useState(today);
  const [photos, setPhotos] = useState<FileList | null>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);

  const uploadPhotosInBackground = async (letterId: string, csrfToken: string) => {
    if (!photos || photos.length === 0) return;
    try {
      const photoData = new FormData();
      Array.from(photos).forEach((file) => photoData.append('photos', file));
      await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/letters/${letterId}/photos`,
        photoData,
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } }
      );
    } catch (photoErr) {
      console.error('Photo upload failed:', photoErr);
      toast({
        title: 'Action saved, but photo upload failed.',
        description: 'You can try uploading the photos again later.',
        status: 'warning',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Open the calendar tab synchronously, inside the click's trusted-event
    // window — opening it later (after the async save) gets silently
    // blocked as a popup by Chrome. Navigate this blank tab once we know
    // the save succeeded, or close it if it didn't.
    const calendarWindow = window.open('', '_blank');

    try {
      const csrfRes = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/csrf-token`,
        { withCredentials: true }
      );
      const csrfToken = csrfRes.data.csrfToken;

      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/letters`,
        {
          companyName,
          typeOfLetter: activity,
          receiverName,
          phone,
          email,
          remark,
          dateOfReporting,
        },
        { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } }
      );

      if (photos && photos.length > 0) {
        await uploadPhotosInBackground(res.data._id, csrfToken);
      }

      if (calendarWindow) {
        calendarWindow.location.href = buildGoogleCalendarUrl(companyName, dateOfReporting, remark);
      }

      toast({
        title: 'Action submitted.',
        description: 'The action has been successfully saved.',
        status: 'success',
        duration: 4000,
        isClosable: true,
      });
      onSuccess();
    } catch (err) {
      calendarWindow?.close();
      console.error(err);
      toast({
        title: 'Error',
        description: 'Something went wrong while submitting.',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <VStack spacing={5} align="stretch">
        <FormControl isRequired>
          <FormLabel>Company Name</FormLabel>
          <Input value={companyName} isReadOnly cursor="not-allowed" bg="gray.100" />
        </FormControl>

        <FormControl isRequired>
          <FormLabel>Activities</FormLabel>
          <Select
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            placeholder="Select activity"
          >
            {ACTIVITY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Select>
        </FormControl>

        <FormControl isRequired>
          <FormLabel>Contact Person</FormLabel>
          <Input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
        </FormControl>

        <FormControl isRequired>
          <FormLabel>Phone</FormLabel>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </FormControl>

        <FormControl>
          <FormLabel>Email (optional)</FormLabel>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormControl>

        <FormControl>
          <FormLabel>Appointment Remark (optional)</FormLabel>
          <Textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Enter any additional remarks"
          />
        </FormControl>

        <FormControl isRequired>
          <FormLabel>Appointment Date</FormLabel>
          <Input
            type="date"
            value={dateOfReporting}
            onChange={(e) => setDateOfReporting(e.target.value)}
          />
        </FormControl>

        <FormControl>
          <FormLabel>Photos</FormLabel>
          <Input
            ref={photosInputRef}
            type="file"
            accept="image/*"
            multiple
            p={1}
            onChange={(e) => setPhotos(e.target.files)}
          />
        </FormControl>

        <Button type="submit" size="lg" colorScheme="red" borderRadius="xl" isLoading={submitting}>
          Submit Action
        </Button>
      </VStack>
    </form>
  );
}
