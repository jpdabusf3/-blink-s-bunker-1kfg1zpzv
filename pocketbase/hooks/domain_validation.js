onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) {
    e.next()
    return
  }

  const body = e.requestInfo().body
  const email = (body.email || '').toLowerCase()

  if (email) {
    const adminEmail = 'joaopedro_zoo@hotmail.com'
    const domain = email.split('@')[1] || ''
    const allowedDomains = ['blinkbiotech.com']

    if (email !== adminEmail && !allowedDomains.includes(domain)) {
      return e.badRequestError('Apenas e-mails corporativos @blinkbiotech.com são permitidos.')
    }
  }

  e.next()
}, 'users')
