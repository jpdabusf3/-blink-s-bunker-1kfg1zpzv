migrate(
  (app) => {
    const targets = app.findCollectionByNameOrId('targets')

    try {
      app.findFirstRecordByData('targets', 'name', 'Meta Geral Mês Atual')
    } catch (_) {
      const now = new Date()
      const firstDay =
        new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0] +
        ' 00:00:00.000Z'
      const lastDay =
        new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0] +
        ' 23:59:59.000Z'

      const r1 = new Record(targets)
      r1.set('name', 'Meta Geral Mês Atual')
      r1.set('targetValue', 500000)
      r1.set('categoryType', 'General')
      r1.set('categoryValue', '')
      r1.set('startDate', firstDay)
      r1.set('endDate', lastDay)
      app.save(r1)

      const r2 = new Record(targets)
      r2.set('name', 'Meta Região Norte')
      r2.set('targetValue', 150000)
      r2.set('categoryType', 'Region')
      r2.set('categoryValue', 'Norte')
      r2.set('startDate', firstDay)
      r2.set('endDate', lastDay)
      app.save(r2)

      const r3 = new Record(targets)
      r3.set('name', 'Meta Canal Representantes')
      r3.set('targetValue', 200000)
      r3.set('categoryType', 'Channel')
      r3.set('categoryValue', 'Representantes')
      r3.set('startDate', firstDay)
      r3.set('endDate', lastDay)
      app.save(r3)
    }
  },
  (app) => {
    try {
      const r1 = app.findFirstRecordByData('targets', 'name', 'Meta Geral Mês Atual')
      app.delete(r1)
    } catch (_) {}
    try {
      const r2 = app.findFirstRecordByData('targets', 'name', 'Meta Região Norte')
      app.delete(r2)
    } catch (_) {}
    try {
      const r3 = app.findFirstRecordByData('targets', 'name', 'Meta Canal Representantes')
      app.delete(r3)
    } catch (_) {}
  },
)
