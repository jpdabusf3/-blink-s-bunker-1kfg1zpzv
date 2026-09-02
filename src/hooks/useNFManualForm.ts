import { useState, useMemo, useEffect, useCallback } from 'react'
import { z } from 'zod'
import pb from '@/lib/pocketbase/client'
import { useToast } from '@/hooks/use-toast'
import { BLINK_CATALOG_PRODUCTS } from '@/constants/blinkProducts'
import {
  getGestoresTecnicosEquipe,
  getVendedoresEquipe,
  type EquipeOption,
} from '@/services/nfService'
import { deriveDateParts, derivePais } from '@/services/historico-vendas'
import { normalizeNumberBR } from '@/lib/utils'

export interface NFItemManual {
  id: string
  produtoCodigo: string
  quantidade: string
  precoUnitario: string
  subtotal: number
}

export interface NFManualFormState {
  // Seção 1
  numeroNf: string
  dataEmissao: string
  cnpjEmitente: string
  cnpjDestinatario: string
  nomeDestinatario: string
  ufDestinatario: string

  // Seção 2
  cliente: string
  especie: string
  canalVendas: string
  gestorTecnicoId: string
  vendedorId: string

  // Seção 3
  itens: NFItemManual[]

  // Seção 4
  valorImpostos: string
  observacoes: string
}

export interface FormErrors {
  [key: string]: string | undefined
  itensError?: string
}

const itemSchema = z.object({
  produtoCodigo: z.string().min(1, 'Selecione um produto.'),
  quantidade: z
    .string()
    .min(1, 'Informe a quantidade.')
    .refine((val) => {
      const num = parseFloat(val.replace(',', '.'))
      return !isNaN(num) && num > 0
    }, 'A quantidade deve ser maior que 0.'),
  precoUnitario: z
    .string()
    .min(1, 'Informe o preço unitário.')
    .refine((val) => {
      const num = parseFloat(val.replace(',', '.'))
      return !isNaN(num) && num >= 0
    }, 'Preço unitário inválido.'),
})

const nfManualSchema = z.object({
  numeroNf: z
    .string()
    .trim()
    .min(1, 'Número da NF é obrigatório.')
    .regex(/^\d+$/, 'Apenas números permitidos.')
    .max(9, 'Máximo 9 dígitos.'),
  dataEmissao: z.string().min(1, 'Data de emissão é obrigatória.'),
  cnpjEmitente: z.string().trim().min(1, 'CNPJ do emitente é obrigatório.'),
  cnpjDestinatario: z.string().optional(),
  nomeDestinatario: z.string().trim().min(1, 'Nome / Razão Social é obrigatório.'),
  ufDestinatario: z.string().min(1, 'UF é obrigatória.'),
  cliente: z.string().trim().min(1, 'Cliente é obrigatório.'),
  especie: z.string().min(1, 'Espécie é obrigatória.'),
  canalVendas: z.string().optional(),
  gestorTecnicoId: z.string().optional(),
  vendedorId: z.string().optional(),
  itens: z
    .array(itemSchema)
    .min(1, 'Adicione pelo menos um item à nota.')
    .max(50, 'Máximo de 50 itens.'),
  valorImpostos: z.string().optional(),
  observacoes: z.string().max(500, 'Máximo 500 caracteres.').optional(),
})

export function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
}

function createEmptyItem(): NFItemManual {
  return {
    id: 'item_' + Math.random().toString(36).slice(2, 9),
    produtoCodigo: '',
    quantidade: '',
    precoUnitario: '',
    subtotal: 0,
  }
}

const initialFormState: NFManualFormState = {
  numeroNf: '',
  dataEmissao: new Date().toISOString().slice(0, 10),
  cnpjEmitente: '',
  cnpjDestinatario: '',
  nomeDestinatario: '',
  ufDestinatario: '',
  cliente: '',
  especie: 'AVES',
  canalVendas: 'Direto',
  gestorTecnicoId: '',
  vendedorId: '',
  itens: [createEmptyItem()],
  valorImpostos: '',
  observacoes: '',
}

