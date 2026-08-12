import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import type { GestaoTecnica } from '@/services/gestao-tecnica'
import { CANAL_VENDAS_OPTIONS, type Meta } from '@/services/metas'

const ESPECIES = ['BOVINO', 'SUINO', 'AVE', 'PET', 'AQUA']
const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]
const CURRENT_PERIOD = `${MONTHS_PT[new Date().getMonth()]} ${new Date().getFullYear()}`

const metaSchema = z.object({
  vendedor_id: z.string().min(1, 'Vendedor é obrigatório'),
  gestor_tecnico_id: z.string(),
  especie: z.string(),
  canal_vendas: z.string(),
  periodo: z.string().min(1, 'Período é obrigatório'),
  meta_valor: z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
  acrescimo_percentual: z.coerce.number().min(0).optional(),
  decrecimo_percentual: z.coerce.number().min(0).optional(),
})

export type MetaFormValues = z.infer<typeof metaSchema>

interface MetaFormProps {
  onSubmit: (data: MetaFormValues) => void
  initialData?: Meta | null
  vendedores: GestaoTecnica[]
  gestores: GestaoTecnica[]
  onCancel: () => void
}

export function MetaForm({ onSubmit, initialData, vendedores, gestores, onCancel }: MetaFormProps) {
  const form = useForm<MetaFormValues>({
    resolver: zodResolver(metaSchema),
    defaultValues: {
      vendedor_id: initialData?.vendedor_id || '',
      gestor_tecnico_id: initialData?.gestor_tecnico_id || 'all',
      especie: initialData?.especie || 'all',
      canal_vendas: initialData?.canal_vendas || 'all',
      periodo: initialData?.periodo || CURRENT_PERIOD,
      meta_valor: initialData?.meta_valor || 0,
      acrescimo_percentual: initialData?.acrescimo_percentual || 0,
      decrecimo_percentual: initialData?.decrecimo_percentual || 0,
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="vendedor_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vendedor *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {vendedores.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="gestor_tecnico_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gestor Técnico</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {gestores.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="especie"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Espécie</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {ESPECIES.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="canal_vendas"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Canal de Vendas</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {CANAL_VENDAS_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="periodo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Período *</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Agosto 2026" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="meta_valor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Meta (R$) *</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="acrescimo_percentual"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Acréscimo (%)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="decrecimo_percentual"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Decréscimo (%)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">Salvar</Button>
        </div>
      </form>
    </Form>
  )
}
