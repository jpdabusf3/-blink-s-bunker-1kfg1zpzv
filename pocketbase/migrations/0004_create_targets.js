migrate(
  (app) => {
    const collection = new Collection({
      name: 'targets',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'targetValue', type: 'number', required: true },
        {
          name: 'categoryType',
          type: 'select',
          required: true,
          values: ['General', 'Region', 'Channel', 'ProductLine'],
          maxSelect: 1,
        },
        { name: 'categoryValue', type: 'text' },
        { name: 'startDate', type: 'date', required: true },
        { name: 'endDate', type: 'date', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('targets')
    app.delete(collection)
  },
)
