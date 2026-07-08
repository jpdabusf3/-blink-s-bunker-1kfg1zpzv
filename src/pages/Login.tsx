import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Target } from 'lucide-react'
import { toast } from 'sonner'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'
import { isAllowedDomain } from '@/lib/user-scope'

export default function Login() {
  const navigate = useNavigate()
  const { signIn, signUp } = useAuth()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loginData, setLoginData] = useState({ email: '', password: '' })
  const [regData, setRegData] = useState({
    email: '',
    password: '',
    jobTitle: '',
    stateRegion: '',
    country: 'Brasil',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrors({})

    if (!isAllowedDomain(loginData.email)) {
      toast.error('Access restricted to Blink Biotech employees.')
      setIsSubmitting(false)
      return
    }

    const { error } = await signIn(loginData.email, loginData.password)
    setIsSubmitting(false)

    if (error) {
      toast.error(getErrorMessage(error))
    } else {
      toast.success('Login realizado com sucesso')
      navigate('/')
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrors({})

    if (!isAllowedDomain(regData.email)) {
      toast.error('Access restricted to Blink Biotech employees.')
      setIsSubmitting(false)
      return
    }

    if (!regData.stateRegion) {
      toast.error('Selecione sua região geográfica.')
      setIsSubmitting(false)
      return
    }

    const { error } = await signUp(
      regData.email,
      regData.password,
      regData.jobTitle,
      regData.stateRegion,
      regData.country,
    )
    setIsSubmitting(false)

    if (error) {
      setErrors(extractFieldErrors(error))
      toast.error(getErrorMessage(error))
    } else {
      toast.success('Conta criada com sucesso')
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md bg-card p-8 rounded-xl shadow-lg border">
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="bg-primary p-3 rounded-xl mb-4">
            <Target className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Blink Biotech</h1>
          <p className="text-muted-foreground text-sm">Inteligência Comercial</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="register">Criar Conta</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  required
                  value={loginData.email}
                  onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                  placeholder="seu@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Senha</Label>
                <Input
                  id="login-password"
                  type="password"
                  required
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Entrando...' : 'Entrar na Plataforma'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reg-email">Email Profissional</Label>
                <Input
                  id="reg-email"
                  type="email"
                  required
                  value={regData.email}
                  onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                  placeholder="seu@email.com"
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password">Senha</Label>
                <Input
                  id="reg-password"
                  type="password"
                  required
                  minLength={8}
                  value={regData.password}
                  onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                  placeholder="Mínimo 8 caracteres"
                />
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-job">Cargo (Job Title)</Label>
                <Input
                  id="reg-job"
                  type="text"
                  required
                  value={regData.jobTitle}
                  onChange={(e) => setRegData({ ...regData, jobTitle: e.target.value })}
                  placeholder="Ex: Gerente Comercial"
                />
                {errors.job_title && <p className="text-xs text-destructive">{errors.job_title}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-country">País</Label>
                <Select
                  value={regData.country}
                  onValueChange={(val) => setRegData({ ...regData, country: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Brasil">Brasil</SelectItem>
                    <SelectItem value="Argentina">Argentina</SelectItem>
                    <SelectItem value="Uruguai">Uruguai</SelectItem>
                    <SelectItem value="Paraguai">Paraguai</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-region">Região Geográfica *</Label>
                <Select
                  value={regData.stateRegion}
                  onValueChange={(val) => setRegData({ ...regData, stateRegion: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione sua região" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      'Sul',
                      'Norte',
                      'Oeste',
                      'Leste',
                      'Nordeste',
                      'Noroeste',
                      'Sudeste',
                      'Sudoeste',
                      'Centro',
                    ].map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Criando...' : 'Criar Conta'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
