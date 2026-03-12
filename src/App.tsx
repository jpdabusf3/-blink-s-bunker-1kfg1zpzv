import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Layout from './components/Layout'
import Index from './pages/Index'
import Cadastro from './pages/Cadastro'
import Funil from './pages/Funil'
import SWOT from './pages/SWOT'
import Matriz from './pages/Matriz'
import Pedidos from './pages/Pedidos'
import NotFound from './pages/NotFound'
import Login from './pages/Login'
import { AppProvider } from './store/AppContext'
import { AuthProvider } from './store/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'

const App = () => (
  <BrowserRouter future={{ v7_startTransition: false, v7_relativeSplatPath: false }}>
    <AuthProvider>
      <AppProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Index />} />
                <Route path="/cadastro" element={<Cadastro />} />
                <Route path="/funil" element={<Funil />} />
                <Route path="/swot" element={<SWOT />} />
                <Route path="/matriz" element={<Matriz />} />
                <Route path="/pedidos" element={<Pedidos />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AppProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
