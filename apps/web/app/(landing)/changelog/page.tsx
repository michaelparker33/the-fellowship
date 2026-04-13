import type { Metadata } from "next";
import { ChangelogPageClient } from "@/features/landing/components/changelog-page-client";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "See what's new in The Fellowship — latest features, improvements, and fixes.",
  openGraph: {
    title: "Changelog | The Fellowship",
    description: "Latest updates and releases from The Fellowship.",
    url: "/changelog",
  },
  alternates: {
    canonical: "/changelog",
  },
};

export default function ChangelogPage() {
  return <ChangelogPageClient />;
}
