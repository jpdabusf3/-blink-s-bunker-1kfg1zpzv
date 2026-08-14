onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) {
    e.next()
    return
  }

  e.next()
}, 'users')
