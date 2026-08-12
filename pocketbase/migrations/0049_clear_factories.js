migrate(
  (app) => {
    // Truncate/delete all records in factories
    const col = app.findCollectionByNameOrId('factories')
    app.truncateCollection(col)
  },
  (app) => {
    // down: no-op since deleted initial test records cannot be restored automatically
  },
)
