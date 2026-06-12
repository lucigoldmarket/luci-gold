"use client"

import { useState, useEffect, useMemo } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { TrendingUp, Wallet, PieChart, Loader2, ArrowUpRight, ArrowDownLeft, Users, BarChart2, Archive, ChevronDown, ChevronUp } from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { createClient } from "@/lib/supabase/client"
import { computeSaldo, type SaldoResult } from "@/lib/saldo"
import type { Transaction, Profile, Period } from "@/lib/types"
import { cn } from "@/lib/utils"

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

function getWeeklyBreakdown(
  transactions: Transaction[],
  expenses: { amount_idr: number; expense_date: string }[]
) {
  const byWeek: Record<number, { week: number; profit: number; count: number; g2g: number; direct: number; expenses: number }> = {}

  for (const tx of transactions) {
    const w = tx.week_number > 0 ? tx.week_number : getWeekOfMonth(tx.transaction_date)
    if (!byWeek[w]) byWeek[w] = { week: w, profit: 0, count: 0, g2g: 0, direct: 0, expenses: 0 }
    byWeek[w].profit += tx.profit_idr ?? 0
    byWeek[w].count += 1
    if (tx.channel === "g2g") byWeek[w].g2g += tx.profit_idr ?? 0
    else byWeek[w].direct += tx.profit_idr ?? 0
  }

  for (const exp of expenses) {
    const w = getWeekOfMonth(exp.expense_date)
    if (!byWeek[w]) byWeek[w] = { week: w, profit: 0, count: 0, g2g: 0, direct: 0, expenses: 0 }
    byWeek[w].expenses += exp.amount_idr
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
  const [expensesList, setExpensesList] = useState<{ amount_idr: number; expense_date: string }[]>([])
  const [saldoData, setSaldoData] = useState<SaldoResult | null>(null)

  // Tutup Buku state
  const [periods, setPeriods] = useState<Period[]>([])
  const [showTutupDialog, setShowTutupDialog] = useState(false)
  const [periodName, setPeriodName] = useState("")
  const [periodStart, setPeriodStart] = useState("")
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10))
  const [periodNotes, setPeriodNotes] = useState("")
  const [savingPeriod, setSavingPeriod] = useState(false)
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null)
  const [periodTxCounts, setPeriodTxCounts] = useState<Record<string, number>>({})

  // Load saldo once (cumulative, not per-month)
  useEffect(() => {
    computeSaldo().then(setSaldoData)
  }, [])

  // Load periods
  async function loadPeriods() {
    const supabase = createClient()
    const { data } = await supabase.from("periods").select("*").order("created_at", { ascending: false })
    if (data) {
      setPeriods(data as Period[])
      // Count transactions per period
      const counts: Record<string, number> = {}
      await Promise.all(
        (data as Period[]).map(async (p) => {
          const { count } = await supabase
            .from("transactions")
            .select("id", { count: "exact", head: true })
            .eq("archived_period_id", p.id)
          counts[p.id] = count ?? 0
        })
      )
      setPeriodTxCounts(counts)
    }
  }

  useEffect(() => { loadPeriods() }, [])

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
        supabase.from("operational_expenses").select("amount_idr, expense_date").gte("expense_date", from).lte("expense_date", to),
      ])

      setTransactions((txData as Transaction[]) ?? [])
      setInvestors((investorData as Profile[]) ?? [])
      setPsMembers((memberData as PSMember[]) ?? [])
      const expList = ((expData ?? []) as { amount_idr: number; expense_date: string }[])
      setExpensesList(expList)
      setTotalExpenses(expList.reduce((s, e) => s + e.amount_idr, 0))
      setLoading(false)
    }
    load()
  }, [selectedMonth])

  const cumulativeProfit = useMemo(() => {
    if (!saldoData) return null
    const totalInvested = saldoData.initialSaldo + saldoData.totalDeposits
    return (saldoData.saldo + saldoData.floatG2GPending + saldoData.g2gBalance) - totalInvested
  }, [saldoData])

  const totalProfit = useMemo(() => transactions.reduce((s, t) => s + (t.profit_idr ?? 0), 0), [transactions])

  const memberShares = useMemo(() => {
    const profitForSharing = totalProfit - totalExpenses
    return psMembers.map((m, i) => ({
      ...m,
      amount: profitForSharing * m.share_pct / 100,
      color: MEMBER_COLORS[i % MEMBER_COLORS.length],
    }))
  }, [psMembers, totalProfit, totalExpenses])

  const investorProfileNames = useMemo(() => new Set(investors.map(i => i.full_name)), [investors])
  const individualAllocations = useMemo(() => memberShares.filter(m => investorProfileNames.has(m.full_name)), [memberShares, investorProfileNames])
  const investorPoolMember = useMemo(() => {
    if (individualAllocations.length > 0) return null
    return memberShares.find(m => m.full_name.toLowerCase().trim() === 'investor') ?? null
  }, [memberShares, individualAllocations])

  const profitAfterExpenses = totalProfit - totalExpenses

  const investorAmountMap = useMemo(() => {
    if (investors.length === 0) return {}
    if (investorPoolMember) {
      const perPerson = investorPoolMember.amount / investors.length
      return Object.fromEntries(investors.map(inv => [inv.full_name, perPerson]))
    }
    if (individualAllocations.length > 0) {
      return Object.fromEntries(individualAllocations.map(a => [a.full_name, a.amount]))
    }
    const allocated = memberShares.reduce((s, m) => s + m.amount, 0)
    const remaining = Math.max(0, profitAfterExpenses - allocated)
    const perPerson = remaining / investors.length
    return Object.fromEntries(investors.map(inv => [inv.full_name, perPerson]))
  }, [investors, investorPoolMember, individualAllocations, memberShares, profitAfterExpenses])

  const weeklyData = useMemo(() => getWeeklyBreakdown(transactions, expensesList), [transactions, expensesList])
  const totalPsPct = useMemo(() => psMembers.reduce((s, m) => s + m.share_pct, 0), [psMembers])

  async function handleTutupBuku() {
    if (!periodName || !periodStart || !periodEnd) return
    setSavingPeriod(true)
    const supabase = createClient()
    const { data: period, error: pErr } = await supabase
      .from("periods")
      .insert({ name: periodName, start_date: periodStart, end_date: periodEnd, notes: periodNotes || null })
      .select("id").single()
    if (pErr || !period) { setSavingPeriod(false); return }

    await supabase.from("transactions")
      .update({ archived_period_id: period.id })
      .gte("transaction_date", periodStart)
      .lte("transaction_date", periodEnd)
      .is("archived_period_id", null)

    setSavingPeriod(false)
    setShowTutupDialog(false)
    setPeriodName(""); setPeriodStart(""); setPeriodEnd(new Date().toISOString().slice(0, 10)); setPeriodNotes("")
    await loadPeriods()
    // Refresh saldo
    computeSaldo().then(setSaldoData)
  }

  function openTutupDialog() {
    // Auto-fill start_date from last period's end_date + 1 day
    if (periods.length > 0) {
      const lastEnd = periods[0].end_date
      const next = new Date(lastEnd)
      next.setDate(next.getDate() + 1)
      setPeriodStart(next.toISOString().slice(0, 10))
    } else {
      setPeriodStart("")
    }
    setPeriodEnd(new Date().toISOString().slice(0, 10))
    setShowTutupDialog(true)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 page-content">
        <Header />
        <main className="p-4 md:p-6 lg:p-8">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
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
            <Button onClick={openTutupDialog} variant="outline" className="border-border text-foreground hover:border-gold/50 hover:text-gold gap-2">
              <Archive className="h-4 w-4" /> Tutup Buku
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat data...
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-2 mb-6">
                {/* Total Profit — kumulatif semua waktu */}
                <Card className="bg-card border-border">
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-4">
                      <div className="rounded-lg bg-gold/10 p-3"><TrendingUp className="h-5 w-5 text-gold" /></div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Profit</p>
                        <p className={cn("text-xl font-bold tabular-nums", (cumulativeProfit ?? 0) >= 0 ? "text-gold" : "text-danger")}>
                          {cumulativeProfit != null ? formatRupiah(cumulativeProfit) : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">kumulatif · termasuk float G2G</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {/* Pengeluaran ops bulan ini */}
                <Card className="bg-card border-border">
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-4">
                      <div className="rounded-lg bg-danger/10 p-3"><Wallet className="h-5 w-5 text-danger" /></div>
                      <div>
                        <p className="text-sm text-muted-foreground">Pengeluaran Ops</p>
                        <p className="text-xl font-bold text-danger tabular-nums">{formatRupiah(totalExpenses)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">bulan ini · {expensesList.length} item</p>
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
                        {Math.abs(totalPsPct - 100) > 0.01 && (
                          <p className="text-xs text-gold mt-2">
                            ⚠ Total {totalPsPct.toFixed(2)}% — seharusnya 100%.
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Grafik Transaksi Mingguan */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <BarChart2 className="h-4 w-4 text-primary" />
                      <CardTitle className="text-base text-foreground">Grafik Transaksi Mingguan</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {weeklyData.length === 0 ? (
                      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                        Belum ada data transaksi di periode ini
                      </div>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height={180}>
                          <AreaChart
                            data={weeklyData.map((w) => ({ ...w, label: `Minggu ${w.week}` }))}
                            margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient id="wkG2gGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#d4a017" stopOpacity={0.35} />
                                <stop offset="95%" stopColor="#d4a017" stopOpacity={0.03} />
                              </linearGradient>
                              <linearGradient id="wkDirectGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.03} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
                            <YAxis
                              tickFormatter={(v) => {
                                const abs = Math.abs(v)
                                if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(1)}jt`
                                if (abs >= 1_000) return `${(abs / 1_000).toFixed(0)}rb`
                                return String(abs)
                              }}
                              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                              tickLine={false} axisLine={false} width={36}
                            />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null
                                const g2g = (payload.find((p) => p.dataKey === "g2g")?.value as number) ?? 0
                                const direct = (payload.find((p) => p.dataKey === "direct")?.value as number) ?? 0
                                const count = (payload[0]?.payload as { count: number })?.count ?? 0
                                return (
                                  <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg space-y-1">
                                    <p className="text-muted-foreground font-medium">{label}</p>
                                    <p className="text-muted-foreground">{count} transaksi</p>
                                    {g2g > 0 && (
                                      <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-gold inline-block" />
                                        <span className="text-muted-foreground">G2G</span>
                                        <span className="font-semibold text-gold ml-auto tabular-nums">{formatRupiah(g2g)}</span>
                                      </div>
                                    )}
                                    {direct > 0 && (
                                      <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-success inline-block" />
                                        <span className="text-muted-foreground">Direct</span>
                                        <span className="font-semibold text-success ml-auto tabular-nums">{formatRupiah(direct)}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between border-t border-border pt-1">
                                      <span className="text-muted-foreground">Total</span>
                                      <span className="font-bold text-foreground tabular-nums">{formatRupiah(g2g + direct)}</span>
                                    </div>
                                  </div>
                                )
                              }}
                            />
                            <Area type="monotone" dataKey="g2g" stackId="a" stroke="#d4a017" strokeWidth={2} fill="url(#wkG2gGrad)" dot={false} activeDot={{ r: 4, fill: "#d4a017", strokeWidth: 0 }} />
                            <Area type="monotone" dataKey="direct" stackId="a" stroke="#22c55e" strokeWidth={2} fill="url(#wkDirectGrad)" dot={false} activeDot={{ r: 4, fill: "#22c55e", strokeWidth: 0 }} />
                          </AreaChart>
                        </ResponsiveContainer>
                        <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <div className="h-2.5 w-2.5 rounded-sm bg-gold" /> G2G
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <div className="h-2.5 w-2.5 rounded-sm bg-success" /> Direct
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Weekly Breakdown */}
              <Card className="bg-card border-border mb-6">
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
                          <TableHead className="text-muted-foreground text-right">Pengeluaran</TableHead>
                          <TableHead className="text-muted-foreground text-right">Profit Bersih</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {weeklyData.map((row) => {
                          const weekNet = row.profit - row.expenses
                          return (
                            <TableRow key={row.week} className="border-border hover:bg-background/50">
                              <TableCell className="text-foreground font-medium">Minggu {row.week}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{row.count}</TableCell>
                              <TableCell className="text-right text-gold tabular-nums">{formatRupiah(row.g2g)}</TableCell>
                              <TableCell className="text-right text-success tabular-nums">{formatRupiah(row.direct)}</TableCell>
                              <TableCell className="text-right font-medium text-foreground tabular-nums">{formatRupiah(row.profit)}</TableCell>
                              <TableCell className="text-right text-danger tabular-nums text-sm">
                                {row.expenses > 0 ? `-${formatRupiah(row.expenses)}` : "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                <span className={weekNet >= 0 ? "text-success font-medium" : "text-danger font-medium"}>{formatRupiah(weekNet)}</span>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                        <TableRow className="border-border bg-secondary/30 font-semibold">
                          <TableCell className="text-foreground">Total</TableCell>
                          <TableCell className="text-right text-foreground">{transactions.length}</TableCell>
                          <TableCell className="text-right text-gold tabular-nums">{formatRupiah(transactions.filter(t => t.channel === "g2g").reduce((s, t) => s + (t.profit_idr ?? 0), 0))}</TableCell>
                          <TableCell className="text-right text-success tabular-nums">{formatRupiah(transactions.filter(t => t.channel === "direct").reduce((s, t) => s + (t.profit_idr ?? 0), 0))}</TableCell>
                          <TableCell className="text-right text-foreground tabular-nums">{formatRupiah(totalProfit)}</TableCell>
                          <TableCell className="text-right text-danger tabular-nums">{totalExpenses > 0 ? `-${formatRupiah(totalExpenses)}` : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className={(totalProfit - totalExpenses) >= 0 ? "text-success" : "text-danger"}>{formatRupiah(totalProfit - totalExpenses)}</span>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Riwayat Tutup Buku */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Archive className="h-4 w-4 text-primary" />
                      <CardTitle className="text-base text-foreground">Riwayat Tutup Buku</CardTitle>
                    </div>
                    <span className="text-xs text-muted-foreground">{periods.length} periode</span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {periods.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Belum ada periode yang ditutup. Klik <span className="text-gold">Tutup Buku</span> untuk memulai.
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {periods.map((p) => (
                        <div key={p.id}>
                          <button
                            onClick={() => setExpandedPeriod(expandedPeriod === p.id ? null : p.id)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-background/50 transition-colors text-left"
                          >
                            <div className="flex items-center gap-3">
                              <Archive className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-foreground">{p.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(p.start_date).toLocaleDateString("id-ID")} – {new Date(p.end_date).toLocaleDateString("id-ID")}
                                  {periodTxCounts[p.id] !== undefined && ` · ${periodTxCounts[p.id]} transaksi`}
                                </p>
                              </div>
                            </div>
                            {expandedPeriod === p.id
                              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            }
                          </button>
                          {expandedPeriod === p.id && (
                            <div className="px-4 pb-3 bg-background/20">
                              <div className="text-xs text-muted-foreground space-y-1 pl-7">
                                <p>Dibuat: {new Date(p.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
                                {p.notes && <p>Catatan: {p.notes}</p>}
                                <p className="text-gold/70">Lihat transaksi arsip: aktifkan "Tampilkan Arsip" di halaman Transaksi</p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </main>
      </div>

      {/* Tutup Buku Dialog */}
      <Dialog open={showTutupDialog} onOpenChange={(v) => !v && setShowTutupDialog(false)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Archive className="h-4 w-4" /> Tutup Buku
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Transaksi dalam rentang tanggal ini akan dipindahkan ke arsip dan tidak muncul di list transaksi utama.
            </p>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-sm">Nama Periode</Label>
              <Input value={periodName} onChange={e => setPeriodName(e.target.value)}
                className="bg-background border-border text-foreground"
                placeholder="cth: Periode Mei 2026, Q2 2026..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-sm">Dari Tanggal</Label>
                <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
                  className="bg-background border-border text-foreground" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-sm">Sampai Tanggal</Label>
                <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
                  className="bg-background border-border text-foreground" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-sm">Catatan (opsional)</Label>
              <Input value={periodNotes} onChange={e => setPeriodNotes(e.target.value)}
                className="bg-background border-border text-foreground" placeholder="Catatan tambahan..." />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 border-border" onClick={() => setShowTutupDialog(false)}>Batal</Button>
              <Button
                onClick={handleTutupBuku}
                disabled={savingPeriod || !periodName || !periodStart || !periodEnd}
                className="flex-1 bg-gold hover:bg-gold/90 text-background"
              >
                {savingPeriod ? <Loader2 className="h-4 w-4 animate-spin" /> : "Tutup Buku"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
