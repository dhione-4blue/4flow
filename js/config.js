/* ============================================================
   4flow — Configurações do App
   Edite aqui usuários e URL da API
   ============================================================ */

// Usuários com acesso ao painel
// Para produção: mova autenticação para o Apps Script
const USERS = [
  { email: 'equipemkt@4blue.com.br', pass: '4flow2026', name: 'Admin', initials: 'AD' },
  // { email: 'outro@email.com', pass: 'outrasenha', name: 'Colaborador', initials: 'CO' },
];

// URL do Google Apps Script Web App
// Cole aqui após publicar o backend
let API_URL = localStorage.getItem('https://script.google.com/macros/s/AKfycbxJ4slb2VIwFriZyQyvJIxd4JattZkIAGpS0hhHn_LLHyqUWrIzyrwnOkYQG8lU0fZ0/exec') || '';

// Configurações gerais
const APP_CONFIG = {
  name:             '4flow',
  version:          '1.0.0',
  defaultSendDelay: 3,      // segundos entre msgs nos disparos
  maxMsgPerHour:    100,
};
