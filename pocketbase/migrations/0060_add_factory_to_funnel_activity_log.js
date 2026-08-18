// Adds "factory" to the allowed values of funnel_activity_log.entity_type
// (select field), so factory update actions can be logged with entity_type="factory".
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('funnel_activity_log')
    const entityField = col.fields.getByName('entity_type')
    if (entityField) {
      var vals = (entityField.values && entityField.values.slice()) || []
      if (vals.indexOf('factory') === -1) {
        vals.push('factory')
      }
      entityField.values = vals
    }
    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('funnel_activity_log')
      const entityField = col.fields.getByName('entity_type')
      if (entityField && entityField.values) {
        entityField.values = entityField.values.filter(function (v) {
          return v !== 'factory'
        })
      }
      app.save(col)
    } catch (_) {}
  },
)
