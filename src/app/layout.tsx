import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "Lucineer | AI Education & Chip Design Platform",
  description: "Games that teach kids how machines learn. Tools that help engineers build inference chips. One platform for explorers and engineers alike.",
  keywords: ["Lucineer", "AI education", "inference chips", "mask-locked", "AI for kids", "STEM education", "chip design", "neural networks", "BitNet", "FPGA"],
  authors: [{ name: "Lucineer Team" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lucineer",
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
      <head>
        <meta name="theme-color" content="#22c55e" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Lucineer" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        <ServiceWorkerRegistration />
        <Navigation />
        <main className="flex-1 pt-16">
          {children}
        </main>
        <Footer />
        <Toaster />
        <InstallPrompt />
      </body>
    </html>
  );
}
