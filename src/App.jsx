import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { NotificationsProvider } from './context/NotificationsContext'
import Login from './pages/Login'
import Home from './pages/Home'
import AddDrink from './pages/AddDrink'
import Ranking from './pages/Ranking'
import GlobalRanking from './pages/GlobalRanking'
import Social from './pages/Social'
import Profile from './pages/Profile'
import Navbar from './components/Navbar'
import Footer from './components/Footer'

function Dashboard() {
  const [currentPage, setCurrentPage] = useState('home')
  const [selectedLeague, setSelectedLeague] = useState(null)

  const renderPage = () => {
    switch (currentPage) {
      case 'home':          return <Home setCurrentPage={setCurrentPage} setSelectedLeague={setSelectedLeague} />
      case 'add':           return <AddDrink />
      case 'leagues':       return <Ranking selectedLeague={selectedLeague} setSelectedLeague={setSelectedLeague} />
      case 'globalranking': return <GlobalRanking />
      case 'social':        return <Social />
      case 'profile':       return <Profile />
      default:              return null
    }
  }

  return (
    <div>
      {renderPage()}
      <Footer />
      <Navbar currentPage={currentPage} setCurrentPage={setCurrentPage} />
    </div>
  )
}

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" />
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        {/* NotificationsProvider va dentro de AuthProvider porque necesita user */}
        <NotificationsProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}