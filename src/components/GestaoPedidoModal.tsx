import React, { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import {
  type PedidoRecord,
  type PedidoInput,
  type PedidoStatus,
  type ClienteOption,
  type ProdutoOption,
} from '@/services/gestao-pedidos'
import { Loader2, Calendar, DollarSign, Package } from 'lucide-react'

interface GestaoPedidoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pedidoToEdit: PedidoRecord | null
  clientes: ClienteOption[]
  produtos: ProdutoOption[]
  onSave: (data: PedidoInput) => Promise<void>
}

export function GestaoPedidoModal({
  open,
  onOpenChange,
  pedidoToEdit,
  clientes,
  produtos,
  onSave,
}: GestaoPedidoModalProps) {
  const [clienteId, setClienteId] = useState('')
  const [produtoId, setProdutoId] = useState('')
  const [quantidadeStr, setQuantidadeStr] = useState('1')
  const [valorUnitarioStr, setValorUnitarioStr] = useState('')
  const [status, setStatus] = useState<PedidoStatus>('ABERTO')
  const [dataPedido, setDataPedido] = useState('')
  const [dataEntregaPrevista, setDataEntregaPrevista] = useState('')
  const [nfNumero, setNfNumero] = useState('')

  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Resetar ou preencher formulário quando abre ou troca de pedido
  useEffect(() => {
    if (open) {
      setErrors({})
      if (pedidoToEdit) {
        setClienteId(pedidoToEdit.clienteId || '')
        setProdutoId(pedidoToEdit.produtoId || '')
        setQuantidadeStr(String(pedidoToEdit.quantidade ?? 1))
        setValorUnitarioStr(String(pedidoToEdit.valorUnitario ?? ''))
        setStatus(pedidoToEdit.status || 'ABERTO')
        setDataPedido(pedidoToEdit.dataPedido ? pedidoToEdit.dataPedido.substring(0, 10) : '')
        setDataEntregaPrevista(
          pedidoToEdit.dataEntregaPrevista ? pedidoToEdit.dataEntregaPrevista.substring(0, 10) : '',
        )
        setNfNumero(pedidoToEdit.nfNumero || '')
      } else {
        const today = new Date().toISOString().substring(0, 10)
        setClienteId('')
        setProdutoId('')
        setQuantidadeStr('1')
        setValorUnitarioStr('')
        setStatus('ABERTO')
        setDataPedido(today)
        setDataEntregaPrevista('')
        setNfNumero('')
      }
    }
  }, [open, pedidoToEdit])

  // Quando o produto for selecionado e o valorUnitario estiver em branco, auto-preencher com preco_base
  const handleProdutoChange = (newProdId: string) => {
    setProdutoId(newProdId)
    if (errors.produtoId) {
      setErrors((prev) => ({ ...prev, produtoId: '' }))
    }
    const prod = produtos.find((p) => p.id === newProdId)
    if (prod && prod.preco_base !== undefined && prod.preco_base !== null) {
      if (!valorUnitarioStr || Number(valorUnitarioStr) === 0) {
        setValorUnitarioStr(String(prod.preco_base))
      }
    }
  }

  // Cálculo ao vivo do valor total: quantidade * valorUnitario
  const quantidadeNum = parseFloat(quantidadeStr.replace(',', '.')) || 0
  const valorUnitarioNum = parseFloat(valorUnitarioStr.replace(',', '.')) || 0
  const valorTotalCalculado = useMemo(() => {
    if (quantidadeNum > 0 && valorUnitarioNum >= 0) {
      return quantidadeNum * valorUnitarioNum
    }
    return 0
  }, [quantidadeNum, valorUnitarioNum])

  const validate = (): boolean => {
    const errs: Record<string, string> = {}

    if (!clienteId) {
      errs.clienteId = 'Selecione o cliente'
    }
    if (!produtoId) {
      errs.produtoId = 'Selecione o produto'
    }
    if (isNaN(quantidadeNum) || quantidadeNum <= 0) {
      errs.quantidade = 'Quantidade deve ser maior que zero'
    }
    if (isNaN(valorUnitarioNum) || valorUnitarioNum < 0 || valorUnitarioStr.trim() === '') {
      errs.valorUnitario = 'Informe o valor unitário'
    }
    if (!dataPedido) {
      errs.dataPedido = 'Informe a data do pedido'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const payload: PedidoInput = {
        clienteId,
        produtoId,
        quantidade: quantidadeNum,
        valorUnitario: valorUnitarioNum,
        valorTotal: valorTotalCalculado,
        status,
        dataPedido,
        dataEntregaPrevista: dataEntregaPrevista || undefined,
        nfNumero: nfNumero ? nfNumero.trim() : undefined,
      }
      await onSave(payload)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pedidoToEdit ? 'Editar Pedido' : 'Novo Pedido'}</DialogTitle>
          <DialogDescription>
            {pedidoToEdit
              ? 'Atualize os dados do pedido selecionado.'
              : 'Preencha os campos abaixo para cadastrar um novo pedido no sistema.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Cliente */}
          <div className="space-y-1.5">
            <Label htmlFor="clienteSelect">
              Cliente <span className="text-destructive">*</span>
            </Label>
            <Select
              value={clienteId}
              onValueChange={(val) => {
                setClienteId(val)
                if (errors.clienteId) setErrors((prev) => ({ ...prev, clienteId: '' }))
              }}
            >
              <SelectTrigger
                id="clienteSelect"
                className={errors.clienteId ? 'border-destructive' : ''}
              >
                <SelectValue placeholder="Selecione um cliente..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}{' '}
                    {c.city || c.state ? `(${[c.city, c.state].filter(Boolean).join('/')})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.clienteId && (
              <p className="text-xs font-medium text-destructive">{errors.clienteId}</p>
            )}
          </div>

          {/* Produto */}
          <div className="space-y-1.5">
            <Label htmlFor="produtoSelect">
              Produto <span className="text-destructive">*</span>
            </Label>
            <Select value={produtoId} onValueChange={handleProdutoChange}>
              <SelectTrigger
                id="produtoSelect"
                className={errors.produtoId ? 'border-destructive' : ''}
              >
                <SelectValue placeholder="Selecione um produto..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {produtos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.codigo ? `[${p.codigo}] ` : ''}
                    {p.nome}
                    {p.preco_base ? ` - ${formatCurrency(p.preco_base)}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.produtoId && (
              <p className="text-xs font-medium text-destructive">{errors.produtoId}</p>
            )}
          </div>

          {/* Quantidade e Valor Unitário */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="quantidadeInput">
                Quantidade <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quantidadeInput"
                type="number"
                step="any"
                min="0.001"
                placeholder="Ex: 10"
                value={quantidadeStr}
                onChange={(e) => {
                  setQuantidadeStr(e.target.value)
                  if (errors.quantidade) setErrors((prev) => ({ ...prev, quantidade: '' }))
                }}
                className={errors.quantidade ? 'border-destructive' : ''}
              />
              {errors.quantidade && (
                <p className="text-xs font-medium text-destructive">{errors.quantidade}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="valorUnitarioInput">
                Valor Unitário (R$) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="valorUnitarioInput"
                type="number"
                step="0.01"
                min="0"
                placeholder="Ex: 150.00"
                value={valorUnitarioStr}
                onChange={(e) => {
                  setValorUnitarioStr(e.target.value)
                  if (errors.valorUnitario) setErrors((prev) => ({ ...prev, valorUnitario: '' }))
                }}
                className={errors.valorUnitario ? 'border-destructive' : ''}
              />
              {errors.valorUnitario && (
                <p className="text-xs font-medium text-destructive">{errors.valorUnitario}</p>
              )}
            </div>
          </div>

          {/* Valor Total Calculado ao Vivo */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-md bg-primary/10 text-primary">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Valor Total (Calculado ao vivo)
                </p>
                <p className="text-xs text-muted-foreground/80">
                  {quantidadeNum > 0
                    ? `${quantidadeNum} × ${formatCurrency(valorUnitarioNum)}`
                    : 'Aguardando valores'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xl font-bold text-primary">
                {formatCurrency(valorTotalCalculado)}
              </span>
            </div>
          </div>

          {/* Status e Data do Pedido */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="statusSelect">Status</Label>
              <Select value={status} onValueChange={(val: PedidoStatus) => setStatus(val)}>
                <SelectTrigger id="statusSelect">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ABERTO">ABERTO</SelectItem>
                  <SelectItem value="FATURADO">FATURADO</SelectItem>
                  <SelectItem value="CANCELADO">CANCELADO</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dataPedidoInput">
                Data do Pedido <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dataPedidoInput"
                type="date"
                value={dataPedido}
                onChange={(e) => {
                  setDataPedido(e.target.value)
                  if (errors.dataPedido) setErrors((prev) => ({ ...prev, dataPedido: '' }))
                }}
                className={errors.dataPedido ? 'border-destructive' : ''}
              />
              {errors.dataPedido && (
                <p className="text-xs font-medium text-destructive">{errors.dataPedido}</p>
              )}
            </div>
          </div>

          {/* Data Prevista de Entrega e NF */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dataEntregaInput">Data Entrega Prevista (opcional)</Label>
              <Input
                id="dataEntregaInput"
                type="date"
                value={dataEntregaPrevista}
                onChange={(e) => setDataEntregaPrevista(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nfNumeroInput">Nº da Nota Fiscal (opcional)</Label>
              <Input
                id="nfNumeroInput"
                type="text"
                placeholder="Ex: 001234"
                value={nfNumero}
                onChange={(e) => setNfNumero(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {pedidoToEdit ? 'Salvar Alterações' : 'Criar Pedido'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
