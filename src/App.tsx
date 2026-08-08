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
import HistoricoVendas from './pages/HistoricoVendas'
import Relatorios from './pages/Relatorios'
import Documents from './pages/Documents'
import AdminLogs from './pages/AdminLogs'
import UsersPage from './pages/Users'
import TeamManagement from './pages/TeamManagement'
import GestaoTecnica from './pages/GestaoTecnica'
import Atividades from './pages/Atividades'
import RelatorioAtividades from './pages/RelatorioAtividades'
import PerformanceReport from './pages/PerformanceReport'
import { SuperAdminRoute } from './components/SuperAdminRoute'
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
                    <Route path="/historico-vendas" element={<HistoricoVendas />} />
                    <Route path="/metas" element={<Metas />} />
                    <Route path="/relatorios" element={<Relatorios />} />
                    <Route path="/gestao-tecnica" element={<GestaoTecnica />} />
                    <Route path="/atividades" element={<Atividades />} />
                    <Route path="/relatorio-atividades" element={<RelatorioAtividades />} />
                    <Route path="/relatorio-performance" element={<PerformanceReport />} />
                    <Route path="/documentos" element={<Documents />} />
                    <Route element={<SuperAdminRoute />}>
                      <Route path="/usuarios" element={<UsersPage />} />
                      <Route path="/equipe" element={<TeamManagement />} />
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
