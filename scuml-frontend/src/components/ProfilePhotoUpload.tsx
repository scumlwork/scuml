"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Button, Input, Image } from "@chakra-ui/react";

export default function ProfilePhotoUpload() {
  const { user, setUser } = useAuth();
  const [file, setFile] = useState<File | null>(null);

  // ✅ Fetch profile photo once on mount
  useEffect(() => {
    const fetchProfilePhoto = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/profile/photo`,
          { withCredentials: true }
        );
        if (res.data?.photoUrl) {
          setUser({ ...user!, photoUrl: res.data.photoUrl });
        }
      } catch (err) {
        console.error("Failed to fetch profile photo", err);
      }
    };

    if (user && !user.photoUrl) {
      fetchProfilePhoto();
    }
  }, [user, setUser]);

  const handleUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("photo", file);

    const res = await axios.post(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/profile/photo`,
      formData,
      {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      }
    );

    setUser({ ...user!, photoUrl: res.data.photoUrl });
  };

  return (
    <div>
      <Image
        src={user?.photoUrl || "/default-avatar.png"}
        alt="Profile"
        boxSize="100px"
        borderRadius="full"
      />
      <Input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        mt={2}
      />
      <Button onClick={handleUpload} mt={2} colorScheme="blue">
        Upload
      </Button>
    </div>
  );
}
