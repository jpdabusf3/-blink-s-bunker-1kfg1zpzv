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
import NotFound from './pages/NotFound'
import { AppProvider } from './store/AppContext'

const App = () => (
  <BrowserRouter future={{ v7_startTransition: false, v7_relativeSplatPath: false }}>
    <AppProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Index />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/funil" element={<Funil />} />
            <Route path="/swot" element={<SWOT />} />
            <Route path="/matriz" element={<Matriz />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AppProvider>
  </BrowserRouter>
)

export default App
