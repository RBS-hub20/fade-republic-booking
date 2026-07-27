"use client";

import { useState } from "react";
import { CalendarClock, Download, PiggyBank, Share2 } from "lucide-react";
import { CardActions, CardButton, CardHeader, Field, GenerativeCard } from "./card-shell";
import { useShare } from "./use-share";
import { peso, phDate, sss } from "@/lib/egov/data";

export function SSSContributionsCard() {
  const [busy, setBusy] = useState(false);
  const { share, label: shareLabel } = useShare({
    title: "SSS Contributions — Up to Date",
    text: `${sss.member.name} • ${sss.member.sssNumber} • ${sss.totals.postedMonths} months posted, ${peso(
      sss.member.monthlyContribution
    )}/month via ${sss.member.employer}.`,
  });

  async function handleDownload() {
    setBusy(true);
    try {
      // jsPDF is heavy; only pull it in when the user actually asks for a file.
      const { downloadSssStatement } = await import("@/lib/egov/pdf");
      downloadSssStatement(sss);
    } finally {
      setBusy(false);
    }
  }

  return (
    <GenerativeCard>
      <CardHeader
        agency="Social Security System"
        title="SSS Contributions — Up to Date"
        badge={sss.member.status}
        badgeTone="green"
        meta={`${sss.member.name} • ${sss.member.sssNumber}`}
        icon={<PiggyBank className="h-5 w-5" />}
      />

      <dl className="grid grid-cols-2 gap-4 border-b border-black/[0.07] px-5 py-4 sm:grid-cols-4 sm:px-6">
        <Field label="Employer" value={sss.member.employer} />
        <Field label="Monthly" value={peso(sss.member.monthlyContribution)} />
        <Field label="Posted" value={`${sss.totals.postedMonths} months`} />
        <Field label="Credited YOS" value={`${sss.totals.creditedYearsOfService} years`} />
      </dl>

      <div className="overflow-x-auto eg-scroll">
        <table className="w-full min-w-[520px] border-collapse text-left text-sm">
          <thead>
            <tr className="bg-[#F7F9FC] text-[11px] uppercase tracking-[0.1em] text-black/45">
              <th className="px-5 py-2.5 font-semibold sm:px-6">Month</th>
              <th className="px-5 py-2.5 font-semibold">Employer</th>
              <th className="px-5 py-2.5 text-right font-semibold">Amount</th>
              <th className="px-5 py-2.5 font-semibold sm:px-6">Status</th>
            </tr>
          </thead>
          <tbody>
            {sss.contributions.map((c) => (
              <tr key={c.period} className="border-t border-black/[0.05]">
                <td className="px-5 py-3 font-medium sm:px-6">{c.period}</td>
                <td className="px-5 py-3 text-black/65">{c.employer}</td>
                <td className="px-5 py-3 text-right font-semibold tabular-nums">{peso(c.amount)}</td>
                <td className="px-5 py-3 sm:px-6">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {c.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.07] px-5 py-3.5 sm:px-6">
        <p className="inline-flex items-center gap-2 text-[13px] text-black/60">
          <CalendarClock className="h-4 w-4 text-egov-action" />
          Next due: <span className="font-semibold text-black/85">{sss.nextDue.period}</span> —{" "}
          {peso(sss.nextDue.amount)} on {phDate(sss.nextDue.dueDate)} via {sss.nextDue.channel}
        </p>
        <p className="text-[13px] font-semibold tabular-nums text-black/80">
          Total posted: {peso(sss.totals.postedAmount)}
        </p>
      </div>

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
