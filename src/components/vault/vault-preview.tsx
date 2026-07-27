"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileImage, FileText, Loader2, Lock, Plus, ShieldCheck, Trash2 } from "lucide-react";
import {
  addDocument,
  listDocuments,
  openDocument,
  removeDocument,
  seedDocuments,
  vaultStatus,
  type VaultBackend,
  type VaultDoc,
} from "@/lib/egov/vault";
import { SEED_VAULT_DOCS, fileSize } from "@/lib/egov/data";

function DocIcon({ type }: { type: string }) {
  const Icon = type.startsWith("image/") ? FileImage : FileText;
  return <Icon className="h-4 w-4 text-white/45" />;
}

export function VaultPreview() {
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const [backend, setBackend] = useState<VaultBackend | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setDocs(await listDocuments());
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await seedDocuments(SEED_VAULT_DOCS);
        const status = await vaultStatus();
        if (!alive) return;
        setBackend(status.backend);
        await refresh();
      } catch {
        if (alive) setError("Vault unavailable in this browser");
      }
    })();
    return () => {
      alive = false;
    };
  }, [refresh]);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) await addDocument(file);
      await refresh();
    } catch {
      setError("Could not encrypt that file — try another one.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleOpen(doc: VaultDoc) {
    const blob = await openDocument(doc.id);
    if (!blob) return;
    // Decrypt in memory, hand the browser a short-lived object URL.
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function handleRemove(id: string) {
    await removeDocument(id);
    await refresh();
  }

  return (
    <section className="eg-panel eg-sheen rounded-xl p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-white">
          <Lock className="h-3.5 w-3.5 text-egov-yellow" />
          Vault
          <span className="text-[11px] font-normal text-white/40">(Encrypted Locally)</span>
        </h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-egov-green/10 px-2 py-0.5 text-[10px] font-semibold text-egov-green ring-1 ring-inset ring-egov-green/25">
          <ShieldCheck className="h-3 w-3" />
          AES-GCM
        </span>
      </header>

      <ul className="mt-3 space-y-1.5">
        <AnimatePresence initial={false}>
          {docs.map((doc) => (
            <motion.li
              key={doc.id}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="group flex items-center gap-2.5 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2 transition hover:border-white/15 hover:bg-white/[0.05]"
            >
              <DocIcon type={doc.type} />
              <button
                type="button"
                onClick={() => handleOpen(doc)}
                className="min-w-0 flex-1 text-left focus-visible:outline-none"
                title={`Decrypt and download ${doc.name}`}
              >
                <p className="truncate text-[12.5px] font-medium text-white/85">{doc.name}</p>
                <p className="text-[10.5px] text-white/35">{fileSize(doc.size)} • encrypted</p>
              </button>
              <Lock className="h-3.5 w-3.5 shrink-0 text-egov-yellow/80 group-hover:hidden" />
              <button
                type="button"
                onClick={() => handleRemove(doc.id)}
                aria-label={`Remove ${doc.name}`}
                className="hidden shrink-0 rounded p-0.5 text-white/35 transition hover:text-egov-red group-hover:block"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 py-2 text-[12.5px] font-medium text-white/65 transition hover:border-egov-action/60 hover:text-white disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        {busy ? "Encrypting…" : "Add Doc"}
      </button>

      <p className="mt-2.5 text-[10.5px] leading-snug text-white/30">
        {error ??
          (backend === "localstorage"
            ? "IndexedDB blocked — falling back to localStorage on this device."
            : "Keys stay in this browser. Walang kopya sa server.")}
      </p>
    </section>
  );
}
