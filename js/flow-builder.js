/* ============================================================
   4flow — Flow Builder (motor do editor de passos)
   Responsável por criar, editar e renderizar cada passo do fluxo
   ============================================================ */

let _stepCounter = 0;
let _flowSteps   = [];  // [{id, tipo, conteudo, botoes, replies, formFields, ...}]

// ── Inicialização ──────────────────────────────────────────────────
function fbReset() {
  _stepCounter = 0;
  _flowSteps   = [];
  document.getElementById('fb-steps').innerHTML = '';
  fbAddStep(); // começa com um passo
}

// ── Adicionar passo ────────────────────────────────────────────────
function fbAddStep() {
  _stepCounter++;
  const id = _stepCounter;
  const step = {
    id,
    tipo:       'mensagem',
    conteudo:   '',
    botoes:     [],
    replies:    [],
    formFields: [],
    waitNum:    5,
    waitUnit:   'minutos',
    tag:        '',
    acAction:   'sync',
    acValue:    '',
  };
  _flowSteps.push(step);

  const div = document.createElement('div');
  div.className = 'fb-step';
  div.id = 'fb-step-' + id;
  div.innerHTML = _buildStepHeader(step);
  document.getElementById('fb-steps').appendChild(div);
  fbToggle(id); // abre automaticamente
}

// ── Montar HTML do cabeçalho do passo ──────────────────────────────
function _buildStepHeader(step) {
  const types = [
    { v: 'mensagem',         label: '💬 Enviar Mensagem'        },
    { v: 'aguardar',         label: '⏱ Aguardar Tempo'          },
    { v: 'aguardar_resposta',label: '⏳ Aguardar Resposta'       },
    { v: 'add_tag',          label: '🏷 Adicionar Tag'           },
    { v: 'condicao',         label: '🔀 Condição (if/else)'      },
    { v: 'active_campaign',  label: '⚙ Sync ActiveCampaign'    },
    { v: 'encerrar',         label: '🛑 Encerrar Fluxo'          },
  ];
  const opts = types.map(t =>
    `<option value="${t.v}" ${step.tipo === t.v ? 'selected' : ''}>${t.label}</option>`
  ).join('');

  return `
    <div class="fb-step-hd" onclick="fbToggle(${step.id})">
      <div class="fb-step-num">${step.id}</div>
      <select id="fb-type-${step.id}" class="fb-step-type"
        onclick="event.stopPropagation()"
        onchange="fbChangeType(${step.id})">${opts}</select>
      <div class="fb-step-controls">
        <button class="fb-remove-step" title="Remover passo"
          onclick="event.stopPropagation(); fbRemoveStep(${step.id})">✕</button>
        <span class="fb-chevron" id="fb-chev-${step.id}">▾</span>
      </div>
    </div>
    <div class="fb-step-body" id="fb-body-${step.id}"></div>`;
}

// ── Abrir/fechar passo ─────────────────────────────────────────────
function fbToggle(id) {
  const body = document.getElementById('fb-body-' + id);
  const chev = document.getElementById('fb-chev-' + id);
  if (!body) return;
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  chev.classList.toggle('open', !isOpen);
  if (!isOpen) fbRenderBody(id);
}

// ── Trocar tipo do passo ───────────────────────────────────────────
function fbChangeType(id) {
  const step = _getStep(id);
  if (step) step.tipo = document.getElementById('fb-type-' + id).value;
  fbRenderBody(id);
}

// ── Renderizar corpo do passo (muda por tipo) ──────────────────────
function fbRenderBody(id) {
  const step = _getStep(id);
  if (!step) return;
  const body = document.getElementById('fb-body-' + id);
  body.innerHTML = `<div style="padding:12px 14px 16px">${_bodyHTML(step)}</div>`;
}

