"use client"

import { useEffect, useState } from "react"
import { TrendingUp, TrendingDown, Wallet, Clock, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react"
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
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      const today = now.toISOString().slice(0, 10)
      const [{ data: monthTx }, saldo] = await Promise.all([
        supabase.from("transactions").select("profit_idr, channel, buy_price_idr, gold_amount, transaction_date")
          .gte("transaction_date", monthStart).eq("status", "completed"),
        computeSaldo(),
      ])
      const txs = monthTx ?? []
      const profitThisMonth = txs.reduce((s: number, t: any) => s + (t.profit_idr ?? 0), 0)
      const profitToday = txs.filter((t: any) => t.transaction_date === today).reduce((s: number, t: any) => s + (t.profit_idr ?? 0), 0)
      const g2gProfitMonth = txs.filter((t: any) => t.channel === "g2g").reduce((s: number, t: any) => s + (t.profit_idr ?? 0), 0)
      const directProfitMonth = txs.filter((t: any) => t.channel === "direct").reduce((s: number, t: any) => s + (t.profit_idr ?? 0), 0)
      const margins = txs.map((t: any) => { const b = t.buy_price_idr * t.gold_amount; return b > 0 ? ((t.profit_idr ?? 0) / b) * 100 : 0 })
      setMonth({ profitThisMonth, profitToday, txThisMonth: txs.length, g2gProfitMonth, directProfitMonth, avgMarginMonth: margins.length > 0 ? margins.reduce((a: number, b: number) => a + b, 0) / margins.length : 0 })
      setSaldoData(saldo)
    }
    load()
  }, [])

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard title="Saldo Kas" value={saldoData ? compact(saldoData.saldo) : "—"}
        sub={saldoData ? `Deposit ${compact(saldoData.totalDeposits + saldoData.initialSaldo)} · WD +${compact(saldoData.wdReceived)}` : undefined}
        subType={saldoData ? (saldoData.saldo >= 0 ? "positive" : "negative") : "neutral"}
        icon={<Wallet className="h-4 w-4" />} />
      <StatCard title="Float G2G" value={saldoData ? compact(saldoData.floatG2GPending + saldoData.g2gBalance) : "—"}
        sub={saldoData ? `Pending ${compact(saldoData.floatG2GPending)} · Siap tarik ${compact(saldoData.g2gBalance)}` : undefined}
        subType="neutral" icon={<Clock className="h-4 w-4" />} />
      <StatCard title="Profit Bulan Ini" value={month ? compact(month.profitThisMonth) : "—"}
        sub={month ? `${month.txThisMonth} transaksi` : undefined}
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
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
      const [{ data }, saldo] = await Promise.all([
        supabase.from("transactions").select("profit_idr, channel, buy_price_idr, gold_amount")
          .gte("transaction_date", monthStart).eq("status", "completed"),
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
    <div className="relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-[#1C1A12] via-card to-[#181810] p-6 md:p-8" style={{boxShadow: "0 0 60px rgba(201,168,76,0.08), inset 0 1px 0 rgba(201,168,76,0.15)"}}>
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-primary/8 blur-3xl" />
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
            <p className="text-xs text-muted-foreground">Profit Bulan Ini</p>
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
