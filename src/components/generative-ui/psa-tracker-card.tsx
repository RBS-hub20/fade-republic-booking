"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Clock, Download, Loader2, ScrollText, Share2 } from "lucide-react";
import { CardActions, CardButton, CardHeader, Field, GenerativeCard } from "./card-shell";
import { MockMap } from "./mock-map";
import { useShare } from "./use-share";
import { BRAND } from "@/lib/egov/brand";
import { peso, phDate, psa } from "@/lib/egov/data";
import { cn } from "@/lib/utils";

const TIME_FMT = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  hour: "numeric",
  minute: "2-digit",
});

export function PSATrackerCard() {
  const [busy, setBusy] = useState(false);
  const { share, label: shareLabel } = useShare({
    title: `PSA request ${psa.request.trackingNumber}`,
    text: `${psa.request.document} for ${psa.request.ownerName} — ready ${phDate(psa.request.etaDate)} at ${psa.pickup.branch}.`,
  });

  async function handleDownload() {
    setBusy(true);
    try {
      const { downloadPsaSlip } = await import("@/lib/egov/pdf");
      downloadPsaSlip({
        trackingNumber: psa.request.trackingNumber,
        document: psa.request.document,
        ownerName: psa.request.ownerName,
        etaDate: psa.request.etaDate,
        branch: psa.pickup.branch,
        address: psa.pickup.address,
        qrPayload: psa.qr.payload,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <GenerativeCard>
      <CardHeader
        agency="Philippine Statistics Authority"
        title={psa.request.document}
        badge="In progress"
        badgeTone="blue"
        meta={`Tracking ${psa.request.trackingNumber} • ${psa.request.ownerName}`}
        icon={<ScrollText className="h-5 w-5" />}
      />

      <dl className="grid grid-cols-2 gap-4 border-b border-black/[0.07] px-5 py-4 sm:grid-cols-4 sm:px-6">
        <Field label="Copies" value={`${psa.request.copies} copies`} />
        <Field label="Purpose" value={psa.request.purpose} />
        <Field label="Official fee" value={`${peso(psa.request.fee)} — ${psa.request.paymentStatus}`} />
        <Field label="Ready by" value={<span className="text-egov-navy">{phDate(psa.request.etaDate)}</span>} />
      </dl>

      {/* Stepper */}
      <ol className="px-5 py-5 sm:px-6">
        {psa.steps.map((step, i) => {
          const done = step.status === "done";
          const current = step.status === "current";
          const last = i === psa.steps.length - 1;
          return (
            <li key={step.key} className="relative flex gap-3.5 pb-5 last:pb-0">
              {!last ? (
                <span
                  className={cn(
                    "absolute left-[13px] top-7 h-[calc(100%-14px)] w-0.5 rounded",
                    done ? "bg-emerald-400" : "bg-black/10"
                  )}
                  aria-hidden
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white",
                  done && "bg-emerald-500",
                  current && "bg-egov-action",
                  !done && !current && "border border-black/15 bg-white text-black/35"
                )}
              >
                {done ? (
                  <Check className="h-4 w-4" />
                ) : current ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Clock className="h-3.5 w-3.5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      current ? "text-egov-action" : done ? "text-black/85" : "text-black/45"
                    )}
                  >
                    {step.label}
                  </p>
                  {step.at ? (
                    <span className="text-[11px] tabular-nums text-black/40">
                      {phDate(step.at)} • {TIME_FMT.format(new Date(step.at))}
                    </span>
                  ) : (
                    <span className="text-[11px] text-black/30">Pending</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-black/50">{step.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-4 border-t border-black/[0.07] px-5 py-5 sm:grid-cols-[1fr_auto] sm:px-6">
        <MockMap
          branch={psa.pickup.branch}
          address={psa.pickup.address}
          coordinates={psa.pickup.coordinates}
          landmark={psa.pickup.landmark}
        />
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-black/[0.08] bg-white p-4">
          <QRCodeSVG
            value={psa.qr.payload}
            size={116}
            level="M"
            bgColor="#FFFFFF"
            fgColor={BRAND.navy}
          />
          <p className="text-center text-[11px] font-semibold text-black/70">Pickup QR</p>
          <p className="max-w-[150px] text-center text-[10px] leading-snug text-black/45">{psa.qr.note}</p>
        </div>
      </div>

      <div className="border-t border-black/[0.07] bg-[#F7F9FC] px-5 py-3 text-[12px] text-black/55 sm:px-6">
        {psa.pickup.hours} • {psa.pickup.queueEstimate}
      </div>

      <CardActions>
        <CardButton onClick={handleDownload} disabled={busy} icon={<Download className="h-4 w-4" />}>
          {busy ? "Preparing…" : "Download pickup slip"}
        </CardButton>
        <CardButton variant="ghost" onClick={share} icon={<Share2 className="h-4 w-4" />}>
          {shareLabel}
        </CardButton>
        <span className="ml-auto text-[11px] text-black/35">Mock data • eGov SuperAgent MVP</span>
      </CardActions>
    </GenerativeCard>
  );
}
