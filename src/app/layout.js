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

export const metadata = {
  title: "Zero-Latency | Collaborative Workspace",
  description: "A premium real-time collaborative whiteboard. Brainstorm with zero latency using shared cursors and sticky notes on an expansive digital canvas.",
  keywords: ["collaboration", "real-time", "whiteboard", "sticky notes", "brainstorm", "productivity", "glassmorphism"],
  openGraph: {
    title: "Zero-Latency | Collaborative Workspace",
    description: "A premium real-time collaborative whiteboard. Brainstorm with zero latency using shared cursors and sticky notes on an expansive digital canvas.",
    type: "website",
    url: "https://your-domain.com",
    siteName: "Zero-Latency",
    images: [
      {
        url: "/og-image.png", // Next.js will resolve this if you add an opengraph-image in app/
        width: 1200,
        height: 630,
        alt: "Zero-Latency Workspace Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zero-Latency | Collaborative Workspace",
    description: "A premium real-time collaborative whiteboard. Brainstorm with zero latency using shared cursors and sticky notes on an expansive digital canvas.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
