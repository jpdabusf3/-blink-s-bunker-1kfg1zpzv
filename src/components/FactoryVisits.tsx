import { useState } from 'react'
import { useAppContext } from '@/store/AppContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/utils'
import { Calendar, DollarSign } from 'lucide-react'

export function FactoryVisits({ factoryId }: { factoryId: string }) {
  const { visits, addVisit } = useAppContext()
  const [isAdding, setIsAdding] = useState(false)

  const factoryVisits = visits
    .filter((v) => v.factoryId === factoryId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    addVisit({
      factoryId,
      date: fd.get('date') as string,
      summary: fd.get('summary') as string,
      potentialValue: Number(fd.get('potentialValue')),
    })
    setIsAdding(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center pb-2 border-b">
        <h3 className="text-sm font-medium">Resumo de Visitas</h3>
        <Button variant="outline" size="sm" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? 'Cancelar' : 'Registrar Visita'}
        </Button>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-muted/30 p-4 rounded-lg border space-y-4">
          <div className="space-y-2">
            <Label>Data da Visita</Label>
            <Input
              type="date"
              name="date"
              defaultValue={new Date().toISOString().split('T')[0]}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Resumo da Visita</Label>
            <Textarea
              name="summary"
              placeholder="Descreva os principais pontos discutidos..."
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Novo Potencial Estimado (R$)</Label>
            <Input
              type="number"
              name="potentialValue"
              placeholder="Ex: 50000"
              min="0"
              step="0.01"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Este valor atualizará o potencial atual da fábrica.
            </p>
          </div>
          <Button type="submit" size="sm" className="w-full sm:w-auto">
            Salvar Visita
          </Button>
        </form>
      )}

      {factoryVisits.length === 0 && !isAdding && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhuma visita registrada para esta fábrica.
        </p>
      )}

      <div className="space-y-3">
        {factoryVisits.map((visit) => (
          <div key={visit.id} className="p-4 border rounded-lg bg-card space-y-2">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                {new Date(visit.date).toLocaleDateString('pt-BR')}
              </div>
              <div className="flex items-center gap-1 text-sm font-medium text-primary">
                <DollarSign className="w-4 h-4" />
                {formatCurrency(visit.potentialValue)}
              </div>
            </div>
            <p className="text-sm mt-2 whitespace-pre-wrap">{visit.summary}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
