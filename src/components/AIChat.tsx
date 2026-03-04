// AIChat.tsx — Assistente financeiro IA flutuante
// Lógica: Bot Procedural responde tudo que sabe com dados reais → Groq só para perguntas abertas

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  X, Send, Sparkles, TrendingDown, PieChart as PieIcon,
  Calendar, AlertCircle, Lightbulb, ChevronDown, BarChart2,
  Zap, WifiOff, RefreshCw, Bot,
} from 'lucide-react'
import { useResponsive } from '../hooks/useResponsive'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#06080F', card: '#0B1120', card2: '#0F1729',
  border: 'rgba(255,255,255,0.06)', borderStrong: 'rgba(255,255,255,0.10)',
  accent: '#00E5A0', accentBlue: '#3B8BF5',
  text: '#E8EFF8', textMuted: '#4A5878', textSub: '#8899B4',
  red: '#F2545B', yellow: '#F5A623', purple: '#A78BFA',
}
const CHART_COLORS = ['#00E5A0','#3B8BF5','#F5A623','#F2545B','#A78BFA','#06B6D4','#F472B6','#34D399']

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface Transaction {
  id: string
  description: string
  amount: number
  type: 'credit' | 'debit'
  category: string
  date: string
  account_id?: string
}

export interface Account {
  id: string
  name: string
  balance: number
  type: string
  is_active: boolean
}

export interface Category {
  id: string
  name: string
  budget?: number
  color?: string
}

export interface FinancialContext {
  transactions: Transaction[]
  accounts: Account[]
  categories: Category[]
  totalIncome: number
  totalExpenses: number
  balance: number
  currentMonth: string
  historicalMonths?: { month: string; income: number; expenses: number }[]
}

interface AIChatProps {
  financialContext?: FinancialContext
}

// ─── Sugestoes ────────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { icon: TrendingDown, label: 'Onde estou gastando mais?',    prompt: 'Onde estou gastando mais?' },
  { icon: PieIcon,      label: 'Como esta meu orcamento?',     prompt: 'Como esta meu orcamento?' },
  { icon: AlertCircle,  label: 'Tenho gastos incomuns?',       prompt: 'Tenho gastos incomuns?' },
  { icon: Calendar,     label: 'Projecao ate o fim do mes',    prompt: 'Qual a projecao de gastos ate o fim do mes?' },
  { icon: Lightbulb,    label: 'Dicas para economizar',        prompt: 'Me de dicas para economizar.' },
  { icon: Sparkles,     label: 'Analisar assinaturas',         prompt: 'Analise minhas assinaturas e gastos recorrentes.' },
  { icon: BarChart2,    label: 'Evolucao dos meus gastos',     prompt: 'Mostre a evolucao dos meus gastos nos ultimos meses.' },
]

// ─── Tipos internos ───────────────────────────────────────────────────────────
interface ChartDataPoint { label: string; value: number; color?: string }
interface ChartBlock { type: 'bar'|'pie'|'donut'|'line'; title: string; data: ChartDataPoint[]; unit?: string }
interface Message { role: 'user'|'assistant'; content: string; charts?: ChartBlock[]; ts: number; provider?: 'groq'|'procedural'; isError?: boolean }
interface BotResult { text: string; charts?: ChartBlock[]; matched: boolean }

