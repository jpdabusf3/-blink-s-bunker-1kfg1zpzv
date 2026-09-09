// Migration 0091: Adicionar "Multiespécies" ao select animalSpecies da collection factories
// Mantém todos os valores existentes para compatibilidade com registros legados.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('factories')
    const speciesField = col.fields.getByName('animalSpecies')

    if (speciesField) {
      const currentValues = (speciesField.values && speciesField.values.slice()) || []
      // Se "Multiespécies" ainda não estiver presente, adicionar preservando a ordem e os existentes
      if (currentValues.indexOf('Multiespécies') === -1) {
        currentValues.push('Multiespécies')
      }
      speciesField.values = currentValues
      if (
        typeof speciesField.maxSelect === 'number' &&
        speciesField.maxSelect < currentValues.length
      ) {
        speciesField.maxSelect = currentValues.length
      }
      app.save(col)
      console.log(
        '[migration 0091] animalSpecies atualizado com sucesso. Valores:',
        currentValues.join(', '),
      )
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('factories')
      const speciesField = col.fields.getByName('animalSpecies')
      if (speciesField && speciesField.values) {
        speciesField.values = speciesField.values.filter((v) => v !== 'Multiespécies')
        app.save(col)
      }
    } catch (_) {}
  },
)
