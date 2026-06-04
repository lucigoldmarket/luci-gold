"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Clock, ArrowUpRight, ArrowDownLeft, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { Transaction } from "@/lib/types"

function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function RecentTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5)
      setTransactions((data as Transaction[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <Card className="card-glow border-border bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">Transaksi Terbaru</CardTitle>
              <p className="text-sm text-muted-foreground">5 transaksi terakhir</p>
            </div>
          </div>
          <Link href="/transaksi" className="text-sm text-primary hover:text-gold-light transition-colors">
            Lihat Semua
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Memuat...
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            Belum ada transaksi.{" "}
            <Link href="/transaksi" className="text-gold hover:underline">
              Tambah sekarang
            </Link>
          </div>
        ) : (
          <ScrollArea className="h-[320px] pr-4">
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-4 hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg shrink-0",
                      tx.channel === "g2g" ? "bg-gold/10 text-gold" : "bg-success/10 text-success"
                    )}>
                      {tx.channel === "g2g"
                        ? <ArrowUpRight className="h-5 w-5" />
                        : <ArrowDownLeft className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground text-sm">
                          {tx.gold_amount.toLocaleString("id-ID")} Gold
                        </span>
                        <Badge variant="outline" className={cn("text-xs border-0",
                          tx.channel === "g2g" ? "bg-gold/10 text-gold" : "bg-success/10 text-success"
                        )}>
                          {tx.channel.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.transaction_date).toLocaleDateString("id-ID", {
                          day: "numeric", month: "short"
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("font-semibold text-sm",
                      tx.profit_idr != null && tx.profit_idr >= 0 ? "text-success" : "text-danger"
                    )}>
                      {tx.profit_idr != null ? formatRupiah(tx.profit_idr) : "—"}
                    </p>
                    <Badge variant="outline" className={cn("text-xs border-0",
                      tx.status === "completed" ? "bg-success/10 text-success" :
                      tx.status === "pending" ? "bg-gold/10 text-gold" :
                      "bg-danger/10 text-danger"
                    )}>
                      {tx.status === "completed" ? "Selesai" : tx.status === "pending" ? "Pending" : "Batal"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
