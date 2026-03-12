import { useLocation, Link } from 'react-router-dom'
import { useEffect } from 'react'
import { Target } from 'lucide-react'
import { Button } from '@/components/ui/button'

const NotFound = () => {
  const location = useLocation()

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname)
  }, [location.pathname])

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center bg-background p-4 animate-fade-in">
      <Target className="w-16 h-16 text-muted mb-6" />
      <h1 className="text-4xl font-bold mb-2 text-foreground">404</h1>
      <p className="text-lg text-muted-foreground mb-8 text-center max-w-md">
        Página não encontrada. O destino procurado não existe na plataforma Blink.
      </p>
      <Button asChild size="lg">
        <Link to="/">Voltar ao Início</Link>
      </Button>
    </div>
  )
}

export default NotFound
