migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('import_history')
    if (!col) return

    if (!col.fields.getByName('total_value')) {
      col.fields.add(
        new NumberField({
          name: 'total_value',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('skipped_rows')) {
      col.fields.add(
        new NumberField({
          name: 'skipped_rows',
          onlyInt: true,
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('duplicate_rows')) {
      col.fields.add(
        new NumberField({
          name: 'duplicate_rows',
          onlyInt: true,
          required: false,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('import_history')
      if (!col) return

      const f1 = col.fields.getByName('total_value')
      if (f1) col.fields.removeByName('total_value')

      const f2 = col.fields.getByName('skipped_rows')
      if (f2) col.fields.removeByName('skipped_rows')

      const f3 = col.fields.getByName('duplicate_rows')
      if (f3) col.fields.removeByName('duplicate_rows')

      app.save(col)
    } catch (_) {}
  },
)
