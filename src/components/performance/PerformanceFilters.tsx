import { ESPECIE_OPTIONS, CANAL_VENDAS_OPTIONS } from '@/services/historico-vendas'
import type { GestaoTecnica } from '@/services/gestao-tecnica'
import type { PerformanceFilters as Filters } from '@/services/performance-report'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

interface Props {
  filters: Filters
  onChange: (key: keyof Filters, value: string) => void
  gestores?: GestaoTecnica[]
  vendedores: GestaoTecnica[]
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

export function PerformanceFilters({ filters, onChange, vendedores }: Props) {
  return (
    <Card className="shadow-subtle">
      <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Field label="Vendedor">
          <Select value={filters.vendedorId} onValueChange={(v) => onChange('vendedorId', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {vendedores.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Espécie">
          <Select value={filters.especie} onValueChange={(v) => onChange('especie', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {ESPECIE_OPTIONS.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Canal de Vendas">
          <Select value={filters.canalVendas} onValueChange={(v) => onChange('canalVendas', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {CANAL_VENDAS_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Data Inicial">
          <Input
            type="date"
            value={filters.dataInicial}
            onChange={(e) => onChange('dataInicial', e.target.value)}
          />
        </Field>
        <Field label="Data Final">
          <Input
            type="date"
            value={filters.dataFinal}
            onChange={(e) => onChange('dataFinal', e.target.value)}
          />
        </Field>
      </CardContent>
    </Card>
  )
}
