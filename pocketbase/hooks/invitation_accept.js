onRecordAfterCreateSuccess((e) => {
  var email = e.record.getString('email')
  if (!email) return e.next()

  try {
    var invitations = $app.findRecordsByFilter(
      'invitations',
      "email = '" + email + "' && status = 'pending'",
      '-created',
      1,
      0,
    )
    if (invitations.length === 0) return e.next()

    var invitation = invitations[0]
    var user = $app.findRecordById('users', e.record.id)

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
  } catch (err) {
    console.log('invitation accept failed: ' + err.message)
  }

  return e.next()
}, 'users')
