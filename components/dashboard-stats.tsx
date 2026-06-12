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

interface ProfitStats {
  totalProfit: number
  txCount: number
  g2gProfit: number
  directProfit: number
  // Avg margin = total profit / total modal (buy_price * gold_amount) semua completed
  avgMarginPct: number
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
  const [profit, setProfit] = useState<ProfitStats | null>(null)
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

      const totalProfit = txs.reduce((s: number, t: any) => s + (t.profit_idr ?? 0), 0)
      const g2gProfit = txs.filter((t: any) => t.channel === "g2g").reduce((s: number, t: any) => s + (t.profit_idr ?? 0), 0)
      const directProfit = txs.filter((t: any) => t.channel === "direct").reduce((s: number, t: any) => s + (t.profit_idr ?? 0), 0)

      const totalModal = txs.reduce((s: number, t: any) => s + (t.buy_price_idr * t.gold_amount), 0)
      const avgMarginPct = totalModal > 0 ? (totalProfit / totalModal) * 100 : 0

      setProfit({ totalProfit, txCount: txs.length, g2gProfit, directProfit, avgMarginPct })
      setSaldoData(saldo)
    }
    load()
  }, [])

  // Profit kumulatif: (saldo + g2gBalance) - totalInvested
  // g2gBalance = G2G completed siap tarik (sudah pasti), floatG2GPending sengaja TIDAK dimasukkan karena masih estimasi
  const cumulativeProfit = saldoData
    ? (saldoData.saldo + saldoData.g2gBalance) - (saldoData.initialSaldo + saldoData.totalDeposits)
    : null

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Float G2G: total modal yang sedang pending di G2G (uang yang sedang dipakai) */}
      <StatCard
        title="Float G2G"
        value={saldoData ? fmt(saldoData.pendingG2GBuyCosts) : "—"}
        sub={saldoData
          ? `${saldoData.countPendingG2G} transaksi pending · Siap tarik ${compact(saldoData.g2gBalance)}`
          : undefined}
        subType="neutral"
        icon={<Clock className="h-4 w-4" />}
      />

      {/* Total Profit: gap formula (saldo + float + g2gBalance) - totalInvested */}
      <StatCard
        title="Total Profit"
        value={cumulativeProfit != null ? compact(cumulativeProfit) : "—"}
        sub="saldo + G2G siap tarik"
        subType={cumulativeProfit != null && cumulativeProfit > 0 ? "positive" : cumulativeProfit != null && cumulativeProfit < 0 ? "negative" : "neutral"}
        icon={<TrendingUp className="h-4 w-4" />}
      />

      {/* Avg Margin: total profit / total modal semua transaksi completed */}
      <StatCard
        title="Avg. Margin"
        value={profit ? `${profit.avgMarginPct.toFixed(2)}%` : "—"}
        sub={profit ? `G2G ${compact(profit.g2gProfit)} · Direct ${compact(profit.directProfit)}` : undefined}
        subType="neutral"
        icon={<Activity className="h-4 w-4" />}
      />
    </div>
  )
}

export function HeroStats() {
  const [profit, setProfit] = useState<ProfitStats | null>(null)
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

      const totalProfit = txs.reduce((s: number, t: any) => s + (t.profit_idr ?? 0), 0)
      const g2gProfit = txs.filter((t: any) => t.channel === "g2g").reduce((s: number, t: any) => s + (t.profit_idr ?? 0), 0)
      const directProfit = txs.filter((t: any) => t.channel === "direct").reduce((s: number, t: any) => s + (t.profit_idr ?? 0), 0)
      const totalModal = txs.reduce((s: number, t: any) => s + (t.buy_price_idr * t.gold_amount), 0)
      const avgMarginPct = totalModal > 0 ? (totalProfit / totalModal) * 100 : 0

      setProfit({ totalProfit, txCount: txs.length, g2gProfit, directProfit, avgMarginPct })
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

        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Total Modal</p>
            <p className="text-base font-semibold text-foreground tabular-nums">
              {saldoData ? fmt(saldoData.totalDeposits + saldoData.initialSaldo) : "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}