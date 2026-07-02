import { redirect } from "next/navigation";

// Convenience alias: /deposit → the wallet's deposit flow.
export default function DepositRedirect() {
  redirect("/wallet");
}
