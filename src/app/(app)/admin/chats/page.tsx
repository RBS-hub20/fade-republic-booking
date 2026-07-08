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
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const LIMIT = 100;

export default async function AdminChatsPage() {
  const session = getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  // The table may not exist until the first chat self-heals it — degrade cleanly.
  let messages: { id: string; clientId: string | null; role: string; content: string; createdAt: Date }[] = [];
  try {
    messages = await prisma.chatMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      select: { id: true, clientId: true, role: true, content: true, createdAt: true },
    });
  } catch {
    messages = [];
  }

  const clientIds = Array.from(new Set(messages.map((m) => m.clientId).filter(Boolean))) as string[];
  const clients = clientIds.length
    ? await prisma.client.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, name: true, accountNumber: true },
      })
    : [];
  const nameById = new Map(clients.map((c) => [c.id, `${c.name} · ${c.accountNumber}`]));

  return (
    <>
      <PageHeader
        title="Support Chat Logs"
        subtitle={`AI support conversations · showing the ${LIMIT} most recent messages (newest first).`}
      />
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                      No support conversations yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  messages.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(m.createdAt, { hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {m.clientId ? nameById.get(m.clientId) ?? "—" : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.role === "assistant" ? "gold" : "outline"}>
                          {m.role === "assistant" ? "AI" : "Client"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md whitespace-pre-wrap text-sm text-muted-foreground">
                        {m.content}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
