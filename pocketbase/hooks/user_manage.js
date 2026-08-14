routerAdd(
  'POST',
  '/backend/v1/users/{id}/manage',
  (e) => {
    const id = e.request.pathValue('id')
    const body = e.requestInfo().body || {}
    const action = body.action

    var authEmail = ''
    try {
      authEmail = e.auth.email() || ''
    } catch (_) {}
    authEmail = authEmail.toLowerCase().trim()
    if (authEmail !== 'joaopedro_zoo@hotmail.com') {
      return e.forbiddenError('Apenas o gestor pode gerenciar usuários')
    }

    if (id === e.auth.id) {
      return e.badRequestError('Você não pode modificar sua própria conta por esta via')
    }

    var user
    try {
      user = $app.findRecordById('users', id)
    } catch (_) {
      return e.notFoundError('Usuário não encontrado')
    }

    var managerId = e.auth.id
    var logsCol = $app.findCollectionByNameOrId('activity_logs')

    var fieldLabels = {
      name: 'Nome',
      job_title: 'Cargo',
      geographicArea: 'Região',
      country: 'País',
      whatsapp: 'WhatsApp',
      whatsapp_validated: 'Validado por WhatsApp',
    }

    if (action === 'edit') {
      var changes = []

      // Text fields handled with string comparison.
      var textFields = ['name', 'job_title', 'geographicArea', 'country', 'whatsapp']
      for (var i = 0; i < textFields.length; i++) {
        var field = textFields[i]
        if (body[field] !== undefined) {
          var oldVal = user.getString(field)
          var newVal = String(body[field])
          if (oldVal !== newVal) {
            var label = fieldLabels[field] || field
            changes.push(label + ': "' + oldVal + '" → "' + newVal + '"')
            user.set(field, newVal)
          }
        }
      }

      // Bool field: WhatsApp validation toggle.
      if (body.whatsapp_validated !== undefined) {
        var oldBool = user.getBool('whatsapp_validated')
        var newBool = !!body.whatsapp_validated
        if (oldBool !== newBool) {
          changes.push(
            fieldLabels.whatsapp_validated +
              ': ' +
              (oldBool ? 'Sim' : 'Não') +
              ' → ' +
              (newBool ? 'Sim' : 'Não'),
          )
          user.set('whatsapp_validated', newBool)
        }
      }
      if (changes.length > 0) {
        $app.save(user)
        var logEdit = new Record(logsCol)
        logEdit.set('user', managerId)
        logEdit.set('action', 'Usuário editado')
        logEdit.set('details', changes.join('; '))
        logEdit.set('recordId', id)
        logEdit.set('target_collection', 'users')
        $app.save(logEdit)
      }
      return e.json(200, { success: true })
    }

    var userEmail = ''
    try {
      userEmail = user.email() || ''
    } catch (_) {}
    var userName = user.getString('name') || 'N/A'
    var detailsText = 'Usuário: ' + userName + ' (' + userEmail + ')'

    if (action === 'deactivate') {
      user.set('deactivated', true)
      $app.save(user)
      var logDeact = new Record(logsCol)
      logDeact.set('user', managerId)
      logDeact.set('action', 'Usuário excluído')
      logDeact.set('details', detailsText)
      logDeact.set('recordId', id)
      logDeact.set('target_collection', 'users')
      $app.save(logDeact)
      return e.json(200, { success: true })
    }

    if (action === 'reactivate') {
      user.set('deactivated', false)
      $app.save(user)
      var logReac = new Record(logsCol)
      logReac.set('user', managerId)
      logReac.set('action', 'Usuário recuperado')
      logReac.set('details', detailsText)
      logReac.set('recordId', id)
      logReac.set('target_collection', 'users')
      $app.save(logReac)
      return e.json(200, { success: true })
    }

    return e.badRequestError('Ação inválida. Use: edit, deactivate ou reactivate.')
  },
  $apis.requireAuth(),
)
