"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Users, TrendingUp, Search, Loader2, Calendar } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Profile, Transaction } from "@/lib/types"

function formatRupiah(num: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(num)
}

export default function PemodalPage() {
  const [investors, setInvestors] = useState<Profile[]>([])
  const [totalProfit, setTotalProfit] = useState(0)
  const [opsPct, setOpsPct] = useState(50)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: invData }, { data: txData }, { data: psData }] = await Promise.all([
        supabase.from("profiles").select("*").eq("role", "investor").order("created_at"),
        supabase.from("transactions").select("profit_idr").eq("status", "completed"),
        supabase.from("profit_sharing_config").select("ops_percentage").single(),
      ])

      setInvestors((invData as Profile[]) ?? [])
      setTotalProfit((txData ?? []).reduce((s: number, t: any) => s + (t.profit_idr ?? 0), 0))
      if (psData) setOpsPct(psData.ops_percentage)
      setLoading(false)
    }
    load()
  }, [])

  const activeCount = investors.filter((i) => i.is_active).length
  const investorTotal = totalProfit * (1 - opsPct / 100)
  const perInvestor = activeCount > 0 ? investorTotal / activeCount : 0

  const filtered = investors.filter((i) =>
    i.full_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 page-content">
        <Header />
        <main className="p-4 md:p-6 lg:p-8">
          {/* Summary */}
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card className="bg-card border-border">
              <CardContent className="pt-5">
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-gold/10 p-3"><Users className="h-5 w-5 text-gold" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Investor Aktif</p>
                    <p className="text-2xl font-bold text-foreground">{loading ? "—" : `${activeCount} orang`}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-5">
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-success/10 p-3"><TrendingUp className="h-5 w-5 text-success" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Profit (All Time)</p>
                    <p className="text-2xl font-bold text-success tabular-nums">{loading ? "—" : formatRupiah(totalProfit)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-5">
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-gold/10 p-3"><TrendingUp className="h-5 w-5 text-gold" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Per Investor (Kumulatif)</p>
                    <p className="text-2xl font-bold text-gold tabular-nums">{loading ? "—" : formatRupiah(perInvestor)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari investor..." className="pl-9 bg-card border-border text-foreground max-w-sm" />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground text-sm">
              {investors.length === 0
                ? "Belum ada investor. Tambah user dengan role 'investor' di Pengaturan → Pengguna."
                : "Tidak ada investor yang cocok."}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((inv) => (
                <Card key={inv.id} className="bg-card border-border hover:border-gold/30 transition-colors">
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-gold/10 flex items-center justify-center text-gold font-semibold border border-gold/30">
                          {inv.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">{inv.full_name}</h3>
                          <Badge variant="outline" className={
                            inv.is_active
                              ? "border-success/50 text-success bg-success/10 text-xs"
                              : "border-danger/50 text-danger bg-danger/10 text-xs"
                          }>
                            {inv.is_active ? "Aktif" : "Nonaktif"}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-border pt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" /> Bergabung
                        </span>
                        <span className="text-foreground">
                          {new Date(inv.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Bagian Investor</span>
                        <Badge variant="outline" className="border-gold/50 text-gold bg-gold/10">
                          {100 - opsPct}%
                        </Badge>
                      </div>
                      {inv.is_active && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Profit Kumulatif</span>
                          <span className="text-success font-semibold tabular-nums">{formatRupiah(perInvestor)}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
