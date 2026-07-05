import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Calculator, FileText, Save, BadgeInfo, AlertCircle } from 'lucide-react'
import client from '../../api/client'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import { useToast } from '../../context/useToast'
import { stressLabel, stressColor } from '../../utils/stress'

/* ── Animation helpers ──────────────────────────────────────── */
function AnimatedNumber({ value, format = (v) => v }) {
  const [display, setDisplay] = useState(value)
  const displayRef = useRef(display)
  useEffect(() => {
    displayRef.current = display
  })
  useEffect(() => {
    let start = displayRef.current
    let end = value
    if (start === end) return
    let startTime = performance.now()
    let frameId
    const animate = (time) => {
      const progress = Math.min((time - startTime) / 400, 1)
      const ease = 1 - Math.pow(1 - progress, 4)
      setDisplay(start + (end - start) * ease)
      if (progress < 1) frameId = requestAnimationFrame(animate)
    }
    frameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameId)
  }, [value])
  return format(display)
}

function StressGauge({ score }) {
  const radius = 36
  const circumference = Math.PI * radius
  const strokeDashoffset = circumference - (score / 100) * circumference
  const color = stressColor(score)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
      <div style={{ position: 'relative', width: 80, height: 40, display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
        <svg width="80" height="80" style={{ transform: 'rotate(-180deg)' }}>
          <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--color-border)" strokeWidth="6" strokeDasharray={`${circumference} ${circumference}`} />
          <circle cx="40" cy="40" r={radius} fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={strokeDashoffset} style={{ transition: 'stroke-dashoffset 0.6s ease-out, stroke 0.6s ease' }} />
        </svg>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center', fontSize: '1rem', fontWeight: 600, color: 'var(--color-ink)', fontFamily: 'var(--font-heading)' }}>
          {Math.round(score)}
        </div>
      </div>
      <span style={{ fontSize: '0.6875rem', color, fontWeight: 500 }}>{stressLabel(score)}</span>
    </div>
  )
}

/* ── Formatters ─────────────────────────────────────────────── */
const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN')
const pct = (n) => Math.round(n) + '%'

/* ── Client-side calculation formula ── */
function computeMetrics(income, emi, overdue_days, amount, monthly_expenses) {
  const expenses = monthly_expenses ?? income * 0.4
  const dti      = Math.min(100, (emi / Math.max(income, 1)) * 100)
  const surplus  = income - emi - expenses
  let   stress   = (dti * 0.5) + (Math.min(overdue_days, 180) / 180 * 40) + (surplus < 0 ? 10 : 0)
  stress         = Math.max(0, Math.min(100, stress))
  let settlePct  = 25 + (stress * 0.35)
  settlePct      = Math.max(20, Math.min(70, settlePct))
  return { dti, surplus, stress, settlePct }
}

function dtiStatus(v)    { return v < 35 ? 'healthy' : v < 55 ? 'tight' : 'high' }
function surplusStatus(v){ return v > 5000 ? 'healthy' : v >= 0 ? 'tight' : 'critical' }
function overdueStatus(v){ return v === 0 ? 'healthy' : v <= 30 ? 'tight' : 'high' }

/* ── Live Slider + Input Row ── */
function SliderInput({ id, label, value, min, max, step = 1, onChange, format, tooltip }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label
            htmlFor={id}
            style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-ink)' }}
          >
            {label}
          </label>
          {tooltip && (
            <span title={tooltip} style={{ cursor: 'help', color: 'var(--color-muted)', display: 'inline-flex' }}>
              <BadgeInfo size={13} />
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const val = parseFloat(e.target.value)
              if (!isNaN(val)) onChange(Math.max(min, Math.min(max, val)))
            }}
            style={{
              width: 90,
              padding: '2px 6px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8125rem',
              textAlign: 'right',
              fontFamily: 'var(--font-body)',
            }}
          />
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width: '100%',
          accentColor: 'var(--color-amber)',
          cursor: 'pointer',
          height: 4,
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: -2 }}>
        <span style={{ fontSize: '0.6875rem', color: 'var(--color-muted)' }}>{format(min)}</span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--color-muted)' }}>{format(max)}</span>
      </div>
    </div>
  )
}

/* ── Metric detail row ── */
function MetricRow({ label, value, variant, tooltip }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--color-muted)' }}>{label}</span>
        {tooltip && (
          <span title={tooltip} style={{ cursor: 'help', color: 'var(--color-border)', display: 'inline-flex' }}>
            <BadgeInfo size={12} />
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9375rem', color: 'var(--color-ink)' }}>
          {value}
        </span>
        <Badge variant={variant}>
          {variant === 'healthy' ? 'Healthy' : variant === 'tight' ? 'Moderate' : 'High Burden'}
        </Badge>
      </div>
    </div>
  )
}

