"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { createPortal } from "react-dom"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Plus, Search, ArrowUpRight, ArrowDownLeft, CheckCircle, AlertTriangle, Loader2, Pencil, Trash2, LineChart, ChevronDown, ChevronUp, ChevronsUpDown, Clipboard, SlidersHorizontal, Archive } from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { type G2GFeeParams } from "@/lib/calc"
import { useProfile } from "@/lib/hooks/use-profile"
import type { Transaction } from "@/lib/types"

function formatRupiah(num: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(num)
}

const DEFAULT_FEE: G2GFeeParams = {
  commissionPct: 7.99, vatPct: 11, withdrawalFeePct: 2.48, withdrawalFeeFixed: 0,
}

const TX_COLS = [
  { id: "tanggal",    label: "Tanggal",    def: true },
  { id: "keterangan", label: "Keterangan", def: true },
  { id: "channel",    label: "Channel",    def: true },
  { id: "gold",       label: "Gold",       def: true },
  { id: "beli_unit",  label: "Beli/unit",  def: true },
  { id: "modal",      label: "Modal",      def: true },
  { id: "jual_unit",  label: "Jual/unit",  def: true },
  { id: "gross_sell", label: "Gross Sell", def: false },
  { id: "fee",        label: "Fee",        def: true },
  { id: "profit",     label: "Profit",     def: true },
  { id: "status",     label: "Status",     def: true },
] as const
type TxColId = typeof TX_COLS[number]["id"]

function initVisibleCols(): Set<TxColId> {
  if (typeof window === "undefined") return new Set(TX_COLS.filter(c => c.def).map(c => c.id))
  try {
    const saved = localStorage.getItem("transaksi-cols")
    if (saved) return new Set(JSON.parse(saved) as TxColId[])
  } catch {}
  return new Set(TX_COLS.filter(c => c.def).map(c => c.id))
}

// ─── Transaction Form ─────────────────────────────────────────────────────────

