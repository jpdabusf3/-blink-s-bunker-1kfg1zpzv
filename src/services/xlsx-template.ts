/**
 * Specialized XML / XLSX builder for the Blink Client Import Template.
 * Generates an OpenXML (.xlsx) document in memory with:
 * - Sheet name in UPPERCASE: "MODELO IMPORTAÇÃO CLIENTES"
 * - Header row styled in BOLD (font id 1, cell style xf)
 * - Headers in Title Case ("Nome", "CNPJ", "Espécie", "Cidade", "Estado", "Contato", "Status Contato", "Funil", "Valor", "Gestor", "Vendedor")
 * - Column widths
 * - Data validation dropdown for the "Espécie" column (C2:C1000) restricted to:
 *   "Aves, Suinos, Ruminantes, Pet, Multiespécies"
 * - Data validation dropdown for the "Status Contato" column (G2:G1000) restricted to:
 *   "Champion,Stakeholder,Decisor,Influenciador,Gatekeepers"
 * - Data validation dropdown for the "Funil" column (H2:H1000) restricted to:
 *   "Lead,Primeiro Contato,Diagnóstico Técnico,Apresentação,Teste/Trial,Proposta,Negociação,Fechamento,Pós-venda,Perda"
 */

import { buildZip } from './zip-builder'

