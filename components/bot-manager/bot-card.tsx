"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Play, Square, Pause, RotateCcw, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type BotId = "userbot" | "bangjugobot" | "autopost"

export interface BotStatus {
  running: boolean
  paused?: boolean
  uptime?: string
  frozen_count?: number
  countdown?: string
}

interface BotCardProps {
  botId: BotId
  title: string
  description: string
  status: BotStatus | null
  onAction: (botId: BotId, action: "start" | "stop" | "pause" | "resume") => Promise<void>
  extra?: React.ReactNode
}

export function BotCard({ botId, title, description, status, onAction, extra }: BotCardProps) {
  const [loading, setLoading] = useState<string | null>(null)

  async function handleAction(action: "start" | "stop" | "pause" | "resume") {
    setLoading(action)
    try {
      await onAction(botId, action)
    } finally {
      setLoading(null)
    }
  }

  const isRunning = status?.running ?? false
  const isPaused = status?.paused ?? false

  return (
    <Card className="border-border bg-card/60 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <Badge
            variant="outline"
            className={cn(
              "text-xs border-0 font-medium",
              isRunning && !isPaused
                ? "bg-emerald-500/15 text-emerald-400"
                : isPaused
                ? "bg-yellow-500/15 text-yellow-400"
                : "bg-secondary text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "mr-1.5 h-1.5 w-1.5 rounded-full inline-block",
                isRunning && !isPaused
                  ? "bg-emerald-400 animate-pulse"
                  : isPaused
                  ? "bg-yellow-400"
                  : "bg-muted-foreground"
              )}
            />
            {isRunning && !isPaused ? "Online" : isPaused ? "Paused" : "Offline"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>

      <CardContent className="space-y-3">
        {status?.uptime && (
          <p className="text-xs text-muted-foreground">Uptime: {status.uptime}</p>
        )}
        {status?.countdown && (
          <p className="text-xs text-muted-foreground">Next post: {status.countdown}</p>
        )}
        {typeof status?.frozen_count === "number" && status.frozen_count > 0 && (
          <Badge variant="outline" className="text-xs bg-rose-500/10 text-rose-400 border-0">
            {status.frozen_count} user frozen
          </Badge>
        )}

        {extra}

        <div className="flex flex-wrap gap-2 pt-1">
          {!isRunning ? (
            <Button
              size="sm"
              onClick={() => handleAction("start")}
              disabled={!!loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white h-8 text-xs"
            >
              {loading === "start" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />}
              Start
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction("stop")}
                disabled={!!loading}
                className="h-8 text-xs border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
              >
                {loading === "stop" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Square className="h-3.5 w-3.5 mr-1" />}
                Stop
              </Button>

              {botId === "userbot" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction(isPaused ? "resume" : "pause")}
                  disabled={!!loading}
                  className="h-8 text-xs"
                >
                  {loading === "pause" || loading === "resume" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : isPaused ? (
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  ) : (
                    <Pause className="h-3.5 w-3.5 mr-1" />
                  )}
                  {isPaused ? "Resume" : "Pause"}
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
