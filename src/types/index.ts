// =====================================================================
// 4Flow — Tipos e interfaces do modelo de dados (Firestore)
// =====================================================================
import type { Timestamp } from 'firebase/firestore';

// ---------- Usuários ----------
export type UserRole = 'admin' | 'operador' | 'closer' | 'viewer';

export interface User {
  id: string;  // id do documento Firestore (igual ao uid)
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: Timestamp;
  createdBy: string;
  lastLoginAt: Timestamp | null;
  avatar: string | null;
  mustChangePassword?: boolean; // troca obrigatória no primeiro acesso
}

// ---------- Contatos ----------
export interface FormResponseField {
  fieldId: string;
  label: string;
  value: string | string[] | number;
  type: 'text' | 'choice' | 'scale' | 'audio' | 'photo' | 'video';
  mediaUrl?: string;
}

export interface FormResponse {
  formId: string;
  formName: string;
  answeredAt: Timestamp;
  fields: FormResponseField[];
}

export interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null; // formato: 5511999990000
  source: string;
  sourceDetail: string | null;
  tags: string[];
  score: number; // 0-100
  segment: string | null;
  assignedTo: string | null;
  pipelineStage: string | null;
  pipelineId: string | null;
  dealValue: number | null;
  status: 'active' | 'archived' | 'blocked';
  formResponses: FormResponse[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  importBatchId: string | null;
  stageEnteredAt?: Timestamp | null; // para cálculo de SLA no kanban
}

// ---------- Formulários ----------
export type FormFieldType =
  | 'text' | 'email' | 'phone' | 'number' | 'textarea'
  | 'choice_single' | 'choice_multiple' | 'scale' | 'nps'
  | 'audio_upload' | 'audio_record' | 'photo_upload'
  | 'video_embed' | 'video_upload' | 'date' | 'cpf'
  | 'statement' | 'divider';

export interface ConditionalLogic {
  conditions: {
    fieldId: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
    value: string;
  }[];
  action: 'show' | 'hide' | 'jump_to';
  targetFieldId?: string;
}

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder: string | null;
  required: boolean;
  options: string[] | null;
  scaleMin: number | null;
  scaleMax: number | null;
  scaleLabels: { min: string; max: string } | null;
  videoUrl: string | null;
  mediaMaxSizeMb: number | null;
  logic: ConditionalLogic | null;
  order: number;
}

export interface FormSettings {
  redirectUrl: string | null;
  webhookUrl: string | null;
  thankYouMessage: string;
  progressBar: boolean;
  allowMultipleSubmissions: boolean;
  primaryColor: string;
  logoUrl: string | null;
  backgroundType: 'color' | 'image';
  backgroundColor: string;
  backgroundImageUrl: string | null;
}

