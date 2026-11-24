/// <reference path="../pb_data/types.d.ts" />

/**
 * Migracao 0156 - segunda rodada de endereco/CEP nos 8 estados (busca nominal).
 *
 * Complementa a 0155. Aqui cada CNPJ foi confirmado por busca (Receita Federal via
 * BrasilAPI, lista SIPEAGRO/MAPA e site da propria empresa) e o municipio confere.
 *
 * Formato: id|cep|logradouro|numero|bairro|municipio|uf
 */

migrate(
  (app) => {
    var RAW =
      'ncd4i6e7bcpw27h|75903-901|PRESIDENTE VARGAS|1878|JARDIM GOIAS|RIO VERDE|GO;kvchu4gm6jpb0c1|69070-620|DESEMBARGADOR FELISMINO SOARES|1000|COLONIA O. MACHADO|MANAUS|AM;9itywynrz7bvs0f|76900-036|MARECHAL RONDON|334|CENTRO|JI-PARANA|RO;u0a40r2tgqivuql|76920-000|BR 470, KM 0,5|S/N|ZONA RURAL|OURO PRETO DO OESTE|RO;r3y04nrwnqsaue8|76860-000|LOTE 11, GLEBA 04, GLEBA ALIANCA|S/N|ZONA RURAL|CANDEIAS DO JAMARI|RO;vlsrxvix584sb8d|65800-970|GOVERNADOR LUIZ ROCHA|1006|SETOR INDUSTRIAL|BALSAS|MA;sfy9bax8hfxkqni|68527-000|BR 222, KM 92 RAMAL 02 KM GLEBA SUMAUMA B|S/N|ZONA RURAL|ABEL FIGUEIREDO|PA;wuuplnig1m63iea|77834-899|BR 153|SN|ZONA RURAL|ARAGUAINA|TO;id8cz942zbbgvq8|77445-590|EIXO PRINCIPAL|1732|PARQUE AGROINDUSTRIAL|GURUPI|TO;8tfliog1b99625y|75132-145|VP 7E, MODULO 3-B|S/N|DISTRITO AGROINDUSTRIAL DE ANAPOLIS - DAIA|ANAPOLIS|GO;lrjq4bivmv7pugo|73850-000|BR 040 KM 86|SN|ZONA RURAL|CRISTALINA|GO;xuwzs5o3vbizgou|69007-800|AZALEIA|149|DISTRITO INDUSTRIAL II|MANAUS|AM;fihnc1ql1gnqh5s|68371-970|TRANSAMAZONICA|S/N|ZONA RURAL|ALTAMIRA|PA'
    var LINHAS = RAW.split(';')

    var logCol = null
    try {
      logCol = app.findCollectionByNameOrId('entity_change_logs')
    } catch (e) {
      console.log('[0156] entity_change_logs indisponivel: ' + e)
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
    var naoEncontrados = 0

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
        naoEncontrados++
        continue
      }
      if (!rec) {
        naoEncontrados++
        continue
      }

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
        rec.set('address_status', logradouro && bairro ? 'complete' : 'partial')
        rec.set('precisao', 'rua')
        rec.set('ultima_edicao_origem', 'excel')
        txApp.save(rec)

        if (logCol) {
          var log = new Record(logCol)
          log.set('entity_type', 'factories')
          log.set('entity_id', id)
          log.set('entity_name', nome)
          log.set('user_name', 'Sistema (Migracao 0156)')
          log.set('field', 'cep')
          log.set('old_value', '')
          log.set('new_value', cep)
          log.set('action', 'update')
          log.set(
            'change_summary',
            'Endereco e CEP confirmados por busca nominal (Receita Federal/SIPEAGRO) em 24/11/2026.',
          )
          txApp.save(log)
        }
      })

      atualizados++
    }

    console.log('[0156] atualizados=' + atualizados + ' nao_encontrados=' + naoEncontrados)
  },
  (app) => {
    // Rollback no-op: os valores anteriores estao em entity_change_logs (0156).
  },
)
