// =====================================================================
// 4Flow — Builder visual de formulários
// 3 painéis: paleta de campos | canvas reordenável | configuração
// Inclui modo clássico/conversacional, lógica condicional,
// editor JSON (Monaco), import/export de schema e preview
// =====================================================================
import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Editor from '@monaco-editor/react';
import { z } from 'zod';
import {
  ArrowLeft, GripVertical, Trash2, Plus, Eye, Braces, Save, Settings2, Download, Upload as UploadIcon, X,
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { useUi } from '../../store/ui';
import { useAuditLog } from '../../hooks/useAuditLog';
import { Botao, Campo, Selecao, Modal, Spinner, Badge, AreaTexto } from '../../components/ui';
import { CATALOGO_CAMPOS, infoCampo, novoCampo } from './camposCatalogo';
import FormRenderer from './FormRenderer';
import type { Form, FormField, ConditionalLogic } from '../../types';

// validação Zod do schema (usada no editor JSON e no import)
const esquemaCampo = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  placeholder: z.string().nullable(),
  required: z.boolean(),
  options: z.array(z.string()).nullable(),
  scaleMin: z.number().nullable(),
  scaleMax: z.number().nullable(),
  scaleLabels: z.object({ min: z.string(), max: z.string() }).nullable(),
  videoUrl: z.string().nullable(),
  mediaMaxSizeMb: z.number().nullable(),
  logic: z.unknown().nullable(),
  order: z.number(),
});

const esquemaSchema = z.object({
  name: z.string().min(1, 'O formulário precisa de um nome'),
  mode: z.enum(['classic', 'conversational']),
  fields: z.array(esquemaCampo),
  settings: z.record(z.unknown()),
});

