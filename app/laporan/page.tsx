"use client"

import { useState, useEffect, useMemo } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TrendingUp, Users, PieChart, Wallet, Loader2, ArrowUpRight, ArrowDownLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { calcProfitSharing } from "@/lib/calc"
import type { Transaction, Profile } from "@/lib/types"

function formatRupiah(num: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

function getMonthOptions() {
  const options = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    options.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
    })
  }
  return options
}

function getWeekOfMonth(dateStr: string): number {
  return Math.ceil(new Date(dateStr).getDate() / 7)
}

function getWeeklyBreakdown(transactions: Transaction[]) {
  const byWeek: Record<number, { week: number; profit: number; count: number; g2g: number; direct: number }> = {}
  for (const tx of transactions) {
    const w = tx.week_number > 0 ? tx.week_number : getWeekOfMonth(tx.transaction_date)
    if (!byWeek[w]) byWeek[w] = { week: w, profit: 0, count: 0, g2g: 0, direct: 0 }
    byWeek[w].profit += tx.profit_idr ?? 0
    byWeek[w].count += 1
    if (tx.channel === "g2g") byWeek[w].g2g += tx.profit_idr ?? 0
    else byWeek[w].direct += tx.profit_idr ?? 0
  }
  return Object.values(byWeek).sort((a, b) => a.week - b.week)
}

interface PSMember { full_name: string; share_pct: number }

