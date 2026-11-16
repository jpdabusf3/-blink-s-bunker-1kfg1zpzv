// pocketbase/hooks/relatorio_semanal.js
// Rota de leitura para automação externa: GET /backend/v1/relatorio-semanal
// Autenticação: header X-Report-Secret comparado a $secrets.get('RELATORIO_SEMANAL_SECRET').
// Falha fechada: sem segredo configurado, a rota responde 500 e não entrega nada.
// Não altera dados: apenas lê faturamento, metas, pedidos_carteira e equipe.
// IMPORTANTE: todo o código vive DENTRO do callback — o JSVM do PocketBase não
// compartilha funções de topo com os callbacks.
routerAdd('GET', '/backend/v1/relatorio-semanal', (e) => {
  function pad2(n) {
    return (n < 10 ? '0' : '') + n
  }

  function fmtDateUTC(d) {
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate())
  }

  function isoWeekOf(dateObj) {
    var d = new Date(
      Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate()),
    )
    var dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return {
      ano: d.getUTCFullYear(),
      semana: Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7),
    }
  }

  // Segunda-feira da semana ISO informada.
  function isoWeekMonday(ano, semana) {
    var jan4 = new Date(Date.UTC(ano, 0, 4))
    var dayNum = jan4.getUTCDay() || 7
    var week1Monday = new Date(jan4.getTime() - (dayNum - 1) * 86400000)
    return new Date(week1Monday.getTime() + (semana - 1) * 7 * 86400000)
  }

  function round2(n) {
    return Math.round(n * 100) / 100
  }

  function num(rec, field) {
    var v = rec.get ? rec.get(field) : rec[field]
    var f = Number(v)
    return isFinite(f) ? f : 0
  }

  function str(rec, field) {
    var v = rec.get ? rec.get(field) : rec[field]
    return v == null ? '' : String(v)
  }

  // Valores que o CRM usa como "não informado" — não viram grupo nem destaque.
  function ehPlaceholder(v) {
    var s = String(v == null ? '' : v)
      .trim()
      .toLowerCase()
    if (s === '') return true
    if (s === '—' || s === '-' || s === 'n/d' || s === 'na' || s === 'null') return true
    if (s === 'não atribuído' || s === 'nao atribuido' || s === 'sem vendedor') return true
    return false
  }

  function ordenarMapa(mapa, rotulo) {
    var arr = []
    for (var k in mapa) {
      if (!Object.prototype.hasOwnProperty.call(mapa, k)) continue
      var item = { valor_brl: round2(mapa[k]) }
      item[rotulo] = k
      arr.push(item)
    }
    arr.sort(function (a, b) {
      return b.valor_brl - a.valor_brl
    })
    return arr
  }

  var MESES = [
    '',
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ]

  function lerSemana(ano, semana) {
    var filtro = 'ano = ' + ano + ' && semana_iso = ' + semana
    var rows = []
    try {
      rows = $app.findRecordsByFilter('faturamento', filtro, '-valor_brl', 5000, 0)
    } catch (err) {
      rows = []
    }

    var totalBrl = 0
    var totalUsd = 0
    var porCliente = {}
    var porFamilia = {}
    var porVendedor = {}
    var notas = {}
    var vendedorAtribuido = false

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i]
      var brl = num(r, 'valor_brl')
      totalBrl += brl
      totalUsd += num(r, 'valor_usd')

      var cliente = str(r, 'cliente_nome') || str(r, 'cliente_codigo') || 'Outros'
      porCliente[cliente] = (porCliente[cliente] || 0) + brl

      var familia = str(r, 'familia_produto').trim()
      if (!ehPlaceholder(familia)) porFamilia[familia] = (porFamilia[familia] || 0) + brl

      var vendedor = str(r, 'vendedor').trim()
      if (!ehPlaceholder(vendedor)) {
        porVendedor[vendedor] = (porVendedor[vendedor] || 0) + brl
        vendedorAtribuido = true
      }

      notas[str(r, 'data_documento') + '_' + str(r, 'cliente_codigo')] = true
    }

    return {
      linhas: rows.length,
      totalBrl: round2(totalBrl),
      totalUsd: round2(totalUsd),
      notas: Object.keys(notas).length,
      clientes: Object.keys(porCliente).length,
      porCliente: porCliente,
      porFamilia: porFamilia,
      porVendedor: porVendedor,
      vendedorAtribuido: vendedorAtribuido,
    }
  }

  var segredo = $secrets.get('RELATORIO_SEMANAL_SECRET')
  if (!segredo) return e.json(500, { error: 'RELATORIO_SEMANAL_SECRET not set' })

  var enviado = e.request.header.get('X-Report-Secret') || ''
  if (enviado !== segredo) return e.json(401, { error: 'unauthorized' })

  var query = e.requestInfo().query || {}
  var agora = new Date()

  // Semana alvo: por padrão a anterior à atual.
  var alvo = { ano: 0, semana: 0 }
  if (query.ano && query.semana) {
    alvo.ano = parseInt(String(query.ano), 10)
    alvo.semana = parseInt(String(query.semana), 10)
  } else {
    var anterior = new Date(agora.getTime() - 7 * 86400000)
    alvo = isoWeekOf(anterior)
  }

  var prevAno = alvo.ano
  var prevSemana = alvo.semana - 1
  if (prevSemana < 1) {
    prevAno = alvo.ano - 1
    prevSemana = 52
  }

  var atual = lerSemana(alvo.ano, alvo.semana)
  var anteriorDados = lerSemana(prevAno, prevSemana)

  // Sem base de comparação não existe variação: null, nunca "100%" inventado.
  var variacao = null
  if (anteriorDados.totalBrl > 0) {
    variacao = round2(((atual.totalBrl - anteriorDados.totalBrl) / anteriorDados.totalBrl) * 100)
  }

  // Meta do mês corrente da semana alvo.
  var segunda = isoWeekMonday(alvo.ano, alvo.semana)
  var mesRef = segunda.getUTCMonth() + 1
  var anoRef = segunda.getUTCFullYear()
  var metaMes = 0
  try {
    var metasRows = $app.findRecordsByFilter(
      'metas',
      'ano = ' + anoRef + ' && mes = ' + mesRef,
      '',
      1000,
      0,
    )
    for (var m = 0; m < metasRows.length; m++) {
      var mv = num(metasRows[m], 'valor_meta')
      if (!mv) mv = num(metasRows[m], 'meta_valor')
      metaMes += mv
    }
  } catch (err) {
    metaMes = 0
  }

  // Realizado do mês: ano/mes do faturamento não são confiáveis (há registros com
  // mês errado), então usa a janela de datas do mês.
  var inicioMes = new Date(Date.UTC(anoRef, mesRef - 1, 1))
  var fimMes = new Date(Date.UTC(anoRef, mesRef, 1))
  var realizadoMes = 0
  try {
    var mesRows = $app.findRecordsByFilter(
      'faturamento',
      "data_documento >= '" +
        fmtDateUTC(inicioMes) +
        " 00:00:00' && data_documento < '" +
        fmtDateUTC(fimMes) +
        " 00:00:00'",
      '',
      20000,
      0,
    )
    for (var mi = 0; mi < mesRows.length; mi++) {
      realizadoMes += num(mesRows[mi], 'valor_brl')
    }
  } catch (err) {
    realizadoMes = 0
  }

  var atingimento = metaMes > 0 ? round2((realizadoMes / metaMes) * 100) : null

  // Carteira do mês (cobertura).
  var carteira = 0
  var nomeMes = MESES[mesRef] || ''
  try {
    var carteiraRows = $app.findRecordsByFilter(
      'pedidos_carteira',
      "mes = '" + nomeMes + "'",
      '',
      500,
      0,
    )
    for (var ci = 0; ci < carteiraRows.length; ci++) {
      carteira += num(carteiraRows[ci], 'valor')
    }
  } catch (err) {
    carteira = 0
  }

  var cobertura = atual.totalBrl > 0 ? round2((carteira / atual.totalBrl) * 100) : 0

  // Vendedores: quem caiu, quem não faturou, quem cresceu.
  var vendedores = []
  var nomesVendedores = {}
  for (var v in atual.porVendedor) {
    if (Object.prototype.hasOwnProperty.call(atual.porVendedor, v)) nomesVendedores[v] = true
  }
  for (var v2 in anteriorDados.porVendedor) {
    if (Object.prototype.hasOwnProperty.call(anteriorDados.porVendedor, v2))
      nomesVendedores[v2] = true
  }
  for (var nome in nomesVendedores) {
    if (!Object.prototype.hasOwnProperty.call(nomesVendedores, nome)) continue
    var hoje = atual.porVendedor[nome] || 0
    var antes = anteriorDados.porVendedor[nome] || 0
    var varVend = antes > 0 ? round2(((hoje - antes) / antes) * 100) : null
    vendedores.push({
      vendedor: nome,
      valor_brl: round2(hoje),
      semana_anterior_brl: round2(antes),
      variacao_percentual: varVend,
    })
  }
  vendedores.sort(function (a, b) {
    return b.valor_brl - a.valor_brl
  })

  // Alertas
  var alertas = []
  if (atual.linhas > 0 && anteriorDados.linhas === 0) {
    alertas.push({
      tipo: 'sem_base_comparacao',
      gravidade: 'baixa',
      mensagem:
        'A semana anterior (' +
        prevAno +
        '-W' +
        pad2(prevSemana) +
        ') não tem faturamento registrado, então não há comparativo.',
    })
  }
  if (atual.linhas === 0) {
    alertas.push({
      tipo: 'sem_dados',
      gravidade: 'alta',
      mensagem:
        'Nenhum faturamento registrado na semana ' + alvo.ano + '-W' + pad2(alvo.semana) + '.',
    })
  }
  if (variacao !== null && variacao <= -10) {
    alertas.push({
      tipo: 'queda_semana',
      gravidade: variacao <= -25 ? 'alta' : 'media',
      mensagem:
        'Faturamento caiu ' +
        Math.abs(variacao) +
        '% contra a semana anterior (' +
        anteriorDados.totalBrl +
        ' → ' +
        atual.totalBrl +
        ').',
    })
  }
  for (var ai = 0; ai < vendedores.length; ai++) {
    var vd = vendedores[ai]
    if (vd.valor_brl === 0 && vd.semana_anterior_brl > 0) {
      alertas.push({
        tipo: 'vendedor_zerado',
        gravidade: 'alta',
        mensagem:
          vd.vendedor +
          ' não faturou nesta semana (havia feito R$ ' +
          vd.semana_anterior_brl +
          ').',
      })
    } else if (
      vd.variacao_percentual !== null &&
      vd.variacao_percentual <= -30 &&
      vd.semana_anterior_brl > 0
    ) {
      alertas.push({
        tipo: 'vendedor_queda',
        gravidade: 'media',
        mensagem: vd.vendedor + ' caiu ' + Math.abs(vd.variacao_percentual) + '% na semana.',
      })
    }
  }
  if (atingimento !== null && atingimento < 70) {
    alertas.push({
      tipo: 'meta_risco',
      gravidade: atingimento < 50 ? 'alta' : 'media',
      mensagem:
        'Mês em ' +
        atingimento +
        '% da meta (' +
        round2(realizadoMes) +
        ' de ' +
        round2(metaMes) +
        ').',
    })
  }
  var topClientes = ordenarMapa(atual.porCliente, 'cliente')
  if (topClientes.length > 0 && atual.totalBrl > 0) {
    var concentracao = round2((topClientes[0].valor_brl / atual.totalBrl) * 100)
    if (concentracao >= 40) {
      alertas.push({
        tipo: 'concentracao',
        gravidade: 'media',
        mensagem: topClientes[0].cliente + ' responde por ' + concentracao + '% da semana.',
      })
    }
  }

  // Destaques
  var destaques = []
  if (variacao !== null && variacao > 0) {
    destaques.push('Semana cresceu ' + variacao + '% contra a anterior.')
  }
  if (topClientes.length > 0) {
    destaques.push(
      'Maior cliente: ' + topClientes[0].cliente + ' (R$ ' + topClientes[0].valor_brl + ').',
    )
  }
  if (atual.vendedorAtribuido && vendedores.length > 0 && vendedores[0].valor_brl > 0) {
    destaques.push(
      'Destaque do time: ' + vendedores[0].vendedor + ' (R$ ' + vendedores[0].valor_brl + ').',
    )
  }
  var familias = ordenarMapa(atual.porFamilia, 'familia')
  if (familias.length > 0) {
    destaques.push('Família líder: ' + familias[0].familia + ' (R$ ' + familias[0].valor_brl + ').')
  }

  // Diagnóstico de dados: distingue "sem movimento no período" de "base vazia".
  var diagnostico = {
    faturamento_total: 0,
    metas_total: 0,
    carteira_total: 0,
    equipe_total: 0,
    ultimo_periodo: null,
  }
  try {
    diagnostico.faturamento_total = $app.countRecords('faturamento')
    diagnostico.metas_total = $app.countRecords('metas')
    diagnostico.carteira_total = $app.countRecords('pedidos_carteira')
    diagnostico.equipe_total = $app.countRecords('equipe')
  } catch (err) {}
  try {
    var ultimos = $app.findRecordsByFilter('faturamento', '1=1', '-data_documento', 1, 0)
    if (ultimos.length > 0) {
      diagnostico.ultimo_periodo = {
        ano: num(ultimos[0], 'ano'),
        mes: num(ultimos[0], 'mes'),
        semana_iso: num(ultimos[0], 'semana_iso'),
        data_documento: str(ultimos[0], 'data_documento'),
      }
    }
  } catch (err) {}

  return e.json(200, {
    diagnostico: diagnostico,
    periodo: {
      ano: alvo.ano,
      semana_iso: alvo.semana,
      inicio: fmtDateUTC(segunda),
      fim: fmtDateUTC(new Date(segunda.getTime() + 6 * 86400000)),
      rotulo: alvo.ano + '-W' + pad2(alvo.semana),
    },
    semana_anterior: {
      ano: prevAno,
      semana_iso: prevSemana,
      rotulo: prevAno + '-W' + pad2(prevSemana),
    },
    resumo: {
      faturamento_brl: atual.totalBrl,
      faturamento_usd: atual.totalUsd,
      semanas_anteriores_brl: anteriorDados.totalBrl,
      variacao_percentual: variacao,
      linhas: atual.linhas,
      notas: atual.notas,
      clientes: atual.clientes,
      ticket_medio_brl: atual.clientes > 0 ? round2(atual.totalBrl / atual.clientes) : 0,
    },
    mes: {
      ano: anoRef,
      mes: mesRef,
      meta_brl: round2(metaMes),
      realizado_brl: round2(realizadoMes),
      atingimento_percentual: atingimento,
      carteira_brl: round2(carteira),
      cobertura_percentual: cobertura,
    },
    destaques: destaques,
    alertas: alertas,
    por_vendedor: vendedores,
    top_clientes: topClientes.slice(0, 10),
    por_familia: familias.slice(0, 10),
    gerado_em: new Date().toISOString(),
  })
})
