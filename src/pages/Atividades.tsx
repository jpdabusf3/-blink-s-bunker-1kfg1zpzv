import { useState, useEffect, useCallback } from 'react'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import type { Atividade } from '@/types'
import { OriginIndicator } from '@/components/OriginIndicator'
import { AtividadeForm } from '@/components/AtividadeForm'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Loader2, FileDown, Loader } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { downloadAtividadePdf } from '@/services/atividades'
import { toast } from 'sonner'

export default function Atividades() {
  const [atividades, setAtividades] = useState<Atividade[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await pb.collection('atividades').getFullList({
        sort: '-created',
        expand: 'cliente_id,vendedor_id',
      })
      setAtividades(data as unknown as Atividade[])
    } catch {
      /* noop */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useRealtime('atividades', () => {
    load()
  })

  const handleDownloadPdf = async (a: Atividade) => {
    setDownloadingId(a.id)
    try {
      const clientName = a.expand?.cliente_id?.name || 'atividade'
      await downloadAtividadePdf(a.id, clientName)
      toast.success('PDF gerado com sucesso')
      load()
    } catch {
      toast.error('Erro ao gerar PDF')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="space-y-4 animate-fade-in pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Atividades</h1>
          <p className="text-muted-foreground text-sm">
            Registro centralizado de atividades comerciais por origem
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> Registrar atividade
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center h-40 items-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden shadow-subtle">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Próximo passo</TableHead>
                  <TableHead className="text-right">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atividades.map((a) => (
                  <TableRow key={a.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(a.created).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {a.expand?.cliente_id?.name || '—'}
                      {a.expand?.cliente_id?.city && (
                        <span className="text-xs text-muted-foreground block">
                          {a.expand.cliente_id.city}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{a.expand?.vendedor_id?.name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {a.tipo_atividade}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{a.etapa_funil}</TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {a.valor_estimado ? formatCurrency(a.valor_estimado) : '—'}
                    </TableCell>
                    <TableCell>
                      <OriginIndicator origem={a.origem} />
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">
                      {a.proximo_passo || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDownloadPdf(a)}
                        disabled={downloadingId === a.id}
                        title="Baixar PDF da visita"
                      >
                        {downloadingId === a.id ? (
                          <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                          <FileDown className="w-4 h-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {atividades.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">
                      Nenhuma atividade registrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Atividade</DialogTitle>
          </DialogHeader>
          <AtividadeForm
            onSuccess={() => {
              setShowForm(false)
              load()
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
