"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

function formatCompact(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? "-" : ""
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}jt`
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}rb`
  return `${sign}${abs}`
}

function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value)
}

const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]

type Mode = "7d" | "30d" | "bulan"

export function ProfitChart() {
  const [mode, setMode] = useState<Mode>("7d")
  const [data, setData] = useState<{ label: string; profit: number; g2g: number; direct: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [totalProfit, setTotalProfit] = useState(0)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const today = new Date()
      let from: string
      let buckets: { key: string; label: string }[] = []

      if (mode === "7d") {
        const days: { date: string; label: string }[] = []
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today)
          d.setDate(today.getDate() - i)
          const key = d.toISOString().slice(0, 10)
          days.push({ date: key, label: DAY_LABELS[d.getDay()] })
        }
        from = days[0].date
        const { data: txData } = await supabase
          .from("transactions")
          .select("transaction_date, profit_idr, channel")
          .eq("status", "completed")
          .gte("transaction_date", from)
          .lte("transaction_date", days[6].date)

        const byDate: Record<string, { g2g: number; direct: number }> = {}
        for (const tx of txData ?? []) {
          if (!byDate[tx.transaction_date]) byDate[tx.transaction_date] = { g2g: 0, direct: 0 }
          if (tx.channel === "g2g") byDate[tx.transaction_date].g2g += tx.profit_idr ?? 0
          else byDate[tx.transaction_date].direct += tx.profit_idr ?? 0
        }
        const result = days.map((d) => {
          const b = byDate[d.date] ?? { g2g: 0, direct: 0 }
          return { label: d.label, profit: b.g2g + b.direct, g2g: b.g2g, direct: b.direct }
        })
        setData(result)
        setTotalProfit(result.reduce((s, d) => s + d.profit, 0))

      } else if (mode === "30d") {
        const days: { date: string; label: string }[] = []
        for (let i = 29; i >= 0; i--) {
          const d = new Date(today)
          d.setDate(today.getDate() - i)
          const key = d.toISOString().slice(0, 10)
          const dd = d.getDate()
          days.push({ date: key, label: dd % 7 === 1 ? String(dd) : "" })
        }
        from = days[0].date
        const { data: txData } = await supabase
          .from("transactions")
          .select("transaction_date, profit_idr, channel")
          .eq("status", "completed")
          .gte("transaction_date", from)

        const byDate: Record<string, { g2g: number; direct: number }> = {}
        for (const tx of txData ?? []) {
          if (!byDate[tx.transaction_date]) byDate[tx.transaction_date] = { g2g: 0, direct: 0 }
          if (tx.channel === "g2g") byDate[tx.transaction_date].g2g += tx.profit_idr ?? 0
          else byDate[tx.transaction_date].direct += tx.profit_idr ?? 0
        }
        const result = days.map((d) => {
          const b = byDate[d.date] ?? { g2g: 0, direct: 0 }
          return { label: d.label, profit: b.g2g + b.direct, g2g: b.g2g, direct: b.direct }
        })
        setData(result)
        setTotalProfit(result.reduce((s, d) => s + d.profit, 0))

      } else {
        // bulan — 6 bulan terakhir
        const months: { key: string; label: string }[] = []
        for (let i = 5; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          months.push({ key, label: d.toLocaleDateString("id-ID", { month: "short" }) })
        }
        from = `${months[0].key}-01`

        const { data: txData } = await supabase
          .from("transactions")
          .select("transaction_date, profit_idr, channel")
          .eq("status", "completed")
          .gte("transaction_date", from)

        const byMonth: Record<string, { g2g: number; direct: number }> = {}
        for (const tx of txData ?? []) {
          const monthKey = tx.transaction_date.slice(0, 7)
          if (!byMonth[monthKey]) byMonth[monthKey] = { g2g: 0, direct: 0 }
          if (tx.channel === "g2g") byMonth[monthKey].g2g += tx.profit_idr ?? 0
          else byMonth[monthKey].direct += tx.profit_idr ?? 0
        }
        const result = months.map((m) => {
          const b = byMonth[m.key] ?? { g2g: 0, direct: 0 }
          return { label: m.label, profit: b.g2g + b.direct, g2g: b.g2g, direct: b.direct }
        })
        setData(result)
        setTotalProfit(result.reduce((s, d) => s + d.profit, 0))
      }

      setLoading(false)
    }
    load()
  }, [mode])

  const maxProfit = Math.max(...data.map((d) => d.profit), 1)
  const hasData = data.some((d) => d.profit > 0)

  return (
    <Card className="card-glow border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">Grafik Profit</CardTitle>
              <p className="text-sm text-muted-foreground">
                Total: <span className={cn("font-semibold tabular-nums", totalProfit >= 0 ? "text-success" : "text-danger")}>{formatRupiah(totalProfit)}</span>
              </p>
            </div>
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["7d", "30d", "bulan"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  mode === m ? "bg-gold text-background" : "text-muted-foreground hover:bg-secondary"
                )}
              >
                {m === "7d" ? "7 Hari" : m === "30d" ? "30 Hari" : "6 Bulan"}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Memuat...
          </div>
        ) : !hasData ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            Belum ada data profit di periode ini
          </div>
        ) : (
          <div className="flex items-end gap-1 h-[200px] pt-4">
            {data.map((item, i) => {
              const isLast = i === data.length - 1
              const heightPct = (item.profit / maxProfit) * 100
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5 group relative" title={item.profit > 0 ? formatRupiah(item.profit) : undefined}>
                  <div className="relative w-full flex flex-col items-center">
                    {item.profit > 0 && (
                      <span className="text-xs text-muted-foreground mb-1.5 group-hover:text-foreground transition-colors">
                        {formatCompact(item.profit)}
                      </span>
                    )}
                    {/* Bar: G2G (gold) stacked on Direct (green) */}
                    <div className="w-full max-w-[36px] flex flex-col-reverse gap-0 overflow-hidden rounded-t-lg"
                      style={{ height: `${Math.max(heightPct, item.profit > 0 ? 8 : 3)}%`, minHeight: "4px" }}>
                      {item.g2g > 0 && (
                        <div className="w-full bg-gradient-to-t from-gold/60 to-gold transition-all"
                          style={{ flex: item.g2g }} />
                      )}
                      {item.direct > 0 && (
                        <div className="w-full bg-gradient-to-t from-success/60 to-success transition-all"
                          style={{ flex: item.direct }} />
                      )}
                      {item.profit === 0 && (
                        <div className="w-full bg-border/50" style={{ height: "4px" }} />
                      )}
                    </div>
                  </div>
                  {item.label && (
                    <span className={cn(
                      "text-xs font-medium",
                      isLast ? "text-gold" : "text-muted-foreground"
                    )}>
                      {item.label}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {hasData && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="h-2.5 w-2.5 rounded-sm bg-gold" />
              G2G
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="h-2.5 w-2.5 rounded-sm bg-success" />
              Direct
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
