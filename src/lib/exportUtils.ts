import { Order, Factory } from '@/types'
import { formatCurrency } from './utils'

export function exportOrdersToExcel(filteredOrders: Order[], factories: Factory[]) {
  const separator = ';'
  const keys = [
    'ID',
    'Data',
    'Fábrica',
    'Canal de Venda',
    'Região',
    'Produto',
    'Linha',
    'Qtd',
    'Valor Unitário',
    'Valor Total',
  ]

  const csvContent = [
    keys.join(separator),
    ...filteredOrders.map((o) => {
      const factory = factories.find((f) => f.id === o.factoryId)
      const channelLabel =
        factory?.salesChannel === 'Indirect' ? factory.indirectChannelType : factory?.salesChannel
      return [
        `"${o.id.replace(/"/g, '""')}"`,
        new Date(o.orderDate).toLocaleDateString('pt-BR'),
        `"${(factory?.name || 'Desconhecida').replace(/"/g, '""')}"`,
        `"${(channelLabel || '-').replace(/"/g, '""')}"`,
        `"${String(Array.isArray(factory?.region) ? factory?.region.join(', ') : factory?.region || '-').replace(/"/g, '""')}"`,
        `"${o.product.replace(/"/g, '""')}"`,
        `"${(o.line || '-').replace(/"/g, '""')}"`,
        o.quantity,
        o.unitValue.toString().replace('.', ','),
        o.totalValue.toString().replace('.', ','),
      ].join(separator)
    }),
  ].join('\n')

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', 'pedidos_blink_biotech.csv')
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function exportOrdersToPDF(
  filteredOrders: Order[],
  factories: Factory[],
  filters?: {
    factoryIdParam?: string
    productLine?: string
    startDate?: string
    endDate?: string
    template?: string
  },
) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return false

  const totalOrders = filteredOrders.reduce((acc, o) => acc + o.totalValue, 0)

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Relatório de Pedidos - Blink Biotech</title>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; line-height: 1.5; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2563eb; padding-bottom: 20px; }
          .header h1 { margin: 0; color: #1e3a8a; font-size: 28px; font-weight: bold; }
          .header p { margin: 8px 0 0; color: #475569; font-size: 14px; }
          .filters { margin-bottom: 30px; font-size: 13px; background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0; }
          .filters strong { color: #0f172a; display: block; margin-bottom: 8px; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 12px 8px; text-align: left; }
          th { background-color: #f1f5f9; font-weight: 600; color: #334155; border-top: 1px solid #e2e8f0; }
          .text-right { text-align: right; }
          .total-row { font-weight: bold; background-color: #f8fafc; }
          .total-row td { border-top: 2px solid #cbd5e1; border-bottom: none; font-size: 14px; color: #0f172a; }
          @media print {
            body { padding: 0; }
            @page { margin: 1cm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Relatório de Pedidos - Blink Biotech</h1>
          <p>Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
        </div>
        
        <div class="filters">
          <strong>Filtros aplicados:</strong>
          <div>Fábrica: ${filters?.factoryIdParam && filters.factoryIdParam !== 'all' ? factories.find((f) => f.id === filters.factoryIdParam)?.name || filters.factoryIdParam : 'Todas as Fábricas'}</div>
          <div>Linha de Produto: ${filters?.productLine && filters.productLine !== 'all' ? filters.productLine : 'Todas as Linhas'}</div>
          <div>Período: ${filters?.startDate ? new Date(filters.startDate).toLocaleDateString('pt-BR') : 'Início'} até ${filters?.endDate ? new Date(filters.endDate).toLocaleDateString('pt-BR') : 'Hoje'}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Data</th>
              <th>Fábrica</th>
              <th>Produto</th>
              <th class="text-right">Qtd</th>
              <th class="text-right">Valor Unitário</th>
              <th class="text-right">Valor Total</th>
            </tr>
          </thead>
          <tbody>
            ${filteredOrders
              .map((o) => {
                const factory = factories.find((f) => f.id === o.factoryId)
                return `
                <tr>
                  <td>${o.id.substring(0, 8)}</td>
                  <td>${new Date(o.orderDate).toLocaleDateString('pt-BR')}</td>
                  <td>${factory?.name || 'Desconhecida'}</td>
                  <td>${o.product}</td>
                  <td class="text-right">${o.quantity}</td>
                  <td class="text-right">${formatCurrency(o.unitValue)}</td>
                  <td class="text-right">${formatCurrency(o.totalValue)}</td>
                </tr>
              `
              })
              .join('')}
            <tr class="total-row">
              <td colspan="6" class="text-right">Valor Total Geral:</td>
              <td class="text-right">${formatCurrency(totalOrders)}</td>
            </tr>
          </tbody>
        </table>
        
        <script>
          window.onload = () => {
            setTimeout(() => {
              window.print();
            }, 500);
          };
        </script>
      </body>
    </html>
  `

  printWindow.document.write(html)
  printWindow.document.close()
  return true
}
