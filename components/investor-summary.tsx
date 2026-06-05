"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, TrendingUp, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function InvestorSummary() {
  const [investorCount, setInvestorCount] = useState(0)
  const [perInvestor, setPerInvestor] = useState(0)
  const [totalProfit, setTotalProfit] = useState(0)
  const [totalDeposit, setTotalDeposit] = useState(0)
  const [opsPct, setOpsPct] = useState(50)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: investors }, { data: txData }, { data: psData }, { data: depositData }] = await Promise.all([
        supabase.from("profiles").select("id").eq("role", "investor").eq("is_active", true),
        supabase.from("transactions").select("profit_idr").eq("status", "completed"),
        supabase.from("profit_sharing_config").select("ops_percentage").single(),
        supabase.from("deposits").select("amount_idr"),
      ])

      const count = (investors ?? []).length
      const profit = (txData ?? []).reduce((s: number, t: any) => s + (t.profit_idr ?? 0), 0)
      const ops = psData?.ops_percentage ?? 50
      const investorTotal = profit * (1 - ops / 100)
      const per = count > 0 ? investorTotal / count : 0
      const dep = (depositData ?? []).reduce((s: number, d: any) => s + d.amount_idr, 0)

      setInvestorCount(count)
      setTotalProfit(profit)
      setOpsPct(ops)
      setPerInvestor(per)
      setTotalDeposit(dep)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <Card className="card-glow border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">Profit Sharing</CardTitle>
              <p className="text-sm text-muted-foreground">
                {loading ? "Memuat..." : `${investorCount} investor Â· split rata`}
              </p>
            </div>
          </div>
          <Link href="/laporan" className="text-sm text-primary hover:text-gold-light transition-colors">
            Detail
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Memuat...
          </div>
        ) : (
          <div className="space-y-3">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-secondary/30 p-3">
                <p className="text-xs text-muted-foreground mb-1">Total Profit</p>
                <p className="text-base font-semibold text-foreground tabular-nums">{formatRupiah(totalProfit)}</p>
              </div>
              <div className="rounded-xl border border-border bg-secondary/30 p-3">
                <p className="text-xs text-muted-foreground mb-1">Per Investor</p>
                <p className="text-base font-semibold text-success tabular-nums">{formatRupiah(perInvestor)}</p>
              </div>
            </div>

            {/* Deposit info */}
            {totalDeposit > 0 && (
              <div className="rounded-xl border border-border bg-secondary/30 p-3">
                <p className="text-xs text-muted-foreground mb-1">Total Deposit Investor</p>
                <p className="text-base font-semibold text-gold tabular-nums">{formatRupiah(totalDeposit)}</p>
              </div>
            )}

            {/* Split visual */}
            <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Operator ({opsPct}%)</span>
                <span>Investor ({100 - opsPct}%)</span>
              </div>
              <div className="h-2 rounded-full bg-background overflow-hidden flex">
                <div className="h-full bg-gold transition-all" style={{ width: `${opsPct}%` }} />
                <div className="h-full bg-success flex-1" />
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span className="text-gold tabular-nums">{formatRupiah(totalProfit * opsPct / 100)}</span>
                <span className="text-success tabular-nums">{formatRupiah(totalProfit * (1 - opsPct / 100))}</span>
              </div>
            </div>

            {investorCount === 0 && (
              <p className="text-xs text-muted-foreground text-center">
                Belum ada investor aktif.{" "}
                <Link href="/pengaturan" className="text-gold hover:underline">Tambah di Pengaturan</Link>
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

