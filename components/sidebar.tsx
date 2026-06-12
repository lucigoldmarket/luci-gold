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
  Clipboard,
  StickyNote,
  Bot,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/client"
import { useProfile } from "@/lib/hooks/use-profile"

const adminMenuItems = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/" },
  { title: "Kalkulator G2G", icon: Calculator, href: "/kalkulator" },
  { title: "Transaksi", icon: FileText, href: "/transaksi" },
  { title: "WTB Template", icon: Clipboard, href: "/wtb" },
  { title: "Deposit", icon: Coins, href: "/deposit" },
  { title: "Withdrawal", icon: ArrowDownToLine, href: "/withdrawal" },
  { title: "Pengeluaran", icon: Receipt, href: "/pengeluaran" },
  { title: "Laporan", icon: BarChart3, href: "/laporan" },
  { title: "Catatan", icon: StickyNote, href: "/catatan" },
  { title: "Bot Manager", icon: Bot, href: "/bot-manager" },
  { title: "Pengaturan", icon: Settings, href: "/pengaturan" },
]

const investorMenuItems = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/" },
  { title: "Kalkulator G2G", icon: Calculator, href: "/kalkulator" },
  { title: "Transaksi", icon: FileText, href: "/transaksi" },
  { title: "Deposit", icon: Coins, href: "/deposit" },
  { title: "Withdrawal", icon: ArrowDownToLine, href: "/withdrawal" },
  { title: "Pengeluaran", icon: Receipt, href: "/pengeluaran" },
  { title: "Laporan", icon: BarChart3, href: "/laporan" },
  { title: "Pengaturan", icon: Settings, href: "/pengaturan" },
]

const SIDEBAR_EXPANDED = 264
const SIDEBAR_COLLAPSED = 88

function setSidebarOffset(px: number) {
  document.documentElement.style.setProperty("--sidebar-offset", `${px}px`)
}

// ─── Shared nav content ───────────────────────────────────────────────────────

function NavContent({
  menuItems,
  isExpanded,
  pathname,
  onLinkClick,
}: {
  menuItems: typeof adminMenuItems | null
  isExpanded: boolean
  pathname: string
  onLinkClick?: () => void
}) {
  if (!menuItems) {
    return (
      <>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={cn(
              "h-10 rounded-xl bg-secondary/40 animate-pulse",
              isExpanded ? "w-full" : "w-10 mx-auto"
            )}
          />
        ))}
      </>
    )
  }

  return (
    <>
      {menuItems.map((item) => {
        const isActive = pathname === item.href
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onLinkClick}
            title={!isExpanded ? item.title : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
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
    </>
  )
}

// ─── Desktop Sidebar ──────────────────────────────────────────────────────────

export function Sidebar() {
  const [locked, setLocked] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [canTransition, setCanTransition] = useState(false)
  const pathname = usePathname()
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { profile } = useProfile()
  const isExpanded = locked || hovered

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-locked") === "true"
    setLocked(saved)
    setMounted(true)
    // Enable transitions only after initial width is applied — prevents shrink flash on navigation
    requestAnimationFrame(() => requestAnimationFrame(() => setCanTransition(true)))
  }, [])

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

  const menuItems = !profile ? null : profile.role === "admin" ? adminMenuItems : investorMenuItems

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
        "hidden md:flex fixed left-4 top-4 bottom-4 z-50 flex-col rounded-2xl border border-border bg-card/80 backdrop-blur-xl overflow-hidden",
        canTransition && "transition-all duration-200",
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
            <span className="text-xs text-muted-foreground whitespace-nowrap">Track gold sales</span>
          </div>
        )}
      </div>

      <Separator className="bg-border" />

      <nav className="flex-1 space-y-1 p-3 overflow-y-auto overflow-x-hidden">
        <NavContent menuItems={menuItems} isExpanded={isExpanded} pathname={pathname} />
      </nav>

      <Separator className="bg-border" />

      {/* User + Lock */}
      <div className="p-3 space-y-1">
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

// ─── Mobile Sidebar (used inside Sheet drawer) ────────────────────────────────

export function MobileSidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const { profile } = useProfile()

  const menuItems = !profile ? null : profile.role === "admin" ? adminMenuItems : investorMenuItems

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary">
          <span className="font-heading text-xl font-bold text-primary-foreground">L</span>
        </div>
        <div className="flex flex-col">
          <span className="font-heading text-lg font-semibold text-gold-gradient">LUCI GOLD</span>
          <span className="text-xs text-muted-foreground">Track gold sales</span>
        </div>
      </div>

      <Separator className="bg-border" />

      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
        <NavContent menuItems={menuItems} isExpanded={true} pathname={pathname} onLinkClick={onClose} />
      </nav>

      <Separator className="bg-border" />

      {/* User */}
      <div className="p-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2">
          <Avatar className="h-8 w-8 border border-primary/20 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {profile?.full_name?.charAt(0).toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
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
        </div>
      </div>
    </div>
  )
}
