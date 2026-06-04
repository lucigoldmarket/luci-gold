"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/types"

let cached: Profile | null = null

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(cached)
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    if (cached) return
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single()
      if (data) { cached = data as Profile; setProfile(data as Profile) }
      setLoading(false)
    }
    load()
  }, [])

  return { profile, loading, isAdmin: profile?.role === "admin" }
}
