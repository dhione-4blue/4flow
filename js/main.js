/* ============================================================
   4flow — Inicialização e Helpers globais
   Este arquivo é carregado por último
   ============================================================ */

// ── Modais ────────────────────────────────────────────────────────

function openM(id) {
  document.getElementById(id)?.classList.add('open');
}
function closeM(id) {
  document.getElementById(id)?.classList.remove('open');
}

// Fechar modal clicando no overlay
document.querySelectorAll('.modal-bg').forEach(m => {
  m.addEventListener('click', e => {
    if (e.target === m) m.classList.remove('open');
  });
});

// Fechar modal com ESC
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-bg.open').forEach(m => m.classList.remove('open'));
  }
});

// ── Bootstrap ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // Verificar sessão existente
  checkSession();

  // Renderizar contatos na carga inicial
  renderContacts();

  // Validação em tempo real do nome do fluxo
  document.getElementById('fl-name')?.addEventListener('input', validateFlowName);

  // Atualizar hint do gatilho ao trocar
  document.getElementById('fl-trigger')?.addEventListener('change', updateTriggerHint);

  // Enter nos campos de login
  document.getElementById('l-email')?.addEventListener('keydown', loginKeydown);
  document.getElementById('l-pass') ?.addEventListener('keydown', loginKeydown);

  // Enter no chat
  document.getElementById('conv-input')?.addEventListener('keydown', convKeydown);

  // Carregar URL da API salva
  loadSavedApiUrl();
});
