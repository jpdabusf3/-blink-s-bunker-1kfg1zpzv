migrate(
  (app) => {
    // Normalização com matching tolerante igual ao canonicalEspecie do backend
    // (NFD, remove acentos, trim, lowercase):
    // aves/ave -> Aves
    // suinos/suino/suínos -> Suinos
    // ruminantes/ruminante -> Ruminantes
    // pet/pets -> Pet
    // multiespecies/multiespecie/muitiespecies/muitiespécies/multi especie/multi espécie -> Multiespécies
    // Valores não reconhecidos (ex.: Aqua, Equinos, Outros) ficam como estão — NÃO apagar, NÃO descartar.

    function canonicalEspecie(raw) {
      if (!raw) return null
      const norm = String(raw)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
      if (norm === 'aves' || norm === 'ave') return 'Aves'
      if (norm === 'suinos' || norm === 'suino') return 'Suinos'
      if (norm === 'ruminantes' || norm === 'ruminante') return 'Ruminantes'
      if (norm === 'pet' || norm === 'pets') return 'Pet'
      if (
        norm === 'multiespecies' ||
        norm === 'multiespecie' ||
        norm === 'muitiespecies' ||
        norm === 'muitiespecie' ||
        norm === 'multi especie' ||
        norm === 'multi especies'
      ) {
        return 'Multiespécies'
      }
      return null
    }

    function normalizeSingleValue(val) {
      if (val === null || val === undefined) return val
      const str = String(val).trim()
      if (!str) return str
      const canon = canonicalEspecie(str)
      return canon || str
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

    const totalRecords = factories.length
    let totalUpdated = 0

    for (let i = 0; i < factories.length; i++) {
      const record = factories[i]
      const recId = record.getString ? record.getString('id') : record.id

      let isArray = false
      let currentVal = []
      let originalRaw = null

      if (record.get) {
        originalRaw = record.get('animalSpecies')
        if (Array.isArray(originalRaw)) {
          isArray = true
          currentVal = originalRaw
        } else if (typeof originalRaw === 'string' && originalRaw.trim()) {
          try {
            const parsed = JSON.parse(originalRaw)
            if (Array.isArray(parsed)) {
              isArray = true
              currentVal = parsed
            } else {
              currentVal = [originalRaw.trim()]
            }
          } catch (_) {
            currentVal = [originalRaw.trim()]
          }
        }
      }

      let changed = false
      let finalVal

      if (isArray) {
        const nextArr = []
        for (let j = 0; j < currentVal.length; j++) {
          const item = currentVal[j]
          const norm = normalizeSingleValue(item)
          if (norm !== item) {
            changed = true
          }
          if (norm && nextArr.indexOf(norm) === -1) {
            nextArr.push(norm)
          }
        }
        if (nextArr.length !== currentVal.length) {
          changed = true
        }
        finalVal = nextArr
      } else {
        const single = currentVal[0] !== undefined ? currentVal[0] : ''
        const norm = normalizeSingleValue(single)
        if (norm !== single) {
          changed = true
        }
        finalVal = norm
      }

      if (changed) {
        let sqlValue
        if (isArray) {
          sqlValue = JSON.stringify(finalVal)
        } else {
          sqlValue = finalVal || ''
        }

        app
          .db()
          .newQuery('UPDATE factories SET animalSpecies = {:val} WHERE id = {:id}')
          .bind({ val: sqlValue, id: recId })
          .execute()

        totalUpdated++
      }
    }

    console.log(
      '[migration 0090] espécies normalizadas em ' +
        totalUpdated +
        ' de ' +
        totalRecords +
        ' clientes',
    )
  },
  (app) => {
    // Idempotente / forward-only: dados normalizados não precisam ser revertidos
  },
)