export function useNFManualForm(onSuccessCallback?: () => void) {
  const { toast } = useToast()
  const [form, setForm] = useState<NFManualFormState>(initialFormState)
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSaving, setIsSaving] = useState(false)

  const [gestoresList, setGestoresList] = useState<EquipeOption[]>([])
  const [vendedoresList, setVendedoresList] = useState<EquipeOption[]>([])
  const [loadingEquipe, setLoadingEquipe] = useState(false)

  useEffect(() => {
    let active = true
    setLoadingEquipe(true)
    Promise.all([getGestoresTecnicosEquipe(), getVendedoresEquipe()])
      .then(([gList, vList]) => {
        if (!active) return
        setGestoresList(gList)
        setVendedoresList(vList)
      })
      .catch((err) => {
        console.error('Erro ao carregar equipe técnica/comercial:', err)
      })
      .finally(() => {
        if (active) setLoadingEquipe(false)
      })
    return () => {
      active = false
    }
  }, [])

  // Atualizar campo simples
  const updateField = useCallback((field: keyof NFManualFormState, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      // Se preencher nomeDestinatario e cliente estiver vazio, auto-preencher cliente
      if (field === 'nomeDestinatario' && !prev.cliente) {
        next.cliente = value
      }
      return next
    })
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }, [])

  const handleCnpjEmitenteChange = useCallback((value: string) => {
    setForm((prev) => ({ ...prev, cnpjEmitente: formatCNPJ(value) }))
    setErrors((prev) => ({ ...prev, cnpjEmitente: undefined }))
  }, [])

  const handleCnpjDestinatarioChange = useCallback((value: string) => {
    setForm((prev) => ({ ...prev, cnpjDestinatario: formatCNPJ(value) }))
    setErrors((prev) => ({ ...prev, cnpjDestinatario: undefined }))
  }, [])

  // Gerenciamento de itens
  const addItem = useCallback(() => {
    setForm((prev) => {
      if (prev.itens.length >= 50) return prev
      return {
        ...prev,
        itens: [...prev.itens, createEmptyItem()],
      }
    })
    setErrors((prev) => ({ ...prev, itensError: undefined }))
  }, [])

  const removeItem = useCallback((index: number) => {
    setForm((prev) => {
      const nextItens = prev.itens.filter((_, i) => i !== index)
      return {
        ...prev,
        itens: nextItens,
      }
    })
  }, [])

  const updateItem = useCallback(
    (index: number, patch: Partial<Omit<NFItemManual, 'id' | 'subtotal'>>) => {
      setForm((prev) => {
        const nextItens = [...prev.itens]
        const current = nextItens[index]
        if (!current) return prev

        const updated = { ...current, ...patch }

        const qtd = parseFloat(String(updated.quantidade || '').replace(',', '.')) || 0
        const preco = parseFloat(String(updated.precoUnitario || '').replace(',', '.')) || 0
        updated.subtotal = Math.round(qtd * preco * 100) / 100

        nextItens[index] = updated
        return { ...prev, itens: nextItens }
      })
      setErrors((prev) => ({ ...prev, [`item_${index}`]: undefined, itensError: undefined }))
    },
    [],
  )

  // Cálculos agregados
  const valorProdutos = useMemo(() => {
    return form.itens.reduce((acc, it) => acc + (it.subtotal || 0), 0)
  }, [form.itens])

  const impostosNum = useMemo(() => {
    if (!form.valorImpostos) return 0
    const parsed = parseFloat(form.valorImpostos.replace(',', '.'))
    return isNaN(parsed) || parsed < 0 ? 0 : parsed
  }, [form.valorImpostos])

  const valorTotalNF = useMemo(() => {
    return Math.round((valorProdutos + impostosNum) * 100) / 100
  }, [valorProdutos, impostosNum])

  const validateForm = (): boolean => {
    const fieldErrors: FormErrors = {}

    const result = nfManualSchema.safeParse(form)
    if (!result.success) {
      for (const issue of result.error.issues) {
        const pathKey = issue.path.join('.')
        if (issue.path[0] === 'itens' && typeof issue.path[1] === 'number') {
          const itemIdx = issue.path[1]
          const field = issue.path[2]
          fieldErrors[`item_${itemIdx}_${String(field)}`] = issue.message
        } else {
          fieldErrors[pathKey] = issue.message
        }
      }
    }

    if (form.itens.length === 0) {
      fieldErrors.itensError = 'Adicione pelo menos um item à nota.'
    }

    setErrors(fieldErrors)
    return Object.keys(fieldErrors).length === 0
  }

  const resetForm = useCallback(() => {
    setForm({
      ...initialFormState,
      itens: [createEmptyItem()],
      dataEmissao: new Date().toISOString().slice(0, 10),
    })
    setErrors({})
  }, [])

  const handleSubmit = async (e?: React.FormEvent): Promise<boolean> => {
    if (e) e.preventDefault()

    if (!validateForm()) {
      toast({
        title: 'Verifique os campos obrigatórios',
        description: 'Preencha todos os campos destacados em vermelho antes de salvar.',
        variant: 'destructive',
      })
      return false
    }

    setIsSaving(true)
    try {
      const currentUserId = pb.authStore.model?.id
      if (!currentUserId) {
        throw new Error('Usuário não autenticado.')
      }

      // 1. Criar registro principal em `notas_fiscais`
      const nfPayload: Record<string, string | number | null> = {
        numero_nf: form.numeroNf.trim(),
        serie: '1',
        chave_acesso: '',
        data_emissao: form.dataEmissao,
        natureza_operacao: 'S-Venda Mercadoria (Manual)',
        protocolo_autorizacao: '',
        destinatario_nome: form.nomeDestinatario.trim(),
        destinatario_cnpj: form.cnpjDestinatario.trim(),
        destinatario_uf: form.ufDestinatario.toUpperCase().trim(),
        valor_total_produtos: valorProdutos,
        valor_aproximado_tributos: impostosNum,
        valor_total_nota: valorTotalNF,
        raw_text: 'Cadastro manual',
        especie_destino: form.especie,
        canal_vendas: form.canalVendas === 'Representante' ? 'Distribuidor' : form.canalVendas,
        gestor_tecnico_id: form.gestorTecnicoId || null,
        vendedor_id: form.vendedorId || null,
        status: 'confirmada',
        user_id: currentUserId,
      }

      if (!nfPayload.gestor_tecnico_id) delete nfPayload.gestor_tecnico_id
      if (!nfPayload.vendedor_id) delete nfPayload.vendedor_id

      const createdNF = await pb.collection('notas_fiscais').create<{ id: string }>(nfPayload)
      const nfId = createdNF.id

      // 2. Gravar itens em `nf_itens`
      for (let idx = 0; idx < form.itens.length; idx++) {
        const it = form.itens[idx]
        const prodMatch = BLINK_CATALOG_PRODUCTS.find((p) => p.codigo === it.produtoCodigo)
        const prodDesc = prodMatch ? prodMatch.nome : `Produto ${it.produtoCodigo}`
        const qtd = parseFloat(it.quantidade.replace(',', '.')) || 1
        const unit = parseFloat(it.precoUnitario.replace(',', '.')) || 0
        const tot = it.subtotal || Math.round(qtd * unit * 100) / 100

        await pb.collection('nf_itens').create({
          nota_fiscal_id: nfId,
          produto_codigo: it.produtoCodigo,
          produto_descricao: prodDesc,
          produto_ncm: '2309.90.90',
          produto_cst: '100',
          produto_cfop: '6102',
          produto_unidade: 'KG',
          produto_quantidade: qtd,
          produto_valor_unitario: unit,
          produto_valor_total: tot,
          user_id: currentUserId,
        })
      }

      // 3. Gravar registros em `historico_vendas` para alimentar relatórios e performance
      const { mes, ano, trimestre } = deriveDateParts(form.dataEmissao)
      const pais = derivePais(form.ufDestinatario)
      const gestorNome = gestoresList.find((g) => g.id === form.gestorTecnicoId)?.nome || ''
      const vendedorNome = vendedoresList.find((v) => v.id === form.vendedorId)?.nome || ''

      // Mapear espécie para formato compatível de historico_vendas
      const mapEspecieHV = (esp: string): 'BOVINO' | 'SUINO' | 'AVE' | 'PET' | 'AQUA' | 'OUTRO' => {
        const u = esp.toUpperCase().trim()
        if (u === 'RUMINANTES' || u === 'BOVINO') return 'BOVINO'
        if (u === 'SUINOS' || u === 'SUINO') return 'SUINO'
        if (u === 'AVES' || u === 'AVE') return 'AVE'
        if (u === 'PETS' || u === 'PET') return 'PET'
        if (u === 'AQUA') return 'AQUA'
        return 'OUTRO'
      }

      // Buscar IDs correspondentes em gestao_tecnica se existirem
      let gestaoTecnicoId = ''
      let gestaoVendedorId = ''
      try {
        if (gestorNome) {
          const gtList = await pb.collection('gestao_tecnica').getList(1, 1, {
            filter: `nome ~ "${gestorNome.replace(/['"\\]/g, '')}"`,
          })
          if (gtList.items[0]) gestaoTecnicoId = gtList.items[0].id
        }
        if (vendedorNome) {
          const vendList = await pb.collection('gestao_tecnica').getList(1, 1, {
            filter: `nome ~ "${vendedorNome.replace(/['"\\]/g, '')}"`,
          })
          if (vendList.items[0]) gestaoVendedorId = vendList.items[0].id
        }
      } catch {
        /* noop */
      }

      for (let idx = 0; idx < form.itens.length; idx++) {
        const it = form.itens[idx]
        const prodMatch = BLINK_CATALOG_PRODUCTS.find((p) => p.codigo === it.produtoCodigo)
        const prodDesc = prodMatch ? prodMatch.nome : `Produto ${it.produtoCodigo}`
        const qtd = parseFloat(it.quantidade.replace(',', '.')) || 1
        const unit = parseFloat(it.precoUnitario.replace(',', '.')) || 0
        const tot = it.subtotal || Math.round(qtd * unit * 100) / 100

        const hvPayload: Record<string, string | number | null> = {
          origem: 'manual',
          numero_documento: form.numeroNf.trim(),
          data_documento: form.dataEmissao,
          mes: String(mes),
          ano: Number(ano) || new Date().getFullYear(),
          trimestre: String(trimestre || 'T1'),
          destinatario_nome: form.cliente.trim() || form.nomeDestinatario.trim(),
          destinatario_uf: form.ufDestinatario.toUpperCase().trim(),
          pais: String(pais || 'Brasil'),
          especie_destino: form.especie,
          canal_vendas: form.canalVendas === 'Representante' ? 'Distribuidor' : form.canalVendas,
          gestor_tecnico: gestorNome,
          vendedor: vendedorNome,
          produto_codigo: it.produtoCodigo,
          produto_descricao: prodDesc,
          produto_familia: form.especie,
          produto_quantidade: qtd,
          produto_valor_unitario: unit,
          produto_valor_total: tot,
          valor_total_nota: valorTotalNF,
          frete_modalidade: 'CIF',
          status: 'realizado',
          user_id: currentUserId,

          // Campos legados para dashboards e compatibilidade
          data: form.dataEmissao,
          cliente: form.cliente.trim() || form.nomeDestinatario.trim(),
          especie: mapEspecieHV(form.especie),
          gestor_tecnico_id: gestaoTecnicoId || null,
          vendedor_id: gestaoVendedorId || null,
          valor: tot,
          observacoes: form.observacoes || `NF Manual #${form.numeroNf}`,
          atualizado_em: new Date().toISOString(),
        }

        try {
          await pb.collection('historico_vendas').create(hvPayload)
        } catch (hvErr) {
          console.warn(
            `[useNFManualForm] Aviso ao gravar historico_vendas para item ${idx + 1}:`,
            hvErr,
          )
        }
      }

      toast({
        title: 'Nota fiscal cadastrada com sucesso.',
        description: `NF #${form.numeroNf} gravada com ${form.itens.length} item(ns).`,
      })

      resetForm()

      if (onSuccessCallback) {
        onSuccessCallback()
      }

      return true
    } catch (err: unknown) {
      console.error('Erro ao cadastrar nota fiscal:', err)
      toast({
        title: 'Erro ao cadastrar nota fiscal. Tente novamente.',
        description:
          err instanceof Error ? err.message : 'Verifique os dados informados e tente novamente.',
        variant: 'destructive',
      })
      return false
    } finally {
      setIsSaving(false)
    }
  }

  return {
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
    resetForm,
    handleSubmit,
  }
}
