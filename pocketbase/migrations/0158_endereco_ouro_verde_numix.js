/// <reference path="../pb_data/types.d.ts" />

/**
 * Migracao 0158 - endereco e CEP de Ouro Verde (Cacoal-RO) e Numix (Rolim de Moura-RO).
 *
 * Fonte: Receita Federal via BrasilAPI, 24/11/2026. CNPJ confirmado por site da empresa
 * / consulta publica, e o municipio da Receita confere com o da conta.
 *
 * Formato: id|cep|logradouro|numero|bairro|municipio|uf
 */

migrate(
  (app) => {
    var RAW =
      '6tbtnntlvpezauw|76967-790|JOSE CARLOS MINGORANCE|1933|INDUSTRIAL|CACOAL|RO;slmxp7ej9m1z3bo|76940-000|RODOVIA 010, LINHA 25 OESTE, KM 06, LOTE 04-C, GLEBA 17, SETOR 02|S/N|ZONA RURAL|ROLIM DE MOURA|RO'
    var LINHAS = RAW.split(';')

    var logCol = null
    try {
      logCol = app.findCollectionByNameOrId('entity_change_logs')
    } catch (e) {
      console.log('[0158] entity_change_logs indisponivel: ' + e)
    }

    function titleCase(s) {
      if (!s) return ''
      var parts = String(s).toLowerCase().split(' ')
      var out = []
      var small = ['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o']
      for (var i = 0; i < parts.length; i++) {
        var w = parts[i]
        if (!w) continue
        if (i > 0 && small.indexOf(w) !== -1) out.push(w)
        else out.push(w.charAt(0).toUpperCase() + w.slice(1))
      }
      return out.join(' ')
    }

    var atualizados = 0

    for (var i = 0; i < LINHAS.length; i++) {
      var f = LINHAS[i].split('|')
      if (f.length < 7) continue
      var id = f[0]
      var cep = f[1]
      var logradouro = titleCase(f[2])
      var numero = f[3] || 'S/N'
      var bairro = titleCase(f[4])
      var municipio = titleCase(f[5])
      var uf = f[6]

      var rec = null
      try {
        rec = app.findRecordById('factories', id)
      } catch (e) {
        continue
      }
      if (!rec) continue

      var nome = rec.getString('name') || id
      var endereco = logradouro
      if (numero) endereco = endereco + ' ' + numero
      if (bairro) endereco = endereco + ' - ' + bairro

      var padrao =
        nome +
        ', ' +
        numero +
        ' - ' +
        (bairro || 'Centro') +
        ', ' +
        municipio +
        ' - ' +
        uf +
        ', CEP: ' +
        cep

      app.runInTransaction((txApp) => {
        rec.set('cep', cep)
        if (logradouro) rec.set('logradouro', logradouro)
        if (numero) rec.set('numero', numero)
        if (bairro) rec.set('bairro', bairro)
        if (municipio) rec.set('city', municipio)
        if (uf) rec.set('state', uf)
        rec.set('address', endereco)
        rec.set('standardized_address', padrao)
        rec.set('address_status', 'complete')
        rec.set('precisao', 'rua')
        rec.set('ultima_edicao_origem', 'excel')
        txApp.save(rec)

        if (logCol) {
          var log = new Record(logCol)
          log.set('entity_type', 'factories')
          log.set('entity_id', id)
          log.set('entity_name', nome)
          log.set('user_name', 'Sistema (Migracao 0158)')
          log.set('field', 'cep')
          log.set('old_value', '')
          log.set('new_value', cep)
          log.set('action', 'update')
          log.set('change_summary', 'Endereco e CEP confirmados na Receita Federal em 24/11/2026.')
          txApp.save(log)
        }
      })

      atualizados++
    }

    console.log('[0158] atualizados=' + atualizados)
  },
  (app) => {
    // Rollback no-op.
  },
)
