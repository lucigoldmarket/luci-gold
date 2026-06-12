"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Unlock, ChevronDown, ChevronUp, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface FrozenUser {
  user_id: string
  name: string
  reason?: string
  frozen_at?: string
}

interface FrozenUsersPanelProps {
  users: FrozenUser[]
  onUnfreeze: (userId: string) => Promise<void>
}

export function FrozenUsersPanel({ users, onUnfreeze }: FrozenUsersPanelProps) {
  const [open, setOpen] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  if (users.length === 0) return null

  async function handleUnfreeze(userId: string) {
    setLoadingId(userId)
    try {
      await onUnfreeze(userId)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 transition-colors"
      >
        <Badge variant="outline" className="text-xs bg-rose-500/10 text-rose-400 border-0 px-1.5 py-0">
          {users.length} frozen
        </Badge>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <div className="mt-2 space-y-1.5 rounded-xl border border-border bg-background/50 p-2">
          {users.map((u) => (
            <div key={u.user_id} className={cn("flex items-center justify-between gap-2 rounded-lg px-2 py-1.5")}>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{u.name || u.user_id}</p>
                {u.reason && <p className="text-[10px] text-muted-foreground truncate">{u.reason}</p>}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleUnfreeze(u.user_id)}
                disabled={loadingId === u.user_id}
                className="h-6 px-2 text-[10px] shrink-0"
              >
                {loadingId === u.user_id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Unlock className="h-3 w-3 mr-0.5" />
                )}
                Unfreeze
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
