"use client"

import { useEffect, useState } from "react"
import { TrendingUp, TrendingDown, Wallet, Clock, Activity, ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { computeSaldo, type SaldoResult } from "@/lib/saldo"

function fmt(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value)
}

function compact(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? "-" : ""
  if (abs >= 1_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1)}M`
  if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toFixed(1)} jt`
  if (abs >= 1_000) return `${sign}Rp ${(abs / 1_000).toFixed(0)} rb`
  return fmt(value)
}

interface MonthStats {
  profitThisMonth: number; profitToday: number; txThisMonth: number
  g2gProfitMonth: number; directProfitMonth: number; avgMarginMonth: number
}

function StatCard({ title, value, sub, subType = "neutral", icon }: {
  title: string; value: string; sub?: string
  subType?: "positive" | "negative" | "neutral"; icon: React.ReactNode
}) {
  return (
    <Card className="card-glow border-border bg-card hover:border-gold/40 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-xl font-bold text-foreground tabular-nums">{value}</div>
        {sub && (
          <p className={cn("text-xs mt-1 truncate", {
            "text-success": subType === "positive",
            "text-danger": subType === "negative",
            "text-muted-foreground": subType === "neutral",
          })}>
            {subType === "positive" && <TrendingUp className="inline h-3 w-3 mr-1" />}
            {subType === "negative" && <TrendingDown className="inline h-3 w-3 mr-1" />}
            {sub}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function DashboardStats() {
  const [month, setMonth] = useState<MonthStats | null>(null)
  const [saldoData, setSaldoData] = useState<SaldoResult | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: allTx }, saldo] = await Promise.all([
        supabase.from("transactions").select("profit_idr, channel, buy_price_idr, gold_amount")
          .eq("status", "completed"),
        computeSaldo(),
      ])
      const txs = allTx ?? []
      const profitThisMonth = txs.reduce((s: number, t: any) => s + (t.profit_idr ?? 0), 0)
      const g2gProfitMonth = txs.filter((t: any) => t.channel === "g2g").reduce((s: number, t: any) => s + (t.profit_idr ?? 0), 0)
      const directProfitMonth = txs.filter((t: any) => t.channel === "direct").reduce((s: number, t: any) => s + (t.profit_idr ?? 0), 0)
      const margins = txs.map((t: any) => { const b = t.buy_price_idr * t.gold_amount; return b > 0 ? ((t.profit_idr ?? 0) / b) * 100 : 0 })
      setMonth({ profitThisMonth, profitToday: 0, txThisMonth: txs.length, g2gProfitMonth, directProfitMonth, avgMarginMonth: margins.length > 0 ? margins.reduce((a: number, b: number) => a + b, 0) / margins.length : 0 })
      setSaldoData(saldo)
    }
    load()
  }, [])

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <StatCard title="Float G2G" value={saldoData ? compact(saldoData.floatG2GPending + saldoData.g2gBalance) : "—"}
        sub={saldoData ? `Pending ${compact(saldoData.floatG2GPending)} · Siap tarik ${compact(saldoData.g2gBalance)}` : undefined}
        subType="neutral" icon={<Clock className="h-4 w-4" />} />
      <StatCard title="Total Profit" value={month ? compact(month.profitThisMonth) : "—"}
        sub={month ? `${month.txThisMonth} transaksi selesai` : undefined}
        subType={month && month.profitThisMonth > 0 ? "positive" : "neutral"}
        icon={<TrendingUp className="h-4 w-4" />} />
      <StatCard title="Avg. Margin" value={month ? `${month.avgMarginMonth.toFixed(2)}%` : "—"}
        sub={month ? `G2G ${compact(month.g2gProfitMonth)} · Direct ${compact(month.directProfitMonth)}` : undefined}
        subType="neutral" icon={<Activity className="h-4 w-4" />} />
    </div>
  )
}

