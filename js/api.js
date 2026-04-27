/* ============================================================
   4flow — API Client
   Comunicação com o Google Apps Script (backend)
   ============================================================ */

const API = {

  // URL base — lida do localStorage (configurada em Configurações)
  get url() {
    return localStorage.getItem('4flow_api_url') || '';
  },

  // GET — busca dados
  async get(action, params = {}) {
    if (!this.url) { notify('Configure a URL do Apps Script em Configurações', 'orange'); return null; }
    const qs = new URLSearchParams({ action, ...params }).toString();
    try {
      const res = await fetch(`${this.url}?${qs}`);
      return await res.json();
    } catch (err) {
      console.error('[4flow API GET]', err);
      notify('Erro ao conectar com o backend', 'red');
      return null;
    }
  },

  // POST — envia dados
  async post(action, body = {}) {
    if (!this.url) { notify('Configure a URL do Apps Script em Configurações', 'orange'); return null; }
    try {
      const res = await fetch(`${this.url}?action=${action}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      return await res.json();
    } catch (err) {
      console.error('[4flow API POST]', err);
      notify('Erro ao enviar para o backend', 'red');
      return null;
    }
  },

  // Testar conexão
  async ping() {
    const res = await this.get('ping');
    if (res?.status === 'ok') {
      notify('Conexão estabelecida com sucesso! ✓', 'green');
      return true;
    }
    notify('Não foi possível conectar. Verifique a URL.', 'red');
    return false;
  },

  // ── Métodos específicos ──────────────────────────────────

  async loadContacts()    { return this.get('getContacts'); },
  async loadDisparos()    { return this.get('getDisparos'); },
  async loadFlows()       { return this.get('getFluxos'); },
  async loadNumbers()     { return this.get('getNumeros'); },
  async loadStats()       { return this.get('getStats'); },

  async saveContact(data) { return this.post('addContact', data); },
  async deleteContact(id) { return this.post('deleteContact', { id }); },

  async createDisparo(data)   { return this.post('createDisparo', data); },
  async fireDisparo(id)       { return this.post('executarDisparo', { id }); },

  async createFlow(data)  { return this.post('createFluxo', data); },
  async deleteFlow(id)    { return this.post('deleteFluxo', { id }); },

  async sendMessage(canalId, canal, text) {
    return this.post('sendMessage', { canalId, canal, text });
  },

  async saveSettings(settings) {
    return this.post('saveSettings', settings);
  },

  // Salvar URL da API no localStorage
  saveUrl(url) {
    localStorage.setItem('4flow_api_url', url);
    notify('URL salva!', 'green');
  },
};
