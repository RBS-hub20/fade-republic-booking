import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

export interface WithdrawalRequestEmailProps {
  firstName: string;
  lastName: string;
  username: string;
  amount: number;
  payoutMethod: string; // e.g. "USDT (TRC20)"
  walletAddress: string;
  dateRequested: string; // DD-MM-YYYY
}

const PORTAL_URL = "https://quantumxglobal.online/dashboard";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Section className="mb-0">
      <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
        <tr>
          <td className="py-1 text-[12px] font-semibold uppercase tracking-wide text-[#8b93a7]" style={{ width: "42%" }}>
            {label}
          </td>
          <td className="py-1 text-[13px] font-medium text-[#e5e7eb]" style={{ wordBreak: "break-all" }}>
            {value}
          </td>
        </tr>
      </table>
    </Section>
  );
}

export default function WithdrawalRequestEmail({
  firstName,
  lastName,
  username,
  amount,
  payoutMethod,
  walletAddress,
  dateRequested,
}: WithdrawalRequestEmailProps) {
  const money = `$${amount.toFixed(2)}`;
  return (
    <Html>
      <Head />
      <Preview>Your QuantumX withdrawal request is pending review (usually within 24 hours).</Preview>
      <Tailwind>
        <Body className="bg-[#0f1116] font-sans">
          <Container className="mx-auto my-8 w-[480px] max-w-full overflow-hidden rounded-xl border border-[#2d333d] bg-[#181b21]">
            {/* Purple/blue gradient banner */}
            <Section
              className="px-6 py-5 text-center"
              style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)" }}
            >
              <Text className="m-0 text-[20px] font-bold text-white">
                Quantum<span style={{ color: "#e0b54a" }}>X</span>
              </Text>
              <Text className="m-0 mt-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#e9d5ff]">
                Precision Trading, Real Results
              </Text>
            </Section>

            <Section className="px-6 py-6">
              <Heading className="m-0 text-[20px] font-bold text-white">Pending withdrawal request</Heading>

              <Text className="mt-4 text-[14px] leading-6 text-[#c7ccd6]">
                Dear {firstName} {lastName},
              </Text>
              <Text className="text-[14px] leading-6 text-[#c7ccd6]">
                Your withdrawal request is now pending for review.
              </Text>
              <Text className="text-[14px] leading-6 text-[#c7ccd6]">
                The review process is usually completed within 24 hours. We appreciate your patience with this
                processing time.
              </Text>
              <Text className="text-[14px] leading-6 text-[#c7ccd6]">
                Once approved, funds will be sent to your registered wallet. You&apos;ll receive another email
                confirming the transfer.
              </Text>

              <Text className="mt-4 text-[13px] font-medium text-[#8b93a7]">
                The following details were recorded from the transaction:
              </Text>

              <Section className="mt-2 rounded-lg border border-[#2d333d] bg-[#0f1116] px-4 py-3">
                <Row label="Username" value={username} />
                <Row label="Amount" value={money} />
                <Row label="Method" value={payoutMethod} />
                <Row label="Wallet Address" value={walletAddress} />
                <Row label="Date" value={dateRequested} />
                <Row label="Status" value="Pending Review" />
              </Section>

              <Section className="mt-6 text-center">
                <Button
                  href={PORTAL_URL}
                  className="rounded-lg bg-[#7c3aed] px-6 py-3 text-[14px] font-semibold text-white"
                >
                  CLIENT PORTAL
                </Button>
              </Section>

              <Text className="mt-6 text-[13px] leading-6 text-[#8b93a7]">
                If you have any questions, contact our Help Desk via Client Portal or Telegram.
              </Text>
            </Section>

            <Hr className="m-0 border-[#2d333d]" />
            <Section className="px-6 py-5">
              <Text className="m-0 text-[11px] leading-5 text-[#6b7280]">
                Risk Disclosure: Trading cryptocurrencies and other financial instruments involves substantial
                risk and may not be suitable for all investors. Past performance does not guarantee future
                results. Nothing here constitutes financial advice.
              </Text>
              <Text className="m-0 mt-3 text-[11px] text-[#6b7280]">© 2026 QuantumX Global</Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

WithdrawalRequestEmail.PreviewProps = {
  firstName: "Renz",
  lastName: "Santos",
  username: "renz_trader",
  amount: 250,
  payoutMethod: "USDT (TRC20)",
  walletAddress: "TNAnmDBcmmgdiAAX6GgGqV63RCrm2aqrqD",
  dateRequested: "13-07-2026",
} satisfies WithdrawalRequestEmailProps;
