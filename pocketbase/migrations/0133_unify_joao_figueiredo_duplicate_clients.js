migrate(
  (app) => {
    // Migration 0133: Unificar cadastros duplicados no perfil do vendedor João Figueiredo
    const CANONICAL_SELLER_GT_ID = '4urt19q2phjs7fn'
    const USER_JOAO_PEDRO = 'xhl48ye8ayb8fbu'
    const USER_JOAO_FIGUEIREDO = 'r88kpzzyrccaao7'
    const CANONICAL_SELLER_NAME = 'João Figueiredo'

    console.log(
      '[Migration 0133] Iniciando unificação de clientes duplicados para João Figueiredo...',
    )

    if (!app.hasTable('factories')) {
      console.log('[Migration 0133] Coleção factories não encontrada. Abortando.')
      return
    }

    // 1. Funções utilitárias de normalização (Goja ES5/ES6 compatível)
    function stripAccents(str) {
      if (!str) return ''
      var map = {
        á: 'a',
        à: 'a',
        ã: 'a',
        â: 'a',
        ä: 'a',
        é: 'e',
        è: 'e',
        ê: 'e',
        ë: 'e',
        í: 'i',
        ì: 'i',
        î: 'i',
        ï: 'i',
        ó: 'o',
        ò: 'o',
        õ: 'o',
        ô: 'o',
        ö: 'o',
        ú: 'u',
        ù: 'u',
        û: 'u',
        ü: 'u',
        ç: 'c',
        ñ: 'n',
      }
      var res = ''
      var lower = str.toLowerCase()
      for (var i = 0; i < lower.length; i++) {
        var ch = lower.charAt(i)
        res += map[ch] !== undefined ? map[ch] : ch
      }
      return res
    }

    function cleanCnpj(cnpj) {
      if (!cnpj) return ''
      var digits = ''
      for (var i = 0; i < cnpj.length; i++) {
        var ch = cnpj.charAt(i)
        if (ch >= '0' && ch <= '9') {
          digits += ch
        }
      }
      return digits.length === 14 ? digits : ''
    }

    function normalizeName(name) {
      if (!name) return ''
      var s = stripAccents(name).toLowerCase()
      s = s.replace(/\*/g, ' ')
      s = s.replace(/\(grupo scm\)/g, ' ')
      s = s.replace(/\/ grupo scm/g, ' ')
      s = s.replace(/grupo scm/g, ' ')
      s = s.replace(/\(rações agronorte\)/g, ' ')
      s = s.replace(/\(racoes agronorte\)/g, ' ')
      s = s.replace(/\(jbs\)/g, ' ')
      s = s.replace(/\(laticínio\)/g, ' ')
      s = s.replace(/\(laticinio\)/g, ' ')
      s = s.replace(/\(integral mix\)/g, ' ')
      s = s.replace(/\(agroserrana\)/g, ' ')
      s = s.replace(/\(amazonas agroindústria de rações ltda\)/g, ' ')
      s = s.replace(/\(amazonas agroindustria de racoes ltda\)/g, ' ')
      s = s.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
      s = s.replace(/\bltda\b/g, ' ')
      s = s.replace(/\bsa\b/g, ' ')
      s = s.replace(/\bepp\b/g, ' ')
      s = s.replace(/\bme\b/g, ' ')
      s = s.replace(/\s+/g, ' ').trim()
      return s
    }

    // 2. Buscar todas as fábricas ativas no banco
    var allFactories = []
    var page = 0
    var pageSize = 200
    while (true) {
      var batch = []
      try {
        batch = app.findRecordsByFilter(
          'factories',
          'is_deleted != true',
          'created',
          pageSize,
          page * pageSize,
        )
      } catch (err) {
        console.log('[Migration 0133] Erro ao buscar lote de factories:', err)
        break
      }
      if (!batch || batch.length === 0) break
      for (var b = 0; b < batch.length; b++) {
        allFactories.push(batch[b])
      }
      if (batch.length < pageSize) break
      page++
    }

    console.log('[Migration 0133] Total de fábricas ativas lidas:', allFactories.length)

    function belongsToSeller(rec) {
      var vend = rec.getString('vendedor_id') || ''
      var owner = rec.getString('salesOwner') || ''
      return (
        vend === CANONICAL_SELLER_GT_ID ||
        owner === USER_JOAO_PEDRO ||
        owner === USER_JOAO_FIGUEIREDO
      )
    }

    // 3. Agrupamento por match de CNPJ ou Nome normalizado via Union-Find
    var n = allFactories.length
    var parent = []
    for (var i = 0; i < n; i++) parent[i] = i

    function findRoot(i) {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]]
        i = parent[i]
      }
      return i
    }

    function union(i, j) {
      var rootI = findRoot(i)
      var rootJ = findRoot(j)
      if (rootI !== rootJ) {
        parent[rootI] = rootJ
      }
    }

    var cnpjMap = {}
    var nameMap = {}

    for (var i = 0; i < n; i++) {
      var rec = allFactories[i]
      var rawCnpj = rec.getString('cnpj') || ''
      var cnpj = cleanCnpj(rawCnpj)
      var normName = normalizeName(rec.getString('name') || '')

      if (cnpj) {
        if (cnpjMap[cnpj] !== undefined) {
          union(i, cnpjMap[cnpj])
        } else {
          cnpjMap[cnpj] = i
        }
      }

      if (normName && normName.length >= 3) {
        if (nameMap[normName] !== undefined) {
          union(i, nameMap[normName])
        } else {
          nameMap[normName] = i
        }
      }
    }

    var groupsMap = {}
    for (var i = 0; i < n; i++) {
      var root = findRoot(i)
      if (!groupsMap[root]) groupsMap[root] = []
      groupsMap[root].push(allFactories[i])
    }

    var duplicateGroups = []
    for (var rKey in groupsMap) {
      var grp = groupsMap[rKey]
      if (grp.length > 1) {
        var hasSeller = false
        for (var g = 0; g < grp.length; g++) {
          if (belongsToSeller(grp[g])) {
            hasSeller = true
            break
          }
        }
        if (hasSeller) {
          duplicateGroups.push(grp)
        }
      }
    }

    console.log(
      '[Migration 0133] Total de grupos de duplicados encontrados para João Figueiredo:',
      duplicateGroups.length,
    )

    var relatedTables = [
      { table: 'deal_activities', col: 'deal_id' },
      { table: 'atividades', col: 'cliente_id' },
      { table: 'orders', col: 'factoryId' },
      { table: 'tasks', col: 'related_factory_id' },
      { table: 'visits', col: 'factory_id' },
      { table: 'agenda_tasks', col: 'deal_id' },
      { table: 'planos_acao', col: 'cliente' },
      { table: 'historico_vendas', col: 'factory_id' },
      { table: 'nfe_pedidos', col: 'factory_id' },
      { table: 'pedidos', col: 'clienteId' },
      { table: 'factory_change_logs', col: 'factory_id' },
    ]

    function countRelatedActions(recId) {
      var count = 0
      for (var t = 0; t < relatedTables.length; t++) {
        var tbl = relatedTables[t].table
        var col = relatedTables[t].col
        if (app.hasTable(tbl)) {
          try {
            var resObj = {}
            app
              .db()
              .newQuery('SELECT COUNT(1) as cnt FROM ' + tbl + ' WHERE ' + col + ' = {:id}')
              .bind({ id: recId })
              .one(resObj)
            if (resObj && resObj.cnt) {
              count += parseInt(resObj.cnt, 10) || 0
            }
          } catch (_) {}
        }
      }
      return count
    }

    // 4. Sistema de pontuação para escolha do sobrevivente
    function scoreRecord(rec) {
      var score = 0
      var recId = rec.id

      // Ações no funil / registros relacionados (peso 10 por ação)
      var actions = countRelatedActions(recId)
      score += actions * 10

      // Coordenadas resolvidas (lat/lng != 0 e precisao != sem-localizacao)
      var lat = rec.getFloat('lat') || rec.getFloat('latitude') || 0
      var lng = rec.getFloat('lng') || rec.getFloat('longitude') || 0
      var prec = rec.getString('precisao') || ''
      if ((lat !== 0 || lng !== 0) && prec !== 'sem-localizacao' && prec !== '') {
        score += 25
      }

      // enriched_at preenchido
      if (rec.getString('enriched_at')) {
        score += 15
      }

      // address_status preenchido e não falho
      var addrStatus = rec.getString('address_status') || ''
      if (addrStatus && addrStatus !== 'failed') {
        score += 10
      }

      // Mais campos de contato
      if (rec.getString('telefone') || rec.getString('contactPhone')) score += 5
      if (rec.getString('contact_email')) score += 5
      if (rec.getString('contato') || rec.getString('contactName')) score += 5
      if (rec.getString('cnpj')) score += 10
      if (rec.getString('cep') || rec.getString('logradouro')) score += 5

      // FunnelStage mais avançado que Lead
      var stage = (rec.getString('funnelStage') || '').toLowerCase()
      if (stage && stage !== 'lead' && stage !== '') {
        score += 20
      }

      // Last interaction
      if (rec.getString('lastInteraction')) {
        score += 5
      }

      // PotentialValue maior que 0
      var potVal = rec.getFloat('potentialValue') || 0
      if (potVal > 0) {
        score += 5
      }

      // Vendedor canônico já atribuído
      if (rec.getString('vendedor_id') === CANONICAL_SELLER_GT_ID) {
        score += 5
      }

      return { score: score, actions: actions }
    }

    var totalSoftDeleted = 0
    var totalReassignedRecords = 0
    var logUserId = USER_JOAO_PEDRO

    // 5. Execução por grupo
    for (var gIdx = 0; gIdx < duplicateGroups.length; gIdx++) {
      var group = duplicateGroups[gIdx]

      var bestIdx = 0
      var bestScore = -1
      var bestActions = -1
      var bestCreated = ''

      for (var m = 0; m < group.length; m++) {
        var rec = group[m]
        var evalRes = scoreRecord(rec)
        var s = evalRes.score
        var a = evalRes.actions
        var created = rec.getString('created') || ''

        var isBetter = false
        if (s > bestScore) {
          isBetter = true
        } else if (s === bestScore) {
          if (a > bestActions) {
            isBetter = true
          } else if (a === bestActions) {
            if (!bestCreated || created < bestCreated) {
              isBetter = true
            }
          }
        }

        if (isBetter) {
          bestIdx = m
          bestScore = s
          bestActions = a
          bestCreated = created
        }
      }

      var survivor = group[bestIdx]
      var duplicates = []
      for (var m = 0; m < group.length; m++) {
        if (m !== bestIdx) {
          duplicates.push(group[m])
        }
      }

      var survivorId = survivor.id
      var duplicateIds = duplicates.map(function (d) {
        return d.id
      })

      console.log(
        '[Migration 0133] Grupo ' +
          (gIdx + 1) +
          '/' +
          duplicateGroups.length +
          ': Sobrevivente ' +
          survivor.getString('name') +
          ' (' +
          survivorId +
          ', score=' +
          bestScore +
          ')' +
          ' unificando [' +
          duplicateIds.join(', ') +
          ']',
      )

      // 5.1 UNIFICAÇÃO NO SOBREVIVENTE
      var fieldsToFill = [
        'city',
        'state',
        'stateRegion',
        'country',
        'address',
        'cep',
        'logradouro',
        'numero',
        'bairro',
        'complemento',
        'standardized_address',
        'cnpj',
        'tipo',
        'contato',
        'contactName',
        'contactPhone',
        'telefone',
        'contact_email',
        'profile_type',
        'animalSpecies',
        'carteira',
        'grupo_cliente',
        'capacity',
        'focusLevel',
        'funnelStage',
        'winProbability',
        'salesChannel',
        'indirectChannelType',
        'specialty',
        'suggested_approach',
        'codigo_cliente',
        'technicalManager',
        'gestor_tecnico_id',
        'status_contato',
        'status_funil',
        'proximos_passos',
        'acao',
        'region',
        'status',
        'priority',
        'productLineAffinity',
        'productInterests',
        'operationTypes',
        'precisao',
        'geocode_precision',
        'address_status',
        'enriched_at',
        'salesOwner',
      ]

      for (var f = 0; f < fieldsToFill.length; f++) {
        var fieldName = fieldsToFill[f]
        var currVal = survivor.get(fieldName)
        var isCurrEmpty =
          currVal === null ||
          currVal === undefined ||
          currVal === '' ||
          (Array.isArray(currVal) && currVal.length === 0)

        if (isCurrEmpty) {
          for (var d = 0; d < duplicates.length; d++) {
            var dupVal = duplicates[d].get(fieldName)
            var isDupEmpty =
              dupVal === null ||
              dupVal === undefined ||
              dupVal === '' ||
              (Array.isArray(dupVal) && dupVal.length === 0)
            if (!isDupEmpty) {
              survivor.set(fieldName, dupVal)
              break
            }
          }
        }
      }

      // Coordenadas
      var survLat = survivor.getFloat('lat') || survivor.getFloat('latitude') || 0
      var survLng = survivor.getFloat('lng') || survivor.getFloat('longitude') || 0
      if (survLat === 0 && survLng === 0) {
        for (var d = 0; d < duplicates.length; d++) {
          var dLat = duplicates[d].getFloat('lat') || duplicates[d].getFloat('latitude') || 0
          var dLng = duplicates[d].getFloat('lng') || duplicates[d].getFloat('longitude') || 0
          if (dLat !== 0 || dLng !== 0) {
            survivor.set('lat', dLat)
            survivor.set('latitude', dLat)
            survivor.set('lng', dLng)
            survivor.set('longitude', dLng)
            var dPrec = duplicates[d].getString('precisao')
            if (dPrec) survivor.set('precisao', dPrec)
            break
          }
        }
      }

      // lastInteraction
      var maxLastInteraction = survivor.getString('lastInteraction') || ''
      for (var d = 0; d < duplicates.length; d++) {
        var dInter = duplicates[d].getString('lastInteraction') || ''
        if (dInter && (!maxLastInteraction || dInter > maxLastInteraction)) {
          maxLastInteraction = dInter
        }
      }
      if (maxLastInteraction) {
        survivor.set('lastInteraction', maxLastInteraction)
      }

      // potentialValue
      var maxPot = survivor.getFloat('potentialValue') || 0
      for (var d = 0; d < duplicates.length; d++) {
        var dPot = duplicates[d].getFloat('potentialValue') || 0
        if (dPot > maxPot) {
          maxPot = dPot
        }
      }
      survivor.set('potentialValue', maxPot)

      // Concatenação de notes / observacoes distintas
      var allNotes = []
      var sNote = (survivor.getString('notes') || survivor.getString('observacoes') || '').trim()
      if (sNote) allNotes.push(sNote)
      for (var d = 0; d < duplicates.length; d++) {
        var dNote = (
          duplicates[d].getString('notes') ||
          duplicates[d].getString('observacoes') ||
          ''
        ).trim()
        if (dNote && allNotes.indexOf(dNote) === -1) {
          allNotes.push(dNote)
        }
      }
      if (allNotes.length > 0) {
        var mergedNote = allNotes.join(' | ')
        survivor.set('notes', mergedNote)
        survivor.set('observacoes', mergedNote)
      }

      // Vendedor canônico sempre João Figueiredo
      survivor.set('vendedor_id', CANONICAL_SELLER_GT_ID)

      try {
        app.save(survivor)
      } catch (err) {
        console.log('[Migration 0133] Erro ao salvar sobrevivente ' + survivorId + ':', err)
      }

      // 5.2 REASSOCIAÇÃO DE REGISTROS RELACIONADOS
      for (var d = 0; d < duplicateIds.length; d++) {
        var dupId = duplicateIds[d]

        for (var t = 0; t < relatedTables.length; t++) {
          var tbl = relatedTables[t].table
          var col = relatedTables[t].col
          if (app.hasTable(tbl)) {
            try {
              app
                .db()
                .newQuery(
                  'UPDATE ' + tbl + ' SET ' + col + ' = {:survivorId} WHERE ' + col + ' = {:dupId}',
                )
                .bind({ survivorId: survivorId, dupId: dupId })
                .execute()
              totalReassignedRecords++
            } catch (tblErr) {
              console.log('[Migration 0133] Aviso ao reatribuir ' + tbl + '.' + col + ':', tblErr)
            }
          }
        }
      }

      // 5.3 EXCLUSÃO LÓGICA (SOFT-DELETE) DOS DUPLICADOS
      var nowIso = new Date().toISOString()
      for (var d = 0; d < duplicates.length; d++) {
        var dupRec = duplicates[d]
        dupRec.set('is_deleted', true)
        dupRec.set('deleted_at', nowIso)
        try {
          app.save(dupRec)
          totalSoftDeleted++
        } catch (err) {
          console.log('[Migration 0133] Erro ao soft-deletar duplicado ' + dupRec.id + ':', err)
        }

        // Registrar em entity_change_logs para o duplicado (action=delete)
        if (app.hasTable('entity_change_logs')) {
          try {
            var colEntityLogs = app.findCollectionByNameOrId('entity_change_logs')
            var logRecDup = new Record(colEntityLogs)
            logRecDup.set('entity_type', 'factories')
            logRecDup.set('entity_id', dupRec.id)
            logRecDup.set('entity_name', dupRec.getString('name') || 'Cliente')
            logRecDup.set('user_id', logUserId)
            logRecDup.set('user_name', CANONICAL_SELLER_NAME)
            logRecDup.set('field', 'is_deleted')
            logRecDup.set('old_value', 'false')
            logRecDup.set('new_value', 'true')
            logRecDup.set('action', 'delete')
            logRecDup.set(
              'change_summary',
              'Unificação de cadastro duplicado: unificado no sobrevivente ' +
                survivorId +
                ' (' +
                survivor.getString('name') +
                ')',
            )
            app.save(logRecDup)
          } catch (logErr) {
            console.log('[Migration 0133] Aviso ao salvar log de delete do duplicado:', logErr)
          }
        }
      }

      // Registrar em entity_change_logs para o sobrevivente (action=update)
      if (app.hasTable('entity_change_logs')) {
        try {
          var colEntityLogs = app.findCollectionByNameOrId('entity_change_logs')
          var logRecSurv = new Record(colEntityLogs)
          logRecSurv.set('entity_type', 'factories')
          logRecSurv.set('entity_id', survivorId)
          logRecSurv.set('entity_name', survivor.getString('name') || 'Cliente')
          logRecSurv.set('user_id', logUserId)
          logRecSurv.set('user_name', CANONICAL_SELLER_NAME)
          logRecSurv.set('field', 'unificacao')
          logRecSurv.set('old_value', '')
          logRecSurv.set('new_value', duplicateIds.join(','))
          logRecSurv.set('action', 'update')
          logRecSurv.set(
            'change_summary',
            'Unificação de cadastro duplicado: manteve ' +
              survivorId +
              ', unificou [' +
              duplicateIds.join(', ') +
              ']',
          )
          app.save(logRecSurv)
        } catch (logErr) {
          console.log('[Migration 0133] Aviso ao salvar log de update do sobrevivente:', logErr)
        }
      }
    }

    console.log('[Migration 0133] Unificação concluída com sucesso.')
    console.log('[Migration 0133] Grupos processados: ' + duplicateGroups.length)
    console.log('[Migration 0133] Cadastros soft-deletados: ' + totalSoftDeleted)
  },
  (app) => {
    // Migration de dados / reversão não necessária
  },
)
