"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, Loader2 } from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
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

// Warna: G2G = merah (identik G2G), Direct = biru (identik Discord)
const COLOR_G2G = "#ef4444"
const COLOR_DIRECT = "#3b82f6"

type Mode = "7d" | "30d" | "bulan"

export function ProfitChart() {
  const [mode, setMode] = useState<Mode>("7d")
  const [data, setData] = useState<{ label: string; g2g: number; direct: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [totalProfit, setTotalProfit] = useState(0)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const today = new Date()

      if (mode === "7d") {
        const days: { date: string; label: string }[] = []
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today)
          d.setDate(today.getDate() - i)
          days.push({ date: d.toISOString().slice(0, 10), label: DAY_LABELS[d.getDay()] })
        }
        const { data: txData } = await supabase
          .from("transactions")
          .select("transaction_date, profit_idr, channel")
          .gte("transaction_date", days[0].date)
          .lte("transaction_date", days[6].date)

        const byDate: Record<string, { g2g: number; direct: number }> = {}
        for (const tx of txData ?? []) {
          if (!byDate[tx.transaction_date]) byDate[tx.transaction_date] = { g2g: 0, direct: 0 }
          if (tx.channel === "g2g") byDate[tx.transaction_date].g2g += tx.profit_idr ?? 0
          else byDate[tx.transaction_date].direct += tx.profit_idr ?? 0
        }
        const result = days.map((d) => {
          const b = byDate[d.date] ?? { g2g: 0, direct: 0 }
          return { label: d.label, g2g: b.g2g, direct: b.direct }
        })
        setData(result)
        setTotalProfit(result.reduce((s, d) => s + d.g2g + d.direct, 0))

      } else if (mode === "30d") {
        const days: { date: string; label: string }[] = []
        for (let i = 29; i >= 0; i--) {
          const d = new Date(today)
          d.setDate(today.getDate() - i)
          const key = d.toISOString().slice(0, 10)
          const dd = d.getDate()
          days.push({ date: key, label: dd % 7 === 1 ? String(dd) : "" })
        }
        const { data: txData } = await supabase
          .from("transactions")
          .select("transaction_date, profit_idr, channel")
          .gte("transaction_date", days[0].date)

        const byDate: Record<string, { g2g: number; direct: number }> = {}
        for (const tx of txData ?? []) {
          if (!byDate[tx.transaction_date]) byDate[tx.transaction_date] = { g2g: 0, direct: 0 }
          if (tx.channel === "g2g") byDate[tx.transaction_date].g2g += tx.profit_idr ?? 0
          else byDate[tx.transaction_date].direct += tx.profit_idr ?? 0
        }
        const result = days.map((d) => {
          const b = byDate[d.date] ?? { g2g: 0, direct: 0 }
          return { label: d.label, g2g: b.g2g, direct: b.direct }
        })
        setData(result)
        setTotalProfit(result.reduce((s, d) => s + d.g2g + d.direct, 0))

      } else {
        const months: { key: string; label: string }[] = []
        for (let i = 5; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          months.push({ key, label: d.toLocaleDateString("id-ID", { month: "short" }) })
        }
        const { data: txData } = await supabase
          .from("transactions")
          .select("transaction_date, profit_idr, channel")
          .gte("transaction_date", `${months[0].key}-01`)

        const byMonth: Record<string, { g2g: number; direct: number }> = {}
        for (const tx of txData ?? []) {
          const monthKey = tx.transaction_date.slice(0, 7)
          if (!byMonth[monthKey]) byMonth[monthKey] = { g2g: 0, direct: 0 }
          if (tx.channel === "g2g") byMonth[monthKey].g2g += tx.profit_idr ?? 0
          else byMonth[monthKey].direct += tx.profit_idr ?? 0
        }
        const result = months.map((m) => {
          const b = byMonth[m.key] ?? { g2g: 0, direct: 0 }
          return { label: m.label, g2g: b.g2g, direct: b.direct }
        })
        setData(result)
        setTotalProfit(result.reduce((s, d) => s + d.g2g + d.direct, 0))
      }

      setLoading(false)
    }
    load()
  }, [mode])

  const hasData = data.some((d) => d.g2g > 0 || d.direct > 0)

  return (
    <Card className="card-glow border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">Grafik Profit</CardTitle>
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
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="g2gGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLOR_G2G} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={COLOR_G2G} stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="directGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLOR_DIRECT} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={COLOR_DIRECT} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={formatCompact}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const g2g = (payload.find((p) => p.dataKey === "g2g")?.value as number) ?? 0
                  const direct = (payload.find((p) => p.dataKey === "direct")?.value as number) ?? 0
                  const total = g2g + direct
                  return (
                    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg space-y-1">
                      <p className="text-muted-foreground font-medium">{label}</p>
                      {g2g > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: COLOR_G2G }} />
                          <span className="text-muted-foreground">G2G</span>
                          <span className="font-semibold ml-auto tabular-nums" style={{ color: COLOR_G2G }}>{formatRupiah(g2g)}</span>
                        </div>
                      )}
                      {direct > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: COLOR_DIRECT }} />
                          <span className="text-muted-foreground">Direct</span>
                          <span className="font-semibold ml-auto tabular-nums" style={{ color: COLOR_DIRECT }}>{formatRupiah(direct)}</span>
                        </div>
                      )}
                      {g2g > 0 && direct > 0 && (
                        <div className="flex justify-between border-t border-border pt-1">
                          <span className="text-muted-foreground">Total</span>
                          <span className="font-bold text-foreground tabular-nums">{formatRupiah(total)}</span>
                        </div>
                      )}
                    </div>
                  )
                }}
              />
              <Area
                type="monotone"
                dataKey="g2g"
                stackId="a"
                stroke={COLOR_G2G}
                strokeWidth={2}
                fill="url(#g2gGrad)"
                dot={false}
                activeDot={{ r: 4, fill: COLOR_G2G, strokeWidth: 0 }}
              />
              <Area
                type="monotone"
                dataKey="direct"
                stackId="a"
                stroke={COLOR_DIRECT}
                strokeWidth={2}
                fill="url(#directGrad)"
                dot={false}
                activeDot={{ r: 4, fill: COLOR_DIRECT, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {hasData && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLOR_G2G }} />
              G2G
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLOR_DIRECT }} />
              Direct
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}