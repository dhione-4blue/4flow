/* ============================================================
   4flow — Módulo de Configurações
   Números de envio, integrações e chaves de API
   ============================================================ */

// ── Números de Envio ───────────────────────────────────────────────

function renderNumbers() {
  document.getElementById('num-list').innerHTML = S.numbers.map((n, i) => `
    <div class="num-row">
      <div style="display:flex;align-items:center;gap:9px">
        <div class="ch ch-wa">📱</div>
        <div>
          <div class="mono" style="font-size:13px;font-weight:600">${n.phone}</div>
          <div style="font-size:11.5px;color:var(--muted2)">${n.label} · ID: ${n.metaId.slice(0,8)}…</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="badge badge-green">Ativo</span>
        <button class="btn btn-danger btn-sm" onclick="rmNumber(${i})">✕</button>
      </div>
    </div>`).join('');
}

function addNumber() {
  const phone  = document.getElementById('num-phone').value.trim();
  const label  = document.getElementById('num-label').value.trim();
  const metaId = document.getElementById('num-meta-id').value.trim();

  if (!phone || !metaId) {
    notify('Preencha o número e o ID da Meta', 'orange');
    return;
  }

  S.numbers.push({ phone, label: label || `Número ${S.numbers.length + 1}`, metaId });
  closeM('m-number');
  renderNumbers();
  notify('Número adicionado!', 'green');
}

function rmNumber(i) {
  S.numbers.splice(i, 1);
  renderNumbers();
  notify('Número removido', 'orange');
}

// ── Integrações ────────────────────────────────────────────────────

function saveIntegration(name) {
  notify(`${name} salvo com sucesso!`, 'green');
  // Em produção: API.saveSettings({ [name]: { ...campos } })
}

// ── Apps Script URL ────────────────────────────────────────────────

function saveApiUrl() {
  const url = document.getElementById('api-url-input').value.trim();
  if (!url) { notify('Cole a URL do Apps Script', 'orange'); return; }
  API.saveUrl(url);
}

function testApiConnection() {
  const url = document.getElementById('api-url-input').value.trim();
  if (!url) { notify('Cole a URL do Apps Script primeiro', 'orange'); return; }
  localStorage.setItem('4flow_api_url', url);
  notify('Testando conexão…', 'accent');
  setTimeout(() => API.ping(), 800);
}

// Carregar URL salva no input ao exibir a view
function loadSavedApiUrl() {
  const input = document.getElementById('api-url-input');
  if (input) input.value = localStorage.getItem('4flow_api_url') || '';
}
