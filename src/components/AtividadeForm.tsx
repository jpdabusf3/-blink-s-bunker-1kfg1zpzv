import { useState, useEffect, type FormEvent } from 'react'
import { getUsers, type UserListItem } from '@/services/users'
import { validarEGravar, type ValidarEGravarRequest } from '@/services/atividades'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useFunnelActivityLog } from '@/hooks/use-funnel-activity-log'

const TIPOS = [
  { value: 'visita', label: 'Visita' },
  { value: 'ligacao', label: 'Ligação' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'pedido', label: 'Pedido' },
  { value: 'outro', label: 'Outro' },
]

const CARTEIRAS = [
  { value: '', label: 'Não informada' },
  { value: 'AVES', label: 'Aves' },
  { value: 'PETS', label: 'Pets' },
  { value: 'RUMINANTES', label: 'Ruminantes' },
  { value: 'SUINOS', label: 'Suínos' },
  { value: 'AQUA', label: 'Aqua' },
]

const GRUPOS_CLIENTE = [
  { value: '', label: 'Não informado' },
  { value: 'Indústrias', label: 'Indústrias' },
  { value: 'Distribuidores Diretos', label: 'Distribuidores Diretos' },
  { value: 'Produtores Diretos', label: 'Produtores Diretos' },
  { value: 'Premixeras', label: 'Premixeras' },
  { value: 'Cooperativas', label: 'Cooperativas' },
]

const ETAPAS = [
  { value: 'prospeccao', label: 'Prospecção' },
  { value: 'qualificacao', label: 'Qualificação' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'fechamento', label: 'Fechamento' },
  { value: 'pos_venda', label: 'Pós-venda' },
]

interface AtividadeFormProps {
  onSuccess?: () => void
}

export function AtividadeForm({ onSuccess }: AtividadeFormProps) {
  const { logAction } = useFunnelActivityLog()
  const [users, setUsers] = useState<UserListItem[]>([])
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
  const [tipoAtividade, setTipoAtividade] = useState('')
  const [etapaFunil, setEtapaFunil] = useState('')
  const [vendedorId, setVendedorId] = useState('')
  const [carteira, setCarteira] = useState('')
  const [grupoCliente, setGrupoCliente] = useState('')

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFieldErrors({})
    setLoading(true)

    const fd = new FormData(e.currentTarget)
    const data: ValidarEGravarRequest = {
      origem: 'manual',
      cliente: {
        nome: (fd.get('clienteNome') as string) || null,
        cnpj: (fd.get('clienteCnpj') as string) || null,
        cidade: (fd.get('clienteCidade') as string) || null,
        estado: (fd.get('clienteEstado') as string) || null,
      },
      vendedor_id: vendedorId || undefined,
      vendedor: users.find((u) => u.id === vendedorId)?.name || null,
      tipo_atividade: tipoAtividade,
      etapa_funil: etapaFunil,
      valor_estimado: Number(fd.get('valorEstimado')) || 0,
      descricao: (fd.get('descricao') as string) || '',
      proximo_passo: (fd.get('proximoPasso') as string) || '',
      data_proxima_acao: (fd.get('dataProximaAcao') as string) || '',
      pendencias: (fd.get('pendencias') as string) || '',
      carteira: carteira || undefined,
      grupo_cliente: grupoCliente || undefined,
    }

    try {
      const result = await validarEGravar(data)
      if (result.precisa_confirmacao) {
        toast.info('Atividade marcada para confirmação.')
      } else {
        toast.success('Atividade registrada com sucesso!')
      }
      // Funnel activity log: activity registered
      logAction({
        action_type: 'create',
        entity_type: 'action_plan',
        entity_id: result.atividade_id || result.cliente_id || '',
        entity_name: data.cliente.nome || '',
        description: `Registrou atividade (${data.tipo_atividade})${data.cliente.nome ? ` para ${data.cliente.nome}` : ''}`,
      })
      onSuccess?.()
    } catch (err) {
      const errors = extractFieldErrors(err)
      setFieldErrors(errors)
      if (Object.keys(errors).length === 0) {
        toast.error('Erro ao registrar atividade')
      }
    } finally {
      setLoading(false)
    }
  }

  const errClass = 'text-xs text-destructive mt-0.5'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Cliente *</Label>
          <Input name="clienteNome" placeholder="Nome do cliente" />
          {fieldErrors['cliente'] && <p className={errClass}>{fieldErrors['cliente']}</p>}
          {fieldErrors['cliente.nome'] && <p className={errClass}>{fieldErrors['cliente.nome']}</p>}
        </div>
        <div className="space-y-1">
          <Label>CNPJ</Label>
          <Input name="clienteCnpj" placeholder="00.000.000/0000-00" />
        </div>
        <div className="space-y-1">
          <Label>Cidade</Label>
          <Input name="clienteCidade" placeholder="Cidade" />
        </div>
        <div className="space-y-1">
          <Label>Estado</Label>
          <Input name="clienteEstado" placeholder="UF" />
        </div>
        <div className="space-y-1">
          <Label>Vendedor *</Label>
          <Select value={vendedorId} onValueChange={setVendedorId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name || u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors['vendedor'] && <p className={errClass}>{fieldErrors['vendedor']}</p>}
        </div>
        <div className="space-y-1">
          <Label>Tipo de Atividade *</Label>
          <Select value={tipoAtividade} onValueChange={setTipoAtividade}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {TIPOS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors['tipo_atividade'] && (
            <p className={errClass}>{fieldErrors['tipo_atividade']}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Etapa do Funil *</Label>
          <Select value={etapaFunil} onValueChange={setEtapaFunil}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {ETAPAS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors['etapa_funil'] && <p className={errClass}>{fieldErrors['etapa_funil']}</p>}
        </div>
        <div className="space-y-1">
          <Label>Valor Estimado (R$)</Label>
          <Input type="number" name="valorEstimado" placeholder="0" />
        </div>
        <div className="space-y-1">
          <Label>Data Próxima Ação</Label>
          <Input type="date" name="dataProximaAcao" />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label>Descrição</Label>
          <Textarea name="descricao" placeholder="Resumo da atividade..." className="h-16" />
        </div>
        <div className="space-y-1">
          <Label>Próximo Passo</Label>
          <Input name="proximoPasso" placeholder="Próxima ação" />
        </div>
        <div className="space-y-1">
          <Label>Pendências</Label>
          <Input name="pendencias" placeholder="Pendências (separadas por ;)" />
        </div>
        <div className="space-y-1">
          <Label>Carteira (Segmento)</Label>
          <Select value={carteira} onValueChange={setCarteira}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {CARTEIRAS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Grupo de Cliente</Label>
          <Select value={grupoCliente} onValueChange={setGrupoCliente}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {GRUPOS_CLIENTE.map((g) => (
                <SelectItem key={g.value} value={g.value}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => onSuccess?.()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading} className="gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Registrar atividade
        </Button>
      </div>
    </form>
  )
}
