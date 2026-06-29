import { PageHeader } from "@/components/shell/page-header";
import { ChartsView } from "@/components/charts/charts-view";

/*
 * Live forex charting page.
 *
 * Charts are powered by TradingView's free embeddable widgets (no API key).
 * This is READ-ONLY market data. To connect a real broker for live account
 * data or order execution, integrate a broker API (e.g. OANDA v20, MetaApi,
 * cTrader Open API) in a server route and surface it alongside these charts.
 */
export default function ChartsPage() {
  return (
    <>
      <PageHeader
        title="Live Forex Charts"
        subtitle="OANDA:XAUUSD and majors · powered by TradingView (read-only market data)"
      />
      <ChartsView />
    </>
  );
}
