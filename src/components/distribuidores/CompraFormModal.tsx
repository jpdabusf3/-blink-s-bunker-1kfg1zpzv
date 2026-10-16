import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
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
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { BLINK_CATALOG_PRODUCTS } from '@/constants/blinkProducts'
import {
  createCompraDistribuidor,
  mapearLinhaProduto,
  LINHAS_PRODUTO_METADATA,
  type LinhaProdutoDistribuidor,
  type CompraDistribuidor,
} from '@/services/distribuidores-service'
import { useAuth } from '@/hooks/use-auth'

interface CompraFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  distribuidorId: string
  distribuidorNome: string
  onSuccess: (compra: CompraDistribuidor) => void
}

export function CompraFormModal({
  open,
  onOpenChange,
  distribuidorId,
  distribuidorNome,
  onSuccess,
}: CompraFormModalProps) {
  const { user } = useAuth()

  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10))
  const [produto, setProduto] = useState('')
  const [linha, setLinha] = useState<LinhaProdutoDistribuidor>('MY-CO')
  const [toneladas, setToneladas] = useState('')
  const [valorBrl, setValorBrl] = useState('')
  const [valorUsd, setValorUsd] = useState('')
  const [nf, setNf] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [saving, setSaving] = useState(false)

  // Ao selecionar um produto padrão do catálogo, preenche automaticamente a linha
  const handleSelectCatalogProduct = (prodNome: string) => {
    setProduto(prodNome)
    const detected = mapearLinhaProduto(prodNome)
    setLinha(detected)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!produto.trim()) {
      toast.error('Informe o nome ou código do produto.')
      return
    }

    setSaving(true)
    try {
      const payload: Partial<CompraDistribuidor> = {
        distribuidor_id: distribuidorId,
        data: new Date(data).toISOString(),
        produto: produto.trim(),
        linha_produto: linha,
        toneladas: Number(toneladas.replace(',', '.')) || 0,
        valor_brl: Number(valorBrl.replace(',', '.')) || 0,
        valor_usd: Number(valorUsd.replace(',', '.')) || 0,
        nf: nf.trim(),
        observacoes: observacoes.trim(),
        origem: 'manual',
      }

      const res = await createCompraDistribuidor(payload, user)
      toast.success('Compra registrada com sucesso!')
      onSuccess(res)
      onOpenChange(false)
      // Reset
      setProduto('')
      setToneladas('')
      setValorBrl('')
      setValorUsd('')
      setNf('')
      setObservacoes('')
    } catch (err: any) {
      console.error('[CompraFormModal] Erro ao registrar compra:', err)
      toast.error(err?.message || 'Erro ao registrar compra. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Registrar Compra</DialogTitle>
          <DialogDescription>
            Lance uma nova compra para o distribuidor{' '}
            <strong className="text-foreground">{distribuidorNome}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dataCompra" className="text-xs font-semibold">
                Data da Compra *
              </Label>
              <Input
                id="dataCompra"
                type="date"
                required
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nf" className="text-xs font-semibold">
                Número da NF
              </Label>
              <Input
                id="nf"
                value={nf}
                onChange={(e) => setNf(e.target.value)}
                placeholder="Ex: NF-12490"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="produto" className="text-xs font-semibold">
                  Produto Comercializado *
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  Catálogo ou digitação livre
                </span>
              </div>
              <Input
                id="produto"
                required
                value={produto}
                onChange={(e) => setProduto(e.target.value)}
                placeholder="Ex: Blink Mycolink SC ou BBMY.CO001"
              />

              {/* Sugestões rápidas do catálogo */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                <span className="text-[10px] text-muted-foreground shrink-0">Sugestões:</span>
                {BLINK_CATALOG_PRODUCTS.slice(0, 5).map((p) => (
                  <button
                    key={p.codigo}
                    type="button"
                    onClick={() => handleSelectCatalogProduct(p.nome)}
                    className="text-[10px] bg-muted hover:bg-muted/80 text-foreground px-2 py-0.5 rounded shrink-0 border border-border/50"
                  >
                    {p.nome}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="linha" className="text-xs font-semibold">
                Linha do Portfólio Blink *
              </Label>
              <Select value={linha} onValueChange={(v) => setLinha(v as LinhaProdutoDistribuidor)}>
                <SelectTrigger id="linha">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LINHAS_PRODUTO_METADATA).map(([key, meta]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: meta.cor }}
                        />
                        <span>{meta.label}</span>
                        <span className="text-[11px] text-muted-foreground">({meta.desc})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="toneladas" className="text-xs font-semibold">
                Toneladas (Ton) *
              </Label>
              <Input
                id="toneladas"
                type="text"
                value={toneladas}
                onChange={(e) => setToneladas(e.target.value)}
                placeholder="Ex: 12,5"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="valorBrl" className="text-xs font-semibold">
                Valor Total (R$) *
              </Label>
              <Input
                id="valorBrl"
                type="text"
                value={valorBrl}
                onChange={(e) => setValorBrl(e.target.value)}
                placeholder="Ex: 85.000,00"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="valorUsd" className="text-xs font-semibold">
                Valor Total (US$)
              </Label>
              <Input
                id="valorUsd"
                type="text"
                value={valorUsd}
                onChange={(e) => setValorUsd(e.target.value)}
                placeholder="Ex: 17.000,00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observacoes" className="text-xs font-semibold">
              Observações
            </Label>
            <Textarea
              id="observacoes"
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Lote, condições de entrega ou canal repassador..."
            />
          </div>

          <DialogFooter className="pt-3 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registrando...
                </>
              ) : (
                'Confirmar Compra'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