// ─── Bot Procedural — responde com dados reais, sem depender de LLM ──────────
function proceduralBot(msg: string, ctx?: FinancialContext): BotResult {
  const lower = msg.toLowerCase()
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  if (!ctx) {
    return { matched: true, text: `## Sem dados\n\nO assistente ainda nao recebeu dados do dashboard. Abra o dashboard e tente novamente.` }
  }

  const { totalIncome, totalExpenses, balance, transactions, accounts, currentMonth } = ctx

  const catMap: Record<string, number> = {}
  transactions.filter(t => t.type === 'debit').forEach(t => {
    const c = t.category || 'Outros'
    catMap[c] = (catMap[c] ?? 0) + Math.abs(Number(t.amount))
  })
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1])

  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysPassed = now.getDate()
  const dailyAvg = daysPassed > 0 ? totalExpenses / daysPassed : 0

  // ── Saldo / conta ──
  if (lower.includes('saldo') || lower.includes('conta') || lower.includes('disponivel') || lower.includes('tenho') || lower.includes('disponível')) {
    const activeAccs = accounts.filter(a => a.is_active)
    const accLines = activeAccs.length > 0
      ? activeAccs.map(a => `- **${a.name}** (${a.type}): ${fmt(Number(a.balance))}`).join('\n')
      : '_Nenhuma conta conectada_'
    return {
      matched: true,
      text: `## Saldo — ${currentMonth}\n\n**Saldo do periodo:** ${fmt(balance)}\n**Receitas:** ${fmt(totalIncome)}\n**Despesas:** ${fmt(totalExpenses)}\n\n### Saldo por Conta\n${accLines}`,
    }
  }

  // Sem transacoes
  if (transactions.length === 0) {
    const activeAccs = accounts.filter(a => a.is_active)
    const accLines = activeAccs.length > 0
      ? activeAccs.map(a => `- **${a.name}**: ${fmt(Number(a.balance))}`).join('\n')
      : '_Nenhuma conta conectada_'
    return {
      matched: true,
      text: `## Sem transacoes em "${currentMonth}"\n\nNao ha transacoes registradas neste periodo. Tente selecionar outro periodo no dashboard.\n\n### Contas conectadas\n${accLines}`,
    }
  }

  // ── Gastos / categorias / onde ──
  if (lower.includes('gast') || lower.includes('categor') || lower.includes('despesa') || lower.includes('onde')) {
    const chartData = topCats.slice(0, 8).map(([label, value], i) => ({ label, value, color: CHART_COLORS[i] }))
    const topCat = topCats[0]
    if (!topCat) return { matched: true, text: `## Gastos — ${currentMonth}\n\nNenhuma despesa registrada no periodo.` }
    const pctTop = totalExpenses > 0 ? Math.round((topCat[1] / totalExpenses) * 100) : 0
    const top3pct = totalExpenses > 0 ? Math.round(topCats.slice(0, 3).reduce((s, [, v]) => s + v, 0) / totalExpenses * 100) : 0
    return {
      matched: true,
      text: `## Gastos por Categoria — ${currentMonth}\n\n- **Total de despesas:** ${fmt(totalExpenses)}\n- **Receitas:** ${fmt(totalIncome)}\n- **Saldo:** ${fmt(balance)}\n\n**Maior gasto:** ${topCat[0]} com ${fmt(topCat[1])} (${pctTop}% das despesas).\n${topCats.length > 2 ? `As top 3 categorias concentram **${top3pct}%** dos seus gastos.` : ''}`,
      charts: chartData.length ? [{ type: 'bar' as const, title: 'Gastos por Categoria', data: chartData, unit: 'BRL' }] : undefined,
    }
  }

  // ── Orcamento / resumo ──
  if (lower.includes('or') && (lower.includes('amento') || lower.includes('çamento')) || lower.includes('resumo') || lower.includes('situac')) {
    const pieData = topCats.slice(0, 6).map(([label, value], i) => ({ label, value, color: CHART_COLORS[i] }))
    const isNeg = balance < 0
    const savingsRate = totalIncome > 0 ? Math.round((balance / totalIncome) * 100) : 0
    const accLine = accounts.filter(a => a.is_active).map(a => `${a.name}: ${fmt(Number(a.balance))}`).join(' · ')
    return {
      matched: true,
      text: `## Resumo do Orcamento — ${currentMonth}\n\n- **Receitas:** ${fmt(totalIncome)}\n- **Despesas:** ${fmt(totalExpenses)}\n- **Saldo:** ${fmt(balance)}\n- **Taxa de poupanca:** ${savingsRate}%\n\n${isNeg ? 'Atencao: Seus gastos estao superando as receitas.' : savingsRate >= 20 ? 'Parabens! Voce esta poupando mais de 20% da renda.' : 'Meta: poupar pelo menos 20% da renda mensal.'}\n\n${accLine ? `**Saldo nas contas:** ${accLine}` : ''}`,
      charts: pieData.length ? [{ type: 'donut' as const, title: 'Distribuicao de Despesas', data: pieData, unit: 'BRL' }] : undefined,
    }
  }

  // ── Projecao ──
  if (lower.includes('projec') || lower.includes('projeç') || lower.includes('fim do m') || lower.includes('fim mes') || lower.includes('proximos') || lower.includes('próximos')) {
    if ((lower.includes('6') || lower.includes('seis') || lower.includes('meses')) && ctx.historicalMonths?.length) {
      const hist = ctx.historicalMonths
      const avgExpHist = hist.reduce((s, h) => s + h.expenses, 0) / hist.length
      const avgIncHist = hist.reduce((s, h) => s + h.income, 0) / hist.length
      const chartData = hist.map((h, i) => ({ label: h.month, value: h.expenses, color: CHART_COLORS[i % CHART_COLORS.length] }))
      return {
        matched: true,
        text: `## Projecao — Historico e Tendencia\n\n**Media mensal de despesas:** ${fmt(avgExpHist)}\n**Media mensal de receitas:** ${fmt(avgIncHist)}\n**Saldo medio projetado/mes:** ${fmt(avgIncHist - avgExpHist)}\n\n### Historico mensal\n${hist.map(h => `- **${h.month}:** receitas ${fmt(h.income)} · despesas ${fmt(h.expenses)} · saldo ${fmt(h.income - h.expenses)}`).join('\n')}`,
        charts: [{ type: 'line' as const, title: 'Despesas Mensais', data: chartData, unit: 'BRL' }],
      }
    }
    const remaining = daysInMonth - daysPassed
    const projectedRemaining = dailyAvg * remaining
    const projectedTotal = dailyAvg * daysInMonth
    const willSave = totalIncome - projectedTotal
    return {
      matched: true,
      text: `## Projecao para o Fim do Mes\n\n- **Dias passados:** ${daysPassed} de ${daysInMonth}\n- **Despesas ate agora:** ${fmt(totalExpenses)}\n- **Media diaria:** ${fmt(dailyAvg)}\n- **Dias restantes:** ${remaining}\n- **Estimativa restante:** ${fmt(projectedRemaining)}\n- **Projecao total:** ${fmt(projectedTotal)}\n- **Saldo projetado:** ${fmt(willSave)}\n\n${willSave < 0 ? `Na tendencia atual, voce vai gastar mais do que ganha. Reduza os gastos nos proximos ${remaining} dias.` : `Na tendencia atual, voce deve economizar ${fmt(willSave)} este mes.`}`,
    }
  }

  // ── Gastos incomuns ──
  if (lower.includes('incomum') || lower.includes('anomali') || lower.includes('estranho') || lower.includes('padrao') || lower.includes('padrão')) {
    const debits = transactions.filter(t => t.type === 'debit').sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)))
    const avgTx = totalExpenses / (debits.length || 1)
    const unusual = debits.filter(t => Math.abs(Number(t.amount)) > avgTx * 3).slice(0, 5)
    const top3 = debits.slice(0, 3)
    return {
      matched: true,
      text: `## Gastos Fora do Padrao — ${currentMonth}\n\n**Valor medio por transacao:** ${fmt(avgTx)}\n\n${unusual.length > 0
        ? `**Transacoes acima de 3x a media:**\n${unusual.map(t => `- **${t.description}:** ${fmt(Math.abs(Number(t.amount)))} em ${new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR')}`).join('\n')}`
        : 'Nenhuma transacao muito fora do padrao identificada.'
      }\n\n**Top 3 maiores gastos:**\n${top3.map((t, i) => `${i + 1}. ${t.description}: ${fmt(Math.abs(Number(t.amount)))}`).join('\n')}`,
    }
  }

  // ── Economizar / dicas ──
  if (lower.includes('economiz') || lower.includes('poupar') || lower.includes('reduzir') || lower.includes('dica') || lower.includes('conselho')) {
    const biggestCat = topCats[0]
    const descCount: Record<string, number> = {}
    transactions.forEach(t => { descCount[t.description] = (descCount[t.description] ?? 0) + 1 })
    const recurring = Object.entries(descCount).filter(([, n]) => n >= 2)
    const small = topCats.filter(([, v]) => v < totalExpenses * 0.05)
    return {
      matched: true,
      text: `## Dicas para Economizar — ${currentMonth}\n\n**1. Reduza em ${biggestCat?.[0] ?? 'sua maior categoria'}**\nEla representa ${biggestCat ? Math.round(biggestCat[1] / totalExpenses * 100) : '?'}% dos seus gastos (${biggestCat ? fmt(biggestCat[1]) : 'N/A'}). Cortar 20% aqui economiza ${biggestCat ? fmt(biggestCat[1] * 0.2) : 'N/A'}/mes.\n\n**2. Revise assinaturas**\n${recurring.length > 0 ? `Identifiquei ${recurring.length} pagamentos recorrentes: ${recurring.slice(0, 4).map(([d]) => d).join(', ')}.` : 'Sem padrao recorrente claro no periodo.'}\n\n**3. Pequenos gastos acumulam**\n${small.length > 0 ? `Voce tem ${small.length} categorias menores somando ${fmt(small.reduce((s, [, v]) => s + v, 0))}/mes.` : 'Analise gastos frequentes de baixo valor.'}\n\n**Meta:** economizar ${fmt(totalExpenses * 0.1)} neste mes (10% das despesas atuais).`,
    }
  }

  // ── Assinaturas ──
  if (lower.includes('assina') || lower.includes('recorrent') || lower.includes('mensalidade')) {
    const descMap: Record<string, { count: number; total: number }> = {}
    transactions.filter(t => t.type === 'debit').forEach(t => {
      if (!descMap[t.description]) descMap[t.description] = { count: 0, total: 0 }
      descMap[t.description].count++
      descMap[t.description].total += Math.abs(Number(t.amount))
    })
    const recurring = Object.entries(descMap).filter(([, v]) => v.count >= 2).sort((a, b) => b[1].total - a[1].total)
    if (recurring.length === 0) return { matched: true, text: `## Assinaturas — ${currentMonth}\n\nNenhum gasto recorrente identificado no periodo atual.\n\nCom mais historico, consigo mapear suas assinaturas automaticamente.` }
    const totalRec = recurring.reduce((s, [, v]) => s + v.total, 0)
    return {
      matched: true,
      text: `## Assinaturas Identificadas — ${currentMonth}\n\n**Total em recorrentes: ${fmt(totalRec)}**\n\n${recurring.slice(0, 8).map(([desc, v]) => `- **${desc}:** ~${fmt(v.total / v.count)}/mes (${v.count}x detectado)`).join('\n')}\n\nRevise cada uma e cancele o que nao usa.`,
    }
  }

  // ── Evolucao / historico ──
  if (lower.includes('evolu') || lower.includes('historic') || lower.includes('meses anteriores') || lower.includes('ultimos meses')) {
    if (ctx.historicalMonths?.length) {
      const chartData = ctx.historicalMonths.map((h, i) => ({ label: h.month, value: h.expenses, color: CHART_COLORS[i % CHART_COLORS.length] }))
      const trend = ctx.historicalMonths.length >= 2
        ? ctx.historicalMonths[ctx.historicalMonths.length - 1].expenses - ctx.historicalMonths[0].expenses
        : 0
      return {
        matched: true,
        text: `## Evolucao de Gastos\n\n${ctx.historicalMonths.map(h => `- **${h.month}:** ${fmt(h.expenses)} despesas · ${fmt(h.income)} receitas`).join('\n')}\n\n${trend > 0 ? `Tendencia de aumento: +${fmt(trend)} vs. inicio.` : `Tendencia de reducao: ${fmt(Math.abs(trend))} a menos vs. inicio.`}`,
        charts: [{ type: 'line' as const, title: 'Despesas Mensais', data: chartData, unit: 'BRL' }],
      }
    }
    return { matched: true, text: `## Historico\n\nNao ha dados historicos disponiveis ainda.` }
  }

  // ── Nao reconhecido → passa para Groq ──
  return {
    matched: false,
    text: `## Resumo Rapido — ${currentMonth}\n\n- **Receitas:** ${fmt(totalIncome)}\n- **Despesas:** ${fmt(totalExpenses)}\n- **Saldo:** ${fmt(balance)}\n\nPosso responder sobre: saldo, gastos por categoria, orcamento, projecoes, dicas para economizar, assinaturas e evolucao historica.`,
  }
}

