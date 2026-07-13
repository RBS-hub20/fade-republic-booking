"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, BadgeCheck, Pencil, Check, X, Loader2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  COUNTRY_CODES,
  DEFAULT_COUNTRY_CODE,
  formatPhoneDisplay,
  telHref,
  isValidPhoneNumber,
} from "@/lib/phone";

export function ClientPhoneField({
  clientId,
  countryCode,
  phoneNumber,
  phoneVerified,
  canEdit,
}: {
  clientId: string;
  countryCode: string | null;
  phoneNumber: string | null;
  phoneVerified: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [cc, setCc] = useState(countryCode || DEFAULT_COUNTRY_CODE);
  const [num, setNum] = useState(phoneNumber || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const display = phoneNumber ? formatPhoneDisplay(countryCode || DEFAULT_COUNTRY_CODE, phoneNumber) : "";

  async function save() {
    if (!isValidPhoneNumber(num)) {
      setError("10–11 digits required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/phone`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryCode: cc, phoneNumber: num }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || "Save failed.");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-2">
          <Select value={cc} onChange={(e) => setCc(e.target.value)} className="w-28" aria-label="Country code">
            {COUNTRY_CODES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </Select>
          <Input
            value={num}
            onChange={(e) => setNum(e.target.value.replace(/\D/g, "").slice(0, 11))}
            inputMode="numeric"
            placeholder="917 123 4567"
            className="h-9 w-40"
            aria-label="Phone number"
          />
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md p-1.5 text-profit hover:bg-secondary"
            title="Save"
            aria-label="Save phone"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setError(null);
              setCc(countryCode || DEFAULT_COUNTRY_CODE);
              setNum(phoneNumber || "");
            }}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"
            title="Cancel"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {error && <p className="text-xs text-loss">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <Phone className="h-4 w-4 text-muted-foreground" />
      {phoneNumber ? (
        <>
          <a href={telHref(cc, num)} className="font-medium text-foreground hover:text-gold-300">
            {display}
          </a>
          {phoneVerified ? (
            <Badge variant="success" className="gap-1">
              <BadgeCheck className="h-3 w-3" /> Verified
            </Badge>
          ) : (
            <Badge variant="outline">Unverified</Badge>
          )}
          <a
            href={telHref(cc, num)}
            className="inline-flex items-center gap-1 rounded-md bg-gold-400 px-2.5 py-1 text-xs font-semibold text-black transition-colors hover:bg-gold-300"
          >
            <Phone className="h-3 w-3" /> Call
          </a>
        </>
      ) : (
        <span className="text-muted-foreground">No phone on file</span>
      )}
      {canEdit && (
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1 rounded-md p-1 text-xs text-muted-foreground hover:text-gold-300"
          title="Edit phone"
          aria-label="Edit phone"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
