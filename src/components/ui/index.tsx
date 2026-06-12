// =====================================================================
// 4Flow — Componentes de UI base (design system 4blue)
// Botões, inputs, badges, modais, toasts, avatar, estados vazios
// =====================================================================
import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, forwardRef } from 'react';
import { X, Loader2, AlertTriangle, CheckCircle2, Info, AlertCircle, Inbox } from 'lucide-react';
import { useUi } from '../../store/ui';
import { iniciais, corScore } from '../../lib/utils';

// ---------- Botão ----------
type Variante = 'primary' | 'secondary' | 'gold' | 'danger' | 'ghost' | 'outline';

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  carregando?: boolean;
  icone?: ReactNode;
}

const estilosBotao: Record<Variante, string> = {
  primary: 'bg-primary text-white hover:bg-ocean shadow-sm',
  secondary: 'bg-white text-navy border border-gray-300 hover:bg-gray-50',
  gold: 'bg-gold text-navy hover:brightness-95 font-semibold shadow-sm',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'text-gray-600 hover:bg-gray-100 hover:text-navy',
  outline: 'border border-primary text-primary hover:bg-primary/5',
};

export function Botao({ variante = 'primary', carregando, icone, children, className = '', disabled, ...props }: BotaoProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors
        disabled:cursor-not-allowed disabled:opacity-50 ${estilosBotao[variante]} ${className}`}
      disabled={disabled || carregando}
      {...props}
    >
      {carregando ? <Loader2 size={16} className="animate-spin" /> : icone}
      {children}
    </button>
  );
}

// ---------- Input / Textarea / Select ----------
interface CampoProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  erro?: string;
}

export const Campo = forwardRef<HTMLInputElement, CampoProps>(({ label, erro, className = '', ...props }, ref) => (
  <div className={className}>
    {label && <label className="label-base">{label}</label>}
    <input ref={ref} className={`input-base ${erro ? 'border-red-400' : ''}`} {...props} />
    {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
  </div>
));
Campo.displayName = 'Campo';

interface AreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  erro?: string;
}

export const AreaTexto = forwardRef<HTMLTextAreaElement, AreaProps>(({ label, erro, className = '', ...props }, ref) => (
  <div className={className}>
    {label && <label className="label-base">{label}</label>}
    <textarea ref={ref} className={`input-base min-h-[80px] ${erro ? 'border-red-400' : ''}`} {...props} />
    {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
  </div>
));
AreaTexto.displayName = 'AreaTexto';

interface SelecaoProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  erro?: string;
}

export const Selecao = forwardRef<HTMLSelectElement, SelecaoProps>(({ label, erro, className = '', children, ...props }, ref) => (
  <div className={className}>
    {label && <label className="label-base">{label}</label>}
    <select ref={ref} className={`input-base ${erro ? 'border-red-400' : ''}`} {...props}>
      {children}
    </select>
    {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
  </div>
));
Selecao.displayName = 'Selecao';

// ---------- Badge ----------
const coresBadge: Record<string, string> = {
  azul: 'bg-sky/10 text-ocean border-sky/30',
  verde: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amarelo: 'bg-amber-50 text-amber-700 border-amber-200',
  vermelho: 'bg-red-50 text-red-700 border-red-200',
  cinza: 'bg-gray-100 text-gray-600 border-gray-200',
  gold: 'bg-gold/15 text-yellow-800 border-gold/40',
  navy: 'bg-navy text-white border-navy',
};

export function Badge({ cor = 'azul', children, onRemove }: { cor?: string; children: ReactNode; onRemove?: () => void }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${coresBadge[cor] ?? coresBadge.azul}`}>
      {children}
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 rounded-full hover:bg-black/10" aria-label="Remover">
          <X size={11} />
        </button>
      )}
    </span>
  );
}

