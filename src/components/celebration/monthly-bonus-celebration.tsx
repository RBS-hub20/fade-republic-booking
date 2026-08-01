"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import {
  X, Wallet, Share2, Users, TrendingUp, Coins, Download, Copy, Check, Loader2, Facebook,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/utils";
import type { CelebrationBonus } from "@/lib/referrals";

// Below this, use the gentle "your team is growing" copy instead of the big win.
const SMALL_THRESHOLD = 0.5;

function monthLabel(monthYear: string) {
  const [y, m] = monthYear.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
function prevMonthKey(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Login celebration for the monthly referral bonus. Shows once per user per
 * bonus-month on the 1st–3rd (localStorage-gated), when the user has a bonus
 * > $0 for the previous month. `?celebrate=preview` force-shows it for QA.
 */
export function MonthlyBonusCelebration({
  bonus, firstName, referralCode, tier, origin, enabled = true,
}: {
  bonus: CelebrationBonus | null;
  firstName: string;
  referralCode: string | null;
  tier: string;
  origin: string;
  enabled?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false); // drives the scale-in
  const [view, setView] = useState<"celebrate" | "share">("celebrate");

  // --- Decide whether to show -------------------------------------------------
  useEffect(() => {
    if (!bonus || bonus.bonusAmount <= 0) return;
    const force = params.get("celebrate") === "preview";
    if (!enabled && !force) return; // admin-disabled (preview still overrides)
    if (!force) {
      const now = new Date();
      const day = now.getDate();
      if (day < 1 || day > 3) return;            // only the 1st–3rd
      if (bonus.monthYear !== prevMonthKey(now)) return; // only the just-ended month
      const key = `qxMbPopup_${bonus.monthYear}`;
      if (localStorage.getItem(key)) return;     // already celebrated this month
      localStorage.setItem(key, "1");
    }
    setOpen(true);
    requestAnimationFrame(() => setShown(true));
  }, [bonus, params, enabled]);

  // --- Confetti (lazy — only loads when the modal opens) ----------------------
  useEffect(() => {
    if (!open || view !== "celebrate") return;
    let cancelled = false;
    import("canvas-confetti").then(({ default: confetti }) => {
      if (cancelled) return;
      const colors = ["#7c3aed", "#3b82f6", "#f59e0b", "#22c55e", "#ffffff"];
      const burst = (o: Record<string, unknown>) => confetti({ spread: 70, origin: { y: 0.5 }, colors, ...o });
      burst({ particleCount: 90, startVelocity: 48 });
      setTimeout(() => !cancelled && burst({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0, y: 0.6 } }), 220);
      setTimeout(() => !cancelled && burst({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1, y: 0.6 } }), 380);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [open, view]);

  const close = useCallback(() => { setShown(false); setTimeout(() => setOpen(false), 180); }, []);

  // --- Share image ------------------------------------------------------------
  const shareRef = useRef<HTMLDivElement>(null);
  const [genning, setGenning] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const refLink = referralCode ? `${origin}/signup?ref=${referralCode}` : `${origin}/signup`;

  const generate = useCallback(async () => {
    if (!shareRef.current) return;
    setGenning(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(shareRef.current, {
        backgroundColor: "#1e1b4b", scale: 1, width: 1080, height: 1920, useCORS: true, logging: false,
      });
      setImgUrl(canvas.toDataURL("image/png"));
    } catch (e) {
      console.error("[celebration] share image failed:", e);
    }
    setGenning(false);
  }, []);

  const download = useCallback(() => {
    if (!imgUrl) return;
    const a = document.createElement("a");
    a.href = imgUrl;
    a.download = `quantumx-bonus-${bonus?.monthYear ?? "win"}.png`;
    a.click();
  }, [imgUrl, bonus]);

  const nativeShare = useCallback(async () => {
    if (!imgUrl) return;
    try {
      const blob = await (await fetch(imgUrl)).blob();
      const file = new File([blob], "quantumx-bonus.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "QuantumX", text: "I earned while I slept! 🚀" });
        return;
      }
    } catch { /* fall through to download */ }
    download();
  }, [imgUrl, download]);

  const copyLink = useCallback(async () => {
    try { await navigator.clipboard.writeText(refLink); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  }, [refLink]);

  if (!open || !bonus) return null;
  const small = bonus.bonusAmount < SMALL_THRESHOLD;
  const paid = new Date(bonus.paidAt).toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const month = monthLabel(bonus.monthYear);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl p-6 text-white shadow-2xl transition-all duration-200 sm:p-8"
        style={{
          background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 45%, #3b82f6 100%)",
          transform: shown ? "scale(1)" : "scale(0.92)",
          opacity: shown ? 1 : 0,
        }}
      >
        <button onClick={close} aria-label="Close" className="absolute right-4 top-4 rounded-full bg-white/15 p-1.5 text-white/90 hover:bg-white/25">
          <X className="h-4 w-4" />
        </button>

        {view === "celebrate" ? (
          <>
            <div className="mb-1 text-center text-5xl">{small ? "🌱" : "🎉"}</div>
            <h2 className="text-center text-2xl font-extrabold leading-tight sm:text-3xl">
              {small ? "Your team is growing!" : `BOOM! Your team earned you ${formatUsd(bonus.bonusAmount)} while you slept!`}
            </h2>
            <p className="mt-3 text-center text-sm text-white/90">
              {small ? (
                <>You earned a <b>{formatUsd(bonus.bonusAmount)}</b> monthly bonus from your team&apos;s {month} P/L. Keep inviting — bigger next month! 💪</>
              ) : (
                <>Your <b>{bonus.directsCount}</b> direct{bonus.directsCount === 1 ? "" : "s"} earned <b>{formatUsd(bonus.totalDirectsPl)}</b> in {month}. You get <b>5%</b> — <b>{formatUsd(bonus.bonusAmount)}</b> — credited to Available Withdrawal!</>
              )}
            </p>

            {/* Stats */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              <Stat icon={<Users className="h-4 w-4" />} label="Directs" value={String(bonus.directsCount)} />
              <Stat icon={<TrendingUp className="h-4 w-4" />} label="Their P/L" value={formatUsd(bonus.totalDirectsPl)} />
              <Stat icon={<Coins className="h-4 w-4" />} label="Your 5%" value={formatUsd(bonus.bonusAmount)} highlight />
            </div>

            <p className="mt-4 text-center text-[11px] text-white/70">Paid {paid} · Available to withdraw now</p>

            <div className="mt-6 space-y-2">
              <Button onClick={() => { close(); router.push("/wallet"); }} className="w-full bg-white text-indigo-700 hover:bg-white/90">
                <Wallet className="h-4 w-4" /> Awesome! Check Withdrawal
              </Button>
              <Button onClick={() => setView("share")} variant="outline" className="w-full border-white/40 bg-white/10 text-white hover:bg-white/20">
                <Share2 className="h-4 w-4" /> Share my win 📸
              </Button>
              <button onClick={close} className="w-full py-1 text-center text-xs text-white/70 hover:text-white">Maybe later</button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-center text-xl font-bold">Share your win 🚀</h2>
            <p className="mt-1 text-center text-xs text-white/80">Generate a story image for MyDay / Facebook.</p>

            <div className="mx-auto mt-4 w-40 overflow-hidden rounded-lg border border-white/20">
              {imgUrl ? (
                <img src={imgUrl} alt="Your win" className="w-full" />
              ) : (
                <div className="flex aspect-[9/16] items-center justify-center bg-white/10 text-center text-[11px] text-white/70">
                  {genning ? <Loader2 className="h-6 w-6 animate-spin" /> : "Tap Generate"}
                </div>
              )}
            </div>

            <div className="mt-5 space-y-2">
              {!imgUrl ? (
                <Button onClick={generate} disabled={genning} className="w-full bg-white text-indigo-700 hover:bg-white/90">
                  {genning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Generate image
                </Button>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={nativeShare} className="bg-white text-indigo-700 hover:bg-white/90"><Share2 className="h-4 w-4" /> Share</Button>
                    <Button onClick={download} variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20"><Download className="h-4 w-4" /> Download</Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(refLink)}`, "_blank")} variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20"><Facebook className="h-4 w-4" /> Facebook</Button>
                    <Button onClick={copyLink} variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy link</Button>
                  </div>
                </>
              )}
              <button onClick={() => setView("celebrate")} className="w-full py-1 text-center text-xs text-white/70 hover:text-white">← Back</button>
            </div>
          </>
        )}
      </div>

      {/* Off-screen 1080×1920 share card captured by html2canvas */}
      <div ref={shareRef} aria-hidden style={{
        position: "fixed", left: -99999, top: 0, width: 1080, height: 1920,
        background: "linear-gradient(160deg, #7c3aed 0%, #4f46e5 50%, #3b82f6 100%)",
        color: "#fff", fontFamily: "system-ui, sans-serif", padding: 96,
        display: "flex", flexDirection: "column", alignItems: "center", boxSizing: "border-box",
      }}>
        <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: 2, opacity: 0.95 }}>QuantumX Global</div>
        <div style={{ marginTop: 140, fontSize: 60, fontWeight: 800, textAlign: "center", lineHeight: 1.1 }}>I EARNED WHILE<br />I SLEPT! 😴💸</div>
        <div style={{ marginTop: 60, fontSize: 220, fontWeight: 900, textShadow: "0 8px 40px rgba(0,0,0,0.35)" }}>{formatUsd(bonus.bonusAmount)}</div>
        <div style={{ fontSize: 40, fontWeight: 600, opacity: 0.95 }}>Monthly Bonus · {month}</div>
        <div style={{ marginTop: 70, fontSize: 40, textAlign: "center", maxWidth: 820, lineHeight: 1.35 }}>
          My {bonus.directsCount} direct{bonus.directsCount === 1 ? "" : "s"} earned <b>{formatUsd(bonus.totalDirectsPl)}</b> — I got <b>5%</b>! 🔥
        </div>
        <div style={{ marginTop: 50, fontSize: 44, fontWeight: 700 }}>{firstName} · {tier} Tier</div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 32, background: "rgba(255,255,255,0.12)", padding: 32, borderRadius: 28 }}>
          <div style={{ background: "#fff", padding: 16, borderRadius: 16 }}>
            <QRCodeCanvas value={refLink} size={180} level="M" />
          </div>
          <div>
            <div style={{ fontSize: 30, opacity: 0.9 }}>Join my team:</div>
            <div style={{ fontSize: 34, fontWeight: 700, wordBreak: "break-all" }}>{refLink.replace(/^https?:\/\//, "")}</div>
          </div>
        </div>
        <div style={{ marginTop: 56, fontSize: 30, opacity: 0.8 }}>QuantumX — Precision Trading, Real Results</div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-2 py-3 text-center ${highlight ? "bg-white text-indigo-700" : "bg-white/10"}`}>
      <div className="mx-auto flex items-center justify-center">{icon}</div>
      <div className="mt-1 text-sm font-bold tabular-nums">{value}</div>
      <div className={`text-[10px] uppercase tracking-wide ${highlight ? "text-indigo-500" : "text-white/70"}`}>{label}</div>
    </div>
  );
}
