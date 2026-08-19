import type { Metadata } from "next";
import "./globals.css";
import "./portal-readable.css";
import "./global-typography.css";

export const metadata: Metadata = {
  title: "Check Calling",
  description: "Fleet and rental operations command platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
