/// <reference path="../pb_data/types.d.ts" />

/**
 * Migracao 0154 - completa logradouro e bairro das contas atendidas pela 0153.
 *
 * A 0153 gravou o CEP (Receita Federal / BrasilAPI), mas o ViaCEP nao respondeu a partir
 * do servidor, e o endereco padronizado saiu com "Centro" no lugar do bairro real.
 * Esta migracao aplica o logradouro e o bairro do cadastro da Receita.
 *
 * Formato: cep|logradouro|bairro (287 CEPs distintos)
 * Idempotente: so grava onde o campo esta vazio ou diferente. Recalcula address e
 * standardized_address. Auditoria em entity_change_logs.
 */

migrate(
  (app) => {
    var A =
      '01523020|Freire da Silva|Cambuci;02310002|Mazzei|Vila Mazzei;02614100|da Ventura|vl n Cachoeirinha;03157060|Burgos|Parque Sevilha;03282001|Vila Ema|Sapopemba;03408060|Cegonha|Chacara Santo Antonio (zona Leste);03427000|Luis Pinto|Vila Carrao;04036000|Domingos de Morais|Vila Mariana;04461050|Jose Martins Coelho|Vila Emir;04635080|dr Abelardo Vergueiro Cesar|Vila Alexandria;04711120|Nagib Miguel Ciufe|Jardim Hipico;05069030|da Lapa|Lapa de Baixo;05276110|de Perus|Anhanguera;05567040|Poema Dos Olhos|Jardim Sao Jorge;05846420|Thereza Mouco de Oliveira|Vila Maracana;06060190|Libero Carnicelli|Bela Vista;06345290|Sao Camilo|Chacara Sao Joao;06409080|Monte Das Gameleiras|Jardim California;06612200|Jose Milanes|Jardim Alvorada;06715410|do Capuava|Paisagem Renoir;06805035|Keiichi Matsumoto|Moinho Velho;06817000|Joao Paulo i|Jardim Santa Barbara;06823140|Urupes|Jardim Santo Eduardo;07175400|Santa Maria do Para|Jardim do Triunfo;07260330|Adriano Dos Santos Cavalcanti|Jardim Angelica;07500000|Barao do Rio Branco|Monte Negro;08450400|Leonilda Magrini|Guaianases;08582500|Sao Miguel Arcanjo|Veraneio Maracana;08610100|Brasilia|Vila Amorim;08653020|Virgilio Goncalves Capella|Chacara Estancia Paulista;08770041|Tenente Onofre Rodrigues de Aguiar|Vila Industrial;09370830|Waldemar Rigout|Sertaozinho;09540000|Engenheiro Reboucas|Ceramica;09615020|Rio Preto|Rudge Ramos;09852060|Fukutaro Yida|Cooperativa;09961680|Leticio (jd Ruyce)|Casa Grande;09981420|Lico Maia|Conceicao;11900000|Jose Antonio da Silva Junior|Distrito Industrial;11940000|04|Parque Industrial;12081010||Jardim Sandra Maria;12227788|Constancia da C.paiva|jd Sta Ines ii;12238573|Salviano Jose da Silva|Eldorado;12326492|do Lambari ii|Bairro Dos Remedios;12412805|Dom Joao vi|Distrito Industrial;12929570|Ampere|Penha;12929990|Ismael Leme Mourao,|Bom Retiro Dos Mourao;13059639|John Boyd Dunlop|Cid. Satelite Iris;13148153|Joaquim Arico|Betel;13175560|Padre Francisco de Abreu Sampaio|Chacara Bela Vista;13213100|Das Industrias|Distrito Industrial;13222000||Jardim Paulista;13225340|Dorival Sponchiado|Loteamento Olaria Parque Empresarial;13240000|Municipal Natal Lorencini|Pitangal;13270100|Sete de Setembro|Centro;13277230|Natale Capelatto|Vila Pagano;13278075|Joao Lando Neto|Chacaras Sao Bento;13278327|Visconde de Porto Seguro|Sitio Recreio Dos Cafezais;13279150|Minoro Toyoda|Vale Verde;13295607|Prefeito Jose Carlos|Santa Julia;13299500|Clovis Cuestas|Minas de Inhandjara;13314899|Fazenda Agua Branca|Pedregulho;13347659|Venus|American Park Empresarial nr;13348758|Horst Frederico Joao Heer|Europark Comercial;13359250|Luiz Carlos Brugnerotto|Jardim Dos Lagos (cardeal);13363504|Antonio Forti Kanela|Morro Amarelo;13367360|Municipal Bairro Sao Fernando a Capivari|Milha;13369899|Sp- 101|Area Rural de Capivari;13370000|Joaquim Frasseto|Distrito Industrial;13370404|Carmelindo Rosato|Distrito Industrial de Rafard Doutor Alcides Brun;13408035|Roma|Santa Terezinha;13413060|Waldyr Martins Ferreira|Uninorte - Capim Fino;13424580|Frei Vital de Primeiro|Vila Pacaembu;13457192|Plinio Salgado|Distrito Industrial ii;13478540|Nossa Senhora de Fatima|Fazenda Machadinho;13489800|Anhanguera|do Jaguari;13565261|Sinlioku Tanaka|Parque Tecnologico Damha i Sao Carlos;13570360|Samuel de Carvalho Chaves|Jardim Sao Paulo;13570470||Jardim Sao Paulo;13573522|Rudolf Jayme Langnor|Parque Novo Mundo;13577899|sp 318/sitio Valparaiso|Rural;13590000|Municipal Drd 020|nd;13599899|Luiz Augusto de Oliveira, km 204|Area Rural de Dourado;13612383|Oswaldo Sachi|Distrito Industrial;13612390|Fabio Franzo|Distrito Industrial;13631301|Campo Alto|Campo Alto;13631345|Juca Costa|Jardim Roma;13632215|da Constituicao|Jardim Ament;13632628|Hideo Miamoto|Polo Industrial Guilherme Muller Filho;13634214|Tenente Olympio Guiguer|Vila Guilhermina;13634762|Andre Luiz de Oliveira Penteado Junior|Bairro da Cantareira;13690000|Joao Augusto Cirelli|Tamandua;13692264|Joao Augusto Cirelli|Zona Sudoeste;13763899|Itaiquara|Zona Rural;13803340|Caetano Schincariol|Sede;13805280|Governador Doutor Adhemar Pereira de Barros|Jardim Santa Ana;13833591|Marginal sp 340, Pista Norte|Distrito Industrial;13835000|sp 191|Sao Joao da Figueira;13838899|Professor Zeferino Vaz- sp 332|Area Rural de Conchal;13849214|Jorge Margy|Parque Industrial Mogi Guacu;13870672|Acesso a Rodovia sp 344|Sitio Santa Aguida;13871147|Joao Dorico|Jardim Dona Tereza;13879899|sp 344 - Rubens Leme Asprino|Area Rural de Sao Joao da Boa Vista;13903050|Municipal Amp-338|da Barra;13916058|Vicenzo Granghelli|Nucleo Residencial Doutor Joao Aldo Nassif;13916074|Emilio Marconato|Nucleo Residencial Doutor Joao Aldo Nassif;13950000|Lindoia/socorro sp 147 km 17|Rio do Peixe;13960000|Mantova|Jardim Italia;13960763|Turistico Laercio Picarelli|Almas;13976202|Joao Batista Rocha|Vila Boa Esperanca;13995000||Frutal;14095250|Edson Souto|pq Indl Lagoinha;14115000|12 de Janeiro|Mombuca;14140000|Anhanguera sp 330|Distrito Industrial;14140005|Marechal Deodoro da Fonseca|Centro;14173020|Albano Bacega|Zona Industrial;14415000|Sao Judas Tadeu, Estrada Patrocio Paulista Via Eta,|Zona Rural;14419899|Ronan Rocha|Area Rural;14450000|Candido Portinari|Zona Rural;14500000||Vila Zelinda;14600000|Ceagesp|Distrito Industrial;14680000|Anhanguera sp 330 km 328 157 Metros a Direita|Zona Rural;14778899|Neto|Zona Rural;14800009|Alvaro de Souza Pinheiro|Jardim Quitandinha;14808130|Pedro Jose Laroca|5º Distrito Industrial;14815000|Sao Joao|Area Remanescente Zona Rural;14876112|Jose Bonifacio|Solar Corinthiano;14876150|Joao Batista Ferraz Sampaio|Jardim Bom Jesus;14882112|Alexandre Detogni|Aparecida;14883125|Jaime Ribeiro|Vila Industrial;14890500|sp 333 Carlos Tonani|Chacara Santa Clara;14935003|27 de Dezembro|Centro;15030000|Doutor Cenobelino de Barros Serra|Parque Industrial;15045395|Domingos Falavina|Pq. Res. Dom Lafayete Libanio;15046773|Pedro Martins|Mini Distrito Adail Vetorasso;15053750|br 153|Distrito de Talhado;15062000|Joao Parise|Chacara Jockey Club (zona Rural);15070560|Governador Adhemar Pereira de Barros|Parque Residencial Comendador Mancor Daud;15076155|Uber Folchine|Parque Industrial Campo Verde;15080260|Nelson Ferez Bucater|Santa Maria - Jd.;15080390|Doutor Hamilton Cezar Zoccal|Parque Quinta Das Paineiras;15086340|Lourdes Liebana Fernandes|Centro Empresarial Coplan;'
    var B =
      '15093600|Das Andorinhas|Loteamento Parque Dos Passaros;15120000|Vicinal Floriano Rodrigues Martines|Zona Rural;15130001|Arthur Yacubian|Portal;15130264||Jardim Sao Jose;15138899|Feliciano Salles Cunha|Area Rural de Mirassol;15150000|Santos Dumont|Jardim Bom Jesus;15155000|Municipal de Jaci a Perobas km 4|Zona Rural;15218899|sp 355 km 12.5|Area Rural de Nova Alianca;15430000|Armando Sales de Oliveira|Zona Rural;15440000|Onda Branca Santa Cruz|Zona Rural;15459899|Vicinal Manoel Jorge Medeiros Onv 040|Castores;15495000|Waldemar Lopes Ferraz - Sentido Riolandia a Paulo de Faria|Zona Rural;15504000|Nasser Marao|Sao Cosme;15530000|Basilio Almeida de Oliveira|Centro;15570000|Carajas|Vila Nova;15700002|Vinte e Quatro|Centro;15703330|Cumbica|Aeroporto Municipal;15703340|Paulo Marcondes|Parque Industrial i;15720000|Miguel Garcia|Parque Industrial;15750000|Armindo Pilhalarmi|Zona Rural;15750001|Olimpio Estevao de Lacerda|Distrito Industrial ii;15760000|Projetada a|Distrito Industrial Iii;15775000|Jose Domingues da Fonseca|Distrito Industrial i;15890000|Aurelio Cecchin|Loteamento Cidade Alta;15901547|Antonio Scalamandre de Mendonca|Nadyr de Paula Eduardo;15910000|Jose Pizarro sp 305 km 15+85 Metros|Jardim Alvorada;16200020|Tupi|Santo Antonio;16201530|Geraldo Liessi|2 Distrito Industrial Armando Penterich;16239899|Que Liga Piacatu a Rinopolis - Sitio Sao Jose|Corrego Comprido;16260000|Municipal Crd - 040|Zona Rural;16279899|Arlindo Pizzo|Agua Limpa;16300001|Dib Jorge|Parque Industrial;16300005|Maria Chica|Centro;16340000||Centro;16370000|Julio Santini|Distrito Industrial;16372210|Julio Santini|Distrito Industrial i;16403025|Mario Covas Junior|Vila Guararapes;16807526|Dr. Raul da Cunha Bueno|Paulicea;16830000|Issamu Yuba|Primeira Alianca;16880000|Faz Sao Joao-estr.municipal Valparaiso ao Bairro Sao Joao|Zona Rural;16940000|Lin Boiadeira|Zona Rural;17047280|Luiz Fernando Rocha Coelho|Jardim Contorno;17213000|Antonio Carlos Nunes Tamanini|Chacara Nunes;17240127|Prefeito Enio Inforzato|Jardim Cecap;17252214|Salvador Scire|Polo Industrial ii;17269899|Sao Bento|Irara Branca;17299899|Osni Mateus - sp 261|Distrito Industrial Cereamista;17380000|Angelo Dalla Dea|Jardim Claudio Lysias;17499008|Jose Michelotto|Distrito Industrial;17512043|Benedito Alves Delfino|Distrito Industrial;17690000|de Bastos Para Cascata km 02|Distrito Industrial;17896000|Antonio Atilio Fagian|Distrito Industrial iv Nadir Romanini;17920000|Fortaleza|Sao Bento;17970044|Alberto Forte|Centro;18086390|Victor Andrew|Eden;18140000||Sao Joao Novo;18150000|Bunjiro Nakao|Centro;18154831|Presidente Tancredo de Almeida Neves|Murundu;18160000|Poly-plastic|Distrito Industrial ii;18165480|Agenor Leme Dos Santos|Distrito Industrial i;18185000|Antonio Lacerda|Campo Grande;18207760|Laudelino Pinheiro|Jardim Bela Vista;18304623|Mitsuchika Okamura|Distrito Industrial ii Senador Jose Ermirio de mo;18400970|Fazenda Campos da Ravina|Lagoa Grande;18425001|Francisco Alves Negrao|Tres Oncas;18523494|Marietta Lorenzetti|Chave Barros;18528600|Vereador Dercy Bertanha|Distrito Industrial;18530000|Marechal Rondon|Centro;18534830|Cornelio Pires|Agua Branca;18535000|Marechal Rondon|Paineiras;18580000|Marechal Rondon|Estacao de Pereiras;18589899|Pereiras ao Bairro da Serra - Sitio Bela Vista|da Serra;18619899|Botucatu / Bairro Monte Alegre|Zona Rural - Fazenda Retiro;18650024|Jose Horacio Mellao|Centro;18705685|Dr. Jose Luiz Viana Coutinho|Jardim Paineiras;18760039|Juvenal Coimbra|Centro;18890000|Santa Cruz ii|Bocaina;18919899|Santa fe|Salto Bonito;18959899|Sao Luiz|Ribeirao Grande;18967002|Capitao Manoel Joaquim|Barra Funda;19053205|Raposo Tavares|Vila Nova Prudente;19061000|Joaquim Constantino|Jardim Sao Luiz;19064190|Maurilio Fernandes|Conjunto Habitacional Ana Jacinta;19200000|Lino Machado|Nucleo Industrial;19210000|Zeferino Soares Branquinho|Centro;19220000|Nrd 267|Fazenda Mosquito;19300000|Raposo Tavares|Guaicara;19369899|Est Sto.a.a M.paranapanema|7 de Setembro;19380000||Zona Rural;19400000|Municipal Que Liga P.venceslau|Agua da Colonia;19409514|Francisca Pereira Silva|Empresarial Center Luiz Antonio Turatti;19500000|Via de Acesso Jose Biazini|Via Acesso Jose Biazini;19509899|Osvaldo Campioni Ascencio|Area Rural de Martinopolis;19789899|Quata|Area Rural de Quata;19822312|Guaranta|Distrito Industrial;19865000|Ppt 020, km 01 + 900 Metros|Zona Rural;32628105|Mg-050|Vianopolis;36180000|Prefeito Paulo de Tarso Furtado|Distrito Industrial;37701970|Jose Bianucci|Bianucci;38740512|Faria Pereira|Industrial;38743400|Catuai|Cafe Mineiro;65706000|br ma 008|Outros;65800000|Projetada Engravada Aos Fundos|Parque Gov. Luis Rocha;65919555|Pedro Neiva de Santana|Joao Paulo ii;65930000|a M/d da Br-010 Sentido Brasilia/belen-colonia|Zona Rural;68189000|Das Esmeraldas|Moraes Almeida;68515000|Vicinal 1|Zona Rural;68551675|Rod pa 287 km 96|Jardim Viviene;68552640|Rio Dourado|Capuava;69909004|Raiz de Davi|Rosa Linda;69909006|Monte Siao|Residencial Rosa Linda;69934000|br 317 km 06|Zona Rural;69990000|br Japim|pe da Terra;75960000|Maria Machado de Almeida|Areas do Centro;76835500|Deputado Sergio Carvalho|Distrito Industrial;76900992|Linha 94, Lote 46-a|Zona Rural;76914899|br 364|Saida p/ Porto Velho;76988010|Marechal Rondon|Centro (5 Bec);77006534|412 Norte Alameda 8|Plano Diretor Norte;77600000|br 153, km 484|Industrial;77615000|Bahia|Centro;78098370|k|Distrito Industrial;78390000|Juscelino Kubstchek|Distrito Industrial;78415000|br 364 km 762|Zona Rural;78460383|Belo Horizonte|Industrial;78513000|br 163|Boa Esperanca;78525000|br 163|Zona Rural;78575000|Rio Arinos|Chacara de Recreio Emaus 01;78580000|Castanheira|Setor Oeste - 1;78745720|Joaquim Amanciio Filho|Distrito Industrial;78820000|br 364|Zona Rural;78894280|Sudeste|Sao Cristovao;81290260|General Walter da Costa Reis|Cidade Industrial;81460030|Rodolpho Hatschbach|Cidade Industrial;83412055|Maria Dal Pra Berlezi|Canguiri;83420000|Padre Cesari Lelli|Centro Industrial;85724008|Brasilia|Conda;85919899|br 163/pr, km 252,3|Zona Rural;85950000|Av. Independencia|Centro;86360000|Edelina Meneghel Rando|Vila Macedo;86975000|Verginio Bredariol|pq Industrial i - Abilio Pereira Nunes;87065110|Pioneiro Paschoal Pilli|Parque Industrial;87070772|Braz Izelli|Cidade Industrial;88730000|Geral Tres Divisas|Tres Divisas;'

    var mapa = {}
    var linhas = (A + B).split(';')
    for (var i = 0; i < linhas.length; i++) {
      var f = linhas[i].split('|')
      if (f.length < 3) continue
      mapa[f[0]] = { logradouro: f[1], bairro: f[2] }
    }

    var logCol = null
    try {
      logCol = app.findCollectionByNameOrId('entity_change_logs')
    } catch (e) {
      console.log('[0154] entity_change_logs indisponivel: ' + e)
    }

    function soDigitos(v) {
      return String(v || '').replace(/\D/g, '')
    }

    var records = app.findRecordsByFilter('factories', 'cep != "" && is_deleted != true', '', 0, 0)
    var atualizados = 0
    var semMapa = 0

    for (var r = 0; r < records.length; r++) {
      var rec = records[r]
      var cepDigits = soDigitos(rec.getString('cep'))
      var d = mapa[cepDigits]
      if (!d) {
        semMapa++
        continue
      }

      var nome = rec.getString('name') || rec.id
      var numero = rec.getString('numero') || 'S/N'
      var logradouro = d.logradouro || rec.getString('logradouro')
      var bairro = d.bairro || rec.getString('bairro')
      var municipio = rec.getString('city')
      var uf = rec.getString('state')
      var cep = rec.getString('cep')

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

      var mudou = rec.getString('logradouro') !== logradouro || rec.getString('bairro') !== bairro

      app.runInTransaction((txApp) => {
        if (logradouro) rec.set('logradouro', logradouro)
        if (bairro) rec.set('bairro', bairro)
        rec.set('address', endereco)
        rec.set('standardized_address', padrao)
        rec.set('address_status', logradouro && bairro && municipio && uf ? 'complete' : 'partial')
        rec.set('precisao', 'rua')
        txApp.save(rec)

        if (mudou && logCol) {
          var log = new Record(logCol)
          log.set('entity_type', 'factories')
          log.set('entity_id', rec.id)
          log.set('entity_name', nome)
          log.set('user_name', 'Sistema (Migracao 0154)')
          log.set('field', 'logradouro')
          log.set('old_value', '')
          log.set('new_value', logradouro + ' / ' + bairro)
          log.set('action', 'update')
          log.set(
            'change_summary',
            'Logradouro e bairro completados pelo cadastro da Receita Federal em 24/11/2026.',
          )
          txApp.save(log)
        }
      })

      if (mudou) atualizados++
    }

    console.log(
      '[0154] examinados=' +
        records.length +
        ' atualizados=' +
        atualizados +
        ' sem_mapa=' +
        semMapa,
    )
  },
  (app) => {
    // Rollback no-op.
  },
)
