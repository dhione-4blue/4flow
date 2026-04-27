/* ============================================================
   4flow — Módulo de Disparos (campanhas em massa)
   ============================================================ */

const DISPARO_STATUS = {
  concluido: { badge: 'badge-green',  label: 'Concluído'   },
  enviando:  { badge: 'badge-accent', label: 'Enviando…'   },
  agendado:  { badge: 'badge-gold',   label: 'Agendado'    },
  rascunho:  { badge: 'badge-muted',  label: 'Rascunho'    },
};

const CANAL_ICONS = {
  'WhatsApp':  { cls: 'ch-wa', icon: '📱' },
  'Instagram': { cls: 'ch-ig', icon: '📸' },
  'Telegram':  { cls: 'ch-tg', icon: '✈'  },
  'Todos':     { cls: 'ch-wa', icon: '🌐' },
};

// Renderiza tabela de disparos
function renderDisparos() {
  document.getElementById('disparos-body').innerHTML = S.disparos.map(d => {
    const st  = DISPARO_STATUS[d.status] || DISPARO_STATUS.rascunho;
    const ch  = CANAL_ICONS[d.canal]     || CANAL_ICONS['WhatsApp'];
    const taxa = d.env > 0 ? Math.round(d.resp / d.env * 100) + '%' : '—';

    return `
      <tr>
        <td><div style="font-weight:700">${d.name}</div></td>
        <td><div class="ch ${ch.cls}">${ch.icon}</div></td>
        <td class="mono">${d.dest.toLocaleString('pt-BR')}</td>
        <td class="mono">${d.env.toLocaleString('pt-BR')}</td>
        <td class="mono">${taxa}</td>
        <td><span class="badge ${st.badge}">${st.label}</span></td>
        <td style="color:var(--muted2);font-size:12.5px">${d.data}</td>
        <td>
          <div style="display:flex;gap:5px">
            <button class="btn btn-ghost btn-sm" title="Ver detalhes">◎</button>
            <button class="btn btn-danger btn-sm" onclick="rmDisparo(${d.id})">✕</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// Criar disparo a partir do modal
function createDisparo() {
  const nome   = document.getElementById('d-name').value.trim();
  const canal  = document.getElementById('d-canal').value;
  const msg    = document.getElementById('d-msg').value.trim();

  if (!nome) { notify('Digite um nome para a campanha', 'orange'); return; }
  if (!msg)  { notify('Escreva a mensagem do disparo',  'orange'); return; }

  const disparo = {
    id:     Date.now(),
    name:   nome,
    canal,
    dest:   S.contacts.length,
    env:    0,
    resp:   0,
    status: 'enviando',
    data:   'Agora',
  };

  S.disparos.unshift(disparo);
  API.createDisparo({ ...disparo, mensagem: msg }).catch(() => {});

  closeM('m-disparo');
  renderDisparos();
  notify(`Disparo "${nome}" iniciado!`, 'green');
}

// Remover disparo
function rmDisparo(id) {
  S.disparos = S.disparos.filter(d => d.id !== id);
  renderDisparos();
  notify('Disparo removido', 'orange');
}
