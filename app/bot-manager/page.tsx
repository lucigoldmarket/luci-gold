"use client"

import { useState, useEffect, useCallback } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { RequireAdmin } from "@/components/require-admin"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Settings2, AlertTriangle, RefreshCw } from "lucide-react"
import { BotCard, type BotId, type BotStatus } from "@/components/bot-manager/bot-card"
import { LogViewer } from "@/components/bot-manager/log-viewer"
import { AutopostConfigModal } from "@/components/bot-manager/autopost-config-modal"
import { FrozenUsersPanel } from "@/components/bot-manager/frozen-users-panel"

interface StatusResponse {
  userbot: BotStatus
  bangjugobot: BotStatus
  autopost: BotStatus
  foreign_lock?: boolean
}

interface FrozenUser {
  user_id: string
  name: string
  reason?: string
  frozen_at?: string
}

export default function BotManagerPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [frozenUsers, setFrozenUsers] = useState<FrozenUser[]>([])
  const [offline, setOffline] = useState(false)
  const [autopostOpen, setAutopostOpen] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const [sRes, fRes] = await Promise.all([
        fetch("/api/botproxy/status"),
        fetch("/api/botproxy/userbot/frozen"),
      ])
      if (!sRes.ok) throw new Error("offline")
      const s: StatusResponse = await sRes.json()
      setStatus(s)
      setOffline(false)
      if (fRes.ok) {
        const f: FrozenUser[] = await fRes.json()
        setFrozenUsers(f)
      }
    } catch {
      setOffline(true)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const id = setInterval(fetchStatus, 3000)
    return () => clearInterval(id)
  }, [fetchStatus])

  async function handleAction(botId: BotId, action: "start" | "stop" | "pause" | "resume") {
    const endpoint =
      action === "pause" ? `/api/botproxy/userbot/pause`
      : action === "resume" ? `/api/botproxy/userbot/resume`
      : `/api/botproxy/bot/${botId}/${action}`
    await fetch(endpoint, { method: "POST" })
    await fetchStatus()
  }

  async function handleUnfreeze(userId: string) {
    await fetch(`/api/botproxy/userbot/unfreeze/${userId}`, { method: "POST" })
    await fetchStatus()
  }

  const activeBots: BotId[] = []
  if (status?.userbot?.running) activeBots.push("userbot")
  if (status?.bangjugobot?.running) activeBots.push("bangjugobot")
  if (status?.autopost?.running) activeBots.push("autopost")

  return (
    <RequireAdmin>
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 page-content">
        <Header />

        <main className="p-4 md:p-6 lg:p-8 space-y-6">
          {offline && (
            <div className="flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Dashboard bot tidak dapat dihubungi. Pastikan{" "}
                <code className="font-mono text-xs bg-yellow-500/20 px-1 rounded">python main.py</code>{" "}
                sudah dijalankan di folder <code className="font-mono text-xs bg-yellow-500/20 px-1 rounded">bangjugo-dashboard</code>.
              </span>
              <Button size="sm" variant="ghost" onClick={fetchStatus} className="ml-auto h-7 shrink-0">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {status?.foreign_lock && (
            <div className="flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Dashboard sedang dijalankan dari PC lain. Kontrol mungkin konflik.
            </div>
          )}

          {/* Bot status cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <BotCard
              botId="userbot"
              title="Userbot"
              description="Reply DM otomatis, pause/resume, frozen users"
              status={status?.userbot ?? null}
              onAction={handleAction}
              extra={
                <FrozenUsersPanel users={frozenUsers} onUnfreeze={handleUnfreeze} />
              }
            />

            <BotCard
              botId="bangjugobot"
              title="Bangjugo Bot"
              description="Bot utama Telegram"
              status={status?.bangjugobot ?? null}
              onAction={handleAction}
            />

            <BotCard
              botId="autopost"
              title="Auto Post"
              description="Posting otomatis ke channel dengan countdown"
              status={status?.autopost ?? null}
              onAction={handleAction}
              extra={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAutopostOpen(true)}
                  className="h-7 text-xs mt-1"
                >
                  <Settings2 className="h-3.5 w-3.5 mr-1" />
                  Konfigurasi
                </Button>
              }
            />
          </div>

          {/* Log viewer */}
          <Card className="border-border bg-card/60 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Log Real-time</CardTitle>
            </CardHeader>
            <CardContent>
              <LogViewer activeBots={activeBots} />
            </CardContent>
          </Card>
        </main>
      </div>
      <AutopostConfigModal open={autopostOpen} onClose={() => setAutopostOpen(false)} />
    </div>
    </RequireAdmin>
  )
}
