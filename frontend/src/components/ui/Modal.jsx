import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

/**
 * Modal — design-system-native confirm/alert dialog
 * Usage:
 *   <Modal isOpen={open} onClose={() => setOpen(false)} title="Delete loan?">
 *     <p>This cannot be undone.</p>
 *     <Modal.Footer>
 *       <Button variant="ghost" onClick={onClose}>Cancel</Button>
 *       <Button variant="danger" onClick={handleConfirm}>Delete</Button>
 *     </Modal.Footer>
 *   </Modal>
 */
export default function Modal({ isOpen, onClose, title, children }) {
  const overlayRef = useRef(null)

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Prevent body scroll while open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(27,26,23,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '20px',
        animation: 'fadeIn 0.15s ease forwards',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        style={{
          background: 'white',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-float)',
          width: '100%',
          maxWidth: 420,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px 16px',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <h2
            id="modal-title"
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.125rem',
              fontWeight: 400,
              color: 'var(--color-ink)',
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-muted)',
              display: 'flex',
              alignItems: 'center',
              padding: 4,
              borderRadius: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

/** Convenience sub-component for modal action buttons */
Modal.Footer = function ModalFooter({ children }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        justifyContent: 'flex-end',
        paddingTop: 16,
        marginTop: 8,
        borderTop: '1px solid var(--color-border)',
      }}
    >
      {children}
    </div>
  )
}
