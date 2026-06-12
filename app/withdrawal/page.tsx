"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { createPortal } from "react-dom"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle, Loader2, AlertTriangle, ArrowDownToLine, Pencil, Trash2, SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { RequireAdmin } from "@/components/require-admin"

function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

interface TxRow {
  id: string
  transaction_date: string
  gold_amount: number
  sell_price_idr: number
  buy_price_idr: number
  profit_idr: number | null
  notes: string | null
  order_code?: string | null
  withdrawal_id?: string | null
  buyer_vat_pct?: number | null
}

const WD_COLS = [
  { id: "tanggal",    label: "Tanggal",    def: true },
  { id: "status",     label: "Status",     def: true },
  { id: "keterangan", label: "Keterangan", def: true },
  { id: "gold",       label: "Gold",       def: true },
  { id: "harga_jual", label: "Harga Jual", def: true },
  { id: "total_sell", label: "Total Sell", def: true },
  { id: "profit",     label: "Profit",     def: true },
] as const
type WdColId = typeof WD_COLS[number]["id"]

function initWdCols(): Set<WdColId> {
  if (typeof window === "undefined") return new Set(WD_COLS.filter(c => c.def).map(c => c.id))
  try {
    const saved = localStorage.getItem("wd-cols")
    if (saved) return new Set(JSON.parse(saved) as WdColId[])
  } catch {}
  return new Set(WD_COLS.filter(c => c.def).map(c => c.id))
}

interface WithdrawalRow {
  id: string
  withdrawal_date: string
  amount_idr: number
  withdrawal_fee_pct: number
  withdrawal_fee_fixed_idr: number
  amount_received_idr: number
  notes: string | null
  created_at: string
}


interface FeeConfig {
  commissionPct: number
  vatPct: number
  withdrawalFeePct: number
  withdrawalFeeFixed: number  // IDR fixed fee (e.g. 19999)
}

const DEFAULT_FEE: FeeConfig = { commissionPct: 7.99, vatPct: 11, withdrawalFeePct: 1.99, withdrawalFeeFixed: 16863 }

// ─── Tab: Catat Withdrawal ────────────────────────────────────────────────────

