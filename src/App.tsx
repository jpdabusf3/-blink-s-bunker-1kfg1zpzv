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
import Metas from './pages/Metas'
import NotFound from './pages/NotFound'
import Login from './pages/Login'
import { AppProvider } from './store/AppContext'
import { AuthProvider } from './hooks/use-auth'
import { I18nProvider } from './hooks/use-i18n'
import { ProtectedRoute } from './components/ProtectedRoute'
import Relatorios from './pages/Relatorios'
import AdminLogs from './pages/AdminLogs'
import { ManagerRoute } from './components/ManagerRoute'
import { ThemeProvider } from './components/ThemeProvider'

const App = () => (
  <ThemeProvider defaultTheme="system" storageKey="blink-theme" attribute="class">
    <BrowserRouter future={{ v7_startTransition: false, v7_relativeSplatPath: false }}>
      <AuthProvider>
        <I18nProvider>
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
                    <Route path="/metas" element={<Metas />} />
                    <Route path="/relatorios" element={<Relatorios />} />
                    <Route element={<ManagerRoute />}>
                      <Route path="/admin/logs" element={<AdminLogs />} />
                    </Route>
                  </Route>
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </TooltipProvider>
          </AppProvider>
        </I18nProvider>
      </AuthProvider>
    </BrowserRouter>
  </ThemeProvider>
)

export default App
