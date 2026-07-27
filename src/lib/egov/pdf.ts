"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BRAND } from "./brand";
import { peso, phDate, type SssRecord, type PhilHealthRecord } from "./data";

const NAVY: [number, number, number] = [10, 33, 86];
const ACTION: [number, number, number] = [30, 144, 255];
const INK: [number, number, number] = [17, 24, 39];
const MUTED: [number, number, number] = [107, 114, 128];

function header(doc: jsPDF, title: string, subtitle: string) {
  const width = doc.internal.pageSize.getWidth();
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, width, 86, "F");
  doc.setFillColor(...ACTION);
  doc.rect(0, 86, width, 3, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("eGov SuperAgent", 40, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 214, 240);
  doc.text("Super Agent. All Services.", 40, 56);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(title, width - 40, 40, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 214, 240);
  doc.text(subtitle, width - 40, 56, { align: "right" });
}

function footer(doc: jsPDF, note: string) {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  doc.setDrawColor(226, 232, 240);
  doc.line(40, height - 60, width - 40, height - 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(note, 40, height - 44);
  doc.text(
    `Generated ${phDate(new Date())} — walang fixer, walang dagdag-bayad.`,
    width - 40,
    height - 44,
    { align: "right" }
  );
}

function keyValueBlock(doc: jsPDF, rows: [string, string][], startY: number) {
  let y = startY;
  rows.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), 40, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(value, 200, y);
    y += 20;
  });
  return y;
}

/** Contribution statement matching the SSS card shown in chat. */
export function downloadSssStatement(record: SssRecord) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  header(doc, "SSS Contribution Record", `Tracking EGOV-2026-8891 • ${record.member.status}`);

  const afterKv = keyValueBlock(
    doc,
    [
      ["Member", record.member.name],
      ["SSS number", record.member.sssNumber],
      ["Membership", record.member.membershipType],
      ["Employer", record.member.employer],
      ["Monthly contribution", peso(record.member.monthlyContribution)],
    ],
    130
  );

  autoTable(doc, {
    startY: afterKv + 8,
    head: [["Month", "Employer", "Amount", "Status", "OR number"]],
    body: record.contributions.map((c) => [c.period, c.employer, peso(c.amount), c.status, c.orNumber]),
    styles: { font: "helvetica", fontSize: 9, cellPadding: 8, textColor: INK },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 249, 255] },
    columnStyles: { 2: { halign: "right" } },
    margin: { left: 40, right: 40 },
  });

  // `lastAutoTable` is attached by the autotable plugin at runtime.
  const endY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 26;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(
    `Total posted: ${peso(record.totals.postedAmount)} across ${record.totals.postedMonths} months`,
    40,
    endY
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    `Next due: ${record.nextDue.period} — ${peso(record.nextDue.amount)} on ${phDate(record.nextDue.dueDate)} via ${record.nextDue.channel}`,
    40,
    endY + 16
  );

  footer(doc, "Demo data from the eGov SuperAgent MVP — not an official SSS document.");
  doc.save("eGov-SuperAgent-SSS-Contributions.pdf");
}

/** Membership summary matching the PhilHealth card shown in chat. */
export function downloadPhilHealthSummary(record: PhilHealthRecord) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  header(doc, "PhilHealth Membership", `${record.member.status} until ${phDate(record.member.validUntil)}`);

  const afterKv = keyValueBlock(
    doc,
    [
      ["Member", record.member.name],
      ["PhilHealth ID", record.member.philHealthId],
      ["Category", record.member.category],
      ["Employer", record.member.employer],
      ["Monthly premium", peso(record.member.monthlyPremium)],
    ],
    130
  );

  autoTable(doc, {
    startY: afterKv + 8,
    head: [["Dependent", "Relationship", "Birth date", "Status"]],
    body: record.dependents.map((d) => [d.name, d.relationship, phDate(d.birthDate), d.status]),
    styles: { font: "helvetica", fontSize: 9, cellPadding: 8, textColor: INK },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 249, 255] },
    margin: { left: 40, right: 40 },
  });

  footer(doc, "Demo data from the eGov SuperAgent MVP — not an official PhilHealth document.");
  doc.save("eGov-SuperAgent-PhilHealth-Membership.pdf");
}

/** Pickup slip for the PSA request, QR payload printed as text. */
export function downloadPsaSlip(params: {
  trackingNumber: string;
  document: string;
  ownerName: string;
  etaDate: string;
  branch: string;
  address: string;
  qrPayload: string;
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  header(doc, "PSA Pickup Slip", `Tracking ${params.trackingNumber}`);

  const afterKv = keyValueBlock(
    doc,
    [
      ["Document", params.document],
      ["Requested for", params.ownerName],
      ["Ready by", phDate(params.etaDate)],
      ["Releasing branch", params.branch],
    ],
    130
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(params.address, 40, afterKv + 4, { maxWidth: 380 });

  doc.setDrawColor(...ACTION);
  doc.setLineWidth(1.2);
  doc.roundedRect(40, afterKv + 30, 515, 70, 8, 8, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text("Present this code at the releasing counter", 56, afterKv + 56);
  doc.setFont("courier", "normal");
  doc.setFontSize(11);
  doc.setTextColor(BRAND.navy);
  doc.text(params.qrPayload, 56, afterKv + 78);

  footer(doc, "Demo data from the eGov SuperAgent MVP — not an official PSA document.");
  doc.save("eGov-SuperAgent-PSA-Pickup-Slip.pdf");
}
