import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { COUNTRIES } from '@/lib/countries'
import { createSeller } from '@/services/sellers'
import type { GestaoFuncao } from '@/services/gestao-tecnica'
import { extractFieldErrors, getErrorMessage, type FieldErrors } from '@/lib/pocketbase/errors'
import { toast } from 'sonner'
import { Loader2, Copy } from 'lucide-react'

interface SellerRegistrationFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function SellerRegistrationForm({
  open,
  onOpenChange,
  onSuccess,
}: SellerRegistrationFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState('Brasil')
  const [geographicArea, setGeographicArea] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [funcao, setFuncao] = useState<GestaoFuncao>('vendedor')
  const [subclassificacao, setSubclassificacao] = useState<string>('none')
  const [canalVendas, setCanalVendas] = useState<string>('none')
  const [whatsapp, setWhatsapp] = useState('')
  const [whatsappValidated, setWhatsappValidated] = useState(false)

  const selectedCountry = COUNTRIES.find((c) => c.name === country)

  useEffect(() => {
    if (!open) {
      setName('')
      setEmail('')
      setCountry('Brasil')
      setGeographicArea('')
      setFuncao('vendedor')
      setSubclassificacao('none')
      setCanalVendas('none')
      setWhatsapp('')
      setWhatsappValidated(false)
      setFieldErrors({})
      setGeneratedPassword('')
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors({})

    if (!name.trim() || !email.trim()) {
      const errors: FieldErrors = {}
      if (!name.trim()) errors.name = 'Nome é obrigatório'
      if (!email.trim()) errors.email = 'Email é obrigatório'
      setFieldErrors(errors)
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldErrors({ email: 'Formato de email inválido' })
      return
    }

    setSubmitting(true)
    try {
      const result = await createSeller({
        name: name.trim(),
        email: email.trim(),
        geographicArea,
        country,
        funcao,
        subclassificacao:
          funcao === 'gestor_comercial' && subclassificacao !== 'none' ? subclassificacao : '',
        canal_vendas: canalVendas !== 'none' ? canalVendas : '',
        whatsapp: whatsapp.trim(),
        whatsapp_validated: whatsappValidated,
      })
      setGeneratedPassword(result.password)
      toast.success('Vendedor cadastrado com sucesso! Senha temporária gerada.')
      onSuccess()
    } catch (err) {
      const errors = extractFieldErrors(err)
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors)
      } else {
        toast.error(getErrorMessage(err))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(generatedPassword)
    toast.success('Senha copiada para a área de transferência.')
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar Vendedor</DialogTitle>
        </DialogHeader>
        {generatedPassword ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Vendedor cadastrado com sucesso! O vendedor está com status{' '}
              <span className="font-semibold text-foreground">Desativado</span> e precisa ser
              ativado pelo gestor. Compartilhe a senha temporária abaixo:
            </p>
            <div className="flex items-center gap-2 bg-muted/30 p-3 rounded-lg border">
              <code className="flex-1 text-sm font-mono break-all">{generatedPassword}</code>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyPassword}
                className="shrink-0"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <Button onClick={handleClose} className="w-full">
              Concluir
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="seller-name">Nome Completo *</Label>
              <Input
                id="seller-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do vendedor"
              />
              {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="seller-email">Email *</Label>
              <Input
                id="seller-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@blinkbiotech.com"
              />
              {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="seller-country">País</Label>
              <Select
                value={country}
                onValueChange={(v) => {
                  setCountry(v)
                  setGeographicArea('')
                }}
              >
                <SelectTrigger id="seller-country">
                  <SelectValue />
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
              <Label htmlFor="seller-region">Região</Label>
              {selectedCountry?.regions ? (
                <Select value={geographicArea} onValueChange={setGeographicArea}>
                  <SelectTrigger id="seller-region">
                    <SelectValue placeholder="Selecione a região" />
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
                  id="seller-region"
                  value={geographicArea}
                  onChange={(e) => setGeographicArea(e.target.value)}
                  placeholder="Região"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="seller-whatsapp">WhatsApp</Label>
              <Input
                id="seller-whatsapp"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+55 (00) 00000-0000"
                inputMode="tel"
              />
            </div>
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
              <Checkbox
                id="seller-whatsapp-validated"
                checked={whatsappValidated}
                onCheckedChange={(v) => setWhatsappValidated(v === true)}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <Label htmlFor="seller-whatsapp-validated" className="cursor-pointer">
                  Validado por WhatsApp
                </Label>
                <p className="text-xs text-muted-foreground">
                  Marque se o número de WhatsApp informado foi validado.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cadastrar Vendedor'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
