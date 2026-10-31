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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f1f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0b12" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Set the theme before paint so there's no flash between light and dark.
const themeScript = `try{var t=localStorage.getItem('pl-theme');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}`;

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
