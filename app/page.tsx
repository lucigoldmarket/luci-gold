import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { DashboardStats, HeroStats } from "@/components/dashboard-stats"
import { RecentTransactions } from "@/components/recent-transactions"
import { InvestorSummary } from "@/components/investor-summary"
import { ProfitChart } from "@/components/profit-chart"

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 page-content">
        <div className="px-4 md:px-6 lg:px-8 pb-10">
          <Header />

          {/* Hero */}
          <section className="mb-6">
            <HeroStats />
          </section>

          {/* 4 Stat Cards */}
          <section className="mb-6">
            <DashboardStats />
          </section>

          {/* Chart full width */}
          <section className="mb-6">
            <ProfitChart />
          </section>

          {/* Bottom grid: Recent Transactions + Profit Sharing */}
          <div className="grid gap-6 lg:grid-cols-2">
            <RecentTransactions />
            <InvestorSummary />
          </div>
        </div>
      </div>
    </div>
  )
}
