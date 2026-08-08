routerAdd(
  'POST',
  '/backend/v1/gravar-atividade',
  (e) => {
    try {
      var userId = e.auth && e.auth.id
      if (!userId) return e.unauthorizedError('auth required')

      var body = e.requestInfo().body || {}

      if (body.precisa_confirmacao === true) {
        return e.json(200, {
          success: false,
          precisa_confirmacao: true,
          message: 'Confirmation required before saving',
        })
      }

      if (!body.origem) body.origem = 'audio'

      var pbUrl = $secrets.get('PB_INSTANCE_URL') || ''
      var superuserToken = $secrets.get('PB_SUPERUSER_TOKEN') || ''

      if (!pbUrl || !superuserToken) {
        $app.logger().error('gravar-atividade: missing PB config')
        return e.json(500, { success: false, error: 'missing PB config' })
      }

      var res = $http.send({
        url: pbUrl + '/backend/v1/validar-e-gravar',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: superuserToken },
        body: JSON.stringify(body),
        timeout: 30,
      })

      if (res.statusCode >= 200 && res.statusCode < 300) {
        return e.json(res.statusCode, res.json || {})
      }

      return e.json(res.statusCode, res.json || { error: 'validation failed' })
    } catch (err) {
      $app.logger().error('gravar-atividade: proxy error', 'error', String(err))
      return e.json(500, { success: false, error: 'unexpected error' })
    }
  },
  $apis.requireAuth(),
)
