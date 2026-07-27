import Link from "next/link";
import { EgovLogo } from "@/components/egov/logo";
import { PRODUCT, TAGLINE } from "@/lib/egov/brand";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-egov-bg/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/egov" className="flex items-center gap-3" aria-label={PRODUCT}>
          <EgovLogo variant="mark" width={30} />
          <span className="hidden text-sm font-semibold tracking-tight text-white sm:block">
            eGov <span className="text-egov-action">SuperAgent</span>
          </span>
        </Link>

        <div className="hidden items-center gap-8 text-sm text-white/55 md:flex">
          <a href="#compare" className="transition hover:text-white">
            Why SuperAgent
          </a>
          <a href="#services" className="transition hover:text-white">
            Services
          </a>
          <a href="#trust" className="transition hover:text-white">
            Trust
          </a>
        </div>

        <Link
          href="/app"
          className="inline-flex h-9 items-center rounded-lg bg-egov-action px-4 text-sm font-semibold text-white transition hover:bg-[#3ba0ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-egov-action focus-visible:ring-offset-2 focus-visible:ring-offset-egov-bg"
        >
          Launch SuperAgent
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.07] px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <EgovLogo variant="white" width={168} />
          <p className="mt-4 max-w-sm text-sm text-white/40">
            {TAGLINE} An MVP demonstration built on mock SSS, PhilHealth and PSA data — not
            affiliated with any Philippine government agency.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm">
          <Link href="/app" className="text-white/55 transition hover:text-white">
            Open the app
          </Link>
          <a href="#compare" className="text-white/55 transition hover:text-white">
            Comparison
          </a>
          <a href="#services" className="text-white/55 transition hover:text-white">
            Services
          </a>
          <a href="#trust" className="text-white/55 transition hover:text-white">
            Trust &amp; privacy
          </a>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-6xl border-t border-white/[0.07] pt-6 text-xs text-white/30">
        © {new Date().getFullYear()} {PRODUCT}. Mock data only — walang fixer, walang dagdag-bayad.
      </div>
    </footer>
  );
}
