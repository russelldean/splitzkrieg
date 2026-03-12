import type { Metadata } from "next";
import { DM_Serif_Display, Inter, Orbitron } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PageTransition } from "@/components/ui/PageTransition";
import { FeedbackButton } from "@/components/layout/FeedbackButton";
import { ConsoleGreeting } from "@/components/layout/ConsoleGreeting";
import { AnnouncementBanner } from "@/components/layout/AnnouncementBanner";
import { PostHogProvider } from "@/components/PostHogProvider";

const dmSerif = DM_Serif_Display({
  weight: '400',
  variable: '--font-dm-serif',
  subsets: ['latin'],
  display: 'swap',
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const orbitron = Orbitron({
  variable: '--font-digital',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://splitzkrieg.com'),
  title: {
    template: '%s | Splitzkrieg',
    default: 'Splitzkrieg Bowling League',
  },
  description: "Stats, records, and history for the Splitzkrieg Bowling League. Since 2007.",
  other: {
    'apple-mobile-web-app-capable': 'no',
    'mobile-web-app-capable': 'no',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSerif.variable} ${inter.variable} ${orbitron.variable}`}>
      <body className="bg-cream text-navy font-body">
        <PostHogProvider>
          <PageTransition />
          <div className="sticky top-0 z-50">
            <AnnouncementBanner />
            <Header />
          </div>
          <main>
            {children}
          </main>
          <Footer />
          <FeedbackButton />
          <ConsoleGreeting />
        </PostHogProvider>
      </body>
    </html>
  );
}
