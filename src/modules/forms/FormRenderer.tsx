// =====================================================================
// 4Flow — Renderizador de formulário
// Usado na página pública /f/:id e no preview do builder.
// Suporta modo clássico (tudo na página) e conversacional (um campo
// por vez com animação), lógica condicional e todos os tipos de campo.
// =====================================================================
import { useMemo, useRef, useState } from 'react';
import { ChevronRight, ChevronLeft, Mic, Square, Upload, CheckCircle2 } from 'lucide-react';
import { validarCpf } from '../../lib/utils';
import type { Form, FormField } from '../../types';

export type ValoresFormulario = Record<string, string | string[] | number | File | Blob | null>;

interface Props {
  form: Pick<Form, 'fields' | 'settings' | 'mode' | 'name'>;
  aoSubmeter: (valores: ValoresFormulario) => Promise<void>;
  preview?: boolean;
}

// ---------- avaliação de lógica condicional ----------
function campoVisivel(campo: FormField, valores: ValoresFormulario): boolean {
  if (!campo.logic || campo.logic.action === 'jump_to') return true;
  const ok = campo.logic.conditions.every((c) => {
    const v = valores[c.fieldId];
    const vs = Array.isArray(v) ? v.join(',') : String(v ?? '');
    switch (c.operator) {
      case 'equals': return vs === c.value;
      case 'not_equals': return vs !== c.value;
      case 'contains': return vs.toLowerCase().includes(c.value.toLowerCase());
      case 'greater_than': return Number(vs) > Number(c.value);
      case 'less_than': return Number(vs) < Number(c.value);
      default: return true;
    }
  });
  return campo.logic.action === 'show' ? ok : !ok;
}

