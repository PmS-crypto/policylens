import type { Metadata, Viewport } from "next";
import { Anek_Devanagari, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Indian-designed family with Latin and Devanagari drawn together: English and हिंदी read as one product.
const anek = Anek_Devanagari({ variable: "--font-anek", subsets: ["latin", "devanagari"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "PolicyLens",
  description: "Health insurance, explained before you buy.",
  appleWebApp: { capable: true, title: "PolicyLens", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0f2b25",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${anek.variable} antialiased`}>{children}</body>
    </html>
  );
}
