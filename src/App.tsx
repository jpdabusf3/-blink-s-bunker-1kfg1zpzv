import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Layout from './components/Layout'
import Index from './pages/Index'
import Cadastro from './pages/Cadastro'
import Funil from './pages/Funil'
import FunilVendas from './pages/FunilVendas'
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
import ImportarClientes from './pages/ImportarClientes'
import RelatorioAtividades from './pages/RelatorioAtividades'
import PerformanceReport from './pages/PerformanceReport'
import { SuperAdminRoute } from './components/SuperAdminRoute'
import { lazy, Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { ThemeProvider } from './components/ThemeProvider'

const Historico = lazy(() => import('./pages/Historico'))
const HistoricoFunil = lazy(() => import('./pages/HistoricoFunil'))
const ConfiguracoesLayout = lazy(() => import('./pages/ConfiguracoesLayout'))
const UploadNF = lazy(() => import('./pages/UploadNF'))

function PageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

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
                    <Route
                      path="/historico-funil"
                      element={
                        <Suspense fallback={<PageSkeleton />}>
                          <HistoricoFunil />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/configuracoes-layout"
                      element={
                        <Suspense fallback={<PageSkeleton />}>
                          <ConfiguracoesLayout />
                        </Suspense>
                      }
                    />
                    <Route path="/" element={<Index />} />
                    <Route path="/cadastro" element={<Cadastro />} />
                    <Route path="/funil" element={<Funil />} />
                    <Route path="/funil-vendas" element={<FunilVendas />} />
                    <Route path="/swot" element={<SWOT />} />
                    <Route path="/matriz" element={<Matriz />} />
                    <Route
                      path="/upload-nf"
                      element={
                        <Suspense
                          fallback={
                            <div className="p-8">
                              <div className="h-8 w-48 bg-muted animate-pulse rounded mb-4" />
                              <div className="h-64 w-full bg-muted animate-pulse rounded" />
                            </div>
                          }
                        >
                          <UploadNF />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/historico"
                      element={
                        <Suspense fallback={<PageSkeleton />}>
                          <Historico />
                        </Suspense>
                      }
                    />
                    <Route path="/pedidos" element={<Pedidos />} />
                    <Route path="/historico-vendas" element={<HistoricoVendas />} />
                    <Route path="/metas" element={<Metas />} />
                    <Route path="/relatorios" element={<Relatorios />} />
                    <Route path="/gestao-tecnica" element={<GestaoTecnica />} />
                    <Route path="/atividades" element={<Atividades />} />
                    <Route path="/importar-clientes" element={<ImportarClientes />} />
                    <Route path="/relatorio-atividades" element={<RelatorioAtividades />} />
                    <Route path="/relatorio-performance" element={<PerformanceReport />} />
                    <Route path="/usuarios" element={<UsersPage />} />
                    <Route path="/documentos" element={<Documents />} />
                    <Route element={<SuperAdminRoute />}>
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
