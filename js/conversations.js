/* ============================================================
   4flow — Módulo de Conversas (inbox)
   ============================================================ */

const CH_MAP = {
  wa: { cls: 'ch-wa', icon: '📱', label: '📱 WhatsApp'  },
  ig: { cls: 'ch-ig', icon: '📸', label: '📸 Instagram' },
  tg: { cls: 'ch-tg', icon: '✈',  label: '✈ Telegram'   },
};

// Renderiza a lista + abre a primeira conversa
function renderConversations() {
  document.getElementById('conv-list').innerHTML = S.convs.map((c, i) => {
    const ch = CH_MAP[c.ch] || CH_MAP.wa;
    return `
      <div class="conv-item ${i === S.activeConv ? 'active' : ''}" onclick="openConv(${i})">
        <div class="conv-item-hd">
          <div style="display:flex;align-items:center;gap:6px">
            <div class="ch ${ch.cls}" style="width:18px;height:18px;font-size:11px">${ch.icon}</div>
            <div class="conv-item-name">${c.name}</div>
          </div>
          <div style="display:flex;align-items:center;gap:5px">
            <div class="conv-item-time">${c.time}</div>
            ${c.unread ? `<div class="conv-unread">${c.unread}</div>` : ''}
          </div>
        </div>
        <div class="conv-item-preview">${c.preview}</div>
      </div>`;
  }).join('');

  openConv(S.activeConv);
}

// Abrir conversa específica
function openConv(i) {
  S.activeConv    = i;
  const c         = S.convs[i];
  c.unread        = 0;
  const ch        = CH_MAP[c.ch] || CH_MAP.wa;

  // Topbar
  document.getElementById('conv-topbar').innerHTML = `
    <div class="avatar" style="background:var(--accent-bg);color:var(--accent)">
      ${c.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
    </div>
    <div>
      <div style="font-weight:800;font-size:14px">${c.name}</div>
      <div style="font-size:12px;color:var(--muted2)">${ch.label}</div>
    </div>
    <div style="margin-left:auto;display:flex;gap:7px">
      <button class="btn btn-ghost btn-sm">Perfil</button>
      <button class="btn btn-ghost btn-sm">Fluxos</button>
    </div>`;

  // Mensagens
  document.getElementById('conv-msgs').innerHTML = c.msgs.map(m => `
    <div>
      <div class="msg ${m.in ? 'msg-in' : 'msg-out'}">${m.text}</div>
      <div class="msg-time" style="${m.in ? '' : 'text-align:right'}">${m.t}</div>
    </div>`).join('');

  document.getElementById('conv-msgs').scrollTop = 99999;

  // Marcar ativo na lista
  document.querySelectorAll('.conv-item').forEach((el, idx) =>
    el.classList.toggle('active', idx === i)
  );
}

// Enviar mensagem
function sendMsg() {
  const inp  = document.getElementById('conv-input');
  const text = inp.value.trim();
  if (!text) return;

  const c   = S.convs[S.activeConv];
  const now = new Date();
  const t   = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

  c.msgs.push({ in: false, text, t });
  c.preview = text;
  inp.value = '';

  // Enviar via API
  API.sendMessage(c.id, c.ch, text).catch(() => {});

  renderConversations();
  notify(`Enviado via ${CH_MAP[c.ch]?.label || c.ch}`, 'green');
}

// Enviar com Enter
function convKeydown(e) {
  if (e.key === 'Enter') sendMsg();
}
