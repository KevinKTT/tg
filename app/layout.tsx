import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Shell } from "@/components/shell";
import { countOwned, listAthletes, type AthleteRow } from "@/lib/db";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "the garage",
    template: "%s · tg",
  },
  description: "CrossFit for your garage gym.",
  applicationName: "the garage",
  appleWebApp: {
    capable: true,
    title: "tg",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#110f0c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  let owned = 0;
  let members: AthleteRow[] = [];
  try {
    owned = countOwned();
    members = listAthletes();
  } catch {
    owned = 0;
    members = [];
  }
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body>
        <Shell owned={owned} members={members}>
          {children}
        </Shell>
      </body>
    </html>
  );
}
