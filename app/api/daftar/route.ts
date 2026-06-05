import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: NextRequest) {
  const { nama, email, password, invite_code } = await req.json()

  if (!nama || !email || !password || !invite_code) {
    return NextResponse.json({ error: "Semua field wajib diisi." }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: "Server belum dikonfigurasi." }, { status: 500 })
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Validate invite code (case-insensitive)
  const { data: config } = await admin
    .from("profit_sharing_config")
    .select("invite_code")
    .single()

  const stored = (config?.invite_code ?? "").trim().toUpperCase()
  const entered = invite_code.trim().toUpperCase()

  if (!stored || stored !== entered) {
    return NextResponse.json({ error: "Kode undangan tidak valid." }, { status: 403 })
  }

  // Create auth user
  const { data: userData, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: nama },
  })

  if (createError) {
    const msg = createError.message.toLowerCase().includes("already registered")
      ? "Email sudah terdaftar."
      : createError.message
    return NextResponse.json({ error: msg }, { status: 409 })
  }

  // Upsert profile
  const { error: profileError } = await admin.from("profiles").upsert({
    id: userData.user.id,
    full_name: nama,
    role: "investor",
    is_active: true,
  })

  if (profileError) {
    return NextResponse.json({ error: "Akun dibuat tapi profil gagal disimpan: " + profileError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
