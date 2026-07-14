"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Search,
  Users,
  Flame,
  Maximize2,
  Minimize2,
  Loader2,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { avatarSrc } from "@/lib/avatar";

interface TreeNode {
  id: string;
  username: string | null;
  tier: string;
  avatarType: string | null;
  directCount: number;
  teamCount: number;
  teamVolume: number;
  totalPnlPercent: number;
  joinedAt: string;
  status: string;
  hasChildren: boolean;
}
interface Page {
  nodes: TreeNode[];
  total: number;
  loaded: number;
  hasMore: boolean;
}

const ROOT = "root";
const MAX_DOM_NODES = 500;
const CACHE_TTL = 5 * 60_000;

const TIER_COLOR: Record<string, string> = {
  Platinum: "text-slate-200 border-slate-400/40",
  Gold: "text-gold-300 border-gold-400/40",
  Silver: "text-slate-400 border-slate-400/30",
  Bronze: "text-amber-600 border-amber-600/40",
  None: "text-muted-foreground border-border",
};

function compact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
function heatColor(pnl: number, status: string): string {
  if (status !== "Active" || pnl === 0) return "bg-muted-foreground/30";
  const mag = Math.min(1, Math.abs(pnl) / 25);
  if (pnl > 0) return mag > 0.6 ? "bg-profit" : "bg-profit/50";
  return mag > 0.6 ? "bg-loss" : "bg-loss/50";
}

