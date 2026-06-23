import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "作業 | ラガード研究所",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
