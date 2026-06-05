"use client"

import { useState, useEffect, useMemo } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle, Lock, LockOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import {
  calcG2GMinSell,
  calcG2GFromSell,
  calcG2GBreakdown,
  calcDirectFromBuy,
  calcDirectFromOffer,
  type G2GFeeParams,
} from "@/lib/calc"

const DEFAULT_FEE: G2GFeeParams = {
  commissionPct: 7.99,
  vatPct: 11,
  withdrawalFeePct: 2.48,
  withdrawalFeeFixed: 0,
}

function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

function formatPct(n: number) { return `${n.toFixed(2)}%` }

function NumInput({
  label, value, onChange, hint, prefix, suffix, step, locked, onToggleLock, noScroll,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  hint?: string
  prefix?: string
  suffix?: string
  step?: number
  locked?: boolean
  onToggleLock?: () => void
  noScroll?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-muted-foreground text-sm">{label}</Label>
        {onToggleLock && (
          <button
            type="button"
            onClick={onToggleLock}
            title={locked ? "Klik untuk ubah" : "Kunci nilai ini"}
            className={cn(
              "flex items-center gap-1 text-xs px-2 py-0.5 rounded-md transition-colors",
              locked
                ? "bg-gold/15 text-gold hover:bg-gold/25"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            {locked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
            {locked ? "Terkunci" : "Kunci"}
          </button>
        )}
      </div>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{prefix}</span>}
        <Input
          type="number"
          value={value || ""}
          onChange={(e) => !locked && onChange(Number(e.target.value))}
          onWheel={noScroll ? (e) => (e.target as HTMLInputElement).blur() : undefined}
          className={cn(
            "bg-background border-border text-foreground",
            prefix && "pl-10",
            suffix && "pr-12",
            locked && "opacity-70 cursor-not-allowed"
          )}
          min={0}
          step={step ?? 1}
          readOnly={locked}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function StatusBadge({ profit, pct }: { profit: number; pct: number }) {
  const ok = profit > 0
  return (
    <div className={cn("flex items-center gap-2 rounded-lg p-3 border", ok ? "bg-success/10 border-success/30" : "bg-danger/10 border-danger/30")}>
      {ok ? <CheckCircle className="h-4 w-4 text-success shrink-0" /> : <AlertTriangle className="h-4 w-4 text-danger shrink-0" />}
      <div>
        <p className={cn("text-xs", ok ? "text-success" : "text-danger")}>{ok ? "PROFIT" : "RUGI"}</p>
        <p className={cn("font-bold text-lg", ok ? "text-success" : "text-danger")}>
          {formatRupiah(profit)} <span className="text-sm font-normal">({formatPct(pct)})</span>
        </p>
      </div>
    </div>
  )
}

function FeeBreakdown({ eff, wdPct, sellPrice }: {
  eff: number; wdPct: number; sellPrice: number
}) {
  const commAmt = sellPrice * eff / 100
  const wdAmt = sellPrice * wdPct / 100
  const totalAmt = commAmt + wdAmt
  return (
    <div className="rounded-lg bg-secondary/40 border border-border p-3 space-y-1.5 text-sm">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Breakdown Fee</p>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Komisi G2G + PPN → efektif</span>
        <span className="text-danger font-medium">-{formatPct(eff)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">WD disbursement + PPN → efektif</span>
        <span className="text-danger font-medium">-{formatPct(wdPct)}</span>
      </div>
      <div className="flex justify-between border-t border-border pt-1.5">
        <span className="text-muted-foreground font-medium">Total potongan %</span>
        <span className="text-danger font-semibold">-{formatPct(eff + wdPct)}</span>
      </div>
      {sellPrice > 0 && (
        <div className="flex justify-between text-xs text-muted-foreground pt-0.5">
          <span>Potongan dari {formatRupiah(sellPrice)}/unit</span>
          <span>-{formatRupiah(totalAmt)}/unit</span>
        </div>
      )}
    </div>
  )
}

// ─── G2G Calculator ───────────────────────────────────────────────────────────

function G2GCalc({ fee }: { fee: G2GFeeParams }) {
  const eff = fee.commissionPct * (1 + fee.vatPct / 100)
  const effectiveWdPct = fee.withdrawalFeePct * (1 + fee.vatPct / 100)
  const totalCostPct = eff + effectiveWdPct

  const [buyPrice, setBuyPrice] = useState(0)
  const [sellPrice, setSellPrice] = useState(0)
  const [margin, setMargin] = useState(0.6)
  const [marginLocked, setMarginLocked] = useState(false)

  useEffect(() => {
    const savedMargin = localStorage.getItem("calc-g2g-margin")
    const savedLocked = localStorage.getItem("calc-g2g-margin-locked") === "true"
    if (savedMargin) setMargin(Number(savedMargin))
    setMarginLocked(savedLocked)
  }, [])

  function handleMarginChange(v: number) {
    if (marginLocked) return
    setMargin(v)
    localStorage.setItem("calc-g2g-margin", String(v))
  }

  function toggleMarginLock() {
    const next = !marginLocked
    setMarginLocked(next)
    localStorage.setItem("calc-g2g-margin-locked", String(next))
    localStorage.setItem("calc-g2g-margin", String(margin))
  }

  const hasBuy = buyPrice > 0
  const hasSell = sellPrice > 0

  const minSell = useMemo(
    () => hasBuy && !hasSell ? calcG2GMinSell(buyPrice, margin, fee) : 0,
    [buyPrice, sellPrice, margin, fee, hasBuy, hasSell]
  )
  const fromMinSell = useMemo(
    () => minSell > 0 ? calcG2GFromSell(minSell, 0, fee, buyPrice) : null,
    [minSell, buyPrice, fee]
  )
  const fromSellOnly = useMemo(
    () => hasSell && !hasBuy ? calcG2GFromSell(sellPrice, margin, fee) : null,
    [sellPrice, buyPrice, margin, fee, hasSell, hasBuy]
  )
  const breakdown = useMemo(
    () => hasBuy && hasSell ? calcG2GBreakdown(buyPrice, sellPrice, fee) : null,
    [buyPrice, sellPrice, fee, hasBuy, hasSell]
  )

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left: Inputs */}
      <div className="space-y-4">
        <NumInput label="Harga Beli / unit (IDR)" value={buyPrice} onChange={setBuyPrice} prefix="Rp" hint="Harga dari supplier/Telegram (opsional)" />
        <NumInput label="Harga Jual di G2G (IDR)" value={sellPrice} onChange={setSellPrice} prefix="Rp" hint="Harga posting kamu atau harga kompetitor (opsional)" />
        <NumInput
          label="Target Margin (%)"
          value={margin}
          onChange={handleMarginChange}
          suffix="%"
          step={0.1}
          locked={marginLocked}
          onToggleLock={toggleMarginLock}
          hint={marginLocked ? "Margin dikunci — klik 'Terkunci' untuk ubah" : undefined}
        />
        <div className="rounded-lg bg-secondary/40 border border-border p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fee efektif total</span>
            <span className="text-danger font-semibold">{formatPct(totalCostPct)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Komisi {formatPct(eff)} + WD {formatPct(effectiveWdPct)}</span>
          </div>
        </div>
      </div>

      {/* Right: Results */}
      <div className="space-y-4">
        {!hasBuy && !hasSell ? (
          <div className="rounded-xl border border-border bg-secondary/20 p-4 flex items-center justify-center h-24 text-sm text-muted-foreground">
            Isi harga beli dan/atau jual untuk melihat hasil
          </div>
        ) : hasBuy && hasSell ? (
          <>
            <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Net diterima / unit</span>
                <span className="font-medium text-foreground tabular-nums">{breakdown ? formatRupiah(breakdown.netReceivePerUnit) : "—"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Harga beli</span>
                <span className="text-muted-foreground tabular-nums">-{formatRupiah(buyPrice)}</span>
              </div>
              <div className="border-t border-gold/20 pt-2 flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Keuntungan / unit</span>
                <span className={cn("text-2xl font-bold tabular-nums", breakdown && breakdown.profitPerUnit > 0 ? "text-success" : "text-danger")}>
                  {breakdown ? formatRupiah(breakdown.profitPerUnit) : "—"}
                </span>
              </div>
            </div>
            <FeeBreakdown eff={eff} wdPct={effectiveWdPct} sellPrice={sellPrice} />
            {breakdown && <StatusBadge profit={breakdown.profitPerUnit} pct={breakdown.profitPct} />}
          </>
        ) : hasBuy ? (
          minSell > 0 ? (
            <>
              <div className="rounded-xl border border-gold/30 bg-gold/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Harga Minimal Post G2G</p>
                    <p className="text-xs text-muted-foreground mt-0.5">per unit</p>
                  </div>
                  <p className="text-2xl font-semibold text-gold tabular-nums">{formatRupiah(minSell)}</p>
                </div>
              </div>
              {fromMinSell && (
                <>
                  <FeeBreakdown eff={eff} wdPct={effectiveWdPct} sellPrice={minSell} />
                  <StatusBadge profit={fromMinSell.profitPerUnit} pct={fromMinSell.profitPct} />
                </>
              )}
            </>
          ) : null
        ) : (
          fromSellOnly ? (
            <>
              <div className="rounded-xl border border-gold/30 bg-gold/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Maks Harga Beli dari Farmer</p>
                    <p className="text-xs text-muted-foreground mt-0.5">per unit</p>
                  </div>
                  <p className="text-2xl font-semibold text-gold tabular-nums">{formatRupiah(fromSellOnly.maxBuyPrice)}</p>
                </div>
              </div>
              <FeeBreakdown eff={eff} wdPct={effectiveWdPct} sellPrice={sellPrice} />
              <div className="rounded-lg bg-secondary/40 border border-border p-3 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Net diterima per unit</span>
                  <span className="text-foreground font-medium tabular-nums">{formatRupiah(fromSellOnly.netReceivePerUnit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Maks beli farmer</span>
                  <span className="text-gold font-medium tabular-nums">{formatRupiah(fromSellOnly.maxBuyPrice)}</span>
                </div>
              </div>
              <StatusBadge profit={fromSellOnly.profitPerUnit} pct={fromSellOnly.profitPct} />
            </>
          ) : null
        )}
      </div>
    </div>
  )
}

// ─── Direct Calculator ────────────────────────────────────────────────────────

function DirectCalc() {
  const [payFee, setPayFee] = useState(0)
  const [buyPrice, setBuyPrice] = useState(0)
  const [sellPrice, setSellPrice] = useState(0)
  const [margin, setMargin] = useState(0.6)

  const hasBuy = buyPrice > 0
  const hasSell = sellPrice > 0

  const fromBuy = useMemo(
    () => hasBuy && !hasSell ? calcDirectFromBuy(buyPrice, margin, payFee) : null,
    [buyPrice, sellPrice, margin, payFee, hasBuy, hasSell]
  )
  const fromSell = useMemo(
    () => hasSell && !hasBuy ? calcDirectFromOffer(sellPrice, margin, payFee) : null,
    [buyPrice, sellPrice, margin, payFee, hasSell, hasBuy]
  )
  const bothResult = useMemo(() => {
    if (!hasBuy || !hasSell) return null
    const feeFrac = payFee / 100
    const paymentFeeAmount = sellPrice * feeFrac
    const netReceivePerUnit = sellPrice - paymentFeeAmount
    const profitPerUnit = netReceivePerUnit - buyPrice
    const profitPct = sellPrice > 0 ? profitPerUnit / sellPrice * 100 : 0
    return { paymentFeeAmount, netReceivePerUnit, profitPerUnit, profitPct }
  }, [buyPrice, sellPrice, payFee, hasBuy, hasSell])

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-end gap-4">
            <div className="max-w-xs w-full">
              <NumInput
                label="Fee Metode Pembayaran (%)"
                value={payFee}
                onChange={setPayFee}
                suffix="%"
                step={0.1}
                hint="QRIS, transfer, dll. Isi 0 jika tidak ada fee"
              />
            </div>
            {payFee === 0 && (
              <Badge variant="outline" className="mb-1 bg-success/10 text-success border-0">Tidak ada fee pembayaran</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Inputs */}
        <div className="space-y-4">
          <NumInput label="Harga Beli / unit (IDR)" value={buyPrice} onChange={setBuyPrice} prefix="Rp" hint="Harga dari farmer (opsional)" />
          <NumInput label="Harga Jual / Tawar Buyer (IDR)" value={sellPrice} onChange={setSellPrice} prefix="Rp" hint="Harga kamu tawarkan atau penawaran buyer (opsional)" />
          <NumInput label="Target Margin (%)" value={margin} onChange={setMargin} suffix="%" step={0.1} />
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          {!hasBuy && !hasSell ? (
            <div className="rounded-xl border border-border bg-secondary/20 p-4 flex items-center justify-center h-24 text-sm text-muted-foreground">
              Isi harga beli dan/atau jual untuk melihat hasil
            </div>
          ) : hasBuy && hasSell ? (
            <>
              <div className="rounded-xl border border-success/30 bg-success/5 p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Net diterima / unit</span>
                  <span className="font-medium text-foreground tabular-nums">{formatRupiah(bothResult!.netReceivePerUnit)}</span>
                </div>
                {payFee > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Fee payment ({payFee}%)</span>
                    <span className="text-danger tabular-nums">-{formatRupiah(bothResult!.paymentFeeAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Harga beli</span>
                  <span className="text-muted-foreground tabular-nums">-{formatRupiah(buyPrice)}</span>
                </div>
                <div className="border-t border-success/20 pt-2 flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Keuntungan / unit</span>
                  <span className={cn("text-2xl font-bold tabular-nums", bothResult!.profitPerUnit > 0 ? "text-success" : "text-danger")}>
                    {formatRupiah(bothResult!.profitPerUnit)}
                  </span>
                </div>
              </div>
              <StatusBadge profit={bothResult!.profitPerUnit} pct={bothResult!.profitPct} />
            </>
          ) : hasBuy ? (
            fromBuy ? (
              <>
                <div className="rounded-xl border border-success/30 bg-success/5 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Harga Minimal ke Buyer</p>
                      <p className="text-xs text-muted-foreground mt-0.5">per unit</p>
                    </div>
                    <p className="text-2xl font-semibold text-success tabular-nums">{formatRupiah(fromBuy.minSellPrice)}</p>
                  </div>
                </div>
                <div className="rounded-lg bg-secondary/40 border border-border p-3 text-sm space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Harga beli</span>
                    <span className="text-foreground">{formatRupiah(buyPrice)}</span>
                  </div>
                  {payFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fee payment ({payFee}%)</span>
                      <span className="text-danger">-{formatRupiah(fromBuy.paymentFeeAmount)}</span>
                    </div>
                  )}
                </div>
                <StatusBadge profit={fromBuy.profitPerUnit} pct={fromBuy.profitPct} />
              </>
            ) : null
          ) : (
            fromSell ? (
              <>
                <div className="rounded-xl border border-success/30 bg-success/5 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Maks Harga Beli dari Farmer</p>
                      <p className="text-xs text-muted-foreground mt-0.5">per unit</p>
                    </div>
                    <p className="text-2xl font-semibold text-success tabular-nums">{formatRupiah(fromSell.maxBuyPrice)}</p>
                  </div>
                </div>
                <div className="rounded-lg bg-secondary/40 border border-border p-3 text-sm space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Harga tawar buyer</span>
                    <span className="text-foreground">{formatRupiah(sellPrice)}</span>
                  </div>
                  {payFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fee payment ({payFee}%)</span>
                      <span className="text-danger">-{formatRupiah(fromSell.paymentFeeAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Net diterima</span>
                    <span className="text-foreground">{formatRupiah(fromSell.netReceivePerUnit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Maks beli farmer</span>
                    <span className="text-success font-medium">{formatRupiah(fromSell.maxBuyPrice)}</span>
                  </div>
                </div>
                <StatusBadge profit={fromSell.profitPerUnit} pct={fromSell.profitPct} />
              </>
            ) : null
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KalkulatorPage() {
  const [fee, setFee] = useState<G2GFeeParams>(DEFAULT_FEE)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from("fee_config")
        .select("commission_pct, vat_pct, withdrawal_fee_pct, withdrawal_fee_fixed")
        .eq("is_active", true).single()
      if (data) setFee({
        commissionPct: data.commission_pct,
        vatPct: data.vat_pct,
        withdrawalFeePct: data.withdrawal_fee_pct,
        withdrawalFeeFixed: data.withdrawal_fee_fixed,
      })
    }
    load()
  }, [])

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 page-content">
        <Header />
        <main className="p-4 md:p-6 lg:p-8">
          <div className="mb-6">
            <h1 className="font-heading text-3xl font-bold text-foreground mb-1">Kalkulator Trading</h1>
            <p className="text-muted-foreground text-sm">
              Rank: <span className="text-gold">Uncommon</span> · Komisi 7.99% + PPN 11% = efektif 8.8689% · WD disbursement 2.48% + PPN 11% = efektif 2.7528%
            </p>
          </div>

          <Tabs defaultValue="g2g" className="space-y-6">
            <TabsList className="bg-card border border-border">
              <TabsTrigger value="g2g" className="data-[state=active]:bg-red-900/80 data-[state=active]:text-red-100 data-[state=active]:border-red-800">
                G2G Platform
              </TabsTrigger>
              <TabsTrigger value="direct" className="data-[state=active]:bg-blue-900/80 data-[state=active]:text-blue-100 data-[state=active]:border-blue-800">
                Direct Sale
              </TabsTrigger>
            </TabsList>
            <TabsContent value="g2g">
              <div className="rounded-xl border border-red-900/30 bg-red-950/10 p-4">
                <G2GCalc fee={fee} />
              </div>
            </TabsContent>
            <TabsContent value="direct">
              <div className="rounded-xl border border-blue-900/30 bg-blue-950/10 p-4">
                <DirectCalc />
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
