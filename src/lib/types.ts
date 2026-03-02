export interface Profile {
  id: string
  email: string
  full_name?: string
  stripe_customer_id?: string
  plan_status: 'free' | 'pro' | 'pro_annual' | 'canceled'
  plan_expires_at?: string
  created_at?: string
}

export interface Account {
  id: string
  user_id: string
  bank_name: string
  type: 'checking' | 'savings' | 'credit' | 'investment'
  balance: number
  currency: string
  pluggy_item_id?: string
  pluggy_account_id?: string
  last_synced_at?: string
  is_active: boolean
  created_at?: string
}

export interface Transaction {
<<<<<<< HEAD
  id: string
  account_id: string
  user_id: string
  description: string
  amount: number
  type: 'debit' | 'credit'
  category?: string
  category_id?: string
  date: string
  balance_after?: number
  currency: string
  payment_method?: string
  pluggy_transaction_id?: string
  is_manual: boolean
  notes?: string
  created_at?: string
=======
  id: string;
  account_id: string;
  user_id: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  category?: string;
  category_id?: string;
  date: string; // ISO date string 'YYYY-MM-DD'
  currency: string;
  payment_method?: string;
  pluggy_transaction_id?: string;
  is_manual: boolean;
  notes?: string;
  created_at?: string;
>>>>>>> origin/main
}

export interface PluggyTransaction {
  id: string
  description: string
  amount: number
  type: 'DEBIT' | 'CREDIT'
  category?: string
  categoryId?: string
  date: string
  balance?: number
  currencyCode?: string
  paymentMethod?: string
  accountId: string
}
