onRecordCreateRequest((e) => {
  if (!e.record.getString('token')) {
    e.record.set('token', $security.randomString(32))
  }
  if (!e.record.getString('status')) {
    e.record.set('status', 'pending')
  }
  if (!e.record.getString('expiresAt')) {
    var now = new Date()
    now.setDate(now.getDate() + 7)
    e.record.set('expiresAt', now.toISOString())
  }
  e.next()
}, 'invitations')
