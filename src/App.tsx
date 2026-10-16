import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './pages/auth/LoginPage'
import { AdminApp } from './pages/admin/AdminApp'
import { AdminProfileSetupPage } from './pages/admin/AdminProfileSetupPage'
import { AdminInvitationPage } from './pages/auth/AdminInvitationPage'
import { useAuth } from './hooks/useAuth'
import { AccessDeniedPage } from './pages/AccessDeniedPage'
import './App.css'

function App() {
  const { user, loading } = useAuth()

  if (loading) return null

  return (
    <Routes>
      <Route path="/admin/invitation" element={<AdminInvitationPage />} />
      <Route path="/access-denied" element={<AccessDeniedPage />} />
      <Route path="/login" element={user ? <Navigate to={user.profileComplete ? '/admin' : '/admin/profile'} replace /> : <LoginPage />} />
      <Route path="/admin/profile" element={!user ? <Navigate to="/login" replace /> : user.profileComplete ? <Navigate to="/admin" replace /> : <AdminProfileSetupPage />} />
      <Route path="/admin/*" element={!user ? <Navigate to="/login" replace /> : !user.profileComplete ? <Navigate to="/admin/profile" replace /> : <AdminApp />} />
      <Route path="*" element={<Navigate to={user ? (user.profileComplete ? '/admin' : '/admin/profile') : '/login'} replace />} />
    </Routes>
  )
}

export default App