function escapeXml(unsafe: unknown): string {
  if (unsafe == null) return ''
  const str = String(unsafe)
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function colNumberToName(num: number): string {
  let name = ''
  let n = num
  while (n > 0) {
    const rem = (n - 1) % 26
    name = String.fromCharCode(65 + rem) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

export interface ClientTemplateRow {
  nome: string
  cnpj: string
  especie: string
  cidade: string
  estado: string
  contato: string
  statusContato: string
  funil: string
  valor: number
  gestor: string
  vendedor: string
}

export function generateClientImportTemplateXlsx(): Uint8Array {
  const sheetName = 'MODELO IMPORTAÇÃO CLIENTES'

  const headers = [
    'Nome',
    'CNPJ',
    'Espécie',
    'Cidade',
    'Estado',
    'Contato',
    'Status Contato',
    'Funil',
    'Valor',
    'Gestor',
    'Vendedor',
  ]

  const colWidths = [
    { min: 1, max: 1, width: 26 }, // Nome
    { min: 2, max: 2, width: 22 }, // CNPJ
    { min: 3, max: 3, width: 18 }, // Espécie
    { min: 4, max: 4, width: 18 }, // Cidade
    { min: 5, max: 5, width: 10 }, // Estado
    { min: 6, max: 6, width: 20 }, // Contato
    { min: 7, max: 7, width: 18 }, // Status Contato
    { min: 8, max: 8, width: 16 }, // Funil
    { min: 9, max: 9, width: 14 }, // Valor
    { min: 10, max: 10, width: 22 }, // Gestor
    { min: 11, max: 11, width: 22 }, // Vendedor
  ]

  const sampleRows: ClientTemplateRow[] = [
    {
      nome: 'Exemplo Indústria',
      cnpj: '12.345.678/0001-90',
      especie: 'Ruminantes',
      cidade: 'São Paulo',
      estado: 'SP',
      contato: '(11) 99999-9999',
      statusContato: 'Decisor',
      funil: 'prospeccao',
      valor: 50000,
      gestor: 'Rodrigo Gardinal',
      vendedor: 'Felipe Leão',
    },
    {
      nome: 'Exemplo Distribuidor',
      cnpj: '98.765.432/0001-10',
      especie: 'Aves',
      cidade: 'Cascavel',
      estado: 'PR',
      contato: '(45) 98888-7777',
      statusContato: 'Champion',
      funil: 'qualificacao',
      valor: 25000,
      gestor: 'Maria Silva',
      vendedor: 'João Souza',
    },
  ]

  // 1. [Content_Types].xml
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`

  // 2. _rels/.rels
  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

  // 3. xl/_rels/workbook.xml.rels
  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

  // 4. xl/workbook.xml
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews>
    <workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/>
  </bookViews>
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`

  // 5. xl/styles.xml
  // Font 0 = normal (Calibri 11pt)
  // Font 1 = bold (Calibri 11pt, <b/>)
  // Fill 0 = none
  // Fill 1 = gray125
  // Border 0 = none
  // CellXfs:
  //   Index 0: regular cell (fontId=0)
  //   Index 1: header cell bold (fontId=1, applyFont=1)
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font>
      <sz val="11"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
    <font>
      <b/>
      <sz val="11"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
  </fonts>
  <fills count="2">
    <fill>
      <patternFill patternType="none"/>
    </fill>
    <fill>
      <patternFill patternType="gray125"/>
    </fill>
  </fills>
  <borders count="1">
    <border>
      <left/>
      <right/>
      <top/>
      <bottom/>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
</styleSheet>`

  // 6. xl/worksheets/sheet1.xml
  // Build columns XML
  const colsXml = `  <cols>
${colWidths.map((c) => `    <col min="${c.min}" max="${c.max}" width="${c.width}" customWidth="1"/>`).join('\n')}
  </cols>`

  // Header row (Row 1): style s="1" (bold), inline string
  const headerCells = headers
    .map((h, i) => {
      const ref = `${colNumberToName(i + 1)}1`
      return `      <c r="${ref}" s="1" t="inlineStr"><is><t>${escapeXml(h)}</t></is></c>`
    })
    .join('\n')
  const headerRowXml = `    <row r="1" spans="1:11">\n${headerCells}\n    </row>`

  // Sample data rows (Row 2, 3...)
  const rowsXmlArr: string[] = [headerRowXml]

  sampleRows.forEach((row, idx) => {
    const rowNum = idx + 2
    const values: (string | number)[] = [
      row.nome,
      row.cnpj,
      row.especie,
      row.cidade,
      row.estado,
      row.contato,
      row.statusContato,
      row.funil,
      row.valor,
      row.gestor,
      row.vendedor,
    ]

    const cells = values
      .map((val, i) => {
        const ref = `${colNumberToName(i + 1)}${rowNum}`
        if (typeof val === 'number') {
          return `      <c r="${ref}" s="0"><v>${val}</v></c>`
        }
        return `      <c r="${ref}" s="0" t="inlineStr"><is><t>${escapeXml(val)}</t></is></c>`
      })
      .join('\n')

    rowsXmlArr.push(`    <row r="${rowNum}" spans="1:11">\n${cells}\n    </row>`)
  })

  // Data validations:
  // Col C (Espécie): C2:C1000 -> Aves,Suinos,Ruminantes,Pet,Multiespécies
  // Col G (Status Contato): G2:G1000 -> Champion,Stakeholder,Decisor,Influenciador,Gatekeepers
  // Col H (Funil): H2:H1000 -> Lead,Primeiro Contato,Diagnóstico Técnico,Apresentação,Teste/Trial,Proposta,Negociação,Fechamento,Pós-venda,Perda
  // In OpenXML, list validation formula1 is a quoted comma-separated string, e.g. &quot;Aves,Suinos,...&quot;
  const especieList = 'Aves,Suinos,Ruminantes,Pet,Multiespécies'
  const statusContatoList = 'Champion,Stakeholder,Decisor,Influenciador,Gatekeepers'
  const funilList =
    'Lead,Primeiro Contato,Diagnóstico Técnico,Apresentação,Teste/Trial,Proposta,Negociação,Fechamento,Pós-venda,Perda'

  const dataValidationXml = `  <dataValidations count="3">
    <dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="C2:C1000">
      <formula1>&quot;${escapeXml(especieList)}&quot;</formula1>
    </dataValidation>
    <dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="G2:G1000">
      <formula1>&quot;${escapeXml(statusContatoList)}&quot;</formula1>
    </dataValidation>
    <dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="H2:H1000">
      <formula1>&quot;${escapeXml(funilList)}&quot;</formula1>
    </dataValidation>
  </dataValidations>`

  const sheet1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:K${sampleRows.length + 1}"/>
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0">
      <selection activeCell="A1" sqref="A1"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
${colsXml}
  <sheetData>
${rowsXmlArr.join('\n')}
  </sheetData>
${dataValidationXml}
  <pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
</worksheet>`

  return buildZip([
    { name: '[Content_Types].xml', content: contentTypesXml },
    { name: '_rels/.rels', content: rootRelsXml },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml },
    { name: 'xl/workbook.xml', content: workbookXml },
    { name: 'xl/styles.xml', content: stylesXml },
    { name: 'xl/worksheets/sheet1.xml', content: sheet1Xml },
  ])
}
