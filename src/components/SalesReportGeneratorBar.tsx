import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Sparkles,
  Filter,
  Calendar,
  RotateCcw,
  ChevronDown,
  Layers,
  Building2,
  Package,
  MapPin,
  Check,
  History,
} from 'lucide-react'
import { CLIENT_SEGMENTOS, BRAZILIAN_UFS } from '@/lib/cnpj'
import { type SalesReportFilters } from '@/services/sales-report-generator'

interface SalesReportGeneratorBarProps {
  filters: SalesReportFilters
  onFiltersChange: (newFilters: SalesReportFilters) => void
  onGenerate: () => void
  loading: boolean
  clienteOptions: { id: string; nome: string }[]
  familiaOptions: string[]
  ufOptions: string[]
  onToggleHistory?: () => void
  showHistory?: boolean
  historyCount?: number
}

export function SalesReportGeneratorBar({
  filters,
  onFiltersChange,
  onGenerate,
  loading,
  clienteOptions,
  familiaOptions,
  ufOptions,
  onToggleHistory,
  showHistory,
  historyCount = 0,
}: SalesReportGeneratorBarProps) {
  const [segmentPopoverOpen, setSegmentPopoverOpen] = useState(false)

  const handleReset = () => {
    onFiltersChange({
      dataInicio: '',
      dataFim: '',
      segmentos: [],
      clienteId: 'all',
      familiaProduto: 'all',
      uf: 'all',
    })
  }

  const toggleSegmento = (seg: string) => {
    const current = filters.segmentos
    if (current.includes(seg)) {
      onFiltersChange({
        ...filters,
        segmentos: current.filter((s) => s !== seg),
      })
    } else {
      onFiltersChange({
        ...filters,
        segmentos: [...current, seg],
      })
    }
  }

  const isAllSegmentos = filters.segmentos.length === 0

  return (
    <Card className="border shadow-subtle bg-gradient-to-br from-card via-card to-muted/20">
      <CardHeader className="pb-3 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Sparkles className="w-5 h-5" />
              </span>
              <CardTitle className="text-lg font-bold tracking-tight">
                Gerador de Relatórios de Vendas
              </CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure o período e os recortes para emitir relatórios executivos de faturamento.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onToggleHistory && (
              <Button
                variant={showHistory ? 'secondary' : 'outline'}
                size="sm"
                onClick={onToggleHistory}
                className="gap-2 text-xs h-9"
              >
                <History className="w-4 h-4 text-muted-foreground" />
                Histórico de Relatórios
                {historyCount > 0 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 ml-1">
                    {historyCount}
                  </Badge>
                )}
              </Button>
            )}

            {/* Prominent Button "Gerar Relatório" */}
            <Button
              onClick={onGenerate}
              disabled={loading}
              size="default"
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md px-5 h-10 transition-transform active:scale-[0.98]"
            >
              <Sparkles className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Gerando Relatório...' : 'Gerar Relatório'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Filtros em Grade */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {/* Data Início */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              Data Início
            </Label>
            <Input
              type="date"
              value={filters.dataInicio}
              onChange={(e) => onFiltersChange({ ...filters, dataInicio: e.target.value })}
              className="h-9 text-xs"
            />
          </div>

          {/* Data Fim */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              Data Fim
            </Label>
            <Input
              type="date"
              value={filters.dataFim}
              onChange={(e) => onFiltersChange({ ...filters, dataFim: e.target.value })}
              className="h-9 text-xs"
            />
          </div>

          {/* Segmento (Multi-select) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-muted-foreground" />
              Segmento (Multi-select)
            </Label>
            <Popover open={segmentPopoverOpen} onOpenChange={setSegmentPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between text-xs h-9 font-normal px-2.5 overflow-hidden"
                >
                  <span className="truncate">
                    {isAllSegmentos
                      ? 'Todos os segmentos'
                      : filters.segmentos.length === 1
                        ? filters.segmentos[0]
                        : `${filters.segmentos.length} selecionados`}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-50 shrink-0 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-60 p-2 space-y-1 text-xs" align="start">
                <div
                  onClick={() => onFiltersChange({ ...filters, segmentos: [] })}
                  className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer font-medium"
                >
                  <Checkbox checked={isAllSegmentos} />
                  <span>Todos os Segmentos</span>
                </div>
                <div className="border-t my-1 border-border" />
                {CLIENT_SEGMENTOS.map((seg) => {
                  const checked = filters.segmentos.includes(seg)
                  return (
                    <div
                      key={seg}
                      onClick={() => toggleSegmento(seg)}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer"
                    >
                      <Checkbox checked={checked} />
                      <span className="flex-1 font-medium">{seg}</span>
                      {checked && <Check className="w-3.5 h-3.5 text-primary" />}
                    </div>
                  )
                })}
              </PopoverContent>
            </Popover>
          </div>

          {/* Cliente Dropdown */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              Cliente
            </Label>
            <Select
              value={filters.clienteId}
              onValueChange={(val) => onFiltersChange({ ...filters, clienteId: val })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Todos os clientes" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clienteOptions.map((c) => (
                  <SelectItem key={c.id} value={c.nome}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Família / Produto Dropdown */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-muted-foreground" />
              Família / Produto
            </Label>
            <Select
              value={filters.familiaProduto}
              onValueChange={(val) => onFiltersChange({ ...filters, familiaProduto: val })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Todas as famílias" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="all">Todas as famílias</SelectItem>
                {familiaOptions.map((fam) => (
                  <SelectItem key={fam} value={fam}>
                    {fam}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* UF Dropdown */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              Estado (UF)
            </Label>
            <Select
              value={filters.uf}
              onValueChange={(val) => onFiltersChange({ ...filters, uf: val })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Todas as UFs" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="all">Todas as UFs</SelectItem>
                {ufOptions.map((uf) => (
                  <SelectItem key={uf} value={uf}>
                    {uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Resumo dos Filtros & Botão Limpar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground font-medium">Recortes ativos:</span>
            {filters.dataInicio && (
              <Badge variant="secondary" className="text-[11px] font-normal">
                De: {filters.dataInicio}
              </Badge>
            )}
            {filters.dataFim && (
              <Badge variant="secondary" className="text-[11px] font-normal">
                Até: {filters.dataFim}
              </Badge>
            )}
            {filters.segmentos.length > 0 ? (
              <Badge variant="secondary" className="text-[11px] font-normal">
                Segmentos: {filters.segmentos.join(', ')}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
                Todos Segmentos
              </Badge>
            )}
            {filters.clienteId !== 'all' && (
              <Badge variant="secondary" className="text-[11px] font-normal">
                Cliente: {filters.clienteId}
              </Badge>
            )}
            {filters.familiaProduto !== 'all' && (
              <Badge variant="secondary" className="text-[11px] font-normal">
                Família: {filters.familiaProduto}
              </Badge>
            )}
            {filters.uf !== 'all' && (
              <Badge variant="secondary" className="text-[11px] font-normal">
                UF: {filters.uf}
              </Badge>
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs h-7 text-muted-foreground hover:text-foreground gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Limpar Filtros
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
