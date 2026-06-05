export type UserRole = "admin" | "investor"

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface FeeConfig {
  id: string
  seller_rank: string
  commission_pct: number
  vat_pct: number
  withdrawal_method: string
  withdrawal_fee_pct: number
  withdrawal_fee_fixed: number
  currency: string
  is_active: boolean
  updated_at: string
}

export type TransactionChannel = "g2g" | "direct"
export type TransactionStatus = "pending" | "completed" | "cancelled"

export interface Transaction {
  id: string
  created_at: string
  transaction_date: string
  channel: TransactionChannel
  game_name: string
  gold_amount: number
  buy_price_idr: number
  sell_price_idr: number
  commission_fee_pct: number | null
  payment_fee_pct: number | null
  status: TransactionStatus
  settled_at: string | null
  profit_idr: number | null
  notes: string | null
  created_by: string | null
  week_number: number
  withdrawal_id: string | null
  buyer_vat_pct: number | null
}

export interface Withdrawal {
  id: string
  withdrawal_date: string
  amount_idr: number
  withdrawal_fee_pct: number
  withdrawal_fee_fixed_idr: number
  amount_received_idr: number
  notes: string | null
  created_at: string
}

export interface OperationalExpense {
  id: string
  expense_date: string
  category: string
  description: string
  amount_idr: number
  expense_type: "rutin" | "non_rutin"
  week_number: number
  created_at: string
}

export interface CapitalLog {
  id: string
  log_date: string
  type: "topup" | "withdrawal" | "profit_inject" | "expense"
  amount_idr: number
  description: string | null
  balance_after: number
  created_at: string
}
