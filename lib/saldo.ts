import { createClient } from "@/lib/supabase/client"

export interface SaldoResult {
  saldo: number
  floatG2GPending: number
  g2gBalance: number
  initialSaldo: number
  totalDeposits: number
  directProfits: number
  wdReceived: number
  pendingG2GBuyCosts: number
  totalExpenses: number
}

export async function computeSaldo(): Promise<SaldoResult> {
  const supabase = createClient()

  const [{ data: deposits }, { data: txData }, { data: wdData }, { data: psConfig }, { data: feeConfig }, { data: expData }] = await Promise.all([
    supabase.from("deposits").select("amount_idr"),
    supabase.from("transactions").select(
      "channel, status, profit_idr, buy_price_idr, gold_amount, sell_price_idr, withdrawal_id, buyer_vat_pct"
    ),
    supabase.from("withdrawals").select("amount_received_idr"),
    supabase.from("profit_sharing_config").select("initial_saldo").single(),
    supabase.from("fee_config").select("commission_pct, vat_pct, withdrawal_fee_pct").eq("is_active", true).single(),
    supabase.from("operational_expenses").select("amount_idr"),
  ])

  const fc = feeConfig as any
  const vatPct = fc?.vat_pct ?? 11
  const commPct = fc?.commission_pct ?? 7.99
  const wdFeePct = fc?.withdrawal_fee_pct ?? 2.48
  // WD fee: same rate for all transactions (no buyer VAT on disbursement)
  const effWdFrac = wdFeePct * (1 + vatPct / 100) / 100

  const initialSaldo = (psConfig as any)?.initial_saldo ?? 0
  const totalDeposits = (deposits ?? []).reduce((s: number, d: any) => s + d.amount_idr, 0)
  const totalExpenses = (expData ?? []).reduce((s: number, e: any) => s + e.amount_idr, 0)

  const txs = (txData ?? []) as {
    channel: string; status: string; profit_idr: number | null
    buy_price_idr: number; gold_amount: number; sell_price_idr: number
    withdrawal_id: string | null; buyer_vat_pct: number | null
  }[]

  const wds = (wdData ?? []) as { amount_received_idr: number }[]

  // Direct profit masuk saldo saat completed
  const directProfits = txs
    .filter(t => t.channel === "direct" && t.status === "completed")
    .reduce((s, t) => s + (t.profit_idr ?? 0), 0)

  // G2G withdrawal net masuk saldo
  const wdReceived = wds.reduce((s, w) => s + w.amount_received_idr, 0)

  // Hanya G2G pending yang mengurangi saldo (modal sedang dipakai beli)
  // G2G completed masuk g2gBalance (siap tarik), bukan mengurangi saldo
  const pendingG2GBuyCosts = txs
    .filter(t => t.channel === "g2g" && t.status === "pending")
    .reduce((s, t) => s + t.buy_price_idr * t.gold_amount, 0)

  const saldo = initialSaldo + totalDeposits + directProfits + wdReceived - pendingG2GBuyCosts - totalExpenses

  function calcNetPerTx(t: typeof txs[0]) {
    const buyerVat = t.buyer_vat_pct ?? 0
    // Buyer country VAT applies only to commission, not to WD disbursement fee
    const effCommFrac = commPct * (1 + vatPct / 100 + buyerVat / 100) / 100
    return t.sell_price_idr * t.gold_amount * (1 - effCommFrac - effWdFrac)
  }

  // G2G pending = estimasi net dari G2G (belum buyer konfirmasi)
  const floatG2GPending = txs
    .filter(t => t.channel === "g2g" && t.status === "pending")
    .reduce((s, t) => s + calcNetPerTx(t), 0)

  // G2G completed belum withdrawal
  const g2gBalance = txs
    .filter(t => t.channel === "g2g" && t.status === "completed" && !t.withdrawal_id)
    .reduce((s, t) => s + calcNetPerTx(t), 0)

  return { saldo, floatG2GPending, g2gBalance, initialSaldo, totalDeposits, directProfits, wdReceived, pendingG2GBuyCosts, totalExpenses }
}
