"use client"

import { useState, useEffect } from "react"
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
import { Plus, Loader2, Pencil, Trash2, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useProfile } from "@/lib/hooks/use-profile"

function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
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

const CATEGORIES = ["Withdrawal Fee G2G", "Pokok Bulanan", "Operasional Bisnis", "Lain-lain"]

const CATEGORY_STYLE: Record<string, string> = {
  "Withdrawal Fee G2G": "bg-gold/10 text-gold",
  "Pokok Bulanan": "bg-danger/10 text-danger",
  "Operasional Bisnis": "bg-blue-500/10 text-blue-400",
  "Lain-lain": "bg-secondary text-muted-foreground",
}

function ExpenseForm({
  open, onClose, onSaved, edit,
}: {
  open: boolean; onClose: () => void; onSaved: () => void; edit?: ExpenseRow
}) {
  const isEdit = !!edit
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [category, setCategory] = useState("Operasional Bisnis")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState(0)
  const [type, setType] = useState<"rutin" | "non_rutin">("non_rutin")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (edit) {
      setDate(edit.expense_date); setCategory(edit.category)
      setDescription(edit.description); setAmount(edit.amount_idr)
      setType(edit.expense_type as any)
    } else {
      setDate(new Date().toISOString().slice(0, 10)); setCategory("Operasional Bisnis")
      setDescription(""); setAmount(0); setType("non_rutin")
    }
  }, [edit, open])

  async function handleSave() {
    if (!description || amount <= 0) return
    setSaving(true)
    const supabase = createClient()
    if (isEdit) {
      await supabase.from("operational_expenses").update({ expense_date: date, category, description, amount_idr: amount, expense_type: type }).eq("id", edit!.id)
    } else {
      await supabase.from("operational_expenses").insert({ expense_date: date, category, description, amount_idr: amount, expense_type: type })
    }
    setSaving(false); onSaved(); onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">{isEdit ? "Edit Pengeluaran" : "Tambah Pengeluaran"}</DialogTitle>
        </DialogHeader>
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
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-sm">Kategori</Label>
              <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                <SelectTrigger className="bg-background border-border text-foreground"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-sm">Tipe</Label>
              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger className="bg-background border-border text-foreground"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="rutin">Rutin</SelectItem>
                  <SelectItem value="non_rutin">Non-Rutin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-muted-foreground text-sm">Deskripsi</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="bg-background border-border text-foreground" placeholder="Keterangan pengeluaran" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 border-border" onClick={onClose}>Batal</Button>
            <Button onClick={handleSave} disabled={saving || !description || amount <= 0} className="flex-1 bg-gold hover:bg-gold/90 text-background">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? "Simpan Perubahan" : "Tambah"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function PengeluaranPage() {
  const { isAdmin } = useProfile()
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<ExpenseRow | undefined>()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filterCat, setFilterCat] = useState("all")

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from("operational_expenses").select("*").order("expense_date", { ascending: false })
    setExpenses((data as ExpenseRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: string) {
    const supabase = createClient()
    await supabase.from("operational_expenses").delete().eq("id", id)
    setDeleteId(null); load()
  }

  const filtered = expenses.filter((e) => {
    if (filterCat !== "all" && e.category !== filterCat) return false
    if (search && !e.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const total = filtered.reduce((s, e) => s + e.amount_idr, 0)
  const byCategory: Record<string, number> = {}
  for (const e of expenses) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount_idr

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 page-content">
        <Header />
        <main className="p-4 md:p-6 lg:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="font-heading text-3xl font-bold text-foreground mb-1">Pengeluaran</h1>
              <p className="text-muted-foreground text-sm">Log semua biaya operasional · Termasuk auto-log dari withdrawal</p>
            </div>
            {isAdmin && (
              <Button onClick={() => { setEditItem(undefined); setShowForm(true) }} className="bg-gold hover:bg-gold/90 text-background">
                <Plus className="h-4 w-4 mr-2" /> Tambah Pengeluaran
              </Button>
            )}
          </div>

          {/* Summary by category */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {Object.entries(byCategory).map(([cat, amt]) => (
              <div key={cat} className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground truncate">{cat}</p>
                <p className="text-base font-semibold text-foreground mt-0.5">{formatRupiah(amt)}</p>
              </div>
            ))}
          </div>

          {/* Filter */}
          <Card className="bg-card border-border mb-4">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari deskripsi..." className="pl-9 bg-background border-border text-foreground" />
                </div>
                <Select value={filterCat} onValueChange={(v) => v && setFilterCat(v)}>
                  <SelectTrigger className="w-full sm:w-48 bg-background border-border text-foreground"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">Semua Kategori</SelectItem>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat...
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Belum ada pengeluaran.</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground">Tanggal</TableHead>
                        <TableHead className="text-muted-foreground">Kategori</TableHead>
                        <TableHead className="text-muted-foreground">Deskripsi</TableHead>
                        <TableHead className="text-muted-foreground">Tipe</TableHead>
                        <TableHead className="text-muted-foreground text-right">Nominal</TableHead>
                        {isAdmin && <TableHead className="w-16"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((e) => (
                        <TableRow key={e.id} className="border-border hover:bg-background/50">
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                            {new Date(e.expense_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("border-0 text-xs", CATEGORY_STYLE[e.category] ?? "bg-secondary text-muted-foreground")}>
                              {e.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-foreground text-sm">{e.description}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("border-0 text-xs", e.expense_type === "rutin" ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground")}>
                              {e.expense_type === "rutin" ? "Rutin" : "Non-Rutin"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-danger font-medium tabular-nums">
                            -{formatRupiah(e.amount_idr)}
                          </TableCell>
                          {isAdmin && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <button onClick={() => { setEditItem(e); setShowForm(true) }}
                                className="rounded p-1 text-muted-foreground hover:text-gold hover:bg-gold/10 transition-colors" title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => setDeleteId(e.id)}
                                className="rounded p-1 text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors" title="Hapus">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="border-t border-border px-4 py-3 flex justify-between text-sm">
                    <span className="text-muted-foreground">{filtered.length} pengeluaran ditampilkan</span>
                    <span className="text-danger font-semibold">-{formatRupiah(total)}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {isAdmin && <ExpenseForm open={showForm} onClose={() => { setShowForm(false); setEditItem(undefined) }} onSaved={load} edit={editItem} />}

      {isAdmin && (
        <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
          <DialogContent className="bg-card border-border max-w-sm">
            <DialogHeader><DialogTitle className="text-foreground">Hapus Pengeluaran?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Tindakan ini tidak bisa dibatalkan.</p>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" className="flex-1 border-border" onClick={() => setDeleteId(null)}>Batal</Button>
              <Button onClick={() => handleDelete(deleteId!)} className="flex-1 bg-danger hover:bg-danger/90 text-white">Hapus</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
