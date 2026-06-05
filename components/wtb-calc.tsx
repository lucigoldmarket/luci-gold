"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Calculator, X, Minus, GripHorizontal, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { calcG2GMinSell, calcG2GFromSell, type G2GFeeParams } from "@/lib/calc"
import { createClient } from "@/lib/supabase/client"

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

export function WTBCalc() {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [fee, setFee] = useState<G2GFeeParams>(DEFAULT_FEE)
  const [buyPrice, setBuyPrice] = useState(0)
  const [sellPrice, setSellPrice] = useState(0)
  const [margin, setMargin] = useState(0.6)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [ready, setReady] = useState(false)

  const dragRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)

  useEffect(() => {
    setPos({ x: window.innerWidth - 340, y: 88 })
    setReady(true)

    const b = localStorage.getItem("wtb-calc-buy")
    const s = localStorage.getItem("wtb-calc-sell")
    const m = localStorage.getItem("wtb-calc-margin")
    if (b) setBuyPrice(Number(b))
    if (s) setSellPrice(Number(s))
    if (m) setMargin(Number(m))

    async function loadFee() {
      const supabase = createClient()
      const { data } = await supabase
        .from("fee_config")
        .select("commission_pct, vat_pct, withdrawal_fee_pct, withdrawal_fee_fixed")
        .eq("is_active", true).single()
      if (data) setFee({
        commissionPct: data.commission_pct,
        vatPct: data.vat_pct,
        withdrawalFeePct: data.withdrawal_fee_pct,
        withdrawalFeeFixed: data.withdrawal_fee_fixed,
      })
    }
    loadFee()
  }, [])

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return
    const newX = dragRef.current.px + (e.clientX - dragRef.current.mx)
    const newY = dragRef.current.py + (e.clientY - dragRef.current.my)
    setPos({
      x: Math.max(0, Math.min(newX, window.innerWidth - 320)),
      y: Math.max(0, Math.min(newY, window.innerHeight - 48)),
    })
  }, [])

  const onMouseUp = useCallback(() => {
    dragRef.current = null
    window.removeEventListener("mousemove", onMouseMove)
    window.removeEventListener("mouseup", onMouseUp)
  }, [onMouseMove])

  function onMouseDown(e: React.MouseEvent) {
    dragRef.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
  }

  const hasBuy = buyPrice > 0
  const hasSell = sellPrice > 0
  const eff = fee.commissionPct * (1 + fee.vatPct / 100)
  const wdPct = fee.withdrawalFeePct * (1 + fee.vatPct / 100)
  const totalFee = eff + wdPct

  const minSell = hasBuy && !hasSell ? calcG2GMinSell(buyPrice, margin, fee) : 0
  const breakdown = hasBuy && hasSell ? calcG2GFromSell(sellPrice, 0, fee, buyPrice) : null
  const fromSellOnly = !hasBuy && hasSell ? calcG2GFromSell(sellPrice, margin, fee) : null

  if (!ready) return null

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-gold text-background px-4 py-2.5 shadow-xl hover:bg-gold/90 transition-all font-medium text-sm"
      >
        <Calculator className="h-4 w-4" />
        Kalkulator
      </button>
    )
  }

  return (
    <div
      className="fixed z-50 w-[300px] rounded-xl border border-gold/30 bg-card shadow-2xl"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Drag handle / header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-border cursor-grab active:cursor-grabbing rounded-t-xl bg-secondary/50 select-none"
        onMouseDown={onMouseDown}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <Calculator className="h-3.5 w-3.5 text-gold" />
          <span className="text-xs font-semibold text-foreground">Kalkulator G2G</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setMinimized(!minimized)}
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title={minimized ? "Perluas" : "Minimize"}
          >
            {minimized ? <ChevronDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          </button>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Tutup"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="p-3 space-y-2.5">
          {/* Inputs */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Harga Beli</Label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">Rp</span>
                <Input
                  type="number"
                  value={buyPrice || ""}
                  onChange={(e) => {
                    setBuyPrice(Number(e.target.value))
                    localStorage.setItem("wtb-calc-buy", e.target.value)
                  }}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  className="pl-7 h-7 text-xs bg-background"
                  min={0}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Harga Jual</Label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">Rp</span>
                <Input
                  type="number"
                  value={sellPrice || ""}
                  onChange={(e) => {
                    setSellPrice(Number(e.target.value))
                    localStorage.setItem("wtb-calc-sell", e.target.value)
                  }}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  className="pl-7 h-7 text-xs bg-background"
                  min={0}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Target Margin</Label>
            <div className="relative">
              <Input
                type="number"
                value={margin || ""}
                onChange={(e) => {
                  setMargin(Number(e.target.value))
                  localStorage.setItem("wtb-calc-margin", e.target.value)
                }}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                className="pr-7 h-7 text-xs bg-background"
                min={0}
                step={0.1}
                placeholder="0.6"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">%</span>
            </div>
          </div>

          {/* Results */}
          {(hasBuy || hasSell) ? (
            <div className="rounded-lg border border-gold/20 bg-gold/5 p-2.5 space-y-1.5 text-xs">
              {hasBuy && !hasSell && minSell > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Min Post G2G</span>
                    <span className="font-bold text-gold tabular-nums">{formatRupiah(minSell)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total fee efektif</span>
                    <span className="text-danger">-{formatPct(totalFee)}</span>
                  </div>
                </>
              )}
              {hasBuy && hasSell && breakdown && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Net diterima</span>
                    <span className="text-foreground tabular-nums">{formatRupiah(breakdown.netReceivePerUnit)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gold/20 pt-1.5">
                    <span className="text-muted-foreground">Profit / unit</span>
                    <span className={cn("font-bold tabular-nums", breakdown.profitPerUnit > 0 ? "text-success" : "text-danger")}>
                      {formatRupiah(breakdown.profitPerUnit)}
                      <span className="font-normal ml-1">({formatPct(breakdown.profitPct)})</span>
                    </span>
                  </div>
                </>
              )}
              {!hasBuy && hasSell && fromSellOnly && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Maks beli farmer</span>
                    <span className="font-bold text-gold tabular-nums">{formatRupiah(fromSellOnly.maxBuyPrice)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Net diterima</span>
                    <span className="tabular-nums">{formatRupiah(fromSellOnly.netReceivePerUnit)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-muted-foreground border-t border-gold/10 pt-1">
                <span>Fee total</span>
                <span className="text-danger">-{formatPct(totalFee)}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-1">
              Isi harga beli atau jual untuk kalkulasi
            </p>
          )}
        </div>
      )}
    </div>
  )
}
