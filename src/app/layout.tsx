import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TTSOPP Markets",
  description: "The True Saga of Paul Pogchamp Predictions sandbox league",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased font-sans">
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
