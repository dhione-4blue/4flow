// =====================================================================
// 4Flow — Funções utilitárias compartilhadas
// =====================================================================
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Timestamp } from 'firebase/firestore';

/** Converte Timestamp do Firestore (ou null) em Date */
export function tsToDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof (ts as Timestamp).toDate === 'function') return (ts as Timestamp).toDate();
  return null;
}

/** Formata data no padrão brasileiro: 11/06/2026 14:30 */
export function fmtData(ts: Timestamp | Date | null | undefined, padrao = 'dd/MM/yyyy HH:mm'): string {
  if (!ts) return '—';
  const d = ts instanceof Date ? ts : tsToDate(ts);
  if (!d) return '—';
  return format(d, padrao, { locale: ptBR });
}

/** "há 3 horas", "há 2 dias" */
export function fmtRelativo(ts: Timestamp | Date | null | undefined): string {
  if (!ts) return '—';
  const d = ts instanceof Date ? ts : tsToDate(ts);
  if (!d) return '—';
  return formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
}

/** Formata telefone 5541999990000 → (41) 99999-0000 */
export function fmtTelefone(phone: string | null): string {
  if (!phone) return '—';
  const limpo = phone.replace(/\D/g, '');
  const semDdi = limpo.startsWith('55') && limpo.length > 11 ? limpo.slice(2) : limpo;
  if (semDdi.length === 11) return `(${semDdi.slice(0, 2)}) ${semDdi.slice(2, 7)}-${semDdi.slice(7)}`;
  if (semDdi.length === 10) return `(${semDdi.slice(0, 2)}) ${semDdi.slice(2, 6)}-${semDdi.slice(6)}`;
  return phone;
}

/** Normaliza telefone para o formato canônico 5511999990000 */
export function normalizarTelefone(phone: string): string {
  let limpo = phone.replace(/\D/g, '');
  if (limpo.length === 10 || limpo.length === 11) limpo = '55' + limpo;
  return limpo;
}

/** Formata valor em reais */
export function fmtReais(valor: number | null | undefined): string {
  if (valor == null) return '—';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Iniciais para avatar: "Renan Kaminski" → "RK" */
export function iniciais(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

/** Cor do score: 0-30 vermelho, 31-69 amarelo, 70-100 verde */
export function corScore(score: number): string {
  if (score <= 30) return '#ef4444';
  if (score <= 69) return '#F8B90C';
  return '#10b981';
}

/** Valida CPF (dígitos verificadores) */
export function validarCpf(cpf: string): boolean {
  const s = cpf.replace(/\D/g, '');
  if (s.length !== 11 || /^(\d)\1{10}$/.test(s)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(s[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(s[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(s[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return resto === parseInt(s[10]);
}

/** Gera ID aleatório curto */
export function gerarId(prefixo = ''): string {
  return prefixo + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** Substitui variáveis {{nome}}, {{email}}, {{telefone}} num texto */
export function substituirVariaveis(texto: string, contato: { name?: string; email?: string | null; phone?: string | null }): string {
  return texto
    .replace(/\{\{\s*nome\s*\}\}/gi, contato.name ?? '')
    .replace(/\{\{\s*email\s*\}\}/gi, contato.email ?? '')
    .replace(/\{\{\s*telefone\s*\}\}/gi, contato.phone ?? '');
}

/** Exporta array de objetos como arquivo CSV baixado pelo navegador */
export function exportarCsv(nomeArquivo: string, linhas: Record<string, unknown>[]): void {
  if (linhas.length === 0) return;
  const colunas = Object.keys(linhas[0]);
  const escapar = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [colunas.join(';'), ...linhas.map((l) => colunas.map((c) => escapar(l[c])).join(';'))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}
