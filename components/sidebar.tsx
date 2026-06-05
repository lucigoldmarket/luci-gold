"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Calculator,
  FileText,
  BarChart3,
  ArrowDownToLine,
  Receipt,
  Coins,
  Settings,
  LogOut,
  Pin,
  PinOff,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/types"

const adminMenuItems = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/" },
  { title: "Kalkulator G2G", icon: Calculator, href: "/kalkulator" },
  { title: "Transaksi", icon: FileText, href: "/transaksi" },
  { title: "Deposit", icon: Coins, href: "/deposit" },
  { title: "Withdrawal", icon: ArrowDownToLine, href: "/withdrawal" },
  { title: "Pengeluaran", icon: Receipt, href: "/pengeluaran" },
  { title: "Laporan", icon: BarChart3, href: "/laporan" },
  { title: "Pengaturan", icon: Settings, href: "/pengaturan" },
]

const investorMenuItems = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/" },
  { title: "Kalkulator G2G", icon: Calculator, href: "/kalkulator" },
  { title: "Transaksi", icon: FileText, href: "/transaksi" },
  { title: "Pengeluaran", icon: Receipt, href: "/pengeluaran" },
  { title: "Laporan", icon: BarChart3, href: "/laporan" },
  { title: "Pengaturan", icon: Settings, href: "/pengaturan" },
]

const SIDEBAR_EXPANDED = 264   // px offset for content (240px sidebar + 16px left inset + 8px gap)
const SIDEBAR_COLLAPSED = 88   // px offset for content (72px sidebar + 16px left inset)

function setSidebarOffset(px: number) {
  document.documentElement.style.setProperty("--sidebar-offset", `${px}px`)
}

export function Sidebar() {
  const [locked, setLocked] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isExpanded = locked || hovered

  // Load locked state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-locked") === "true"
    setLocked(saved)
    setMounted(true)

    async function loadProfile() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single()
      if (data) setProfile(data as Profile)
    }
    loadProfile()
  }, [])

  // Update CSS variable whenever expansion state changes
  useEffect(() => {
    if (!mounted) return
    setSidebarOffset(locked ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED)
  }, [locked, mounted])

  function handleMouseEnter() {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    setHovered(true)
  }

  function handleMouseLeave() {
    leaveTimer.current = setTimeout(() => setHovered(false), 150)
  }

  function toggleLock() {
    const next = !locked
    setLocked(next)
    localStorage.setItem("sidebar-locked", String(next))
    setSidebarOffset(next ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  const menuItems = profile?.role === "admin" ? adminMenuItems : investorMenuItems

  // SSR placeholder — collapsed width
  if (!mounted) {
    return (
      <aside className="hidden md:flex fixed left-4 top-4 bottom-4 z-50 flex-col rounded-2xl border border-border bg-card/80 backdrop-blur-xl w-[72px]" />
    )
  }

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "hidden md:flex fixed left-4 top-4 bottom-4 z-50 flex-col rounded-2xl border border-border bg-card/80 backdrop-blur-xl transition-all duration-300 overflow-hidden",
        isExpanded ? "w-[240px]" : "w-[72px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 min-h-[72px]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary">
          <span className="font-heading text-xl font-bold text-primary-foreground">L</span>
        </div>
        {isExpanded && (
          <div className="flex flex-col overflow-hidden">
            <span className="font-heading text-lg font-semibold text-gold-gradient whitespace-nowrap">LUCI GOLD</span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">Trading System</span>
          </div>
        )}
      </div>

      <Separator className="bg-border" />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3 overflow-hidden">
        {menuItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              title={!isExpanded ? item.title : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 whitespace-nowrap",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {isExpanded && <span>{item.title}</span>}
            </Link>
          )
        })}
      </nav>

      <Separator className="bg-border" />

      {/* User + Lock */}
      <div className="p-3 space-y-1">
        {/* Lock/Unlock button */}
        <button
          onClick={toggleLock}
          title={locked ? "Lepas kunci sidebar" : "Kunci sidebar tetap terbuka"}
          className={cn(
            "flex items-center gap-3 w-full rounded-xl px-3 py-2 text-sm transition-colors",
            locked
              ? "text-gold hover:bg-secondary"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          {locked
            ? <Pin className="h-4 w-4 shrink-0 fill-gold text-gold" />
            : <PinOff className="h-4 w-4 shrink-0" />}
          {isExpanded && (
            <span className="whitespace-nowrap">{locked ? "Terkunci" : "Kunci Sidebar"}</span>
          )}
        </button>

        {/* User row */}
        <div className={cn("flex items-center gap-3 rounded-xl px-3 py-2", !isExpanded && "justify-center")}>
          <Avatar className="h-8 w-8 border border-primary/20 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {profile?.full_name?.charAt(0).toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
          {isExpanded && (
            <>
              <div className="flex flex-1 flex-col min-w-0">
                <span className="text-sm font-medium text-foreground truncate">{profile?.full_name ?? "—"}</span>
                <span className="text-xs text-muted-foreground capitalize">{profile?.role ?? "—"}</span>
              </div>
              <button
                onClick={handleLogout}
                title="Logout"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
