import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal journal | Human digital twin",
  description: "Wearable metrics and transparent experimental stress modeling.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
