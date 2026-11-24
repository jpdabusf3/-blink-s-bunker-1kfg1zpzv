/// <reference path="../pb_data/types.d.ts" />

/**
 * Migracao 0153 - preenche endereco e CEP dos clientes ja cadastrados.
 *
 * Etapa 1: grava o CEP levantado na Receita Federal (BrasilAPI) em 24/11/2026.
 * Etapa 2: consulta o ViaCEP no servidor e completa logradouro, bairro e municipio.
 *
 * Entraram apenas contas de ALTA CONFIANCA: CNPJ da propria conta, ou nome que casou
 * com o CNPJ e cuja cidade confere (ou estava vazia na conta). Ficaram de fora 28 contas
 * ambiguas (24 homonimos de outra cidade + 4 cujo CNPJ aponta para outro municipio).
 *
 * Formato do lote: id|cep
 * Nao sobrescreve nome, telefone, e-mail ou estagio do funil. Auditoria em entity_change_logs.
 */

migrate(
  (app) => {
    var A =
      'kzqnd807xem0iy3|76988-010;36y818xtxus55m8|18304-623;uiicj9esugkd8cb|13369-899;e75hsgt3l27odyn|06345-290;q7ngem7bl41xe91|15570-000;bie9ngtqri7x86m|18760-039;q446tghii3p184y|18528-600;vkfdamqyo19icsr|13838-899;ozcnyxtutv375ci|16260-000;k0bn3h4y1lvr5ft|15530-000;ekt98brpwo6dgy8|06715-410;ejaywzw10q89fmt|14140-005;h3y9u8a5rtzaug6|13692-264;k76p7a5xyjvnybx|09981-420;rjczu0xp7inkwkk|13599-899;gt8w5kjq4s7cr3o|13359-250;rlp10s6unxwyeio|06823-140;v2eafaftkud7nbl|16279-899;o85n51t5n2zulk9|14115-000;1pyc3ybwo1i1qha|14815-000;yzonnvfv9hdzw1x|18154-831;8izwkujw3iz39c4|17269-899;hzimvxxx11gj1xu|18207-760;qwdtcmqt7mctzwz|18400-970;2tx47jvpvynvoqv|13976-202;q171fhy6o2ivt2n|08582-500;ex1zxlpodmld35d|13314-899;ozn6ghq6w69p703|13299-500;s57kgwpatg5djrb|14500-000;hbdqmxgy9b3u2k8|14778-899;c0boao8p7yo8uf8|14890-500;ukb1kqj7fwo5f94|12326-492;lrcq8tvywd5cu4c|15155-000;o5m3d0w3e4l4vz7|11940-000;s8il0qzri8sz2jn|13916-058;k97e0kvgjuc94ko|15703-330;8bzp789683nk1zx|06612-200;7l8rai39bnjd859|14680-000;9iatw433dyq3zr6|13240-000;l1wgxopzsldw82f|17213-000;ss63so710ect6bv|14450-000;rrgl5moeuynwm9e|18535-000;78ulqp0wabu6j0a|13213-100;mpm00fg3vtn4fwl|17896-000;57j7ivf8bnod8bq|13612-390;wx6qva9eovzps3h|13489-800;kmst13j27tybu45|13950-000;j1jzr7nxbjn3wn4|16403-025;dtirgbulkz8lbf6|16340-000;1hw5wkcuq19g4o9|17299-899;zradr6c4hdcenlc|17512-043;ijgctfuhxv3bq99|19509-899;nbix6osg9ecer47|09370-830;h5t1g588wzm7w8r|16807-526;fttqxb4lcgk7539|15130-264;m80nwgsrw1y6kgq|08770-041;oqlbiz1vwhw4gjl|13849-214;fibzb5jmf2mzyz9|13805-280;0rknmq9owyhyjlz|15910-000;duqnu00nkbt2z33|15150-000;xgu5e9wxilq4pbw|19220-000;qfqfdsyucc0v0sk|15120-000;ac2f77tegnk3t58|15218-899;dyzqgrjknewnlo9|15440-000;9e9dad8k90gre4l|16940-000;e8rd7vvq7ti8hyf|15459-899;rt3dqneo2r6egne|06060-190;vdc2wouc7qtpl2m|17920-000;gdb4pzxgyrlgrm4|15720-000;72g02suvnlp057p|14419-899;xj4zubm0fxc461h|19865-000;p6qzdd9rkmx9ql5|16300-001;oxdsazzgcwld6xg|18589-899;4boihj07o7ns2p0|16239-899;j77smu773oulo7l|18185-000;c34lbw6dco5oum8|12412-805;pceyd0sevbnfspi|13413-060;07mc6td4n166jsl|19200-000;j1or3knb7ou8tnh|13631-301;4pr6vsfd45xji3f|17499-008;i3iil7rpbsh96rq|19300-000;qh584vaq574y6up|19064-190;7vnk7q3uv8wwnw2|19409-514;r87b9sta8f31j3u|16372-210;7gyog8x1ui54dx7|19789-899;ej50ro3k4xqo1yc|13370-000;lgleyrmlezmoo5d|11900-000;h626do4ph1dsgnu|19380-000;a7y9cstuua6uobh|14095-250;mwb72bbi39sh7cp|15495-000;lfrrpb2jta64m03|18160-000;9dgdtlnqb0jhibz|15750-000;upar6j2h3nc55x8|13457-192;cef2yel1clvf46q|18919-899;gzsizoql8fuojg2|15775-000;2wiwjjimxt83mdd|07500-000;kgvzkp6fu3fsuol|19369-899;39cpg3rpa9z40fo|13833-591;a8w385zibfezjqg|13995-000;77yqqw26n4wbilv|09852-060;z8ewenc4q1ksxbs|09540-000;9vw4ecaz4foy8v4|13570-470;mf4ttbpwef3028c|13879-899;'
    var B =
      'a03sm6odlfzcvrr|17970-044;g0c651ocwdfq20k|14600-000;s8odpymhkl7dsk2|15080-260;x223m2sjz5hu75q|12238-573;fxi3egf87wdb0kb|18650-024;obd5wigsgobkv2u|04461-050;ffgh3mmh8xhi5oh|18140-000;otwjw1tvrws43i5|14173-020;zvc88x3g561cew8|13960-763;pbly23g8dmyq5y6|18086-390;jszbrnachby3nch|13175-560;zs54ymzrglqvykf|08653-020;he0abnwqg3k3xbf|18890-000;bloh9vorvlrwoyh|13763-899;xen15d4qtadzpc3|15901-547;cckgncbgvq9g16h|18425-001;dbe29faht38kmol|19210-000;wnibm9xxqpap8k2|19822-312;bnlr048cu4wlugr|12081-010;xonajnx3fmn2dm2|18530-000;3d4utrb10xk7izg|14935-003;5y71va86liwfag7|15890-000;24e4d3rxvd3ogtj|15760-000;xwg5hznrngfdq7z|13278-327;63pcr26r0bun5qo|16880-000;gwxojb58qc5rmvq|13222-000;31cstmvjfhxp6l9|15504-000;6fyaxrq218vzagy|77600-000;su8b6w5oemgdyhu|77600-000;7ylehgu4k3yxw8g|77615-000;0l3kk0b9w5etqti|68189-000;3w8jfu6it3dkv3j|68552-640;xwpn3q4129giqui|68515-000;phplxoe14j0412k|65706-000;d14ssbnhtk51y3x|65930-000;ots0ri4ltmiluwr|65800-000;h26jsbs3hxqc8b0|69909-006;13rcbdfhqgyz7bm|69990-000;9w883wqngsxrai2|69934-000;1u29sdvd4grftsa|77006-534;fvnytgrb2s62syi|68551-675;qvvzdewu3telk9d|13367-360;b6dtp7c4b2lormk|13363-504;i05n78ktfq4ud3n|18523-494;lxwh5r62q8ki08u|13835-000;6jaz0jotfxq3oe2|14140-000;s0pamrbk2u8l3to|14140-000;z6hh1a5bqnwx1nr|13690-000;htkscc95fddbgv4|13690-000;0wzrgr1bo56qc00|13690-000;ztmxbq62zrkxieu|13690-000;oe2cscd1zqo267v|13690-000;g3ut30pl2z7h1pa|09961-680;h7agoab288f5d5b|13590-000;ek2w9iuoxt0p44a|06817-000;ovuvw8qfwi35btg|06805-035;kgspz5qn64ebjgo|07175-400;wjbrrssfapj2r8f|07260-330;emjq95ruvgvu9q5|18150-000;0jtez6gh01s4vid|13347-659;yvbikt4g4gbr3ls|13347-659;dlc53nqvaj65os6|13348-758;7xd7oofcpfth90g|13295-607;vyac1vr9xbl1vrp|14876-150;szz2oh3nzu7lw4m|14876-112;bsoc0u8z3ljiq0k|14882-112;t4w4v3tjth4bj8q|14883-125;tu97fuuu22825a2|13916-074;ednaz2ownftssq0|15703-340;rj6mmp59mt68i2u|15700-002;q0ykw32jfwjc79s|13612-383;02hc4pmpt8xs7w1|19500-000;96brdak01kp85p1|16830-000;e5wn70a9jbygne6|15130-001;gzb56qbqx91gcbd|15130-001;o8zck40nylged28|13803-340;zvx7cp832s80f67|15150-000;ifcv7l0tyuds27i|14415-000;dqarbcdm8hw5fag|16300-005;1d0rrp22vogvsxt|18580-000;67whdln3cfx5bce|13424-580;hhdoe2jcmuc3s7v|13408-035;23lsm3pmk5n7t2n|13632-215;ar3vhklr0522pw5|13631-345;wj8m6ewr1ui2uhd|13634-762;g75qv70bwijzj46|13632-628;m066b9u3s9pqz57|13634-214;elud3wh2kyrerc1|13632-628;i6kp3zsr3bzbbiu|19061-000;zoc26g2rzg6e5o4|19053-205;cba3npux41k2mym|19400-000;j94qz2lhhkknf5f|16370-000;73fd4v0gjmwb4s1|13370-404;tcq5fu27tk1kkzp|18160-000;kt2ag2ldq9sfgo1|15750-001;x4wls6hs9kc0ymj|18919-899;k37eopuudxr723o|15775-000;zj2qqsztzcnvzxd|09615-020;29pt7xexrhtkows|13573-522;3whr17o7mdmhst1|13570-360;vevm2fppqen525z|13565-261;xixpj07sjczm18j|13577-899;3seoghzbys4qmgd|13870-672;'
    var C =
      'pk255idymsibpmo|13871-147;q4tblul0wjxdwit|15046-773;0moftdntgjdbqpz|15045-395;rzvak1u9cass2bd|15053-750;py1jzt778spjh29|15093-600;7pwwvpqh7bmb2uo|15080-390;nxcsmg98qmftg7x|15030-000;jv1yz4drqtg3vfr|15086-340;ii7y0l2amx3e8lw|15062-000;adm92x1m6hnjy3y|15062-000;5os2h2ivjtz2bzy|15076-155;cwp59p4zw3mulmh|15070-560;02zcnc0iaz2tveq|12227-788;jarlsrig1joqyft|03408-060;3xf0xwb6m62q3kd|04711-120;2g2bt1mobwl9uy0|05846-420;smvggmhikey4yux|03157-060;ssgso0qyw26yz90|04635-080;erzko700zl5lfng|08450-400;gdkqro3oqayq2ju|04036-000;fgg215o62zyap8c|02614-100;48xl4ly1xg2bdi9|03282-001;lhr3j4frb6yi9ob|05567-040;s7nna9wfsm8sani|01523-020;nheym4rtndozx0b|02310-002;eon551pm20ezt2v|03427-000;wwjwki0ewfudfdt|05276-110;fdg0kn921r3nh4r|13960-000;dl19fhpbn25vxqk|08610-100;rnmy0r9qjbmi0of|18534-830;ofv8uuvxyfjoj3l|13279-150;jphv90zxruyxxvm|13277-230;ixb0oxx1uxos0vz|13270-100;35dsdzhr5es9tja|13278-075;j5gtzoc0zdyy9zm|13225-340;dpho1wwnzjljoug|15138-899;vs8hvsydh4n1q6g|12929-570;1wdwl48mds5hzgy|18959-899;64gswy9zcex66ne|87065-110;vjppjjcvfk6dlut|05069-030;uys70d3puwitrd0|78513-000;ato4flcnme7zb1c|78580-000;g5lbkn6chpyrmh4|83412-055;vjvvir5h31tzv5n|87070-772;5jnru9wduvxhqlk|83420-000;l1h6zmeqt83bysk|86975-000;wu13aux5c17ogz0|38740-512;f5aut554qvkbory|75960-000;1zsh737v7qumxvi|13148-153;1vu6vuez5311aer|13478-540;py1f1od5s0rqu9a|13478-540;tcp51drm86tql85|86360-000;x2frdq9ep1df1il|13059-639;gfs6ogt33oyggcd|14808-130;iaza8znrxp46zzw|14800-009;791yybhejzgz2hd|18705-685;u32wqkruv5q997i|17252-214;a8oipgtw2aqtp6z|06409-080;yjgdc7yqcbnpiuk|17690-000;kosk6vez8f022oi|17047-280;bleb9gh1q0zftle|16201-530;xjnhmxkp5xjuk9k|18619-899;l7ervzoz5xidu35|81460-030;ed7112liwss2ee2|12929-990;9m6grayf91l080q|76900-992;860y7ffx0w6sx46|76914-899;t8srqrs1dnqovi8|76835-500;7noh79g0yoabo8e|32628-105;aw2abxp935zy2kn|69909-004;z0et27h3zdygnwk|65919-555;37s1spp2xxgtb7u|85950-000;r8br6pg7ucd3k64|85724-008;bnmkl64wjtg0hwu|85919-899;rkzz8v3l8ol12uy|81290-260;1wrol1vjmzlgclm|15430-000;0y156euzx7may7r|78415-000;74clvq1oh8bbk8v|78098-370;h0q7jgxgvua4opk|78390-000;ge09zmocy4t6iwb|78894-280;urvhseigyg0ptnb|78745-720;8ykf054eqfb6st8|78575-000;r7urack5063k68c|78820-000;cnoct8qeaqbnycp|15086-340;3kmny09rpmv3sg2|18165-480;v5sqpcqlpxuir72|78575-000;stem61he9gu3z7x|78525-000;fuf0ji5qjl1f2tp|78460-383;tvv2m0w4yyprct7|99950-000;vvd8xo1f1oy3kbl|38743-400;pleuoyp99wq4yqj|36180-000;jlaj7bqzibx007i|37701-970;xm5ehy6j5zep33x|13903-050;0mdqj3bxind4d0q|95360-000;5y9oi3sbeswknae|18967-002;lxmxh1ipdncjo4p|16200-020;8ocfe63jhg8reum|17240-127;g9rz8cswofzeedw|17380-000;m2mq8fosmcdcubk|17380-000;dqkb4a729j0gom2|13835-000;5m370g5dkk66ny7|88730-000;t1mn88z0i0v0vd0|07260-330;qlt1snnblclojdz|07260-330;ggy148vy8qw8pj7|88730-000'

    var LINHAS = (A + B + C).split(';')

    var logCol = null
    try {
      logCol = app.findCollectionByNameOrId('entity_change_logs')
    } catch (e) {
      console.log('[0153] entity_change_logs indisponivel: ' + e)
    }

    var cepCache = {}

    function viaCep(cepDigits) {
      if (cepCache[cepDigits] !== undefined) return cepCache[cepDigits]
      var res = null
      try {
        var r = $http.send({
          url: 'https://viacep.com.br/ws/' + cepDigits + '/json/',
          method: 'GET',
          timeout: 12,
          headers: { 'User-Agent': 'BlinkBiotech/1.0' },
        })
        if (r.statusCode === 200) {
          var d = r.json
          if (typeof d === 'string') d = JSON.parse(d)
          if (d && d.erro !== true && d.erro !== 'true') {
            res = {
              logradouro: d.logradouro || '',
              bairro: d.bairro || '',
              municipio: d.localidade || '',
              uf: d.uf || '',
            }
          }
        }
      } catch (err) {
        console.log('[0153] ViaCEP falhou para ' + cepDigits + ': ' + err)
      }
      cepCache[cepDigits] = res
      return res
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
    var cepInvalido = 0
    var semViaCep = 0

    for (var i = 0; i < LINHAS.length; i++) {
      var f = LINHAS[i].split('|')
      if (f.length < 2) continue
      var id = f[0]
      var cepDigits = String(f[1]).replace(/\D/g, '')
      if (cepDigits.length !== 8) {
        cepInvalido++
        continue
      }
      var cepFmt = cepDigits.substring(0, 5) + '-' + cepDigits.substring(5)

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
      var vc = viaCep(cepDigits)
      if (!vc) semViaCep++

      var logradouro = vc && vc.logradouro ? titleCase(vc.logradouro) : rec.getString('logradouro')
      var bairro = vc && vc.bairro ? titleCase(vc.bairro) : rec.getString('bairro')
      var municipio = vc && vc.municipio ? titleCase(vc.municipio) : rec.getString('city')
      var uf = vc && vc.uf ? vc.uf : rec.getString('state')
      var numero = rec.getString('numero') || 'S/N'

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
        cepFmt

      var completo = !!(logradouro && bairro && municipio && uf)

      app.runInTransaction((txApp) => {
        rec.set('cep', cepFmt)
        if (logradouro) rec.set('logradouro', logradouro)
        if (bairro) rec.set('bairro', bairro)
        if (municipio) rec.set('city', municipio)
        if (uf) rec.set('state', uf)
        rec.set('address', endereco)
        rec.set('standardized_address', padrao)
        rec.set('address_status', completo ? 'complete' : 'partial')
        rec.set('precisao', 'rua')
        rec.set('ultima_edicao_origem', 'excel')
        txApp.save(rec)

        if (logCol) {
          var log = new Record(logCol)
          log.set('entity_type', 'factories')
          log.set('entity_id', id)
          log.set('entity_name', nome)
          log.set('user_name', 'Sistema (Migracao 0153)')
          log.set('field', 'cep')
          log.set('old_value', '')
          log.set('new_value', cepFmt)
          log.set('action', 'update')
          log.set(
            'change_summary',
            'CEP preenchido pela Receita Federal (BrasilAPI) e endereco completado pelo ViaCEP em 24/11/2026.',
          )
          txApp.save(log)
        }
      })

      atualizados++
    }

    console.log(
      '[0153] atualizados=' +
        atualizados +
        ' nao_encontrados=' +
        naoEncontrados +
        ' cep_invalido=' +
        cepInvalido +
        ' sem_viacep=' +
        semViaCep,
    )
  },
  (app) => {
    // Rollback no-op: os valores anteriores estao em entity_change_logs (0153).
  },
)
