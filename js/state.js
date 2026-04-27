/* ============================================================
   4flow — Estado Global (dados em memória)
   Em produção estes dados vêm da API (Apps Script + Sheets)
   ============================================================ */

const S = {

  // ── Contatos ──────────────────────────────────────────────
  contacts: [
    { id:1, name:'Ana Lima',       phone:'+55 85 9 8811-0001', ig:'@ana.lima',    tg:'',          tags:['cliente','vip'], last:'2min',   status:'ativo'    },
    { id:2, name:'Carlos Melo',    phone:'+55 85 9 9922-0002', ig:'@carlos.melo', tg:'@carlosmelo', tags:['lead'],         last:'1h',     status:'ativo'    },
    { id:3, name:'Fernanda Costa', phone:'+55 85 9 7733-0003', ig:'',             tg:'',          tags:['cliente'],       last:'3h',     status:'ativo'    },
    { id:4, name:'João Souza',     phone:'+55 11 9 8844-0004', ig:'@joaosouza',   tg:'',          tags:['lead'],          last:'ontem',  status:'pausado'  },
    { id:5, name:'Mariana Faria',  phone:'+55 21 9 9955-0005', ig:'@mafaria',     tg:'@marianaf', tags:['vip','cliente'], last:'5min',   status:'ativo'    },
  ],

  // ── Disparos ──────────────────────────────────────────────
  disparos: [
    { id:1, name:'Boas-vindas Auto',   canal:'WhatsApp', dest:1247, env:1247, resp:834, status:'concluido', data:'Hoje 08:00'    },
    { id:2, name:'Promoção Junho',     canal:'Instagram',dest:432,  env:432,  resp:189, status:'concluido', data:'Hoje 10:30'   },
    { id:3, name:'Follow-up Leads',    canal:'WhatsApp', dest:287,  env:143,  resp:67,  status:'enviando',  data:'Agora'        },
    { id:4, name:'Reativação Inativos',canal:'WhatsApp', dest:98,   env:0,    resp:0,   status:'agendado',  data:'Amanhã 09:00' },
  ],

  // ── Fluxos ────────────────────────────────────────────────
  flows: [
    { id:1, name:'Boas-vindas',       trigger:'Novo contato',    steps:['💬 Mensagem','⏱ Aguardar 1h','💬 Oferta'],   active:342, status:'ativo'   },
    { id:2, name:'Palavra-chave OI',  trigger:'Palavra: OI',     steps:['💬 Menu','⏳ Aguardar resp.','🔀 Rotear'],    active:89,  status:'ativo'   },
    { id:3, name:'Recuperação 48h',   trigger:'Sem resp. 48h',   steps:['💬 Follow-up','🏷 Tag: recontato'],           active:23,  status:'ativo'   },
    { id:4, name:'Sync AC',           trigger:'Tag adicionada',  steps:['⚙ Atualizar ActiveCampaign'],                active:156, status:'ativo'   },
    { id:5, name:'Info Produto',      trigger:'Palavra: INFO',   steps:['💬 Catálogo','⏱ Aguardar','💬 Proposta'],    active:12,  status:'pausado' },
  ],

  // ── Números de envio ──────────────────────────────────────
  numbers: [
    { phone:'+55 85 9 8811-2233', label:'Principal',  metaId:'1234567890123456' },
    { phone:'+55 85 9 9922-1100', label:'Secundário', metaId:'9876543210987654' },
  ],

  // ── Conversas ─────────────────────────────────────────────
  convs: [
    { id:1, name:'Ana Lima',      ch:'wa', preview:'Quero saber mais!',      time:'2m', unread:2, msgs:[
      { in:true,  text:'Oi! Vi a publicação de vocês', t:'10:21' },
      { in:false, text:'Olá Ana! Como posso ajudar? 😊', t:'10:22' },
      { in:true,  text:'Quero saber mais sobre o produto!', t:'10:24' },
    ]},
    { id:2, name:'Carlos Melo',   ch:'ig', preview:'Quanto custa?',          time:'1h', unread:1, msgs:[
      { in:true,  text:'Boa tarde!', t:'09:10' },
      { in:false, text:'Boa tarde Carlos! Em que posso ajudar?', t:'09:11' },
      { in:true,  text:'Quanto custa?', t:'09:45' },
    ]},
    { id:3, name:'Mariana Faria', ch:'tg', preview:'Vou pensar e te aviso',  time:'5m', unread:0, msgs:[
      { in:false, text:'Aqui está o catálogo 👉 link.bio/cat', t:'11:00' },
      { in:true,  text:'Obrigada, já estou vendo!', t:'11:05' },
      { in:true,  text:'Vou pensar e te aviso', t:'11:12' },
    ]},
  ],

  // Controle interno
  activeConv: 0,
};
