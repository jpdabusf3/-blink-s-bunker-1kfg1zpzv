/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0126: Adicionar campos de endereço estruturado e geocodificação à coleção 'factories'
 * Campos de endereço opcionais:
 * - cep (text, opcional)
 * - logradouro (text, opcional)
 * - numero (text, opcional)
 * - bairro (text, opcional)
 * - complemento (text, opcional)
 *
 * Campos de geocodificação explícitos com prioridade:
 * - latitude (number, opcional)
 * - longitude (number, opcional)
 * - precisao (select: 'exata', 'rua', 'bairro', 'cidade', 'sem-localizacao', opcional)
 */
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('factories')

    const newTextFields = ['cep', 'logradouro', 'numero', 'bairro', 'complemento']
    for (const fieldName of newTextFields) {
      if (!col.fields.getByName(fieldName)) {
        col.fields.add(
          new TextField({
            name: fieldName,
            required: false,
          }),
        )
      }
    }

    if (!col.fields.getByName('latitude')) {
      col.fields.add(
        new NumberField({
          name: 'latitude',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('longitude')) {
      col.fields.add(
        new NumberField({
          name: 'longitude',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('precisao')) {
      col.fields.add(
        new SelectField({
          name: 'precisao',
          values: ['exata', 'rua', 'bairro', 'cidade', 'sem-localizacao'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    app.save(col)

    // Backfill inicial para sincronizar latitude/longitude/precisao a partir dos campos existentes lat/lng/geocode_precision
    try {
      app
        .db()
        .newQuery(
          `UPDATE factories
           SET latitude = lat,
               longitude = lng,
               precisao = CASE
                 WHEN geocode_precision = 'exact' THEN 'exata'
                 WHEN geocode_precision = 'street' THEN 'rua'
                 WHEN geocode_precision = 'city' THEN 'cidade'
                 WHEN lat IS NOT NULL AND lat != 0 AND lng IS NOT NULL AND lng != 0 THEN 'exata'
                 ELSE NULL
               END
           WHERE latitude IS NULL AND lat IS NOT NULL AND lat != 0`,
        )
        .execute()
    } catch (_) {}
  },
  (app) => {
    const col = app.findCollectionByNameOrId('factories')

    const fieldsToRemove = [
      'cep',
      'logradouro',
      'numero',
      'bairro',
      'complemento',
      'latitude',
      'longitude',
      'precisao',
    ]

    for (const f of fieldsToRemove) {
      try {
        col.fields.removeByName(f)
      } catch (_) {}
    }

    app.save(col)
  },
)
