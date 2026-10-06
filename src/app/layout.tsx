import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";

import "./globals.css";

/**
 * Two faces, loaded through next/font so they are self-hosted and there is no
 * layout shift waiting on Google.
 *
 * Montserrat carries the brand: the logo wordmark, page titles, headline numbers.
 * Inter does the work: dense tables, labels and forms, where its tighter spacing
 * and tabular figures read better.
 *
 * NOTE: cormanleigh.com sits behind a CAPTCHA, so its stylesheet could not be
 * read. Montserrat is inferred from the shape of the wordmark in the supplied
 * logo. If the real brand face differs, swapping it is a one-line change here.
 */
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-brand",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Corman Leigh · Corman PMT",
  description: "Homebuilder platform — lead to warranty on one record.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${montserrat.variable} ${inter.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
