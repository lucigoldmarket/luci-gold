"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useProfile } from "@/lib/hooks/use-profile"
import { Loader2 } from "lucide-react"

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useProfile()
  const router = useRouter()

  useEffect(() => {
    if (!loading && profile && profile.role !== "admin") {
      router.replace("/")
    }
  }, [profile, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat...
      </div>
    )
  }

  if (profile?.role !== "admin") return null

  return <>{children}</>
}
