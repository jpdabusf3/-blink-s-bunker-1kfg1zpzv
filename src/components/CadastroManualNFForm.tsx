import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Trash2, Loader2, Save, AlertCircle, Sparkles } from 'lucide-react'
import { useNFManualForm } from '@/hooks/useNFManualForm'
import {
  BLINK_CATALOG_PRODUCTS,
  BLINK_UF_LIST,
  BLINK_ESPECIE_MANUAL_OPTIONS,
  BLINK_CANAL_MANUAL_OPTIONS,
} from '@/constants/blinkProducts'
import { formatCurrency } from '@/lib/utils'
import { useRealtimeDataContext } from '@/hooks/useRealtimeData'

interface CadastroManualNFFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export function CadastroManualNFForm({ onSuccess, onCancel }: CadastroManualNFFormProps) {
  const { notifyDataChanged } = useRealtimeDataContext()
  const {
    form,
    errors,
    isSaving,
    loadingEquipe,
    gestoresList,
    vendedoresList,
    valorProdutos,
    impostosNum,
    valorTotalNF,
    updateField,
    handleCnpjEmitenteChange,
    handleCnpjDestinatarioChange,
    addItem,
    removeItem,
    updateItem,
    handleSubmit,
  } = useNFManualForm(() => {
    notifyDataChanged('notas_fiscais')
    notifyDataChanged('faturamento')
    notifyDataChanged('factories')
    if (onSuccess) onSuccess()
  })

  const formatMoneyInput = (val: string): string => {
    if (!val) return ''
    const num = parseFloat(val.replace(',', '.'))
    if (isNaN(num)) return val
    return formatCurrency(num)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* SEÇÃO 1: DADOS DA NOTA FISCAL */}
      <Card className="shadow-subtle border-primary/10">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
            <CardTitle className="text-base font-semibold">
              Seção 1 — Dados da Nota Fiscal
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Informações fiscais da NF-e emitida para o cliente.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Número da NF */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center justify-between">
              <span>
                Número da NF <span className="text-destructive">*</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-normal">Máx 9 dígitos</span>
            </Label>
            <Input
              type="text"
              maxLength={9}
              placeholder="Ex: 323"
              value={form.numeroNf}
              onChange={(e) => {
                const numericOnly = e.target.value.replace(/\D/g, '').slice(0, 9)
                updateField('numeroNf', numericOnly)
              }}
              className={errors.numeroNf ? 'border-destructive ring-1 ring-destructive/30' : ''}
            />
            {errors.numeroNf && (
              <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 inline shrink-0" />
                {errors.numeroNf}
              </p>
            )}
          </div>

