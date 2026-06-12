// =====================================================================
// 4Flow — Catálogo de triggers e nós de ação do motor de automação
// =====================================================================
import {
  MessageCircle, Mail, MessageSquareText, GitBranch, Timer, CalendarClock,
  Tag, TagIcon, TrendingUp, ArrowRightLeft, UserCheck2, Webhook, Flag, Headset,
  FormInput, Gauge, Globe, Clock, Hand, type LucideIcon,
} from 'lucide-react';
import type { FlowNodeType, FlowTriggerType } from '../../types';

export const CATALOGO_TRIGGERS: { tipo: FlowTriggerType; rotulo: string; icone: LucideIcon; descricao: string }[] = [
  { tipo: 'form_submitted', rotulo: 'Formulário respondido', icone: FormInput, descricao: 'Dispara quando um formulário específico recebe resposta' },
  { tipo: 'tag_added', rotulo: 'Tag adicionada', icone: Tag, descricao: 'Dispara quando uma tag é adicionada ao contato' },
  { tipo: 'tag_removed', rotulo: 'Tag removida', icone: TagIcon, descricao: 'Dispara quando uma tag é removida' },
  { tipo: 'stage_changed', rotulo: 'Etapa alterada', icone: ArrowRightLeft, descricao: 'Dispara quando o lead muda de etapa no pipeline' },
  { tipo: 'score_reached', rotulo: 'Score atingido', icone: Gauge, descricao: 'Dispara quando o score atinge um valor' },
  { tipo: 'webhook_received', rotulo: 'Webhook recebido', icone: Globe, descricao: 'Dispara ao receber webhook externo' },
  { tipo: 'scheduled', rotulo: 'Agendado', icone: Clock, descricao: 'Roda em horário fixo ou intervalo' },
  { tipo: 'manual', rotulo: 'Manual', icone: Hand, descricao: 'Disparado manualmente num contato' },
];

export const CATALOGO_NOS: { tipo: FlowNodeType; rotulo: string; icone: LucideIcon; cor: string }[] = [
  { tipo: 'message_whatsapp', rotulo: 'Mensagem WhatsApp', icone: MessageCircle, cor: '#10b981' },
  { tipo: 'message_email', rotulo: 'Enviar e-mail', icone: Mail, cor: '#0082C6' },
  { tipo: 'message_sms', rotulo: 'Enviar SMS', icone: MessageSquareText, cor: '#7c3aed' },
  { tipo: 'condition', rotulo: 'Condição (if/else)', icone: GitBranch, cor: '#F8B90C' },
  { tipo: 'delay', rotulo: 'Aguardar', icone: Timer, cor: '#6b7280' },
  { tipo: 'delay_until', rotulo: 'Aguardar até', icone: CalendarClock, cor: '#6b7280' },
  { tipo: 'apply_tag', rotulo: 'Aplicar tag', icone: Tag, cor: '#006AB1' },
  { tipo: 'remove_tag', rotulo: 'Remover tag', icone: TagIcon, cor: '#03427D' },
  { tipo: 'set_score', rotulo: 'Alterar score', icone: TrendingUp, cor: '#0082C6' },
  { tipo: 'move_stage', rotulo: 'Mover etapa', icone: ArrowRightLeft, cor: '#006AB1' },
  { tipo: 'assign_closer', rotulo: 'Atribuir closer', icone: UserCheck2, cor: '#03427D' },
  { tipo: 'webhook_call', rotulo: 'Chamar webhook', icone: Webhook, cor: '#dc2626' },
  { tipo: 'human_handoff', rotulo: 'Transferir p/ humano', icone: Headset, cor: '#F8B90C' },
  { tipo: 'end', rotulo: 'Finalizar fluxo', icone: Flag, cor: '#011628' },
];

export function infoNo(tipo: FlowNodeType) {
  return CATALOGO_NOS.find((n) => n.tipo === tipo) ?? CATALOGO_NOS[0];
}

export function infoTrigger(tipo: FlowTriggerType) {
  return CATALOGO_TRIGGERS.find((t) => t.tipo === tipo) ?? CATALOGO_TRIGGERS[0];
}
