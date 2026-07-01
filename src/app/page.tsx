import Link from "next/link";
import {
  LineChart,
  TrendingUp,
  ShieldCheck,
  BrainCircuit,
  Copy,
  Gauge,
  ArrowRight,
  Check,
  Bitcoin,
  DollarSign,
  Boxes,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo, LogoMark } from "@/components/brand/logo";
import { getSession } from "@/lib/auth";

// Public marketing landing page. No auth required (see middleware PUBLIC_PATHS).
export const dynamic = "force-dynamic";

const MARKETS = [
  { icon: Bitcoin, label: "Cryptocurrencies" },
  { icon: DollarSign, label: "Forex" },
  { icon: Boxes, label: "Commodities" },
  { icon: BarChart3, label: "Indices" },
];

const FEATURES = [
  {
    icon: Gauge,
    title: "Advanced Trading Tools",
    body: "A powerful ecosystem built for speed, performance and reliability — everything you need to execute with confidence.",
  },
  {
    icon: LineChart,
    title: "Real-Time Market Data",
    body: "Live prices and full charting across crypto, Forex, commodities and indices, streamed straight to your terminal.",
  },
  {
    icon: BrainCircuit,
    title: "AI-Powered Insights",
    body: "Intelligent analytics that surface opportunities and help you make informed decisions in fast-moving markets.",
  },
  {
    icon: TrendingUp,
    title: "Portfolio Tracking",
    body: "Compounding equity curves and KPI dashboards so you always know your balance, net P/L and performance.",
  },
  {
    icon: Copy,
    title: "Copy Trading",
    body: "Follow and mirror experienced traders, or run PAMM-style managed accounts across multiple clients.",
  },
  {
    icon: ShieldCheck,
    title: "World-Class Security",
    body: "Secure, transparent access to global markets, with clear reporting and auditable performance history.",
  },
];

const STATS = [
  { value: "5+", label: "Asset classes" },
  { value: "24/7", label: "Global markets" },
  { value: "AI", label: "Powered insights" },
  { value: "Real-time", label: "Market data" },
];

const STEPS = [
  {
    n: "01",
    title: "Create your account",
    body: "Sign up in seconds and set up your profile to access the QuantumX ecosystem.",
  },
  {
    n: "02",
    title: "Fund & explore",
    body: "Record your deposit, explore live markets, tools and AI insights across every asset class.",
  },
  {
    n: "03",
    title: "Trade & track",
    body: "Follow your portfolio in real time, copy top traders, and export detailed statements anytime.",
  },
];

export default function LandingPage() {
  const session = getSession();

  return (
    <div className="terminal-bg min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/">
            <Logo size="md" subtitle />
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
          Where innovation meets global finance
        </span>
        <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
          Welcome to Quantum<span className="text-gold-400">X</span> Global Markets
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          A next-generation trading platform designed for traders and investors who want
          secure, transparent and intelligent access to the world&apos;s financial markets.
          Trade cryptocurrencies, Forex, commodities, indices and more through one powerful
          ecosystem built for speed, performance and reliability.
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
        <p className="mt-6 text-sm font-medium tracking-wide text-gold-300">
          Trade Smarter. Grow Stronger. Connect to Global Markets.
        </p>

        {/* Markets strip */}
        <div className="mx-auto mt-14 flex max-w-3xl flex-wrap items-center justify-center gap-3">
          {MARKETS.map((m) => {
            const Icon = m.icon;
            return (
              <span
                key={m.label}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium"
              >
                <Icon className="h-4 w-4 text-gold-300" /> {m.label}
              </span>
            );
          })}
        </div>

        {/* Stats */}
        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
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
          <h2 className="text-3xl font-bold tracking-tight">
            Everything you need to trade beyond limits
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Whether you&apos;re a beginner or a professional trader, QuantumX provides the
            tools, data and insights to help you make informed decisions with confidence.
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

      {/* Mission */}
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-border bg-card p-8 text-center sm:p-12">
          <LogoMark size="lg" className="mx-auto mb-5 rounded-xl" />
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Our mission</h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            At QuantumX Global Markets, we believe financial opportunities should be
            accessible to everyone. Our mission is to empower traders worldwide through
            cutting-edge technology, world-class security and continuous education.
          </p>
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
            Ready to connect to global markets?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Create an account in seconds, or explore the platform with a demo login.
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
            {["Instant demo access", "AI-powered insights", "Export PDF statements"].map((i) => (
              <li key={i} className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-profit" /> {i}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <Logo size="md" subtitle />
            <div className="flex gap-5 text-sm text-muted-foreground">
              <Link href="/login" className="hover:text-foreground">
                Log in
              </Link>
              <Link href="/signup" className="hover:text-foreground">
                Sign up
              </Link>
              <Link href="/dashboard" className="hover:text-foreground">
                Dashboard
              </Link>
            </div>
          </div>

          {/* Risk disclosure */}
          <div className="mt-8 border-t border-border pt-6">
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Risk Disclosure:</span> Trading
              cryptocurrencies, foreign exchange (Forex) and other financial instruments involves
              substantial risk and may not be suitable for all investors. Past performance does not
              guarantee future results. Nothing on this website constitutes financial or investment
              advice. Please trade responsibly and ensure compliance with the laws and regulations
              applicable in your jurisdiction.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              © {new Date().getFullYear()} QuantumX Global Markets. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