export default function LaporanPage() {
  const months = getMonthOptions()
  const [selectedMonth, setSelectedMonth] = useState(months[0].value)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [investors, setInvestors] = useState<Profile[]>([])
  const [opsPct, setOpsPct] = useState(50)
  const [psMembers, setPsMembers] = useState<PSMember[]>([])
  const [loading, setLoading] = useState(true)

  const [totalExpenses, setTotalExpenses] = useState(0)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const [year, month] = selectedMonth.split("-").map(Number)
      const from = `${year}-${String(month).padStart(2, "0")}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const to = `${year}-${String(month).padStart(2, "0")}-${lastDay}`

      const [{ data: txData }, { data: investorData }, { data: memberData }, { data: expData }] = await Promise.all([
        supabase.from("transactions").select("*").eq("status", "completed").gte("transaction_date", from).lte("transaction_date", to),
        supabase.from("profiles").select("*").eq("role", "investor").eq("is_active", true),
        supabase.from("profit_sharing_members").select("full_name, share_pct").eq("is_active", true),
        supabase.from("operational_expenses").select("amount_idr").gte("expense_date", from).lte("expense_date", to),
      ])

      setTransactions((txData as Transaction[]) ?? [])
      setInvestors((investorData as Profile[]) ?? [])

      const members = (memberData ?? []) as PSMember[]
      setPsMembers(members)
      const totalInvestorPct = members.reduce((s, m) => s + m.share_pct, 0)
      setOpsPct(Math.max(0, 100 - totalInvestorPct))

      setTotalExpenses(((expData ?? []) as { amount_idr: number }[]).reduce((s, e) => s + e.amount_idr, 0))
      setLoading(false)
    }
    load()
  }, [selectedMonth])

  const totalProfit = useMemo(() => transactions.reduce((s, t) => s + (t.profit_idr ?? 0), 0), [transactions])
  const sharing = useMemo(() => calcProfitSharing(totalProfit, totalExpenses, opsPct, investors.length), [totalProfit, totalExpenses, opsPct, investors.length])
  const weeklyData = useMemo(() => getWeeklyBreakdown(transactions), [transactions])

  const memberShareMap = useMemo(
    () => Object.fromEntries(psMembers.map(m => [m.full_name, m.share_pct])),
    [psMembers]
  )

  const investorPct = 100 - opsPct
  const donutAngle = sharing.investorTotal / (totalProfit || 1) * 360

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 page-content">
        <Header />
        <main className="p-4 md:p-6 lg:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="font-heading text-3xl font-bold text-foreground mb-1">Laporan Bagi Hasil</h1>
              <p className="text-muted-foreground text-sm">Ringkasan profit dan pembagian hasil dengan pemodal</p>
            </div>
            <Select value={selectedMonth} onValueChange={(v) => v && setSelectedMonth(v)}>
              <SelectTrigger className="w-52 bg-card border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat data...
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
                {[
                  { label: "Gross Profit", value: formatRupiah(totalProfit), icon: <TrendingUp className="h-5 w-5 text-gold" />, color: "text-gold", bg: "bg-gold/10" },
                  { label: "Pengeluaran Ops", value: formatRupiah(totalExpenses), icon: <Wallet className="h-5 w-5 text-danger" />, color: "text-danger", bg: "bg-danger/10" },
                  { label: "Profit Bersih", value: formatRupiah(sharing.profitAfterExpenses), icon: <PieChart className="h-5 w-5 text-success" />, color: "text-success", bg: "bg-success/10" },
                  { label: "Bagian Operator", value: formatRupiah(sharing.opsShare), icon: <PieChart className="h-5 w-5 text-gold" />, color: "text-foreground", bg: "bg-gold/10" },
                  { label: "Per Investor", value: investors.length > 0 ? formatRupiah(sharing.perInvestor) : "—", icon: <Users className="h-5 w-5 text-success" />, color: "text-success", bg: "bg-success/10" },
                ].map((card) => (
                  <Card key={card.label} className="bg-card border-border">
                    <CardContent className="pt-5">
                      <div className="flex items-center gap-4">
                        <div className={`rounded-lg ${card.bg} p-3`}>{card.icon}</div>
                        <div>
                          <p className="text-sm text-muted-foreground">{card.label}</p>
                          <p className={`text-xl font-bold ${card.color} tabular-nums`}>{card.value}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid gap-6 lg:grid-cols-3 mb-6">
                {/* Distribusi Profit Donut */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-foreground">Distribusi Profit</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-center py-4">
                      <div className="relative w-36 h-36">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                          <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--border))" strokeWidth="18" />
                          {totalProfit > 0 && (
                            <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--success))"
                              strokeWidth="18"
                              strokeDasharray={`${(sharing.investorTotal / totalProfit) * 251.2} 251.2`}
                            />
                          )}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <p className="text-xl font-bold text-foreground">{investorPct}%</p>
                          <p className="text-xs text-muted-foreground">Investor</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-center gap-6 mt-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-success" />
                        <span className="text-xs text-muted-foreground">Investor {investorPct}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-border" />
                        <span className="text-xs text-muted-foreground">Operator {opsPct}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Per Investor */}
                <Card className="bg-card border-border lg:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-foreground">
                      Bagian per Investor
                      <span className="text-xs text-muted-foreground font-normal ml-2">
                        ({psMembers.length > 0 ? psMembers.length : investors.length} investor aktif{psMembers.length === 0 ? " · split rata" : ""})
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {investors.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">Belum ada investor aktif.</p>
                    ) : (
                      <div className="space-y-3">
                        {investors.map((inv) => {
                          const memberPct = memberShareMap[inv.full_name]
                          const amount = memberPct != null
                            ? sharing.profitAfterExpenses * memberPct / 100
                            : sharing.perInvestor
                          const pctLabel = memberPct != null ? ` (${memberPct}%)` : ""
                          return (
                          <div key={inv.id} className="flex items-center justify-between rounded-lg border border-border bg-background/50 px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold">
                                {inv.full_name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-medium text-foreground text-sm">{inv.full_name}</span>
                                {pctLabel && <p className="text-xs text-muted-foreground">{pctLabel} dari profit bersih</p>}
                              </div>
                            </div>
                            <span className="font-bold text-success">{formatRupiah(amount)}</span>
                          </div>
                          )
                        })}
                        {totalProfit === 0 && (
                          <p className="text-xs text-muted-foreground text-center pt-2">Belum ada profit di periode ini</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Weekly Breakdown */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-foreground">Rekap per Minggu</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {weeklyData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">Tidak ada transaksi completed di periode ini.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-muted-foreground">Minggu ke-</TableHead>
                          <TableHead className="text-muted-foreground text-right">Transaksi</TableHead>
                          <TableHead className="text-muted-foreground text-right">
                            <span className="flex items-center justify-end gap-1">
                              <ArrowUpRight className="h-3 w-3 text-gold" /> G2G
                            </span>
                          </TableHead>
                          <TableHead className="text-muted-foreground text-right">
                            <span className="flex items-center justify-end gap-1">
                              <ArrowDownLeft className="h-3 w-3 text-success" /> Direct
                            </span>
                          </TableHead>
                          <TableHead className="text-muted-foreground text-right">Total Profit</TableHead>
                          <TableHead className="text-muted-foreground text-right">Bagian Operator</TableHead>
                          <TableHead className="text-muted-foreground text-right">Bagian Investor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {weeklyData.map((row) => {
                          const s = calcProfitSharing(row.profit, 0, opsPct, investors.length)
                          return (
                            <TableRow key={row.week} className="border-border hover:bg-background/50">
                              <TableCell className="text-foreground font-medium">Minggu {row.week}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{row.count}</TableCell>
                              <TableCell className="text-right text-gold">{formatRupiah(row.g2g)}</TableCell>
                              <TableCell className="text-right text-success">{formatRupiah(row.direct)}</TableCell>
                              <TableCell className="text-right font-medium text-foreground">{formatRupiah(row.profit)}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{formatRupiah(s.opsShare)}</TableCell>
                              <TableCell className="text-right text-success">{formatRupiah(s.investorTotal)}</TableCell>
                            </TableRow>
                          )
                        })}
                        <TableRow className="border-border bg-secondary/30 font-semibold">
                          <TableCell className="text-foreground">Total</TableCell>
                          <TableCell className="text-right text-foreground">{transactions.length}</TableCell>
                          <TableCell className="text-right text-gold">{formatRupiah(transactions.filter(t => t.channel === "g2g").reduce((s, t) => s + (t.profit_idr ?? 0), 0))}</TableCell>
                          <TableCell className="text-right text-success">{formatRupiah(transactions.filter(t => t.channel === "direct").reduce((s, t) => s + (t.profit_idr ?? 0), 0))}</TableCell>
                          <TableCell className="text-right text-foreground">{formatRupiah(totalProfit)}</TableCell>
                          <TableCell className="text-right text-foreground">{formatRupiah(sharing.opsShare)}</TableCell>
                          <TableCell className="text-right text-success">{formatRupiah(sharing.investorTotal)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
