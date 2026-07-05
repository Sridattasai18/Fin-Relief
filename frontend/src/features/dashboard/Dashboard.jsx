import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, Wallet, AlertTriangle, CreditCard, ArrowRight,
  ShieldAlert, BadgeInfo, BarChart2, Activity, PieChart
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell, Legend
} from 'recharts'
import client from '../../api/client'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import PageHeader from '../../components/ui/PageHeader'
import MetricCard from '../../components/ui/MetricCard'
import { stressLabel, stressColor } from '../../utils/stress'

/* ── Formatters ──────────────────────────────────────────────── */
const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN')
const pct = (n) => Math.round(n) + '%'
const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtShort = (iso) => {
  const d = new Date(iso)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

/* ── Shared chart style constants ───────────────────────────── */
const CHART_FONT = { fontSize: 10, fill: '#7A776E', fontFamily: 'Inter' }
const GRID_COLOR = '#EDEAE1'
const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: '1px solid var(--color-border)',
  boxShadow: '0 4px 12px rgba(27,26,23,0.10)',
  fontSize: '0.75rem',
  fontFamily: 'Inter',
  background: 'white',
}
const TOOLTIP_LABEL_STYLE = { color: '#7A776E', marginBottom: 4, fontWeight: 600 }

/* ── Custom tooltip for stress level ───────────────────────── */
function StressTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ ...TOOLTIP_STYLE, padding: '10px 14px', minWidth: 160 }}>
      <p style={{ ...TOOLTIP_LABEL_STYLE, fontSize: '0.6875rem' }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 4 }}>
          <span style={{ color: p.color, fontSize: '0.75rem' }}>{p.name}</span>
          <span style={{ fontWeight: 600, color: '#1B1A17', fontSize: '0.75rem' }}>{Math.round(p.value)}{p.name.includes('%') ? '%' : ''}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Per-loan bar tooltip ───────────────────────────────────── */
function LoanBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const stress = payload.find(p => p.dataKey === 'stress_score')?.value
  const settle = payload.find(p => p.dataKey === 'settlement_percentage')?.value
  const level  = stress != null ? stressLabel(stress) : ''
  return (
    <div style={{ ...TOOLTIP_STYLE, padding: '10px 14px', minWidth: 180 }}>
      <p style={{ ...TOOLTIP_LABEL_STYLE, fontSize: '0.6875rem', marginBottom: 8 }}>{label}</p>
      {stress != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 4 }}>
          <span style={{ color: '#7A776E', fontSize: '0.75rem' }}>Stress Score</span>
          <span style={{ fontWeight: 600, color: stressColor(stress), fontSize: '0.75rem' }}>{Math.round(stress)} — {level}</span>
        </div>
      )}
      {settle != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 4 }}>
          <span style={{ color: '#7A776E', fontSize: '0.75rem' }}>Settlement %</span>
          <span style={{ fontWeight: 600, color: '#B8622B', fontSize: '0.75rem' }}>{Math.round(settle)}%</span>
        </div>
      )}
    </div>
  )
}

/* ── Chart empty state ──────────────────────────────────────── */
function ChartEmpty({ message, onAction, actionLabel }) {
  return (
    <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <BarChart2 size={18} color="var(--color-border)" />
      </div>
      <p style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', textAlign: 'center', maxWidth: 240, lineHeight: 1.5 }}>{message}</p>
      {onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  )
}

/* ── Chart skeleton ─────────────────────────────────────────── */
function ChartSkeleton({ height = 220 }) {
  return <div className="skeleton" style={{ height, borderRadius: 'var(--radius-md)', margin: '4px 0' }} />
}

/* ── Chart tab button ───────────────────────────────────────── */
function ChartTab({ label, icon: Icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 12px',
        borderRadius: 'var(--radius-sm)',
        border: active ? '1px solid var(--color-amber)' : '1px solid var(--color-border)',
        background: active ? 'var(--color-amber-dim)' : 'transparent',
        color: active ? 'var(--color-amber)' : 'var(--color-muted)',
        fontSize: '0.75rem', fontWeight: active ? 600 : 400,
        cursor: 'pointer', transition: 'all 0.12s ease',
        fontFamily: 'var(--font-body)',
      }}
    >
      <Icon size={13} />
      {label}
    </button>
  )
}

