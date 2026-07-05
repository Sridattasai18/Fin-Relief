import { useState, useCallback, useEffect } from 'react'
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react'
import { ToastContext } from './toastContextDef'

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'success', duration = 3500) => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, message, type, duration }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}


function ToastItem({ toast, onRemove }) {
  const { id, message, type, duration } = toast
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Slight delay to trigger enter animation
    const enterTimer = setTimeout(() => setIsVisible(true), 10)
    const leaveTimer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(() => onRemove(id), 300) // wait for exit animation
    }, duration)

    return () => {
      clearTimeout(enterTimer)
      clearTimeout(leaveTimer)
    }
  }, [id, duration, onRemove])

  const Icon = type === 'success' ? CheckCircle2 : type === 'error' ? AlertCircle : Info
  const colors = {
    success: { bg: 'white', border: 'var(--color-green)', text: 'var(--color-green)' },
    error: { bg: 'white', border: 'var(--color-danger)', text: 'var(--color-danger)' },
    info: { bg: 'var(--color-surface)', border: 'var(--color-amber)', text: 'var(--color-ink)' }
  }

  const color = colors[type] || colors.info

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: color.bg,
        borderLeft: `4px solid ${color.border}`,
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
        minWidth: 280,
        boxShadow: 'var(--shadow-raised)',
        pointerEvents: 'auto',
        transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
        opacity: isVisible ? 1 : 0,
        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      }}
    >
      <Icon size={18} style={{ color: color.text }} />
      <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-ink)' }}>
        {message}
      </span>
      <button
        onClick={() => {
          setIsVisible(false)
          setTimeout(() => onRemove(id), 300)
        }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-muted)',
          padding: 4,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
