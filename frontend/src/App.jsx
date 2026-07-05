import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Spinner from './components/ui/Spinner'

// Route-level code splitting — each page loads its own chunk on first visit.
// Small shared components (Button, Badge, layout shells) are NOT lazy-loaded
// since they're needed immediately and splitting them would create too many
// tiny chunks with no meaningful gain.
const Login      = lazy(() => import('./features/auth/Login'))
const Register   = lazy(() => import('./features/auth/Register'))
const Dashboard  = lazy(() => import('./features/dashboard/Dashboard'))
const Loans      = lazy(() => import('./features/loans/Loans'))
const Settlement = lazy(() => import('./features/settlement/Settlement'))
const Letters    = lazy(() => import('./features/letters/Letters'))

// Single Suspense boundary at the router level — covers all route transitions.
// Spinner is already used throughout the app so this matches existing UX.
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Spinner size="lg" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes */}
              <Route path="/login"    element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Protected routes — wrapped in AppShell via ProtectedRoute */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/loans"
                element={
                  <ProtectedRoute>
                    <Loans />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settlement"
                element={
                  <ProtectedRoute>
                    <Settlement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/letters"
                element={
                  <ProtectedRoute>
                    <Letters />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
