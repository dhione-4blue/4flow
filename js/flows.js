/* ============================================================
   4flow — Módulo de Fluxos
   ============================================================ */

const FLOW_STATUS_MAP = {
  ativo:    'badge-green',
  pausado:  'badge-orange',
  rascunho: 'badge-muted',
};

// Renderiza os cards de fluxo
function renderFlows() {
  document.getElementById('flows-grid').innerHTML = S.flows.map(f => `
    <div class="flow-card">
      <div class="flow-card-hd">
        <div>
          <div class="flow-card-title">${f.name}</div>
          <div class="flow-card-trigger">${f.trigger}</div>
        </div>
        <span class="badge ${FLOW_STATUS_MAP[f.status] || 'badge-muted'}">${f.status}</span>
      </div>
      <div class="flow-steps-preview">
        ${f.steps.map(s => `<div class="flow-step-chip">${s}</div>`).join('')}
      </div>
      <div class="flow-card-ft">
        <span style="font-size:12px;color:var(--muted2)">
          <strong style="color:var(--text);font-size:14px" class="mono">${f.active}</strong> ativações
        </span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm">✎ Editar</button>
          <button class="btn btn-danger btn-sm" onclick="rmFlow(${f.id})">✕</button>
        </div>
      </div>
    </div>`).join('');

  const count = S.flows.filter(f => f.status === 'ativo').length;
  document.getElementById('flows-count').textContent = `${count} fluxo${count !== 1 ? 's' : ''} ativo${count !== 1 ? 's' : ''}`;
}

// Remover fluxo
function rmFlow(id) {
  S.flows = S.flows.filter(f => f.id !== id);
  renderFlows();
  notify('Fluxo removido', 'orange');
}

// Abrir modal de novo fluxo (resetar builder)
function openFlowModal() {
  fbReset();
  document.getElementById('fl-name').value = '';
  document.getElementById('fl-name').classList.remove('ff-err');
  document.getElementById('fl-name-err').style.display = 'none';
  document.getElementById('fl-trigger-val').value = '';
  updateTriggerHint();
  openM('m-fluxo');
}

// Atualizar label do valor do gatilho
function updateTriggerHint() {
  const t = document.getElementById('fl-trigger').value;
  const hints = {
    palavra_chave:   { label: 'Palavra-chave',     ph: 'Ex: OI, QUERO, INFO...' },
    tag_adicionada:  { label: 'Nome da tag',        ph: 'Ex: lead_quente'        },
    agendado:        { label: 'Horário de envio',   ph: 'Ex: 09:00'              },
    webhook:         { label: 'Endpoint / path',    ph: '/meu-endpoint'          },
  };
  const h = hints[t];
  const label = document.getElementById('fl-trigger-label');
  const input = document.getElementById('fl-trigger-val');
  label.textContent    = h ? h.label : 'Valor do Gatilho';
  input.placeholder    = h ? h.ph    : '—';
  input.disabled       = !h;
  input.style.opacity  = h ? 1 : 0.4;
}

// Criar fluxo
function createFlow() {
  const nameInput = document.getElementById('fl-name');
  const nameErr   = document.getElementById('fl-name-err');
  const name      = nameInput.value.trim();

  // Validar nome
  if (!name) {
    nameInput.classList.add('ff-err');
    nameErr.textContent = 'Digite um nome para o fluxo.';
    nameErr.style.display = 'block';
    nameInput.focus();
    return;
  }

  // Validar duplicata (case-insensitive)
  if (S.flows.some(f => f.name.trim().toLowerCase() === name.toLowerCase())) {
    nameInput.classList.add('ff-err');
    nameErr.textContent = 'Já existe um fluxo com esse nome. Escolha outro.';
    nameErr.style.display = 'block';
    nameInput.focus();
    return;
  }

  nameInput.classList.remove('ff-err');
  nameErr.style.display = 'none';

  const trigger    = document.getElementById('fl-trigger');
  const triggerVal = document.getElementById('fl-trigger-val').value.trim();
  const trigLabel  = trigger.options[trigger.selectedIndex].text + (triggerVal ? `: ${triggerVal}` : '');

  const flow = {
    id:      Date.now(),
    name,
    trigger: trigLabel,
    steps:   fbGetStepsPreview(),
    active:  0,
    status:  'ativo',
    json:    fbGetStepsJSON(),
  };

  S.flows.unshift(flow);
  API.createFlow(flow).catch(() => {});

  closeM('m-fluxo');
  renderFlows();
  notify(`Fluxo "${name}" criado!`, 'green');
}

// Validação em tempo real do nome
function validateFlowName() {
  const input = document.getElementById('fl-name');
  const err   = document.getElementById('fl-name-err');
  const v     = input.value.trim();
  if (v && S.flows.some(f => f.name.toLowerCase() === v.toLowerCase())) {
    input.classList.add('ff-err');
    err.textContent = 'Já existe um fluxo com esse nome.';
    err.style.display = 'block';
  } else {
    input.classList.remove('ff-err');
    err.style.display = 'none';
  }
}