          {/* Data de Emissão */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Data de Emissão <span className="text-destructive">*</span>
            </Label>
            <Input
              type="date"
              value={form.dataEmissao}
              onChange={(e) => updateField('dataEmissao', e.target.value)}
              className={errors.dataEmissao ? 'border-destructive ring-1 ring-destructive/30' : ''}
            />
            {errors.dataEmissao && (
              <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 inline shrink-0" />
                {errors.dataEmissao}
              </p>
            )}
          </div>

          {/* CNPJ do Emitente */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              CNPJ do Emitente <span className="text-destructive">*</span>
            </Label>
            <Input
              type="text"
              placeholder="XX.XXX.XXX/XXXX-XX"
              value={form.cnpjEmitente}
              onChange={(e) => handleCnpjEmitenteChange(e.target.value)}
              className={errors.cnpjEmitente ? 'border-destructive ring-1 ring-destructive/30' : ''}
            />
            {errors.cnpjEmitente && (
              <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 inline shrink-0" />
                {errors.cnpjEmitente}
              </p>
            )}
          </div>

          {/* CNPJ do Destinatário */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">CNPJ do Destinatário (opcional)</Label>
            <Input
              type="text"
              placeholder="XX.XXX.XXX/XXXX-XX"
              value={form.cnpjDestinatario}
              onChange={(e) => handleCnpjDestinatarioChange(e.target.value)}
            />
          </div>

          {/* Nome / Razão Social */}
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label className="text-xs font-semibold">
              Nome / Razão Social <span className="text-destructive">*</span>
            </Label>
            <Input
              type="text"
              placeholder="Nome do destinatario"
              value={form.nomeDestinatario}
              onChange={(e) => updateField('nomeDestinatario', e.target.value)}
              className={
                errors.nomeDestinatario ? 'border-destructive ring-1 ring-destructive/30' : ''
              }
            />
            {errors.nomeDestinatario && (
              <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 inline shrink-0" />
                {errors.nomeDestinatario}
              </p>
            )}
          </div>

          {/* UF */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              UF <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.ufDestinatario}
              onValueChange={(val) => updateField('ufDestinatario', val)}
            >
              <SelectTrigger
                className={
                  errors.ufDestinatario ? 'border-destructive ring-1 ring-destructive/30' : ''
                }
              >
                <SelectValue placeholder="Selecione a UF..." />
              </SelectTrigger>
              <SelectContent>
                {BLINK_UF_LIST.map((uf) => (
                  <SelectItem key={uf} value={uf}>
                    {uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.ufDestinatario && (
              <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 inline shrink-0" />
                {errors.ufDestinatario}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 2: DADOS DO PEDIDO */}
      <Card className="shadow-subtle border-primary/10">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
            <CardTitle className="text-base font-semibold">Seção 2 — Dados do Pedido</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Classificação comercial e atribuição de equipe técnica/vendas.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Cliente */}
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label className="text-xs font-semibold">
              Cliente <span className="text-destructive">*</span>
            </Label>
            <Input
              type="text"
              placeholder="Nome do cliente"
              value={form.cliente}
              onChange={(e) => updateField('cliente', e.target.value)}
              className={errors.cliente ? 'border-destructive ring-1 ring-destructive/30' : ''}
            />
            {errors.cliente && (
              <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 inline shrink-0" />
                {errors.cliente}
              </p>
            )}
          </div>

          {/* Espécie */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Espécie <span className="text-destructive">*</span>
            </Label>
            <Select value={form.especie} onValueChange={(val) => updateField('especie', val)}>
              <SelectTrigger
                className={errors.especie ? 'border-destructive ring-1 ring-destructive/30' : ''}
              >
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {BLINK_ESPECIE_MANUAL_OPTIONS.map((esp) => (
                  <SelectItem key={esp} value={esp}>
                    {esp}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.especie && (
              <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 inline shrink-0" />
                {errors.especie}
              </p>
            )}
          </div>

          {/* Canal de Vendas */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Canal de Vendas</Label>
            <Select
              value={form.canalVendas}
              onValueChange={(val) => updateField('canalVendas', val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {BLINK_CANAL_MANUAL_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vendedor */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Vendedor</Label>
            <Select
              value={form.vendedorId}
              onValueChange={(val) => updateField('vendedorId', val)}
              disabled={loadingEquipe}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o vendedor..." />
              </SelectTrigger>
              <SelectContent>
                {vendedoresList.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 3: ITENS DA NOTA (TABELA DINÂMICA) */}
      <Card className="shadow-subtle border-primary/10">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                <CardTitle className="text-base font-semibold">
                  Seção 3 — Itens da Nota ({form.itens.length}/50)
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                Selecione os produtos da Blink Biotech, quantidades e preços unitários.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addItem}
              disabled={form.itens.length >= 50 || isSaving}
              className="gap-1.5 text-xs font-medium border-primary/30 hover:bg-primary/5 text-primary"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar Item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.itens.length === 0 ? (
            /* ESTADO EMPTY */
            <div className="py-10 text-center border-2 border-dashed rounded-lg bg-muted/20 space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Adicione pelo menos um item a nota.
              </p>
              <Button
                type="button"
                onClick={addItem}
                size="sm"
                className="gap-2 bg-primary hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" /> Adicionar Item
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[45%] min-w-[260px]">
                      Produto <span className="text-destructive">*</span>
                    </TableHead>
                    <TableHead className="w-[20%] min-w-[120px] text-right">
                      Quantidade <span className="text-destructive">*</span>
                    </TableHead>
                    <TableHead className="w-[20%] min-w-[140px] text-right">
                      Preço Unitário (R$) <span className="text-destructive">*</span>
                    </TableHead>
                    <TableHead className="w-[15%] min-w-[120px] text-right">
                      Subtotal (R$)
                    </TableHead>
                    <TableHead className="w-12 text-center" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {form.itens.map((item, idx) => {
                    const prodErr = errors[`item_${idx}_produtoCodigo`]
                    const qtdErr = errors[`item_${idx}_quantidade`]
                    const precoErr = errors[`item_${idx}_precoUnitario`]

                    return (
                      <TableRow key={item.id} className="hover:bg-muted/20">
                        {/* Coluna 1: Produto */}
                        <TableCell className="align-top">
                          <Select
                            value={item.produtoCodigo}
                            onValueChange={(val) => updateItem(idx, { produtoCodigo: val })}
                          >
                            <SelectTrigger
                              className={
                                prodErr ? 'border-destructive ring-1 ring-destructive/30' : ''
                              }
                            >
                              <SelectValue placeholder="Selecione o produto Blink..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                              {BLINK_CATALOG_PRODUCTS.map((p) => (
                                <SelectItem key={p.codigo} value={p.codigo}>
                                  {p.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {prodErr && (
                            <p className="text-[10px] text-destructive mt-1">{prodErr}</p>
                          )}
                        </TableCell>

                        {/* Coluna 2: Quantidade */}
                        <TableCell className="align-top">
                          <Input
                            type="number"
                            min="0"
                            step="0.001"
                            placeholder="0,000"
                            className={`text-right ${
                              qtdErr ? 'border-destructive ring-1 ring-destructive/30' : ''
                            }`}
                            value={item.quantidade}
                            onChange={(e) => updateItem(idx, { quantidade: e.target.value })}
                          />
                          {qtdErr && <p className="text-[10px] text-destructive mt-1">{qtdErr}</p>}
                        </TableCell>

                        {/* Coluna 3: Preço Unitário */}
                        <TableCell className="align-top">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0,00"
                            className={`text-right ${
                              precoErr ? 'border-destructive ring-1 ring-destructive/30' : ''
                            }`}
                            value={item.precoUnitario}
                            onChange={(e) => updateItem(idx, { precoUnitario: e.target.value })}
                          />
                          {precoErr && (
                            <p className="text-[10px] text-destructive mt-1">{precoErr}</p>
                          )}
                        </TableCell>

                        {/* Coluna 4: Subtotal (somente leitura) */}
                        <TableCell className="align-top text-right font-mono font-semibold text-primary pt-3">
                          {formatCurrency(item.subtotal)}
                        </TableCell>

                        {/* Coluna 5: Lixeira */}
                        <TableCell className="align-top text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(idx)}
                            disabled={isSaving}
                            className="text-muted-foreground hover:text-destructive h-8 w-8"
                            title="Remover linha"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {errors.itensError && (
            <p className="text-xs text-destructive flex items-center gap-1 font-medium">
              <AlertCircle className="w-4 h-4 inline shrink-0" />
              {errors.itensError}
            </p>
          )}

          {form.itens.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addItem}
              disabled={form.itens.length >= 50 || isSaving}
              className="gap-1.5 text-xs font-medium border-dashed"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar Outro Item
            </Button>
          )}
        </CardContent>
      </Card>

      {/* SEÇÃO 4: VALORES E OBSERVAÇÕES */}
      <Card className="shadow-subtle border-primary/10">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
            <CardTitle className="text-base font-semibold">
              Seção 4 — Valores e Observações
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Totais auto-calculados da nota fiscal e notas complementares.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Valor dos Produtos */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Valor dos Produtos (R$)
              </Label>
              <Input
                readOnly
                className="text-right font-mono font-bold bg-muted/40 cursor-not-allowed"
                value={formatCurrency(valorProdutos)}
              />
            </div>

            {/* Valor dos Impostos */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Valor dos Impostos (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                className="text-right font-mono"
                value={form.valorImpostos}
                onChange={(e) => updateField('valorImpostos', e.target.value)}
              />
              {form.valorImpostos && (
                <span className="text-[10px] text-muted-foreground block text-right">
                  {formatMoneyInput(form.valorImpostos)}
                </span>
              )}
            </div>

            {/* Valor Total da NF */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-primary">Valor Total da NF (R$)</Label>
              <Input
                readOnly
                className="text-right font-mono font-bold text-lg text-primary bg-primary/5 border-primary/30 cursor-not-allowed"
                value={formatCurrency(valorTotalNF)}
              />
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-semibold">Observações (opcional)</Label>
              <span className="text-[10px] text-muted-foreground">
                {form.observacoes.length}/500 caracteres
              </span>
            </div>
            <Textarea
              maxLength={500}
              placeholder="Informações complementares sobre a nota, transporte ou condições..."
              rows={3}
              value={form.observacoes}
              onChange={(e) => updateField('observacoes', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* BOTÕES DE AÇÃO */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
            className="px-6"
          >
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSaving}
          className="gap-2 px-8 bg-primary hover:bg-primary/90 shadow-md font-semibold"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Salvar Nota Fiscal
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
