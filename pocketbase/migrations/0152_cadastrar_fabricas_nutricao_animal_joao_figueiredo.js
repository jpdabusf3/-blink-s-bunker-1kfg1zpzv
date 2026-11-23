/// <reference path="../pb_data/types.d.ts" />

/**
 * Migracao 0152 - cadastra 36 fabricas/prospectos de nutricao animal levantados por
 * Joao Pedro (links de Maps/Instagram) e vincula todos a carteira do vendedor
 * Joao Figueiredo (gestao_tecnica 4urt19q2phjs7fn / users xhl48ye8ayb8fbu).
 *
 * Fonte: Receita Federal (Receita/CNPJ) consultada em 23/11/2026 + telefone/e-mail/site
 * divulgados pela propria empresa.
 *
 * Formato: nome|cnpj|municipio|uf|cep|logradouro|numero|bairro|telefone|email|perfil|especie|nota|razao
 *   perfil: N=Industria D=Distribuidores I=Integradora | especie: R=Ruminantes A=Aves
 *
 * Idempotente por CNPJ. tipo=Cliente, funnelStage=Lead, carteira=RUMINANTES,
 * status=Prospeccao, address_status=complete, precisao=rua.
 */

migrate(
  (app) => {
    var VENDEDOR_ID = '4urt19q2phjs7fn'
    var SALES_OWNER = 'xhl48ye8ayb8fbu'
    var LOTE = '0152 - links de fabricas (23/11/2026)'
    var RAW =
      'Mixfós Agronegócios|30535133000123|Araguatins|TO|77950-000|Rua Projetada 06|15|Crsital|(99) 9149-1310|sac.agroara@gmail.com|N|R|G|MIXFOS AGRONEGOCIOS LTDA;Agroara Agronegócios|10664810000104|Araguatins|TO|77950-000|Rua Projetada 06|15|Cristal|(99) 9149-1310|sac.agroara@gmail.com|N|R|G|AGROARA AGRONEGOCIOS LTDA;NutriVida Comercial|26865261000168|Anapolis|GO|75132-090|Rua Vp Re|0|Distrito Agroindustrial De Anapolis|(62) 8277-2943|contato@nutrivida.ind.br|N|R||NUTRIVIDA COMERCIAL LTDA;Nádia Rural (Imperatriz-MA)|01542004000164|Imperatriz|MA|65913-473|Avenida Getulio Vargas|1892|Entroncamento|(99) 3524-5105||D|R||NADIA RURAL LTDA;Nádia Rural (Redenção-PA)|01542004000750|Redencao|PA|68552-412|Avenida Araguaia|3402|Ademar Guimaraes|(99) 3524-2512||D|R||NADIA RURAL LTDA;Ziviani Nutrição Animal|51369105000153|Paragominas|PA|68628-557|Rodovia Pa 125|S/N|Alto Do Vale|(91) 8110-6166||N|R||ZIVIANI NUTRICAO ANIMAL LTDA;Terraforte Fós Nutrição Animal|05437370000376|Governador Edison Lobao|MA|65928-000|Rodovia Br 010|02|Zona Rural|(99) 3524-8720|gerencia.consultoria@hotmail.com|N|R||H R COMERCIO DE INSUMOS AGROPECUARIOS LTDA;Vitrato Nutrição Animal|24511912000196|Luis Eduardo Magalhaes|BA|47852-738|Rua A|1141|Ondumar Maraba|(77) 9985-6464|contabil@vitratonutricao.com|N|R||VITRATO NUTRICAO ANIMAL LTDA;Capifós Nutrição Animal|00896589000158|Inocencia|MS|79583-076|Rua Franklin Gomes Da Silva|290 A|Jardim Alvorada|(67) 9656-1717|capifos.adm@gmail.com|N|R||CAPIFOS NUTRICAO ANIMAL LTDA;Granforte Nutrição Animal|09176757000105|Araguaina|TO|77813-864|Avenida Rio Bandeira|475|Daiara|(63) 3414-3323|granfortenutricao@uol.com.br|N|R||GRANFORTE INDUSTRIA E COMERCIO DE PRODUTOS AGROPECUARIOS LTDA;Nutrop / L P M Leite|33694156000179|Palmas|TO|77249-899|Area Rural De Palmas|S/N|Zona Rural|||N|R||L P M LEITE;Frango Americano (Santa Izabel Alimentos)|03779994001903|Paraiso Do Tocantins|TO|77600-000|Rodovia Br 153|S/N|Santa Luzia|(91) 4009-4400||I|A|A|SANTA IZABEL ALIMENTOS LTDA;Cavema / Cavenage & Malavazi|02336174000155|Gurupi|TO|77445-590|Via Eixo Principal|1220|Parque Industrial|(63) 3312-3900|cavemanutricao@gmail.com|N|R||CAVENAGE & MALAVAZI LTDA;Nutribem Nutrição Animal|26638866000116|Gurupi|TO|77403-020|Avenida Mato Grosso|1285|Setor Central|(63) 3312-5060|joseribeiros@hotmail.com|N|R||NUTRIBEM NUTRICAO ANIMAL LTDA.;Complemento Nutrição Animal|05403065000100|Sao Miguel Do Araguaia|GO|76590-000|Rodovia Go 164 Km Zero|6230|Zona Suburbana|(62) 3364-4333||N|R||COMPLEMENTO NUTRICAO ANIMAL LTDA;Nutram Indústria de Nutrição Animal|50006482000165|Formoso|GO|76470-000|Fazenda Jpj Rodovia Go 241|SN|Zona Rural|(62) 9185-9565||N|R||NUTRAM INDUSTRIA DE NUTRICAO ANIMAL LTDA;Agropeso / Rogério Coelho Rodrigues|07907273000163|Mozarlandia|GO|76700-000|Rodovia Go 164|SN|Perimetro Urbano|(62) 3348-6097||D|R||ROGERIO COELHO RODRIGUES LTDA;Rio Verde Nutrição / D P de Lima Bastos|45725086000158|Carmo Do Rio Verde|GO|76340-000|Zona Industrial|S/N|Industrial|||N|R||D P DE LIMA BASTOS NUTRICAO ANIMAL;Alisul Alimentos - SUPRA Anápolis|89548523001403|Anapolis|GO|75132-135|Rua Vp 6E|S/N|Distrito Agroindustrial De Anapolis|(51) 3458-8919||N|R|U|ALISUL ALIMENTOS SA;Campo Nutrição / Campo Rações|05621758000160|Acreuna|GO|75960-000|Rua Maria Machado De Almeida|148|Areas Do Centro|(62) 3645-4300||N|R||CAMPO RACOES LTDA;Sociagro Nutrição Animal|08769542000135|Parauna|GO|75980-000|Rua Tegucigalpa|S/N|Setor Ponte De Pedra|(64) 3556-1969||N|R||SOCIAGRO NUTRICAO ANIMAL LTDA;Nutrisal / Agro-Taurus Brasil|26739698000155|Rio Verde|GO|75911-866|Via Secundaria 03|183|Distrito Agroindustrial De Rio Verde I|(64) 3620-7100||N|R||AGRO-TAURUS BRASIL INDUSTRIA COMERCIO DISTRIBUICAO AGROPECUARIA E TRANSPORTES LTDA;Nutratta Nutrição Animal|17316559000128|Itumbiara|GO|75515-530|Rua 19|1280|Santa Rita|(64) 3432-7200||N|R||NUTRATTA NUTRICAO ANIMAL S.A;Rural Forte Nutrição Animal|06026372000173|Pontalina|GO|75620-000|Via Primario|S/N|Distrito Agro Industrial|(64) 9295-1212||N|R||RURAL FORTE NUTRICAO ANIMAL LTDA;Agroforte Nutrição Animal|05333963000120|Ipameri|GO|75780-000|Avenida Michele Santinoni|32|Setor Central|||N|R||AGROFORTE NUTRICAO ANIMAL LTDA;Veneza Nutrição Animal|19948046000165|Nova Veneza|GO|75470-000|Rodovia Go 222|S/N|Zona Rural|(62) 3942-9882|venezanutricao@gmail.com|N|R|R|VENEZA NUTRICAO ANIMAL LTDA;Pontero / União Ind. de Suplementação|04402825000193|Jardim|MS|79240-000|Rua Saul Moraes De Deus|1350|Vila Morena|(67) 3251-2115||N|R||UNIAO INDUSTRIA DE SUPLEMENTACAO ANIMAL LTDA;Primato Cooperativa - Dourados|02168202003350|Dourados|MS|79833-970|Rodovia Ms 156 Km 7|SN|Zona Rural|(67) 9678-6327||N|R||PRIMATO COOPERATIVA AGROINDUSTRIAL;Douramix / Rações Douramix|02938653000141|Dourados|MS|79849-899|Avenida 05 Lote R Da Quadra 08|SN|Area Rural De Dourados|(45) 3229-1061||N|R||RACOES DOURAMIX LTDA.;Agroviero / Viero Nutrição Animal|18809450000195|Navirai|MS|79950-000|Rodovia Br 163 Km 129|S/N|Zona Rural|(67) 3461-7994||N|R||VIERO NUTRICAO ANIMAL LTDA;RNA / R N A Nutrição Animal|43649521000187|Ivinhema|MS|79740-000|Rua 3|40|Faixa Industrial Gleba Piraveve|(67) 8403-1624||N|R||R N A NUTRICAO ANIMAL LTDA;Supresul Nutrição Animal|02574941000164|Nova Alvorada Do Sul|MS|79140-000|Avenida Antonio Diniz Goncalves|2544|Vila Maria De Lourdes|(67) 3456-1125||N|R||SUPRESUL NUTRICAO ANIMAL LTDA;Herpan Nutrição Animal|07208089000125|Ribas Do Rio Pardo|MS|79187-899|Rodovia Br 262|SN|Zona Rural|(67) 3238-1970||N|R||HERPAN NUTRICAO ANIMAL LTDA;Servsal / Serv Sal Nutrição Animal|36775500000142|Campo Grande|MS|79086-382|Avenida Gunter Hans|1268|Guanandi|(67) 3386-2004|financeiro@servsal.com.br|N|R||SERV SAL NUTRICAO ANIMAL LTDA;MCassab - Campo Grande|49698723000952|Campo Grande|MS|79108-610|Avenida Solon Padilha|2075|Polo Empresarial Oeste|(11) 2162-7826||N|R||M CASSAB COMERCIO E INDUSTRIA LTDA;Tech Agro Indústria e Comércio|21003507000179|Terenos|MS|79190-000|Rua Noroeste|0|Vila Entroncamento|(67) 3391-1110||N|R||TECH AGRO INDUSTRIA E COMERCIO LTDA'

    var REGIAO = {
      AC: 'Norte',
      AM: 'Norte',
      AP: 'Norte',
      PA: 'Norte',
      RO: 'Norte',
      RR: 'Norte',
      TO: 'Norte',
      AL: 'Nordeste',
      BA: 'Nordeste',
      CE: 'Nordeste',
      MA: 'Nordeste',
      PB: 'Nordeste',
      PE: 'Nordeste',
      PI: 'Nordeste',
      RN: 'Nordeste',
      SE: 'Nordeste',
      DF: 'Centro-Oeste',
      GO: 'Centro-Oeste',
      MT: 'Centro-Oeste',
      MS: 'Centro-Oeste',
      ES: 'Sudeste',
      MG: 'Sudeste',
      RJ: 'Sudeste',
      SP: 'Sudeste',
      PR: 'Sul',
      RS: 'Sul',
      SC: 'Sul',
    }
    var PERFIL = { N: 'Indústria', D: 'Distribuidores', I: 'Integradora' }
    var ESPECIE = { R: 'Ruminantes', A: 'Aves' }
    var NOTAS = {
      G: 'Grupo MixFós/Agroara: mesma sede industrial em Araguatins-TO (dois CNPJs).',
      R: 'Reciclagem animal (farinha e oleo), nao fabrica de racao - CNAE 10.13-9/02.',
      A: 'Frigorifico/integradora de aves - unidade de Paraiso do Tocantins.',
      U: 'Unidade de Anapolis-GO do grupo Alisul/Supra.',
    }

    var col = app.findCollectionByNameOrId('factories')
    var logCol = null
    try {
      logCol = app.findCollectionByNameOrId('entity_change_logs')
    } catch (e) {
      console.log('[0152] entity_change_logs indisponivel: ' + e)
    }

    var itens = RAW.split(';')
    var criados = 0
    var pulados = 0

    for (var i = 0; i < itens.length; i++) {
      var f = itens[i].split('|')
      if (f.length < 14) {
        console.log('[0152] linha invalida ignorada: ' + i)
        continue
      }
      var nome = f[0]
      var cnpj = f[1]
      var cidade = f[2]
      var uf = f[3]
      var cep = f[4]
      var logradouro = f[5]
      var numero = f[6] || 'S/N'
      var bairro = f[7] || 'Centro'
      var telefone = f[8]
      var email = f[9]
      var perfil = PERFIL[f[10]] || 'Indústria'
      var especie = ESPECIE[f[11]] || 'Ruminantes'
      var nota = NOTAS[f[12]] || ''
      var razao = f[13]

      var existentes = app.findRecordsByFilter(
        'factories',
        'cnpj = {:cnpj} && is_deleted != true',
        '',
        1,
        0,
        { cnpj: cnpj },
      )
      if (existentes && existentes.length > 0) {
        pulados++
        console.log('[0152] CNPJ ja cadastrado, pulando: ' + nome + ' (' + cnpj + ')')
        continue
      }

      var obs = 'Razao social: ' + razao
      if (email) obs = obs + ' | E-mail: ' + email
      if (nota) obs = obs + ' | ' + nota

      var rec = new Record(col)
      rec.set('name', nome)
      rec.set('cnpj', cnpj)
      rec.set('city', cidade)
      rec.set('state', uf)
      rec.set('region', [REGIAO[uf] || 'Centro-Oeste'])
      rec.set('country', 'Brasil')
      rec.set('cep', cep)
      rec.set('logradouro', logradouro)
      rec.set('numero', numero)
      rec.set('bairro', bairro)
      rec.set('address', logradouro + ' ' + numero + ' - ' + bairro)
      rec.set(
        'standardized_address',
        nome + ', ' + numero + ' - ' + bairro + ', ' + cidade + ' - ' + uf + ', CEP: ' + cep,
      )
      rec.set('telefone', telefone)
      rec.set('contactPhone', telefone)
      rec.set('contact_email', email)
      rec.set('profile_type', [perfil])
      rec.set('animalSpecies', [especie])
      rec.set('notes', obs)

      rec.set('tipo', 'Cliente')
      rec.set('funnelStage', 'Lead')
      rec.set('carteira', 'RUMINANTES')
      rec.set('status', ['Prospeção'])
      rec.set('priority', ['Medium'])
      rec.set('winProbability', 10)
      rec.set('focusLevel', '3')
      rec.set('operationTypes', 'Ração')
      rec.set('address_status', 'complete')
      rec.set('precisao', 'rua')
      rec.set('geocode_precision', 'street')
      rec.set('ultima_edicao_origem', 'excel')
      rec.set('vendedor_id', VENDEDOR_ID)
      rec.set('salesOwner', SALES_OWNER)
      rec.set('lastInteraction', new Date().toISOString())

      app.runInTransaction((txApp) => {
        txApp.save(rec)

        if (logCol) {
          var log = new Record(logCol)
          log.set('entity_type', 'factories')
          log.set('entity_id', rec.id)
          log.set('entity_name', nome)
          log.set('user_name', 'Sistema (Migracao 0152)')
          log.set('field', 'name')
          log.set('old_value', '')
          log.set('new_value', nome)
          log.set('action', 'create')
          log.set(
            'change_summary',
            'Cliente criado no lote ' + LOTE + ' e atribuido ao vendedor Joao Figueiredo.',
          )
          txApp.save(log)
        }
      })

      criados++
    }

    console.log('[0152] criados=' + criados + ' pulados_cnpj_existente=' + pulados)
  },
  (app) => {
    // Rollback no-op: as contas criadas estao identificadas em entity_change_logs (Migracao 0152).
  },
)
