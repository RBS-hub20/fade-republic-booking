"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X, Plane, Copy, Check, Users, TrendingUp, Hotel, Utensils, Camera, Trophy, Share2, Download, Facebook, Loader2 } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/utils";
import { useShareImage } from "@/lib/use-share-image";
import { ShareFormatToggle } from "@/components/celebration/share-format-toggle";

// The promo runs Aug 4–31, 2026 (local). Bonus modal owns Aug 1–3; Sept 1+ it
// auto-disables — no code removal needed.
const PROMO_START = new Date(2026, 7, 4, 0, 0, 0); // Aug 4 2026 00:00 local
const PROMO_END_EXCL = new Date(2026, 8, 1, 0, 0, 0); // Sep 1 2026 00:00 local (exclusive)
const GOAL = 5000;

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Shanghai Travel Incentives promo — once per day during Aug 4–31, 2026.
 * `?shanghai=preview` force-shows it (bypasses date + daily gate) for QA.
 */
export function ShanghaiPromo({
  networkSales, referralCode, origin, enabled = true,
}: {
  networkSales: number;
  referralCode: string | null;
  origin: string;
  enabled?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [tab, setTab] = useState<"builders" | "investors">("builders");
  const [mode, setMode] = useState<"promo" | "share">("promo");
  const [copied, setCopied] = useState(false);
  const share = useShareImage();
  const refLink = referralCode ? `${origin}/signup?ref=${referralCode}` : `${origin}/signup`;

  useEffect(() => {
    const force = params.get("shanghai") === "preview";
    if (!enabled && !force) return; // admin-disabled (preview still overrides)
    if (!force) {
      const now = new Date();
      if (now < PROMO_START || now >= PROMO_END_EXCL) return; // outside Aug 4–31
      const key = `qx_shanghai_seen_${todayKey(now)}`;
      if (localStorage.getItem(key)) return; // once per day
      localStorage.setItem(key, "1");
    }
    setOpen(true);
    requestAnimationFrame(() => setShown(true));
  }, [params, enabled]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    import("canvas-confetti").then(({ default: confetti }) => {
      if (cancelled) return;
      const colors = ["#f5c542", "#d4a017", "#ffd700", "#ffffff"];
      confetti({ particleCount: 90, spread: 75, startVelocity: 48, origin: { y: 0.5 }, colors });
      setTimeout(() => !cancelled && confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0, y: 0.6 }, colors }), 250);
      setTimeout(() => !cancelled && confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1, y: 0.6 }, colors }), 400);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [open]);

  const close = useCallback(() => { setShown(false); setTimeout(() => setOpen(false), 180); }, []);
  const go = useCallback((path: string) => { close(); router.push(path); }, [close, router]);
  const copyLink = useCallback(async () => {
    try { await navigator.clipboard.writeText(refLink); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  }, [refLink]);

  if (!open) return null;
  const pct = Math.max(0, Math.min(100, (networkSales / GOAL) * 100));
  const qualified = networkSales >= GOAL;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <style>{`@keyframes qxFly{0%{transform:translateX(-30px) translateY(0)}50%{transform:translateX(150px) translateY(-6px)}100%{transform:translateX(330px) translateY(0)}}`}</style>
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-gold-400/40 p-6 text-white shadow-2xl transition-all duration-200 sm:p-7"
        style={{
          background: "radial-gradient(120% 100% at 50% 0%, #241d07 0%, #0d0d0d 55%, #000 100%)",
          transform: shown ? "scale(1)" : "scale(0.92)",
          opacity: shown ? 1 : 0,
        }}
      >
        <button onClick={close} aria-label="Close" className="absolute right-4 top-4 rounded-full bg-white/10 p-1.5 text-white/80 hover:bg-white/20">
          <X className="h-4 w-4" />
        </button>

        {/* Header with flying plane */}
        <div className="relative h-5 overflow-hidden">
          <Plane className="absolute h-4 w-4 text-gold-300" style={{ animation: "qxFly 3.2s ease-in-out infinite alternate" }} />
        </div>
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-400">Travel Incentives</p>
        <h2 className="mt-1 text-center text-2xl font-extrabold leading-tight sm:text-3xl">
          <span className="bg-gradient-to-r from-gold-200 via-gold-400 to-gold-200 bg-clip-text text-transparent">✈️ SHANGHAI, CHINA</span>
        </h2>
        <p className="text-center text-sm font-semibold text-white/90">Oct 2026 · All-Expenses-Paid</p>

        {mode === "promo" ? (
        <>
        {/* Tabs */}
        <div className="mt-5 grid grid-cols-2 gap-2">
          {(["builders", "investors"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-bold transition-colors ${
                tab === t ? "border-gold-400 bg-gold-400/15 text-gold-200" : "border-white/15 text-white/60 hover:bg-white/5"
              }`}
            >
              {t === "builders" ? <Users className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
              {t === "builders" ? "Builders" : "Investors"}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="mt-4 min-h-[190px]">
          {tab === "builders" ? (
            <div>
              <p className="text-sm text-white/90">
                Hit <b className="text-gold-300">{formatUsd(GOAL)}</b> in network sales from <b>Aug 1–31</b> to earn the trip.
              </p>
              <p className="mt-1 text-[11px] text-white/60">At least 3 active lines · 40-40-20 · {formatUsd(GOAL)} total.</p>

              <div className="mt-4 rounded-xl border border-gold-400/25 bg-black/40 p-4">
                <div className="flex items-end justify-between text-sm">
                  <span className="text-white/70">Your network sales</span>
                  <span className="font-bold tabular-nums text-gold-300">{formatUsd(networkSales)} <span className="text-white/50">/ {formatUsd(GOAL)}</span></span>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className={`mt-2 text-center text-xs font-semibold ${qualified ? "text-profit" : "text-gold-300"}`}>
                  {qualified ? "🎉 You hit the goal — you're going to Shanghai!" : `${pct.toFixed(0)}% there — keep building! 🚀`}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button onClick={copyLink} className="bg-gold-400 text-black hover:bg-gold-300">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied!" : "Copy my link"}
                </Button>
                <Button onClick={() => go("/dashboard/leaderboard")} variant="outline" className="border-gold-400/40 bg-white/5 text-gold-200 hover:bg-white/10">
                  <Trophy className="h-4 w-4" /> Leaderboard
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <ul className="space-y-2 text-sm text-white/90">
                <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" /> <b>$300–$400</b> profit monthly for 6 months</li>
                <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" /> Capital withdrawable after 6 months</li>
                <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" /> Free all-expenses-paid travel to Shanghai, China</li>
              </ul>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-gold-400/25 bg-black/40 px-4 py-3">
                <span className="text-sm text-white/70">Travel bundle value</span>
                <span className="text-2xl font-extrabold text-gold-300">{formatUsd(GOAL)}</span>
              </div>
              <Button onClick={() => go("/dashboard")} className="mt-3 w-full bg-gold-400 text-black hover:bg-gold-300">
                I want to qualify →
              </Button>
            </div>
          )}
        </div>

        {/* Perks footer */}
        <div className="mt-5 grid grid-cols-4 gap-1 border-t border-white/10 pt-4 text-center text-[9px] text-white/70">
          <Perk icon={<Plane className="h-4 w-4" />} label="All Expenses" />
          <Perk icon={<Hotel className="h-4 w-4" />} label="Premium Hotel" />
          <Perk icon={<Utensils className="h-4 w-4" />} label="World Dining" />
          <Perk icon={<Camera className="h-4 w-4" />} label="Unforgettable" />
        </div>
        <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-wider text-gold-400">
          Build Today · Earn Tomorrow · Live Your Freedom
        </p>

        <div className="mt-4 space-y-2">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Button onClick={close} className="bg-gradient-to-r from-gold-500 to-gold-300 font-bold text-black hover:from-gold-400 hover:to-gold-200">
              <Plane className="h-4 w-4" /> Let&apos;s go to Shanghai!
            </Button>
            <Button onClick={() => setMode("share")} variant="outline" className="border-gold-400/40 bg-white/5 text-gold-200 hover:bg-white/10" title="Share">
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
          <button onClick={close} className="w-full py-1 text-center text-xs text-white/60 hover:text-white">Maybe later</button>
        </div>
        </>
        ) : (
          /* ---- Share view ---- */
          <div className="mt-5">
            <p className="text-center text-sm font-semibold text-gold-200">Share your Shanghai journey 📸</p>
            <p className="mt-1 text-center text-xs text-white/70">Story for MyDay, or Square for FB / IG feed.</p>
            <ShareFormatToggle format={share.format} onChange={share.chooseFormat} />
            <div className={`mx-auto mt-3 overflow-hidden rounded-lg border border-white/20 ${share.format === "square" ? "w-44" : "w-36"}`}>
              {share.imgUrl ? (
                <img src={share.imgUrl} alt="Shanghai" className="w-full" />
              ) : (
                <div className={`flex items-center justify-center bg-white/5 text-center text-[11px] text-white/60 ${share.format === "square" ? "aspect-square" : "aspect-[9/16]"}`}>
                  {share.genning ? <Loader2 className="h-6 w-6 animate-spin" /> : "Tap Generate"}
                </div>
              )}
            </div>
            <div className="mt-5 space-y-2">
              {!share.imgUrl ? (
                <Button onClick={share.generate} disabled={share.genning} className="w-full bg-gold-400 text-black hover:bg-gold-300">
                  {share.genning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Generate {share.format === "square" ? "square" : "story"} image
                </Button>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => share.nativeShare("I'm going to Shanghai with QuantumX! ✈️🇨🇳")} className="bg-gold-400 text-black hover:bg-gold-300"><Share2 className="h-4 w-4" /> Share</Button>
                    <Button onClick={() => share.download(`quantumx-shanghai-${share.format}.png`)} variant="outline" className="border-gold-400/40 bg-white/5 text-gold-200 hover:bg-white/10"><Download className="h-4 w-4" /> Download</Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(refLink)}`, "_blank")} variant="outline" className="border-gold-400/40 bg-white/5 text-gold-200 hover:bg-white/10"><Facebook className="h-4 w-4" /> Facebook</Button>
                    <Button onClick={copyLink} variant="outline" className="border-gold-400/40 bg-white/5 text-gold-200 hover:bg-white/10">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy link</Button>
                  </div>
                </>
              )}
              <button onClick={() => setMode("promo")} className="w-full py-1 text-center text-xs text-white/60 hover:text-white">← Back</button>
            </div>
          </div>
        )}
      </div>

      {/* Off-screen Shanghai share card — story (9:16) or square (1:1) */}
      {(() => {
        const sq = share.format === "square";
        return (
          <div ref={share.ref} aria-hidden style={{
            position: "fixed", left: -99999, top: 0, width: 1080, height: sq ? 1080 : 1920,
            background: "radial-gradient(130% 100% at 50% 0%, #2a2205 0%, #0d0d0d 60%, #000 100%)",
            color: "#fff", fontFamily: "system-ui, sans-serif", padding: sq ? 64 : 96,
            display: "flex", flexDirection: "column", alignItems: "center", boxSizing: "border-box",
          }}>
            <div style={{ fontSize: sq ? 40 : 48, fontWeight: 800, letterSpacing: 2, color: "#f5c542" }}>QuantumX Global</div>
            <div style={{ marginTop: sq ? 30 : 120, fontSize: sq ? 46 : 56, fontWeight: 800, textAlign: "center", lineHeight: 1.12 }}>
              I&apos;M GOING TO<br /><span style={{ color: "#f5c542" }}>SHANGHAI!</span> 🇨🇳✈️
            </div>
            <div style={{ marginTop: sq ? 24 : 64, fontSize: sq ? 34 : 40, fontWeight: 600, opacity: 0.95 }}>Oct 2026 · All-Expenses-Paid</div>
            <div style={{ marginTop: sq ? 28 : 72, width: sq ? 860 : 820 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: sq ? 30 : 34, marginBottom: 16 }}>
                <span style={{ opacity: 0.85 }}>My network sales</span>
                <span style={{ fontWeight: 800, color: "#f5c542" }}>{formatUsd(networkSales)} / {formatUsd(GOAL)}</span>
              </div>
              <div style={{ height: sq ? 28 : 34, width: "100%", background: "rgba(255,255,255,0.12)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#d4a017,#f5c542)", borderRadius: 999 }} />
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", alignItems: "center", gap: sq ? 24 : 32, background: "rgba(245,197,66,0.12)", padding: sq ? 24 : 32, borderRadius: 28 }}>
              <div style={{ background: "#fff", padding: sq ? 12 : 16, borderRadius: 16 }}>
                <QRCodeCanvas value={refLink} size={sq ? 140 : 180} level="M" />
              </div>
              <div>
                <div style={{ fontSize: sq ? 26 : 30, opacity: 0.9 }}>Join my team:</div>
                <div style={{ fontSize: sq ? 30 : 34, fontWeight: 700, color: "#f5c542", wordBreak: "break-all" }}>{refLink.replace(/^https?:\/\//, "")}</div>
              </div>
            </div>
            <div style={{ marginTop: sq ? 24 : 56, fontSize: sq ? 26 : 30, fontWeight: 700, letterSpacing: 1, color: "#f5c542" }}>BUILD TODAY · EARN TOMORROW · LIVE YOUR FREEDOM</div>
          </div>
        );
      })()}
    </div>
  );
}

function Perk({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-400/10 text-gold-300">{icon}</span>
      {label}
    </div>
  );
}
