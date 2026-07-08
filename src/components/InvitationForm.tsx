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
import { createInvitation } from '@/services/invitations'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

const ROLES = ['CEO', 'Diretor', 'Gestor', 'Gerente', 'Manager', 'Vendedor', 'Comum']

interface InvitationFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function InvitationForm({ open, onOpenChange, onSuccess }: InvitationFormProps) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [country, setCountry] = useState('Brasil')
  const [geographicArea, setGeographicArea] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selectedCountry = COUNTRIES.find((c) => c.name === country)

  useEffect(() => {
    if (!open) {
      setEmail('')
      setName('')
      setRole('')
      setCountry('Brasil')
      setGeographicArea('')
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !name.trim() || !role) {
      toast.error('Preencha todos os campos obrigatórios.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Formato de email inválido.')
      return
    }
    setSubmitting(true)
    try {
      await createInvitation({
        email: email.trim(),
        name: name.trim(),
        role,
        country,
        geographicArea,
      })
      toast.success('Convite enviado com sucesso!')
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar Usuário</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inv-email">Email *</Label>
            <Input
              id="inv-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@blinkbiotech.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-name">Nome Completo *</Label>
            <Input
              id="inv-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do convidado"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-role">Cargo / Função *</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="inv-role">
                <SelectValue placeholder="Selecione o cargo" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-country">País</Label>
            <Select
              value={country}
              onValueChange={(v) => {
                setCountry(v)
                setGeographicArea('')
              }}
            >
              <SelectTrigger id="inv-country">
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
            <Label htmlFor="inv-region">Região</Label>
            {selectedCountry?.regions ? (
              <Select value={geographicArea} onValueChange={setGeographicArea}>
                <SelectTrigger id="inv-region">
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
                id="inv-region"
                value={geographicArea}
                onChange={(e) => setGeographicArea(e.target.value)}
                placeholder="Região"
              />
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar Convite'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