export function GenealogyTree({ myUserId, rootDirectCount }: { myUserId: string | null; rootDirectCount: number }) {
  const [pages, setPages] = useState<Record<string, Page>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set([ROOT]));
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [heatmap, setHeatmap] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; username: string | null }[]>([
    { id: ROOT, username: "QuantumX" },
  ]);
  const [search, setSearch] = useState("");
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const cacheTime = useRef<Record<string, number>>({});

  const fetchChildren = useCallback(
    async (parentId: string, offset: number): Promise<Page | null> => {
      const res = await fetch(`/api/admin/genealogy?parentId=${encodeURIComponent(parentId)}&offset=${offset}`);
      if (!res.ok) return null;
      const d = await res.json();
      return { nodes: d.nodes ?? [], total: d.total ?? 0, loaded: (d.offset ?? 0) + (d.nodes?.length ?? 0), hasMore: !!d.hasMore };
    },
    []
  );

  const loadChildren = useCallback(
    async (parentId: string, append = false): Promise<Page | null> => {
      const existing = pages[parentId];
      if (!append && existing && Date.now() - (cacheTime.current[parentId] ?? 0) < CACHE_TTL) return existing;
      setLoadingIds((s) => new Set(s).add(parentId));
      const offset = append && existing ? existing.loaded : 0;
      const page = await fetchChildren(parentId, offset);
      setLoadingIds((s) => {
        const n = new Set(s);
        n.delete(parentId);
        return n;
      });
      if (!page) return null;
      const merged: Page =
        append && existing ? { ...page, nodes: [...existing.nodes, ...page.nodes] } : page;
      cacheTime.current[parentId] = Date.now();
      setPages((p) => ({ ...p, [parentId]: merged }));
      return merged;
    },
    [pages, fetchChildren]
  );

  // Initial: company root's direct members.
  useEffect(() => {
    void loadChildren(ROOT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(
    async (node: TreeNode, ancestors: { id: string; username: string | null }[]) => {
      setBreadcrumb([...ancestors, { id: node.id, username: node.username }]);
      setExpanded((s) => {
        const n = new Set(s);
        if (n.has(node.id)) n.delete(node.id);
        else n.add(node.id);
        return n;
      });
      if (!pages[node.id]) void loadChildren(node.id);
    },
    [pages, loadChildren]
  );

  // Expand up to 3 levels below a node.
  const expandBranch = useCallback(
    async (startId: string) => {
      let frontier = [startId];
      const toExpand = new Set<string>();
      for (let depth = 0; depth < 3 && frontier.length; depth++) {
        const next: string[] = [];
        for (const pid of frontier) {
          const page = await loadChildren(pid);
          if (page) {
            toExpand.add(pid);
            for (const c of page.nodes) if (c.hasChildren) next.push(c.id);
          }
        }
        frontier = next;
      }
      setExpanded((s) => new Set([...Array.from(s), ...Array.from(toExpand)]));
    },
    [loadChildren]
  );

  const collapseAll = useCallback(() => {
    setExpanded(new Set([ROOT]));
    setHighlight(null);
    setBreadcrumb([{ id: ROOT, username: "QuantumX" }]);
  }, []);

  const jumpTo = useCallback(
    async (username: string, isMyTeam = false) => {
      setSearchErr(null);
      const q = username.trim().replace(/^@/, "");
      if (!q && !isMyTeam) return;
      const res = await fetch(`/api/admin/genealogy?path=${encodeURIComponent(q)}`);
      const d = await res.json().catch(() => ({}));
      if (!d.found || !Array.isArray(d.path) || d.path.length === 0) {
        setSearchErr("User not found");
        return;
      }
      const path: { id: string; username: string | null }[] = d.path;
      // Load + expand every ancestor (all but the target leaf).
      for (let i = 0; i < path.length - 1; i++) await loadChildren(path[i].id);
      setExpanded((s) => new Set([...Array.from(s), ...path.slice(0, -1).map((p) => p.id)]));
      setBreadcrumb(path);
      const leaf = path[path.length - 1].id;
      setHighlight(leaf);
      setTimeout(() => document.getElementById(`node-${leaf}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 200);
    },
    [loadChildren]
  );

  const totalRendered = Object.entries(pages).reduce(
    (sum, [pid, pg]) => (expanded.has(pid) ? sum + pg.nodes.length : sum),
    0
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void jumpTo(search);
          }}
          className="flex w-full max-w-sm items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Jump to @username…"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-gold-400/60"
            />
          </div>
          <Button type="submit" size="sm">Jump</Button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          {myUserId && (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                // "My Team": load + expand the admin's own downline.
                await loadChildren(myUserId);
                setExpanded((s) => new Set([...Array.from(s), ROOT, myUserId]));
                setHighlight(myUserId);
                setTimeout(
                  () => document.getElementById(`node-${myUserId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
                  200
                );
              }}
            >
              <Users className="h-4 w-4" /> My Team
            </Button>
          )}
          <Button size="sm" variant={heatmap ? "default" : "outline"} onClick={() => setHeatmap((h) => !h)}>
            <Flame className="h-4 w-4" /> Heatmap
          </Button>
          <Button size="sm" variant="outline" onClick={collapseAll}>
            <Minimize2 className="h-4 w-4" /> Collapse All
          </Button>
        </div>
      </div>
      {searchErr && <p className="text-sm text-loss">{searchErr}</p>}

      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {breadcrumb.map((b, i) => (
          <span key={b.id} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3" />}
            <span className={cn(i === breadcrumb.length - 1 && "font-semibold text-gold-300")}>
              {b.id === ROOT ? "QuantumX" : `@${b.username ?? "user"}`}
            </span>
          </span>
        ))}
      </div>

      {totalRendered > MAX_DOM_NODES && (
        <p className="rounded-md border border-gold-400/30 bg-gold-400/10 px-3 py-2 text-xs text-gold-200">
          {totalRendered.toLocaleString()} nodes rendered — collapse some branches for best performance.
        </p>
      )}

      {/* Company root */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-400/15 text-gold-300">
            <Home className="h-5 w-5" />
          </span>
          <div>
            <p className="font-bold">QuantumX Global Markets</p>
            <p className="text-xs text-muted-foreground">{rootDirectCount.toLocaleString()} Direct Members</p>
          </div>
          <div className="ml-auto">
            <Button size="sm" variant="outline" onClick={() => void expandBranch(ROOT)}>
              <Maximize2 className="h-4 w-4" /> Expand All
            </Button>
          </div>
        </div>
        <div className="mt-2">
          <NodeChildren
            parentId={ROOT}
            depth={0}
            ancestors={[{ id: ROOT, username: "QuantumX" }]}
            pages={pages}
            expanded={expanded}
            loadingIds={loadingIds}
            heatmap={heatmap}
            highlight={highlight}
            onToggle={toggle}
            onExpandBranch={expandBranch}
            onLoadMore={(pid) => loadChildren(pid, true)}
          />
        </div>
      </div>
    </div>
  );
}

function NodeChildren(props: {
  parentId: string;
  depth: number;
  ancestors: { id: string; username: string | null }[];
  pages: Record<string, Page>;
  expanded: Set<string>;
  loadingIds: Set<string>;
  heatmap: boolean;
  highlight: string | null;
  onToggle: (n: TreeNode, ancestors: { id: string; username: string | null }[]) => void;
  onExpandBranch: (id: string) => void;
  onLoadMore: (pid: string) => void;
}) {
  const { parentId, pages, loadingIds, depth } = props;
  const page = pages[parentId];

  // Fallback: if we've been "Loading…" for >3s with no result, show an empty
  // state instead of spinning forever.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (page || !loadingIds.has(parentId)) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(t);
  }, [page, loadingIds, parentId]);

  const emptyMsg = (
    <p className="py-2 text-xs text-muted-foreground" style={{ paddingLeft: depth * 20 + 8 }}>
      No downline found
    </p>
  );

  if (!page) {
    if (loadingIds.has(parentId) && !slow) {
      return (
        <p className="flex items-center gap-2 py-2 text-xs text-muted-foreground" style={{ paddingLeft: depth * 20 + 8 }}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </p>
      );
    }
    return emptyMsg; // fetch failed, returned nothing, or timed out (>3s)
  }
  if (page.nodes.length === 0) return emptyMsg;

  return (
    <div>
      {page.nodes.map((node) => (
        <NodeRow key={node.id} node={node} {...props} />
      ))}
      {page.hasMore && (
        <button
          onClick={() => props.onLoadMore(parentId)}
          className="ml-2 mt-1 text-xs font-medium text-gold-300 hover:underline"
          style={{ marginLeft: props.depth * 20 + 8 }}
        >
          Load {Math.min(20, page.total - page.loaded)} more ({page.total - page.loaded} left)
        </button>
      )}
    </div>
  );
}