export default function Settlement() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const toast     = useToast()

  const [loans,          setLoans]          = useState([])
  const [selectedId,     setSelectedId]     = useState(location.state?.loanId || null)
  const [loading,        setLoading]        = useState(true)
  const [saving,         setSaving]         = useState(false)
  const [genLoading,     setGenLoading]     = useState(false)
  const [officialRec,    setOfficialRec]    = useState(null)
  const [error,          setError]          = useState('')
  const [saveSuccess,    setSaveSuccess]    = useState(false)

  // Sliders input state
  const [income,      setIncome]      = useState(0)
  const [emi,         setEmi]         = useState(0)
  const [overdueDays, setOverdueDays] = useState(0)

  const loan = loans.find(l => l.id === selectedId) || loans[0] || null

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data } = await client.get('/loans')
        if (!cancelled) {
          setLoans(data)
          const target = data.find(l => l.id === location.state?.loanId) || data[0]
          if (target) {
            setSelectedId(target.id)
            setIncome(target.income)
            setEmi(target.emi)
            setOverdueDays(target.overdue_days)
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail || 'Could not load loans.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [location.state])

  const handleSelectLoan = (id) => {
    const l = loans.find(ln => ln.id === parseInt(id))
    if (!l) return
    setSelectedId(l.id)
    setIncome(l.income)
    setEmi(l.emi)
    setOverdueDays(l.overdue_days)
    setOfficialRec(null)
    setSaveSuccess(false)
    setError('')
  }

  // Compute live local metrics
  const metrics = loan
    ? computeMetrics(income, emi, overdueDays, loan.amount, loan.monthly_expenses)
    : null

  // Check if current sliders differ from saved database baseline
  const isUnsavedScenario = loan
    ? (income !== loan.income || emi !== loan.emi || overdueDays !== loan.overdue_days)
    : false

  const handleSave = async () => {
    if (!loan) return
    setSaving(true)
    setSaveSuccess(false)
    setError('')
    try {
      const { data } = await client.post(`/settlement/${loan.id}`)
      setOfficialRec(data)
      setSaveSuccess(true)
      toast('Analysis snapshot saved successfully!', 'success')
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save settlement analysis.')
      toast('Failed to save analysis', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateLetter = async () => {
    if (!loan) return
    setGenLoading(true)
    setError('')
    try {
      // Create analysis record
      await client.post(`/settlement/${loan.id}`)
      // Trigger letter drafting
      await client.post(`/letters/${loan.id}`)
      toast('Letter generated successfully', 'success')
      navigate('/letters')
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not generate letter.')
      toast('Failed to generate letter', 'error')
    } finally {
      setGenLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '32px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Spinner size="md" />
        <span style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Loading…</span>
      </div>
    )
  }

  if (loans.length === 0) {
    return (
      <div style={{ padding: '32px 32px 48px', maxWidth: 1240, margin: '0 auto' }} className="fade-in">
        <PageHeader sectionNumber="03 / SETTLEMENT" title="Settlement Analysis" subtitle="Simulate OTS outcomes." />
          <EmptyState
            title="No loans to analyse yet"
            description="Add at least one loan to activate the what-if settlement calculator and see your debt stress breakdown."
            Icon={Calculator}
            actionText="Add loan"
            onAction={() => navigate('/loans')}
            maxHeight="320px"
          />
      </div>
    )
  }

  return (
    <div style={{ padding: '32px 32px 48px', maxWidth: 1240, margin: '0 auto' }} className="fade-in">
      <PageHeader
        sectionNumber="03 / SETTLEMENT"
        title="Settlement Analysis"
        subtitle="Estimate bank settlement scopes and forecast your negotiation target thresholds."
      />

      {error && (
        <div
          role="alert"
          style={{ padding: '8px 12px', background: 'var(--color-danger-dim)', border: '1px solid #E8B8B8', borderRadius: 4, fontSize: '0.8125rem', color: 'var(--color-danger)', marginBottom: 16 }}
        >
          {error}
        </div>
      )}

      {/* Selector */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div>
          <label
            htmlFor="loan-selector"
            style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-ink)', display: 'block', marginBottom: 6 }}
          >
            Analysing loan
          </label>
          <select
            id="loan-selector"
            value={selectedId || ''}
            onChange={e => handleSelectLoan(e.target.value)}
            className="input-base"
            style={{ minWidth: 320 }}
          >
            {loans.map(l => (
              <option key={l.id} value={l.id}>
                {l.lender} — {l.loan_type} ({inr(l.amount)} outstanding)
              </option>
            ))}
          </select>
        </div>

        {isUnsavedScenario && (
          <div
            style={{
              marginTop: 22,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-amber-dim)',
              color: 'var(--color-amber)',
              fontSize: '0.75rem',
              fontWeight: 500,
            }}
          >
            <AlertCircle size={14} />
            Unsaved scenario (sliders differ from baseline)
          </div>
        )}
      </div>

      {loan && metrics && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 20,
          }}
          className="settlement-grid"
        >
          {/* Sliders Inputs */}
          <div>
            <div
              style={{
                background: 'white',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-card)',
                padding: '20px',
                marginBottom: 16,
              }}
            >
              <p className="section-label" style={{ marginBottom: 20 }}>Financial Inputs</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <SliderInput
                  id="sl-income"
                  label="Monthly income"
                  value={income}
                  min={5000}
                  max={500000}
                  step={1000}
                  onChange={setIncome}
                  format={inr}
                  tooltip="Your active net take-home salary or regular earnings."
                />
                <SliderInput
                  id="sl-emi"
                  label="Monthly EMI"
                  value={emi}
                  min={500}
                  max={Math.max(100000, loan.emi * 2.5)}
                  step={500}
                  onChange={setEmi}
                  format={inr}
                  tooltip="The combined EMI value associated with this account."
                />
                <SliderInput
                  id="sl-overdue"
                  label="Overdue days"
                  value={overdueDays}
                  min={0}
                  max={365}
                  step={1}
                  onChange={setOverdueDays}
                  format={v => `${v} days`}
                  tooltip="Days since your account entered default (DTI weight increases up to 180 days)."
                />
              </div>
            </div>

            <div
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                fontSize: '0.75rem',
                color: 'var(--color-muted)',
                lineHeight: 1.5,
              }}
            >
              Adjusting sliders computes instant estimates locally. Click{' '}
              <strong style={{ color: 'var(--color-ink)' }}>Save Analysis</strong> on the right to commit
              these numbers as your baseline.
            </div>
          </div>

          {/* Metric Breakdown + Recommended Estimate */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Metric list */}
            <div
              style={{
                background: 'white',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-card)',
                padding: '20px',
              }}
            >
              <p className="section-label" style={{ marginBottom: 8 }}>Metric Breakdown</p>
              <div>
                <MetricRow
                  label="DTI Ratio"
                  value={pct(metrics.dti)}
                  variant={dtiStatus(metrics.dti)}
                  tooltip="Percentage of income going to debt service. Capped at 100%."
                />
                <MetricRow
                  label="Monthly Surplus"
                  value={inr(metrics.surplus)}
                  variant={surplusStatus(metrics.surplus)}
                  tooltip="Surplus income remaining after EMIs and essential living costs."
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-muted)' }}>Debt Stress Score</span>
                  </div>
                  <StressGauge score={metrics.stress} />
                </div>
                <MetricRow
                  label="Overdue Timeline"
                  value={`${overdueDays} days`}
                  variant={overdueStatus(overdueDays)}
                  tooltip="Timeline severity of default state."
                />
              </div>
            </div>

            {/* Rec card */}
            <div
              style={{
                background: 'var(--color-ink)',
                borderRadius: 'var(--radius-md)',
                padding: '24px',
                color: 'white',
                boxShadow: 'var(--shadow-raised)',
              }}
            >
              <p className="section-label" style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>
                Estimated Negotiation Range
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '3.25rem',
                    fontWeight: 300,
                    letterSpacing: '-0.03em',
                    color: 'white',
                    lineHeight: 1,
                  }}
                >
                  <AnimatedNumber value={metrics.settlePct} format={pct} />
                </span>
                <span style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.45)' }}>
                  of principal balance
                </span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.6)', marginBottom: 20 }}>
                Estimated Settlement Value: <AnimatedNumber value={loan.amount * metrics.settlePct / 100} format={inr} /> (outstanding: {inr(loan.amount)})
              </p>

              {officialRec && (
                <div
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: 4,
                    padding: '8px 12px',
                    fontSize: '0.75rem',
                    color: 'rgba(255,255,255,0.5)',
                    marginBottom: 16,
                  }}
                >
                  Saved analysis snapshot: {pct(officialRec.settlement_percentage)} settlement recommend at stress {Math.round(officialRec.stress_score)}/100
                </div>
              )}

              {saveSuccess && (
                <p style={{ fontSize: '0.75rem', color: 'var(--color-green)', marginBottom: 12 }}>
                  ✓ Analysis snapshot saved successfully.
                </p>
              )}

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Button
                  id="recalculate-save-btn"
                  variant="outline"
                  size="sm"
                  loading={saving}
                  onClick={handleSave}
                  style={{ borderColor: 'rgba(255,255,255,0.25)', color: 'white', background: 'transparent' }}
                >
                  <Save size={13} style={{ marginRight: 4 }} /> Save Analysis
                </Button>
                <Button
                  id="generate-letter-btn"
                  variant="primary"
                  size="sm"
                  loading={genLoading}
                  onClick={handleGenerateLetter}
                >
                  <FileText size={13} style={{ marginRight: 4 }} /> Generate negotiation letter
                </Button>
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12 }}>
                <AlertCircle size={12} color="rgba(255,255,255,0.6)" style={{ marginTop: 2, flexShrink: 0 }} />
                <p style={{ fontSize: '0.75rem', color: 'var(--color-on-dark-muted)', lineHeight: 1.45 }}>
                  This recommended settlement estimate is not a lender-approved offer. It provides a guidance threshold to base legal negotiations upon.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
