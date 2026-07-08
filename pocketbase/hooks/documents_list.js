routerAdd(
  'GET',
  '/backend/v1/documents',
  (e) => {
    var userId = e.auth && e.auth.id
    if (!userId) return e.unauthorizedError('auth required')

    var userEmail = (e.auth && e.auth.getString('email')) || ''
    var userTitle = (e.auth && e.auth.getString('job_title')) || ''
    var isSuperAdmin = userEmail === 'joaopedro_zoo@hotmail.com'

    function getLevel(title) {
      var t = (title || '').toLowerCase()
      if (t === 'ceo') return 0
      if (t === 'diretor') return 1
      if (t === 'gestor' || t === 'gerente' || t === 'manager') return 2
      if (t === 'vendedor') return 3
      return 4
    }

    var userLevel = isSuperAdmin ? -1 : getLevel(userTitle)

    var allDocs = $app.findRecordsByFilter('documents', '1=1', '-created', 1000, 0)
    var result = []
    for (var i = 0; i < allDocs.length; i++) {
      var doc = allDocs[i]
      var minLevelStr = doc.getString('min_access_level') || 'Comum'
      var minLevel = getLevel(minLevelStr)
      if (userLevel <= minLevel) {
        result.push({
          id: doc.id,
          collectionId: doc.collectionId,
          collectionName: 'documents',
          title: doc.getString('title'),
          file: doc.getString('file'),
          category: doc.getString('category'),
          min_access_level: doc.getString('min_access_level'),
          created: doc.getString('created'),
          updated: doc.getString('updated'),
        })
      }
    }

    return e.json(200, result)
  },
  $apis.requireAuth(),
)
