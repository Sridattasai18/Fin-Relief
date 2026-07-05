import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Check, Download, RefreshCw, FileText, ChevronRight, Edit2, Save, HelpCircle } from 'lucide-react'
import client from '../../api/client'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../context/useToast'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

/* ── Custom Regex to safe-replace letter placeholders ── */
function applyPlaceholderFixes(text, overdueDays = 0) {
  let cleaned = text
  // Replace references to "overdue by 0 days" with neutral terms
  if (overdueDays === 0) {
    cleaned = cleaned.replace(/currently overdue by \d+ days/gi, 'currently in a difficult payment cycle')
    cleaned = cleaned.replace(/overdue for \d+ days/gi, 'currently facing payment constraints')
  }
  // Standardise reporting statement
  cleaned = cleaned.replace(/will report to CIBIL as settled/gi, 'I request that the account status be updated appropriately after settlement, in accordance with applicable reporting practices')
  cleaned = cleaned.replace(/settled status in CIBIL/gi, 'account status updated appropriately in accordance with applicable reporting practices')
  return cleaned
}

/* ── Left Sidebar Item Component ── */
function LetterHistoryItem({ letter, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`letters-history-item-mobile${active ? ' active' : ''}`}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 14px',
        background: active ? 'var(--color-amber-dim)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.12s ease',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <p
          style={{
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: 'var(--color-ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {letter.lender}
        </p>
        <p style={{ fontSize: '0.6875rem', color: 'var(--color-muted)', marginTop: 2 }}>
          {fmtDate(letter.created_at)} · {Math.round(letter.settlement_pct)}%
        </p>
        <div style={{ marginTop: 4, display: 'flex', gap: 4, alignItems: 'center' }}>
          <Badge variant="neutral" style={{ fontSize: '0.6rem' }}>
            v{letter.version}
          </Badge>
          <Badge variant={letter.source === 'AI' ? 'ai' : 'neutral'} style={{ fontSize: '0.6rem' }}>
            {letter.source === 'AI' ? 'AI' : 'Template'}
          </Badge>
        </div>
      </div>
      <ChevronRight size={14} color="var(--color-border)" style={{ flexShrink: 0 }} />
    </button>
  )
}

export default function Letters() {
  const navigate = useNavigate()
  const token = localStorage.getItem('finrelief_token')
  const toast = useToast()

  const [letters, setLetters] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [regenLoading, setRegenLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  // Edit Mode state
  const [isEditMode, setIsEditMode] = useState(false)
  const [editedText, setEditedText] = useState('')
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false)

  // Sidebar detail panel fields
  const [borrowerName, setBorrowerName] = useState('')
  const [accountNumber, setAccountNumber] = useState('XXXX-XXXX-1234')
  const [subject, setSubject] = useState('')
  const [paymentWindow, setPaymentWindow] = useState('15 days')

  // Modals
  const [showRegenModal, setShowRegenModal] = useState(false)

  const load = useCallback(async (selectId = null) => {
    try {
      const { data } = await client.get('/letters')
      setLetters(data)
      if (data.length > 0) {
        const active = selectId ? data.find(l => l.id === selectId) : data[0]
        const target = active || data[0]
        setSelectedId(target.id)
        const cleaned = applyPlaceholderFixes(target.letter_text)
        setEditedText(cleaned)
        // Extract basic data for sidebar fields
        setBorrowerName(localStorage.getItem('finrelief_user') ? JSON.parse(localStorage.getItem('finrelief_user')).name : '')
        // Default subjects
        setSubject(`Proposal for One-Time Settlement (OTS) - Account: ${accountNumber}`)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not load letters.')
    } finally {
      setLoading(false)
    }
  }, [accountNumber])

  useEffect(() => { load() }, [load])

  const selectedLetter = letters.find(l => l.id === selectedId) || null

  const handleSelectLetter = (l) => {
    if (hasUnsavedEdits) {
      if (!window.confirm('Discard unsaved edits to this letter?')) return
    }
    setSelectedId(l.id)
    const cleaned = applyPlaceholderFixes(l.letter_text)
    setEditedText(cleaned)
    setHasUnsavedEdits(false)
    setIsEditMode(false)
  }

  // Update backend record with modified text
  const handleSaveEdits = async () => {
    if (!selectedLetter) return
    setSaveLoading(true)
    setError('')
    try {
      await client.put(`/letters/${selectedLetter.id}`, { letter_text: editedText })
      setHasUnsavedEdits(false)
      setIsEditMode(false)
      // Reload list to sync state
      const { data } = await client.get('/letters')
      setLetters(data)
      toast('Letter modifications saved successfully', 'success')
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save letter modifications.')
      toast('Failed to save letter', 'error')
    } finally {
      setSaveLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(editedText).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleDownload = () => {
    if (!selectedLetter) return
    // Ensure edits are saved to backend before download
    const downloadUrl = `${BASE_URL}/letters/download/${selectedLetter.id}`
    fetch(downloadUrl, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `negotiation-letter-${selectedLetter.lender.replace(/ /g, '_')}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => {})
  }

  const triggerRegeneration = async () => {
    if (!selectedLetter) return
    setRegenLoading(true)
    setShowRegenModal(false)
    setError('')
    try {
      await client.post(`/letters/${selectedLetter.loan_id}`)
      setHasUnsavedEdits(false)
      setIsEditMode(false)
      // Reload list & select new one
      const { data } = await client.get('/letters')
      setLetters(data)
      const newLetter = data.find(l => l.loan_id === selectedLetter.loan_id)
      if (newLetter) {
        setSelectedId(newLetter.id)
        setEditedText(applyPlaceholderFixes(newLetter.letter_text))
      }
      toast('Letter regenerated successfully', 'success')
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not regenerate letter.')
      toast('Failed to regenerate letter', 'error')
    } finally {
      setRegenLoading(false)
    }
  }

  const handleRegenerateClick = () => {
    if (hasUnsavedEdits) {
      setShowRegenModal(true)
    } else {
      triggerRegeneration()
    }
  }

  // Handle local sidebar detail fields updating the letter body
  const applySidebarFields = () => {
    if (!selectedLetter) return
    let updatedText = editedText
    // Naive regex updates to letter variables
    updatedText = updatedText.replace(/Subject: .*/i, `Subject: ${subject}`)
    updatedText = updatedText.replace(/Dear .*,/i, `Dear ${selectedLetter.lender} Recovery Team,`)
    updatedText = updatedText.replace(/Sincerely,\n.*/i, `Sincerely,\n${borrowerName}`)
    setEditedText(updatedText)
    setHasUnsavedEdits(true)
  }

  if (loading) {
    return (
      <div style={{ padding: '32px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Spinner size="md" />
        <span style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Loading letters workspace…</span>
      </div>
    )
  }

  if (letters.length === 0) {
    return (
      <div style={{ padding: '32px 32px 48px', maxWidth: 1240, margin: '0 auto' }} className="fade-in">
        <PageHeader sectionNumber="04 / LETTERS" title="Negotiation Letters" subtitle="Draft formal proposal letters." />
        <div style={{ maxWidth: 480, margin: '40px auto 0' }}>
          <EmptyState
            title="No letters generated yet"
            description="Run a settlement analysis on your active loans and select Generate Letter to create a formal negotiation draft."
            Icon={FileText}
            actionText="Go to Settlement portal"
            onAction={() => navigate('/settlement')}
            maxHeight="320px"
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px 32px 48px', maxWidth: 1240, margin: '0 auto' }} className="fade-in">
      <PageHeader
        sectionNumber="04 / LETTERS"
        title="Proposal Workspace"
        subtitle="Manage, edit, and export AI-assisted debt settlement letters."
      />

      {error && (
        <div
          role="alert"
          style={{ padding: '8px 12px', background: 'var(--color-danger-dim)', border: '1px solid #E8B8B8', borderRadius: 4, fontSize: '0.8125rem', color: 'var(--color-danger)', marginBottom: 16 }}
        >
          {error}
        </div>
      )}

      {/* 3-Panel Workspace Grid — gridTemplateColumns is owned by .letters-grid CSS class,
          not inline style, so responsive rules at <1100px actually take effect */}
      <div
        style={{
          display: 'grid',
          gap: 16,
          alignItems: 'start',
        }}
        className="letters-grid"
      >
        {/* Panel 1: Left History List */}
        <div
          style={{
            background: 'white',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-card)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
            }}
          >
            <p className="section-label">Letter History</p>
          </div>
          {/* letters-history-mobile: horizontal scroll chips on mobile/tablet, vertical list on desktop */}
          <div className="letters-history-mobile" style={{ maxHeight: '60vh' }}>
            {letters.map((l) => (
              <LetterHistoryItem
                key={l.id}
                letter={l}
                active={selectedId === l.id}
                onClick={() => handleSelectLetter(l)}
              />
            ))}
          </div>
        </div>

        {/* Panel 2: Center A4 paper sheet preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Top Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'white',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 16px',
            }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              {isEditMode ? (
                <Button variant="primary" size="sm" loading={saveLoading} onClick={handleSaveEdits}>
                  <Save size={13} style={{ marginRight: 4 }} /> Save Draft
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)}>
                  <Edit2 size={13} style={{ marginRight: 4 }} /> Edit
                </Button>
              )}
              {isEditMode && (
                <Button variant="ghost" size="sm" onClick={() => { setIsEditMode(false); setEditedText(applyPlaceholderFixes(selectedLetter.letter_text)); setHasUnsavedEdits(false) }}>
                  Cancel
                </Button>
              )}
              {hasUnsavedEdits && (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-amber)', display: 'flex', alignItems: 'center', fontWeight: 500 }}>
                  • Unsaved changes
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button variant="secondary" size="sm" onClick={handleDownload} disabled={hasUnsavedEdits}>
                <Download size={13} /> PDF
              </Button>
              <Button variant="ghost" size="sm" loading={regenLoading} onClick={handleRegenerateClick}>
                <RefreshCw size={13} /> Regenerate
              </Button>
            </div>
          </div>

          {/* Paper View */}
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '24px',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 760,
                minHeight: '70vh',
                background: 'white',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-raised)',
                padding: '48px 40px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {isEditMode ? (
                <textarea
                  value={editedText}
                  onChange={(e) => { setEditedText(e.target.value); setHasUnsavedEdits(true) }}
                  style={{
                    flex: 1,
                    width: '100%',
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    lineHeight: 1.75,
                    color: 'var(--color-ink)',
                  }}
                />
              ) : (
                <pre
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    color: 'var(--color-ink)',
                    lineHeight: 1.75,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    margin: 0,
                  }}
                >
                  {editedText}
                </pre>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
            <HelpCircle size={12} color="var(--color-muted)" />
            <span style={{ fontSize: '0.6875rem', color: 'var(--color-muted)' }}>
              This draft is for negotiation purposes. Review all details before sending.
            </span>
          </div>
        </div>

        {/* Panel 3: Right configuration sidebar */}
        <div
          style={{
            background: 'white',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-card)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <p className="section-label">Proposal Details</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: 4 }}>
                Borrower Name
              </label>
              <input
                type="text"
                value={borrowerName}
                onChange={e => setBorrowerName(e.target.value)}
                className="input-base"
                style={{ padding: '6px 8px', fontSize: '0.8125rem' }}
                disabled={!isEditMode}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: 4 }}>
                Loan Account Number
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value)}
                className="input-base"
                style={{ padding: '6px 8px', fontSize: '0.8125rem' }}
                disabled={!isEditMode}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: 4 }}>
                Payment Window
              </label>
              <input
                type="text"
                value={paymentWindow}
                onChange={e => setPaymentWindow(e.target.value)}
                className="input-base"
                style={{ padding: '6px 8px', fontSize: '0.8125rem' }}
                disabled={!isEditMode}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-muted)', display: 'block', marginBottom: 4 }}>
                Proposal Subject
              </label>
              <textarea
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="input-base"
                rows={3}
                style={{ padding: '6px 8px', fontSize: '0.8125rem', resize: 'none' }}
                disabled={!isEditMode}
              />
            </div>

            {isEditMode && (
              <Button variant="secondary" size="sm" onClick={applySidebarFields} style={{ width: '100%', marginTop: 4 }}>
                Apply configuration
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Unsaved edits regeneration warning modal */}
      <Modal
        isOpen={showRegenModal}
        onClose={() => setShowRegenModal(false)}
        title="Discard your custom edits?"
      >
        <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', lineHeight: 1.6 }}>
          You have unsaved local edits to this negotiation letter. Regenerating will overwrite all current changes with a fresh layout.
        </p>
        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={() => setShowRegenModal(false)} disabled={regenLoading}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" loading={regenLoading} onClick={triggerRegeneration}>
            Discard &amp; Regenerate
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
