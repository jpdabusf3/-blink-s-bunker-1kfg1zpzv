migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('gestao_tecnica')

    var members = [
      { nome: 'Rodrigo Garginal', funcao: 'gestor_tecnico', regiao: 'MT', ativo: true },
      { nome: 'Jessica Dilkin', funcao: 'gestor_tecnico', regiao: 'MT', ativo: true },
      { nome: 'Tais Fauro', funcao: 'gestor_tecnico', regiao: 'MT', ativo: true },
      { nome: 'Wagner Zacatei', funcao: 'gestor_tecnico', regiao: 'MT', ativo: true },
      { nome: 'Felipe Leão', funcao: 'vendedor', regiao: 'MT', ativo: true },
      { nome: 'Rafael Bellusci', funcao: 'vendedor', regiao: 'MT', ativo: true },
      { nome: 'Welington Alvares', funcao: 'vendedor', regiao: 'MT', ativo: true },
      { nome: 'João Pedro', funcao: 'vendedor', regiao: 'MT', ativo: true },
    ]

    for (var i = 0; i < members.length; i++) {
      var m = members[i]
      try {
        app.findFirstRecordByData('gestao_tecnica', 'nome', m.nome)
      } catch (_) {
        var rec = new Record(col)
        rec.set('nome', m.nome)
        rec.set('funcao', m.funcao)
        rec.set('regiao', m.regiao)
        rec.set('ativo', m.ativo)
        app.save(rec)
      }
    }
  },
  (app) => {
    try {
      var records = app.findRecordsByFilter('gestao_tecnica', '', '-created', 100, 0)
      for (var i = 0; i < records.length; i++) {
        app.delete(records[i])
      }
    } catch (_) {}
  },
)
