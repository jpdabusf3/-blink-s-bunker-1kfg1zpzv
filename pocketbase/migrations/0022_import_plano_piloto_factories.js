migrate(
  (app) => {
    const factories = app.findCollectionByNameOrId('factories')

    // Ensure joaopedro_zoo@hotmail.com is set as CEO
    try {
      const adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'joaopedro_zoo@hotmail.com')
      adminUser.set('job_title', 'CEO')
      app.save(adminUser)
    } catch (_) {}

    const planoPilotoData = [
      {
        name: 'Agropecuária Batavo Ltda',
        state: 'PR',
        city: 'Castro',
        stateRegion: 'Sul',
        region: 'Sul',
        profile_type: 'Cooperativa',
        animalSpecies: 'Bovinos',
        status: 'Atendido',
        funnelStage: 'Pós-venda',
        priority: 'High',
        capacity: 450,
        potentialValue: 1250000,
        winProbability: 90,
        contactName: 'Wellington Arantes',
        notes: 'Manter fornecimento de Minerais Orgânicos e Prebióticos. Renovação semestral.',
        suggested_approach: 'Apresentar nova linha de Adsorventes Blink Toxin em Reunião Técnica.',
        productLineAffinity: 'Minerais Orgânicos',
        salesChannel: 'Indirect',
        indirectChannelType: 'Cooperativas',
      },
      {
        name: 'Premix Nutrição Animal S/A',
        state: 'SP',
        city: 'Patrocínio Paulista',
        stateRegion: 'Sudeste',
        region: 'Sudeste',
        profile_type: 'Premixeira',
        animalSpecies: 'Bovinos',
        status: 'Atendido',
        funnelStage: 'Fechamento',
        priority: 'High',
        capacity: 600,
        potentialValue: 1800000,
        winProbability: 85,
        contactName: 'Kalleb Barbosa',
        notes: 'Cotação aprovada para aditivos prebióticos de alta digestibilidade.',
        suggested_approach: 'Enviar minuta contratual e programar primeira entrega piloto.',
        productLineAffinity: 'Prebióticos',
        salesChannel: 'Direct',
      },
      {
        name: 'Copacol - Cooperativa Agroindustrial',
        state: 'PR',
        city: 'Cafelândia',
        stateRegion: 'Sul',
        region: 'Sul',
        profile_type: 'Cooperativa',
        animalSpecies: 'Aves',
        status: 'Atendido',
        funnelStage: 'Pós-venda',
        priority: 'High',
        capacity: 850,
        potentialValue: 2400000,
        winProbability: 95,
        contactName: 'Tom Favero',
        notes: 'Fornecimento contínuo para matrizes e frangos de corte. Desempenho acima da meta.',
        suggested_approach: 'Expandir contrato para a divisão de piscicultura (Aqua).',
        productLineAffinity: 'Adsorventes',
        salesChannel: 'Indirect',
        indirectChannelType: 'Cooperativas',
      },
      {
        name: 'Aurora Alimentos - Cooperativa Central',
        state: 'SC',
        city: 'Chapecó',
        stateRegion: 'Sul',
        region: 'Sul',
        profile_type: 'Cooperativa',
        animalSpecies: 'Suínos',
        status: 'Prospeção',
        funnelStage: 'Diagnóstico Técnico',
        priority: 'High',
        capacity: 1200,
        potentialValue: 3500000,
        winProbability: 60,
        contactName: 'Jessica Vitor',
        notes: 'Análise de integridade intestinal em granjas multiplicadoras de matrizes.',
        suggested_approach: 'Apresentar relatório de redução de micotoxinas com Blink Toxin.',
        productLineAffinity: 'Adsorventes',
        salesChannel: 'Indirect',
        indirectChannelType: 'Cooperativas',
      },
      {
        name: 'C.Vale Cooperativa Agroindustrial',
        state: 'PR',
        city: 'Palotina',
        stateRegion: 'Sul',
        region: 'Sul',
        profile_type: 'Cooperativa',
        animalSpecies: 'Multiespécie',
        status: 'Prospeção',
        funnelStage: 'Teste/Trial',
        priority: 'High',
        capacity: 980,
        potentialValue: 2900000,
        winProbability: 70,
        contactName: 'Rodrigo Gasparini',
        notes: 'Teste prático de 90 dias em andamento no setor de frangos de corte.',
        suggested_approach: 'Acompanhar coleta de sangue e ganho de peso quinzenal.',
        productLineAffinity: 'Blends',
        salesChannel: 'Indirect',
        indirectChannelType: 'Cooperativas',
      },
      {
        name: 'Nutribras Alimentos Ltda',
        state: 'MT',
        city: 'Sorriso',
        stateRegion: 'Oeste',
        region: 'Centro',
        profile_type: 'Integradora',
        animalSpecies: 'Suínos',
        status: 'Atendido',
        funnelStage: 'Fechamento',
        priority: 'High',
        capacity: 520,
        potentialValue: 1650000,
        winProbability: 80,
        contactName: 'Wagner Zacalon',
        notes: 'Suinocultura sustentável em Sorriso. Foco em sequestrante de toxinas.',
        suggested_approach: 'Ajustar cronograma logístico para embarque via Rondonópolis.',
        productLineAffinity: 'Adsorventes',
        salesChannel: 'Direct',
      },
      {
        name: 'Nutriza Alimentos (Grupo São Salvador)',
        state: 'GO',
        city: 'Itaberaí',
        stateRegion: 'Centro',
        region: 'Centro',
        profile_type: 'Integradora',
        animalSpecies: 'Aves',
        status: 'Prospeção',
        funnelStage: 'Proposta',
        priority: 'High',
        capacity: 700,
        potentialValue: 2100000,
        winProbability: 65,
        contactName: 'Wellington Arantes',
        notes: 'Proposta comercial enviada para suplementação de incubatório e matrizes.',
        suggested_approach: 'Agendar videoconferência com a diretoria técnica.',
        productLineAffinity: 'Minerais Orgânicos',
        salesChannel: 'Direct',
      },
      {
        name: 'Guabi Nutrição Animal S/A',
        state: 'SP',
        city: 'Campinas',
        stateRegion: 'Sudeste',
        region: 'Sudeste',
        profile_type: 'Indústria',
        animalSpecies: 'Equinos',
        status: 'Atendido',
        funnelStage: 'Pós-venda',
        priority: 'Medium',
        capacity: 380,
        potentialValue: 980000,
        winProbability: 90,
        contactName: 'Kalleb Barbosa',
        notes: 'Cliente histórico na linha de alta performance para equinos e PET.',
        suggested_approach: 'Ofertar lote de amostras da nova fórmula de orgânicos.',
        productLineAffinity: 'Minerais Orgânicos',
        salesChannel: 'Direct',
      },
      {
        name: 'De Heus Nutrição Animal Brasil',
        state: 'SP',
        city: 'Rio Claro',
        stateRegion: 'Sudeste',
        region: 'Sudeste',
        profile_type: 'Premixeira',
        animalSpecies: 'Multiespécie',
        status: 'Prospeção',
        funnelStage: 'Negociação',
        priority: 'High',
        capacity: 820,
        potentialValue: 2600000,
        winProbability: 75,
        contactName: 'Tom Favero',
        notes: 'Negociação comercial de volume anual de aditivos e palatabilizantes.',
        suggested_approach: 'Oferecer condição especial de pagamento para contrato de 12 meses.',
        productLineAffinity: 'Prebióticos',
        salesChannel: 'Direct',
      },
      {
        name: 'Vaccinar Indústria e Comércio Ltda',
        state: 'MG',
        city: 'Nova Lima',
        stateRegion: 'Sudeste',
        region: 'Sudeste',
        profile_type: 'Indústria',
        animalSpecies: 'Aves',
        status: 'Prospeção',
        funnelStage: 'Apresentação',
        priority: 'Medium',
        capacity: 490,
        potentialValue: 1400000,
        winProbability: 50,
        contactName: 'Jessica Vitor',
        notes: 'Apresentação institucional concluída. Aguardando validação do laboratório.',
        suggested_approach: 'Enviar laudo de equivalência biológica de adsorventes.',
        productLineAffinity: 'Adsorventes',
        salesChannel: 'Direct',
      },
      {
        name: 'Polinutri Alimentos S/A',
        state: 'SP',
        city: 'Osasco',
        stateRegion: 'Sudeste',
        region: 'Sudeste',
        profile_type: 'Indústria',
        animalSpecies: 'Aqua',
        status: 'Prospeção',
        funnelStage: 'Diagnóstico Técnico',
        priority: 'Medium',
        capacity: 310,
        potentialValue: 850000,
        winProbability: 40,
        contactName: 'Rodrigo Gasparini',
        notes: 'Desenvolvimento de ração para tilápias e camarões no Nordeste e Sul.',
        suggested_approach: 'Realizar teste em tanques experimentais de piscicultura.',
        productLineAffinity: 'Prebióticos',
        salesChannel: 'Direct',
      },
      {
        name: 'Copercampos - Cooperativa Regional',
        state: 'SC',
        city: 'Campos Novos',
        stateRegion: 'Sul',
        region: 'Sul',
        profile_type: 'Cooperativa',
        animalSpecies: 'Bovinos',
        status: 'Atendido',
        funnelStage: 'Fechamento',
        priority: 'High',
        capacity: 410,
        potentialValue: 1100000,
        winProbability: 85,
        contactName: 'Wagner Zacalon',
        notes: 'Fechamento de pedido trimestral para confinamentos de gado de corte.',
        suggested_approach: 'Emitir ordem de produção para pronta entrega.',
        productLineAffinity: 'Minerais Orgânicos',
        salesChannel: 'Indirect',
        indirectChannelType: 'Cooperativas',
      },
      {
        name: 'Comigo Cooperativa Agroindustrial',
        state: 'GO',
        city: 'Rio Verde',
        stateRegion: 'Centro',
        region: 'Centro',
        profile_type: 'Cooperativa',
        animalSpecies: 'Bovinos',
        status: 'Atendido',
        funnelStage: 'Pós-venda',
        priority: 'High',
        capacity: 1100,
        potentialValue: 3100000,
        winProbability: 95,
        contactName: 'Wellington Arantes',
        notes: 'Parceiro estratégico no Sudoeste Goiano com excelente giro de estoque.',
        suggested_approach: 'Programar dia de campo técnico com cooperados.',
        productLineAffinity: 'Blends',
        salesChannel: 'Indirect',
        indirectChannelType: 'Cooperativas',
      },
      {
        name: 'Pif Paf Alimentos',
        state: 'MG',
        city: 'Visconde do Rio Branco',
        stateRegion: 'Sudeste',
        region: 'Sudeste',
        profile_type: 'Integradora',
        animalSpecies: 'Aves',
        status: 'Prospeção',
        funnelStage: 'Primeiro Contato',
        priority: 'Medium',
        capacity: 650,
        potentialValue: 1750000,
        winProbability: 30,
        contactName: 'Kalleb Barbosa',
        notes: 'Reunião agendada com o gerente de compras de nutrição avícola.',
        suggested_approach: 'Apresentar dados de ganho alimentar em lotes comerciais.',
        productLineAffinity: 'Adsorventes',
        salesChannel: 'Direct',
      },
      {
        name: 'Consórcio Caprabel & Caprinos do Sertão',
        state: 'PE',
        city: 'Petrolina',
        stateRegion: 'Nordeste',
        region: 'Nordeste',
        profile_type: 'Produtores',
        animalSpecies: 'Caprinos',
        status: 'Prospeção',
        funnelStage: 'Diagnóstico Técnico',
        priority: 'Low',
        capacity: 180,
        potentialValue: 420000,
        winProbability: 45,
        contactName: 'Tom Favero',
        notes: 'Associação de produtores de leite de cabra em Petrolina e Juazeiro.',
        suggested_approach: 'Indicar distribuidor regional em Juazeiro/BA para atendimento.',
        productLineAffinity: 'Minerais Orgânicos',
        salesChannel: 'Indirect',
        indirectChannelType: 'Distribuidores',
      },
      {
        name: 'Ovinos do Sul Nutrição e Genética',
        state: 'RS',
        city: 'Bagé',
        stateRegion: 'Sul',
        region: 'Sul',
        profile_type: 'Produtores',
        animalSpecies: 'Ovinos',
        status: 'Prospeção',
        funnelStage: 'Teste/Trial',
        priority: 'Low',
        capacity: 150,
        potentialValue: 380000,
        winProbability: 55,
        contactName: 'Jessica Vitor',
        notes: 'Cabanhas de ovelhas de elite e cabanhas de corte no Pampa Gaúcho.',
        suggested_approach: 'Acompanhar resultados do ensaio durante a estação de monta.',
        productLineAffinity: 'Minerais Orgânicos',
        salesChannel: 'Indirect',
        indirectChannelType: 'Revendas',
      },
      {
        name: 'Aquafish Nutrição e Aquicultura do Norte',
        state: 'PA',
        city: 'Castanhal',
        stateRegion: 'Norte',
        region: 'Norte',
        profile_type: 'Indústria',
        animalSpecies: 'Aqua',
        status: 'Prospeção',
        funnelStage: 'Proposta',
        priority: 'Medium',
        capacity: 290,
        potentialValue: 780000,
        winProbability: 50,
        contactName: 'Rodrigo Gasparini',
        notes: 'Crescimento da produção de tambaqui e pirarucu em cativeiro no Pará.',
        suggested_approach: 'Ajustar frete e lote mínimo de faturamento.',
        productLineAffinity: 'Prebióticos',
        salesChannel: 'Direct',
      },
      {
        name: 'Raça Fort Nutrição Animal Ltda',
        state: 'MS',
        city: 'Campo Grande',
        stateRegion: 'Sudoeste',
        region: 'Centro',
        profile_type: 'Indústria',
        animalSpecies: 'Bovinos',
        status: 'Atendido',
        funnelStage: 'Pós-venda',
        priority: 'High',
        capacity: 540,
        potentialValue: 1500000,
        winProbability: 90,
        contactName: 'Wagner Zacalon',
        notes: 'Fornecimento regular de núcleos minerais para pastagem e confinamento.',
        suggested_approach: 'Organizar treinamento técnico para a equipe de vendas local.',
        productLineAffinity: 'Minerais Orgânicos',
        salesChannel: 'Direct',
      },
      {
        name: 'Revenda Agromaster Nordeste',
        state: 'BA',
        city: 'Feira de Santana',
        stateRegion: 'Nordeste',
        region: 'Nordeste',
        profile_type: 'Distribuidor',
        animalSpecies: 'Multiespécie',
        status: 'Atendido',
        funnelStage: 'Fechamento',
        priority: 'Medium',
        capacity: 330,
        potentialValue: 920000,
        winProbability: 80,
        contactName: 'Wellington Arantes',
        notes: 'Distribuidor chave cobrindo o semiárido baiano e Sergipe.',
        suggested_approach: 'Reforçar estoque de Blends para o período de seca.',
        productLineAffinity: 'Blends',
        salesChannel: 'Indirect',
        indirectChannelType: 'Revendas',
      },
      {
        name: 'PetCare Alimentos do Brasil',
        state: 'SP',
        city: 'Ribeirão Preto',
        stateRegion: 'Sudeste',
        region: 'Sudeste',
        profile_type: 'Outros',
        animalSpecies: 'PET',
        status: 'Prospeção',
        funnelStage: 'Diagnóstico Técnico',
        priority: 'High',
        capacity: 420,
        potentialValue: 1350000,
        winProbability: 60,
        contactName: 'Kalleb Barbosa',
        notes: 'Fabricante Premium de rações secas e úmidas para cães e gatos.',
        suggested_approach: 'Apresentar estudos de palatabilidade e imunidade pré-biótica.',
        productLineAffinity: 'Prebióticos',
        salesChannel: 'Direct',
      },
    ]

    const existingCount = app.countRecords('factories')

    for (const fd of planoPilotoData) {
      try {
        const existing = app.findFirstRecordByData('factories', 'name', fd.name)
        if (existing) continue
      } catch (_) {}

      const rec = new Record(factories)
      rec.set('name', fd.name)
      rec.set('state', fd.state)
      rec.set('city', fd.city)
      rec.set('stateRegion', fd.stateRegion)
      rec.set('region', fd.region)
      rec.set('profile_type', fd.profile_type)
      rec.set('animalSpecies', fd.animalSpecies)
      rec.set('status', fd.status)
      rec.set('funnelStage', fd.funnelStage)
      rec.set('priority', fd.priority)
      rec.set('capacity', fd.capacity)
      rec.set('potentialValue', fd.potentialValue)
      rec.set('winProbability', fd.winProbability)
      rec.set('contactName', fd.contactName)
      rec.set('notes', fd.notes)
      rec.set('suggested_approach', fd.suggested_approach)
      rec.set('productLineAffinity', fd.productLineAffinity)
      rec.set('salesChannel', fd.salesChannel)
      if (fd.indirectChannelType) {
        rec.set('indirectChannelType', fd.indirectChannelType)
      }
      rec.set('country', 'Brasil')
      rec.set('lastInteraction', new Date().toISOString().split('T')[0])
      rec.set('contactPhone', '(11) 98888-7777')
      rec.set('focusLevel', fd.priority === 'High' ? '1' : '2')
      rec.set('sector', fd.profile_type)

      app.save(rec)
    }

    // Ensure access rules allow leadership roles or joaopedro_zoo@hotmail.com to view all records
    const leadershipClause =
      "@request.auth.job_title = 'CEO' || @request.auth.job_title = 'Diretor' || @request.auth.job_title = 'Gestor' || @request.auth.job_title = 'Gerente' || @request.auth.job_title = 'Manager' || @request.auth.email = 'joaopedro_zoo@hotmail.com'"

    const factoryListRule =
      "@request.auth.id != '' && (" +
      leadershipClause +
      ' || (country = @request.auth.country && (@request.auth.geographicArea = "" || stateRegion = @request.auth.geographicArea || region = @request.auth.geographicArea)))'

    factories.listRule = factoryListRule
    factories.viewRule = factoryListRule
    factories.createRule = factoryListRule
    factories.updateRule = factoryListRule
    factories.deleteRule = factoryListRule
    app.save(factories)

    const orders = app.findCollectionByNameOrId('orders')
    const orderListRule =
      "@request.auth.id != '' && (" +
      leadershipClause +
      ' || (country = @request.auth.country && (@request.auth.geographicArea = "" || region = @request.auth.geographicArea)))'

    orders.listRule = orderListRule
    orders.viewRule = orderListRule
    orders.createRule = orderListRule
    orders.updateRule = orderListRule
    orders.deleteRule = orderListRule
    app.save(orders)

    const targets = app.findCollectionByNameOrId('targets')
    const targetListRule =
      "@request.auth.id != '' && (" +
      leadershipClause +
      " || categoryType = 'General' || (categoryType = 'Region' && categoryValue = @request.auth.geographicArea))"

    targets.listRule = targetListRule
    targets.viewRule = targetListRule
    targets.createRule = targetListRule
    targets.updateRule = targetListRule
    targets.deleteRule = targetListRule
    app.save(targets)
  },
  (app) => {
    // Revert seed items added in this migration if needed
  },
)
