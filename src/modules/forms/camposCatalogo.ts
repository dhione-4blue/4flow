// =====================================================================
// 4Flow — Catálogo de tipos de campo do builder de formulários
// =====================================================================
import {
  Type, AlignLeft, Mail, Phone, Hash, Calendar, CreditCard,
  CircleDot, CheckSquare, SlidersHorizontal, Gauge,
  Mic, FileAudio, Camera, Youtube, Video, Quote, Minus,
} from 'lucide-react';
import type { FormField, FormFieldType } from '../../types';
import { gerarId } from '../../lib/utils';

export const CATALOGO_CAMPOS: { tipo: FormFieldType; rotulo: string; icone: typeof Type; grupo: string }[] = [
  { tipo: 'text', rotulo: 'Texto curto', icone: Type, grupo: 'Básicos' },
  { tipo: 'textarea', rotulo: 'Texto longo', icone: AlignLeft, grupo: 'Básicos' },
  { tipo: 'email', rotulo: 'E-mail', icone: Mail, grupo: 'Básicos' },
  { tipo: 'phone', rotulo: 'Telefone', icone: Phone, grupo: 'Básicos' },
  { tipo: 'number', rotulo: 'Número', icone: Hash, grupo: 'Básicos' },
  { tipo: 'cpf', rotulo: 'CPF', icone: CreditCard, grupo: 'Básicos' },
  { tipo: 'date', rotulo: 'Data', icone: Calendar, grupo: 'Básicos' },
  { tipo: 'choice_single', rotulo: 'Escolha única', icone: CircleDot, grupo: 'Escolhas' },
  { tipo: 'choice_multiple', rotulo: 'Múltipla escolha', icone: CheckSquare, grupo: 'Escolhas' },
  { tipo: 'scale', rotulo: 'Escala', icone: SlidersHorizontal, grupo: 'Escolhas' },
  { tipo: 'nps', rotulo: 'NPS (0-10)', icone: Gauge, grupo: 'Escolhas' },
  { tipo: 'audio_record', rotulo: 'Gravação de áudio', icone: Mic, grupo: 'Mídia' },
  { tipo: 'audio_upload', rotulo: 'Upload de áudio', icone: FileAudio, grupo: 'Mídia' },
  { tipo: 'photo_upload', rotulo: 'Foto', icone: Camera, grupo: 'Mídia' },
  { tipo: 'video_embed', rotulo: 'Vídeo (YouTube/Vimeo)', icone: Youtube, grupo: 'Mídia' },
  { tipo: 'video_upload', rotulo: 'Upload de vídeo', icone: Video, grupo: 'Mídia' },
  { tipo: 'statement', rotulo: 'Texto explicativo', icone: Quote, grupo: 'Estrutura' },
  { tipo: 'divider', rotulo: 'Separador', icone: Minus, grupo: 'Estrutura' },
];

export function infoCampo(tipo: FormFieldType) {
  return CATALOGO_CAMPOS.find((c) => c.tipo === tipo) ?? CATALOGO_CAMPOS[0];
}

/** Cria um campo novo com defaults sensatos */
export function novoCampo(tipo: FormFieldType, ordem: number): FormField {
  const base: FormField = {
    id: gerarId('f_'),
    type: tipo,
    label: infoCampo(tipo).rotulo,
    placeholder: null,
    required: false,
    options: null,
    scaleMin: null,
    scaleMax: null,
    scaleLabels: null,
    videoUrl: null,
    mediaMaxSizeMb: null,
    logic: null,
    order: ordem,
  };
  if (tipo === 'choice_single' || tipo === 'choice_multiple') base.options = ['Opção 1', 'Opção 2'];
  if (tipo === 'scale') { base.scaleMin = 1; base.scaleMax = 10; base.scaleLabels = { min: 'Pouco', max: 'Muito' }; }
  if (tipo === 'nps') { base.scaleMin = 0; base.scaleMax = 10; base.scaleLabels = { min: 'Nada provável', max: 'Muito provável' }; }
  if (tipo === 'statement') base.label = 'Escreva aqui seu texto explicativo...';
  if (tipo === 'audio_upload' || tipo === 'video_upload' || tipo === 'photo_upload') base.mediaMaxSizeMb = 10;
  return base;
}
