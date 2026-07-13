import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSession } from "@/lib/auth";
import { getEmailLogs } from "@/lib/email-log";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  withdrawal_pending: "Withdrawal · Pending",
  withdrawal_approved: "Withdrawal · Approved",
};

function fmtDateTime(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export default async function AdminEmailLogPage() {
  const session = getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const logs = await getEmailLogs(200);
  const sent = logs.filter((l) => l.status === "sent").length;
  const failed = logs.length - sent;

  return (
    <>
      <PageHeader
        title="Email Log"
        subtitle="Transactional emails sent via Resend — newest first. Use the Resend ID to look a message up in the Resend dashboard."
      />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Badge variant="outline">{logs.length} recent</Badge>
        <Badge variant="success">{sent} sent</Badge>
        {failed > 0 && <Badge variant="danger">{failed} failed</Badge>}
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date (PHT)</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resend ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No emails logged yet.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {fmtDateTime(l.sentAt)}
                    </TableCell>
                    <TableCell className="text-sm">{TYPE_LABELS[l.type] ?? l.type}</TableCell>
                    <TableCell className="text-sm">{l.to ?? "—"}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground" title={l.subject ?? ""}>
                      {l.subject ?? "—"}
                    </TableCell>
                    <TableCell>
                      {l.status === "sent" ? (
                        <Badge variant="success">Sent</Badge>
                      ) : (
                        <Badge variant="danger" title={l.error ?? ""}>
                          Failed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {l.resendId || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
