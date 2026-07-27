import type { Metadata } from "next";
import { Hero } from "@/components/egov/landing/hero";
import { ComparisonTable } from "@/components/egov/landing/comparison-table";
import { PreviewCards } from "@/components/egov/landing/preview-cards";
import { TrustStrip } from "@/components/egov/landing/trust-strip";
import { SiteFooter, SiteNav } from "@/components/egov/landing/site-chrome";

export const metadata: Metadata = {
  title: "Super Agent. All Services.",
};

export default function EgovLandingPage() {
  return (
    <div className="eg-root eg-ambient min-h-[100dvh]">
      <SiteNav />
      <main>
        <Hero />
        <ComparisonTable />
        <PreviewCards />
        <TrustStrip />
      </main>
      <SiteFooter />
    </div>
  );
}
