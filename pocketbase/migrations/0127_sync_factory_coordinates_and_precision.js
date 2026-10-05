/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0127: Sincronizar coordenadas salvas de factories
 * Garante que registros com lat/lng válidos tenham latitude/longitude e precisao preenchidos,
 * e registros sem localização válida tenham precisao = 'sem-localizacao'.
 */
migrate(
  (app) => {
    try {
      // 1. Atualizar registros que têm lat e lng válidos diferentes de 0
      app
        .db()
        .newQuery(
          `UPDATE factories
           SET latitude = lat,
               longitude = lng,
               precisao = CASE
                 WHEN precisao IS NOT NULL AND precisao != '' THEN precisao
                 WHEN geocode_precision = 'exact' THEN 'exata'
                 WHEN geocode_precision = 'street' THEN 'rua'
                 WHEN geocode_precision = 'city' THEN 'cidade'
                 ELSE 'exata'
               END
           WHERE lat IS NOT NULL AND lat != 0 AND lng IS NOT NULL AND lng != 0
             AND (latitude IS NULL OR latitude = 0)`,
        )
        .execute()

      // 2. Registros sem coordenadas válidas recebem precisao = 'sem-localizacao' se ainda nulo
      app
        .db()
        .newQuery(
          `UPDATE factories
           SET precisao = 'sem-localizacao'
           WHERE (lat IS NULL OR lat = 0)
             AND (latitude IS NULL OR latitude = 0)
             AND (precisao IS NULL OR precisao = '')`,
        )
        .execute()
    } catch (e) {
      console.log('Erro no backfill 0127:', e)
    }
  },
  () => {
    // Revert opcional
  },
)