export function HeroStats() {
  const [month, setMonth] = useState<MonthStats | null>(null)
  const [saldoData, setSaldoData] = useState<SaldoResult | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data }, saldo] = await Promise.all([
        supabase.from("transactions").select("profit_idr, channel, buy_price_idr, gold_amount")
          .eq("status", "completed"),
        computeSaldo(),
      ])
      const txs = data ?? []
      const profitThisMonth = txs.reduce((s: number, t: any) => s + (t.profit_idr ?? 0), 0)
      const margins = txs.map((t: any) => { const b = t.buy_price_idr * t.gold_amount; return b > 0 ? ((t.profit_idr ?? 0) / b) * 100 : 0 })
      setMonth({ profitThisMonth, profitToday: 0, txThisMonth: txs.length, g2gProfitMonth: txs.filter((t: any) => t.channel === "g2g").reduce((s: number, t: any) => s + (t.profit_idr ?? 0), 0), directProfitMonth: txs.filter((t: any) => t.channel === "direct").reduce((s: number, t: any) => s + (t.profit_idr ?? 0), 0), avgMarginMonth: margins.length > 0 ? margins.reduce((a: number, b: number) => a + b, 0) / margins.length : 0 })
      setSaldoData(saldo)
    }
    load()
  }, [])

  const saldoOk = saldoData && saldoData.saldo >= 0

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-br from-card via-card to-primary/5 p-6 md:p-8">
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/8 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />
      <div className="relative">
        <p className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
          <Wallet className="h-4 w-4" /> Saldo
        </p>
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <span className={cn("text-4xl font-bold tabular-nums", saldoOk ? "text-gold" : "text-danger")}>
            {saldoData ? fmt(saldoData.saldo) : "—"}
          </span>
          {saldoData && (
            <span className={cn("flex items-center gap-1 text-xs rounded-full px-2.5 py-1 font-medium",
              saldoOk ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
            )}>
              {saldoOk ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {saldoOk ? "Positif" : "Negatif"}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Total Modal</p>
            <p className="text-base font-semibold text-foreground tabular-nums">
              {saldoData ? fmt(saldoData.totalDeposits + saldoData.initialSaldo) : "—"}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">G2G Siap Tarik</p>
            <p className="text-base font-semibold text-gold tabular-nums">
              {saldoData ? fmt(saldoData.g2gBalance) : "—"}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Total Profit</p>
            <p className="text-base font-semibold text-foreground tabular-nums">
              {month ? fmt(month.profitThisMonth) : "—"}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Avg. Margin</p>
            <p className="text-base font-semibold text-foreground tabular-nums">
              {month ? `${month.avgMarginMonth.toFixed(2)}%` : "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SaldoBreakdown() {
  const [data, setData] = useState<SaldoResult | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    computeSaldo().then(setData)
  }, [])

  if (!data) return null

  const rows: { label: string; sign: "+" | "-" | "="; value: number; sub?: string; warn?: boolean }[] = [
    { label: "Modal Awal (initial_saldo)", sign: "+", value: data.initialSaldo },
    { label: `Total Deposit (${data.countDeposits} entri)`, sign: "+", value: data.totalDeposits },
    { label: `Profit Direct Selesai (${data.countDirectCompleted} transaksi)`, sign: "+", value: data.directCompletedProfits },
    { label: `WD Diterima (${data.countWD} withdrawal)`, sign: "+", value: data.wdReceived },
    {
      label: `Pending Buy Cost (${data.countPendingG2G + data.countPendingDirect} tx)`,
      sign: "-", value: data.pendingBuyCosts,
      sub: `G2G ${fmt(data.pendingG2GBuyCosts)} · Direct ${fmt(data.pendingDirectBuyCosts)}`,
    },
    {
      label: `G2G Selesai Belum WD (${data.countG2GUnwithdrawn} tx)`,
      sign: "-", value: data.g2gUnwithdrawnBuyCosts,
      warn: data.g2gUnwithdrawnBuyCosts > 0,
    },
    {
      label: `G2G Selesai Sudah WD (${data.countG2GWithdrawn} tx) — modal dikurangi agar tidak dobel`,
      sign: "-", value: data.g2gWithdrawnBuyCosts,
    },
    { label: `Total Pengeluaran (${data.countExpenses} entri)`, sign: "-", value: data.totalExpenses },
    { label: "SALDO", sign: "=", value: data.saldo },
  ]

  return (
    <Card className="border-border bg-card">
      <CardHeader
        className="flex flex-row items-center justify-between pb-3 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        <CardTitle className="text-sm font-medium text-muted-foreground">Breakdown Perhitungan Saldo</CardTitle>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      {open && (
        <CardContent className="pt-0">
          <div className="space-y-1 text-sm font-mono">
            {rows.map((r, i) => (
              <div key={i} className={cn(
                "flex items-start justify-between gap-4 py-1.5 px-2 rounded",
                r.sign === "=" ? "bg-primary/10 border border-primary/20 mt-2" : "hover:bg-muted/40",
                r.warn ? "bg-yellow-500/10" : ""
              )}>
                <div className="flex-1 min-w-0">
                  <span className={cn(
                    "font-semibold mr-2",
                    r.sign === "+" ? "text-success" : r.sign === "-" ? "text-danger" : "text-gold"
                  )}>
                    {r.sign}
                  </span>
                  <span className={cn("text-foreground", r.sign === "=" && "font-bold")}>{r.label}</span>
                  {r.sub && <p className="text-xs text-muted-foreground ml-5 mt-0.5">{r.sub}</p>}
                </div>
                <span className={cn(
                  "tabular-nums whitespace-nowrap font-semibold",
                  r.sign === "+" ? "text-success" : r.sign === "-" ? "text-danger" : "text-gold text-base"
                )}>
                  {r.sign !== "=" ? "" : ""}{fmt(r.value)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
            Jika saldo ≠ rekening asli, cari komponen mana yang angkanya berbeda dari realita.
            Biasanya: harga beli di sistem ≠ yang dibayar ke supplier, atau ada pengeluaran yang belum dicatat.
          </p>
        </CardContent>
      )}
    </Card>
  )
}
