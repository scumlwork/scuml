
import type { Metadata } from 'next';
import { ChakraProvider } from '@chakra-ui/react'; // ✅ must be this exact import
import { AuthProvider } from '@/context/AuthContext';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'SCUML',
  description: 'Special Control Unit Against Money Laundering',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* ✅ ChakraProvider does NOT need a value prop */}
        <ChakraProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ChakraProvider>
      </body>
    </html>
  );
}
