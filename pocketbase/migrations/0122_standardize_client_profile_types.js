migrate(
  (app) => {
    // Migration 0122: Padronizar profile_type dos clientes antigos para o catálogo canônico
    // Catálogo canônico da aplicação (definido em clientCategories.ts e nos formulários do CRM):
    // 1. Indústria
    // 2. Cooperativa (ou Cooperativas)
    // 3. Distribuidor (ou Distribuidores)
    // 4. Produtor (ou Produtores)
    // 5. Revenda (ou Revendas)
    // 6. Integradora
    // 7. Premixeira (ou Premixeiras)
    // 8. Representantes
    // 9. Outros

    const CANONICAL_MAP = {
      // Indústria
      industria: 'Indústria',
      industrias: 'Indústria',
      indústria: 'Indústria',
      indústrias: 'Indústria',

      // Cooperativa
      cooperativa: 'Cooperativa',
      cooperativas: 'Cooperativa',

      // Distribuidor
      distribuidor: 'Distribuidor',
      distribuidores: 'Distribuidor',

      // Produtor
      produtor: 'Produtor',
      produtores: 'Produtor',

      // Revenda
      revenda: 'Revenda',
      revendas: 'Revenda',

      // Integradora
      integradora: 'Integradora',
      integradoras: 'Integradora',

      // Premixeira
      premixeira: 'Premixeira',
      premixeiras: 'Premixeira',

      // Representantes
      representante: 'Representantes',
      representantes: 'Representantes',

      // Outros
      outro: 'Outros',
      outros: 'Outros',
    }

    function removeAccents(str) {
      if (!str) return ''
      return String(str)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
    }

    function toSingleCanonical(val) {
      if (!val) return null
      const clean = String(val).trim()
      if (!clean) return null

      const norm = removeAccents(clean)
      if (CANONICAL_MAP[norm]) {
        return CANONICAL_MAP[norm]
      }

      // Procura por radical aproximado
      if (norm.indexOf('industr') === 0) return 'Indústria'
      if (norm.indexOf('cooperat') === 0) return 'Cooperativa'
      if (norm.indexOf('distrib') === 0) return 'Distribuidor'
      if (norm.indexOf('produt') === 0) return 'Produtor'
      if (norm.indexOf('revend') === 0) return 'Revenda'
      if (norm.indexOf('integra') === 0) return 'Integradora'
      if (norm.indexOf('premix') === 0) return 'Premixeira'
      if (norm.indexOf('represen') === 0) return 'Representantes'
      if (norm.indexOf('outr') === 0) return 'Outros'

      return null
    }

    function parseRawProfile(raw) {
      if (!raw) return []
      if (Array.isArray(raw)) return raw

      if (typeof raw === 'string') {
        const trimmed = raw.trim()
        if (!trimmed) return []

        if (trimmed.indexOf('[') === 0 && trimmed.lastIndexOf(']') === trimmed.length - 1) {
          try {
            const parsed = JSON.parse(trimmed)
            if (Array.isArray(parsed)) return parsed
            return [parsed]
          } catch (_) {
            // continua para quebra por vírgula
          }
        }

        if (trimmed.indexOf(',') !== -1 || trimmed.indexOf(';') !== -1) {
          const sep = trimmed.indexOf(';') !== -1 ? ';' : ','
          return trimmed
            .split(sep)
            .map((p) => p.trim())
            .filter(Boolean)
        }

        return [trimmed]
      }

      return [raw]
    }

    // 1. Buscar todas as factories em lotes
    if (!app.hasTable('factories')) {
      console.log('[Migration 0122] Tabela factories não existe, pulando.')
      return
    }

    const batchSize = 200
    let offset = 0
    let totalExamined = 0
    let totalUpdated = 0
    let totalAlreadyNormalized = 0
    let fallbackToOutros = 0
    let emptyCount = 0

    while (true) {
      let batch = []
      try {
        batch = app.findRecordsByFilter('factories', '', '', batchSize, offset)
      } catch (err) {
        console.log('[Migration 0122] Fim da paginação ou erro ao listar factories:', err)
        break
      }

      if (!batch || batch.length === 0) break

      for (let i = 0; i < batch.length; i++) {
        const rec = batch[i]
        totalExamined++
        const recId = rec.getString ? rec.getString('id') : rec.id
        const raw = rec.get ? rec.get('profile_type') : null

        const rawList = parseRawProfile(raw)
        const normalizedItems = []
        const seen = {}

        for (let j = 0; j < rawList.length; j++) {
          const item = rawList[j]
          const mapped = toSingleCanonical(item)
          if (mapped) {
            if (!seen[mapped]) {
              seen[mapped] = true
              normalizedItems.push(mapped)
            }
          } else {
            // Valor fora do catálogo padrão: mapeia para 'Outros'
            const itemStr = String(item).trim()
            if (itemStr && !seen['Outros']) {
              seen['Outros'] = true
              normalizedItems.push('Outros')
              fallbackToOutros++
              console.log(
                '[Migration 0122] Valor fora de catálogo mapeado para "Outros": "' +
                  itemStr +
                  '" (Cliente ID ' +
                  recId +
                  ')',
              )
            }
          }
        }

        if (normalizedItems.length === 0) {
          emptyCount++
        }

        // Verifica se houve mudança em relação ao estado atual salvo
        let changed = false
        if (!Array.isArray(raw)) {
          changed = true
        } else if (raw.length !== normalizedItems.length) {
          changed = true
        } else {
          for (let k = 0; k < raw.length; k++) {
            if (raw[k] !== normalizedItems[k]) {
              changed = true
              break
            }
          }
        }

        if (changed) {
          const jsonVal = JSON.stringify(normalizedItems)
          app
            .db()
            .newQuery('UPDATE factories SET profile_type = {:json} WHERE id = {:id}')
            .bind({ json: jsonVal, id: recId })
            .execute()
          totalUpdated++
        } else {
          totalAlreadyNormalized++
        }
      }

      if (batch.length < batchSize) break
      offset += batchSize
    }

    console.log(
      '[Migration 0122] Concluída padronização de profile_type. Examinados: ' +
        totalExamined +
        ', Atualizados: ' +
        totalUpdated +
        ', Inalterados/Já válidos: ' +
        totalAlreadyNormalized +
        ', Vazio: ' +
        emptyCount +
        ', Mapeados para Outros: ' +
        fallbackToOutros,
    )
  },
  (app) => {
    // Idempotente / reversão dispensada
  },
)