function CatatWithdrawal({ onDone }: { onDone: () => void }) {
  const [transactions, setTransactions] = useState<TxRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [visibleCols, setVisibleColsRaw] = useState<Set<WdColId>>(initWdCols)
  const [showColMenu, setShowColMenu] = useState(false)
  const [colMenuPos, setColMenuPos] = useState({ top: 0, right: 0 })
  const colMenuRef = useRef<HTMLDivElement>(null)

  function setVisibleCols(next: Set<WdColId>) {
    setVisibleColsRaw(next)
    if (typeof window !== "undefined") localStorage.setItem("wd-cols", JSON.stringify([...next]))
  }
  const vis = (id: WdColId) => visibleCols.has(id)

  function openColMenu() {
    if (colMenuRef.current) {
      const rect = colMenuRef.current.getBoundingClientRect()
      setColMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setShowColMenu(true)
  }
  const [withdrawDate, setWithdrawDate] = useState(new Date().toISOString().slice(0, 10))
  const [manualAmount, setManualAmount] = useState(0)
  const [useManual, setUseManual] = useState(false)
  const [notes, setNotes] = useState("")
  const [feeConfig, setFeeConfig] = useState<FeeConfig>(DEFAULT_FEE)
  const [actualNetReceived, setActualNetReceived] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const [txResult, feeResult] = await Promise.all([
        supabase.from("transactions")
          .select("id, transaction_date, gold_amount, sell_price_idr, buy_price_idr, profit_idr, notes, order_code, withdrawal_id, status, buyer_vat_pct")
          .eq("channel", "g2g")
          .in("status", ["pending", "completed"])
          .is("withdrawal_id", null)
          .order("transaction_date", { ascending: false }),
        supabase.from("fee_config")
          .select("commission_pct, vat_pct, withdrawal_fee_pct, withdrawal_fee_fixed")
          .eq("is_active", true)
          .single(),
      ])

      if (txResult.error) {
        const { data: fallback } = await supabase
          .from("transactions")
          .select("id, transaction_date, gold_amount, sell_price_idr, buy_price_idr, profit_idr, notes, order_code, status, buyer_vat_pct")
          .eq("channel", "g2g")
          .in("status", ["pending", "completed"])
          .order("transaction_date", { ascending: false })
        setTransactions((fallback as TxRow[]) ?? [])
      } else {
        setTransactions((txResult.data as TxRow[]) ?? [])
      }

      if (feeResult.data) {
        const fc = feeResult.data as any
        setFeeConfig({
          commissionPct: fc.commission_pct ?? 7.99,
          vatPct: fc.vat_pct ?? 11,
          withdrawalFeePct: fc.withdrawal_fee_pct ?? 1.99,
          withdrawalFeeFixed: fc.withdrawal_fee_fixed ?? 16863,
        })
      }

      setLoading(false)
    }
    load()
  }, [])

  const selectedTxs = transactions.filter((t) => selected.has(t.id))

  const estimatedBalance = useMemo(() =>
    selectedTxs.reduce((s, t) => {
      const buyerVat = t.buyer_vat_pct ?? 0
      const effCommFrac = feeConfig.commissionPct * (1 + feeConfig.vatPct / 100 + buyerVat / 100) / 100
      return s + t.sell_price_idr * t.gold_amount * (1 - effCommFrac)
    }, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedTxs, feeConfig]
  )

  const withdrawAmount = useManual ? manualAmount : estimatedBalance

  // G2G fee formula: (pct% of amount + fixed IDR 19.999) + PPN 11% on that subtotal
  const baseFeeFromPct = withdrawAmount * (feeConfig.withdrawalFeePct / 100)
  const baseFeeFixed = feeConfig.withdrawalFeeFixed
  const baseFeeTotal = baseFeeFromPct + baseFeeFixed
  const vatOnFee = baseFeeTotal * (feeConfig.vatPct / 100)
  const totalFee = baseFeeTotal + vatOnFee
  const netReceived = withdrawAmount - totalFee

  // For display label only
  const effectiveWdPctNum = feeConfig.withdrawalFeePct * (1 + feeConfig.vatPct / 100)

  function toggleAll() {
    if (selected.size === transactions.length) setSelected(new Set())
    else setSelected(new Set(transactions.map((t) => t.id)))
  }

  async function handleSubmit() {
    if (withdrawAmount <= 0) { setError("Nominal withdrawal harus lebih dari 0."); return }
    if (netReceived <= 0) { setError("Net diterima negatif — nominal terlalu kecil."); return }
    setSaving(true); setError(null)

    const supabase = createClient()

    // 1. Insert withdrawal record
    // Gunakan net aktual dari email G2G jika diisi, fallback ke estimasi
    const finalNetReceived = actualNetReceived ?? Math.round(netReceived)

    const { data: wd, error: wdErr } = await supabase.from("withdrawals").insert({
      withdrawal_date: withdrawDate,
      amount_idr: Math.round(withdrawAmount),
      withdrawal_fee_pct: feeConfig.withdrawalFeePct,
      withdrawal_fee_fixed_idr: Math.round(withdrawAmount - finalNetReceived),
      amount_received_idr: finalNetReceived,
      notes: notes || null,
    }).select("id").single()

    if (wdErr || !wd) { setError("Gagal menyimpan withdrawal: " + wdErr?.message); setSaving(false); return }

    // 2. Link + auto-complete pending transactions
    if (selected.size > 0) {
      const selectedIds = Array.from(selected)
      await supabase.from("transactions")
        .update({ withdrawal_id: wd.id })
        .in("id", selectedIds)
      await supabase.from("transactions")
        .update({ status: "completed", settled_at: new Date().toISOString() })
        .in("id", selectedIds)
        .eq("status", "pending")
    }

    setSaving(false)
    setSelected(new Set())
    setNotes("")
    setManualAmount(0)
    setUseManual(false)
    setActualNetReceived(null)
    onDone()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Left: Transaction checklist */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-foreground flex items-center justify-between">
            <span>Transaksi G2G Belum di-Withdraw</span>
            <div className="flex items-center gap-2">
              {transactions.length > 0 && (
                <button onClick={toggleAll} className="text-xs text-gold hover:underline font-normal">
                  {selected.size === transactions.length ? "Batal semua" : "Pilih semua"}
                </button>
              )}
              <div ref={colMenuRef}>
                <button
                  onClick={() => showColMenu ? setShowColMenu(false) : openColMenu()}
                  className={cn("flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition-colors",
                    showColMenu ? "bg-gold/10 border-gold/40 text-gold" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <SlidersHorizontal className="h-3 w-3" /> Kolom
                </button>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Memuat...
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Tidak ada transaksi G2G (pending/completed) yang belum di-withdraw.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-10">
                    <button
                      onClick={toggleAll}
                      className={cn(
                        "h-4 w-4 rounded border-2 flex items-center justify-center transition-colors",
                        selected.size === transactions.length && transactions.length > 0
                          ? "bg-gold border-gold"
                          : selected.size > 0
                            ? "bg-gold/40 border-gold/60"
                            : "border-border hover:border-gold/60"
                      )}
                      title={selected.size === transactions.length ? "Batal semua" : "Pilih semua"}
                    >
                      {selected.size > 0 && (
                        <CheckCircle className="h-3 w-3 text-background" />
                      )}
                    </button>
                  </TableHead>
                  {vis("tanggal") && <TableHead className="text-muted-foreground">Tanggal</TableHead>}
                  {vis("status") && <TableHead className="text-muted-foreground">Status</TableHead>}
                  {vis("keterangan") && <TableHead className="text-muted-foreground">Keterangan</TableHead>}
                  {vis("gold") && <TableHead className="text-muted-foreground text-right">Gold</TableHead>}
                  {vis("harga_jual") && <TableHead className="text-muted-foreground text-right">Harga Jual</TableHead>}
                  {vis("total_sell") && <TableHead className="text-muted-foreground text-right">Total Sell</TableHead>}
                  {vis("profit") && <TableHead className="text-muted-foreground text-right">Profit</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const checked = selected.has(tx.id)
                  const totalSell = tx.sell_price_idr * tx.gold_amount
                  return (
                    <TableRow
                      key={tx.id}
                      className={cn("border-border cursor-pointer", checked ? "bg-gold/5" : "hover:bg-background/50")}
                      onClick={() => setSelected((prev) => {
                        const next = new Set(prev)
                        checked ? next.delete(tx.id) : next.add(tx.id)
                        return next
                      })}
                    >
                      <TableCell>
                        <div className={cn(
                          "h-4 w-4 rounded border-2 flex items-center justify-center",
                          checked ? "bg-gold border-gold" : "border-border"
                        )}>
                          {checked && <CheckCircle className="h-3 w-3 text-background" />}
                        </div>
                      </TableCell>
                      {vis("tanggal") && (
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(tx.transaction_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                        </TableCell>
                      )}
                      {vis("status") && (
                        <TableCell>
                          <Badge variant="outline" className={cn("border-0 text-xs",
                            (tx as any).status === "completed" ? "bg-success/10 text-success" : "bg-gold/10 text-gold"
                          )}>
                            {(tx as any).status === "completed" ? "Selesai" : "Pending"}
                          </Badge>
                        </TableCell>
                      )}
                      {vis("keterangan") && (
                        <TableCell className="text-sm max-w-[160px]">
                          {tx.order_code && (
                            <div className="text-xs text-gold/80 font-mono truncate" title={tx.order_code}>{tx.order_code}</div>
                          )}
                          {tx.notes && (
                            <div className="text-xs text-muted-foreground truncate" title={tx.notes}>{tx.notes}</div>
                          )}
                          {!tx.order_code && !tx.notes && <span className="text-muted-foreground/40">—</span>}
                        </TableCell>
                      )}
                      {vis("gold") && (
                        <TableCell className="text-right text-foreground text-sm">
                          {tx.gold_amount.toLocaleString("id-ID")}
                        </TableCell>
                      )}
                      {vis("harga_jual") && (
                        <TableCell className="text-right text-muted-foreground text-sm">
                          {formatRupiah(tx.sell_price_idr)}
                        </TableCell>
                      )}
                      {vis("total_sell") && (
                        <TableCell className="text-right text-foreground text-sm font-medium">
                          {formatRupiah(totalSell)}
                        </TableCell>
                      )}
                      {vis("profit") && (
                        <TableCell className={cn("text-right text-sm font-medium",
                          tx.profit_idr && tx.profit_idr > 0 ? "text-success" : "text-danger"
                        )}>
                          {tx.profit_idr != null ? formatRupiah(tx.profit_idr) : "—"}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}

          {selected.size > 0 && (
            <div className="border-t border-border px-4 py-3 flex justify-between text-sm bg-gold/5">
              <span className="text-muted-foreground">{selected.size} transaksi dipilih</span>
              <span className="text-gold font-medium">
                Est. saldo G2G: {formatRupiah(estimatedBalance)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right: Withdrawal form */}
      <div className="space-y-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <ArrowDownToLine className="h-4 w-4 text-gold" />
              Detail Withdrawal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-sm">Tanggal Withdrawal</Label>
              <Input type="date" value={withdrawDate} onChange={(e) => setWithdrawDate(e.target.value)}
                className="bg-background border-border text-foreground" />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-muted-foreground text-sm">Nominal Withdrawal (IDR)</Label>
                <button
                  onClick={() => { setUseManual(!useManual); setManualAmount(Math.round(estimatedBalance)) }}
                  className="text-xs text-muted-foreground hover:text-gold"
                >
                  {useManual ? "← Pakai estimasi" : "Edit manual"}
                </button>
              </div>
              <Input
                type="number"
                value={useManual ? (manualAmount || "") : Math.round(estimatedBalance) || ""}
                onChange={(e) => { setUseManual(true); setManualAmount(Number(e.target.value)) }}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                className="bg-background border-border text-foreground"
                readOnly={!useManual}
              />
              {!useManual && selected.size === 0 && (
                <p className="text-xs text-muted-foreground">Pilih transaksi atau edit manual</p>
              )}
            </div>

            {/* Fee breakdown - simulasi perkiraan */}
            {withdrawAmount > 0 && (
              <div className="rounded-lg bg-secondary/40 border border-border p-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Simulasi Perkiraan</span>
                  <span className="text-xs text-muted-foreground/60">±selisih kecil dari G2G</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nominal withdrawal</span>
                  <span className="text-foreground">{formatRupiah(Math.round(withdrawAmount))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    WD fee {feeConfig.withdrawalFeePct}% + Rp {feeConfig.withdrawalFeeFixed.toLocaleString("id-ID")}
                  </span>
                  <span className="text-danger">-{formatRupiah(Math.round(baseFeeTotal))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PPN {feeConfig.vatPct}% dari fee</span>
                  <span className="text-danger">-{formatRupiah(Math.round(vatOnFee))}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 font-medium text-muted-foreground">
                  <span>Estimasi net</span>
                  <span>{formatRupiah(Math.round(netReceived))}</span>
                </div>
              </div>
            )}

            {/* Input net aktual dari email G2G */}
            {withdrawAmount > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-foreground">
                    Net Aktual Diterima (IDR)
                  </Label>
                  {actualNetReceived !== null && (
                    <button
                      onClick={() => setActualNetReceived(null)}
                      className="text-xs text-muted-foreground hover:text-danger"
                    >
                      × Reset ke estimasi
                    </button>
                  )}
                </div>
                <Input
                  type="number"
                  value={actualNetReceived ?? ""}
                  onChange={(e) => setActualNetReceived(e.target.value ? Number(e.target.value) : null)}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  className={`bg-background border-border text-foreground ${actualNetReceived !== null ? "border-success ring-1 ring-success/30" : ""}`}
                  placeholder={`Estimasi: ${formatRupiah(Math.round(netReceived))} — isi dari email G2G`}
                />
                {actualNetReceived !== null && (
                  <div className="flex justify-between text-xs pt-0.5">
                    <span className="text-muted-foreground">Selisih dari estimasi</span>
                    <span className={actualNetReceived - Math.round(netReceived) >= 0 ? "text-success" : "text-danger"}>
                      {actualNetReceived - Math.round(netReceived) >= 0 ? "+" : ""}
                      {formatRupiah(actualNetReceived - Math.round(netReceived))}
                    </span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Yang disimpan: <span className={`font-medium ${actualNetReceived !== null ? "text-success" : "text-muted-foreground"}`}>
                    {formatRupiah(actualNetReceived ?? Math.round(netReceived))}
                  </span>
                  {actualNetReceived === null && " (estimasi)"}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-sm">Catatan (opsional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)}
                className="bg-background border-border text-foreground" placeholder="Catatan tambahan..." />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            {withdrawAmount > 0 && netReceived > 0 && selected.size > 0 && (
              <div className="rounded-lg bg-gold/5 border border-gold/20 p-3 text-xs text-muted-foreground">
                {selected.size} transaksi akan ditandai sudah di-withdraw
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={saving || withdrawAmount <= 0 || (actualNetReceived ?? netReceived) <= 0}
              className="w-full bg-gold hover:bg-gold/90 text-background"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowDownToLine className="h-4 w-4 mr-2" />}
              Catat Withdrawal
            </Button>
          </CardContent>
        </Card>
      </div>
      {showColMenu && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setShowColMenu(false)} />
          <div
            className="fixed z-[9999] bg-card border border-border rounded-lg shadow-lg p-2 min-w-[150px]"
            style={{ top: colMenuPos.top, right: colMenuPos.right }}
            onClick={e => e.stopPropagation()}
          >
            {WD_COLS.map(col => (
              <label key={col.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-background/60 cursor-pointer text-sm">
                <input type="checkbox" checked={visibleCols.has(col.id)}
                  onChange={e => {
                    const next = new Set(visibleCols)
                    if (e.target.checked) next.add(col.id); else next.delete(col.id)
                    setVisibleCols(next)
                  }} className="accent-gold" />
                <span className={visibleCols.has(col.id) ? "text-foreground" : "text-muted-foreground"}>{col.label}</span>
              </label>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

// ─── Tab: Riwayat Withdrawal ──────────────────────────────────────────────────

function RiwayatWithdrawal() {
  const [data, setData] = useState<WithdrawalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editNotes, setEditNotes] = useState("")
  const [editAmount, setEditAmount] = useState(0)
  const [editDate, setEditDate] = useState("")
  const [editFeePct, setEditFeePct] = useState(0)
  const [editFeeFixed, setEditFeeFixed] = useState(0)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setLoadError(null)
    const supabase = createClient()
    const { data, error } = await supabase.from("withdrawals").select("*").order("withdrawal_date", { ascending: false })
    if (error) { setLoadError(error.message); setLoading(false); return }
    setData((data as WithdrawalRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function startEdit(w: WithdrawalRow) {
    setEditId(w.id)
    setEditNotes(w.notes ?? "")
    setEditAmount(w.amount_idr)
    setEditDate(w.withdrawal_date)
    setEditFeePct(w.withdrawal_fee_pct)
    setEditFeeFixed(w.withdrawal_fee_fixed_idr)
  }

  async function saveEdit() {
    if (!editId) return
    setSaving(true)
    const supabase = createClient()
    const feeAmt = editAmount * editFeePct / 100
    await supabase.from("withdrawals").update({
      withdrawal_date: editDate,
      amount_idr: editAmount,
      amount_received_idr: Math.round(editAmount - feeAmt - editFeeFixed),
      notes: editNotes || null,
    }).eq("id", editId)
    setSaving(false); setEditId(null); load()
  }

  async function deleteWithdrawal(id: string) {
    const supabase = createClient()
    await supabase.from("withdrawals").delete().eq("id", id)
    setDeleteId(null); load()
  }

  const totalReceived = data.reduce((s, w) => s + w.amount_received_idr, 0)
  const totalFees = data.reduce((s, w) => s + (w.amount_idr - w.amount_received_idr), 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: "Total Withdrawal", value: data.reduce((s, w) => s + w.amount_idr, 0), color: "text-foreground" },
          { label: "Total Fee", value: totalFees, color: "text-danger" },
          { label: "Total Net Diterima", value: totalReceived, color: "text-success" },
        ].map((c) => (
          <Card key={c.label} className="bg-card border-border">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className={cn("text-xl font-semibold tabular-nums", c.color)}>{loading ? "—" : formatRupiah(c.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Memuat...
            </div>
          ) : loadError ? (
            <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg m-4 px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Error: {loadError}
            </div>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Belum ada riwayat withdrawal.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Tanggal</TableHead>
                  <TableHead className="text-muted-foreground text-right">Nominal</TableHead>
                  <TableHead className="text-muted-foreground text-right">Fee</TableHead>
                  <TableHead className="text-muted-foreground text-right">Net Diterima</TableHead>
                  <TableHead className="text-muted-foreground">Catatan</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((w) => {
                  const feeAmt = w.amount_idr * w.withdrawal_fee_pct / 100 + w.withdrawal_fee_fixed_idr
                  return (
                    <TableRow key={w.id} className="border-border hover:bg-background/50">
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(w.withdrawal_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </TableCell>
                      <TableCell className="text-right text-foreground font-medium tabular-nums">{formatRupiah(w.amount_idr)}</TableCell>
                      <TableCell className="text-right text-danger text-sm tabular-nums">
                        -{formatRupiah(Math.round(feeAmt))}
                      </TableCell>
                      <TableCell className="text-right text-success font-medium tabular-nums">{formatRupiah(w.amount_received_idr)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{w.notes ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <button onClick={() => startEdit(w)}
                            className="rounded p-1 text-muted-foreground hover:text-gold hover:bg-gold/10 transition-colors" title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeleteId(w.id)}
                            className="rounded p-1 text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors" title="Hapus">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editId} onOpenChange={(v) => !v && setEditId(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Edit Withdrawal</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-sm">Tanggal</Label>
              <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="bg-background border-border text-foreground" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-sm">Nominal (IDR)</Label>
              <Input type="number" value={editAmount || ""} onChange={(e) => setEditAmount(Number(e.target.value))}
                onWheel={(e) => (e.target as HTMLInputElement).blur()} className="bg-background border-border text-foreground" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-sm">Catatan</Label>
              <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="bg-background border-border text-foreground" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 border-border" onClick={() => setEditId(null)}>Batal</Button>
              <Button onClick={saveEdit} disabled={saving} className="flex-1 bg-gold hover:bg-gold/90 text-background">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Hapus Withdrawal?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tindakan ini tidak bisa dibatalkan. Transaksi terkait akan dilepas dari withdrawal ini.</p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1 border-border" onClick={() => setDeleteId(null)}>Batal</Button>
            <Button onClick={() => deleteWithdrawal(deleteId!)} className="flex-1 bg-danger hover:bg-danger/90 text-white">Hapus</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WithdrawalPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <RequireAdmin>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 page-content">
          <Header />
          <main className="p-4 md:p-6 lg:p-8">
            <Tabs defaultValue="catat">
              <TabsList className="bg-card border border-border">
                <TabsTrigger value="catat" className="data-[state=active]:bg-gold data-[state=active]:text-background">
                  <ArrowDownToLine className="h-4 w-4 mr-2" /> Catat Withdrawal
                </TabsTrigger>
                <TabsTrigger value="riwayat" className="data-[state=active]:bg-gold data-[state=active]:text-background">
                  Riwayat
                </TabsTrigger>
              </TabsList>

              <TabsContent value="catat" className="mt-6">
                <CatatWithdrawal key={refreshKey} onDone={() => setRefreshKey((k) => k + 1)} />
              </TabsContent>
              <TabsContent value="riwayat" className="mt-6">
                <RiwayatWithdrawal key={refreshKey} />
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>
    </RequireAdmin>
  )
}