function NodeRow(props: {
  node: TreeNode;
  depth: number;
  ancestors: { id: string; username: string | null }[];
  pages: Record<string, Page>;
  expanded: Set<string>;
  loadingIds: Set<string>;
  heatmap: boolean;
  highlight: string | null;
  onToggle: (n: TreeNode, ancestors: { id: string; username: string | null }[]) => void;
  onExpandBranch: (id: string) => void;
  onLoadMore: (pid: string) => void;
}) {
  const { node, depth, ancestors, expanded, heatmap, highlight } = props;
  const [hover, setHover] = useState(false);
  const isOpen = expanded.has(node.id);
  const childAncestors = [...ancestors, { id: node.id, username: node.username }];

  return (
    <div>
      <div
        id={`node-${node.id}`}
        className={cn(
          "group relative flex items-center gap-2 rounded-md py-1.5 pr-2 transition-colors hover:bg-secondary/50",
          highlight === node.id && "bg-gold-400/10 ring-1 ring-gold-400/50"
        )}
        style={{ paddingLeft: depth * 20 + 4 }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <button
          onClick={() => props.onToggle(node, ancestors)}
          className={cn("flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground", !node.hasChildren && "invisible")}
        >
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {heatmap && <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", heatColor(node.totalPnlPercent, node.status))} />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarSrc(node.avatarType)} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-full" />
        <span className="truncate text-sm font-medium">@{node.username ?? "user"}</span>
        <span className={cn("shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium", TIER_COLOR[node.tier] ?? TIER_COLOR.None)}>
          {node.tier}
        </span>
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {node.directCount} direct · {compact(node.teamCount)} team
        </span>
        <span
          className={cn(
            "ml-auto shrink-0 text-xs font-medium tabular-nums",
            node.totalPnlPercent > 0 ? "text-profit" : node.totalPnlPercent < 0 ? "text-loss" : "text-muted-foreground"
          )}
        >
          {node.totalPnlPercent > 0 ? "+" : ""}
          {node.totalPnlPercent}%
        </span>

        {hover && (
          <div className="absolute left-8 top-full z-30 mt-1 w-64 rounded-lg border border-border bg-card p-3 text-xs shadow-2xl">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarSrc(node.avatarType)} alt="" width={40} height={40} className="h-10 w-10 rounded-full" />
              <div>
                <p className="text-sm font-semibold">@{node.username ?? "user"}</p>
                <p className="text-muted-foreground">{node.tier} Tier</p>
              </div>
            </div>
            <dl className="mt-2 space-y-1">
              <Row label="Joined" value={new Date(node.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })} />
              <Row label="Direct referrals" value={node.directCount.toLocaleString()} />
              <Row label="Total team" value={node.teamCount.toLocaleString()} />
              <Row label="Team volume" value={`$${node.teamVolume.toLocaleString()}`} />
              <Row
                label="All-time P&L"
                value={`${node.totalPnlPercent > 0 ? "+" : ""}${node.totalPnlPercent}%`}
                tone={node.totalPnlPercent > 0 ? "profit" : node.totalPnlPercent < 0 ? "loss" : undefined}
              />
              <Row label="Status" value={node.status} tone={node.status === "Active" ? "profit" : undefined} />
            </dl>
          </div>
        )}
      </div>

      {isOpen && <NodeChildren {...props} parentId={node.id} depth={depth + 1} ancestors={childAncestors} />}
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "profit" | "loss" }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("font-medium", tone === "profit" && "text-profit", tone === "loss" && "text-loss")}>{value}</dd>
    </div>
  );
}
