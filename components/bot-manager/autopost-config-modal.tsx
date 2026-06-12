"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Plus, X, Save } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface AutopostConfig {
  targets: string[]
  interval_minutes: number
}

interface AutopostConfigModalProps {
  open: boolean
  onClose: () => void
}

export function AutopostConfigModal({ open, onClose }: AutopostConfigModalProps) {
  const [config, setConfig] = useState<AutopostConfig>({ targets: [], interval_minutes: 60 })
  const [pesan, setPesan] = useState("")
  const [newTarget, setNewTarget] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([
      fetch("/api/botproxy/autopost/config").then((r) => r.json()),
      fetch("/api/botproxy/autopost/pesan").then((r) => r.json()),
    ])
      .then(([cfg, msg]) => {
        setConfig(cfg)
        setPesan(msg.pesan ?? "")
      })
      .finally(() => setLoading(false))
  }, [open])

  function addTarget() {
    const t = newTarget.trim()
    if (!t || config.targets.includes(t)) return
    setConfig((c) => ({ ...c, targets: [...c.targets, t] }))
    setNewTarget("")
  }

  function removeTarget(t: string) {
    setConfig((c) => ({ ...c, targets: c.targets.filter((x) => x !== t) }))
  }

  async function save() {
    setSaving(true)
    try {
      await Promise.all([
        fetch("/api/botproxy/autopost/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        }),
        fetch("/api/botproxy/autopost/pesan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pesan }),
        }),
      ])
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Konfigurasi Auto Post</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Target Channel</Label>
              <div className="flex gap-2">
                <Input
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTarget()}
                  placeholder="@username atau -100xxxxxxx"
                  className="h-8 text-sm"
                />
                <Button size="sm" onClick={addTarget} className="h-8 shrink-0">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {config.targets.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs gap-1 pr-1">
                    {t}
                    <button onClick={() => removeTarget(t)} className="hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {config.targets.length === 0 && (
                  <p className="text-xs text-muted-foreground">Belum ada target</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Interval (menit)</Label>
              <Input
                type="number"
                min={1}
                value={config.interval_minutes}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig((c) => ({ ...c, interval_minutes: Number(e.target.value) }))}
                className="h-8 text-sm w-32"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Pesan ({pesan.length} karakter)</Label>
              <Textarea
                value={pesan}
                onChange={(e) => setPesan(e.target.value)}
                rows={6}
                className="text-sm font-mono resize-none"
                placeholder="Tulis pesan yang akan diposting..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={onClose}>
                Batal
              </Button>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                Simpan
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
