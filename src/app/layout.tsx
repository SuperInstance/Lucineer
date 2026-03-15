import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "Lucineer | AI Education & Chip Design Platform",
  description: "Games that teach kids how machines learn. Tools that help engineers build inference chips. One platform for explorers and engineers alike.",
  keywords: ["Lucineer", "AI education", "inference chips", "mask-locked", "AI for kids", "STEM education", "chip design", "neural networks", "BitNet", "FPGA"],
  authors: [{ name: "Lucineer Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Lucineer | AI Education & Chip Design",
    description: "Games that teach kids how machines learn. Tools that help engineers build what comes next.",
    url: "https://lucineer.ai",
    siteName: "Lucineer",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lucineer | AI Education & Chip Design",
    description: "Games that teach kids how machines learn. Tools that help engineers build what comes next.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        <Navigation />
        <main className="flex-1 pt-16">
          {children}
        </main>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
