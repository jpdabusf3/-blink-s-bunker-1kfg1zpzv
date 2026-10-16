migrate(
  (app) => {
    // 1. Localizar ou garantir o registro do distribuidor FeedPro
    const distCol = app.findCollectionByNameOrId('distribuidores')
    const existingFeedpro = app.findRecordsByFilter(
      'distribuidores',
      "nome ~ 'Feedpro' || nome ~ 'FeedPro'",
      '',
      1,
      0,
    )

    let feedproId = ''
    let feedproRecord = null
    if (existingFeedpro && existingFeedpro.length > 0) {
      feedproRecord = existingFeedpro[0]
      feedproId = feedproRecord.id
    } else {
      feedproRecord = new Record(distCol)
      feedproRecord.set('nome', 'FeedPro (Feedpro Science Nutrition)')
      feedproRecord.set('cnpj', '19.824.789/0001-45')
      feedproRecord.set('contato_nome', 'Equipe Comercial FeedPro')
      feedproRecord.set('contato_email', 'contato@feedpro.com.br')
      feedproRecord.set('contato_telefone', '(62) 3200-0000')
      feedproRecord.set('status', 'ativo')
      feedproRecord.set(
        'observacoes',
        'Distribuidor oficial Blink Biotech para nutrição e saúde animal.',
      )
      app.save(feedproRecord)
      feedproId = feedproRecord.id
    }

    if (!feedproId) return

    // 2. Lista oficial e completa da carteira FeedPro (93 clientes)
    const CARTEIRA_OFICIAL_FEEDPRO = [
      // BA (1)
      { uf: 'BA', nome: 'TOPAGRO' },

      // CE (1)
      { uf: 'CE', nome: 'INTEGRAL MIX (Grupo Regina)' },

      // DF (1)
      { uf: 'DF', nome: 'GRANJA BRASILIA' },

      // GO (19)
      { uf: 'GO', nome: 'AGROCRIA' },
      { uf: 'GO', nome: 'AGROMINAS' },
      { uf: 'GO', nome: 'AGROQUIMA' },
      { uf: 'GO', nome: 'ALIANÇA NUTRIÇÃO ANIMAL' },
      { uf: 'GO', nome: 'CAPUL (Unai)' },
      { uf: 'GO', nome: 'CHAMPION' },
      { uf: 'GO', nome: 'COOPERATIVA DE MORRINHOS' },
      { uf: 'GO', nome: 'CRIA MAIS' },
      { uf: 'GO', nome: 'CRIA PECUARIA TECNICA' },
      { uf: 'GO', nome: 'FÓSCAMP' },
      { uf: 'GO', nome: 'FÓSCRIA/FERSAN' },
      { uf: 'GO', nome: 'GRUPO CEREAL' },
      { uf: 'GO', nome: 'LIDER NUTRIÇÃO ANIMAL' },
      { uf: 'GO', nome: 'MONTEALEGRE' },
      { uf: 'GO', nome: 'NUTRI MAIS' },
      { uf: 'GO', nome: 'NUTRISA' },
      { uf: 'GO', nome: 'NUTROESTE' },
      { uf: 'GO', nome: 'RAYQUIMICA' },
      { uf: 'GO', nome: 'WERNECK' },

      // MG (16)
      { uf: 'MG', nome: 'CCPR' },
      { uf: 'MG', nome: 'COOPRATA' },
      { uf: 'MG', nome: 'FLENDS' },
      { uf: 'MG', nome: 'FORTUNA/CASTANHEIRA' },
      { uf: 'MG', nome: 'Grupo de Cooperativa Patos e Outros' },
      { uf: 'MG', nome: 'MAJOR NUTRIÇÃO ANIMAL' },
      { uf: 'MG', nome: 'MATSUDA MG' },
      { uf: 'MG', nome: 'PECMIX' },
      { uf: 'MG', nome: 'Qualis' },
      { uf: 'MG', nome: 'RAÇÕES PORTO ALEGRE' },
      { uf: 'MG', nome: 'RAÇÕES RGL' },
      { uf: 'MG', nome: 'RAÇÕES VEREIRA' },
      { uf: 'MG', nome: 'SCALÃO' },
      { uf: 'MG', nome: 'SOMA NUTRIÇÃO' },
      { uf: 'MG', nome: 'TECNUTRI' },
      { uf: 'MG', nome: 'TOPNUTRI' },

      // MS (6)
      { uf: 'MS', nome: 'ADAMES' },
      { uf: 'MS', nome: 'AGROMIX' },
      { uf: 'MS', nome: 'BOM PESO' },
      { uf: 'MS', nome: 'CRIABEM' },
      { uf: 'MS', nome: 'REAL H' },
      { uf: 'MS', nome: 'SHOPPING DO CRIADOR' },

      // MT (7)
      { uf: 'MT', nome: 'MJ NUTRIÇÃO ANIMAL' },
      { uf: 'MT', nome: 'NUTRI BARRA' },
      { uf: 'MT', nome: 'NUTRIDEAL' },
      { uf: 'MT', nome: 'PLANUTRE' },
      { uf: 'MT', nome: 'SOCRIA' },
      { uf: 'MT', nome: 'XINGU NUTRIÇÃO ANIMAL' },
      { uf: 'MT', nome: 'ZOOTEC' },

      // PA (1)
      { uf: 'PA', nome: 'ORIGEM NUTRIÇÃO ANIMAL' },

      // PE (4)
      { uf: 'PE', nome: 'FRANGO NATTO' },
      { uf: 'PE', nome: 'MARATÁ' },
      { uf: 'PE', nome: 'MAURICEIA' },
      { uf: 'PE', nome: 'NUTRANE' },

      // PR (7)
      { uf: 'PR', nome: 'AGRARIA' },
      { uf: 'PR', nome: 'CASA AGROPECUÁRIA' },
      { uf: 'PR', nome: 'CASA RURAL' },
      { uf: 'PR', nome: 'COCAMAR' },
      { uf: 'PR', nome: 'GRASP' },
      { uf: 'PR', nome: 'LIBER NUTRIÇÃO ANIMAL' },
      { uf: 'PR', nome: 'VACCINAR' },

      // RJ (1)
      { uf: 'RJ', nome: 'SANLAC' },

      // RO (6)
      { uf: 'RO', nome: 'ARANTES' },
      { uf: 'RO', nome: 'DB NUTRIÇÃO' },
      { uf: 'RO', nome: 'LINEAGRO (GRUPO PATRIA)/SUPREMAX' },
      { uf: 'RO', nome: 'MARILIA NUTRI' },
      { uf: 'RO', nome: 'SUSTENUTRI' },
      { uf: 'RO', nome: 'VITAMAIS' },

      // RS (7)
      { uf: 'RS', nome: 'AGROBELLA ALIMENTOS' },
      { uf: 'RS', nome: 'BIOMIX' },
      { uf: 'RS', nome: 'BRASÃO PAMPA' },
      { uf: 'RS', nome: 'CARRER ALIMENTOS' },
      { uf: 'RS', nome: 'COTRIJAL' },
      { uf: 'RS', nome: 'MIGPLUS' },
      { uf: 'RS', nome: 'NUTRIPAMPA e PROVEMIX Grupo JOST e Ferreira' },

      // SC (4)
      { uf: 'SC', nome: 'BUENAS/CAMERA/ CAMPINA' },
      { uf: 'SC', nome: 'COOPAGRI' },
      { uf: 'SC', nome: 'PNI/DISPRA' },
      { uf: 'SC', nome: 'NUCTRAMIX' },

      // SP (9)
      { uf: 'SP', nome: 'AGROCERES' },
      { uf: 'SP', nome: 'CAMDA' },
      { uf: 'SP', nome: 'COOPERCITRUS' },
      { uf: 'SP', nome: 'DE HEUS' },
      { uf: 'SP', nome: 'FAIRFEED' },
      { uf: 'SP', nome: 'GASPARIN' },
      { uf: 'SP', nome: 'GUABI' },
      { uf: 'SP', nome: 'MINERTHAL' },
      { uf: 'SP', nome: 'NUTRISAL' },

      // TO (2)
      { uf: 'TO', nome: 'AGRONORTE' },
      { uf: 'TO', nome: 'HALK NUTRIENTES' },

      // SEM UF (1)
      { uf: '', nome: 'JAGRO' },
    ]

    // 3. Atualizar ufs_atuacao do distribuidor Feedpro com as UFs da carteira
    try {
      const ufsAtivas = [
        'BA',
        'CE',
        'DF',
        'GO',
        'MG',
        'MS',
        'MT',
        'PA',
        'PE',
        'PR',
        'RJ',
        'RO',
        'RS',
        'SC',
        'SP',
        'TO',
      ]
      feedproRecord.set('ufs_atuacao', ufsAtivas)
      app.save(feedproRecord)
    } catch (e) {
      console.log('Aviso ao atualizar ufs_atuacao Feedpro:', e)
    }

    // 4. Carregar clientes atuais da FeedPro
    const clientesCol = app.findCollectionByNameOrId('clientes_distribuidor')
    const existentes = app.findRecordsByFilter(
      'clientes_distribuidor',
      `distribuidor_id = '${feedproId}'`,
      '',
      500,
      0,
    )

    // Helper de normalização: trim, uppercase, remove acentos
    function normalize(str) {
      if (!str) return ''
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim()
    }

    // Mapeamento específico para conciliar nomes curtos da planilha com seeds anteriores que tinham sufixos
    // (ex: "TOPAGRO" -> "TOPAGRO NUTRIÇÃO ANIMAL", "NUCTRAMIX" -> "NUCTRAMIX NUTRIÇÃO ANIMAL")
    const aliases = {
      TOPAGRO: 'TOPAGRO NUTRIÇÃO ANIMAL',
      AGROCERES: 'AGROCERES MULTIMIX',
      COCAMAR: 'COCAMAR COOPERATIVA AGROINDUSTRIAL',
      NUCTRAMIX: 'NUCTRAMIX NUTRIÇÃO ANIMAL',
      VACCINAR: 'VACCINAR NUTRICAO ANIMAL',
      'DE HEUS': 'DE HEUS BRASIL',
      FAIRFEED: 'FAIRFEED NUTRIÇÃO',
    }

    // Indexar registros existentes por chave normalizada
    const existingMap = {}
    for (let i = 0; i < existentes.length; i++) {
      const rec = existentes[i]
      const rawNome = rec.getString ? rec.getString('nome_cliente') : rec.nome_cliente
      const normNome = normalize(rawNome)
      if (normNome) {
        existingMap[normNome] = rec
      }
    }

    // Também indexar por alias para casar os 7 seeds antigos com nomes truncados da planilha
    const aliasMap = {}
    for (const shortKey in aliases) {
      const longVal = aliases[shortKey]
      const normLong = normalize(longVal)
      if (existingMap[normLong]) {
        aliasMap[normalize(shortKey)] = existingMap[normLong]
      }
    }

    // 5. Upsert idempotente de cada cliente oficial
    for (let k = 0; k < CARTEIRA_OFICIAL_FEEDPRO.length; k++) {
      const item = CARTEIRA_OFICIAL_FEEDPRO[k]
      const itemNorm = normalize(item.nome)

      // Verificar se já existe (por nome exato normalizado ou por alias de seed anterior)
      const existingMatch = existingMap[itemNorm] || aliasMap[itemNorm]

      if (existingMatch) {
        // Cliente já existe: manter status e observações intactos.
        // Se veio de um seed com nome estendido e agora padronizamos para o nome oficial da planilha:
        existingMatch.set('nome_cliente', item.nome)
        // Se o cliente não tinha UF ou se a UF da planilha for a oficial, atualizar
        if (item.uf) {
          existingMatch.set('uf', item.uf)
        } else {
          existingMatch.set('uf', '')
        }
        app.save(existingMatch)
      } else {
        // Cliente novo: inserir com status ativo e nome exato
        const novo = new Record(clientesCol)
        novo.set('distribuidor_id', feedproId)
        novo.set('nome_cliente', item.nome)
        novo.set('uf', item.uf || '')
        novo.set('municipio', '')
        novo.set('status', 'ativo')
        novo.set(
          'observacoes',
          item.uf
            ? 'Cliente oficial carteira FeedPro'
            : 'Atenção: UF pendente de complemento (planilha original sem UF)',
        )
        app.save(novo)

        // Adicionar ao mapa em caso de linhas duplicadas no input
        existingMap[itemNorm] = novo
      }
    }

    // 6. Limpar registros do seed fictício que NÃO fazem parte da planilha oficial da FeedPro
    // (A planilha anexa é a fonte da verdade de 93 clientes reais)
    // Criamos um set de chaves oficiais normalizadas
    const oficialNormKeys = {}
    for (let k = 0; k < CARTEIRA_OFICIAL_FEEDPRO.length; k++) {
      oficialNormKeys[normalize(CARTEIRA_OFICIAL_FEEDPRO[k].nome)] = true
    }

    // Reconsultar todos os clientes da Feedpro
    const allAtual = app.findRecordsByFilter(
      'clientes_distribuidor',
      `distribuidor_id = '${feedproId}'`,
      '',
      500,
      0,
    )

    for (let i = 0; i < allAtual.length; i++) {
      const rec = allAtual[i]
      const n = normalize(rec.getString ? rec.getString('nome_cliente') : rec.nome_cliente)
      if (!oficialNormKeys[n]) {
        // É um registro residual de seeds anteriores que não pertence à carteira oficial
        console.log('Removendo cliente não pertencente à carteira oficial FeedPro:', n)
        app.delete(rec)
      }
    }
  },
  (app) => {
    // Reversão segura no-op para preservar integridade
  },
)
