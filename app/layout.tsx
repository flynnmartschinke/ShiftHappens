import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OverRostered",
  description: "Report a missed shift and find cover in a fictional café roster.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en-AU"><body>{children}</body></html>;
}
