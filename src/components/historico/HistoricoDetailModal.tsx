import { type DetailModalState } from '@/hooks/useHistorico'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { FileText, X } from 'lucide-react'

interface HistoricoDetailModalProps {
  detailModal: DetailModalState
  onClose: () => void
}

export function HistoricoDetailModal({ detailModal, onClose }: HistoricoDetailModalProps) {
  const { isOpen, title, items, subtotal } = detailModal

  const formatDateBR = (isoDate?: string) => {
    if (!isoDate) return '-'
    const d = isoDate.substring(0, 10).split('-')
    if (d.length === 3) return `${d[2]}/${d[1]}/${d[0]}`
    return isoDate
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <DialogTitle className="text-lg font-bold text-foreground">
              {title || 'Detalhes do Grupo'}
            </DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total de {items.length}{' '}
            {items.length === 1 ? 'documento individual' : 'documentos individuais'} associados
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 pt-2">
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs font-semibold">Número</TableHead>
                  <TableHead className="text-xs font-semibold">Data</TableHead>
                  <TableHead className="text-xs font-semibold">Destinatário</TableHead>
                  <TableHead className="text-xs font-semibold">Vendedor</TableHead>
                  <TableHead className="text-xs font-semibold">Espécie</TableHead>
                  <TableHead className="text-xs font-semibold">Canal</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Valor</TableHead>
                  <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-6 text-xs text-muted-foreground"
                    >
                      Nenhum documento encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((doc, idx) => {
                    const itemValor = doc.produto_valor_total || doc.valor_total_nota || 0
                    return (
                      <TableRow key={doc.id || idx} className="hover:bg-muted/30">
                        <TableCell className="text-xs font-mono font-medium">
                          {doc.numero_documento}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {formatDateBR(doc.data_documento)}
                        </TableCell>
                        <TableCell className="text-xs font-medium max-w-[180px] truncate">
                          {doc.destinatario_nome}
                          {doc.destinatario_uf && (
                            <span className="text-[10px] text-muted-foreground ml-1">
                              ({doc.destinatario_uf})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs max-w-[130px] truncate">
                          {doc.vendedor || '-'}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {doc.especie_destino || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{doc.canal_vendas || '-'}</TableCell>
                        <TableCell className="text-xs text-right font-semibold">
                          {formatCurrency(itemValor)}
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          <Badge
                            variant={doc.status === 'realizado' ? 'default' : 'secondary'}
                            className={`text-[10px] ${
                              doc.status === 'realizado'
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-blue-600/10 text-blue-600 hover:bg-blue-600/20 border border-blue-500/20'
                            }`}
                          >
                            {doc.status === 'realizado' ? 'Realizado' : 'Projetado'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Footer with Subtotal */}
        <DialogFooter className="p-4 border-t border-border bg-muted/30 flex sm:items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Subtotal:
            </span>
            <span className="text-base font-bold text-foreground">{formatCurrency(subtotal)}</span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs gap-1"
          >
            <X className="w-3.5 h-3.5" />
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
