import {
  openCorporatePdfReport,
  formatMoedaBRL,
  formatPercentBR,
  type PdfSection,
} from '@/lib/corporateDocuments'
import { familiaCompleta } from '@/constants/familiaProdutos'
import type { ResumoClienteItem, ResumoFamiliaItem } from '@/services/resumo-vendas'

export interface MonthCoverageExportItem {
  ano: number
  mes: number
  label: string
  faturadoBrl: number
  carteiraBrl: number | null
  coberturaPercent: number | null
}

export interface ResumoPdfExportData {
  periodo: string
  faturadoBrl: number
  qtdNotas: number
  ticketMedio: number | null
  clientesAtivos: number | null
  top10Clientes: ResumoClienteItem[]
  topFamilias: ResumoFamiliaItem[]
  coverageData: MonthCoverageExportItem[]
}

export interface ResumoPdfExportOptions {
  includeCards: boolean
  includeTopClientes: boolean
  includeTopFamilias: boolean
  includeCobertura: boolean
}

/**
 * Emite o PDF corporativo do Resumo de Vendas (/resumo) utilizando o
 * modelo institucional Blink Biotech (cabeçalho formal, metadados, sumário,
 * seções numeradas, KPIs em destaque, tabelas zebradas e rodapé com paginação).
 */
export function exportResumoVendasToPDF(
  data: ResumoPdfExportData,
  options: ResumoPdfExportOptions,
): boolean {
  const sections: PdfSection[] = []
  let sectionIndex = 1

  // 1. Seção: Cards de Resumo / Indicadores Principais
  if (options.includeCards) {
    sections.push({
      numero: sectionIndex++,
      titulo: 'Indicadores Gerais de Desempenho',
      descricao:
        'Visão consolidada do faturamento faturado, volume de notas emitidas, ticket médio por transação e clientes ativos com faturamento no período selecionado.',
      kpis: [
        {
          label: 'Faturamento Total',
          valor: formatMoedaBRL(data.faturadoBrl),
          sub: 'Receita total liquidada no período',
          accent: 'primary',
        },
        {
          label: 'Pedidos Faturados',
          valor: String(data.qtdNotas),
          sub: 'Notas fiscais emitidas no período',
          accent: 'amber',
        },
        {
          label: 'Ticket Médio',
          valor: data.ticketMedio !== null ? formatMoedaBRL(data.ticketMedio) : '—',
          sub: 'Média de faturamento por nota fiscal',
          accent: 'emerald',
        },
        {
          label: 'Clientes Ativos',
          valor: data.clientesAtivos !== null ? String(data.clientesAtivos) : '—',
          sub: 'Compras confirmadas no período',
          accent: 'sky',
        },
      ],
    })
  }

  // 2. Seção: Top 10 Clientes
  if (options.includeTopClientes) {
    const totalTop10 = data.top10Clientes.reduce((acc, c) => acc + (c.valor_brl || 0), 0)

    sections.push({
      numero: sectionIndex++,
      titulo: 'Top Clientes por Faturamento',
      descricao:
        'Classificação dos clientes com maior representatividade no faturamento do período, ordenados pelo valor total em reais.',
      table: {
        columns: [
          { header: 'Posição', width: '70px', align: 'center', isBold: true },
          { header: 'Razão Social / Nome do Cliente', align: 'left' },
          { header: 'Faturamento Total (R$)', width: '220px', align: 'right' },
        ],
        rows: data.top10Clientes.map((c, idx) => [
          `${idx + 1}º`,
          c.cliente || 'Outros / Não Identificado',
          formatMoedaBRL(c.valor_brl),
        ]),
        footerRow:
          data.top10Clientes.length > 0
            ? [
                'TOTAL:',
                `${data.top10Clientes.length} cliente(s) listado(s)`,
                formatMoedaBRL(totalTop10),
              ]
            : undefined,
        emptyMessage: 'Nenhum faturamento de cliente registrado no período selecionado.',
      },
    })
  }

  // 3. Seção: Top Famílias de Produtos
  if (options.includeTopFamilias) {
    const totalFamilias = data.topFamilias.reduce((acc, f) => acc + (f.valor_brl || 0), 0)

    sections.push({
      numero: sectionIndex++,
      titulo: 'Faturamento por Família de Produtos',
      descricao:
        'Distribuição do faturamento por família e categoria de produto comercializada pela Blink Biotech no período.',
      table: {
        columns: [
          { header: 'Posição', width: '70px', align: 'center', isBold: true },
          { header: 'Família de Produtos', align: 'left' },
          { header: 'Faturamento Total (R$)', width: '220px', align: 'right' },
        ],
        rows: data.topFamilias.map((f, idx) => [
          `${idx + 1}º`,
          familiaCompleta('', f.familia),
          formatMoedaBRL(f.valor_brl),
        ]),
        footerRow:
          data.topFamilias.length > 0
            ? ['TOTAL:', `${data.topFamilias.length} família(s)`, formatMoedaBRL(totalFamilias)]
            : undefined,
        emptyMessage:
          'Nenhuma família de produtos com faturamento registrado no período selecionado.',
      },
    })
  }

  // 4. Seção: Cobertura de Carteira (Backlog vs Realizado)
  if (options.includeCobertura) {
    const totalCarteira = data.coverageData.reduce((acc, c) => acc + (c.carteiraBrl || 0), 0)
    const totalFaturado = data.coverageData.reduce((acc, c) => acc + (c.faturadoBrl || 0), 0)
    const coberturaGlobal = totalCarteira > 0 ? (totalFaturado / totalCarteira) * 100 : null

    sections.push({
      numero: sectionIndex++,
      titulo: 'Cobertura de Carteira (Backlog vs Faturado Realizado)',
      descricao:
        'Histórico evolutivo de 6 meses comparando a carteira de pedidos em aberto (backlog comercial) contra a receita faturada realizada e percentual de cobertura atingido.',
      table: {
        columns: [
          { header: 'Mês de Referência', width: '150px', align: 'left', isBold: true },
          { header: 'Valor em Carteira / Backlog (R$)', align: 'right' },
          { header: 'Valor Faturado Realizado (R$)', align: 'right' },
          { header: 'Índice de Cobertura (%)', width: '170px', align: 'right' },
        ],
        rows: data.coverageData.map((cov) => [
          cov.label,
          cov.carteiraBrl !== null ? formatMoedaBRL(cov.carteiraBrl) : '—',
          formatMoedaBRL(cov.faturadoBrl),
          formatPercentBR(cov.coberturaPercent),
        ]),
        footerRow:
          data.coverageData.length > 0
            ? [
                'TOTAL / MÉDIA:',
                formatMoedaBRL(totalCarteira),
                formatMoedaBRL(totalFaturado),
                formatPercentBR(coberturaGlobal),
              ]
            : undefined,
        emptyMessage: 'Sem dados históricos de cobertura disponíveis para o período informado.',
      },
    })
  }

  if (sections.length === 0) {
    throw new Error('Nenhuma seção foi selecionada para compor o relatório PDF.')
  }

  return openCorporatePdfReport({
    titulo: 'Resumo Executivo de Vendas',
    subtitulo:
      'Demonstrativo Comercial Consolidado · Indicadores, Clientes, Famílias e Cobertura de Carteira',
    origem: 'Módulo Resumo de Vendas (/resumo)',
    periodo: data.periodo || 'Consolidado Geral',
    filtros: {
      'Período Analisado': data.periodo || 'Geral',
      'Módulo de Origem': 'Resumo Comercial',
    },
    sections,
    orientacao: 'portrait',
  })
}
