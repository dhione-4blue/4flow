/* ============================================================
   4flow — Notificações toast
   ============================================================ */

function notify(text, color = 'green') {
  const notif = document.getElementById('notif');
  const dot   = document.getElementById('notif-dot');
  const colors = {
    green:  'var(--green)',
    orange: 'var(--orange)',
    red:    'var(--red)',
    accent: 'var(--accent)',
    gold:   'var(--gold)',
  };
  dot.style.background = colors[color] || colors.green;
  document.getElementById('notif-txt').textContent = text;
  notif.classList.add('show');
  clearTimeout(notif._timer);
  notif._timer = setTimeout(() => notif.classList.remove('show'), 3200);
}


/* ============================================================
   4flow — Roteador de views
   ============================================================ */

function go(el, viewId) {
  // Desativar todas as views e itens do menu
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));

  // Ativar view e item selecionado
  document.getElementById('v-' + viewId).classList.add('active');
  el.classList.add('active');

  // Renderizar conteúdo da view ao entrar
  const renderers = {
    contatos:    renderContacts,
    disparos:    renderDisparos,
    fluxos:      renderFlows,
    conversas:   renderConversations,
    config:      renderNumbers,
  };
  renderers[viewId]?.();
}
