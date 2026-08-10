migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('dashboard_preferences')
    if (!col.fields.getByName('period_view')) {
      col.fields.add(new TextField({ name: 'period_view' }))
    }
    app.save(col)

    var notifCol = app.findCollectionByNameOrId('notifications')
    notifCol.addIndex('idx_notifications_milestone_type', false, 'milestone, type', '')
    app.save(notifCol)
  },
  (app) => {
    try {
      var dpCol = app.findCollectionByNameOrId('dashboard_preferences')
      if (dpCol.fields.getByName('period_view')) {
        dpCol.fields.removeByName('period_view')
      }
      app.save(dpCol)
    } catch (_) {}

    try {
      var notifCol = app.findCollectionByNameOrId('notifications')
      notifCol.removeIndex('idx_notifications_milestone_type')
      app.save(notifCol)
    } catch (_) {}
  },
)
