import Link from "next/link";
import {
  CandlestickChart,
  LineChart,
  ArrowLeftRight,
  FileText,
  TrendingUp,
  ShieldCheck,
  Wallet,
  Percent,
  ArrowRight,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";

// Public marketing landing page. No auth required (see middleware PUBLIC_PATHS).
export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: TrendingUp,
    title: "Performance Dashboard",
    body: "PAMM-style compounded equity curves per client with KPI cards — balance, net P/L, win rate and average daily return.",
  },
  {
    icon: ArrowLeftRight,
    title: "Deposit / Withdrawal Ledger",
    body: "Track every cashflow with methods, statuses and notes. Approved entries update balances automatically. CSV in/out.",
  },
  {
    icon: LineChart,
    title: "Live Forex Charts",
    body: "Full TradingView charting for XAU/USD and the majors, with a live watchlist and multiple timeframes.",
  },
  {
    icon: FileText,
    title: "Client Statements",
    body: "Generate branded monthly PDF statements covering deposits, withdrawals, daily P/L and the equity curve.",
  },
  {
    icon: Wallet,
    title: "Multi-Client PAMM",
    body: "Manage many client accounts from one portal with a combined portfolio view and per-client drill-down.",
  },
  {
    icon: ShieldCheck,
    title: "Transparent Reporting",
    body: "Daily performance logs, compounding math you can audit, and clear disclaimers. Built for trust.",
  },
];

const STATS = [
  { value: "0.3–0.6%", label: "Est. daily target" },
  { value: "Mon–Fri", label: "Trading days only" },
  { value: "Compounding", label: "Daily equity growth" },
  { value: "Asia/Manila", label: "Reporting timezone" },
];

const STEPS = [
  {
    n: "01",
    title: "Open your account",
    body: "Sign up and record your initial deposit to establish your starting equity.",
  },
  {
    n: "02",
    title: "We report daily",
    body: "Each trading day, performance is applied and compounded into your equity curve.",
  },
  {
    n: "03",
    title: "Track & withdraw",
    body: "Follow your dashboard in real time and export monthly statements anytime.",
  },
];

export default function LandingPage() {
  const session = getSession();

  return (
    <div className="terminal-bg min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-400 text-black">
              <CandlestickChart className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              RSCrypto<span className="text-gold-400">FX</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            {session ? (
              <Button asChild>
                <Link href="/dashboard">
                  Go to Dashboard <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost">
                  <Link href="/login">Log in</Link>
                </Button>
                <Button asChild>
                  <Link href="/signup">Sign up</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-20 text-center sm:px-6 sm:pt-28">
        <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-400/10 px-3 py-1 text-xs font-medium text-gold-300">
          <Percent className="h-3.5 w-3.5" /> PAMM-style forex performance reporting
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
          Your capital, <span className="text-gold-400">professionally reported.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          RSCryptoFX is a client portal for transparent, compounding forex performance —
          equity curves, deposit &amp; withdrawal ledgers, live XAU/USD charts and
          exportable monthly statements, all in one dark trading terminal.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/signup">
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <Link href="/login">Log in to your account</Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Demo environment · Not financial advice
        </p>

        {/* Stats */}
        <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-card px-4 py-6">
              <p className="text-xl font-bold text-gold-300 sm:text-2xl">{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Everything in one portal</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Built like Myfxbook / FXBlue — clean, professional and transparent.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-lg border border-border bg-card p-6 transition-colors hover:border-gold-400/40"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-gold-400/15 text-gold-300">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-lg border border-border bg-card p-6">
              <span className="text-3xl font-bold text-gold-400/40">{s.n}</span>
              <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-gold-400/30 bg-gradient-to-br from-gold-400/15 via-card to-card p-8 text-center sm:p-14">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to see your equity curve?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Create an account in seconds, or explore the portal with a demo login.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/signup">
                Create your account <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
          <ul className="mx-auto mt-8 flex max-w-md flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {["No credit card", "Instant demo access", "Export PDF statements"].map((i) => (
              <li key={i} className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-profit" /> {i}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-gold-400 text-black">
              <CandlestickChart className="h-4 w-4" />
            </div>
            <span className="font-semibold text-foreground">
              RSCrypto<span className="text-gold-400">FX</span>
            </span>
          </div>
          <p className="text-center text-xs">
            © {new Date().getFullYear()} RSCryptoFX · Demo environment · Past performance is not
            indicative of future results. Not financial advice.
          </p>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-foreground">
              Log in
            </Link>
            <Link href="/signup" className="hover:text-foreground">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