export default function FormBuilderPage() {
  const { id } = useParams();
  const toast = useUi((s) => s.toast);
  const { registrar } = useAuditLog();
  const [form, setForm] = useState<Form | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [modalJson, setModalJson] = useState(false);
  const [modalConfig, setModalConfig] = useState(false);
  const [modalPreview, setModalPreview] = useState(false);
  const [jsonTexto, setJsonTexto] = useState('');

  useEffect(() => {
    async function carregar() {
      if (!id) return;
      const snap = await getDoc(doc(db, 'forms', id));
      if (snap.exists()) setForm({ ...(snap.data() as Form), id: snap.id });
      setCarregando(false);
    }
    carregar();
  }, [id]);

  const campoAtivo = useMemo(() => form?.fields.find((f) => f.id === selecionado) ?? null, [form, selecionado]);

  function mutar(fn: (f: Form) => Form) {
    setForm((prev) => (prev ? fn(prev) : prev));
  }

  function adicionarCampo(tipo: FormField['type']) {
    mutar((f) => {
      const campo = novoCampo(tipo, f.fields.length);
      setSelecionado(campo.id);
      return { ...f, fields: [...f.fields, campo] };
    });
  }

  function atualizarCampo(idCampo: string, mudancas: Partial<FormField>) {
    mutar((f) => ({ ...f, fields: f.fields.map((c) => (c.id === idCampo ? { ...c, ...mudancas } : c)) }));
  }

  function removerCampo(idCampo: string) {
    mutar((f) => ({ ...f, fields: f.fields.filter((c) => c.id !== idCampo).map((c, i) => ({ ...c, order: i })) }));
    if (selecionado === idCampo) setSelecionado(null);
  }

  function aoArrastar(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id || !form) return;
    const ordenados = [...form.fields].sort((a, b) => a.order - b.order);
    const de = ordenados.findIndex((c) => c.id === active.id);
    const para = ordenados.findIndex((c) => c.id === over.id);
    const novos = arrayMove(ordenados, de, para).map((c, i) => ({ ...c, order: i }));
    mutar((f) => ({ ...f, fields: novos }));
  }

  async function salvar() {
    if (!form || !id) return;
    setSalvando(true);
    try {
      await updateDoc(doc(db, 'forms', id), {
        name: form.name,
        description: form.description,
        mode: form.mode,
        fields: form.fields,
        settings: form.settings,
        updatedAt: serverTimestamp(),
      });
      await registrar({ action: 'form.updated', resourceType: 'form', resourceId: id, resourceName: form.name });
      toast('sucesso', 'Formulário salvo.');
    } catch {
      toast('erro', 'Erro ao salvar formulário.');
    } finally {
      setSalvando(false);
    }
  }

  // ---------- editor JSON ----------
  function abrirJson() {
    if (!form) return;
    setJsonTexto(JSON.stringify({ name: form.name, mode: form.mode, fields: form.fields, settings: form.settings }, null, 2));
    setModalJson(true);
  }

  function aplicarJson() {
    try {
      const obj = JSON.parse(jsonTexto);
      const valido = esquemaSchema.parse(obj);
      mutar((f) => ({
        ...f,
        name: valido.name,
        mode: valido.mode,
        fields: valido.fields as unknown as FormField[],
        settings: { ...f.settings, ...(valido.settings as Partial<Form['settings']>) },
      }));
      setModalJson(false);
      toast('sucesso', 'Schema aplicado ao builder.');
    } catch (e) {
      toast('erro', e instanceof z.ZodError ? `Schema inválido: ${e.errors[0]?.message}` : 'JSON malformado.');
    }
  }

  function exportarJson() {
    const blob = new Blob([jsonTexto], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${form?.name ?? 'formulario'}.json`;
    a.click();
  }

  function importarJson() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      setJsonTexto(await f.text());
    };
    input.click();
  }

  if (carregando) return <Spinner />;
  if (!form) return <p className="text-sm text-gray-500">Formulário não encontrado.</p>;

  const camposOrdenados = [...form.fields].sort((a, b) => a.order - b.order);

  return (
    <div className="flex h-full flex-col">
      {/* barra superior do builder */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link to="/forms" className="flex items-center gap-1 text-sm text-gray-500 hover:text-navy"><ArrowLeft size={15} /></Link>
        <input
          className="min-w-[180px] flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-bold text-navy hover:border-gray-200 focus:border-primary focus:outline-none"
          value={form.name}
          onChange={(e) => mutar((f) => ({ ...f, name: e.target.value }))}
        />
        <Selecao value={form.mode} onChange={(e) => mutar((f) => ({ ...f, mode: e.target.value as Form['mode'] }))} className="w-44">
          <option value="classic">Modo clássico</option>
          <option value="conversational">Modo conversacional</option>
        </Selecao>
        <Botao variante="ghost" icone={<Settings2 size={15} />} onClick={() => setModalConfig(true)}>Configurações</Botao>
        <Botao variante="ghost" icone={<Braces size={15} />} onClick={abrirJson}>Editar JSON</Botao>
        <Botao variante="ghost" icone={<Eye size={15} />} onClick={() => setModalPreview(true)}>Preview</Botao>
        <Botao icone={<Save size={15} />} onClick={salvar} carregando={salvando}>Salvar</Botao>
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-[220px_1fr_300px]">
        {/* ===== Painel esquerdo: paleta ===== */}
        <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-card">
          <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-gray-400">Campos</h3>
          <div className="space-y-1">
            {['Básicos', 'Escolhas', 'Mídia', 'Estrutura'].map((grupo) => (
              <div key={grupo}>
                <p className="mt-3 px-1 text-[10px] font-semibold uppercase text-gray-300">{grupo}</p>
                {CATALOGO_CAMPOS.filter((c) => c.grupo === grupo).map(({ tipo, rotulo, icone: Icone }) => (
                  <button
                    key={tipo}
                    onClick={() => adicionarCampo(tipo)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-gray-600 hover:bg-primary/5 hover:text-primary"
                  >
                    <Icone size={14} className="shrink-0" /> {rotulo}
                    <Plus size={12} className="ml-auto opacity-0 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ===== Canvas central ===== */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-card">
          {camposOrdenados.length === 0 ? (
            <div className="flex h-full min-h-[300px] items-center justify-center text-center text-sm text-gray-400">
              Clique num tipo de campo à esquerda para adicionar
            </div>
          ) : (
            <DndContext collisionDetection={closestCenter} onDragEnd={aoArrastar}>
              <SortableContext items={camposOrdenados.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {camposOrdenados.map((campo) => (
                    <CampoCanvas
                      key={campo.id}
                      campo={campo}
                      ativo={selecionado === campo.id}
                      aoSelecionar={() => setSelecionado(campo.id)}
                      aoRemover={() => removerCampo(campo.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* ===== Painel direito: configuração do campo ===== */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-card">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400">Configuração do campo</h3>
          {!campoAtivo ? (
            <p className="text-sm text-gray-400">Selecione um campo no canvas para configurar.</p>
          ) : (
            <ConfigCampo
              campo={campoAtivo}
              todosCampos={camposOrdenados}
              aoAtualizar={(m) => atualizarCampo(campoAtivo.id, m)}
            />
          )}
        </div>
      </div>

      {/* ===== Modal: editor JSON (Monaco) ===== */}
      <Modal
        aberto={modalJson}
        titulo="Schema JSON do formulário"
        onFechar={() => setModalJson(false)}
        largura="max-w-4xl"
        rodape={
          <>
            <Botao variante="ghost" icone={<UploadIcon size={14} />} onClick={importarJson}>Importar JSON</Botao>
            <Botao variante="ghost" icone={<Download size={14} />} onClick={exportarJson}>Exportar JSON</Botao>
            <Botao variante="secondary" onClick={() => setModalJson(false)}>Cancelar</Botao>
            <Botao onClick={aplicarJson}>Aplicar no builder</Botao>
          </>
        }
      >
        <div className="h-[55vh] overflow-hidden rounded-lg border border-gray-200">
          <Editor
            defaultLanguage="json"
            value={jsonTexto}
            onChange={(v) => setJsonTexto(v ?? '')}
            options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on' }}
          />
        </div>
      </Modal>

      {/* ===== Modal: configurações do formulário ===== */}
      <Modal
        aberto={modalConfig}
        titulo="Configurações do formulário"
        onFechar={() => setModalConfig(false)}
        rodape={<Botao onClick={() => setModalConfig(false)}>Concluir</Botao>}
      >
        <div className="space-y-4">
          <AreaTexto
            label="Descrição"
            value={form.description ?? ''}
            onChange={(e) => mutar((f) => ({ ...f, description: e.target.value || null }))}
          />
          <Campo
            label="Mensagem de agradecimento"
            value={form.settings.thankYouMessage}
            onChange={(e) => mutar((f) => ({ ...f, settings: { ...f.settings, thankYouMessage: e.target.value } }))}
          />
          <Campo
            label="URL de redirecionamento após envio (opcional)"
            placeholder="https://..."
            value={form.settings.redirectUrl ?? ''}
            onChange={(e) => mutar((f) => ({ ...f, settings: { ...f.settings, redirectUrl: e.target.value || null } }))}
          />
          <Campo
            label="Webhook ao submeter (opcional)"
            placeholder="https://..."
            value={form.settings.webhookUrl ?? ''}
            onChange={(e) => mutar((f) => ({ ...f, settings: { ...f.settings, webhookUrl: e.target.value || null } }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-base">Cor primária</label>
              <input
                type="color"
                value={form.settings.primaryColor}
                onChange={(e) => mutar((f) => ({ ...f, settings: { ...f.settings, primaryColor: e.target.value } }))}
                className="h-10 w-full cursor-pointer rounded-lg border border-gray-200"
              />
            </div>
            <div>
              <label className="label-base">Cor de fundo</label>
              <input
                type="color"
                value={form.settings.backgroundColor}
                onChange={(e) => mutar((f) => ({ ...f, settings: { ...f.settings, backgroundColor: e.target.value } }))}
                className="h-10 w-full cursor-pointer rounded-lg border border-gray-200"
              />
            </div>
          </div>
          <Campo
            label="URL do logo (opcional)"
            placeholder="https://..."
            value={form.settings.logoUrl ?? ''}
            onChange={(e) => mutar((f) => ({ ...f, settings: { ...f.settings, logoUrl: e.target.value || null } }))}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.settings.progressBar}
              onChange={(e) => mutar((f) => ({ ...f, settings: { ...f.settings, progressBar: e.target.checked } }))}
            />
            Exibir barra de progresso (modo conversacional)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.settings.allowMultipleSubmissions}
              onChange={(e) => mutar((f) => ({ ...f, settings: { ...f.settings, allowMultipleSubmissions: e.target.checked } }))}
            />
            Permitir múltiplas submissões do mesmo dispositivo
          </label>
        </div>
      </Modal>

      {/* ===== Modal: preview ===== */}
      <Modal aberto={modalPreview} titulo={`Preview — ${form.name}`} onFechar={() => setModalPreview(false)} largura="max-w-3xl">
        <div className="rounded-xl p-6" style={{ backgroundColor: form.settings.backgroundColor }}>
          <div className="rounded-xl bg-white p-6 shadow">
            <FormRenderer form={form} aoSubmeter={async () => undefined} preview />
          </div>
        </div>
      </Modal>
    </div>
  );
}

// =====================================================================
// Campo no canvas (sortable)
// =====================================================================
function CampoCanvas({ campo, ativo, aoSelecionar, aoRemover }: {
  campo: FormField; ativo: boolean; aoSelecionar: () => void; aoRemover: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: campo.id });
  const info = infoCampo(campo.type);
  const Icone = info.icone;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={aoSelecionar}
      className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 bg-white px-3 py-2.5 transition-colors ${
        ativo ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-200'
      }`}
    >
      <button {...attributes} {...listeners} className="cursor-grab text-gray-300 hover:text-gray-500" aria-label="Arrastar">
        <GripVertical size={16} />
      </button>
      <Icone size={16} className="shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-navy">{campo.label}</p>
        <p className="text-[11px] text-gray-400">{info.rotulo}{campo.required ? ' · obrigatório' : ''}{campo.logic ? ' · com lógica' : ''}</p>
      </div>
      <button onClick={(e) => { e.stopPropagation(); aoRemover(); }} className="text-gray-300 hover:text-red-500" aria-label="Remover campo">
        <Trash2 size={15} />
      </button>
    </div>
  );
}

