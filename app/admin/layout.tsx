import type { Metadata } from "next";
import { INSTITUTE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `作業 | ${INSTITUTE_NAME}`,
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
