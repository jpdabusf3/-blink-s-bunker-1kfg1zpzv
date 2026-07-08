import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/hooks/use-i18n'
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
import { COUNTRIES } from '@/lib/countries'

export default function Login() {
  const navigate = useNavigate()
  const { signIn, signUp } = useAuth()
  const { t } = useI18n()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loginData, setLoginData] = useState({ email: '', password: '' })
  const [regData, setRegData] = useState({
    email: '',
    password: '',
    jobTitle: '',
    country: 'Brasil',
    stateRegion: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const selectedCountry = COUNTRIES.find((c) => c.name === regData.country)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrors({})
    if (!isAllowedDomain(loginData.email)) {
      toast.error(t('login.domainErr'))
      setIsSubmitting(false)
      return
    }
    const { error } = await signIn(loginData.email, loginData.password)
    setIsSubmitting(false)
    if (error) {
      toast.error(getErrorMessage(error))
    } else {
      toast.success(t('login.loginOk'))
      navigate('/')
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrors({})
    if (!isAllowedDomain(regData.email)) {
      toast.error(t('login.domainErr'))
      setIsSubmitting(false)
      return
    }
    if (!regData.jobTitle) {
      toast.error(t('login.selJob'))
      setIsSubmitting(false)
      return
    }
    if (!regData.stateRegion) {
      toast.error(t('login.selRegion'))
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
      toast.success(t('login.regOk'))
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
          <h1 className="text-2xl font-bold">{t('login.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('login.subtitle')}</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="login">{t('login.signIn')}</TabsTrigger>
            <TabsTrigger value="register">{t('login.create')}</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">{t('login.email')}</Label>
                <Input
                  id="login-email"
                  type="email"
                  required
                  value={loginData.email}
                  onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                  placeholder={t('login.emailPh')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">{t('login.password')}</Label>
                <Input
                  id="login-password"
                  type="password"
                  required
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? t('login.signingIn') : t('login.signInBtn')}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reg-email">{t('login.emailProf')}</Label>
                <Input
                  id="reg-email"
                  type="email"
                  required
                  value={regData.email}
                  onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                  placeholder={t('login.emailPh')}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password">{t('login.password')}</Label>
                <Input
                  id="reg-password"
                  type="password"
                  required
                  minLength={8}
                  value={regData.password}
                  onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                  placeholder={t('login.passPh')}
                />
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-job">{t('login.job')} *</Label>
                <Select
                  value={regData.jobTitle}
                  onValueChange={(val) => setRegData({ ...regData, jobTitle: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('login.jobPh')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CEO">CEO</SelectItem>
                    <SelectItem value="Diretor">Diretor</SelectItem>
                    <SelectItem value="Gestor">Gestor</SelectItem>
                    <SelectItem value="Gerente">Gerente</SelectItem>
                    <SelectItem value="Representante">Representante</SelectItem>
                    <SelectItem value="Analista">Analista</SelectItem>
                    <SelectItem value="Vendedor">Vendedor</SelectItem>
                    <SelectItem value="Consultor">Consultor</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
                {errors.job_title && <p className="text-xs text-destructive">{errors.job_title}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-country">{t('login.country')}</Label>
                <Select
                  value={regData.country}
                  onValueChange={(val) => setRegData({ ...regData, country: val, stateRegion: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('login.country')} />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-region">{t('login.region')} *</Label>
                {selectedCountry?.regions ? (
                  <Select
                    value={regData.stateRegion}
                    onValueChange={(val) => setRegData({ ...regData, stateRegion: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('login.regionPh')} />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedCountry.regions.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="reg-region"
                    value={regData.stateRegion}
                    onChange={(e) => setRegData({ ...regData, stateRegion: e.target.value })}
                    placeholder={t('login.regionPh')}
                  />
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? t('login.creating') : t('login.createBtn')}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
