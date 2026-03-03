import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Transaction } from '../../lib/types';

interface ExportOptions {
  startDate?: string;  // 'YYYY-MM-DD'
  endDate?: string;
  accountId?: string;
}

/** Formata valor para padrão BR: -1234.56 → "-1.234,56" */
function formatBRL(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Escapa campos CSV (RFC 4180) */
function escapeCsv(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Gera string CSV otimizada para ferramentas de BI (Looker Studio, Power BI, etc.) */
function generateCsv(transactions: Transaction[]): string {
  const headers = [
    'id',
    'data',
    'descricao',
    'valor_brl',
    'valor_numerico',  // campo numérico puro para cálculos no BI
    'tipo',            // debit | credit
    'categoria',
    'conta_id',
    'metodo_pagamento',
    'origem',          // manual | pluggy
    'notas',
    'created_at',
  ];

  const rows = transactions.map((t) => [
    t.id,
    t.date,
    t.description,
    formatBRL(t.amount),
    t.amount,                              // numérico puro
    t.type,
    t.category ?? '',
    t.account_id,
    t.payment_method ?? '',
    t.is_manual ? 'manual' : 'pluggy',
    t.notes ?? '',
    t.created_at ?? '',
  ]);

  return [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
}

/** Dispara download no browser */
function downloadCsv(content: string, filename: string): void {
  const BOM = '\uFEFF';  // BOM para Excel reconhecer UTF-8 (acentos BR)
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

interface Props extends ExportOptions {
  className?: string;
}

export function ExportButton({ startDate, endDate, accountId, className }: Props) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

      if (startDate)  query = query.gte('date', startDate);
      if (endDate)    query = query.lte('date', endDate);
      if (accountId)  query = query.eq('account_id', accountId);

      const { data, error } = await query;
      if (error) throw error;

      const csv      = generateCsv(data as Transaction[]);
      const filename = `smartmoney_${startDate ?? 'all'}_${endDate ?? 'all'}.csv`;
      downloadCsv(csv, filename);
    } catch (err: any) {
      alert(`Erro ao exportar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className={className ?? 'btn-export'}
    >
      {loading ? 'Exportando...' : '⬇ Exportar CSV'}
    </button>
  );
}
