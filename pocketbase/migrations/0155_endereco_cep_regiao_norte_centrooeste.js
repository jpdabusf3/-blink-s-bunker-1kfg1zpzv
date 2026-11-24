/// <reference path="../pb_data/types.d.ts" />

/**
 * Migracao 0155 - endereco e CEP das contas de MS, PA, TO, MA, RO, AC, AM e GO.
 *
 * Complementa as migracoes 0153/0154, que deixaram 76 contas desses oito estados sem CEP.
 * Fonte: Receita Federal via BrasilAPI, consultada em 24/11/2026. Entraram apenas as
 * 24 contas em que o CNPJ encontrado confere com a conta E o municipio da Receita bate
 * com o municipio cadastrado.
 *
 * Formato: id|cep|logradouro|numero|bairro|municipio|uf
 */

migrate(
  (app) => {
    var RAW =
      'f5aut554qvkbory|75960-000|MARIA MACHADO DE ALMEIDA|148|AREAS DO CENTRO|ACREUNA|GO;9f29y3dfljper0p|75103-210|23|SN|CHACARAS AMERICANAS|ANAPOLIS|GO;kzqnd807xem0iy3|76988-010|MARECHAL RONDON|5710|CENTRO (5º BEC)|VILHENA|RO;9m6grayf91l080q|76900-992|LINHA 94, LOTE 46-A|SN|ZONA RURAL|JI-PARANA|RO;860y7ffx0w6sx46|76914-899|BR 364|10500|SAIDA P/ PORTO VELHO|JI-PARANA|RO;t8srqrs1dnqovi8|76835-500|DEPUTADO SERGIO CARVALHO|S/N|DISTRITO INDUSTRIAL|PORTO VELHO|RO;6fyaxrq218vzagy|77600-000|NORTE SUL|S/N|PARQUE AGROINDUSTRIAL JOSE ANTONIO DE DEUS|PARAISO DO TOCANTINS|TO;su8b6w5oemgdyhu|77600-000|BR 153, KM 484|S/N|INDUSTRIAL|PARAISO DO TOCANTINS|TO;7ylehgu4k3yxw8g|77615-000|BAHIA|S/N|CENTRO|SANTA TEREZA DO TOCANTINS|TO;aw2abxp935zy2kn|69909-004|RAIZ DE DAVI|526|ROSA LINDA|RIO BRANCO|AC;0l3kk0b9w5etqti|68189-000|DAS ESMERALDAS|1920|MORAES ALMEIDA|ITAITUBA|PA;3w8jfu6it3dkv3j|68552-640|RIO DOURADO|S/N|CAPUAVA|REDENCAO|PA;xwpn3q4129giqui|68515-000|VICINAL 1|S/N|ZONA RURAL|PARAUAPEBAS|PA;phplxoe14j0412k|65706-000|BR MA 008|S/N|OUTROS|OLHO D AGUA DAS CUNHAS|MA;d14ssbnhtk51y3x|65930-000|A M/D DA BR-010 SENTIDO BRASILIA/BELEN-COLONIA|SN|ZONA RURAL|ACAILANDIA|MA;ots0ri4ltmiluwr|65800-000|PROJETADA ENGRAVADA AOS FUNDOS|01|PARQUE GOV. LUIS ROCHA|BALSAS|MA;z0et27h3zdygnwk|65919-555|PEDRO NEIVA DE SANTANA|1500|JOAO PAULO II|IMPERATRIZ|MA;h26jsbs3hxqc8b0|69909-006|MONTE SIAO|S/N|RESIDENCIAL ROSA LINDA|RIO BRANCO|AC;13rcbdfhqgyz7bm|69990-000|BR JAPIM|4153|PE DA TERRA|MANCIO LIMA|AC;9w883wqngsxrai2|69934-000|BR 317 KM 06|S/N|ZONA RURAL|EPITACIOLANDIA|AC;1u29sdvd4grftsa|77006-534|412 NORTE ALAMEDA 8|S/N|PLANO DIRETOR NORTE|PALMAS|TO;fvnytgrb2s62syi|68551-675|ROD PA 287 KM 96|S/N|JARDIM VIVIENE|REDENCAO|PA;6tzp75o8bz3jqrd|69932-000|BR 317, KM 06|S/N|ZONA RURAL|BRASILEIA|AC;8ngxuegftiu077j|77900-000|NOSSA SENHORA DE FATIMA|2800|SETOR INDUSTRIAL|TOCANTINOPOLIS|TO'
    var LINHAS = RAW.split(';')

    var logCol = null
    try {
      logCol = app.findCollectionByNameOrId('entity_change_logs')
    } catch (e) {
      console.log('[0155] entity_change_logs indisponivel: ' + e)
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
          log.set('user_name', 'Sistema (Migracao 0155)')
          log.set('field', 'cep')
          log.set('old_value', '')
          log.set('new_value', cep)
          log.set('action', 'update')
          log.set(
            'change_summary',
            'Endereco e CEP preenchidos pela Receita Federal (BrasilAPI) em 24/11/2026 - lote MS/PA/TO/MA/RO/AC/AM/GO.',
          )
          txApp.save(log)
        }
      })

      atualizados++
    }

    console.log('[0155] atualizados=' + atualizados + ' nao_encontrados=' + naoEncontrados)
  },
  (app) => {
    // Rollback no-op: os valores anteriores estao em entity_change_logs (0155).
  },
)
