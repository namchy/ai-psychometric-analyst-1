import "./globals.css";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import localFont from "next/font/local";
import type { ReactNode } from "react";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
});

const zodiak = localFont({
  src: [
    {
      path: "./fonts/zodiak/Zodiak-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/zodiak/Zodiak-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-zodiak",
});

export const metadata: Metadata = {
  title: "AI Psychometric Analyst",
  description: "MVP candidate assessment platform"
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className={`${plusJakartaSans.className} ${plusJakartaSans.variable} ${zodiak.variable}`}>
        {children}
      </body>
    </html>
  );
}