/* ── CHART 1: Stress + Settlement trend over time (Line) ────── */
function TrendLineChart({ snapshots }) {
  if (!snapshots || snapshots.length < 2) {
    return <ChartEmpty message="Save at least 2 settlement analyses to see your stress and settlement trend over time." />
  }
  const data = snapshots.map(s => ({
    name: fmtShort(s.created_at),
    'Stress Score': Math.round(s.stress_score),
    'Settlement %': Math.round(s.settlement_percentage),
  }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -18, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_COLOR} />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={CHART_FONT} dy={8} />
        <YAxis axisLine={false} tickLine={false} tick={CHART_FONT} domain={[0, 100]} />
        <ReferenceLine y={75} stroke="#B23A3A" strokeDasharray="3 3" strokeOpacity={0.4} label={{ value: 'High', position: 'right', fontSize: 9, fill: '#B23A3A' }} />
        <ReferenceLine y={50} stroke="#A6821F" strokeDasharray="3 3" strokeOpacity={0.3} label={{ value: 'Med', position: 'right', fontSize: 9, fill: '#A6821F' }} />
        <Tooltip content={<StressTooltip />} />
        <Line type="monotone" dataKey="Stress Score" stroke="#1B1A17" strokeWidth={2.5}
          dot={{ r: 4, fill: '#1B1A17', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#1B1A17' }} />
        <Line type="monotone" dataKey="Settlement %" stroke="#B8622B" strokeWidth={2.5} strokeDasharray="5 3"
          dot={{ r: 4, fill: '#B8622B', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#B8622B' }} />
        <Legend wrapperStyle={{ fontSize: '0.6875rem', paddingTop: 12, fontFamily: 'Inter', color: '#7A776E' }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

/* ── CHART 2: Per-loan stress + settlement bar chart ─────────── */
function LoanComparisonChart({ loans, navigate }) {
  if (!loans || loans.length === 0) {
    return <ChartEmpty message="Add loans and run settlement analysis to compare stress and settlement metrics across accounts." onAction={() => navigate('/loans')} actionLabel="Add loan" />
  }
  // Compute live metrics for each loan client-side (same formula as backend)
  const data = loans.map(l => {
    const dti = Math.min(100, (l.emi / Math.max(l.income, 1)) * 100)
    const expenses = l.monthly_expenses ?? l.income * 0.4
    const surplus = l.income - l.emi - expenses
    let stress = dti * 0.5 + (Math.min(l.overdue_days, 180) / 180 * 40) + (surplus < 0 ? 10 : 0)
    stress = Math.max(0, Math.min(100, stress))
    const settle = Math.max(20, Math.min(70, 25 + stress * 0.35))
    // Truncate long lender names
    const name = l.lender.length > 12 ? l.lender.slice(0, 11) + '…' : l.lender
    return { name, stress_score: Math.round(stress), settlement_percentage: Math.round(settle), fullName: l.lender }
  })

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: -18, bottom: 4 }} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_COLOR} />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={CHART_FONT} dy={8} />
        <YAxis axisLine={false} tickLine={false} tick={CHART_FONT} domain={[0, 100]} />
        <ReferenceLine y={75} stroke="#B23A3A" strokeDasharray="3 3" strokeOpacity={0.35} />
        <ReferenceLine y={50} stroke="#A6821F" strokeDasharray="3 3" strokeOpacity={0.25} />
        <Tooltip content={<LoanBarTooltip />} cursor={{ fill: 'var(--color-surface)' }} />
        <Bar dataKey="stress_score" name="Stress Score" radius={[3, 3, 0, 0]} maxBarSize={32}>
          {data.map((entry, i) => (
            <Cell key={i} fill={stressColor(entry.stress_score)} fillOpacity={0.85} />
          ))}
        </Bar>
        <Bar dataKey="settlement_percentage" name="Settlement %" fill="#B8622B" fillOpacity={0.55} radius={[3, 3, 0, 0]} maxBarSize={32} />
        <Legend wrapperStyle={{ fontSize: '0.6875rem', paddingTop: 12, fontFamily: 'Inter', color: '#7A776E' }} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ── CHART 3: Radar — DTI / Stress / Settlement per loan ─────── */
function LoanRadarChart({ loans }) {
  if (!loans || loans.length === 0) {
    return <ChartEmpty message="Add at least one loan to see a radar view of your DTI, stress, and settlement metrics." />
  }
  // Build radar axes: each loan is a spoke, three metrics are the series
  // Recharts RadarChart works best with loans as subjects, metrics as dataKey
  const subjects = ['DTI Ratio', 'Stress Score', 'Settlement %']
  const data = subjects.map(subject => {
    const row = { subject }
    loans.forEach(l => {
      const dti = Math.min(100, (l.emi / Math.max(l.income, 1)) * 100)
      const expenses = l.monthly_expenses ?? l.income * 0.4
      const surplus = l.income - l.emi - expenses
      let stress = dti * 0.5 + (Math.min(l.overdue_days, 180) / 180 * 40) + (surplus < 0 ? 10 : 0)
      stress = Math.max(0, Math.min(100, stress))
      const settle = Math.max(20, Math.min(70, 25 + stress * 0.35))
      const key = l.lender.length > 10 ? l.lender.slice(0, 9) + '…' : l.lender
      row[key] = subject === 'DTI Ratio' ? Math.round(dti)
               : subject === 'Stress Score' ? Math.round(stress)
               : Math.round(settle)
    })
    return row
  })

  const RADAR_COLORS = ['#1B1A17', '#B8622B', '#3E6B4F', '#B23A3A', '#2B5CB8', '#A6821F']
  const loanKeys = loans.map(l => l.lender.length > 10 ? l.lender.slice(0, 9) + '…' : l.lender)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={data} margin={{ top: 8, right: 24, left: 24, bottom: 8 }}>
        <PolarGrid stroke={GRID_COLOR} />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#7A776E', fontFamily: 'Inter' }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 8, fill: '#7A776E' }} tickCount={4} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
        {loanKeys.slice(0, 6).map((key, i) => (
          <Radar key={key} name={key} dataKey={key}
            stroke={RADAR_COLORS[i % RADAR_COLORS.length]}
            fill={RADAR_COLORS[i % RADAR_COLORS.length]}
            fillOpacity={0.12} strokeWidth={1.75} />
        ))}
        <Legend wrapperStyle={{ fontSize: '0.6875rem', paddingTop: 8, fontFamily: 'Inter', color: '#7A776E' }} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

/* ── Insights builder ───────────────────────────────────────── */
function buildInsights(dash) {
  if (!dash || dash.loan_count === 0) {
    return [{ title: 'Unlock your settlement estimates', text: 'Add your active loan details to start tracking repayments, calculating debt stress levels, and simulating negotiation margins.', type: 'info' }]
  }
  const s = dash.overall_stress, d = dash.avg_dti, p = dash.monthly_surplus
  const list = []
  if (s >= 61) {
    list.push({ title: 'High priority OTS leverage', text: `Your overall stress score is high (${Math.round(s)}/100). Outstanding days increase your settlement leverage — a structured proposal should be your primary priority.`, type: 'high' })
  } else if (s >= 31) {
    list.push({ title: 'Moderate risk watchzone', text: `Debt stress is moderate at ${Math.round(s)}/100. Review settlement estimates soon to prevent overdue timelines from compounding.`, type: 'tight' })
  } else {
    list.push({ title: 'Repayments are stable', text: `Your current debt load of ${pct(d)} DTI and stress score of ${Math.round(s)}/100 remains in a manageable range. Monitor overdue timelines.`, type: 'healthy' })
  }
  if (p < 0) {
    list.push({ title: 'Monthly deficit detected', text: 'Your current EMIs exceed your income after basic living expenses. Focus on restricting outflow before starting settlement negotiations.', type: 'deficit' })
  }
  return list
}

/* ── Status helpers ─────────────────────────────────────────── */
function dtiStatus(v) { return v < 35 ? 'healthy' : v < 55 ? 'tight' : 'high' }
function stressStatus(v) { return v <= 25 ? 'healthy' : v <= 60 ? 'tight' : 'high' }

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [dash, setDash] = useState(null)
  const [snapshots, setSnapshots] = useState([])
  const [letters, setLetters] = useState([])
  const [loans, setLoans] = useState([])
  const [error, setError] = useState('')
  const [activeChart, setActiveChart] = useState('trend') // 'trend' | 'comparison' | 'radar'

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [dashData, snapsData, lettersData, loansData] = await Promise.all([
          client.get('/dashboard').then(r => r.data),
          client.get('/snapshots?limit=30').then(r => r.data).catch(() => []),
          client.get('/letters').then(r => r.data).catch(() => []),
          client.get('/loans').then(r => r.data).catch(() => []),
        ])
        if (!cancelled) {
          setDash(dashData)
          setSnapshots(snapsData)
          setLetters(lettersData)
          setLoans(loansData)
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail || 'Could not load dashboard.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (error) {
    return (
      <div style={{ padding: '40px 32px' }} className="fade-in">
        <PageHeader title="Overview" subtitle="Manage your debt health." />
        <div style={{ background: 'white', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 20 }}>
          <p style={{ color: 'var(--color-danger)', fontSize: '0.875rem' }}>{error}</p>
        </div>
      </div>
    )
  }

  const insightsList = dash ? buildInsights(dash) : []

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto' }} className="fade-in page-content">
      <PageHeader
        sectionNumber="01 / DASHBOARD"
        title="Overview"
        subtitle="Dignified, practical guidance to help you navigate retail debt resolution."
      />

      {/* ── Row 1: Metric Cards ─────────────────────────────── */}
      <div className="metric-grid" style={{ marginBottom: 24 }}>
        {loading ? (
          [0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 'var(--radius-md)' }} />)
        ) : (
          <>
            <MetricCard label="Avg DTI Ratio" value={pct(dash.avg_dti)}
              badgeVariant={dtiStatus(dash.avg_dti)}
              badgeLabel={dtiStatus(dash.avg_dti) === 'healthy' ? 'Healthy' : dtiStatus(dash.avg_dti) === 'tight' ? 'Tight' : 'High Burden'}
              foot="Share of monthly income used for EMIs" Icon={TrendingUp} />
            <MetricCard label="Monthly Surplus" value={inr(dash.monthly_surplus)}
              badgeVariant={dash.monthly_surplus > 0 ? 'healthy' : 'critical'}
              badgeLabel={dash.monthly_surplus > 0 ? 'Surplus' : 'Deficit'}
              foot="Net income after all debt repayments" Icon={Wallet} />
            <MetricCard label="Debt Stress Score" value={`${Math.round(dash.overall_stress)} / 100`}
              badgeVariant={stressStatus(dash.overall_stress)}
              badgeLabel={stressLabel(dash.overall_stress)}
              progress={dash.overall_stress} progressColor={stressColor(dash.overall_stress)}
              accent Icon={AlertTriangle} />
            <MetricCard label="Active Accounts" value={dash.loan_count}
              foot={dash.loan_count === 0 ? 'No open records' : `Total outstanding: ${inr(dash.total_debt)}`}
              Icon={CreditCard} />
          </>
        )}
      </div>

      {/* ── Row 2: Insights + Summary stats ─────────────────── */}
      <div className="dashboard-grid" style={{ marginBottom: 24 }}>
        {/* Insights */}
        <div style={{ background: 'var(--color-amber-dim)', border: '1px solid #E8C9A4', borderRadius: 'var(--radius-md)', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 20 }}>
          <div>
            <p className="section-label" style={{ color: 'var(--color-amber)', marginBottom: 16 }}>Personalised Guidance</p>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[90,80,70].map(w => <div key={w} className="skeleton" style={{ height: 14, width: `${w}%`, borderRadius: 4 }} />)}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {insightsList.map((ins, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ marginTop: 2 }}>
                      {ins.type === 'high' || ins.type === 'deficit'
                        ? <ShieldAlert size={15} color="var(--color-danger)" />
                        : <BadgeInfo size={15} color="var(--color-amber)" />}
                    </div>
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-ink)', lineHeight: 1.25 }}>{ins.title}</p>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', marginTop: 4, lineHeight: 1.45 }}>{ins.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {!loading && (
            <div style={{ display: 'flex', gap: 10 }}>
              {dash.loan_count === 0
                ? <Button variant="primary" size="md" onClick={() => navigate('/loans')}>Add loan</Button>
                : <Button variant="secondary" size="md" onClick={() => navigate('/settlement')}>Analyse settlement <ArrowRight size={13} style={{ marginLeft: 4 }} /></Button>}
            </div>
          )}
        </div>

        {/* Quick stats column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div className="skeleton" style={{ height: '100%', minHeight: 160, borderRadius: 'var(--radius-md)' }} />
          ) : dash && dash.loan_count > 0 ? (
            <div style={{ background: 'white', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', padding: '20px', flex: 1 }}>
              <p className="section-label" style={{ marginBottom: 16 }}>Settlement Summary</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  { label: 'Total Outstanding', value: inr(dash.total_debt), sub: `across ${dash.loan_count} account${dash.loan_count > 1 ? 's' : ''}` },
                  { label: 'Avg Settlement Est.', value: `${Math.round(dash.recommended_settlement_pct)}%`, sub: 'of principal balance' },
                  { label: 'Total EMI Burden', value: inr(dash.total_emi), sub: 'monthly across all loans' },
                  { label: 'Letters Generated', value: dash.letter_count, sub: 'negotiation proposals' },
                ].map(({ label, value, sub }) => (
                  <div key={label} style={{ padding: '12px 14px', background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)' }}>
                    <p style={{ fontSize: '0.6875rem', color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</p>
                    <p style={{ fontFamily: 'var(--font-heading)', fontSize: '1.375rem', color: 'var(--color-ink)', lineHeight: 1 }}>{value}</p>
                    <p style={{ fontSize: '0.6875rem', color: 'var(--color-muted)', marginTop: 4 }}>{sub}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ background: 'white', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '20px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', textAlign: 'center' }}>Add loans to see settlement summary statistics.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Settlement Charts (tabbed) ──────────────── */}
      <div style={{ background: 'white', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', marginBottom: 24 }}>
        {/* Chart header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p className="section-label">Settlement Analytics</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: 2 }}>
              {activeChart === 'trend' && 'Stress score and settlement % tracked over time'}
              {activeChart === 'comparison' && 'Per-loan stress score and settlement estimate comparison'}
              {activeChart === 'radar' && 'Multi-metric radar view across all active accounts'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ChartTab label="Trend" icon={Activity} active={activeChart === 'trend'} onClick={() => setActiveChart('trend')} />
            <ChartTab label="By Loan" icon={BarChart2} active={activeChart === 'comparison'} onClick={() => setActiveChart('comparison')} />
            <ChartTab label="Radar" icon={PieChart} active={activeChart === 'radar'} onClick={() => setActiveChart('radar')} />
          </div>
        </div>

        {/* Chart body */}
        <div style={{ padding: '20px 20px 16px' }}>
          {loading ? (
            <ChartSkeleton height={240} />
          ) : (
            <>
              {activeChart === 'trend' && <TrendLineChart snapshots={snapshots} />}
              {activeChart === 'comparison' && <LoanComparisonChart loans={loans} navigate={navigate} />}
              {activeChart === 'radar' && <LoanRadarChart loans={loans} />}
            </>
          )}
        </div>

        {/* Chart footer legend for trend */}
        {activeChart === 'trend' && !loading && snapshots.length >= 2 && (
          <div style={{ padding: '0 20px 16px', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.6875rem', color: 'var(--color-muted)' }}>
              <span style={{ display: 'inline-block', width: 16, height: 2.5, background: '#1B1A17', borderRadius: 1 }} /> Stress Score
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.6875rem', color: 'var(--color-muted)' }}>
              <span style={{ display: 'inline-block', width: 16, height: 0, borderTop: '2.5px dashed #B8622B' }} /> Settlement %
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.6875rem', color: 'var(--color-muted)' }}>
              <span style={{ display: 'inline-block', width: 16, height: 0, borderTop: '2px dashed #B23A3A', opacity: 0.5 }} /> High threshold (75)
            </span>
          </div>
        )}

        {/* Prompt to save analysis if trend has < 2 points */}
        {activeChart === 'trend' && !loading && snapshots.length < 2 && (
          <div style={{ padding: '0 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
              Run settlement analysis on your loans and click Save to record data points for this chart.
            </p>
            <Button variant="ghost" size="sm" onClick={() => navigate('/settlement')}>
              Go to Settlement <ArrowRight size={12} style={{ marginLeft: 4 }} />
            </Button>
          </div>
        )}
      </div>

      {/* ── Row 4: Recent Proposals table ──────────────────── */}
      <div style={{ background: 'white', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p className="section-label">Recent Generated Proposals</p>
          {!loading && letters.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/letters')}>
              View all <ArrowRight size={12} style={{ marginLeft: 4 }} />
            </Button>
          )}
        </div>
        <div style={{ padding: '0' }}>
          {loading ? (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 32, borderRadius: 4 }} />)}
            </div>
          ) : letters.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', marginBottom: 12 }}>No settlement letters generated yet.</p>
              <Button variant="outline" size="sm" onClick={() => navigate('/settlement')}>Begin settlement analysis</Button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {['Date Generated', 'Lender', 'Recommended Estimate %', 'Source'].map(h => (
                      <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {letters.slice(0, 6).map((l, i) => (
                    <tr key={l.id}
                      style={{ borderBottom: i < Math.min(letters.length, 6) - 1 ? '1px solid var(--color-border)' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                      onClick={() => navigate('/letters')}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'white'}
                    >
                      <td style={{ padding: '12px 20px', fontSize: '0.8125rem', color: 'var(--color-muted)' }}>{fmtDate(l.created_at)}</td>
                      <td style={{ padding: '12px 20px', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-ink)' }}>{l.lender}</td>
                      <td style={{ padding: '12px 20px', fontSize: '0.8125rem', fontFamily: 'var(--font-heading)', color: 'var(--color-ink)' }}>{Math.round(l.settlement_pct)}%</td>
                      <td style={{ padding: '12px 20px' }}>
                        <Badge variant={l.source === 'AI' ? 'ai' : 'neutral'}>
                          {l.source === 'AI' ? 'Gemini AI' : 'Offline Template'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
