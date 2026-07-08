migrate(
  (app) => {
    var activityLogs = app.findCollectionByNameOrId('activity_logs')

    if (!activityLogs.fields.getByName('recordId')) {
      activityLogs.fields.add(new TextField({ name: 'recordId' }))
    }
    if (!activityLogs.fields.getByName('target_collection')) {
      activityLogs.fields.add(new TextField({ name: 'target_collection' }))
    }

    app.save(activityLogs)
  },
  (app) => {
    var activityLogs = app.findCollectionByNameOrId('activity_logs')
    activityLogs.fields.removeByName('recordId')
    activityLogs.fields.removeByName('target_collection')
    app.save(activityLogs)
  },
)
