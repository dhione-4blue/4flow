/* ============================================================
   4flow — Autenticação
   ============================================================ */

function doLogin() {
  const email = document.getElementById('l-email').value.trim();
  const pass  = document.getElementById('l-pass').value;
  const user  = USERS.find(u => u.email === email && u.pass === pass);

  if (!user) {
    document.getElementById('l-err').style.display = 'block';
    document.getElementById('l-pass').value = '';
    return;
  }

  // Limpar erro e salvar sessão
  document.getElementById('l-err').style.display = 'none';
  sessionStorage.setItem('4flow_user', JSON.stringify(user));

  // Atualizar UI
  _applySession(user);
}

function doLogout() {
  sessionStorage.removeItem('4flow_user');
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('l-email').value = '';
  document.getElementById('l-pass').value  = '';
}

// Aplicar sessão na UI
function _applySession(user) {
  document.getElementById('sb-av').textContent   = user.initials;
  document.getElementById('sb-name').textContent = user.name;
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display   = 'flex';
  renderNumbers(); // inicializa dados dependentes da sessão
}

// Verificar sessão ao carregar
function checkSession() {
  const raw = sessionStorage.getItem('4flow_user');
  if (raw) _applySession(JSON.parse(raw));
}

// Enter para login
function loginKeydown(e) {
  if (e.key === 'Enter') doLogin();
}
