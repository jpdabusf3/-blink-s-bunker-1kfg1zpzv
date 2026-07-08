migrate(
  (app) => {
    var activityLogs = app.findCollectionByNameOrId('activity_logs')

    if (!activityLogs.fields.getByName('recordId')) {
      activityLogs.fields.add(new TextField({ name: 'recordId' }))
    }
    if (!activityLogs.fields.getByName('collectionName')) {
      activityLogs.fields.add(new TextField({ name: 'collectionName' }))
    }

    app.save(activityLogs)
  },
  (app) => {
    var activityLogs = app.findCollectionByNameOrId('activity_logs')
    activityLogs.fields.removeByName('recordId')
    activityLogs.fields.removeByName('collectionName')
    app.save(activityLogs)
  },
)
