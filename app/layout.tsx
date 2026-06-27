import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: { default: "SaleBoom SEO", template: "%s | SaleBoom SEO" },
  description: "Automated SEO and AEO optimization platform",
  openGraph: {
    title: "SaleBoom SEO",
    description: "Automated SEO and AEO optimization platform",
    type: "website",
    siteName: "SaleBoom SEO",
  },
  twitter: {
    card: "summary_large_image",
    title: "SaleBoom SEO",
    description: "Automated SEO and AEO optimization platform",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex h-full min-h-full flex-col">{children}</body>
    </html>
  );
}
