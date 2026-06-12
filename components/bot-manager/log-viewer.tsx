"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { BotId } from "./bot-card"

const BOT_LABELS: Record<BotId, string> = {
  userbot: "Userbot",
  bangjugobot: "Bangjugo Bot",
  autopost: "Auto Post",
}

function colorize(line: string): string {
  const l = line.toLowerCase()
  if (l.includes("error") || l.includes("gagal") || l.includes("failed")) return "text-rose-400"
  if (l.includes("warn") || l.includes("warning")) return "text-yellow-400"
  if (l.includes("deal") || l.includes("success") || l.includes("berhasil") || l.includes("profit")) return "text-emerald-400"
  if (l.includes("start") || l.includes("running") || l.includes("online")) return "text-sky-400"
  return "text-muted-foreground"
}

interface LogViewerProps {
  activeBots: BotId[]
}

export function LogViewer({ activeBots }: LogViewerProps) {
  const [selectedBot, setSelectedBot] = useState<BotId>("userbot")
  const [lines, setLines] = useState<string[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const esRef = useRef<EventSource | null>(null)

  const connectSSE = useCallback((botId: BotId) => {
    esRef.current?.close()
    setLines([])
    const es = new EventSource(`/api/botproxy/log/${botId}/stream`)
    esRef.current = es
    es.onmessage = (e) => {
      const raw: string = e.data
      setLines((prev) => {
        const next = [...prev, raw]
        return next.length > 500 ? next.slice(-500) : next
      })
    }
    es.onerror = () => {
      setLines((prev) => [...prev, "[dashboard] Koneksi SSE terputus, mencoba lagi..."])
    }
  }, [])

  useEffect(() => {
    connectSSE(selectedBot)
    return () => esRef.current?.close()
  }, [selectedBot, connectSSE])

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [lines, autoScroll])

  async function clearLog() {
    await fetch(`/api/botproxy/log/${selectedBot}/clear`, { method: "POST" })
    setLines([])
  }

  const allBots: BotId[] = ["userbot", "bangjugobot", "autopost"]

  return (
    <div className="flex flex-col h-full min-h-[280px]">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Select value={selectedBot} onValueChange={(v) => setSelectedBot(v as BotId)}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allBots.map((id) => (
              <SelectItem key={id} value={id} className="text-xs">
                {BOT_LABELS[id]}
                {activeBots.includes(id) && (
                  <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setAutoScroll((v) => !v)}
          className={cn("h-8 text-xs", autoScroll && "border-primary/50 text-primary")}
        >
          <ArrowDown className="h-3.5 w-3.5 mr-1" />
          Auto-scroll {autoScroll ? "ON" : "OFF"}
        </Button>

        <Button size="sm" variant="outline" onClick={clearLog} className="h-8 text-xs ml-auto">
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Clear
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl bg-black/40 border border-border p-3 font-mono text-xs leading-5 min-h-[220px] max-h-[360px]">
        {lines.length === 0 ? (
          <p className="text-muted-foreground/50">Menunggu log...</p>
        ) : (
          lines.map((line, i) => (
            <div key={i} className={colorize(line)}>
              {line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