// ---------- Avatar ----------
export function Avatar({ nome, url, tamanho = 36 }: { nome: string; url?: string | null; tamanho?: number }) {
  if (url) {
    return <img src={url} alt={nome} style={{ width: tamanho, height: tamanho }} className="rounded-full object-cover" />;
  }
  // cor determinística baseada no nome
  const cores = ['#03427D', '#006AB1', '#0082C6', '#0d9488', '#7c3aed', '#be185d'];
  const idx = nome.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % cores.length;
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: tamanho, height: tamanho, backgroundColor: cores[idx], fontSize: tamanho * 0.38 }}
    >
      {iniciais(nome)}
    </div>
  );
}

// ---------- Barra de score ----------
export function BarraScore({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: corScore(score) }} />
      </div>
      <span className="text-xs font-semibold tabular-nums" style={{ color: corScore(score) }}>{score}</span>
    </div>
  );
}

// ---------- Modal ----------
interface ModalProps {
  aberto: boolean;
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: string;
}

export function Modal({ aberto, titulo, onFechar, children, rodape, largura = 'max-w-lg' }: ModalProps) {
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={onFechar}>
      <div
        className={`anim-fade flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${largura}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-base font-bold text-navy">{titulo}</h3>
          <button onClick={onFechar} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-navy" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {rodape && <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">{rodape}</div>}
      </div>
    </div>
  );
}

// ---------- Modal de confirmação (ações destrutivas) ----------
interface ConfirmacaoProps {
  aberto: boolean;
  titulo: string;
  mensagem: string;
  textoConfirmar?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
  carregando?: boolean;
}

export function ModalConfirmacao({ aberto, titulo, mensagem, textoConfirmar = 'Confirmar', onConfirmar, onCancelar, carregando }: ConfirmacaoProps) {
  return (
    <Modal
      aberto={aberto}
      titulo={titulo}
      onFechar={onCancelar}
      rodape={
        <>
          <Botao variante="secondary" onClick={onCancelar}>Cancelar</Botao>
          <Botao variante="danger" onClick={onConfirmar} carregando={carregando}>{textoConfirmar}</Botao>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-red-50 p-2 text-red-600"><AlertTriangle size={20} /></div>
        <p className="text-sm text-gray-700">{mensagem}</p>
      </div>
    </Modal>
  );
}

// ---------- Toasts ----------
const iconesToast = {
  sucesso: <CheckCircle2 size={18} className="text-emerald-600" />,
  erro: <AlertCircle size={18} className="text-red-600" />,
  info: <Info size={18} className="text-sky" />,
  aviso: <AlertTriangle size={18} className="text-amber-500" />,
};

export function ContainerToasts() {
  const toasts = useUi((s) => s.toasts);
  const remover = useUi((s) => s.removerToast);
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="anim-slide flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-lg">
          {iconesToast[t.tipo]}
          <span className="text-sm font-medium text-navy">{t.mensagem}</span>
          <button onClick={() => remover(t.id)} className="ml-2 text-gray-400 hover:text-navy" aria-label="Fechar">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------- Spinner / Skeleton / Estado vazio ----------
export function Spinner({ texto = 'Carregando...' }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
      <Loader2 size={28} className="animate-spin text-primary" />
      <span className="text-sm">{texto}</span>
    </div>
  );
}

export function EstadoVazio({ titulo, descricao, acao }: { titulo: string; descricao?: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="rounded-full bg-cloud p-4 text-gray-400"><Inbox size={28} /></div>
      <h3 className="font-semibold text-navy">{titulo}</h3>
      {descricao && <p className="max-w-sm text-sm text-gray-500">{descricao}</p>}
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  );
}

// ---------- Cabeçalho de página ----------
export function CabecalhoPagina({ titulo, descricao, acoes }: { titulo: string; descricao?: string; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold text-navy">{titulo}</h1>
        {descricao && <p className="mt-0.5 text-sm text-gray-500">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}

// ---------- Card ----------
export function Cartao({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-gray-100 bg-white p-5 shadow-card ${className}`}>{children}</div>;
}
