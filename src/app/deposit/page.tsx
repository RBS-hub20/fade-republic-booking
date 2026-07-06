import { redirect } from "next/navigation";

// Convenience alias: /deposit → the wallet's deposit flow. Any ?amount= (from a
// QX Tiers "Select Package" button) is forwarded so the amount stays pre-filled.
export default function DepositRedirect({
  searchParams,
}: {
  searchParams: { amount?: string };
}) {
  const amount = Number(searchParams.amount);
  redirect(Number.isFinite(amount) && amount > 0 ? `/wallet?amount=${amount}` : "/wallet");
}
