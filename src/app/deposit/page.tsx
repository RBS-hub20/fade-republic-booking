import { redirect } from "next/navigation";

// Convenience alias: /deposit → the wallet's deposit flow. A QX Tiers
// "Select Package" button links here as ?package=gold&amount=300&locked=1; we
// forward those params so the amount stays pre-filled (and locked) on /wallet.
export default function DepositRedirect({
  searchParams,
}: {
  searchParams: { amount?: string; package?: string; locked?: string };
}) {
  const params = new URLSearchParams();
  const amount = Number(searchParams.amount);
  if (Number.isFinite(amount) && amount > 0) params.set("amount", String(amount));
  if (searchParams.package) params.set("package", searchParams.package);
  if (searchParams.locked) params.set("locked", searchParams.locked);
  const qs = params.toString();
  redirect(qs ? `/wallet?${qs}` : "/wallet");
}
