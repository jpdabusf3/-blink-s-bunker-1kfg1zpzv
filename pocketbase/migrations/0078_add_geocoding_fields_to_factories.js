migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('factories')

    // 1. lat (number, nullable)
    if (!col.fields.getByName('lat')) {
      col.fields.add(
        new NumberField({
          name: 'lat',
          required: false,
        }),
      )
    }

    // 2. lng (number, nullable)
    if (!col.fields.getByName('lng')) {
      col.fields.add(
        new NumberField({
          name: 'lng',
          required: false,
        }),
      )
    }

    // 3. geocode_precision (text/select, nullable) — "exact", "street", "city", "failed"
    if (!col.fields.getByName('geocode_precision')) {
      col.fields.add(
        new SelectField({
          name: 'geocode_precision',
          values: ['exact', 'street', 'city', 'failed'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    // 4. address_status (text/select, nullable) — "complete", "partial", "inconsistent", "enriched", "failed"
    if (!col.fields.getByName('address_status')) {
      col.fields.add(
        new SelectField({
          name: 'address_status',
          values: ['complete', 'partial', 'inconsistent', 'enriched', 'failed'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    // 5. enriched_at (date/timestamp, nullable)
    if (!col.fields.getByName('enriched_at')) {
      col.fields.add(
        new DateField({
          name: 'enriched_at',
          required: false,
        }),
      )
    }

    // 6. standardized_address (text, nullable)
    if (!col.fields.getByName('standardized_address')) {
      col.fields.add(
        new TextField({
          name: 'standardized_address',
          required: false,
        }),
      )
    }

    // Índices nas colunas geocode_precision e address_status
    col.addIndex('idx_factories_geocode_precision', false, 'geocode_precision', '')
    col.addIndex('idx_factories_address_status', false, 'address_status', '')

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('factories')

    try {
      col.removeIndex('idx_factories_geocode_precision')
    } catch (_) {}

    try {
      col.removeIndex('idx_factories_address_status')
    } catch (_) {}

    try {
      col.fields.removeByName('lat')
    } catch (_) {}

    try {
      col.fields.removeByName('lng')
    } catch (_) {}

    try {
      col.fields.removeByName('geocode_precision')
    } catch (_) {}

    try {
      col.fields.removeByName('address_status')
    } catch (_) {}

    try {
      col.fields.removeByName('enriched_at')
    } catch (_) {}

    try {
      col.fields.removeByName('standardized_address')
    } catch (_) {}

    app.save(col)
  },
)
