"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatUsd } from "./utils";
import type { EquityPoint, PerformanceKpis } from "./performance";

export interface ReportClient {
  name: string;
  email: string;
  accountNumber: string;
  startDate: string;
}

export interface ReportTxn {
  date: string;
  type: string;
  amount: number;
  method: string;
  status: string;
  notes: string | null;
}

const GOLD: [number, number, number] = [224, 181, 74];
const DARK: [number, number, number] = [24, 27, 33];

/** Generate and download a monthly client statement PDF. */
export function generateClientStatement(params: {
  client: ReportClient;
  kpis: PerformanceKpis;
  curve: EquityPoint[];
  transactions: ReportTxn[];
  month?: string; // e.g. "June 2026"
}) {
  const { client, kpis, curve, transactions } = params;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const month =
    params.month ??
    new Date().toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "Asia/Manila",
    });

  // ---- Header band ----
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageWidth, 90, "F");
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("RSCryptoFX", 40, 45);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Client Performance Statement", 40, 65);
  doc.setFontSize(10);
  doc.text(month, pageWidth - 40, 45, { align: "right" });
  doc.text(
    `Generated ${new Date().toLocaleDateString("en-US", { timeZone: "Asia/Manila" })}`,
    pageWidth - 40,
    62,
    { align: "right" }
  );

  // ---- Client info ----
  let y = 120;
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(client.name, 40, y);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90, 90, 90);
  y += 18;
  doc.text(`Account: ${client.accountNumber}`, 40, y);
  doc.text(`Email: ${client.email}`, 250, y);
  y += 14;
  doc.text(
    `Start date: ${new Date(client.startDate).toLocaleDateString("en-US", {
      timeZone: "Asia/Manila",
    })}`,
    40,
    y
  );

  // ---- KPI summary table ----
  y += 24;
  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: [
      ["Current Balance", formatUsd(kpis.currentBalance)],
      ["Total Deposits", formatUsd(kpis.totalDeposits)],
      ["Total Withdrawals", formatUsd(kpis.totalWithdrawals)],
      ["Total Net P/L", formatUsd(kpis.totalNetPnl)],
      ["Win Rate", `${kpis.winRate.toFixed(1)}%`],
      ["Avg Daily %", `${kpis.avgDailyPercent.toFixed(2)}%`],
      ["Trading Days", String(kpis.tradingDays)],
    ],
    theme: "grid",
    headStyles: { fillColor: DARK, textColor: GOLD, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 6 },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: 40, right: 40 },
  });

  // ---- Transactions ----
  let afterY = (doc as any).lastAutoTable.finalY + 24;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("Deposits & Withdrawals", 40, afterY);
  autoTable(doc, {
    startY: afterY + 8,
    head: [["Date", "Type", "Amount", "Method", "Status", "Notes"]],
    body:
      transactions.length > 0
        ? transactions.map((t) => [
            t.date,
            t.type,
            formatUsd(t.amount),
            t.method,
            t.status,
            t.notes ?? "",
          ])
        : [["—", "No transactions", "", "", "", ""]],
    theme: "striped",
    headStyles: { fillColor: DARK, textColor: GOLD, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 5 },
    columnStyles: { 2: { halign: "right" } },
    margin: { left: 40, right: 40 },
  });

  // ---- Daily performance (most recent 30 trading days) ----
  afterY = (doc as any).lastAutoTable.finalY + 24;
  if (afterY > doc.internal.pageSize.getHeight() - 120) {
    doc.addPage();
    afterY = 60;
  }
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Daily Performance (recent)", 40, afterY);

  const dailyRows = curve
    .filter((p) => p.isTradingDay && p.dailyPercent !== 0)
    .slice(-30)
    .reverse();

  autoTable(doc, {
    startY: afterY + 8,
    head: [["Date", "Daily %", "Daily P/L", "Balance EOD"]],
    body: dailyRows.map((p) => [
      p.date,
      `${p.dailyPercent.toFixed(2)}%`,
      formatUsd(p.pnl),
      formatUsd(p.balance),
    ]),
    theme: "striped",
    headStyles: { fillColor: DARK, textColor: GOLD, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 5 },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
    },
    margin: { left: 40, right: 40 },
  });

  // ---- Footer disclaimer ----
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      "RSCryptoFX · PAMM-style performance reporting. Past performance is not indicative of future results. Not financial advice.",
      40,
      doc.internal.pageSize.getHeight() - 24
    );
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth - 40,
      doc.internal.pageSize.getHeight() - 24,
      { align: "right" }
    );
  }

  doc.save(`RSCryptoFX-Statement-${client.accountNumber}-${month.replace(/\s/g, "-")}.pdf`);
}