function TransactionForm({
  open, onClose, onSaved, fee, editTx,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  fee: G2GFeeParams
  editTx?: Transaction
}) {
  const isEdit = !!editTx
  const [channel, setChannel] = useState<"g2g" | "direct">("g2g")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [goldAmount, setGoldAmount] = useState(0)
  const [buyPrice, setBuyPrice] = useState(0)
  const [sellPrice, setSellPrice] = useState(0)
  const [paymentFeePct, setPaymentFeePct] = useState(0)
  const [notes, setNotes] = useState("")
  const [orderCode, setOrderCode] = useState("")
  const [status, setStatus] = useState<"pending" | "completed" | "cancelled">("pending")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [buyerVatPct, setBuyerVatPct] = useState(0)

  function handleVatChange(val: number) {
    setBuyerVatPct(val)
    if (typeof window !== "undefined") localStorage.setItem("last-buyer-vat", String(val))
  }

  useEffect(() => {
    if (editTx) {
      setChannel(editTx.channel)
      setDate(editTx.transaction_date)
      setGoldAmount(editTx.gold_amount)
      setBuyPrice(editTx.buy_price_idr)
      setSellPrice(editTx.sell_price_idr)
      setPaymentFeePct(editTx.payment_fee_pct ?? 0)
      setNotes(editTx.notes ?? "")
      setOrderCode(editTx.order_code ?? "")
      setStatus(editTx.status)
      setBuyerVatPct(editTx.buyer_vat_pct ?? 0)
    } else {
      const savedVat = typeof window !== "undefined" ? Number(localStorage.getItem("last-buyer-vat") ?? "0") : 0
      setChannel("g2g"); setDate(new Date().toISOString().slice(0, 10))
      setGoldAmount(0); setBuyPrice(0); setSellPrice(0)
      setPaymentFeePct(0); setNotes(""); setOrderCode(""); setStatus("pending"); setBuyerVatPct(savedVat)
    }
  }, [editTx, open])

  const preview = useMemo(() => {
    if (!goldAmount || !buyPrice || !sellPrice) return null
    if (channel === "g2g") {
      // Buyer country VAT applies to commission only, not to WD disbursement
      const effCommFrac = fee.commissionPct * (1 + fee.vatPct / 100 + buyerVatPct / 100) / 100
      const effWdFrac = fee.withdrawalFeePct * (1 + fee.vatPct / 100) / 100
      const netPerUnit = sellPrice * (1 - effCommFrac - effWdFrac)
      const profitTotal = (netPerUnit - buyPrice) * goldAmount
      return { profit: profitTotal, pct: profitTotal / (sellPrice * goldAmount) * 100, effComm: effCommFrac * 100 }
    } else {
      const net = sellPrice * (1 - paymentFeePct / 100)
      const profit = (net - buyPrice) * goldAmount
      return { profit, pct: (profit / (sellPrice * goldAmount)) * 100, effComm: 0 }
    }
  }, [channel, goldAmount, buyPrice, sellPrice, paymentFeePct, fee, buyerVatPct])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!goldAmount || !buyPrice || !sellPrice) { setError("Isi semua field wajib."); return }
    setSaving(true); setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const profitIdr = preview?.profit ?? null
    const payload = {
      transaction_date: date, channel, gold_amount: goldAmount,
      buy_price_idr: buyPrice, sell_price_idr: sellPrice,
      commission_fee_pct: channel === "g2g" ? fee.commissionPct : null,
      payment_fee_pct: channel === "direct" ? paymentFeePct : null,
      buyer_vat_pct: channel === "g2g" ? buyerVatPct : null,
      status, profit_idr: profitIdr, notes: notes || null, order_code: orderCode || null,
    }
    let dbErr
    if (isEdit) {
      const res = await supabase.from("transactions").update(payload).eq("id", editTx!.id)
      dbErr = res.error
    } else {
      const res = await supabase.from("transactions").insert({ ...payload, created_by: user?.id ?? null })
      dbErr = res.error
    }
    if (dbErr) { setError("Gagal: " + dbErr.message); setSaving(false); return }
    setSaving(false); onSaved(); onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">{isEdit ? "Edit Transaksi" : "Transaksi Baru"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            {(["g2g", "direct"] as const).map((c) => (
              <button key={c} type="button" onClick={() => setChannel(c)}
                className={cn("flex-1 rounded-lg px-3 py-2 text-sm font-medium border transition-colors",
                  channel === c ? "bg-gold text-background border-gold" : "bg-background text-muted-foreground border-border"
                )}>
                {c === "g2g" ? "G2G Platform" : "Direct Sale"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-sm">Tanggal</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-background border-border text-foreground" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-sm">Jumlah Gold</Label>
              <Input type="number" value={goldAmount || ""} onChange={(e) => setGoldAmount(Number(e.target.value))} className="bg-background border-border text-foreground" placeholder="0" min={0} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-sm">Harga Beli / Gold (IDR)</Label>
              <Input type="number" value={buyPrice || ""} onChange={(e) => setBuyPrice(Number(e.target.value))} className="bg-background border-border text-foreground" placeholder="0" min={0} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-sm">Harga Jual / Gold (IDR)</Label>
              <Input type="number" value={sellPrice || ""} onChange={(e) => setSellPrice(Number(e.target.value))} className="bg-background border-border text-foreground" placeholder="0" min={0} />
            </div>
            {channel === "direct" && (
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-sm">Fee Payment (%)</Label>
                <Input type="number" value={paymentFeePct || ""} onChange={(e) => setPaymentFeePct(Number(e.target.value))} className="bg-background border-border text-foreground" placeholder="0" min={0} step={0.01} />
              </div>
            )}
            <div className="col-span-2 space-y-1.5">
              <Label className="text-muted-foreground text-sm">Status</Label>
              <div className="flex gap-2">
                {([
                  { value: "pending", label: "Pending", activeClass: "bg-gold text-background border-gold" },
                  { value: "completed", label: "Selesai", activeClass: "bg-success text-background border-success" },
                  { value: "cancelled", label: "Batal", activeClass: "bg-danger text-background border-danger" },
                ] as { value: "pending" | "completed" | "cancelled"; label: string; activeClass: string }[]).map((s) => {
                  const disabled = s.value === "completed" && channel === "g2g"
                  return (
                    <button key={s.value} type="button"
                      disabled={disabled}
                      onClick={() => !disabled && setStatus(s.value)}
                      className={cn(
                        "flex-1 rounded-lg px-3 py-2 text-sm font-medium border transition-colors",
                        status === s.value ? s.activeClass : "bg-background text-muted-foreground border-border",
                        disabled && "opacity-30 cursor-not-allowed"
                      )}>
                      {s.label}
                    </button>
                  )
                })}
              </div>
              {channel === "g2g" && (
                <p className="text-xs text-muted-foreground">
                  Status Selesai untuk G2G hanya bisa diatur melalui{" "}
                  <a href="/withdrawal" className="text-gold hover:underline">Withdrawal</a>
                </p>
              )}
            </div>
            {channel === "g2g" && (
              <div className="col-span-2 space-y-1.5">
                <Label className="text-muted-foreground text-sm">VAT Negara Buyer</Label>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {[
                    { label: "🇮🇩 0% ID/Other", value: 0 },
                    { label: "🇰🇷🇦🇺 +10% KR/AU", value: 10 },
                    { label: "🇬🇧🇪🇺 +20% UK/EU", value: 20 },
                    { label: "🇳🇴🇸🇪 +25% NO/SE", value: 25 },
                  ].map(p => (
                    <button key={p.value} type="button" onClick={() => handleVatChange(p.value)}
                      className={cn("px-2.5 py-1 rounded-md text-xs border transition-colors",
                        buyerVatPct === p.value
                          ? "bg-gold text-background border-gold"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                      )}>
                      {p.label}
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-xs text-muted-foreground">Custom:</span>
                    <Input type="number" value={buyerVatPct || ""}
                      onChange={(e) => handleVatChange(Number(e.target.value))}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      className="w-16 h-7 text-xs bg-background border-border text-foreground px-2"
                      min={0} max={50} step={1} placeholder="%" />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Lihat flag negara buyer di G2G — dikenakan atas komisi saja</p>
              </div>
            )}
            <div className="col-span-2 space-y-1.5">
              <Label className="text-muted-foreground text-sm">Kode Order</Label>
              <div className="flex gap-2">
                <Input value={orderCode} onChange={(e) => setOrderCode(e.target.value)}
                  className="bg-background border-border text-foreground font-mono text-sm"
                  placeholder="Paste kode order dari G2G..." />
                <button type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText()
                      setOrderCode(text.trim())
                    } catch {}
                  }}
                  className="shrink-0 rounded-lg border border-border px-3 text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-background/50 transition-colors"
                  title="Paste dari clipboard">
                  <Clipboard className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Kode order dari G2G — beberapa transaksi bisa share kode yang sama</p>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-muted-foreground text-sm">Catatan</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-background border-border text-foreground" placeholder="Nama buyer, game, dll." />
            </div>
          </div>

          {preview && (
            <div className="space-y-1.5">
              <div className={cn("rounded-lg p-3 border flex items-center gap-3",
                preview.profit >= 0 ? "bg-success/10 border-success/30" : "bg-danger/10 border-danger/30"
              )}>
                {preview.profit >= 0 ? <CheckCircle className="h-4 w-4 text-success shrink-0" /> : <AlertTriangle className="h-4 w-4 text-danger shrink-0" />}
                <div>
                  <p className={cn("text-xs font-medium", preview.profit >= 0 ? "text-success" : "text-danger")}>Estimasi profit</p>
                  <p className={cn("font-bold", preview.profit >= 0 ? "text-success" : "text-danger")}>
                    {formatRupiah(preview.profit)} <span className="text-sm font-normal">({preview.pct.toFixed(2)}%)</span>
                  </p>
                </div>
              </div>
              {channel === "g2g" && preview && (
                <p className="text-xs text-muted-foreground px-1">
                  Komisi efektif {preview.effComm.toFixed(4)}%
                  {buyerVatPct > 0 ? ` (incl. buyer VAT +${buyerVatPct}%)` : ""} + WD fee sudah diperhitungkan
                </p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1 border-border" onClick={onClose}>Batal</Button>
            <Button type="submit" className="flex-1 bg-gold hover:bg-gold/90 text-background" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? "Simpan Perubahan" : "Simpan Transaksi"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ id, onDone }: { id: string; onDone: () => void }) {
  const [open, setOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  async function confirm() {
    setLoading(true)
    const supabase = createClient()
    await supabase.from("transactions").delete().eq("id", id)
    setLoading(false); setOpen(false); onDone()
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onDone()}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader><DialogTitle className="text-foreground">Hapus Transaksi?</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Tindakan ini tidak bisa dibatalkan.</p>
        <div className="flex gap-2 mt-2">
          <Button variant="outline" className="flex-1 border-border" onClick={onDone}>Batal</Button>
          <Button onClick={confirm} disabled={loading} className="flex-1 bg-danger hover:bg-danger/90 text-white">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Hapus"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TransaksiPage() {
  const { isAdmin } = useProfile()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTx, setEditTx] = useState<Transaction | undefined>()
  const [deleteTxId, setDeleteTxId] = useState<string | null>(null)
  const [filterChannel, setFilterChannel] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [search, setSearch] = useState("")
  const [fee, setFee] = useState<G2GFeeParams>(DEFAULT_FEE)
  const [showChart, setShowChart] = useState(false)
  const [sortCol, setSortCol] = useState<string>("transaction_date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [showArchive, setShowArchive] = useState(false)
  const [visibleCols, setVisibleColsRaw] = useState<Set<TxColId>>(initVisibleCols)
  const [showColMenu, setShowColMenu] = useState(false)
  const [colMenuPos, setColMenuPos] = useState({ top: 0, right: 0 })
  const colMenuRef = useRef<HTMLDivElement>(null)

  function setVisibleCols(next: Set<TxColId>) {
    setVisibleColsRaw(next)
    if (typeof window !== "undefined") localStorage.setItem("transaksi-cols", JSON.stringify([...next]))
  }
  const vis = (id: TxColId) => visibleCols.has(id)

  function openColMenu() {
    if (colMenuRef.current) {
      const rect = colMenuRef.current.getBoundingClientRect()
      setColMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setShowColMenu(true)
  }

  async function fetchData() {
    const supabase = createClient()
    let txQuery = supabase.from("transactions").select("*").order("transaction_date", { ascending: false }).order("created_at", { ascending: false })
    if (!showArchive) txQuery = txQuery.is("archived_period_id", null)
    const [{ data: txData }, { data: feeData }] = await Promise.all([
      txQuery,
      supabase.from("fee_config").select("*").eq("is_active", true).single(),
    ])
    if (txData) setTransactions(txData as Transaction[])
    if (feeData) setFee({ commissionPct: feeData.commission_pct, vatPct: feeData.vat_pct, withdrawalFeePct: feeData.withdrawal_fee_pct, withdrawalFeeFixed: feeData.withdrawal_fee_fixed })
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [showArchive])

  const filtered = useMemo(() => transactions.filter((tx) => {
    if (filterChannel !== "all" && tx.channel !== filterChannel) return false
    if (filterStatus !== "all" && tx.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      const match = tx.notes?.toLowerCase().includes(q) || tx.game_name.toLowerCase().includes(q) || tx.order_code?.toLowerCase().includes(q)
      if (!match) return false
    }
    return true
  }), [transactions, filterChannel, filterStatus, search])

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortCol(col); setSortDir("desc") }
  }

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal: number | string = 0
      let bVal: number | string = 0
      const modal = (tx: typeof a) => tx.buy_price_idr * tx.gold_amount
      const grossSell = (tx: typeof a) => tx.sell_price_idr * tx.gold_amount
      switch (sortCol) {
        case "transaction_date": aVal = a.transaction_date; bVal = b.transaction_date; break
        case "channel": aVal = a.channel; bVal = b.channel; break
        case "gold_amount": aVal = a.gold_amount; bVal = b.gold_amount; break
        case "buy_price_idr": aVal = a.buy_price_idr; bVal = b.buy_price_idr; break
        case "modal": aVal = modal(a); bVal = modal(b); break
        case "sell_price_idr": aVal = a.sell_price_idr; bVal = b.sell_price_idr; break
        case "gross_sell": aVal = grossSell(a); bVal = grossSell(b); break
        case "profit_idr": aVal = a.profit_idr ?? -Infinity; bVal = b.profit_idr ?? -Infinity; break
        case "status": aVal = a.status; bVal = b.status; break
        default: aVal = a.transaction_date; bVal = b.transaction_date
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1
      return 0
    })
  }, [filtered, sortCol, sortDir])

  // Warna untuk pengelompokan order_code yang sama
  const ORDER_COLORS = [
    "#f59e0b", // amber
    "#3b82f6", // blue
    "#8b5cf6", // violet
    "#22c55e", // green
    "#f43f5e", // rose
    "#06b6d4", // cyan
    "#f97316", // orange
    "#ec4899", // pink
  ]
  function hashColor(str: string): string {
    let h = 0
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff
    return ORDER_COLORS[h % ORDER_COLORS.length]
  }
  const orderCodeColorMap = useMemo(() => {
    const count: Record<string, number> = {}
    for (const tx of sorted) if (tx.order_code) count[tx.order_code] = (count[tx.order_code] ?? 0) + 1
    const map: Record<string, string> = {}
    for (const [code, n] of Object.entries(count)) if (n >= 2) map[code] = hashColor(code)
    return map
  }, [sorted])

  const chartData = useMemo(() => {
    const byDate: Record<string, { g2g: number; direct: number }> = {}
    for (const tx of filtered) {
      if (tx.status !== "completed" || tx.profit_idr == null) continue
      if (!byDate[tx.transaction_date]) byDate[tx.transaction_date] = { g2g: 0, direct: 0 }
      if (tx.channel === "g2g") byDate[tx.transaction_date].g2g += tx.profit_idr
      else byDate[tx.transaction_date].direct += tx.profit_idr
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        label: new Date(date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
        g2g: v.g2g,
        direct: v.direct,
      }))
  }, [filtered])

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 page-content">
        <Header />
        <main className="p-4 md:p-6 lg:p-8">
          <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
              <button
                onClick={() => setShowArchive((v) => !v)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  showArchive
                    ? "bg-muted/30 border-muted-foreground/40 text-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                )}
              >
                <Archive className="h-4 w-4" />
                {showArchive ? "Sembunyikan Arsip" : "Tampilkan Arsip"}
              </button>
              {/* Column visibility dropdown */}
              <div ref={colMenuRef}>
                <button
                  onClick={() => showColMenu ? setShowColMenu(false) : openColMenu()}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    showColMenu
                      ? "bg-gold/10 border-gold/40 text-gold"
                      : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  )}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Kolom
                </button>
              </div>
              <button
                onClick={() => setShowChart((v) => !v)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  showChart
                    ? "bg-gold/10 border-gold/40 text-gold"
                    : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                )}
              >
                <LineChart className="h-4 w-4" />
                Grafik
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showChart && "rotate-180")} />
              </button>
              {isAdmin && (
                <Button onClick={() => { setEditTx(undefined); setShowForm(true) }} className="bg-gold hover:bg-gold/90 text-background">
                  <Plus className="h-4 w-4 mr-2" /> Transaksi Baru
                </Button>
              )}
          </div>

          <Card className="bg-card border-border mb-4">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari catatan..." className="pl-9 bg-background border-border text-foreground" />
                </div>
                <Select value={filterChannel} onValueChange={(v) => v && setFilterChannel(v)}>
                  <SelectTrigger className="w-full sm:w-36 bg-background border-border text-foreground"><SelectValue placeholder="Channel" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">Semua Channel</SelectItem>
                    <SelectItem value="g2g">G2G</SelectItem>
                    <SelectItem value="direct">Direct</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={(v) => v && setFilterStatus(v)}>
                  <SelectTrigger className="w-full sm:w-36 bg-background border-border text-foreground"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Collapsible Chart */}
          {showChart && (
            <Card className="bg-card border-border mb-4">
              <CardContent className="pt-4 pb-4">
                {chartData.length === 0 ? (
                  <div className="flex items-center justify-center h-[180px] text-sm text-muted-foreground">
                    Belum ada data completed di filter ini
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="txG2gGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.03} />
                          </linearGradient>
                          <linearGradient id="txDirectGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.03} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          interval={Math.max(0, Math.floor(chartData.length / 8) - 1)}
                        />
                        <YAxis
                          tickFormatter={(v) => {
                            const a = Math.abs(v)
                            if (a >= 1_000_000) return `${(a / 1_000_000).toFixed(1)}jt`
                            if (a >= 1_000) return `${(a / 1_000).toFixed(0)}rb`
                            return String(a)
                          }}
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
                            return (
                              <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg space-y-1">
                                <p className="text-muted-foreground font-medium">{label}</p>
                                {g2g > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: "#ef4444" }} />
                                    <span className="text-muted-foreground">G2G</span>
                                    <span className="font-semibold ml-auto tabular-nums" style={{ color: "#ef4444" }}>
                                      {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(g2g)}
                                    </span>
                                  </div>
                                )}
                                {direct > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: "#3b82f6" }} />
                                    <span className="text-muted-foreground">Direct</span>
                                    <span className="font-semibold ml-auto tabular-nums" style={{ color: "#3b82f6" }}>
                                      {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(direct)}
                                    </span>
                                  </div>
                                )}
                                {g2g > 0 && direct > 0 && (
                                  <div className="flex justify-between border-t border-border pt-1">
                                    <span className="text-muted-foreground">Total</span>
                                    <span className="font-bold text-foreground tabular-nums">
                                      {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(g2g + direct)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )
                          }}
                        />
                        <Area type="monotone" dataKey="g2g" stackId="a" stroke="#ef4444" strokeWidth={2} fill="url(#txG2gGrad)" dot={false} activeDot={{ r: 4, fill: "#ef4444", strokeWidth: 0 }} />
                        <Area type="monotone" dataKey="direct" stackId="a" stroke="#3b82f6" strokeWidth={2} fill="url(#txDirectGrad)" dot={false} activeDot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                    <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#ef4444" }} /> G2G
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#3b82f6" }} /> Direct
                      </div>
                      <span className="text-xs text-muted-foreground ml-auto">Hanya transaksi completed</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="bg-card border-border overflow-hidden">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat data...
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <p className="text-sm">Belum ada transaksi.</p>
                  {isAdmin && <button onClick={() => setShowForm(true)} className="text-gold text-sm mt-1 hover:underline">+ Tambah transaksi pertama</button>}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground w-10">#</TableHead>
                      {([
                        { key: "transaction_date", colId: "tanggal",    label: "Tanggal",    align: "left" },
                        { key: null,               colId: "keterangan", label: "Keterangan", align: "left" },
                        { key: "channel",          colId: "channel",    label: "Channel",    align: "left" },
                        { key: "gold_amount",      colId: "gold",       label: "Gold",       align: "right" },
                        { key: "buy_price_idr",    colId: "beli_unit",  label: "Beli/unit",  align: "right" },
                        { key: "modal",            colId: "modal",      label: "Modal",      align: "right" },
                        { key: "sell_price_idr",   colId: "jual_unit",  label: "Jual/unit",  align: "right" },
                        { key: "gross_sell",       colId: "gross_sell", label: "Gross Sell", align: "right" },
                        { key: null,               colId: "fee",        label: "Fee",        align: "right" },
                        { key: "profit_idr",       colId: "profit",     label: "Profit",     align: "right" },
                        { key: "status",           colId: "status",     label: "Status",     align: "left" },
                      ] as { key: string | null; colId: TxColId; label: string; align: string }[])
                        .filter(({ colId }) => vis(colId))
                        .map(({ key, label, align }) => (
                        <TableHead key={label}
                          className={cn("text-muted-foreground", align === "right" && "text-right", key && "cursor-pointer select-none hover:text-foreground transition-colors")}
                          onClick={key ? () => toggleSort(key) : undefined}
                        >
                          <span className="inline-flex items-center gap-1">
                            {align === "right" && key && (
                              sortCol === key
                                ? sortDir === "asc" ? <ChevronUp className="h-3 w-3 text-gold" /> : <ChevronDown className="h-3 w-3 text-gold" />
                                : <ChevronsUpDown className="h-3 w-3 opacity-30" />
                            )}
                            <span className={sortCol === key ? "text-gold" : ""}>{label}</span>
                            {align !== "right" && key && (
                              sortCol === key
                                ? sortDir === "asc" ? <ChevronUp className="h-3 w-3 text-gold" /> : <ChevronDown className="h-3 w-3 text-gold" />
                                : <ChevronsUpDown className="h-3 w-3 opacity-30" />
                            )}
                          </span>
                        </TableHead>
                      ))}
                      {isAdmin && <TableHead className="text-muted-foreground w-16"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((tx, idx) => {
                      const modal = tx.buy_price_idr * tx.gold_amount
                      const grossSell = tx.sell_price_idr * tx.gold_amount
                      const txBuyerVat = tx.buyer_vat_pct ?? 0
                      const txEffCommPct = fee.commissionPct * (1 + fee.vatPct / 100 + txBuyerVat / 100)
                      const txEffWdPct = fee.withdrawalFeePct * (1 + fee.vatPct / 100)
                      const feeAmt = tx.channel === "g2g"
                        ? grossSell * (txEffCommPct + txEffWdPct) / 100
                        : tx.payment_fee_pct ? grossSell * tx.payment_fee_pct / 100 : 0
                      const feeLabel = tx.channel === "g2g"
                        ? `${txEffCommPct.toFixed(2)}%+${txEffWdPct.toFixed(2)}%${txBuyerVat > 0 ? ` (+${txBuyerVat}%VAT)` : ""}`
                        : tx.payment_fee_pct ? `${tx.payment_fee_pct}%` : "—"
                      return (
                        <TableRow key={tx.id} className={cn("border-border hover:bg-background/50", tx.archived_period_id && "opacity-60")}>
                          <TableCell className="text-muted-foreground text-sm w-10">{idx + 1}</TableCell>
                          {vis("tanggal") && (
                            <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                              {new Date(tx.transaction_date).toLocaleDateString("id-ID")}
                              {tx.archived_period_id && (
                                <div className="text-xs text-muted-foreground/60 mt-0.5 flex items-center gap-1">
                                  <Archive className="h-2.5 w-2.5" /> Arsip
                                </div>
                              )}
                            </TableCell>
                          )}
                          {vis("keterangan") && (
                            <TableCell className="text-sm max-w-[180px]">
                              {tx.order_code && (
                                <div className="flex items-center gap-1.5" title={tx.order_code}>
                                  {orderCodeColorMap[tx.order_code] && (
                                    <span
                                      className="shrink-0 w-2 h-2 rounded-full"
                                      style={{ backgroundColor: orderCodeColorMap[tx.order_code] }}
                                    />
                                  )}
                                  <span className="text-xs text-gold/80 font-mono truncate">
                                    {tx.order_code}
                                  </span>
                                </div>
                              )}
                              {tx.notes && (
                                <div className="text-xs text-muted-foreground truncate" title={tx.notes}>
                                  {tx.notes}
                                </div>
                              )}
                              {!tx.order_code && !tx.notes && <span className="text-muted-foreground/40">—</span>}
                            </TableCell>
                          )}
                          {vis("channel") && (
                            <TableCell>
                              <Badge variant="outline" className={tx.channel === "g2g" ? "border-red-500/50 text-white bg-red-500/20" : "border-blue-500/50 text-white bg-blue-500/20"}>
                                {tx.channel === "g2g" ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownLeft className="h-3 w-3 mr-1" />}
                                {tx.channel.toUpperCase()}
                              </Badge>
                            </TableCell>
                          )}
                          {vis("gold") && (
                            <TableCell className="text-right text-foreground font-medium tabular-nums">
                              {tx.gold_amount.toLocaleString("id-ID")}
                            </TableCell>
                          )}
                          {vis("beli_unit") && (
                            <TableCell className="text-right text-muted-foreground text-sm tabular-nums">
                              {formatRupiah(tx.buy_price_idr)}
                            </TableCell>
                          )}
                          {vis("modal") && (
                            <TableCell className="text-right text-foreground text-sm tabular-nums font-medium">
                              {formatRupiah(modal)}
                            </TableCell>
                          )}
                          {vis("jual_unit") && (
                            <TableCell className="text-right text-muted-foreground text-sm tabular-nums">
                              {formatRupiah(tx.sell_price_idr)}
                            </TableCell>
                          )}
                          {vis("gross_sell") && (
                            <TableCell className="text-right text-foreground text-sm tabular-nums">
                              {formatRupiah(grossSell)}
                            </TableCell>
                          )}
                          {vis("fee") && (
                            <TableCell className="text-right text-xs text-danger tabular-nums">
                              {feeAmt > 0 ? `-${formatRupiah(Math.round(feeAmt))}` : feeLabel}
                            </TableCell>
                          )}
                          {vis("profit") && (
                            <TableCell className="text-right font-medium tabular-nums">
                              <span className={tx.profit_idr != null && tx.profit_idr >= 0 ? "text-success" : "text-danger"}>
                                {tx.profit_idr != null ? formatRupiah(tx.profit_idr) : "—"}
                              </span>
                            </TableCell>
                          )}
                          {vis("status") && (
                            <TableCell>
                              <Badge variant="outline" className={
                                tx.status === "completed" ? "border-success/50 text-success bg-success/10" :
                                tx.status === "pending" ? "border-gold/50 text-gold bg-gold/10" :
                                "border-danger/50 text-danger bg-danger/10"
                              }>
                                {tx.status === "completed" ? "Selesai" : tx.status === "pending" ? "Pending" : "Batal"}
                              </Badge>
                            </TableCell>
                          )}
                          {isAdmin && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => { setEditTx(tx); setShowForm(true) }}
                                className="rounded p-1 text-muted-foreground hover:text-gold hover:bg-gold/10 transition-colors"
                                title="Edit"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteTxId(tx.id)}
                                className="rounded p-1 text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                                title="Hapus"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </TableCell>
                          )}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {isAdmin && (
        <TransactionForm
          open={showForm}
          onClose={() => { setShowForm(false); setEditTx(undefined) }}
          onSaved={fetchData}
          fee={fee}
          editTx={editTx}
        />
      )}

      {isAdmin && deleteTxId && (
        <DeleteConfirm
          id={deleteTxId}
          onDone={() => { setDeleteTxId(null); fetchData() }}
        />
      )}

      {showColMenu && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setShowColMenu(false)} />
          <div
            className="fixed z-[9999] bg-card border border-border rounded-lg shadow-lg p-2 min-w-[160px]"
            style={{ top: colMenuPos.top, right: colMenuPos.right }}
            onClick={(e) => e.stopPropagation()}
          >
            {TX_COLS.map((col) => (
              <label key={col.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-background/60 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={visibleCols.has(col.id)}
                  onChange={(e) => {
                    const next = new Set(visibleCols)
                    if (e.target.checked) next.add(col.id)
                    else next.delete(col.id)
                    setVisibleCols(next)
                  }}
                  className="accent-gold"
                />
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