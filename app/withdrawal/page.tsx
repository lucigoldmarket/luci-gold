"use client"

import { useState, useEffect, useMemo } from "react"
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
import { CheckCircle, Loader2, AlertTriangle, ArrowDownToLine, Receipt, Pencil, Trash2 } from "lucide-react"
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
  withdrawal_id?: string | null
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

interface ExpenseRow {
  id: string
  expense_date: string
  category: string
  description: string
  amount_idr: number
  expense_type: string
  created_at: string
}

interface FeeConfig {
  commissionPct: number
  vatPct: number
  withdrawalFeePct: number
}

const DEFAULT_FEE: FeeConfig = { commissionPct: 7.99, vatPct: 11, withdrawalFeePct: 2.48 }

// ─── Tab: Catat Withdrawal ────────────────────────────────────────────────────

function CatatWithdrawal({ onDone }: { onDone: () => void }) {
  const [transactions, setTransactions] = useState<TxRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [withdrawDate, setWithdrawDate] = useState(new Date().toISOString().slice(0, 10))
  const [manualAmount, setManualAmount] = useState(0)
  const [useManual, setUseManual] = useState(false)
  const [notes, setNotes] = useState("")
  const [feeConfig, setFeeConfig] = useState<FeeConfig>(DEFAULT_FEE)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const [txResult, feeResult] = await Promise.all([
        supabase.from("transactions")
          .select("id, transaction_date, gold_amount, sell_price_idr, buy_price_idr, profit_idr, notes, withdrawal_id, status")
          .eq("channel", "g2g")
          .in("status", ["pending", "completed"])
          .is("withdrawal_id", null)
          .order("transaction_date", { ascending: false }),
        supabase.from("fee_config")
          .select("commission_pct, vat_pct, withdrawal_fee_pct")
          .eq("is_active", true)
          .single(),
      ])

      if (txResult.error) {
        const { data: fallback } = await supabase
          .from("transactions")
          .select("id, transaction_date, gold_amount, sell_price_idr, buy_price_idr, profit_idr, notes, status")
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
          withdrawalFeePct: fc.withdrawal_fee_pct ?? 2.48,
        })
      }

      setLoading(false)
    }
    load()
  }, [])

  // Effective rates (VAT applies to both commission and disbursement fee)
  const vatMult = 1 + feeConfig.vatPct / 100
  const effectiveCommFrac = feeConfig.commissionPct * vatMult / 100
  const effectiveWdPctNum = feeConfig.withdrawalFeePct * vatMult  // e.g. 2.7528 (%)
  const effectiveWdFrac = effectiveWdPctNum / 100

  const selectedTxs = transactions.filter((t) => selected.has(t.id))

  const estimatedBalance = useMemo(() =>
    selectedTxs.reduce((s, t) => s + t.sell_price_idr * t.gold_amount * (1 - effectiveCommFrac), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedTxs, effectiveCommFrac]
  )

  const withdrawAmount = useManual ? manualAmount : estimatedBalance
  const totalFee = withdrawAmount * effectiveWdFrac
  const netReceived = withdrawAmount - totalFee

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
    const { data: wd, error: wdErr } = await supabase.from("withdrawals").insert({
      withdrawal_date: withdrawDate,
      amount_idr: Math.round(withdrawAmount),
      withdrawal_fee_pct: effectiveWdPctNum,  // store effective % (e.g. 2.7528)
      withdrawal_fee_fixed_idr: 0,
      amount_received_idr: Math.round(netReceived),
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
    onDone()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Left: Transaction checklist */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-foreground flex items-center justify-between">
            <span>Transaksi G2G Belum di-Withdraw</span>
            {transactions.length > 0 && (
              <button onClick={toggleAll} className="text-xs text-gold hover:underline font-normal">
                {selected.size === transactions.length ? "Hapus semua" : "Pilih semua"}
              </button>
            )}
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
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="text-muted-foreground">Tanggal</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground text-right">Gold</TableHead>
                  <TableHead className="text-muted-foreground text-right">Harga Jual</TableHead>
                  <TableHead className="text-muted-foreground text-right">Total Sell</TableHead>
                  <TableHead className="text-muted-foreground text-right">Profit</TableHead>
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
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(tx.transaction_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("border-0 text-xs",
                          (tx as any).status === "completed" ? "bg-success/10 text-success" : "bg-gold/10 text-gold"
                        )}>
                          {(tx as any).status === "completed" ? "Selesai" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-foreground text-sm">
                        {tx.gold_amount.toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {formatRupiah(tx.sell_price_idr)}
                      </TableCell>
                      <TableCell className="text-right text-foreground text-sm font-medium">
                        {formatRupiah(totalSell)}
                      </TableCell>
                      <TableCell className={cn("text-right text-sm font-medium",
                        tx.profit_idr && tx.profit_idr > 0 ? "text-success" : "text-danger"
                      )}>
                        {tx.profit_idr != null ? formatRupiah(tx.profit_idr) : "—"}
                      </TableCell>
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

            {/* Fee breakdown */}
            {withdrawAmount > 0 && (
              <div className="rounded-lg bg-secondary/40 border border-border p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nominal withdrawal</span>
                  <span className="text-foreground">{formatRupiah(Math.round(withdrawAmount))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    WD fee {feeConfig.withdrawalFeePct}% × PPN {feeConfig.vatPct}% = {effectiveWdPctNum.toFixed(4)}%
                  </span>
                  <span className="text-danger">-{formatRupiah(Math.round(totalFee))}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 font-medium">
                  <span className="text-foreground">Net diterima</span>
                  <span className={netReceived > 0 ? "text-success" : "text-danger"}>
                    {formatRupiah(Math.round(netReceived))}
                  </span>
                </div>
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
              disabled={saving || withdrawAmount <= 0 || netReceived <= 0}
              className="w-full bg-gold hover:bg-gold/90 text-background"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowDownToLine className="h-4 w-4 mr-2" />}
              Catat Withdrawal
            </Button>
          </CardContent>
        </Card>
      </div>
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

// ─── Tab: Log Pengeluaran ─────────────────────────────────────────────────────

function LogPengeluaran() {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from("operational_expenses")
        .select("*").order("expense_date", { ascending: false })
      setExpenses((data as ExpenseRow[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const total = expenses.reduce((s, e) => s + e.amount_idr, 0)
  const byCategory: Record<string, number> = {}
  for (const e of expenses) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount_idr

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Total pengeluaran tercatat</p>
          <p className="text-xl font-semibold text-foreground tabular-nums">{formatRupiah(total)}</p>
        </div>
      </div>

      {Object.keys(byCategory).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(byCategory).map(([cat, amt]) => (
            <Badge key={cat} variant="outline" className="border-border text-muted-foreground text-xs">
              {cat}: {formatRupiah(amt)}
            </Badge>
          ))}
        </div>
      )}

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Memuat...
            </div>
          ) : expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Belum ada log pengeluaran.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Tanggal</TableHead>
                  <TableHead className="text-muted-foreground">Kategori</TableHead>
                  <TableHead className="text-muted-foreground">Deskripsi</TableHead>
                  <TableHead className="text-muted-foreground">Tipe</TableHead>
                  <TableHead className="text-muted-foreground text-right">Nominal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id} className="border-border hover:bg-background/50">
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {new Date(e.expense_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "border-0 text-xs",
                        e.category === "Withdrawal Fee G2G" ? "bg-gold/10 text-gold" :
                        e.category === "Pokok Bulanan" ? "bg-danger/10 text-danger" :
                        "bg-secondary text-muted-foreground"
                      )}>
                        {e.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-foreground text-sm">{e.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "border-0 text-xs",
                        e.expense_type === "rutin" ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground"
                      )}>
                        {e.expense_type === "rutin" ? "Rutin" : "Non-Rutin"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-danger font-medium">
                      -{formatRupiah(e.amount_idr)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
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
            <div className="mb-6">
              <h1 className="font-heading text-3xl font-bold text-foreground mb-1">Withdrawal & Pengeluaran</h1>
              <p className="text-muted-foreground text-sm">
                Catat penarikan dari G2G · Fee disbursement 2.48% + PPN 11%
              </p>
            </div>

            <Tabs defaultValue="catat">
              <TabsList className="bg-card border border-border">
                <TabsTrigger value="catat" className="data-[state=active]:bg-gold data-[state=active]:text-background">
                  <ArrowDownToLine className="h-4 w-4 mr-2" /> Catat Withdrawal
                </TabsTrigger>
                <TabsTrigger value="riwayat" className="data-[state=active]:bg-gold data-[state=active]:text-background">
                  Riwayat
                </TabsTrigger>
                <TabsTrigger value="pengeluaran" className="data-[state=active]:bg-gold data-[state=active]:text-background">
                  <Receipt className="h-4 w-4 mr-2" /> Log Pengeluaran
                </TabsTrigger>
              </TabsList>

              <TabsContent value="catat" className="mt-6">
                <CatatWithdrawal key={refreshKey} onDone={() => setRefreshKey((k) => k + 1)} />
              </TabsContent>
              <TabsContent value="riwayat" className="mt-6">
                <RiwayatWithdrawal key={refreshKey} />
              </TabsContent>
              <TabsContent value="pengeluaran" className="mt-6">
                <LogPengeluaran key={refreshKey} />
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>
    </RequireAdmin>
  )
}
