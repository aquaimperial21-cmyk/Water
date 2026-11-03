import { useEffect, useRef } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './index.css'
import Home from './pages/Home'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import RefundPolicy from './pages/RefundPolicy'
import ShippingPolicy from './pages/ShippingPolicy'
import Warranty from './pages/Warranty'
import DeleteAccount from './pages/DeleteAccount'
import ContactPage from './pages/ContactPage'

// Start every new page at the top; for "/#section" links coming from another
// page, scroll to that section once the home page is on screen.
// The first render is left alone so a reload keeps the browser's own scroll.
function ScrollManager() {
  const { hash, key } = useLocation()
  const lastKey = useRef(key)

  useEffect(() => {
    if (lastKey.current !== key) {
      lastKey.current = key
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
    if (!hash) return
    const id = decodeURIComponent(hash.slice(1))
    const t = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
    return () => clearTimeout(t)
  }, [hash, key])

  return null
}

function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/refund-policy" element={<RefundPolicy />} />
        <Route path="/shipping-policy" element={<ShippingPolicy />} />
        <Route path="/warranty" element={<Warranty />} />
        <Route path="/delete-account" element={<DeleteAccount />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