function _bodyHTML(step) {
  switch (step.tipo) {

    case 'mensagem': return `
      <div class="fb-section-label">Mensagem</div>
      <textarea class="fb-msg-area" id="fb-msg-${step.id}"
        placeholder="Escreva a mensagem que será enviada..."
        onchange="_getStep(${step.id}).conteudo = this.value"
      >${step.conteudo}</textarea>

      <div class="fb-section-label">Inserir Variável (clique para inserir)</div>
      <div class="fb-vars">
        ${['{{nome}}','{{nome_completo}}','{{telefone}}','{{instagram}}','{{telegram}}','{{tags}}']
          .map(v => `<span class="fb-var" onclick="fbInsertVar(${step.id},'${v}')">${v}</span>`).join('')}
      </div>

      <div class="fb-toolbar">
        <button class="fb-tool-btn" onclick="fbAddButton(${step.id})">🔘 + Botão com Link</button>
        <button class="fb-tool-btn" onclick="fbAddReply(${step.id})">💬 + Quick Reply</button>
        <button class="fb-tool-btn" onclick="fbAddFormField(${step.id})">📋 + Campo de Formulário</button>
      </div>

      <div id="fb-btns-${step.id}"   class="fb-buttons-list">${_renderButtons(step)}</div>
      <div id="fb-replies-${step.id}" class="fb-replies-list">${_renderReplies(step)}</div>
      <div id="fb-form-${step.id}"   class="fb-form-fields">${_renderFormFields(step)}</div>`;

    case 'aguardar': return `
      <div class="fb-section-label">Tempo de espera</div>
      <div class="fb-wait-row">
        <input type="number" min="1" value="${step.waitNum}"
          onchange="_getStep(${step.id}).waitNum = this.value" placeholder="5">
        <select onchange="_getStep(${step.id}).waitUnit = this.value">
          ${['segundos','minutos','horas','dias'].map(u =>
            `<option value="${u}" ${step.waitUnit===u?'selected':''}>${u.charAt(0).toUpperCase()+u.slice(1)}</option>`
          ).join('')}
        </select>
      </div>`;

    case 'aguardar_resposta': return `
      <div class="fb-section-label">Timeout (sem resposta do contato)</div>
      <div class="fb-wait-row">
        <input type="number" min="1" value="30" placeholder="30">
        <select><option>Minutos</option><option>Horas</option></select>
      </div>
      <div style="margin-top:10px;font-size:12px;color:var(--muted2);margin-bottom:6px">Se não responder no prazo:</div>
      <select style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:8px 12px;color:var(--text);font-size:13px;font-family:var(--font-sans);outline:none;width:100%">
        <option>Continuar para o próximo passo</option>
        <option>Encerrar o fluxo</option>
        <option>Reenviar a última mensagem</option>
      </select>`;

    case 'add_tag': return `
      <div class="fb-section-label">Nome da tag</div>
      <input class="fb-tag-input" type="text" value="${step.tag}"
        placeholder="Ex: lead_quente, vip, interessado..."
        onchange="_getStep(${step.id}).tag = this.value">
      <div style="font-size:12px;color:var(--muted2);margin-top:8px">
        A tag é adicionada ao contato e pode disparar outros fluxos ou sincronizar com o ActiveCampaign.
      </div>`;

    case 'condicao': return `
      <div class="fb-cond-box">
        <div class="fb-cond-label">SE (condição)</div>
        <div class="fb-cond-row">
          <select>
            <option>Tags</option><option>Canal</option>
            <option>Último contato</option><option>Resposta contém</option>
          </select>
          <select><option>contém</option><option>não contém</option><option>é igual a</option></select>
          <input type="text" placeholder="valor...">
        </div>
      </div>
      <div class="fb-cond-then">
        <div class="fb-cond-box">
          <div class="fb-cond-label" style="color:var(--green)">✓ ENTÃO (verdadeiro)</div>
          <select style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:7px;color:var(--text);font-size:12px;font-family:var(--font-sans);outline:none">
            <option>Próximo passo</option><option>Pular 2 passos</option><option>Encerrar fluxo</option>
          </select>
        </div>
        <div class="fb-cond-box">
          <div class="fb-cond-label" style="color:var(--red)">✗ SENÃO (falso)</div>
          <select style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:7px;color:var(--text);font-size:12px;font-family:var(--font-sans);outline:none">
            <option>Próximo passo</option><option>Pular 2 passos</option><option>Encerrar fluxo</option>
          </select>
        </div>
      </div>`;

    case 'active_campaign': return `
      <div class="fb-section-label">Ação no ActiveCampaign</div>
      <select style="width:100%;background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:9px 12px;color:var(--text);font-size:13px;font-family:var(--font-sans);outline:none;margin-bottom:10px"
        onchange="_getStep(${step.id}).acAction = this.value">
        <option value="sync">Criar / Atualizar contato</option>
        <option value="tag">Adicionar tag</option>
        <option value="list">Adicionar à lista</option>
        <option value="automation">Disparar automação AC</option>
      </select>
      <input class="fb-tag-input" type="text" value="${step.acValue}"
        placeholder="Nome da tag, lista ou automação no AC"
        onchange="_getStep(${step.id}).acValue = this.value">`;

    case 'encerrar': return `
      <div class="fb-end-box">
        🛑 O fluxo será encerrado aqui. O contato poderá ser reiniciado por um novo gatilho.
      </div>`;

    default: return '<div style="color:var(--muted2);font-size:13px">Tipo desconhecido</div>';
  }
}

// ── Inserir variável na textarea ────────────────────────────────────
function fbInsertVar(id, v) {
  const ta = document.getElementById('fb-msg-' + id);
  if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  ta.value = ta.value.slice(0, s) + v + ta.value.slice(e);
  ta.selectionStart = ta.selectionEnd = s + v.length;
  ta.focus();
  const step = _getStep(id);
  if (step) step.conteudo = ta.value;
}

