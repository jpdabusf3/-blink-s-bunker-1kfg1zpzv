import { useAppContext } from '@/store/AppContext'
import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { Card, CardContent } from '@/components/ui/card'
import { Save } from 'lucide-react'
import { UserFilter } from '@/components/UserFilter'

export default function SWOT() {
  const { factories, updateFactory } = useAppContext()
  const [selectedId, setSelectedId] = useState<string>(factories[0]?.id || '')
  const [salesOwnerFilter, setSalesOwnerFilter] = useState('all')

  const filteredFactories =
    salesOwnerFilter === 'all'
      ? factories
      : factories.filter((f) => f.salesOwner === salesOwnerFilter)
  const factory = filteredFactories.find((f) => f.id === selectedId)

  const handleSave = () => {
    toast({
      title: 'Análise salva',
      description: 'Os dados da matriz SWOT foram atualizados com sucesso.',
    })
  }

  if (factories.length === 0)
    return <div className="p-8 text-center text-muted-foreground">Nenhuma fábrica cadastrada.</div>

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Análise Estratégica SWOT</h1>
          <p className="text-muted-foreground text-sm">
            Avalie forças, fraquezas, oportunidades e ameaças.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <UserFilter
            value={salesOwnerFilter}
            onChange={setSalesOwnerFilter}
            className="w-full sm:w-[200px] bg-card"
          />
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-full sm:w-[300px] bg-card">
              <SelectValue placeholder="Selecione uma fábrica" />
            </SelectTrigger>
            <SelectContent>
              {filteredFactories.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {factory && (
        <div className="space-y-6">
          <Card className="shadow-subtle">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-primary font-bold text-base flex items-center gap-2">
                    S - Forças (Strengths)
                  </Label>
                  <Textarea
                    rows={4}
                    className="resize-none bg-primary/5 border-primary/20"
                    value={factory.swot.strengths}
                    onChange={(e) =>
                      updateFactory(factory.id, {
                        swot: { ...factory.swot, strengths: e.target.value },
                      })
                    }
                    placeholder="Quais as vantagens competitivas da Blink neste cliente?"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-destructive font-bold text-base flex items-center gap-2">
                    W - Fraquezas (Weaknesses)
                  </Label>
                  <Textarea
                    rows={4}
                    className="resize-none bg-destructive/5 border-destructive/20"
                    value={factory.swot.weaknesses}
                    onChange={(e) =>
                      updateFactory(factory.id, {
                        swot: { ...factory.swot, weaknesses: e.target.value },
                      })
                    }
                    placeholder="O que nos desfavorece internamente?"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-accent font-bold text-base flex items-center gap-2">
                    O - Oportunidades (Opportunities)
                  </Label>
                  <Textarea
                    rows={4}
                    className="resize-none bg-accent/5 border-accent/20"
                    value={factory.swot.opportunities}
                    onChange={(e) =>
                      updateFactory(factory.id, {
                        swot: { ...factory.swot, opportunities: e.target.value },
                      })
                    }
                    placeholder="Quais tendências ou mudanças de cenário podemos aproveitar?"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-orange-500 font-bold text-base flex items-center gap-2">
                    T - Ameaças (Threats)
                  </Label>
                  <Textarea
                    rows={4}
                    className="resize-none bg-orange-500/5 border-orange-500/20"
                    value={factory.swot.threats}
                    onChange={(e) =>
                      updateFactory(factory.id, {
                        swot: { ...factory.swot, threats: e.target.value },
                      })
                    }
                    placeholder="O que no ambiente externo pode atrapalhar o negócio?"
                  />
                </div>
              </div>

              <div className="mt-8 pt-6 border-t space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-base font-semibold">Atratividade Geral do Cliente</Label>
                  <span className="font-mono text-xl font-bold text-primary">
                    {factory.swot.generalAttractiveness}%
                  </span>
                </div>
                <Slider
                  max={100}
                  step={1}
                  value={[factory.swot.generalAttractiveness]}
                  onValueChange={(val) =>
                    updateFactory(factory.id, {
                      swot: { ...factory.swot, generalAttractiveness: val[0] },
                    })
                  }
                  className="py-4"
                />
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={handleSave} className="gap-2 px-8">
                  <Save className="w-4 h-4" /> Salvar Análise
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