export interface Form {
  id: string;
  name: string;
  description: string | null;
  mode: 'classic' | 'conversational';
  status: 'draft' | 'published' | 'archived';
  fields: FormField[];
  settings: FormSettings;
  embedCode: string;
  responses: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ---------- Fluxos / Automações ----------
export type FlowTriggerType =
  | 'form_submitted' | 'tag_added' | 'tag_removed' | 'stage_changed'
  | 'webhook_received' | 'score_reached' | 'scheduled' | 'manual';

export interface FlowTrigger {
  type: FlowTriggerType;
  config: Record<string, unknown>;
}

export type FlowNodeType =
  | 'message_whatsapp' | 'message_email' | 'message_sms'
  | 'condition' | 'delay' | 'delay_until' | 'apply_tag' | 'remove_tag'
  | 'set_score' | 'move_stage' | 'assign_closer'
  | 'webhook_call' | 'end' | 'human_handoff';

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface Flow {
  id: string;
  name: string;
  description: string | null;
  trigger: FlowTrigger;
  nodes: FlowNode[];
  edges: FlowEdge[];
  status: 'draft' | 'active' | 'paused';
  stats: { triggered: number; completed: number; dropped: number };
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ---------- Conversas / Inbox ----------
export interface ConversationNote {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: Timestamp;
}

export interface Conversation {
  id: string;
  contactId: string;
  contactName?: string;
  channel: 'whatsapp' | 'email' | 'instagram' | 'internal';
  instanceId: string | null;
  waId: string | null;
  status: 'open' | 'pending' | 'resolved' | 'bot';
  assignedTo: string | null;
  queueId: string | null;
  unreadCount: number;
  lastMessageAt: Timestamp | null;
  lastMessagePreview: string | null;
  slaDeadline: Timestamp | null;
  labels: string[];
  notes: ConversationNote[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Message {
  id: string;
  fromContact: boolean;
  authorId: string | null;
  authorName: string | null;
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'template' | 'note';
  content: string;
  mediaUrl: string | null;
  mediaCaption: string | null;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  waMessageId: string | null;
  sentAt: Timestamp;
  isAutomated: boolean;
  flowId: string | null;
}

// ---------- Pipelines / CRM ----------
export interface PipelineStage {
  id: string;
  name: string;
  order: number;
  color: string;
  automationOnEnter: string | null;
  slaHours: number | null;
}

export interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
  isDefault: boolean;
  createdBy: string;
  createdAt: Timestamp;
}

// ---------- Auditoria ----------
export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  resourceName: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  timestamp: Timestamp;
}

// ---------- Importação CSV ----------
export interface ImportBatch {
  id: string;
  fileName: string;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string }[];
  status: 'processing' | 'completed' | 'failed';
  columnMapping: Record<string, string>;
  duplicateStrategy: 'update' | 'skip' | 'duplicate';
  importedBy: string;
  createdAt: Timestamp;
  completedAt: Timestamp | null;
}

// ---------- Webhooks ----------
export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  lastTriggeredAt: Timestamp | null;
  successCount: number;
  failureCount: number;
  createdBy: string;
  createdAt: Timestamp;
}

export interface InboundWebhook {
  id: string;
  name: string;
  key: string; // chave única do endpoint /webhook/in/{key}
  source: 'hotmart' | 'meta_lead_ads' | 'activecampaign' | 'generic';
  fieldMapping: Record<string, string>;
  defaultTags: string[];
  active: boolean;
  receivedCount: number;
  createdAt: Timestamp;
}

// ---------- WhatsApp ----------
export interface WhatsAppInstance {
  id: string;
  name: string;
  displayName: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'banned';
  phone: string | null;
  defaultQueueId: string | null;
  inboundWebhookActive: boolean;
  createdAt: Timestamp;
}

export interface MessageResult {
  success: boolean;
  messageId: string | null;
  error?: string;
}

export interface InstanceStatus {
  instanceId: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'banned';
  qrcode?: string;
}

// Abstração dual-provider (Evolution API hoje, Meta Cloud API no futuro)
export interface WhatsAppProvider {
  sendText(to: string, text: string): Promise<MessageResult>;
  sendMedia(to: string, type: string, url: string, caption?: string): Promise<MessageResult>;
  sendTemplate(to: string, templateName: string, params: string[]): Promise<MessageResult>;
  getInstanceStatus(instanceId: string): Promise<InstanceStatus>;
}

// ---------- E-mail Marketing ----------
export interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  audience: { type: 'tags' | 'segment' | 'all'; tags: string[]; segment: string | null };
  html: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent';
  scheduledAt: Timestamp | null;
  metrics: { sent: number; delivered: number; opened: number; clicked: number; unsubscribed: number };
  createdBy: string;
  createdAt: Timestamp;
}

export interface EmailSequenceStep {
  id: string;
  subject: string;
  html: string;
  delayDays: number; // dias após o e-mail anterior
}

export interface EmailSequence {
  id: string;
  name: string;
  description: string | null;
  trigger: { type: 'tag_added' | 'form_submitted' | 'stage_changed'; value: string };
  exitTag: string | null; // parar sequência se a tag for adicionada
  steps: EmailSequenceStep[];
  status: 'active' | 'paused' | 'draft';
  enrolled: number;
  createdAt: Timestamp;
}

export interface EmailTemplate {
  id: string;
  name: string;
  html: string;
  createdAt: Timestamp;
}

// ---------- Tags ----------
export interface TagDef {
  id: string;
  name: string;
  color: string;
  contactCount: number;
  createdAt: Timestamp;
}

// ---------- Submissões públicas (fila para associação a contatos) ----------
export interface FormSubmission {
  id: string;
  formId: string;
  formName: string;
  fields: FormResponseField[];
  contactId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  createdAt: Timestamp;
}
