onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) {
    e.next()
    return
  }

  const body = e.requestInfo().body
  const email = (body.email || '').toLowerCase()

  if (email) {
    const domain = email.split('@')[1] || ''
    const allowedDomains = ['blinkbiotech.com.br', 'blink.com.br']

    if (!allowedDomains.includes(domain)) {
      return e.badRequestError('Access restricted to Blink Biotech employees.')
    }
  }

  e.next()
}, 'users')
