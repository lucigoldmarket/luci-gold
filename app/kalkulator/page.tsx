"use client"

import { useState, useEffect, useMemo } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle, Info, Lock, LockOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { RequireAdmin } from "@/components/require-admin"
import {
  calcG2GMinSell,
  calcG2GFromSell,
  calcDirectFromBuy,
  calcDirectFromOffer,
  calcFixedFeeImpact,
  calcMinWithdrawalForTarget,
  type G2GFeeParams,
} from "@/lib/calc"

const DEFAULT_FEE: G2GFeeParams = {
  commissionPct: 7.99,
  vatPct: 11,
  withdrawalFeePct: 1.99,
  withdrawalFeeFixed: 19999,
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

function FeeBreakdown({ eff, wdPct, sellPrice, label = "Harga Jual" }: {
  eff: number; wdPct: number; sellPrice: number; label?: string
}) {
  const commAmt = sellPrice * eff / 100
  const wdAmt = sellPrice * wdPct / 100
  const totalAmt = commAmt + wdAmt
  return (
    <div className="rounded-lg bg-secondary/40 border border-border p-3 space-y-1.5 text-sm">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Breakdown Fee</p>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Komisi G2G ({formatPct(7.99)})</span>
        <span className="text-foreground">—</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">+ PPN 11% → efektif</span>
        <span className="text-danger font-medium">-{formatPct(eff)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Withdrawal DOKU</span>
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

// ─── Fixed Fee Withdrawal Info ────────────────────────────────────────────────

function WithdrawalFeeInfo({ fixedFee }: { fixedFee: number }) {
  const [planned, setPlanned] = useState(2000000)
  const [simMargin, setSimMargin] = useState(0.6)
  const impact = calcFixedFeeImpact(planned, fixedFee)
  const totalMinMargin = simMargin + impact.impactPct
  const targets = [2, 1, 0.5, 0.4]

  return (
    <Card className="bg-card border-border border-gold/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-foreground flex items-center gap-2">
          <Info className="h-4 w-4 text-gold" />
          Berapa % Minimal Margin untuk Menutup Rp 19.999/withdrawal?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Rp 19.999 dicatat sebagai <span className="text-foreground">pengeluaran saat withdrawal</span>, bukan per transaksi.
          Simulasikan di sini berapa % margin minimum yang harus kamu kejar.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-sm">Target margin profit (%)</Label>
            <div className="relative">
              <Input
                type="number"
                value={simMargin || ""}
                onChange={(e) => setSimMargin(Number(e.target.value))}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                className="bg-background border-border text-foreground pr-8"
                min={0}
                step={0.1}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-sm">Estimasi nominal withdrawal (IDR)</Label>
            <Input
              type="number"
              value={planned || ""}
              onChange={(e) => setPlanned(Number(e.target.value))}
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              className="bg-background border-border text-foreground"
              min={148000}
            />
            <p className="text-xs text-muted-foreground">Min. G2G: Rp 148.000</p>
          </div>
        </div>

        {/* Actionable result */}
        <div className={cn(
          "rounded-lg p-4 border space-y-3",
          impact.isEfficent ? "bg-success/10 border-success/30" : impact.impactPct < 2 ? "bg-gold/10 border-gold/30" : "bg-danger/10 border-danger/30"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Coverage Rp 19.999</span>
            <span className={cn("font-semibold",
              impact.isEfficent ? "text-success" : impact.impactPct < 2 ? "text-gold" : "text-danger"
            )}>+{formatPct(impact.impactPct)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border/50 pt-3">
            <span className="text-sm font-medium text-foreground">
              Margin minimal total
              <span className="text-xs text-muted-foreground font-normal ml-1">({formatPct(simMargin)} profit + coverage)</span>
            </span>
            <span className="font-bold text-2xl text-gold">{formatPct(totalMinMargin)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Dengan withdrawal {formatRupiah(planned)}, set margin minimal{" "}
            <span className="text-gold font-semibold">{formatPct(totalMinMargin)}</span> agar profit bersih setelah semua fee + Rp 19.999 tetap positif.
          </p>
        </div>

        <div className="rounded-lg bg-secondary/40 border border-border p-3">
          <p className="text-xs text-muted-foreground font-medium mb-2">Tabel referensi — berapa minimal withdrawal per target coverage:</p>
          <div className="grid grid-cols-2 gap-2">
            {targets.map((t) => (
              <div key={t} className={cn(
                "flex justify-between text-xs rounded p-1.5",
                impact.impactPct <= t ? "bg-success/10" : ""
              )}>
                <span className="text-muted-foreground">Coverage &lt; {t}%</span>
                <span className="text-gold font-medium">{formatRupiah(calcMinWithdrawalForTarget(t, fixedFee))}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── G2G Calculator ───────────────────────────────────────────────────────────

function G2GCalc({ fee }: { fee: G2GFeeParams }) {
  const eff = fee.commissionPct * (1 + fee.vatPct / 100)
  const totalCostPct = eff + fee.withdrawalFeePct

  // Shared locked margin
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

  // Arah 1
  const [buyPrice1, setBuyPrice1] = useState(0)
  const minSell = useMemo(
    () => buyPrice1 > 0 ? calcG2GMinSell(buyPrice1, margin, fee) : 0,
    [buyPrice1, margin, fee]
  )
  const breakdown1 = useMemo(
    () => minSell > 0 ? calcG2GFromSell(minSell, 0, fee, buyPrice1) : null,
    [minSell, buyPrice1, fee]
  )

  // Arah 2
  const [sellPrice2, setSellPrice2] = useState(0)
  const result2 = useMemo(
    () => sellPrice2 > 0 ? calcG2GFromSell(sellPrice2, margin, fee) : null,
    [sellPrice2, margin, fee]
  )

  // Shared margin input block
  const marginInput = (
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
  )

  return (
    <div className="space-y-6">
      <Tabs defaultValue="arah1">
        <TabsList className="bg-card border border-border w-full">
          <TabsTrigger value="arah1" className="flex-1 data-[state=active]:bg-gold data-[state=active]:text-background">
            Dari Harga Beli → Min Post G2G
          </TabsTrigger>
          <TabsTrigger value="arah2" className="flex-1 data-[state=active]:bg-gold data-[state=active]:text-background">
            Dari Harga Jual → Max Beli Farmer
          </TabsTrigger>
        </TabsList>

        {/* Arah 1 */}
        <TabsContent value="arah1" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <NumInput label="Harga Beli / unit (IDR)" value={buyPrice1} onChange={setBuyPrice1} prefix="Rp" hint="Harga dari supplier/Telegram" />
              {marginInput}
              <div className="rounded-lg bg-secondary/40 border border-border p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fee efektif total</span>
                  <span className="text-danger font-semibold">{formatPct(totalCostPct)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Komisi {formatPct(fee.commissionPct)} + PPN {fee.vatPct}% = {formatPct(eff)}</span>
                  <span>+ WD {formatPct(fee.withdrawalFeePct)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {minSell > 0 ? (
                <>
                  {/* Result card — clean display */}
                  <div className="rounded-xl border border-gold/30 bg-gold/5 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Harga Minimal Post G2G</p>
                        <p className="text-xs text-muted-foreground mt-0.5">per unit</p>
                      </div>
                      <p className="text-2xl font-semibold text-gold tabular-nums">{formatRupiah(minSell)}</p>
                    </div>
                  </div>
                  {breakdown1 && (
                    <>
                      <FeeBreakdown eff={eff} wdPct={fee.withdrawalFeePct} sellPrice={minSell} />
                      <StatusBadge profit={breakdown1.profitPerUnit} pct={breakdown1.profitPct} />
                    </>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-border bg-secondary/20 p-4 flex items-center justify-center h-24 text-sm text-muted-foreground">
                  Isi harga beli untuk melihat rekomendasi
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Arah 2 */}
        <TabsContent value="arah2" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <NumInput label="Harga Jual di G2G (IDR)" value={sellPrice2} onChange={setSellPrice2} prefix="Rp" hint="Harga posting kamu atau harga kompetitor" />
              {marginInput}
              <div className="rounded-lg bg-secondary/40 border border-border p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fee efektif total</span>
                  <span className="text-danger font-semibold">{formatPct(totalCostPct)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Komisi {formatPct(eff)} + WD {formatPct(fee.withdrawalFeePct)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {result2 ? (
                <>
                  <div className="rounded-xl border border-gold/30 bg-gold/5 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Maks Harga Beli dari Farmer</p>
                        <p className="text-xs text-muted-foreground mt-0.5">per unit</p>
                      </div>
                      <p className="text-2xl font-semibold text-gold tabular-nums">{formatRupiah(result2.maxBuyPrice)}</p>
                    </div>
                  </div>
                  <FeeBreakdown eff={eff} wdPct={fee.withdrawalFeePct} sellPrice={sellPrice2} />
                  <div className="rounded-lg bg-secondary/40 border border-border p-3 text-sm space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Net diterima per unit</span>
                      <span className="text-foreground font-medium tabular-nums">{formatRupiah(result2.netReceivePerUnit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Maks beli farmer</span>
                      <span className="text-gold font-medium tabular-nums">{formatRupiah(result2.maxBuyPrice)}</span>
                    </div>
                  </div>
                  <StatusBadge profit={result2.profitPerUnit} pct={result2.profitPct} />
                </>
              ) : (
                <div className="rounded-xl border border-border bg-secondary/20 p-4 flex items-center justify-center h-24 text-sm text-muted-foreground">
                  Isi harga jual untuk melihat rekomendasi
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <WithdrawalFeeInfo fixedFee={fee.withdrawalFeeFixed} />
    </div>
  )
}

// ─── Direct Calculator ────────────────────────────────────────────────────────

function DirectCalc() {
  const [payFee, setPayFee] = useState(0)

  // Arah 1
  const [buyPrice1, setBuyPrice1] = useState(0)
  const [margin1, setMargin1] = useState(0.6)
  const result1 = useMemo(
    () => buyPrice1 > 0 ? calcDirectFromBuy(buyPrice1, margin1, payFee) : null,
    [buyPrice1, margin1, payFee]
  )

  // Arah 2
  const [offer2, setOffer2] = useState(0)
  const [margin2, setMargin2] = useState(0.6)
  const result2 = useMemo(
    () => offer2 > 0 ? calcDirectFromOffer(offer2, margin2, payFee) : null,
    [offer2, margin2, payFee]
  )

  return (
    <div className="space-y-4">
      {/* Fee input — shared for both directions */}
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

      <Tabs defaultValue="arah1">
        <TabsList className="bg-card border border-border w-full">
          <TabsTrigger value="arah1" className="flex-1 data-[state=active]:bg-gold data-[state=active]:text-background">
            Dari Harga Beli → Min Tawar Buyer
          </TabsTrigger>
          <TabsTrigger value="arah2" className="flex-1 data-[state=active]:bg-gold data-[state=active]:text-background">
            Dari Penawaran Buyer → Max Beli Farmer
          </TabsTrigger>
        </TabsList>

        {/* Arah 1 */}
        <TabsContent value="arah1" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <NumInput label="Harga Beli / unit (IDR)" value={buyPrice1} onChange={setBuyPrice1} prefix="Rp" />
              <NumInput label="Target Margin (%)" value={margin1} onChange={setMargin1} suffix="%" step={0.1} />
            </div>
            <div className="space-y-4">
              {result1 ? (
                <>
                  <div className="rounded-xl border border-success/30 bg-success/5 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Harga Minimal ke Buyer</p>
                        <p className="text-xs text-muted-foreground mt-0.5">per unit</p>
                      </div>
                      <p className="text-2xl font-semibold text-success tabular-nums">{formatRupiah(result1.minSellPrice)}</p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-secondary/40 border border-border p-3 text-sm space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Harga beli</span>
                      <span className="text-foreground">{formatRupiah(buyPrice1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Harga jual min</span>
                      <span className="text-foreground">{formatRupiah(result1.minSellPrice)}</span>
                    </div>
                    {payFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fee payment ({payFee}%)</span>
                        <span className="text-danger">-{formatRupiah(result1.paymentFeeAmount)}</span>
                      </div>
                    )}
                  </div>

                  <StatusBadge profit={result1.profitPerUnit} pct={result1.profitPct} />
                </>
              ) : (
                <div className="rounded-xl border border-border bg-secondary/20 p-4 flex items-center justify-center h-24 text-sm text-muted-foreground">
                  Isi harga beli untuk melihat rekomendasi
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Arah 2 */}
        <TabsContent value="arah2" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <NumInput label="Harga Tawar Buyer (IDR)" value={offer2} onChange={setOffer2} prefix="Rp" />
              <NumInput label="Target Margin (%)" value={margin2} onChange={setMargin2} suffix="%" step={0.1} />
            </div>
            <div className="space-y-4">
              {result2 ? (
                <>
                  <div className="rounded-xl border border-success/30 bg-success/5 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Maks Harga Beli dari Farmer</p>
                        <p className="text-xs text-muted-foreground mt-0.5">per unit</p>
                      </div>
                      <p className="text-2xl font-semibold text-success tabular-nums">{formatRupiah(result2.maxBuyPrice)}</p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-secondary/40 border border-border p-3 text-sm space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Harga tawar buyer</span>
                      <span className="text-foreground">{formatRupiah(offer2)}</span>
                    </div>
                    {payFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fee payment ({payFee}%)</span>
                        <span className="text-danger">-{formatRupiah(result2.paymentFeeAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Net diterima</span>
                      <span className="text-foreground">{formatRupiah(result2.netReceivePerUnit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Maks beli farmer</span>
                      <span className="text-gold font-medium">{formatRupiah(result2.maxBuyPrice)}</span>
                    </div>
                  </div>

                  <StatusBadge profit={result2.profitPerUnit} pct={result2.profitPct} />
                </>
              ) : (
                <div className="rounded-xl border border-border bg-secondary/20 p-4 flex items-center justify-center h-24 text-sm text-muted-foreground">
                  Isi harga tawar buyer untuk melihat rekomendasi
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
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
    <RequireAdmin>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 page-content">
          <Header />
          <main className="p-4 md:p-6 lg:p-8">
            <div className="mb-6">
              <h1 className="font-heading text-3xl font-bold text-foreground mb-1">Kalkulator Trading</h1>
              <p className="text-muted-foreground text-sm">
                Rank: <span className="text-gold">Uncommon</span> · Komisi 7.99% + PPN 11% → efektif 8.87% · DOKU 1.99% + Rp 19.999/withdrawal
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
    </RequireAdmin>
  )
}
