import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { plusJakartaSans, zodiak } from "@/lib/fonts";

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
