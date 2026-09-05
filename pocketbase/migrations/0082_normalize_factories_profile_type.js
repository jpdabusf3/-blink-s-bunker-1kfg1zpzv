migrate(
  (app) => {
    // 8 Categorias Canônicas com seus radicais para tolerância
    // Migration 0082 - normalização de profile_type
    const CANONICAL_CATEGORIES = [
      'Cooperativas',
      'Distribuidores',
      'Indústria',
      'Integradora',
      'Produtor',
      'Premixeiras',
      'Revenda',
      'Representantes',
    ]

    const CANONICAL_KEYS = {
      Cooperativas: 'cooperativ',
      Distribuidores: 'distribuidor',
      Indústria: 'industri',
      Integradora: 'integrador',
      Produtor: 'produtor',
      Premixeiras: 'premixeir',
      Revenda: 'revend',
      Representantes: 'representant',
    }

    function normalizeCategoryString(str) {
      if (!str) return ''
      return String(str)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
    }

    function matchesProfileCategory(rawProfileValue, targetCategory) {
      if (!rawProfileValue || !targetCategory) return false

      const normalizedVal = normalizeCategoryString(rawProfileValue)
      const normalizedTarget = normalizeCategoryString(targetCategory)

      if (normalizedVal === normalizedTarget) return true

      const canonicalStem = CANONICAL_KEYS[targetCategory]
      if (canonicalStem) {
        if (normalizedVal.indexOf(canonicalStem) === 0) return true
        if (normalizedTarget.indexOf(normalizedVal) === 0 && normalizedVal.length >= 4) return true
      }

      function stem(s) {
        if (s.length > 2 && s.slice(-2) === 'es') return s.slice(0, -2)
        if (s.length > 1 && s.slice(-1) === 's') return s.slice(0, -1)
        return s
      }

      const sVal = stem(normalizedVal)
      const sTarget = stem(normalizedTarget)

      return sVal === sTarget || sVal.indexOf(sTarget) === 0 || sTarget.indexOf(sVal) === 0
    }

    function toCanonical(rawVal) {
      if (!rawVal || !String(rawVal).trim()) return null
      const clean = String(rawVal).trim()
      for (let i = 0; i < CANONICAL_CATEGORIES.length; i++) {
        const cat = CANONICAL_CATEGORIES[i]
        if (matchesProfileCategory(clean, cat)) {
          return cat
        }
      }
      return null
    }

    function normalizeProfileArray(arr) {
      if (!arr || !Array.isArray(arr)) return []
      const seen = {}
      const res = []
      for (let i = 0; i < arr.length; i++) {
        const item = arr[i]
        if (item === null || item === undefined) continue
        const itemStr = String(item).trim()
        if (!itemStr) continue

        const canonical = toCanonical(itemStr)
        const finalVal = canonical || itemStr

        if (!seen[finalVal]) {
          seen[finalVal] = true
          res.push(finalVal)
        }
      }
      return res
    }

    // Carregar todas as factories com paginação defensiva
    const batchSize = 500
    let offset = 0
    const factories = []

    while (true) {
      const batch = app.findRecordsByFilter('factories', '', '', batchSize, offset)
      if (!batch || batch.length === 0) break
      for (let i = 0; i < batch.length; i++) {
        factories.push(batch[i])
      }
      if (batch.length < batchSize) break
      offset += batchSize
    }

    console.log(
      '[Migration 0082] Carregadas ' +
        factories.length +
        ' factories para normalização de profile_type.',
    )

    let totalUpdated = 0
    let totalUnchanged = 0

    for (let i = 0; i < factories.length; i++) {
      const record = factories[i]
      const recId = record.getString ? record.getString('id') : record.id

      // Obter profile_type atual
      let currentVal = []
      if (record.get) {
        const raw = record.get('profile_type')
        if (Array.isArray(raw)) {
          currentVal = raw
        } else if (typeof raw === 'string' && raw.trim()) {
          try {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed)) currentVal = parsed
            else currentVal = [raw.trim()]
          } catch (_) {
            currentVal = [raw.trim()]
          }
        }
      }

      const normalized = normalizeProfileArray(currentVal)

      // Verificar se houve alteração
      let changed = false
      if (currentVal.length !== normalized.length) {
        changed = true
      } else {
        for (let j = 0; j < currentVal.length; j++) {
          if (currentVal[j] !== normalized[j]) {
            changed = true
            break
          }
        }
      }

      if (changed) {
        const jsonStr = JSON.stringify(normalized)
        app
          .db()
          .newQuery('UPDATE factories SET profile_type = {:json} WHERE id = {:id}')
          .bind({ json: jsonStr, id: recId })
          .execute()

        totalUpdated++
      } else {
        totalUnchanged++
      }
    }

    console.log(
      '[Migration 0082] Normalização de profile_type concluída. Atualizados: ' +
        totalUpdated +
        ', Inalterados: ' +
        totalUnchanged,
    )
  },
  (app) => {
    // Reversão de dados não necessária / idempotent
  },
)
