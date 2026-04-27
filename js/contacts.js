/* ============================================================
   4flow — Módulo de Contatos
   ============================================================ */

const AV_COLORS = ['#1998FF','#00E5A0','#F6BF00','#FF6B6B','#FF9A3C','#0072CE'];

// Renderiza a tabela de contatos, com filtro opcional
function renderContacts(filter = '') {
  const data = filter
    ? S.contacts.filter(c =>
        c.name.toLowerCase().includes(filter) ||
        c.phone.includes(filter) ||
        c.tags.some(t => t.includes(filter))
      )
    : S.contacts;

  document.getElementById('contacts-body').innerHTML = data.map((c, i) => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:9px">
          <div class="avatar" style="background:${AV_COLORS[i % AV_COLORS.length]}20;color:${AV_COLORS[i % AV_COLORS.length]}">
            ${c.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <div style="font-weight:700">${c.name}</div>
            <div style="font-size:12px;color:var(--muted2)">${c.ig || c.tg || '—'}</div>
          </div>
        </div>
      </td>
      <td><span class="mono" style="font-size:12.5px">${c.phone}</span></td>
      <td>
        <div style="display:flex;gap:4px">
          ${c.phone ? '<div class="ch ch-wa">📱</div>' : ''}
          ${c.ig    ? '<div class="ch ch-ig">📸</div>' : ''}
          ${c.tg    ? '<div class="ch ch-tg">✈</div>'  : ''}
        </div>
      </td>
      <td>${c.tags.map(t => `<span class="tag">${t}</span>`).join('')}</td>
      <td style="color:var(--muted2);font-size:12.5px">${c.last}</td>
      <td><span class="badge ${c.status === 'ativo' ? 'badge-green' : c.status === 'pausado' ? 'badge-orange' : 'badge-red'}">${c.status}</span></td>
      <td>
        <div style="display:flex;gap:5px">
          <button class="btn btn-ghost btn-sm" title="Conversar"
            onclick="go(document.querySelector('[data-view=conversas]'), 'conversas')">💬</button>
          <button class="btn btn-danger btn-sm" onclick="rmContact(${c.id})">✕</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Filtro em tempo real
function filterContacts(v) {
  renderContacts(v.toLowerCase());
}

// Adicionar contato (modal)
function addContact() {
  const name  = document.getElementById('c-name').value.trim();
  const phone = document.getElementById('c-phone').value.trim();

  if (!name || !phone) {
    notify('Preencha nome e número', 'orange');
    return;
  }

  const contact = {
    id:     Date.now(),
    name,
    phone,
    ig:     document.getElementById('c-ig').value,
    tg:     document.getElementById('c-tg').value,
    tags:   document.getElementById('c-tags').value.split(',').map(t => t.trim()).filter(Boolean),
    last:   'agora',
    status: 'ativo',
  };

  S.contacts.unshift(contact);

  // Tentar salvar no backend
  API.saveContact(contact).catch(() => {});

  closeM('m-contact');
  renderContacts();
  notify(`${name} adicionado!`, 'green');
}

// Remover contato
function rmContact(id) {
  S.contacts = S.contacts.filter(c => c.id !== id);
  renderContacts();
  notify('Contato removido', 'orange');
}
