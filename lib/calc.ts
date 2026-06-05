export interface G2GFeeParams {
  commissionPct: number    // e.g. 7.99
  vatPct: number           // e.g. 11 — applies to BOTH commission AND disbursement fee
  withdrawalFeePct: number // e.g. 2.48 (pre-VAT base rate; VAT applied in deriveCosts)
  withdrawalFeeFixed: number // 0 — no longer used (kept for backward compat)
}

export interface G2GCalcResult {
  effectiveCommPct: number  // commission × (1 + vat) — shown as %
  totalCostPct: number      // effectiveComm + withdrawal%
  commFeePerUnit: number
  withdrawalFeePerUnit: number
  netReceivePerUnit: number
  profitPerUnit: number
  profitPct: number         // profit / sell_price × 100
}

// ─── G2G Per-Transaction (NO fixed fee — that's per withdrawal, not per tx) ──

// Arah 1: Dari harga beli → hitung harga posting minimum G2G
export function calcG2GMinSell(
  buyPrice: number,
  targetMarginPct: number,
  fee: G2GFeeParams
): number & { _result?: G2GCalcResult } {
  const { totalCostPct } = deriveCosts(fee)
  const minSell = Math.ceil(buyPrice * (1 + targetMarginPct / 100) / (1 - totalCostPct / 100))
  return minSell
}

// Arah 2: Dari harga jual → hitung maks beli farmer + breakdown
export function calcG2GFromSell(
  sellPrice: number,
  targetMarginPct: number,
  fee: G2GFeeParams,
  buyOverride?: number  // jika diisi, hitung profit vs harga beli aktual
): G2GCalcResult & { maxBuyPrice: number; minSellPrice: number } {
  const { effectiveCommPct, effectiveWithdrawalPct, totalCostPct } = deriveCosts(fee)
  const netReceivePerUnit = sellPrice * (1 - totalCostPct / 100)
  const maxBuyPrice = Math.floor(netReceivePerUnit / (1 + targetMarginPct / 100))
  const buyPrice = buyOverride ?? maxBuyPrice
  const commFeePerUnit = sellPrice * effectiveCommPct / 100
  const withdrawalFeePerUnit = sellPrice * effectiveWithdrawalPct / 100
  const profitPerUnit = netReceivePerUnit - buyPrice
  const profitPct = profitPerUnit / sellPrice * 100

  return {
    effectiveCommPct,
    totalCostPct,
    commFeePerUnit,
    withdrawalFeePerUnit,
    netReceivePerUnit,
    maxBuyPrice,
    minSellPrice: sellPrice,
    profitPerUnit,
    profitPct,
  }
}

// Helper: derive fee percentages — VAT applies to BOTH commission AND disbursement
function deriveCosts(fee: G2GFeeParams) {
  const effectiveCommPct = fee.commissionPct * (1 + fee.vatPct / 100)
  const effectiveWithdrawalPct = fee.withdrawalFeePct * (1 + fee.vatPct / 100)
  const totalCostPct = effectiveCommPct + effectiveWithdrawalPct
  return { effectiveCommPct, effectiveWithdrawalPct, totalCostPct }
}

// Full breakdown given both buy and sell price
export function calcG2GBreakdown(
  buyPrice: number,
  sellPrice: number,
  fee: G2GFeeParams
): G2GCalcResult & { maxBuyPrice: number; minSellPrice: number } {
  return calcG2GFromSell(sellPrice, 0, fee, buyPrice)
}

// ─── Fixed Fee Withdrawal Planning ───────────────────────────────────────────

export interface WithdrawalPlanResult {
  impactPct: number       // % fixed fee eats from total withdrawal
  isEfficent: boolean     // < 1%
}

export function calcFixedFeeImpact(withdrawalAmount: number, fixedFee: number): WithdrawalPlanResult {
  const impactPct = fixedFee / withdrawalAmount * 100
  return { impactPct, isEfficent: impactPct < 1 }
}

// Berapa minimal tarik agar fixed fee < targetPct
export function calcMinWithdrawalForTarget(targetPct: number, fixedFee: number): number {
  return Math.ceil(fixedFee / (targetPct / 100))
}

// ─── Direct Calculator ────────────────────────────────────────────────────────

export interface DirectCalcResult {
  minSellPrice: number
  maxBuyPrice: number
  paymentFeeAmount: number
  netReceivePerUnit: number
  profitPerUnit: number
  profitPct: number
}

// Arah 1: dari harga beli → harga min tawar ke buyer
export function calcDirectFromBuy(
  buyPrice: number,
  targetMarginPct: number,
  paymentFeePct: number
): DirectCalcResult {
  const feeFrac = paymentFeePct / 100
  const minSellPrice = feeFrac >= 1 ? 0 : Math.ceil(buyPrice * (1 + targetMarginPct / 100) / (1 - feeFrac))
  const paymentFeeAmount = minSellPrice * feeFrac
  const netReceivePerUnit = minSellPrice * (1 - feeFrac)
  const profitPerUnit = netReceivePerUnit - buyPrice
  const profitPct = minSellPrice > 0 ? profitPerUnit / minSellPrice * 100 : 0
  return { minSellPrice, maxBuyPrice: buyPrice, paymentFeeAmount, netReceivePerUnit, profitPerUnit, profitPct }
}

// Arah 2: dari harga tawar buyer → maks beli farmer
export function calcDirectFromOffer(
  offerPrice: number,
  targetMarginPct: number,
  paymentFeePct: number
): DirectCalcResult {
  const feeFrac = paymentFeePct / 100
  const netReceivePerUnit = offerPrice * (1 - feeFrac)
  const maxBuyPrice = Math.floor(netReceivePerUnit / (1 + targetMarginPct / 100))
  const paymentFeeAmount = offerPrice * feeFrac
  const profitPerUnit = netReceivePerUnit - maxBuyPrice
  const profitPct = offerPrice > 0 ? profitPerUnit / offerPrice * 100 : 0
  return { minSellPrice: offerPrice, maxBuyPrice, paymentFeeAmount, netReceivePerUnit, profitPerUnit, profitPct }
}

// ─── Profit Sharing ───────────────────────────────────────────────────────────

export function calcProfitSharing(
  totalProfit: number,
  totalExpenses: number,
  opsPct: number,
  investorCount: number
) {
  const profitAfterExpenses = totalProfit - totalExpenses
  const opsShare = profitAfterExpenses * (opsPct / 100)
  const investorTotal = profitAfterExpenses - opsShare
  const perInvestor = investorCount > 0 ? investorTotal / investorCount : 0
  return { profitAfterExpenses, opsShare, investorTotal, perInvestor }
}
