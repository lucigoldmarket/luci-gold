"use client"

import { useState, useEffect, useMemo } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TrendingUp, Wallet, PieChart, Loader2, ArrowUpRight, ArrowDownLeft, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
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

const MEMBER_COLORS = [
  { text: "text-gold", bg: "bg-gold/10", bar: "bg-gold", dot: "bg-gold" },
  { text: "text-blue-400", bg: "bg-blue-400/10", bar: "bg-blue-400", dot: "bg-blue-400" },
  { text: "text-violet-400", bg: "bg-violet-400/10", bar: "bg-violet-400", dot: "bg-violet-400" },
  { text: "text-success", bg: "bg-success/10", bar: "bg-success", dot: "bg-success" },
]

export default function LaporanPage() {
  const months = getMonthOptions()
  const [selectedMonth, setSelectedMonth] = useState(months[0].value)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [investors, setInvestors] = useState<Profile[]>([])
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
        supabase.from("profit_sharing_members").select("full_name, share_pct").eq("is_active", true).order("created_at"),
        supabase.from("operational_expenses").select("amount_idr").gte("expense_date", from).lte("expense_date", to),
      ])

      setTransactions((txData as Transaction[]) ?? [])
      setInvestors((investorData as Profile[]) ?? [])
      setPsMembers((memberData as PSMember[]) ?? [])
      setTotalExpenses(((expData ?? []) as { amount_idr: number }[]).reduce((s, e) => s + e.amount_idr, 0))
      setLoading(false)
    }
    load()
  }, [selectedMonth])

  const totalProfit = useMemo(() => transactions.reduce((s, t) => s + (t.profit_idr ?? 0), 0), [transactions])
  const profitAfterExpenses = totalProfit - totalExpenses

  // Each PS member's calculated amount
  const memberShares = useMemo(() =>
    psMembers.map((m, i) => ({
      ...m,
      amount: profitAfterExpenses * m.share_pct / 100,
      color: MEMBER_COLORS[i % MEMBER_COLORS.length],
    })),
    [psMembers, profitAfterExpenses]
  )

  const investorProfileNames = useMemo(() => new Set(investors.map(i => i.full_name)), [investors])

  // Check if any PS member name matches an investor profile (individual allocation mode)
  const individualAllocations = useMemo(() =>
    memberShares.filter(m => investorProfileNames.has(m.full_name)),
    [memberShares, investorProfileNames]
  )

  // Find pool member named "investor" (case-insensitive) for equal-split mode
  const investorPoolMember = useMemo(() => {
    if (individualAllocations.length > 0) return null
    return memberShares.find(m => m.full_name.toLowerCase().trim() === 'investor') ?? null
  }, [memberShares, individualAllocations])

  // Per-investor amount map: { full_name → amount }
  const investorAmountMap = useMemo(() => {
    if (investors.length === 0) return {}
    if (investorPoolMember) {
      const perPerson = investorPoolMember.amount / investors.length
      return Object.fromEntries(investors.map(inv => [inv.full_name, perPerson]))
    }
    if (individualAllocations.length > 0) {
      return Object.fromEntries(individualAllocations.map(a => [a.full_name, a.amount]))
    }
    // Fallback: equal split of remaining after all PS member deductions
    const allocated = memberShares.reduce((s, m) => s + m.amount, 0)
    const remaining = Math.max(0, profitAfterExpenses - allocated)
    const perPerson = remaining / investors.length
    return Object.fromEntries(investors.map(inv => [inv.full_name, perPerson]))
  }, [investors, investorPoolMember, individualAllocations, memberShares, profitAfterExpenses])

  const totalInvestorAmount = useMemo(() =>
    Object.values(investorAmountMap).reduce((s, v) => s + v, 0),
    [investorAmountMap]
  )

  const weeklyData = useMemo(() => getWeeklyBreakdown(transactions), [transactions])
  const totalPsPct = useMemo(() => psMembers.reduce((s, m) => s + m.share_pct, 0), [psMembers])

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 page-content">
        <Header />
        <main className="p-4 md:p-6 lg:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="font-heading text-3xl font-bold text-foreground mb-1">Laporan Bagi Hasil</h1>
              <p className="text-muted-foreground text-sm">Ringkasan profit dan pembagian hasil per anggota</p>
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
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <Card className="bg-card border-border">
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-4">
                      <div className="rounded-lg bg-gold/10 p-3"><TrendingUp className="h-5 w-5 text-gold" /></div>
                      <div>
                        <p className="text-sm text-muted-foreground">Gross Profit</p>
                        <p className="text-xl font-bold text-gold tabular-nums">{formatRupiah(totalProfit)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-4">
                      <div className="rounded-lg bg-danger/10 p-3"><Wallet className="h-5 w-5 text-danger" /></div>
                      <div>
                        <p className="text-sm text-muted-foreground">Pengeluaran Ops</p>
                        <p className="text-xl font-bold text-danger tabular-nums">{formatRupiah(totalExpenses)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-4">
                      <div className="rounded-lg bg-success/10 p-3"><PieChart className="h-5 w-5 text-success" /></div>
                      <div>
                        <p className="text-sm text-muted-foreground">Profit Bersih</p>
                        <p className="text-xl font-bold text-success tabular-nums">{formatRupiah(profitAfterExpenses)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2 mb-6">
                {/* Distribusi per Anggota */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base text-foreground">Distribusi Profit Sharing</CardTitle>
                      {psMembers.length > 0 && (
                        <Badge variant="outline" className={Math.abs(totalPsPct - 100) < 0.01 ? "border-success/50 text-success bg-success/10" : "border-gold/50 text-gold bg-gold/10"}>
                          {totalPsPct.toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {psMembers.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        Belum ada anggota profit sharing. Tambahkan di <span className="text-gold">Pengaturan → Profit Sharing</span>.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {memberShares.map((m) => (
                          <div key={m.full_name} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${m.color.dot}`} />
                                <span className="text-sm font-medium text-foreground">{m.full_name}</span>
                                {m.full_name.toLowerCase().trim() === 'investor' && investors.length > 0 && (
                                  <span className="text-xs text-muted-foreground">÷ {investors.length} investor</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-xs font-medium ${m.color.text}`}>{m.share_pct}%</span>
                                <span className="text-sm font-bold text-foreground tabular-nums">{formatRupiah(m.amount)}</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div
                                className={`h-full ${m.color.bar} rounded-full transition-all duration-700`}
                                style={{ width: `${m.share_pct}%` }}
                              />
                            </div>
                          </div>
                        ))}

                        {/* Warning jika total != 100% */}
                        {Math.abs(totalPsPct - 100) > 0.01 && (
                          <p className="text-xs text-gold mt-2">
                            ⚠ Total {totalPsPct.toFixed(2)}% — seharusnya 100%. Sisa {(100 - totalPsPct).toFixed(2)}% tidak terdistribusi.
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Bagian per Investor */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-foreground">
                      Bagian per Investor
                      <span className="text-xs text-muted-foreground font-normal ml-2">
                        ({investors.length} investor aktif)
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {investors.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">Belum ada investor aktif.</p>
                    ) : (
                      <div className="space-y-3">
                        {investors.map((inv) => {
                          const amount = investorAmountMap[inv.full_name] ?? 0
                          return (
                            <div key={inv.id} className="flex items-center justify-between rounded-lg border border-border bg-background/50 px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-success/10 flex items-center justify-center text-success text-sm font-semibold">
                                  {inv.full_name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-medium text-foreground text-sm">{inv.full_name}</span>
                                  {investorPoolMember && (
                                    <p className="text-xs text-muted-foreground">{investorPoolMember.share_pct}% ÷ {investors.length}</p>
                                  )}
                                </div>
                              </div>
                              <span className="font-bold text-success tabular-nums">{formatRupiah(amount)}</span>
                            </div>
                          )
                        })}
                        {totalInvestorAmount > 0 && (
                          <div className="flex items-center justify-between border-t border-border pt-3 mt-1">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Total ke investor</span>
                            </div>
                            <span className="font-bold text-success tabular-nums">{formatRupiah(totalInvestorAmount)}</span>
                          </div>
                        )}
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
                          <TableHead className="text-muted-foreground text-right">Gross Profit</TableHead>
                          <TableHead className="text-muted-foreground text-right">Profit Bersih</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {weeklyData.map((row) => {
                          const weekExpense = totalExpenses / (weeklyData.length || 1)
                          const weekNet = row.profit - weekExpense
                          return (
                            <TableRow key={row.week} className="border-border hover:bg-background/50">
                              <TableCell className="text-foreground font-medium">Minggu {row.week}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{row.count}</TableCell>
                              <TableCell className="text-right text-gold tabular-nums">{formatRupiah(row.g2g)}</TableCell>
                              <TableCell className="text-right text-success tabular-nums">{formatRupiah(row.direct)}</TableCell>
                              <TableCell className="text-right font-medium text-foreground tabular-nums">{formatRupiah(row.profit)}</TableCell>
                              <TableCell className="text-right text-success tabular-nums">{formatRupiah(weekNet)}</TableCell>
                            </TableRow>
                          )
                        })}
                        <TableRow className="border-border bg-secondary/30 font-semibold">
                          <TableCell className="text-foreground">Total</TableCell>
                          <TableCell className="text-right text-foreground">{transactions.length}</TableCell>
                          <TableCell className="text-right text-gold tabular-nums">{formatRupiah(transactions.filter(t => t.channel === "g2g").reduce((s, t) => s + (t.profit_idr ?? 0), 0))}</TableCell>
                          <TableCell className="text-right text-success tabular-nums">{formatRupiah(transactions.filter(t => t.channel === "direct").reduce((s, t) => s + (t.profit_idr ?? 0), 0))}</TableCell>
                          <TableCell className="text-right text-foreground tabular-nums">{formatRupiah(totalProfit)}</TableCell>
                          <TableCell className="text-right text-success tabular-nums">{formatRupiah(profitAfterExpenses)}</TableCell>
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
