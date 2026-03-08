import type { Metadata } from "next";
import { DM_Serif_Display, Inter, Orbitron } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PageTransition } from "@/components/ui/PageTransition";
import { FeedbackButton } from "@/components/layout/FeedbackButton";
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://splitzkrieg.org'),
  title: {
    template: '%s | Splitzkrieg',
    default: 'Splitzkrieg Bowling League',
  },
  description: "Stats, records, and history for the Splitzkrieg Bowling League. Since 2007.",
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
          <Header />
          <main>
            {children}
          </main>
          <Footer />
          <FeedbackButton />
        </PostHogProvider>
      </body>
    </html>
  );
}
