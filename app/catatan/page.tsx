"use client"

import { useState, useEffect, useRef } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Plus, Trash2, StickyNote, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

interface Note {
  id: string
  title: string
  content: string
  updated_at: string
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

export default function CatatanPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserId(user.id)

      const { data } = await supabase
        .from("notes")
        .select("id, title, content, updated_at")
        .order("updated_at", { ascending: false })

      const loaded = (data ?? []) as Note[]
      setNotes(loaded)
      if (loaded.length > 0) setSelectedId(loaded[0].id)
      setLoading(false)
    }
    init()
  }, [])

  const selected = notes.find((n) => n.id === selectedId) ?? null

  async function addNote() {
    if (!userId) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from("notes")
      .insert({ user_id: userId, title: "Catatan Baru", content: "" })
      .select("id, title, content, updated_at")
      .single()

    if (!error && data) {
      setNotes([data as Note, ...notes])
      setSelectedId((data as Note).id)
    }
  }

  async function deleteNote(id: string) {
    const supabase = createClient()
    await supabase.from("notes").delete().eq("id", id)
    const updated = notes.filter((n) => n.id !== id)
    setNotes(updated)
    if (selectedId === id) setSelectedId(updated.length > 0 ? updated[0].id : null)
  }

  function updateField(field: "title" | "content", value: string) {
    if (!selectedId) return

    // Optimistic update
    const now = new Date().toISOString()
    const updated = notes.map((n) =>
      n.id === selectedId ? { ...n, [field]: value, updated_at: now } : n
    )
    // Re-sort so edited note moves to top
    const idx = updated.findIndex((n) => n.id === selectedId)
    if (idx > 0) {
      const [item] = updated.splice(idx, 1)
      updated.unshift(item)
    }
    setNotes(updated)

    // Debounced save
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      const supabase = createClient()
      await supabase
        .from("notes")
        .update({ [field]: value, updated_at: now })
        .eq("id", selectedId)
      setSaving(false)
    }, 400)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 page-content flex flex-col">
        <Header />
        <main className="flex flex-1 overflow-hidden" style={{ height: "calc(100dvh - 64px)" }}>
          {/* Left: Note list */}
          <aside className="w-64 shrink-0 border-r border-border flex flex-col bg-card/50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold text-foreground">Catatan</span>
              <button
                onClick={addNote}
                className="flex items-center gap-1 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-colors px-2 py-1 text-xs font-medium"
              >
                <Plus className="h-3.5 w-3.5" /> Baru
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Memuat...
                </div>
              ) : notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <StickyNote className="h-8 w-8 text-muted-foreground mb-2 opacity-40" />
                  <p className="text-xs text-muted-foreground">Belum ada catatan</p>
                  <button onClick={addNote} className="mt-3 text-xs text-gold hover:underline">
                    + Tambah catatan pertama
                  </button>
                </div>
              ) : (
                notes.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => setSelectedId(note.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-border/50 hover:bg-secondary/50 transition-colors group",
                      note.id === selectedId && "bg-secondary/80"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{note.title || "Tanpa judul"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{note.content || "Kosong"}</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">{formatDate(note.updated_at)}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNote(note.id) }}
                        className="opacity-0 group-hover:opacity-100 shrink-0 p-1 rounded hover:bg-danger/10 hover:text-danger text-muted-foreground transition-all"
                        title="Hapus catatan"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* Right: Editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
                <StickyNote className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Pilih atau buat catatan baru</p>
                <button onClick={addNote} className="mt-3 text-sm text-gold hover:underline">
                  + Buat catatan
                </button>
              </div>
            ) : (
              <>
                {/* Title bar */}
                <div className="px-6 pt-5 pb-3 border-b border-border">
                  <input
                    type="text"
                    value={selected.title}
                    onChange={(e) => updateField("title", e.target.value)}
                    placeholder="Judul catatan..."
                    className="w-full bg-transparent text-xl font-semibold text-foreground placeholder:text-muted-foreground/40 outline-none"
                  />
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-muted-foreground">Terakhir diubah: {formatDate(selected.updated_at)}</p>
                    {saving && <p className="text-xs text-muted-foreground/60">Menyimpan...</p>}
                  </div>
                </div>

                {/* Content */}
                <textarea
                  value={selected.content}
                  onChange={(e) => updateField("content", e.target.value)}
                  placeholder="Tulis catatan di sini..."
                  className="flex-1 w-full resize-none bg-transparent px-6 py-4 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none leading-relaxed"
                />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
