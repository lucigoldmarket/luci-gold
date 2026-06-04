"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Plus, Loader2, Pencil, Trash2, TrendingUp } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { RequireAdmin } from "@/components/require-admin"

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

interface Deposit { id: string; deposit_date: string; investor_name: string; amount_idr: number; notes: string | null; created_at: string }

function DepositForm({ open, onClose, onSaved, edit }: { open: boolean; onClose: () => void; onSaved: () => void; edit?: Deposit }) {
  const isEdit = !!edit
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [name, setName] = useState("")
  const [amount, setAmount] = useState(0)
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (edit) { setDate(edit.deposit_date); setName(edit.investor_name); setAmount(edit.amount_idr); setNotes(edit.notes ?? "") }
    else { setDate(new Date().toISOString().slice(0, 10)); setName(""); setAmount(0); setNotes("") }
  }, [edit, open])

  async function save() {
    if (!name || amount <= 0) return
    setSaving(true)
    const supabase = createClient()
    if (isEdit) await supabase.from("deposits").update({ deposit_date: date, investor_name: name, amount_idr: amount, notes: notes || null }).eq("id", edit!.id)
    else await supabase.from("deposits").insert({ deposit_date: date, investor_name: name, amount_idr: amount, notes: notes || null })
    setSaving(false); onSaved(); onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader><DialogTitle className="text-foreground">{isEdit ? "Edit Deposit" : "Catat Deposit"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-sm">Tanggal</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-background border-border text-foreground" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-sm">Nominal (IDR)</Label>
              <Input type="number" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))}
                onWheel={(e) => (e.target as HTMLInputElement).blur()} className="bg-background border-border text-foreground" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-muted-foreground text-sm">Nama Investor / Sumber</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-background border-border text-foreground" placeholder="Nama investor atau sumber modal" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-muted-foreground text-sm">Catatan (opsional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-background border-border text-foreground" placeholder="Keterangan..." />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 border-border" onClick={onClose}>Batal</Button>
            <Button onClick={save} disabled={saving || !name || amount <= 0} className="flex-1 bg-gold hover:bg-gold/90 text-background">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? "Simpan" : "Catat Deposit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function DepositPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Deposit | undefined>()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from("deposits").select("*").order("deposit_date", { ascending: false })
    setDeposits((data as Deposit[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function del(id: string) {
    await createClient().from("deposits").delete().eq("id", id)
    setDeleteId(null); load()
  }

  const total = deposits.reduce((s, d) => s + d.amount_idr, 0)
  const byInvestor: Record<string, number> = {}
  for (const d of deposits) byInvestor[d.investor_name] = (byInvestor[d.investor_name] ?? 0) + d.amount_idr

  return (
    <RequireAdmin>
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 page-content">
        <Header />
        <main className="p-4 md:p-6 lg:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="font-heading text-3xl font-bold text-foreground mb-1">Deposit</h1>
              <p className="text-muted-foreground text-sm">Tracking modal masuk dari investor · Membentuk saldo awal</p>
            </div>
            <Button onClick={() => { setEditItem(undefined); setShowForm(true) }} className="bg-gold hover:bg-gold/90 text-background">
              <Plus className="h-4 w-4 mr-2" /> Catat Deposit
            </Button>
          </div>

          {/* Total + per investor */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
            <Card className="bg-card border-border md:col-span-1">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-gold/10 p-3"><TrendingUp className="h-5 w-5 text-gold" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Deposit Masuk</p>
                    <p className="text-2xl font-bold text-gold tabular-nums">{loading ? "—" : fmt(total)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            {Object.entries(byInvestor).map(([name, amt]) => (
              <Card key={name} className="bg-card border-border">
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground truncate">{name}</p>
                  <p className="text-lg font-semibold text-foreground tabular-nums">{fmt(amt)}</p>
                  <p className="text-xs text-muted-foreground">{((amt / total) * 100).toFixed(1)}% dari total</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-card border-border">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat...
                </div>
              ) : deposits.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Belum ada deposit. Catat deposit pertama.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Tanggal</TableHead>
                      <TableHead className="text-muted-foreground">Investor / Sumber</TableHead>
                      <TableHead className="text-muted-foreground text-right">Nominal</TableHead>
                      <TableHead className="text-muted-foreground">Catatan</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deposits.map((d) => (
                      <TableRow key={d.id} className="border-border hover:bg-background/50">
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {new Date(d.deposit_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </TableCell>
                        <TableCell className="text-foreground font-medium">{d.investor_name}</TableCell>
                        <TableCell className="text-right text-success font-semibold tabular-nums">+{fmt(d.amount_idr)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{d.notes ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setEditItem(d); setShowForm(true) }} className="rounded p-1 text-muted-foreground hover:text-gold hover:bg-gold/10 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => setDeleteId(d.id)} className="rounded p-1 text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      <DepositForm open={showForm} onClose={() => { setShowForm(false); setEditItem(undefined) }} onSaved={load} edit={editItem} />
      <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Hapus Deposit?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Ini akan mempengaruhi perhitungan saldo.</p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1 border-border" onClick={() => setDeleteId(null)}>Batal</Button>
            <Button onClick={() => del(deleteId!)} className="flex-1 bg-danger hover:bg-danger/90 text-white">Hapus</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </RequireAdmin>
  )
}
