routerAdd(
  'POST',
  '/backend/v1/check-invitation',
  (e) => {
    var auth = e.auth
    if (!auth) return e.unauthorizedError('auth required')

    var email = auth.getString('email')
    if (!email) return e.json(200, { applied: false })

    try {
      var invitations = $app.findRecordsByFilter(
        'invitations',
        "email = '" + email + "' && status = 'pending'",
        '-created',
        1,
        0,
      )
      if (invitations.length === 0) return e.json(200, { applied: false })

      var invitation = invitations[0]
      var user = $app.findRecordById('users', auth.id)

      if (invitation.getString('role')) {
        user.set('job_title', invitation.getString('role'))
      }
      if (invitation.getString('geographicArea')) {
        user.set('geographicArea', invitation.getString('geographicArea'))
      }
      if (invitation.getString('country')) {
        user.set('country', invitation.getString('country'))
      }
      $app.save(user)

      invitation.set('status', 'accepted')
      $app.save(invitation)

      return e.json(200, { applied: true })
    } catch (err) {
      console.log('check invitation failed: ' + err.message)
      return e.json(200, { applied: false })
    }
  },
  $apis.requireAuth(),
)
