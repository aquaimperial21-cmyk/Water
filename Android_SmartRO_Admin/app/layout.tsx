import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SmartRO Admin',
  description: 'SmartRO water-purifier rental platform — Admin Console',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