export default function FormRenderer({ form, aoSubmeter, preview }: Props) {
  const [valores, setValores] = useState<ValoresFormulario>({});
  const [erros, setErros] = useState<Record<string, string>>({});
  const [indice, setIndice] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const cor = form.settings.primaryColor || '#006AB1';
  const camposOrdenados = useMemo(() => [...form.fields].sort((a, b) => a.order - b.order), [form.fields]);
  const visiveis = camposOrdenados.filter((c) => campoVisivel(c, valores));

  function definir(id: string, v: ValoresFormulario[string]) {
    setValores((prev) => ({ ...prev, [id]: v }));
    setErros((prev) => ({ ...prev, [id]: '' }));
  }

  function validarCampo(campo: FormField): string | null {
    const v = valores[campo.id];
    const vazio = v == null || v === '' || (Array.isArray(v) && v.length === 0);
    if (campo.required && vazio && campo.type !== 'statement' && campo.type !== 'divider' && campo.type !== 'video_embed') {
      return 'Este campo é obrigatório';
    }
    if (vazio) return null;
    if (campo.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))) return 'E-mail inválido';
    if (campo.type === 'cpf' && !validarCpf(String(v))) return 'CPF inválido';
    if (campo.type === 'phone' && String(v).replace(/\D/g, '').length < 10) return 'Telefone incompleto';
    return null;
  }

  async function submeter() {
    const novosErros: Record<string, string> = {};
    for (const c of visiveis) {
      const erro = validarCampo(c);
      if (erro) novosErros[c.id] = erro;
    }
    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros);
      // no modo conversacional, volta para o primeiro campo com erro
      if (form.mode === 'conversational') {
        const idx = visiveis.findIndex((c) => novosErros[c.id]);
        if (idx >= 0) setIndice(idx);
      }
      return;
    }
    if (preview) {
      setEnviado(true);
      return;
    }
    setEnviando(true);
    try {
      await aoSubmeter(valores);
      setEnviado(true);
      if (form.settings.redirectUrl) {
        setTimeout(() => { window.location.href = form.settings.redirectUrl!; }, 1500);
      }
    } catch {
      setErros({ _geral: 'Erro ao enviar. Tente novamente.' });
    } finally {
      setEnviando(false);
    }
  }

  function avancar() {
    const campo = visiveis[indice];
    const erro = validarCampo(campo);
    if (erro) {
      setErros((p) => ({ ...p, [campo.id]: erro }));
      return;
    }
    // lógica "pular para"
    if (campo.logic?.action === 'jump_to' && campo.logic.targetFieldId) {
      const alvo = visiveis.findIndex((c) => c.id === campo.logic!.targetFieldId);
      if (alvo > indice) { setIndice(alvo); return; }
    }
    if (indice < visiveis.length - 1) setIndice(indice + 1);
    else submeter();
  }

  if (enviado) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="rounded-full p-4" style={{ backgroundColor: `${cor}18`, color: cor }}><CheckCircle2 size={40} /></div>
        <h2 className="text-xl font-bold" style={{ color: cor }}>{form.settings.thankYouMessage || 'Obrigado pela sua resposta!'}</h2>
        {form.settings.redirectUrl && <p className="text-sm text-gray-500">Redirecionando...</p>}
      </div>
    );
  }

  const progresso = form.mode === 'conversational' && visiveis.length > 0 ? Math.round(((indice + 1) / visiveis.length) * 100) : 0;

  // ===== MODO CONVERSACIONAL =====
  if (form.mode === 'conversational') {
    const campo = visiveis[indice];
    if (!campo) return null;
    return (
      <div className="mx-auto w-full max-w-xl">
        {form.settings.progressBar && (
          <div className="mb-8 h-1.5 w-full overflow-hidden rounded-full bg-black/10">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progresso}%`, backgroundColor: cor }} />
          </div>
        )}
        <div key={campo.id} className="anim-slide">
          <CampoRender campo={campo} valor={valores[campo.id]} aoMudar={(v) => definir(campo.id, v)} erro={erros[campo.id]} cor={cor} destaque />
        </div>
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={() => setIndice(Math.max(0, indice - 1))}
            disabled={indice === 0}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 disabled:invisible"
          >
            <ChevronLeft size={16} /> Voltar
          </button>
          <button
            onClick={avancar}
            disabled={enviando}
            className="flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-white shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-60"
            style={{ backgroundColor: cor }}
          >
            {indice === visiveis.length - 1 ? (enviando ? 'Enviando...' : 'Enviar') : 'Avançar'}
            <ChevronRight size={16} />
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-gray-400">{indice + 1} de {visiveis.length}</p>
      </div>
    );
  }

  // ===== MODO CLÁSSICO =====
  return (
    <div className="mx-auto w-full max-w-xl space-y-7">
      {visiveis.map((campo) => (
        <CampoRender key={campo.id} campo={campo} valor={valores[campo.id]} aoMudar={(v) => definir(campo.id, v)} erro={erros[campo.id]} cor={cor} />
      ))}
      {erros._geral && <p className="text-sm text-red-600">{erros._geral}</p>}
      <button
        onClick={submeter}
        disabled={enviando}
        className="w-full rounded-xl px-6 py-3.5 font-semibold text-white shadow-lg transition-transform hover:scale-[1.01] disabled:opacity-60"
        style={{ backgroundColor: cor }}
      >
        {enviando ? 'Enviando...' : 'Enviar'}
      </button>
    </div>
  );
}

// =====================================================================
// Renderização de cada tipo de campo
// =====================================================================
interface CampoRenderProps {
  campo: FormField;
  valor: ValoresFormulario[string];
  aoMudar: (v: ValoresFormulario[string]) => void;
  erro?: string;
  cor: string;
  destaque?: boolean;
}

function CampoRender({ campo, valor, aoMudar, erro, cor, destaque }: CampoRenderProps) {
  const inputCls = 'w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 transition-shadow';
  const estiloFoco = { '--tw-ring-color': `${cor}40` } as React.CSSProperties;

  if (campo.type === 'divider') return <hr className="border-gray-200" />;

  if (campo.type === 'statement') {
    return <p className={`whitespace-pre-wrap text-gray-700 ${destaque ? 'text-lg' : ''}`}>{campo.label}</p>;
  }

  if (campo.type === 'video_embed') {
    return (
      <div>
        <p className={`mb-3 font-semibold text-gray-800 ${destaque ? 'text-xl' : ''}`}>{campo.label}</p>
        {campo.videoUrl && (
          <div className="aspect-video overflow-hidden rounded-xl bg-black">
            <iframe src={urlEmbed(campo.videoUrl)} className="h-full w-full" allowFullScreen title={campo.label} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <label className={`mb-2 block font-semibold text-gray-800 ${destaque ? 'text-xl' : ''}`}>
        {campo.label} {campo.required && <span style={{ color: cor }}>*</span>}
      </label>

      {(campo.type === 'text' || campo.type === 'email' || campo.type === 'number' || campo.type === 'date') && (
        <input
          type={campo.type === 'text' ? 'text' : campo.type}
          className={inputCls}
          style={estiloFoco}
          placeholder={campo.placeholder ?? ''}
          value={String(valor ?? '')}
          onChange={(e) => aoMudar(e.target.value)}
        />
      )}

      {campo.type === 'phone' && (
        <input
          type="tel"
          className={inputCls}
          style={estiloFoco}
          placeholder={campo.placeholder ?? '(11) 99999-9999'}
          value={String(valor ?? '')}
          onChange={(e) => aoMudar(mascaraTelefone(e.target.value))}
        />
      )}

      {campo.type === 'cpf' && (
        <input
          type="text"
          inputMode="numeric"
          className={inputCls}
          style={estiloFoco}
          placeholder="000.000.000-00"
          value={String(valor ?? '')}
          onChange={(e) => aoMudar(mascaraCpf(e.target.value))}
        />
      )}

      {campo.type === 'textarea' && (
        <textarea
          className={`${inputCls} min-h-[110px]`}
          style={estiloFoco}
          placeholder={campo.placeholder ?? ''}
          value={String(valor ?? '')}
          onChange={(e) => aoMudar(e.target.value)}
        />
      )}

      {campo.type === 'choice_single' && (
        <div className="space-y-2">
          {(campo.options ?? []).map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => aoMudar(op)}
              className="w-full rounded-xl border-2 px-4 py-3 text-left text-base font-medium transition-colors"
              style={valor === op ? { borderColor: cor, backgroundColor: `${cor}10`, color: cor } : { borderColor: '#e5e7eb' }}
            >
              {op}
            </button>
          ))}
        </div>
      )}

      {campo.type === 'choice_multiple' && (
        <div className="space-y-2">
          {(campo.options ?? []).map((op) => {
            const selecionados = Array.isArray(valor) ? valor : [];
            const ativo = selecionados.includes(op);
            return (
              <button
                key={op}
                type="button"
                onClick={() => aoMudar(ativo ? selecionados.filter((x) => x !== op) : [...selecionados, op])}
                className="w-full rounded-xl border-2 px-4 py-3 text-left text-base font-medium transition-colors"
                style={ativo ? { borderColor: cor, backgroundColor: `${cor}10`, color: cor } : { borderColor: '#e5e7eb' }}
              >
                {op}
              </button>
            );
          })}
        </div>
      )}

      {(campo.type === 'scale' || campo.type === 'nps') && (
        <div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: (campo.scaleMax ?? 10) - (campo.scaleMin ?? 0) + 1 }, (_, i) => (campo.scaleMin ?? 0) + i).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => aoMudar(n)}
                className="h-11 w-11 rounded-lg border-2 text-sm font-bold transition-colors"
                style={valor === n ? { borderColor: cor, backgroundColor: cor, color: '#fff' } : { borderColor: '#e5e7eb' }}
              >
                {n}
              </button>
            ))}
          </div>
          {campo.scaleLabels && (
            <div className="mt-1.5 flex justify-between text-xs text-gray-400">
              <span>{campo.scaleLabels.min}</span>
              <span>{campo.scaleLabels.max}</span>
            </div>
          )}
        </div>
      )}

      {campo.type === 'audio_record' && <GravadorAudio cor={cor} aoGravar={(blob) => aoMudar(blob)} gravado={valor instanceof Blob} />}

      {(campo.type === 'audio_upload' || campo.type === 'photo_upload' || campo.type === 'video_upload') && (
        <UploadArquivo
          cor={cor}
          tipo={campo.type}
          maxMb={campo.mediaMaxSizeMb ?? 10}
          arquivo={valor instanceof File ? valor : null}
          aoSelecionar={(f) => aoMudar(f)}
        />
      )}

      {erro && <p className="mt-1.5 text-sm text-red-600">{erro}</p>}
    </div>
  );
}

// ---------- Gravador de áudio (MediaRecorder API) ----------
function GravadorAudio({ cor, aoGravar, gravado }: { cor: string; aoGravar: (b: Blob) => void; gravado: boolean }) {
  const [gravando, setGravando] = useState(false);
  const [urlAudio, setUrlAudio] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  async function iniciar() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => chunks.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        aoGravar(blob);
        setUrlAudio(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      recorder.current = mr;
      setGravando(true);
    } catch {
      alert('Não foi possível acessar o microfone. Verifique as permissões do navegador.');
    }
  }

  function parar() {
    recorder.current?.stop();
    setGravando(false);
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={gravando ? parar : iniciar}
        className="flex items-center gap-2 rounded-xl border-2 px-5 py-3 font-semibold transition-colors"
        style={gravando ? { borderColor: '#dc2626', color: '#dc2626' } : { borderColor: cor, color: cor }}
      >
        {gravando ? <><Square size={16} /> Parar gravação</> : <><Mic size={16} /> {gravado ? 'Gravar novamente' : 'Gravar áudio'}</>}
      </button>
      {gravando && <p className="animate-pulse text-sm text-red-600">Gravando...</p>}
      {urlAudio && !gravando && <audio controls src={urlAudio} className="w-full" />}
    </div>
  );
}

// ---------- Upload de arquivo (foto abre câmera no mobile) ----------
function UploadArquivo({ cor, tipo, maxMb, arquivo, aoSelecionar }: {
  cor: string;
  tipo: 'audio_upload' | 'photo_upload' | 'video_upload';
  maxMb: number;
  arquivo: File | null;
  aoSelecionar: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const accept = tipo === 'audio_upload' ? 'audio/*' : tipo === 'photo_upload' ? 'image/*' : 'video/*';

  return (
    <div>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-sm font-medium text-gray-500 transition-colors hover:border-solid"
        style={{ borderColor: arquivo ? cor : '#d1d5db', color: arquivo ? cor : undefined }}
      >
        <Upload size={18} />
        {arquivo ? arquivo.name : `Selecionar arquivo (máx ${maxMb}MB)`}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        capture={tipo === 'photo_upload' ? 'environment' : undefined}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > maxMb * 1024 * 1024) {
            alert(`Arquivo muito grande. Máximo: ${maxMb}MB`);
            return;
          }
          aoSelecionar(f);
        }}
      />
      {arquivo && tipo === 'photo_upload' && (
        <img src={URL.createObjectURL(arquivo)} alt="Preview" className="mt-2 max-h-40 rounded-lg" />
      )}
    </div>
  );
}

// ---------- Helpers ----------
function mascaraTelefone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function mascaraCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function urlEmbed(url: string): string {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return url;
}
