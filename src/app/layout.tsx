import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "ApexBuilder — Cloud APK Forge",
  description:
    "Upload HTML or a ZIP project, configure the Android app, and compile it into a signed APK on GitHub Actions.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${grotesk.variable} ${mono.variable} antialiased`}>{children}</body>
    </html>
  );
}
