"use client";

import { useState } from "react";
import { CheckCircle2, Download, HeartPulse, Share2, ShieldCheck, Users } from "lucide-react";
import { CardActions, CardButton, CardHeader, Field, GenerativeCard } from "./card-shell";
import { useShare } from "./use-share";
import { peso, phDate, philHealth } from "@/lib/egov/data";

export function PhilHealthCard() {
  const [busy, setBusy] = useState(false);
  const { share, label: shareLabel } = useShare({
    title: "PhilHealth — Active",
    text: `${philHealth.member.name} • ${philHealth.member.philHealthId} • Active with ${philHealth.dependents.length} dependents until ${phDate(
      philHealth.member.validUntil
    )}.`,
  });

  async function handleDownload() {
    setBusy(true);
    try {
      const { downloadPhilHealthSummary } = await import("@/lib/egov/pdf");
      downloadPhilHealthSummary(philHealth);
    } finally {
      setBusy(false);
    }
  }

  return (
    <GenerativeCard>
      <CardHeader
        agency="Philippine Health Insurance Corporation"
        title="PhilHealth Membership — Active"
        badge={philHealth.member.status}
        badgeTone="green"
        meta={`${philHealth.member.name} • ${philHealth.member.philHealthId}`}
        icon={<HeartPulse className="h-5 w-5" />}
      />

      <dl className="grid grid-cols-2 gap-4 border-b border-black/[0.07] px-5 py-4 sm:grid-cols-4 sm:px-6">
        <Field label="Category" value={philHealth.member.category.replace("Direct Contributor — ", "")} />
        <Field label="Employer" value={philHealth.member.employer} />
        <Field label="Premium" value={`${peso(philHealth.member.monthlyPremium)}/mo`} />
        <Field
          label="Valid until"
          value={<span className="text-egov-navy">{phDate(philHealth.member.validUntil)}</span>}
        />
      </dl>

      <section className="px-5 py-4 sm:px-6">
        <h4 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-black/45">
          <Users className="h-3.5 w-3.5" />
          Dependents ({philHealth.dependents.length})
        </h4>
        <ul className="mt-3 divide-y divide-black/[0.06]">
          {philHealth.dependents.map((d) => (
            <li key={d.name} className="flex items-center justify-between gap-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-black/85">{d.name}</p>
                <p className="text-xs text-black/45">
                  {d.relationship} • born {phDate(d.birthDate)}
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                <CheckCircle2 className="h-3 w-3" />
                {d.status.startsWith("Active") ? "Active" : d.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-black/[0.07] bg-[#F7F9FC] px-5 py-4 sm:px-6">
        <h4 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-black/45">
          <ShieldCheck className="h-3.5 w-3.5" />
          What you can use today
        </h4>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {philHealth.benefits.map((b) => (
            <li key={b.name} className="rounded-lg border border-black/[0.07] bg-white p-3">
              <p className="text-[13px] font-semibold text-black/85">{b.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-black/50">{b.detail}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-black/45">
          Konsulta provider on file: <span className="font-medium text-black/70">{philHealth.provider.konsultaProvider}</span>
        </p>
      </section>

      <CardActions>
        <CardButton onClick={handleDownload} disabled={busy} icon={<Download className="h-4 w-4" />}>
          {busy ? "Preparing…" : "Download PDF"}
        </CardButton>
        <CardButton variant="ghost" onClick={share} icon={<Share2 className="h-4 w-4" />}>
          {shareLabel}
        </CardButton>
        <span className="ml-auto text-[11px] text-black/35">Mock data • eGov SuperAgent MVP</span>
      </CardActions>
    </GenerativeCard>
  );
}
