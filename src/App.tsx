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
import GestaoPedidos from './pages/GestaoPedidos'
import Metas from './pages/Metas'
import NotFound from './pages/NotFound'
import Login from './pages/Login'
import { AppProvider } from './store/AppContext'
import { AuthProvider } from './hooks/use-auth'
import { I18nProvider } from './hooks/use-i18n'
import { RealtimeDataProvider } from './hooks/useRealtimeData'
import { GlobalDataProvider } from './store/GlobalDataProvider'
import { ProtectedRoute } from './components/ProtectedRoute'
import HistoricoVendas from './pages/HistoricoVendas'
import Relatorios from './pages/Relatorios'
import Documents from './pages/Documents'
import RelatoriosAutomaticos from './pages/RelatoriosAutomaticos'
import RelatorioVendasPage from './pages/RelatorioVendasPage'
import AdminLogs from './pages/AdminLogs'
import MapaClientes from './pages/MapaClientes'
import UsersPage from './pages/Users'
import TeamManagement from './pages/TeamManagement'
import Atividades from './pages/Atividades'
import ImportarFaturamento from './pages/ImportarFaturamento'
import RelatorioAtividades from './pages/RelatorioAtividades'
import PerformanceReport from './pages/PerformanceReport'
import { SuperAdminRoute } from './components/SuperAdminRoute'
import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, RotateCw } from 'lucide-react'
import { ThemeProvider } from './components/ThemeProvider'

const Historico = lazy(() => import('./pages/Historico'))
const HistoricoFunil = lazy(() => import('./pages/HistoricoFunil'))

const Produtos = lazy(() => import('./pages/Produtos'))
const Resumo = lazy(() => import('./pages/Resumo'))
const Maestro = lazy(() => import('./pages/Maestro'))
const AgendaSemanal = lazy(() => import('./pages/AgendaSemanal'))
const Migracao = lazy(() => import('./pages/Migracao'))

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

class RouteErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('RouteErrorBoundary capturou um erro:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">
              Erro ao carregar a pagina. Tente novamente.
            </h2>
            <p className="text-sm text-muted-foreground">
              Ocorreu uma falha inesperada ao exibir este módulo.
            </p>
          </div>
          <Button onClick={this.handleReload} variant="default" className="gap-2">
            <RotateCw className="w-4 h-4" /> Recarregar página
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}

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
    <BrowserRouter>
      <AuthProvider>
        <I18nProvider>
          <AppProvider>
            <RealtimeDataProvider>
              <GlobalDataProvider>
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

                        <Route path="/" element={<Index />} />
                        <Route
                          path="/maestro"
                          element={
                            <Suspense fallback={<PageSkeleton />}>
                              <Maestro />
                            </Suspense>
                          }
                        />
                        <Route path="/cadastro" element={<Cadastro />} />
                        <Route path="/clientes" element={<Cadastro />} />
                        <Route path="/mapa" element={<MapaClientes />} />
                        <Route path="/funil" element={<Funil />} />
                        <Route path="/funil-vendas" element={<FunilVendas />} />
                        <Route path="/swot" element={<SWOT />} />
                        <Route path="/matriz" element={<Matriz />} />
                        <Route
                          path="/agenda"
                          element={
                            <Suspense fallback={<PageSkeleton />}>
                              <AgendaSemanal />
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
                        <Route path="/gestao-pedidos" element={<GestaoPedidos />} />
                        <Route
                          path="/produtos"
                          element={
                            <Suspense fallback={<PageSkeleton />}>
                              <Produtos />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/resumo"
                          element={
                            <Suspense fallback={<PageSkeleton />}>
                              <Resumo />
                            </Suspense>
                          }
                        />
                        <Route path="/historico-vendas" element={<HistoricoVendas />} />
                        <Route path="/relatorio-vendas" element={<RelatorioVendasPage />} />
                        <Route path="/metas" element={<Metas />} />
                        <Route path="/relatorios" element={<Relatorios />} />
                        <Route path="/relatorios-automaticos" element={<RelatoriosAutomaticos />} />
                        <Route path="/atividades" element={<Atividades />} />
                        <Route path="/importar-faturamento" element={<ImportarFaturamento />} />
                        <Route path="/relatorio-atividades" element={<RelatorioAtividades />} />
                        <Route path="/relatorio-performance" element={<PerformanceReport />} />
                        <Route path="/usuarios" element={<UsersPage />} />
                        <Route path="/documentos" element={<Documents />} />
                        <Route
                          path="/migracao"
                          element={
                            <Suspense fallback={<PageSkeleton />}>
                              <Migracao />
                            </Suspense>
                          }
                        />
                        <Route element={<SuperAdminRoute />}>
                          <Route path="/equipe" element={<TeamManagement />} />
                          <Route path="/admin/logs" element={<AdminLogs />} />
                        </Route>
                      </Route>
                    </Route>

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </TooltipProvider>
              </GlobalDataProvider>
            </RealtimeDataProvider>
          </AppProvider>
        </I18nProvider>
      </AuthProvider>
    </BrowserRouter>
  </ThemeProvider>
)

export default App
