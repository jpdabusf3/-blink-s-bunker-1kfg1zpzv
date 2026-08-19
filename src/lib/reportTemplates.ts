// Visual report templates for the PDF / Google Docs client history export.
//
// The backend hooks (`client_report_pdf.js` and `client_report_google_docs.js`)
// actually render the styles, but the UI needs the list of available models +
// labels for the dropdown and a helper to persist the user's choice as a
// per-user preference.

export type ReportTemplateKey = 'executivo' | 'tecnico' | 'comercial'

export interface ReportTemplateOption {
  key: ReportTemplateKey
  label: string
  description: string
}

export const REPORT_TEMPLATES: ReportTemplateOption[] = [
  {
    key: 'executivo',
    label: 'Executivo',
    description: 'Layout clean, cores neutras, hierarquia sóbria — Diretoria/CEO',
  },
  {
    key: 'tecnico',
    label: 'Técnico',
    description: 'Ênfase em dados, tabelas destacadas, tons azuis — Gestor Técnico',
  },
  {
    key: 'comercial',
    label: 'Comercial',
    description: 'Layout dinâmico, destaques coloridos, foco em KPIs — Comercial',
  },
]

export const DEFAULT_REPORT_TEMPLATE: ReportTemplateKey = 'executivo'

export const REPORT_TEMPLATE_LABEL: Record<ReportTemplateKey, string> = {
  executivo: 'Executivo',
  tecnico: 'Técnico',
  comercial: 'Comercial',
}

export function isValidTemplateKey(v: unknown): v is ReportTemplateKey {
  return v === 'executivo' || v === 'tecnico' || v === 'comercial'
}
