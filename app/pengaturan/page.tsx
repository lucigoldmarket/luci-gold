"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Save, Loader2, Database, Users, PieChart, CheckCircle, AlertTriangle, Pencil, Trash2, Wallet, Copy, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { RequireAdmin } from "@/components/require-admin"
import type { FeeConfig, Profile } from "@/lib/types"

function formatRupiah(num: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(num)
}

// ─── Tab: Fee G2G ────────────────────────────────────────────────────────────

function FeeTab() {
  const [fee, setFee] = useState<FeeConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from("fee_config").select("*").eq("is_active", true).single()
      if (data) setFee(data as FeeConfig)
    }
    load()
  }, [])

  async function handleSave() {
    if (!fee) return
    setSaving(true)
    setMsg(null)
    const supabase = createClient()
    const { error } = await supabase.from("fee_config").update({
      commission_pct: fee.commission_pct,
      vat_pct: fee.vat_pct,
      withdrawal_fee_pct: fee.withdrawal_fee_pct,
      withdrawal_fee_fixed: fee.withdrawal_fee_fixed,
      withdrawal_method: fee.withdrawal_method,
      updated_at: new Date().toISOString(),
    }).eq("id", fee.id)

    setSaving(false)
    setMsg(error ? { type: "err", text: error.message } : { type: "ok", text: "Konfigurasi fee disimpan." })
  }

  if (!fee) return <div className="py-8 text-muted-foreground text-sm text-center"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Memuat...</div>

  const effectiveComm = fee.commission_pct * (1 + fee.vat_pct / 100)

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Konfigurasi Fee G2G</CardTitle>
        <CardDescription className="text-muted-foreground">
          Rank: <span className="text-gold font-medium">{fee.seller_rank}</span> · Metode: {fee.withdrawal_method}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground">Commission Fee (%)</Label>
            <Input type="number" step="0.01" value={fee.commission_pct}
              onChange={(e) => setFee({ ...fee, commission_pct: parseFloat(e.target.value) })}
              className="bg-background border-border text-foreground" />
            <p className="text-xs text-muted-foreground">Uncommon: 7.99% · Rare: 6.99% · Epic: 5.99%</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground">VAT / PPN (%)</Label>
            <Input type="number" step="0.01" value={fee.vat_pct}
              onChange={(e) => setFee({ ...fee, vat_pct: parseFloat(e.target.value) })}
              className="bg-background border-border text-foreground" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground">Withdrawal Fee (%)</Label>
            <Input type="number" step="0.01" value={fee.withdrawal_fee_pct}
              onChange={(e) => setFee({ ...fee, withdrawal_fee_pct: parseFloat(e.target.value) })}
              className="bg-background border-border text-foreground" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground">Withdrawal Fixed (IDR)</Label>
            <Input type="number" value={fee.withdrawal_fee_fixed}
              onChange={(e) => setFee({ ...fee, withdrawal_fee_fixed: parseFloat(e.target.value) })}
              className="bg-background border-border text-foreground" />
            <p className="text-xs text-muted-foreground">DOKU Bank Transfer: Rp 19.999</p>
          </div>
        </div>

        <div className="rounded-lg bg-secondary/50 border border-border p-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Komisi Efektif (incl. VAT)</p>
            <p className="text-gold font-semibold">{effectiveComm.toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Cost %</p>
            <p className="text-gold font-semibold">{(effectiveComm + fee.withdrawal_fee_pct).toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-muted-foreground">Fixed per Withdrawal</p>
            <p className="text-foreground font-semibold">{formatRupiah(fee.withdrawal_fee_fixed)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Withdrawal Method</p>
            <p className="text-foreground font-semibold">{fee.withdrawal_method}</p>
          </div>
        </div>

        {msg && (
          <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${msg.type === "ok" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
            {msg.type === "ok" ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {msg.text}
          </div>
        )}

        <Button onClick={handleSave} className="bg-gold hover:bg-gold/90 text-background" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Simpan Fee
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Tab: Saldo Awal ─────────────────────────────────────────────────────────

function SaldoAwalTab() {
  const [saldo, setSaldo] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from("profit_sharing_config").select("initial_saldo").single()
      if (data) setSaldo((data as any).initial_saldo ?? 0)
      setLoaded(true)
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true); setMsg(null)
    const supabase = createClient()
    const { data: cfg } = await supabase.from("profit_sharing_config").select("id").single()
    const { error } = await supabase.from("profit_sharing_config")
      .update({ initial_saldo: saldo, updated_at: new Date().toISOString() })
      .eq("id", (cfg as any)?.id)
    setSaving(false)
    setMsg(error ? { type: "err", text: error.message } : { type: "ok", text: "Saldo awal disimpan." })
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Saldo Awal</CardTitle>
        <CardDescription className="text-muted-foreground">
          Modal awal sebelum ada transaksi tercatat di sistem ini. Isi satu kali saat setup.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5 max-w-xs">
          <Label className="text-muted-foreground">Saldo Awal (IDR)</Label>
          <Input
            type="number"
            value={saldo || ""}
            onChange={(e) => setSaldo(Number(e.target.value))}
            onWheel={(e) => (e.target as HTMLInputElement).blur()}
            className="bg-background border-border text-foreground"
            disabled={!loaded}
          />
          <p className="text-xs text-muted-foreground">
            Nilai ini menjadi titik awal perhitungan saldo di dashboard.
            Saldo bertambah dari profit Direct + withdrawal G2G, berkurang saat beli gold G2G.
          </p>
        </div>
        {msg && (
          <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${msg.type === "ok" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
            {msg.type === "ok" ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {msg.text}
          </div>
        )}
        <Button onClick={handleSave} disabled={saving || !loaded} className="bg-gold hover:bg-gold/90 text-background">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Simpan Saldo Awal
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Tab: Profit Sharing ─────────────────────────────────────────────────────

interface PSMember { id: string; full_name: string; share_pct: number; is_active: boolean; notes: string | null }

function ProfitSharingTab() {
  const [members, setMembers] = useState<PSMember[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [newPct, setNewPct] = useState(0)
  const [newNotes, setNewNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  // edit state
  const [editName, setEditName] = useState("")
  const [editPct, setEditPct] = useState(0)
  const [editNotes, setEditNotes] = useState("")
  const [editActive, setEditActive] = useState(true)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from("profit_sharing_members").select("*").order("created_at")
    setMembers((data as PSMember[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const totalPct = members.filter(m => m.is_active).reduce((s, m) => s + m.share_pct, 0)

  async function handleAdd() {
    if (!newName || newPct <= 0) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from("profit_sharing_members").insert({ full_name: newName, share_pct: newPct, notes: newNotes || null })
    setSaving(false)
    if (error) { setMsg({ type: "err", text: error.message }); return }
    setNewName(""); setNewPct(0); setNewNotes(""); setShowAdd(false)
    setMsg({ type: "ok", text: "Anggota ditambahkan." }); load()
  }

  async function handleEdit() {
    if (!editId) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from("profit_sharing_members").update({ full_name: editName, share_pct: editPct, notes: editNotes || null, is_active: editActive }).eq("id", editId)
    setSaving(false); setEditId(null); load()
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    await supabase.from("profit_sharing_members").delete().eq("id", id)
    load()
  }

  function startEdit(m: PSMember) {
    setEditId(m.id); setEditName(m.full_name); setEditPct(m.share_pct); setEditNotes(m.notes ?? ""); setEditActive(m.is_active)
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-foreground">Anggota Profit Sharing</CardTitle>
            <CardDescription className="text-muted-foreground">
              Atur siapa saja yang menerima profit dan berapa % masing-masing. Expenses dipotong SEBELUM dibagi.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="bg-gold hover:bg-gold/90 text-background">
            <Save className="h-4 w-4 mr-1" /> Tambah
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total indicator */}
        <div className={cn("rounded-lg p-3 border text-sm flex items-center justify-between",
          Math.abs(totalPct - 100) < 0.01 ? "bg-success/10 border-success/30" : "bg-gold/10 border-gold/30"
        )}>
          <span className="text-muted-foreground">Total % aktif</span>
          <span className={cn("font-bold text-lg", Math.abs(totalPct - 100) < 0.01 ? "text-success" : "text-gold")}>
            {totalPct.toFixed(2)}%
          </span>
        </div>
        {Math.abs(totalPct - 100) > 0.01 && (
          <p className="text-xs text-gold">⚠️ Total harus 100% untuk distribusi yang benar. Selisih: {(100 - totalPct).toFixed(2)}%</p>
        )}

        {showAdd && (
          <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Tambah Anggota Baru</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-sm">Nama</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="bg-background border-border text-foreground" placeholder="Nama anggota" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-sm">Porsi (%)</Label>
                <Input type="number" value={newPct || ""} onChange={(e) => setNewPct(Number(e.target.value))}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()} className="bg-background border-border text-foreground" step={0.5} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-muted-foreground text-sm">Catatan (opsional)</Label>
                <Input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} className="bg-background border-border text-foreground" placeholder="Peran, keterangan..." />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="border-border" onClick={() => setShowAdd(false)}>Batal</Button>
              <Button onClick={handleAdd} disabled={saving || !newName || newPct <= 0} className="bg-gold hover:bg-gold/90 text-background">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Tambah"}
              </Button>
            </div>
          </div>
        )}

        {msg && (
          <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${msg.type === "ok" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
            {msg.type === "ok" ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {msg.text}
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Memuat...</div>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Belum ada anggota. Klik "Tambah" untuk mulai.</p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className={cn("rounded-lg border p-3 flex items-center gap-3", m.is_active ? "border-border bg-background/50" : "border-border/40 bg-secondary/20 opacity-60")}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground text-sm">{m.full_name}</span>
                    {!m.is_active && <Badge variant="outline" className="border-0 bg-secondary text-muted-foreground text-xs">Nonaktif</Badge>}
                  </div>
                  {m.notes && <p className="text-xs text-muted-foreground mt-0.5">{m.notes}</p>}
                </div>
                <span className="text-gold font-bold text-lg tabular-nums">{m.share_pct}%</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => startEdit(m)} className="rounded p-1 text-muted-foreground hover:text-gold hover:bg-gold/10 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDelete(m.id)} className="rounded p-1 text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit dialog */}
        <Dialog open={!!editId} onOpenChange={(v) => !v && setEditId(null)}>
          <DialogContent className="bg-card border-border max-w-sm">
            <DialogHeader><DialogTitle className="text-foreground">Edit Anggota</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-sm">Nama</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-background border-border text-foreground" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-sm">Porsi (%)</Label>
                <Input type="number" value={editPct || ""} onChange={(e) => setEditPct(Number(e.target.value))}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()} className="bg-background border-border text-foreground" step={0.5} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-sm">Catatan</Label>
                <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="bg-background border-border text-foreground" />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditActive(!editActive)} className={cn("h-5 w-9 rounded-full transition-colors relative", editActive ? "bg-success" : "bg-muted")}>
                  <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform", editActive ? "left-4" : "left-0.5")} />
                </button>
                <span className="text-sm text-muted-foreground">{editActive ? "Aktif" : "Nonaktif"}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 border-border" onClick={() => setEditId(null)}>Batal</Button>
                <Button onClick={handleEdit} disabled={saving} className="flex-1 bg-gold hover:bg-gold/90 text-background">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

// ─── Tab: Pengguna ────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [inviteCode, setInviteCode] = useState("")
  const [savingCode, setSavingCode] = useState(false)
  const [copied, setCopied] = useState(false)

  async function load() {
    const supabase = createClient()
    const [{ data: usersData }, { data: cfg }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("profit_sharing_config").select("invite_code").single(),
    ])
    setUsers((usersData as Profile[]) ?? [])
    if (cfg) setInviteCode((cfg as any).invite_code ?? "")
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function saveInviteCode() {
    setSavingCode(true)
    const supabase = createClient()
    const { data: cfg } = await supabase.from("profit_sharing_config").select("id").single()
    await supabase.from("profit_sharing_config")
      .update({ invite_code: inviteCode.trim().toUpperCase() })
      .eq("id", (cfg as any).id)
    setSavingCode(false)
    setInviteCode(inviteCode.trim().toUpperCase())
    setMsg({ type: "ok", text: "Kode undangan disimpan." })
  }

  function regenerateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
    setInviteCode(code)
  }

  function copyCode() {
    navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function changeRole(id: string, role: "admin" | "investor") {
    setUpdating(id)
    const supabase = createClient()
    await supabase.from("profiles").update({ role }).eq("id", id)
    await load()
    setUpdating(null)
    setMsg({ type: "ok", text: "Role diperbarui." })
  }

  async function toggleActive(id: string, current: boolean) {
    setUpdating(id)
    const supabase = createClient()
    await supabase.from("profiles").update({ is_active: !current }).eq("id", id)
    await load()
    setUpdating(null)
  }

  return (
    <div className="space-y-6">
    {/* Invite Code */}
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Kode Undangan</CardTitle>
        <CardDescription className="text-muted-foreground">
          Bagikan kode ini ke orang yang ingin kamu daftarkan. Mereka daftar di halaman <span className="text-gold font-mono">/daftar</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 items-end">
          <div className="space-y-1.5 flex-1">
            <Label className="text-muted-foreground">Kode Aktif</Label>
            <Input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="bg-background border-border text-foreground font-mono tracking-widest text-lg"
              placeholder="LUCIXXX"
              maxLength={20}
            />
          </div>
          <Button variant="outline" size="icon" onClick={copyCode} className="border-border h-10 w-10" title="Salin kode">
            {copied ? <CheckCircle className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={regenerateCode} className="border-border h-10 w-10" title="Buat kode baru acak">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Kode tidak case-sensitive. Klik ikon refresh untuk generate kode acak, lalu simpan.</p>
        <Button onClick={saveInviteCode} disabled={savingCode || !inviteCode} className="bg-gold hover:bg-gold/90 text-background">
          {savingCode ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Simpan Kode
        </Button>
      </CardContent>
    </Card>

    {/* User list */}
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Manajemen Pengguna</CardTitle>
        <CardDescription className="text-muted-foreground">
          Investor yang sudah daftar sendiri akan muncul di sini. Kamu bisa ubah role dan status aktif mereka.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {msg && (
          <div className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 bg-success/10 text-success">
            <CheckCircle className="h-4 w-4" /> {msg.text}
          </div>
        )}
        {loading ? (
          <div className="py-8 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Memuat...</div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-lg border border-border bg-background/50 px-4 py-3 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                    {u.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{u.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={u.is_active ? "border-success/50 text-success bg-success/10" : "border-danger/50 text-danger bg-danger/10"}>
                    {u.is_active ? "Aktif" : "Nonaktif"}
                  </Badge>
                  <Select value={u.role} onValueChange={(v) => changeRole(u.id, v as "admin" | "investor")} disabled={updating === u.id}>
                    <SelectTrigger className="w-28 h-8 bg-background border-border text-foreground text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="investor">Investor</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm"
                    className="h-8 text-xs border-border"
                    onClick={() => toggleActive(u.id, u.is_active)}
                    disabled={updating === u.id}
                  >
                    {u.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PengaturanPage() {
  return (
    <RequireAdmin>
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 page-content">
        <Header />
        <main className="p-4 md:p-6 lg:p-8">
          <div className="mb-6">
            <h1 className="font-heading text-3xl font-bold text-foreground mb-1">Pengaturan</h1>
            <p className="text-muted-foreground text-sm">Kelola fee, profit sharing, dan pengguna</p>
          </div>

          <Tabs defaultValue="fee" className="space-y-6">
            <TabsList className="bg-card border border-border flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="fee" className="data-[state=active]:bg-gold data-[state=active]:text-background">
                <Database className="h-4 w-4 mr-2" /> Fee G2G
              </TabsTrigger>
              <TabsTrigger value="saldo" className="data-[state=active]:bg-gold data-[state=active]:text-background">
                <Wallet className="h-4 w-4 mr-2" /> Saldo Awal
              </TabsTrigger>
              <TabsTrigger value="sharing" className="data-[state=active]:bg-gold data-[state=active]:text-background">
                <PieChart className="h-4 w-4 mr-2" /> Profit Sharing
              </TabsTrigger>
              <TabsTrigger value="users" className="data-[state=active]:bg-gold data-[state=active]:text-background">
                <Users className="h-4 w-4 mr-2" /> Pengguna
              </TabsTrigger>
            </TabsList>
            <TabsContent value="fee"><FeeTab /></TabsContent>
            <TabsContent value="saldo"><SaldoAwalTab /></TabsContent>
            <TabsContent value="sharing"><ProfitSharingTab /></TabsContent>
            <TabsContent value="users"><UsersTab /></TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
    </RequireAdmin>
  )
}
