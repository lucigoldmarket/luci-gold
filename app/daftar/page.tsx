"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { CheckCircle, Loader2 } from "lucide-react"

export default function DaftarPage() {
  const [nama, setNama] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError("Password tidak cocok.")
      return
    }
    if (password.length < 6) {
      setError("Password minimal 6 karakter.")
      return
    }

    setLoading(true)
    const res = await fetch("/api/daftar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama, email, password, invite_code: inviteCode }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(json.error ?? "Terjadi kesalahan.")
      return
    }

    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <CheckCircle className="h-14 w-14 text-success mx-auto" />
          <div>
            <h2 className="text-xl font-semibold text-foreground">Akun berhasil dibuat!</h2>
            <p className="text-muted-foreground text-sm mt-1">Kamu bisa langsung masuk dengan email dan password yang tadi didaftarkan.</p>
          </div>
          <Link href="/login">
            <Button className="w-full bg-gold hover:bg-gold/90 text-background">Masuk Sekarang</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="text-4xl font-heading text-gold">⬡ LUCI</div>
          <p className="text-muted-foreground text-sm">Daftar Akun Investor</p>
        </div>

        <Card className="border-gold/20 bg-card/50 backdrop-blur">
          <CardHeader className="pb-4">
            <h1 className="text-xl font-semibold text-center">Buat Akun</h1>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nama">Nama Lengkap</Label>
                <Input
                  id="nama"
                  type="text"
                  placeholder="Nama kamu"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimal 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Konfirmasi Password</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="Ulangi password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite">Kode Undangan</Label>
                <Input
                  id="invite"
                  type="text"
                  placeholder="Minta ke admin"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  required
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">Hanya orang yang diundang yang bisa mendaftar.</p>
              </div>

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              <Button type="submit" className="w-full bg-gold hover:bg-gold/90 text-background" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Mendaftar...</> : "Daftar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-gold hover:underline">Masuk</Link>
        </p>
      </div>
    </div>
  )
}
