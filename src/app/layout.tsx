import type { Metadata } from "next";
import { Cormorant_Garamond, Great_Vibes, Manrope, Source_Code_Pro } from "next/font/google";
import { GlobalMusicPlayer } from "@/components/global-music-player";
import { ToasterProvider } from "@/components/toaster-provider";
import "./globals.css";

const displayFont = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const monoFont = Source_Code_Pro({
  variable: "--font-code",
  subsets: ["latin"],
});

const scriptFont = Great_Vibes({
  variable: "--font-script",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Red & Jess Wedding RSVP",
  description: "Cinematic RSVP website powered by Google Sheets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} ${scriptFont.variable} antialiased`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        {children}
        <GlobalMusicPlayer />
        <ToasterProvider />
      </body>
    </html>
  );
}