// =====================================================================
// Painel de configuração do campo selecionado
// =====================================================================
function ConfigCampo({ campo, todosCampos, aoAtualizar }: {
  campo: FormField;
  todosCampos: FormField[];
  aoAtualizar: (m: Partial<FormField>) => void;
}) {
  const comOpcoes = campo.type === 'choice_single' || campo.type === 'choice_multiple';
  const comEscala = campo.type === 'scale' || campo.type === 'nps';
  const logica = campo.logic;

  function atualizarLogica(m: Partial<ConditionalLogic>) {
    aoAtualizar({
      logic: {
        conditions: logica?.conditions ?? [{ fieldId: '', operator: 'equals', value: '' }],
        action: logica?.action ?? 'show',
        targetFieldId: logica?.targetFieldId,
        ...m,
      },
    });
  }

  return (
    <div className="space-y-4">
      <AreaTexto label="Pergunta / rótulo" value={campo.label} onChange={(e) => aoAtualizar({ label: e.target.value })} />

      {campo.type !== 'statement' && campo.type !== 'divider' && (
        <>
          <Campo label="Placeholder" value={campo.placeholder ?? ''} onChange={(e) => aoAtualizar({ placeholder: e.target.value || null })} />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={campo.required} onChange={(e) => aoAtualizar({ required: e.target.checked })} />
            Campo obrigatório
          </label>
        </>
      )}

      {comOpcoes && (
        <div>
          <label className="label-base">Opções</label>
          <div className="space-y-1.5">
            {(campo.options ?? []).map((op, i) => (
              <div key={i} className="flex gap-1.5">
                <input
                  className="input-base"
                  value={op}
                  onChange={(e) => {
                    const novas = [...(campo.options ?? [])];
                    novas[i] = e.target.value;
                    aoAtualizar({ options: novas });
                  }}
                />
                <button
                  onClick={() => aoAtualizar({ options: (campo.options ?? []).filter((_, j) => j !== i) })}
                  className="text-gray-300 hover:text-red-500"
                  aria-label="Remover opção"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
          <Botao variante="ghost" icone={<Plus size={13} />} onClick={() => aoAtualizar({ options: [...(campo.options ?? []), `Opção ${(campo.options?.length ?? 0) + 1}`] })} className="mt-1.5 !px-2 !py-1 text-xs">
            Adicionar opção
          </Botao>
        </div>
      )}

      {comEscala && (
        <div className="grid grid-cols-2 gap-2">
          <Campo label="Mínimo" type="number" value={campo.scaleMin ?? 0} onChange={(e) => aoAtualizar({ scaleMin: Number(e.target.value) })} />
          <Campo label="Máximo" type="number" value={campo.scaleMax ?? 10} onChange={(e) => aoAtualizar({ scaleMax: Number(e.target.value) })} />
          <Campo label="Rótulo mínimo" value={campo.scaleLabels?.min ?? ''} onChange={(e) => aoAtualizar({ scaleLabels: { min: e.target.value, max: campo.scaleLabels?.max ?? '' } })} />
          <Campo label="Rótulo máximo" value={campo.scaleLabels?.max ?? ''} onChange={(e) => aoAtualizar({ scaleLabels: { min: campo.scaleLabels?.min ?? '', max: e.target.value } })} />
        </div>
      )}

      {campo.type === 'video_embed' && (
        <Campo label="URL do vídeo (YouTube/Vimeo)" placeholder="https://youtube.com/watch?v=..." value={campo.videoUrl ?? ''} onChange={(e) => aoAtualizar({ videoUrl: e.target.value || null })} />
      )}

      {(campo.type === 'audio_upload' || campo.type === 'photo_upload' || campo.type === 'video_upload') && (
        <Campo label="Tamanho máximo (MB)" type="number" value={campo.mediaMaxSizeMb ?? 10} onChange={(e) => aoAtualizar({ mediaMaxSizeMb: Number(e.target.value) })} />
      )}

      {/* ===== lógica condicional ===== */}
      <div className="border-t border-gray-100 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <label className="label-base !mb-0">Lógica condicional</label>
          {logica ? (
            <button onClick={() => aoAtualizar({ logic: null })} className="text-xs text-red-500 hover:underline">Remover</button>
          ) : (
            <button onClick={() => atualizarLogica({})} className="text-xs text-primary hover:underline">Adicionar</button>
          )}
        </div>
        {logica && (
          <div className="space-y-2 rounded-lg bg-cloud p-3">
            <Selecao value={logica.action} onChange={(e) => atualizarLogica({ action: e.target.value as ConditionalLogic['action'] })}>
              <option value="show">Mostrar este campo SE</option>
              <option value="hide">Esconder este campo SE</option>
              <option value="jump_to">Pular para outro campo SE (conversacional)</option>
            </Selecao>
            {logica.conditions.map((cond, i) => (
              <div key={i} className="space-y-1.5">
                <Selecao
                  value={cond.fieldId}
                  onChange={(e) => {
                    const conds = [...logica.conditions];
                    conds[i] = { ...cond, fieldId: e.target.value };
                    atualizarLogica({ conditions: conds });
                  }}
                >
                  <option value="">— Campo —</option>
                  {todosCampos.filter((c) => c.id !== campo.id).map((c) => (
                    <option key={c.id} value={c.id}>{c.label.slice(0, 40)}</option>
                  ))}
                </Selecao>
                <div className="grid grid-cols-2 gap-1.5">
                  <Selecao
                    value={cond.operator}
                    onChange={(e) => {
                      const conds = [...logica.conditions];
                      conds[i] = { ...cond, operator: e.target.value as typeof cond.operator };
                      atualizarLogica({ conditions: conds });
                    }}
                  >
                    <option value="equals">igual a</option>
                    <option value="not_equals">diferente de</option>
                    <option value="contains">contém</option>
                    <option value="greater_than">maior que</option>
                    <option value="less_than">menor que</option>
                  </Selecao>
                  <Campo
                    placeholder="valor"
                    value={cond.value}
                    onChange={(e) => {
                      const conds = [...logica.conditions];
                      conds[i] = { ...cond, value: e.target.value };
                      atualizarLogica({ conditions: conds });
                    }}
                  />
                </div>
              </div>
            ))}
            {logica.action === 'jump_to' && (
              <Selecao value={logica.targetFieldId ?? ''} onChange={(e) => atualizarLogica({ targetFieldId: e.target.value })}>
                <option value="">— Pular para —</option>
                {todosCampos.filter((c) => c.id !== campo.id).map((c) => (
                  <option key={c.id} value={c.id}>{c.label.slice(0, 40)}</option>
                ))}
              </Selecao>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 pt-3">
        <Badge cor="cinza">Tipo: {infoCampo(campo.type).rotulo}</Badge>
      </div>
    </div>
  );
}
