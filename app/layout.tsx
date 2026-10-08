import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Caprae AI Lead Prioritizer",
  description: "An acquisition target prioritization tool with deterministic scoring and optional AI analysis"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
