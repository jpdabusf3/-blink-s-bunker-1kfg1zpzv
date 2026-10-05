import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Clock,
  Eye,
  Download,
  FileSpreadsheet,
  FileText,
  Monitor,
  Calendar,
  RotateCw,
} from 'lucide-react'
import { formatDataBR, formatMoedaBRL } from '@/lib/corporateDocuments'
import {
  type RelatorioGeradoRecord,
  type RelatorioVendasFiltros,
  type SecaoConteudoId,
  type FormatoRelatorio,
} from '@/services/relatorio-vendas-service'

interface RelatoriosHistoricoSectionProps {
  historico: RelatorioGeradoRecord[]
  loading: boolean
  onVisualizar: (item: RelatorioGeradoRecord) => void
  onBaixarNovamente: (item: RelatorioGeradoRecord) => void
  onRecarregar: () => void
}

export function RelatoriosHistoricoSection({
  historico,
  loading,
  onVisualizar,
  onBaixarNovamente,
  onRecarregar,
}: RelatoriosHistoricoSectionProps) {
  const formatarDataHora = (iso: string): string => {
    try {
      const d = new Date(iso)
      if (isNaN(d.getTime())) return iso
      const dia = String(d.getDate()).padStart(2, '0')
      const mes = String(d.getMonth() + 1).padStart(2, '0')
      const ano = d.getFullYear()
      const hora = String(d.getHours()).padStart(2, '0')
      const min = String(d.getMinutes()).padStart(2, '0')
      return `${dia}/${mes}/${ano} ${hora}:${min}`
    } catch {
      return iso
    }
  }

  const formatarFiltrosAmigavel = (rawFiltros: string): string => {
    try {
      const parsed: RelatorioVendasFiltros = JSON.parse(rawFiltros)
      const partes: string[] = []
      if (parsed.segmentos && parsed.segmentos.length > 0 && parsed.segmentos.length < 4) {
        partes.push(`Segmentos: ${parsed.segmentos.join(', ')}`)
      }
      if (parsed.vendedor && parsed.vendedor !== 'all') {
        partes.push(`Vendedor: ${parsed.vendedor}`)
      }
      if (parsed.estado && parsed.estado !== 'all') {
        partes.push(`UF: ${parsed.estado}`)
      }
      if (partes.length === 0) return 'Geral (sem filtros restritivos)'
      return partes.join(' • ')
    } catch {
      return rawFiltros || '—'
    }
  }

  const getFormatoBadge = (formato: string) => {
    switch (formato) {
      case 'pdf':
        return (
          <Badge
            variant="outline"
            className="text-[10px] gap-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
          >
            <FileText className="w-3 h-3" /> PDF
          </Badge>
        )
      case 'excel':
        return (
          <Badge
            variant="outline"
            className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          >
            <FileSpreadsheet className="w-3 h-3" /> Excel
          </Badge>
        )
      case 'tela':
      default:
        return (
          <Badge
            variant="outline"
            className="text-[10px] gap-1 bg-primary/10 text-primary border-primary/20"
          >
            <Monitor className="w-3 h-3" /> Tela
          </Badge>
        )
    }
  }

  return (
    <Card className="glass-card shadow-card">
      <CardHeader className="pb-3 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Histórico de Relatórios
            </CardTitle>
            <CardDescription className="text-xs">
              Últimos 20 relatórios gerados por você com atualização em tempo real
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRecarregar}
            disabled={loading}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            title="Recarregar histórico"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Recarregar</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {historico.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Nenhum relatório gerado anteriormente.
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px]">Data de Geração</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Filtros Utilizados</TableHead>
                    <TableHead className="w-[100px] text-center">Formato</TableHead>
                    <TableHead className="w-[200px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="text-xs font-mono whitespace-nowrap text-muted-foreground">
                        {formatarDataHora(h.created)}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-foreground">
                        {h.periodo}
                      </TableCell>
                      <TableCell
                        className="text-xs text-muted-foreground max-w-[260px] truncate"
                        title={formatarFiltrosAmigavel(h.filtros)}
                      >
                        {formatarFiltrosAmigavel(h.filtros)}
                      </TableCell>
                      <TableCell className="text-center">{getFormatoBadge(h.formato)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onVisualizar(h)}
                            className="h-7 text-xs gap-1 px-2.5 font-medium"
                          >
                            <Eye className="w-3.5 h-3.5 text-primary" /> Visualizar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onBaixarNovamente(h)}
                            className="h-7 text-xs gap-1 px-2.5 font-medium hover:text-primary"
                          >
                            <Download className="w-3.5 h-3.5" /> Baixar novamente
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-border/40 p-3 space-y-3">
              {historico.map((h) => (
                <div key={h.id} className="pt-3 first:pt-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground">{h.periodo}</span>
                        {getFormatoBadge(h.formato)}
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground block">
                        {formatarDataHora(h.created)}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    {formatarFiltrosAmigavel(h.filtros)}
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onVisualizar(h)}
                      className="h-7 text-xs flex-1 gap-1"
                    >
                      <Eye className="w-3.5 h-3.5 text-primary" /> Visualizar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onBaixarNovamente(h)}
                      className="h-7 text-xs flex-1 gap-1 hover:text-primary"
                    >
                      <Download className="w-3.5 h-3.5" /> Baixar novamente
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
