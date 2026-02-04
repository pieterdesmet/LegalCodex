import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal Practice MVP",
  description: "AI-native legal practice management MVP"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
