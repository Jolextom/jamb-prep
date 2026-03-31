import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://jamb-prep-one.vercel.app";

export const metadata: Metadata = {
  title: "JAMB Prep 2026 — Crack JAMB with AI",
  description:
    "Nigeria's smartest JAMB CBT prep. Practice with real past questions, get instant AI explanations, and boost your score before exam day.",
  metadataBase: new URL(APP_URL),
  openGraph: {
    title: "JAMB Prep 2026 — Crack JAMB with AI",
    description:
      "AI-powered practice. Real past questions. Instant explanations. Start your free JAMB prep now.",
    url: APP_URL,
    siteName: "JAMB Prep 2026",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "JAMB Prep 2026 — Crack JAMB with AI",
      },
    ],
    locale: "en_NG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "JAMB Prep 2026 — Crack JAMB with AI",
    description:
      "AI-powered practice. Real past questions. Instant explanations. Start your free JAMB prep now.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
