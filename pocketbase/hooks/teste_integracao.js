routerAdd('GET', '/backend/v1/teste-integracao', (e) => {
  var collections = {}
  var allOk = true

  var names = ['factories', 'atividades', 'metas', 'users']
  for (var i = 0; i < names.length; i++) {
    var exists = false
    try {
      $app.findCollectionByNameOrId(names[i])
      exists = true
    } catch (_) {
      exists = false
      allOk = false
    }
    collections[names[i]] = exists
  }

  return e.json(200, {
    status: 'ok',
    banco: 'conectado',
    collections: collections,
    allCollectionsExist: allOk,
  })
})
