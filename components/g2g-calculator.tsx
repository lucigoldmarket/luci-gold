"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Calculator, CheckCircle, AlertTriangle, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { calcG2GMinSell, calcG2GFromSell, type G2GFeeParams } from "@/lib/calc"

function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value)
}

const DEFAULT_FEE: G2GFeeParams = {
  commissionPct: 7.99, vatPct: 11, withdrawalFeePct: 1.99, withdrawalFeeFixed: 19999,
}

export function G2GCalculator() {
  const [buyPrice, setBuyPrice] = useState(15000)
  const [margin, setMargin] = useState(0.6)
  const [fee, setFee] = useState<G2GFeeParams>(DEFAULT_FEE)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from("fee_config")
        .select("commission_pct, vat_pct, withdrawal_fee_pct, withdrawal_fee_fixed")
        .eq("is_active", true).single()
      if (data) setFee({
        commissionPct: data.commission_pct, vatPct: data.vat_pct,
        withdrawalFeePct: data.withdrawal_fee_pct, withdrawalFeeFixed: data.withdrawal_fee_fixed,
      })
    }
    load()
  }, [])

  const minSell = useMemo(() => buyPrice > 0 ? calcG2GMinSell(buyPrice, margin, fee) : 0, [buyPrice, margin, fee])
  const result = useMemo(() => minSell > 0 ? calcG2GFromSell(minSell, 0, fee, buyPrice) : null, [minSell, buyPrice, fee])
  const eff = fee.commissionPct * (1 + fee.vatPct / 100)
  const totalCost = eff + fee.withdrawalFeePct

  return (
    <Card className="card-glow border-border bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Calculator className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-foreground">Quick Calc G2G</CardTitle>
              <p className="text-xs text-muted-foreground">Beli → Min Post</p>
            </div>
          </div>
          <Link href="/kalkulator" className="text-xs text-primary hover:text-gold flex items-center gap-1">
            Lengkap <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Harga Beli / unit</Label>
            <Input type="number" value={buyPrice || ""} onChange={(e) => setBuyPrice(Number(e.target.value))}
              className="bg-secondary border-border text-foreground h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Target Margin %</Label>
            <Input type="number" value={margin || ""} onChange={(e) => setMargin(Number(e.target.value))}
              className="bg-secondary border-border text-foreground h-9" step={0.1} />
          </div>
        </div>

        {minSell > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-gold/30 bg-gold/10 px-3 py-2.5">
              <span className="text-xs text-muted-foreground">Min Post G2G</span>
              <span className="font-bold text-gold text-lg">{formatRupiah(minSell)}</span>
            </div>

            <div className="text-xs text-muted-foreground space-y-0.5 px-1">
              <div className="flex justify-between">
                <span>Fee efektif total</span>
                <span className="text-danger">-{totalCost.toFixed(2)}%</span>
              </div>
              {result && (
                <div className="flex justify-between">
                  <span>Profit / unit</span>
                  <span className={result.profitPerUnit >= 0 ? "text-success" : "text-danger"}>
                    {formatRupiah(result.profitPerUnit)} ({result.profitPct.toFixed(2)}%)
                  </span>
                </div>
              )}
            </div>

            {result && (
              <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
                result.profitPerUnit >= 0 ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
              )}>
                {result.profitPerUnit >= 0
                  ? <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                  : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                {result.profitPerUnit >= 0 ? "AMAN" : "RUGI pada harga ini"}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
