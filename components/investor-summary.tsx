"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { computeSaldo } from "@/lib/saldo"

function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const MEMBER_COLORS = [
  { text: "text-gold", dot: "bg-gold" },
  { text: "text-blue-400", dot: "bg-blue-400" },
  { text: "text-violet-400", dot: "bg-violet-400" },
  { text: "text-success", dot: "bg-success" },
]

interface Member {
  full_name: string
  share_pct: number
  amount: number
  color: { text: string; dot: string }
}

export function InvestorSummary() {
  const [totalProfit, setTotalProfit] = useState(0)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [saldo, { data: memberData }] = await Promise.all([
        computeSaldo(),
        supabase
          .from("profit_sharing_members")
          .select("full_name, share_pct")
          .eq("is_active", true)
          .order("created_at"),
      ])

      // Formula: (saldo + pendingBuyCosts) - (initialSaldo + totalDeposits)
      const profit = (saldo.saldo + saldo.pendingBuyCosts) - (saldo.initialSaldo + saldo.totalDeposits)

      const parsed: Member[] = (memberData ?? []).map((m: any, i: number) => ({
        full_name: m.full_name,
        share_pct: m.share_pct,
        amount: profit * m.share_pct / 100,
        color: MEMBER_COLORS[i % MEMBER_COLORS.length],
      }))

      setTotalProfit(profit)
      setMembers(parsed)
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
              <PieChart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">Profit Sharing</CardTitle>
              <p className="text-sm text-muted-foreground">
                {loading ? "Memuat..." : "Distribusi berdasarkan %"}
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
            <div className="rounded-xl border border-border bg-secondary/30 p-3">
              <p className="text-xs text-muted-foreground mb-1">Total Profit</p>
              <p className={cn("text-base font-semibold tabular-nums", totalProfit >= 0 ? "text-foreground" : "text-danger")}>
                {formatRupiah(totalProfit)}
              </p>
            </div>

            {members.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                Belum ada konfigurasi profit sharing.{" "}
                <Link href="/pengaturan" className="text-gold hover:underline">Atur di Pengaturan</Link>
              </p>
            ) : (
              <div className="space-y-2">
                {members.map((m) => (
                  <div
                    key={m.full_name}
                    className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", m.color.dot)} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{m.full_name}</p>
                        <p className="text-xs text-muted-foreground">{m.share_pct}%</p>
                      </div>
                    </div>
                    <span className={cn("font-semibold text-sm tabular-nums", m.amount >= 0 ? m.color.text : "text-danger")}>
                      {formatRupiah(m.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
