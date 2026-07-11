import { redirect } from "next/navigation";
import { ExternalLink, FileText, ImageIcon, Download, Eye, AlertTriangle } from "lucide-react";
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
import { prisma } from "@/lib/prisma";
import { ensureProofSchemaOnce } from "@/lib/proof-schema";
import { isBlobConfigured } from "@/lib/blob";
import { explorerTxUrl, explorerName, networkLabel } from "@/lib/tx-validation";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const LIMIT = 200;

export default async function AdminProofAuditPage() {
  const session = getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const blobEnabled = isBlobConfigured();

  await ensureProofSchemaOnce(prisma).catch(() => {});
  const proofs = await prisma.proofFile
    .findMany({ orderBy: { createdAt: "desc" }, take: LIMIT })
    .catch(() => [] as Awaited<ReturnType<typeof prisma.proofFile.findMany>>);

  // Resolve the client behind each proof for context.
  const wIds = proofs.filter((p) => p.kind === "withdrawal").map((p) => p.refId);
  const dIds = proofs.filter((p) => p.kind === "deposit").map((p) => p.refId);
  const [withdrawals, deposits] = await Promise.all([
    wIds.length
      ? prisma.withdrawal.findMany({ where: { id: { in: wIds } }, select: { id: true, clientId: true } }).catch(() => [])
      : Promise.resolve([]),
    dIds.length
      ? prisma.transaction.findMany({ where: { id: { in: dIds } }, select: { id: true, clientId: true } }).catch(() => [])
      : Promise.resolve([]),
  ]);
  const refClient = new Map<string, string>();
  for (const w of withdrawals) if (w.clientId) refClient.set(w.id, w.clientId);
  for (const d of deposits) if (d.clientId) refClient.set(d.id, d.clientId);
  const clientIds = Array.from(new Set(Array.from(refClient.values())));
  const clients = clientIds.length
    ? await prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true, accountNumber: true } }).catch(() => [])
    : [];
  const clientById = new Map(clients.map((c) => [c.id, `${c.name} · ${c.accountNumber}`]));

  return (
    <>
      <PageHeader
        title="Proof Audit"
        subtitle={`USDT withdrawal & deposit proof files (Vercel Blob) · ${proofs.length} most recent. Files are private — viewable here only.`}
      />

      {!blobEnabled && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-gold-400/40 bg-gold-400/10 px-4 py-3 text-sm text-gold-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">⚠️ Connect Vercel Blob to enable proof storage</p>
            <p className="mt-0.5 text-xs text-gold-200/80">
              Set <code className="rounded bg-black/30 px-1">BLOB_READ_WRITE_TOKEN</code> (Vercel → Storage → connect a Blob
              store, then redeploy). Until then, the proof-upload UI is hidden for admins and clients and no files are stored —
              the withdrawal and deposit flows keep working normally.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Network</TableHead>
                  <TableHead>TXID</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead className="text-right">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proofs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      No proof files uploaded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  proofs.map((p) => {
                    const isPdf = p.contentType === "application/pdf";
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDate(p.createdAt.toISOString())}
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.kind === "withdrawal" ? "gold" : "outline"} className="capitalize">
                            {p.kind}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{clientById.get(refClient.get(p.refId) ?? "") ?? "—"}</TableCell>
                        <TableCell>{p.network ? networkLabel(p.network) : "—"}</TableCell>
                        <TableCell>
                          {p.txHash ? (
                            <a
                              href={explorerTxUrl(p.network ?? "USDT_TRC20", p.txHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-xs text-gold-300 hover:underline"
                              title={`View on ${explorerName(p.network ?? "USDT_TRC20")}`}
                            >
                              {p.txHash.slice(0, 10)}… <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            {isPdf ? <FileText className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                            {isPdf ? "PDF" : "Image"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={`/api/admin/proofs/${p.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-gold-300 hover:underline"
                            >
                              <Eye className="h-3.5 w-3.5" /> View
                            </a>
                            <a
                              href={`/api/admin/proofs/${p.id}?download=1`}
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <Download className="h-3.5 w-3.5" /> Save
                            </a>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
