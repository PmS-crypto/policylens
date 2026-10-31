import type { Metadata, Viewport } from "next";
import { Anek_Devanagari, Archivo, Geist_Mono } from "next/font/google";
import "./globals.css";

// Archivo's width axis gives two voices from one family: expanded headlines, condensed money.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Devanagari glyphs for Hindi answers.
const anek = Anek_Devanagari({ variable: "--font-anek", subsets: ["devanagari"], weight: ["400", "600", "700"] });

export const metadata: Metadata = {
  title: "PolicyLens",
  description: "See what you'd pay before you buy health insurance.",
  appleWebApp: { capable: true, title: "PolicyLens", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#f3f1f6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Light by default; dark only if the user switched to it. Set before paint so there's no flash.
const themeScript = `try{document.documentElement.dataset.theme=localStorage.getItem('pl-theme')==='dark'?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${archivo.variable} ${geistMono.variable} ${anek.variable} antialiased`}>{children}</body>
    </html>
  );
}