// ── Botões CTA ──────────────────────────────────────────────────────
function fbAddButton(id) {
  const step = _getStep(id);
  if (!step) return;
  step.botoes.push({ texto: '', tipo: 'link', valor: '' });
  document.getElementById('fb-btns-' + id).innerHTML = _renderButtons(step);
}
function _renderButtons(step) {
  return (step.botoes || []).map((b, i) => `
    <div class="fb-btn-row">
      <input type="text" placeholder="Texto do botão" value="${b.texto}"
        onchange="_getStep(${step.id}).botoes[${i}].texto = this.value">
      <div class="fb-divider"></div>
      <select onchange="_getStep(${step.id}).botoes[${i}].tipo = this.value">
        <option value="link"  ${b.tipo==='link' ?'selected':''}>🔗 Link URL</option>
        <option value="reply" ${b.tipo==='reply'?'selected':''}>💬 Quick Reply</option>
        <option value="phone" ${b.tipo==='phone'?'selected':''}>📞 Ligar</option>
      </select>
      <div class="fb-divider"></div>
      <input type="text" value="${b.valor || ''}"
        placeholder="${b.tipo==='link'?'https://...':b.tipo==='phone'?'+55 11 9...':'Palavra-chave'}"
        onchange="_getStep(${step.id}).botoes[${i}].valor = this.value">
      <button class="fb-remove-step" onclick="fbRemoveButton(${step.id},${i})">✕</button>
    </div>`).join('');
}
function fbRemoveButton(id, i) {
  const step = _getStep(id);
  if (step) { step.botoes.splice(i, 1); document.getElementById('fb-btns-' + id).innerHTML = _renderButtons(step); }
}

// ── Quick Replies ────────────────────────────────────────────────────
function fbAddReply(id) {
  const step = _getStep(id);
  if (!step) return;
  step.replies.push('');
  document.getElementById('fb-replies-' + id).innerHTML = _renderReplies(step);
}
function _renderReplies(step) {
  return (step.replies || []).map((r, i) => `
    <div class="fb-reply-chip">
      <input type="text" value="${r}" placeholder="Texto da resposta rápida"
        onchange="_getStep(${step.id}).replies[${i}] = this.value">
      <button class="fb-reply-remove" onclick="fbRemoveReply(${step.id},${i})">✕</button>
    </div>`).join('');
}
function fbRemoveReply(id, i) {
  const step = _getStep(id);
  if (step) { step.replies.splice(i, 1); document.getElementById('fb-replies-' + id).innerHTML = _renderReplies(step); }
}

// ── Campos de formulário ─────────────────────────────────────────────
function fbAddFormField(id) {
  const step = _getStep(id);
  if (!step) return;
  step.formFields.push({ label: '', type: 'texto', required: false });
  document.getElementById('fb-form-' + id).innerHTML = _renderFormFields(step);
}
function _renderFormFields(step) {
  return (step.formFields || []).map((f, i) => `
    <div class="fb-form-row">
      <input type="text" value="${f.label}" placeholder="Pergunta / Label do campo"
        onchange="_getStep(${step.id}).formFields[${i}].label = this.value">
      <select onchange="_getStep(${step.id}).formFields[${i}].type = this.value">
        <option value="texto"    ${f.type==='texto'   ?'selected':''}>Texto</option>
        <option value="numero"   ${f.type==='numero'  ?'selected':''}>Número</option>
        <option value="email"    ${f.type==='email'   ?'selected':''}>E-mail</option>
        <option value="telefone" ${f.type==='telefone'?'selected':''}>Telefone</option>
        <option value="opcoes"   ${f.type==='opcoes'  ?'selected':''}>Múltipla Escolha</option>
      </select>
      <span class="badge ${f.required ? 'badge-gold' : 'badge-muted'}" style="cursor:pointer"
        onclick="fbToggleRequired(${step.id},${i})">${f.required ? 'Obrig.' : 'Opc.'}</span>
      <button class="fb-remove-step" onclick="fbRemoveFormField(${step.id},${i})">✕</button>
    </div>`).join('');
}
function fbToggleRequired(id, i) {
  const step = _getStep(id);
  if (step && step.formFields[i]) {
    step.formFields[i].required = !step.formFields[i].required;
    document.getElementById('fb-form-' + id).innerHTML = _renderFormFields(step);
  }
}
function fbRemoveFormField(id, i) {
  const step = _getStep(id);
  if (step) { step.formFields.splice(i, 1); document.getElementById('fb-form-' + id).innerHTML = _renderFormFields(step); }
}

// ── Remover passo ────────────────────────────────────────────────────
function fbRemoveStep(id) {
  _flowSteps = _flowSteps.filter(s => s.id !== id);
  document.getElementById('fb-step-' + id)?.remove();
}

// ── Exportar passos como resumo ──────────────────────────────────────
function fbGetStepsPreview() {
  const icons = { mensagem:'💬', aguardar:'⏱', aguardar_resposta:'⏳', add_tag:'🏷', condicao:'🔀', active_campaign:'⚙', encerrar:'🛑' };
  return _flowSteps.map(s => (icons[s.tipo] || '•') + ' ' + s.tipo.replace(/_/g, ' '));
}

// ── Exportar passos como JSON (para salvar no Sheets) ────────────────
function fbGetStepsJSON() {
  return JSON.stringify(_flowSteps);
}

// ── Helper interno ────────────────────────────────────────────────────
function _getStep(id) {
  return _flowSteps.find(s => s.id === id);
}