// ─── Groq API — so chamado para perguntas abertas ─────────────────────────────
async function callGroq(msg: string, ctx: FinancialContext): Promise<string> {
  const key = import.meta.env.VITE_GROQ_KEY as string | undefined
  if (!key) throw new Error('VITE_GROQ_KEY nao definida')

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const catMap: Record<string, number> = {}
  ctx.transactions.filter(t => t.type === 'debit').forEach(t => {
    const c = t.category || 'Outros'
    catMap[c] = (catMap[c] ?? 0) + Math.abs(Number(t.amount))
  })
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 8)

  const dataBlock = `DADOS FINANCEIROS DO USUARIO (periodo: ${ctx.currentMonth}):
RECEITAS: ${fmt(ctx.totalIncome)} | DESPESAS: ${fmt(ctx.totalExpenses)} | SALDO: ${fmt(ctx.balance)}
TRANSACOES: ${ctx.transactions.length} (${ctx.transactions.filter(t => t.type === 'credit').length} creditos, ${ctx.transactions.filter(t => t.type === 'debit').length} debitos)
CONTAS: ${ctx.accounts.filter(a => a.is_active).map(a => `${a.name}=${fmt(Number(a.balance))}`).join(', ') || 'nenhuma'}
CATEGORIAS DE GASTO: ${topCats.map(([c, v]) => `${c}=${fmt(v)}`).join(', ') || 'nenhuma'}
${ctx.historicalMonths?.length ? `HISTORICO: ${ctx.historicalMonths.map(h => `${h.month}: rec=${fmt(h.income)} desp=${fmt(h.expenses)}`).join(' | ')}` : ''}`

  const SYSTEM = `Voce e o assistente financeiro do SmartMoney. Responda em portugues brasileiro, de forma direta.
USE APENAS os numeros dos dados abaixo. NUNCA invente valores.
${dataBlock}
Para graficos use este formato em bloco de codigo "chart":
\`\`\`chart
{"type":"bar","title":"Titulo","data":[{"label":"Nome","value":1234.56}],"unit":"BRL"}
\`\`\`
Tipos: bar, pie, donut, line. Unit: BRL ou %.`

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      temperature: 0.1,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: msg },
      ],
    }),
  })

  if (res.status === 429) throw Object.assign(new Error('rate_limit'), { code: 429 })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Groq ${res.status}: ${(err as any)?.error?.message ?? 'erro'}`)
  }
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Groq: resposta vazia')
  return text
}

// ─── Extrai blocos chart ──────────────────────────────────────────────────────
function extractCharts(raw: string): { text: string; charts: ChartBlock[] } {
  const charts: ChartBlock[] = []
  const text = raw.replace(/```chart\n([\s\S]*?)```/g, (_, json) => {
    try {
      const parsed = JSON.parse(json.trim()) as ChartBlock
      if (parsed?.data?.length) charts.push(parsed)
    } catch { /* JSON invalido */ }
    return ''
  }).replace(/\n{3,}/g, '\n\n').trim()
  return { text, charts }
}

// ─── Graficos ─────────────────────────────────────────────────────────────────
const fmtVal = (v: number, unit?: string) => {
  if (unit === 'BRL') return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  if (unit === '%') return `${v.toFixed(1)}%`
  return v.toLocaleString('pt-BR')
}

function BarChart({ chart }: { chart: ChartBlock }) {
  const max = Math.max(...chart.data.map(d => d.value), 1)
  return (
    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: '14px 16px', border: `1px solid ${C.border}`, marginTop: 8 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 11 }}>{chart.title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {chart.data.map((item, i) => {
          const pct = (item.value / max) * 100
          const color = item.color || CHART_COLORS[i % CHART_COLORS.length]
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: C.textSub, width: 76, textAlign: 'right', flexShrink: 0, lineHeight: 1.2 }}>{item.label}</span>
              <div style={{ flex: 1, height: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg,${color}aa,${color})`, borderRadius: 5, animation: 'barGrow 1s cubic-bezier(0.4,0,0.2,1)' }} />
              </div>
              <span style={{ fontSize: 10, color: C.text, width: 68, flexShrink: 0, textAlign: 'right' }}>{fmtVal(item.value, chart.unit)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PieChart({ chart }: { chart: ChartBlock }) {
  const isDonut = chart.type === 'donut'
  const total = chart.data.reduce((s, d) => s + d.value, 0) || 1
  const cx = 60, cy = 60, r = 55
  const toXY = (deg: number, radius = r) => ({ x: cx + radius * Math.cos((deg - 90) * Math.PI / 180), y: cy + radius * Math.sin((deg - 90) * Math.PI / 180) })
  let cum = 0
  const slices = chart.data.map((item, i) => {
    const start = cum, sweep = (item.value / total) * 360; cum += sweep
    const s = toXY(start), e = toXY(start + sweep), large = sweep > 180 ? 1 : 0
    return { ...item, path: `M${cx} ${cy} L${s.x} ${s.y} A${r} ${r} 0 ${large} 1 ${e.x} ${e.y}Z`, color: item.color || CHART_COLORS[i % CHART_COLORS.length], sweep }
  })
  return (
    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: '14px 16px', border: `1px solid ${C.border}`, marginTop: 8 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 11 }}>{chart.title}</p>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <svg width={120} height={120} viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
          {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} />)}
          {isDonut && <circle cx={cx} cy={cy} r={32} fill={C.card} />}
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
          {slices.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: C.textSub, flex: 1, lineHeight: 1.3 }}>{s.label}</span>
              <span style={{ fontSize: 10, color: C.text, flexShrink: 0, fontWeight: 600 }}>{Math.round(s.value / total * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function LineChart({ chart }: { chart: ChartBlock }) {
  const W = 280, H = 90, pL = 10, pR = 10, pT = 10, pB = 22
  const vals = chart.data.map(d => d.value)
  const min = Math.min(...vals), max = Math.max(...vals, min + 1)
  const toX = (i: number) => pL + (i / (chart.data.length - 1 || 1)) * (W - pL - pR)
  const toY = (v: number) => pT + (1 - (v - min) / (max - min)) * (H - pT - pB)
  const pts = chart.data.map((d, i) => `${toX(i)},${toY(d.value)}`).join(' ')
  const area = `M${toX(0)},${H - pB} ${chart.data.map((d, i) => `L${toX(i)},${toY(d.value)}`).join(' ')} L${toX(chart.data.length - 1)},${H - pB}Z`
  return (
    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: '14px 16px', border: `1px solid ${C.border}`, marginTop: 8 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{chart.title}</p>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity="0.25" /><stop offset="100%" stopColor={C.accent} stopOpacity="0" /></linearGradient></defs>
        <path d={area} fill="url(#lg)" />
        <polyline points={pts} fill="none" stroke={C.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {chart.data.map((d, i) => (
          <g key={i}><circle cx={toX(i)} cy={toY(d.value)} r={3} fill={C.accent} /><text x={toX(i)} y={H - 4} textAnchor="middle" fontSize={8} fill={C.textMuted}>{d.label}</text></g>
        ))}
      </svg>
    </div>
  )
}

function ChartRenderer({ chart }: { chart: ChartBlock }) {
  if (chart.type === 'bar') return <BarChart chart={chart} />
  if (chart.type === 'pie' || chart.type === 'donut') return <PieChart chart={chart} />
  if (chart.type === 'line') return <LineChart chart={chart} />
  return null
}

// ─── Renderiza markdown ───────────────────────────────────────────────────────
function FormatMsg({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {text.split('\n').map((line, i) => {
        if (line.startsWith('## ')) return <p key={i} style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '6px 0 3px' }}>{line.slice(3)}</p>
        if (line.startsWith('### ')) return <p key={i} style={{ fontSize: 12, fontWeight: 700, color: C.accent, margin: '4px 0 2px' }}>{line.slice(4)}</p>
        if (/^(- |\u2022 )/.test(line)) return (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <span style={{ color: C.accent, fontSize: 10, marginTop: 4, flexShrink: 0 }}>▸</span>
            <p style={{ fontSize: 13, color: C.text, lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong style="color:#E8EFF8">$1</strong>') }} />
          </div>
        )
        if (/^\d+\./.test(line)) return (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ color: C.accent, fontSize: 10, marginTop: 4, flexShrink: 0, fontWeight: 700, minWidth: 14 }}>{line.match(/^\d+/)?.[0]}.</span>
            <p style={{ fontSize: 13, color: C.text, lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: line.replace(/^\d+\.\s*/, '').replace(/\*\*(.+?)\*\*/g, '<strong style="color:#E8EFF8">$1</strong>') }} />
          </div>
        )
        if (line.startsWith('> ')) return <div key={i} style={{ borderLeft: `2px solid ${C.accent}`, paddingLeft: 10 }}><p style={{ fontSize: 12, color: C.textSub, fontStyle: 'italic', lineHeight: 1.6 }}>{line.slice(2)}</p></div>
        if (line.trim() === '') return <div key={i} style={{ height: 4 }} />
        return <p key={i} style={{ fontSize: 13, color: '#C8D8E8', lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#E8EFF8">$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>') }} />
      })}
    </div>
  )
}

// ─── Status bar ───────────────────────────────────────────────────────────────
function ContextStatusBar({ ctx }: { ctx?: FinancialContext }) {
  if (!ctx) return null
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const isPos = ctx.balance >= 0
  return (
    <div style={{ display: 'flex', gap: 6, padding: '8px 14px', borderBottom: `1px solid ${C.border}`, background: 'rgba(0,0,0,0.2)', flexShrink: 0, overflowX: 'auto' }}>
      {([
        { label: 'Receitas', value: ctx.totalIncome, color: '#00E5A0' },
        { label: 'Despesas', value: ctx.totalExpenses, color: '#F2545B' },
        { label: 'Saldo', value: ctx.balance, color: isPos ? '#00E5A0' : '#F2545B' },
      ] as const).map(item => (
        <div key={item.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, padding: '4px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: `1px solid ${C.border}`, flexShrink: 0 }}>
          <span style={{ fontSize: 9, color: C.textMuted }}>{item.label}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: item.color }}>{fmt(item.value)}</span>
        </div>
      ))}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, padding: '4px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: `1px solid ${C.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: 9, color: C.textMuted }}>Transacoes</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{ctx.transactions.length}</span>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function AIChat({ financialContext }: AIChatProps) {
  const { isMobile } = useResponsive()
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pulse, setPulse] = useState(true)
  const [unread, setUnread] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const lastMsg = useRef('')

  const ctxRef = useRef(financialContext)
  useEffect(() => { ctxRef.current = financialContext }, [financialContext])

  const msgsRef = useRef<Message[]>([])
  useEffect(() => { msgsRef.current = msgs }, [msgs])

  useEffect(() => { if (open) { setUnread(0); setPulse(false) } }, [open])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, loading])
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px'
    }
  }, [input])

  const sendMessage = useCallback(async (text: string) => {
    const msg = text.trim()
    if (!msg || loading) return
    setInput(''); setLoading(true); lastMsg.current = msg
    setMsgs(prev => [...prev, { role: 'user', content: msg, ts: Date.now() }])

    try {
      let finalText = '', charts: ChartBlock[] = [], provider: 'groq' | 'procedural' = 'procedural'

      // 1. Bot procedural primeiro — dados reais, sem alucinacao
      const procResult = proceduralBot(msg, ctxRef.current)

      if (procResult.matched) {
        const ex = extractCharts(procResult.text)
        finalText = ex.text
        charts = [...(procResult.charts ?? []), ...ex.charts]
        provider = 'procedural'
      } else {
        // 2. Pergunta aberta → Groq com dados no system prompt
        try {
          const ctx = ctxRef.current
          if (!ctx) throw new Error('sem contexto')
          const raw = await callGroq(msg, ctx)
          const ex = extractCharts(raw)
          finalText = ex.text; charts = ex.charts; provider = 'groq'
        } catch (err: any) {
          console.warn('[AIChat] Groq falhou:', err?.message)
          const ex = extractCharts(procResult.text)
          finalText = ex.text
          charts = [...(procResult.charts ?? []), ...ex.charts]
          provider = 'procedural'
        }
      }

      setMsgs(prev => [...prev, { role: 'assistant', content: finalText, charts, provider, ts: Date.now() }])
      if (!open) setUnread(u => u + 1)
    } catch {
      setMsgs(prev => [...prev, { role: 'assistant', content: 'Erro inesperado. Tente novamente.', isError: true, ts: Date.now() }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [loading, open])

  const retryLast = () => { if (!lastMsg.current || loading) return; setMsgs(prev => prev.slice(0, -1)); sendMessage(lastMsg.current) }
  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }

  const isEmpty = msgs.length === 0
  const hasCtx = !!financialContext && (financialContext.transactions.length > 0 || financialContext.accounts.length > 0)
  const btnBottom = isMobile ? 80 : 28
  const panelBottom = isMobile ? 80 : 84
  const panelRight = isMobile ? 8 : 28
  const panelW = isMobile ? 'calc(100vw - 16px)' : '430px'
  const panelH = isMobile ? 'calc(100vh - 160px)' : '620px'

  return (
    <>
      {open && (
        <div style={{ position: 'fixed', bottom: panelBottom, right: panelRight, width: panelW, height: panelH, zIndex: 1000, background: 'linear-gradient(160deg,#0D1526 0%,#0B1120 60%,#080E1C 100%)', border: `1px solid ${C.borderStrong}`, borderRadius: 22, display: 'flex', flexDirection: 'column', boxShadow: '0 40px 100px rgba(0,0,0,0.85),0 0 0 1px rgba(0,229,160,0.07),inset 0 1px 0 rgba(255,255,255,0.04)', animation: 'chatSlideUp 0.28s cubic-bezier(0.34,1.56,0.64,1)', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, background: 'linear-gradient(90deg,rgba(0,229,160,0.05) 0%,transparent 100%)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#00E5A0,#0088FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 16px rgba(0,229,160,0.3)' }}>
              <Sparkles size={17} style={{ color: '#fff' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Assistente SmartMoney</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: hasCtx ? C.accent : C.yellow, boxShadow: `0 0 6px ${hasCtx ? C.accent : C.yellow}` }} />
                <p style={{ fontSize: 10, color: C.textMuted }}>
                  {loading ? 'Analisando seus dados…' : hasCtx ? `${financialContext!.transactions.length} transacoes · ${financialContext!.currentMonth}` : 'Aguardando dados do dashboard'}
                </p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = C.text }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = C.textMuted }}>
              <ChevronDown size={16} />
            </button>
          </div>

          <ContextStatusBar ctx={financialContext} />

          {/* Mensagens */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 8px', display: 'flex', flexDirection: 'column', gap: 14, scrollbarWidth: 'thin', scrollbarColor: `${C.border} transparent` }}>
            {isEmpty && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ textAlign: 'center', padding: '6px 8px 10px' }}>
                  <div style={{ width: 50, height: 50, borderRadius: 16, background: 'linear-gradient(135deg,rgba(0,229,160,0.12),rgba(0,136,255,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', border: '1px solid rgba(0,229,160,0.15)', boxShadow: '0 0 24px rgba(0,229,160,0.08)' }}>
                    <Sparkles size={22} style={{ color: C.accent }} />
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 5 }}>Como posso te ajudar?</p>
                  <p style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.6 }}>
                    {hasCtx ? `Tenho acesso as suas ${financialContext!.transactions.length} transacoes de ${financialContext!.currentMonth}.` : 'Conecte-se ao dashboard para analises personalizadas.'}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Sugestoes</p>
                  {SUGGESTIONS.map(s => {
                    const Icon = s.icon
                    return (
                      <button key={s.label} onClick={() => sendMessage(s.prompt)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', color: C.textSub, fontSize: 12 }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,160,0.06)'; e.currentTarget.style.borderColor = 'rgba(0,229,160,0.2)'; e.currentTarget.style.color = C.text }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub }}>
                        <Icon size={13} style={{ color: C.accent, flexShrink: 0 }} />{s.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 4 }}>
                {m.role === 'assistant' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 2 }}>
                    <div style={{ width: 17, height: 17, borderRadius: 5, background: 'linear-gradient(135deg,#00E5A0,#0088FF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {m.provider === 'procedural' ? <Bot size={9} style={{ color: '#fff' }} /> : <Sparkles size={9} style={{ color: '#fff' }} />}
                    </div>
                    <span style={{ fontSize: 9, color: C.textMuted }}>Assistente</span>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 20, background: m.provider === 'groq' ? 'rgba(0,229,160,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${m.provider === 'groq' ? 'rgba(0,229,160,0.22)' : C.border}` }}>
                      {m.provider === 'groq' ? <Zap size={8} style={{ color: C.accent }} /> : <WifiOff size={8} style={{ color: C.textSub }} />}
                      <span style={{ fontSize: 9, color: m.provider === 'groq' ? C.accent : C.textSub, fontWeight: 600 }}>{m.provider === 'groq' ? 'Groq · Llama 3.3' : 'SmartMoney'}</span>
                    </div>
                  </div>
                )}
                <div style={{ maxWidth: '92%', padding: '10px 14px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '4px 14px 14px 14px', background: m.role === 'user' ? 'linear-gradient(135deg,rgba(0,229,160,0.15),rgba(0,136,255,0.09))' : m.isError ? 'rgba(242,84,91,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${m.role === 'user' ? 'rgba(0,229,160,0.2)' : m.isError ? 'rgba(242,84,91,0.25)' : C.border}` }}>
                  {m.role === 'user'
                    ? <p style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{m.content}</p>
                    : <>
                      <FormatMsg text={m.content} />
                      {m.charts?.map((chart, ci) => <ChartRenderer key={ci} chart={chart} />)}
                      {m.isError && <button onClick={retryLast} style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 8, cursor: 'pointer', color: C.accent, fontSize: 11 }}><RefreshCw size={10} /> Tentar novamente</button>}
                    </>
                  }
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ width: 17, height: 17, borderRadius: 5, background: 'linear-gradient(135deg,#00E5A0,#0088FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 8 }}><Sparkles size={9} style={{ color: '#fff' }} /></div>
                <div style={{ padding: '11px 16px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: '4px 14px 14px 14px', display: 'flex', gap: 5, alignItems: 'center' }}>
                  {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: C.accent, animation: `dotBounce 1.2s ease-in-out ${i * 0.18}s infinite` }} />)}
                </div>
              </div>
            )}

            {!isEmpty && !loading && msgs[msgs.length - 1]?.role === 'assistant' && !msgs[msgs.length - 1]?.isError && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                {SUGGESTIONS.slice(0, 3).map(s => (
                  <button key={s.label} onClick={() => sendMessage(s.prompt)} style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 20, cursor: 'pointer', color: C.textMuted, fontSize: 11, transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,229,160,0.3)'; e.currentTarget.style.color = C.accent }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMuted }}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px 12px', borderTop: `1px solid ${C.border}`, background: 'rgba(6,8,15,0.6)', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 13, padding: '8px 10px', transition: 'border-color 0.15s' }}
              onFocusCapture={e => (e.currentTarget.style.borderColor = 'rgba(0,229,160,0.3)')}
              onBlurCapture={e => (e.currentTarget.style.borderColor = C.border)}>
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} placeholder="Pergunte sobre seus gastos…" rows={1}
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: 13, resize: 'none', lineHeight: 1.5, maxHeight: 120, fontFamily: 'system-ui,sans-serif', scrollbarWidth: 'none' }} />
              <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}
                style={{ width: 32, height: 32, borderRadius: 9, border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', background: input.trim() && !loading ? C.accent : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                <Send size={13} style={{ color: input.trim() && !loading ? '#06080F' : C.textMuted }} />
              </button>
            </div>
            <p style={{ fontSize: 10, color: C.textMuted, textAlign: 'center', marginTop: 5 }}>Enter para enviar · Shift+Enter para nova linha</p>
          </div>
        </div>
      )}

      {/* Botao flutuante */}
      <button onClick={() => setOpen(o => !o)} title="Assistente Financeiro IA"
        style={{ position: 'fixed', bottom: btnBottom, right: isMobile ? 16 : 28, zIndex: 999, width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer', background: open ? 'linear-gradient(135deg,#0088FF,#00E5A0)' : 'linear-gradient(135deg,#00E5A0,#0088FF)', boxShadow: open ? '0 8px 32px rgba(0,136,255,0.5),0 0 0 4px rgba(0,229,160,0.12)' : pulse ? '0 8px 32px rgba(0,229,160,0.45),0 0 0 8px rgba(0,229,160,0.1)' : '0 8px 24px rgba(0,229,160,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)', animation: pulse && !open ? 'fabPulse 2.5s ease-in-out infinite' : 'none', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        onMouseEnter={e => { e.currentTarget.style.transform = open ? 'rotate(180deg) scale(1.08)' : 'scale(1.08)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = open ? 'rotate(180deg)' : 'scale(1)' }}>
        {open ? <X size={20} style={{ color: '#fff' }} /> : <Sparkles size={20} style={{ color: '#fff' }} />}
        {unread > 0 && !open && <div style={{ position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: '50%', background: '#F2545B', border: '2px solid #06080F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>{unread}</div>}
      </button>

      <style>{`
        @keyframes chatSlideUp{from{opacity:0;transform:translateY(24px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes dotBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}
        @keyframes fabPulse{0%,100%{box-shadow:0 8px 24px rgba(0,229,160,0.35),0 0 0 0 rgba(0,229,160,0.25)}50%{box-shadow:0 8px 32px rgba(0,229,160,0.5),0 0 0 12px rgba(0,229,160,0)}}
        @keyframes barGrow{from{width:0%}}
      `}</style>
    </>
  )
}
