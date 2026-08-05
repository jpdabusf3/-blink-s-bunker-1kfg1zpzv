routerAdd(
  'POST',
  '/backend/v1/sellers/create',
  (e) => {
    var authEmail = ''
    try {
      authEmail = e.auth.email() || ''
    } catch (_) {}
    authEmail = authEmail.toLowerCase().trim()
    if (authEmail !== 'joaopedro_zoo@hotmail.com') {
      return e.forbiddenError('Apenas o gestor pode cadastrar vendedores')
    }

    var body = e.requestInfo().body || {}
    var errors = {}

    if (!body.name || !body.name.trim()) errors.name = 'Nome é obrigatório'
    if (!body.email || !body.email.trim()) errors.email = 'Email é obrigatório'
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      errors.email = 'Formato de email inválido'
    }

    if (Object.keys(errors).length > 0) {
      throw new BadRequestError('Dados inválidos', errors)
    }

    var emailExists = false
    try {
      $app.findAuthRecordByEmail('users', body.email)
      emailExists = true
    } catch (_) {}

    if (emailExists) {
      throw new BadRequestError('Dados inválidos', {
        email: 'Já existe um usuário com este email',
      })
    }

    var password = $security.randomString(16)

    var usersCol = $app.findCollectionByNameOrId('users')
    var record = new Record(usersCol)
    record.setEmail(body.email.trim())
    record.setPassword(password)
    record.setVerified(true)
    record.set('name', body.name.trim())
    record.set('job_title', 'Vendedor')
    record.set('geographicArea', body.geographicArea || '')
    record.set('country', body.country || 'Brasil')
    record.set('deactivated', true)
    $app.save(record)

    var logsCol = $app.findCollectionByNameOrId('activity_logs')
    var log = new Record(logsCol)
    log.set('user', e.auth.id)
    log.set('action', 'Vendedor cadastrado')
    log.set('details', 'Vendedor: ' + body.name.trim() + ' (' + body.email.trim() + ')')
    log.set('recordId', record.id)
    log.set('target_collection', 'users')
    $app.save(log)

    return e.json(201, { success: true, id: record.id, password: password })
  },
  $apis.requireAuth(),
)
