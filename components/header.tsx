"use client"

import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Sidebar } from "./sidebar"
import { useProfile } from "@/lib/hooks/use-profile"

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  "/": { title: "Dashboard", sub: "Ringkasan performa trading" },
  "/kalkulator": { title: "Kalkulator Trading", sub: "Hitung profit real-time" },
  "/transaksi": { title: "Transaksi", sub: "Catat dan kelola transaksi" },
  "/deposit": { title: "Deposit", sub: "Tracking modal masuk dari investor" },
  "/withdrawal": { title: "Withdrawal", sub: "Catat penarikan dari G2G" },
  "/pengeluaran": { title: "Pengeluaran", sub: "Log semua biaya operasional" },
  "/laporan": { title: "Laporan Bagi Hasil", sub: "Rekap profit dan distribusi" },
  "/pemodal": { title: "Pemodal", sub: "Daftar investor aktif" },
  "/pengaturan": { title: "Pengaturan", sub: "Konfigurasi fee dan pengguna" },
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 11) return "Selamat pagi"
  if (h < 15) return "Selamat siang"
  if (h < 18) return "Selamat sore"
  return "Selamat malam"
}

function formatDate() {
  return new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function Header() {
  const pathname = usePathname()
  const { profile } = useProfile()
  const page = PAGE_TITLES[pathname] ?? { title: "LUCI Gold", sub: "" }
  const firstName = profile?.full_name?.split(" ")[0] ?? ""

  return (
    <header className="flex items-center justify-between py-4 mb-2">
      <div className="flex items-center gap-4">
        {/* Mobile Menu */}
        <Sheet>
          <SheetTrigger className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors lg:hidden cursor-pointer">
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0 bg-card border-border">
            <Sidebar />
          </SheetContent>
        </Sheet>

        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">{page.title}</h1>
          <p className="text-sm text-muted-foreground">
            {pathname === "/"
              ? `${getGreeting()}${firstName ? `, ${firstName}` : ""} · ${formatDate()}`
              : page.sub}
          </p>
        </div>
      </div>

      {/* Right: date chip (non-dashboard) */}
      {pathname !== "/" && (
        <div className="hidden md:flex items-center gap-2 rounded-xl border border-border bg-card/50 px-4 py-2">
          <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <span className="text-sm text-muted-foreground">{formatDate()}</span>
        </div>
      )}
    </header>
  )
}
