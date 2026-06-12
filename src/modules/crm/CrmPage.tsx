// =====================================================================
// 4Flow — CRM: visão kanban (drag & drop) e visão lista
// Arrastar card entre colunas atualiza pipelineStage, registra
// auditoria e respeita SLA por etapa (indicador verde/amarelo/vermelho)
// =====================================================================
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  collection, query, where, getDocs, updateDoc, doc, serverTimestamp, limit, addDoc,
} from 'firebase/firestore';
import { DndContext, DragOverlay, useDraggable, useDroppable, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { KanbanSquare, List, Plus, Search, Filter } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useColecao } from '../../hooks/useColecao';
import { useAuditLog } from '../../hooks/useAuditLog';
import { useUi } from '../../store/ui';
import { Botao, Badge, Avatar, BarraScore, Spinner, EstadoVazio, CabecalhoPagina, Selecao, Campo, Modal } from '../../components/ui';
import { fmtTelefone, fmtReais, fmtRelativo, normalizarTelefone, corScore } from '../../lib/utils';
import type { Contact, Pipeline, PipelineStage, User } from '../../types';

export default function CrmPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const visaoLista = location.pathname.endsWith('/list');
  const toast = useUi((s) => s.toast);
  const { registrar } = useAuditLog();

  const { itens: pipelines, carregando: carregandoPipes } = useColecao<Pipeline>('pipelines', { tamanhoPagina: 50 });
  const { itens: usuarios } = useColecao<User>('users', { ordenarPor: 'name', direcao: 'asc', tamanhoPagina: 100 });

  const [pipelineId, setPipelineId] = useState('');
  const [contatos, setContatos] = useState<Contact[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroCloser, setFiltroCloser] = useState('');
  const [filtroTag, setFiltroTag] = useState('');
  const [arrastando, setArrastando] = useState<Contact | null>(null);
  const [modalNovo, setModalNovo] = useState<string | null>(null); // stageId
  const [novoNome, setNovoNome] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');

  const pipeline = useMemo(
    () => pipelines.find((p) => p.id === pipelineId) ?? pipelines.find((p) => p.isDefault) ?? pipelines[0] ?? null,
    [pipelines, pipelineId]
  );

  useEffect(() => {
    async function carregar() {
      if (!pipeline) return;
      setCarregando(true);
      try {
        const snap = await getDocs(
          query(collection(db, 'contacts'), where('pipelineId', '==', pipeline.id), where('status', '==', 'active'), limit(500))
        );
        setContatos(snap.docs.map((d) => ({ ...(d.data() as Contact), id: d.id })));
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [pipeline?.id]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return contatos.filter((c) => {
      if (filtroCloser && c.assignedTo !== filtroCloser) return false;
      if (filtroTag && !c.tags.includes(filtroTag.toLowerCase())) return false;
      if (termo && !c.name.toLowerCase().includes(termo) && !(c.phone ?? '').includes(termo.replace(/\D/g, '') || ' ')) return false;
      return true;
    });
  }, [contatos, busca, filtroCloser, filtroTag]);

  const etapas = useMemo(() => [...(pipeline?.stages ?? [])].sort((a, b) => a.order - b.order), [pipeline]);

  async function moverParaEtapa(contato: Contact, etapaId: string) {
    if (contato.pipelineStage === etapaId) return;
    const anterior = contato.pipelineStage;
    // otimista
    setContatos((prev) => prev.map((c) => (c.id === contato.id ? { ...c, pipelineStage: etapaId } : c)));
    try {
      await updateDoc(doc(db, 'contacts', contato.id), {
        pipelineStage: etapaId,
        stageEnteredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await registrar({
        action: 'stage.changed', resourceType: 'contact', resourceId: contato.id, resourceName: contato.name,
        before: { pipelineStage: anterior }, after: { pipelineStage: etapaId },
      });
      // dispara automação stage_changed (fila processada pelo Apps Script)
      const etapa = etapas.find((s) => s.id === etapaId);
      if (etapa?.automationOnEnter) {
        await addDoc(collection(db, 'automation_queue'), {
          contactId: contato.id, flowId: etapa.automationOnEnter, nodeId: null,
          scheduledFor: serverTimestamp(), status: 'pending', createdAt: serverTimestamp(),
        });
      }
    } catch {
      setContatos((prev) => prev.map((c) => (c.id === contato.id ? { ...c, pipelineStage: anterior } : c)));
      toast('erro', 'Erro ao mover o lead.');
    }
  }

  function aoIniciarArrasto(e: DragStartEvent) {
    setArrastando(contatos.find((c) => c.id === e.active.id) ?? null);
  }

  function aoSoltarCard(e: DragEndEvent) {
    setArrastando(null);
    const { active, over } = e;
    if (!over) return;
    const contato = contatos.find((c) => c.id === active.id);
    if (contato) moverParaEtapa(contato, String(over.id));
  }

  async function criarLeadRapido() {
    if (!novoNome.trim() || !pipeline || !modalNovo) return;
    try {
      const ref = await addDoc(collection(db, 'contacts'), {
        name: novoNome.trim(),
        email: null,
        phone: novoTelefone ? normalizarTelefone(novoTelefone) : null,
        source: 'manual', sourceDetail: 'criado no CRM', tags: [], score: 0, segment: null,
        assignedTo: null, pipelineStage: modalNovo, pipelineId: pipeline.id, dealValue: null,
        status: 'active', formResponses: [], importBatchId: null,
        stageEnteredAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      await registrar({ action: 'contact.created', resourceType: 'contact', resourceId: ref.id, resourceName: novoNome });
      setContatos((prev) => [...prev, {
        id: ref.id, name: novoNome.trim(), email: null,
        phone: novoTelefone ? normalizarTelefone(novoTelefone) : null,
        source: 'manual', sourceDetail: null, tags: [], score: 0, segment: null,
        assignedTo: null, pipelineStage: modalNovo, pipelineId: pipeline.id, dealValue: null,
        status: 'active', formResponses: [], importBatchId: null,
      } as unknown as Contact]);
      setModalNovo(null); setNovoNome(''); setNovoTelefone('');
      toast('sucesso', 'Lead criado.');
    } catch {
      toast('erro', 'Erro ao criar lead.');
    }
  }

  if (carregandoPipes) return <Spinner />;

  if (!pipeline) {
    return (
      <EstadoVazio
        titulo="Nenhum pipeline configurado"
        descricao="Crie seu primeiro pipeline com etapas customizadas em Configurações."
        acao={<Link to="/settings/pipelines"><Botao>Configurar pipelines</Botao></Link>}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <CabecalhoPagina
        titulo="CRM"
        acoes={
          <>
            <Selecao value={pipeline.id} onChange={(e) => setPipelineId(e.target.value)} className="w-48">
              {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Selecao>
            <Botao
              variante="secondary"
              icone={visaoLista ? <KanbanSquare size={15} /> : <List size={15} />}
              onClick={() => navigate(visaoLista ? '/crm' : '/crm/list')}
            >
              {visaoLista ? 'Kanban' : 'Lista'}
            </Botao>
          </>
        }
      />

      {/* filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-base pl-8" placeholder="Buscar lead..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Selecao value={filtroCloser} onChange={(e) => setFiltroCloser(e.target.value)} className="w-44">
          <option value="">Todos os closers</option>
          {usuarios.filter((u) => ['closer', 'operador', 'admin'].includes(u.role)).map((u) => (
            <option key={u.id} value={u.uid ?? u.id}>{u.name}</option>
          ))}
        </Selecao>
        <div className="relative w-36">
          <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-base pl-8" placeholder="Tag" value={filtroTag} onChange={(e) => setFiltroTag(e.target.value)} />
        </div>
      </div>

      {carregando ? (
        <Spinner texto="Carregando leads..." />
      ) : visaoLista ? (
        /* ===== VISÃO LISTA ===== */
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Etapa</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Closer</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Na etapa há</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((c) => {
                const etapa = etapas.find((s) => s.id === c.pipelineStage);
                return (
                  <tr key={c.id} onClick={() => navigate(`/contacts/${c.id}`)} className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-cloud/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar nome={c.name} tamanho={28} />
                        <div>
                          <div className="font-semibold text-navy">{c.name}</div>
                          <div className="text-xs text-gray-400">{fmtTelefone(c.phone)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {etapa ? <Badge cor="azul">{etapa.name}</Badge> : <span className="text-gray-400">Sem etapa</span>}
                    </td>
                    <td className="px-4 py-3"><BarraScore score={c.score} /></td>
                    <td className="px-4 py-3 text-gray-600">{usuarios.find((u) => (u.uid ?? u.id) === c.assignedTo)?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{fmtReais(c.dealValue)}</td>
                    <td className="px-4 py-3 text-gray-500">{c.stageEnteredAt ? fmtRelativo(c.stageEnteredAt) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ===== VISÃO KANBAN ===== */
        <DndContext onDragStart={aoIniciarArrasto} onDragEnd={aoSoltarCard}>
          <div className="flex flex-1 gap-3 overflow-x-auto pb-4">
            {etapas.map((etapa) => (
              <ColunaKanban
                key={etapa.id}
                etapa={etapa}
                contatos={visiveis.filter((c) => c.pipelineStage === etapa.id)}
                usuarios={usuarios}
                aoNovoLead={() => setModalNovo(etapa.id)}
                aoAbrirLead={(cid) => navigate(`/contacts/${cid}`)}
              />
            ))}
          </div>
          <DragOverlay>
            {arrastando && <CardLead contato={arrastando} usuarios={usuarios} etapa={etapas.find((s) => s.id === arrastando.pipelineStage)} overlay />}
          </DragOverlay>
        </DndContext>
      )}

      {/* modal criação rápida */}
      <Modal
        aberto={Boolean(modalNovo)}
        titulo="Novo lead"
        onFechar={() => setModalNovo(null)}
        rodape={
          <>
            <Botao variante="secondary" onClick={() => setModalNovo(null)}>Cancelar</Botao>
            <Botao onClick={criarLeadRapido}>Criar</Botao>
          </>
        }
      >
        <div className="space-y-4">
          <Campo label="Nome" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Nome do lead" />
          <Campo label="Telefone" value={novoTelefone} onChange={(e) => setNovoTelefone(e.target.value)} placeholder="(41) 99999-0000" />
        </div>
      </Modal>
    </div>
  );
}

// =====================================================================
// Coluna do kanban (droppable)
// =====================================================================
function ColunaKanban({ etapa, contatos, usuarios, aoNovoLead, aoAbrirLead }: {
  etapa: PipelineStage;
  contatos: Contact[];
  usuarios: User[];
  aoNovoLead: () => void;
  aoAbrirLead: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.id });
  const total = contatos.reduce((s, c) => s + (c.dealValue ?? 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-xl border bg-cloud/60 transition-colors ${isOver ? 'border-primary bg-primary/5' : 'border-gray-100'}`}
    >
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: etapa.color || '#006AB1' }} />
        <h3 className="text-sm font-bold text-navy">{etapa.name}</h3>
        <Badge cor="cinza">{contatos.length}</Badge>
        {total > 0 && <span className="ml-auto text-[11px] font-semibold text-gray-400">{fmtReais(total)}</span>}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: 'calc(100vh - 320px)', minHeight: 120 }}>
        {contatos.map((c) => (
          <CardArrastavel key={c.id} contato={c} usuarios={usuarios} etapa={etapa} aoAbrir={() => aoAbrirLead(c.id)} />
        ))}
      </div>
      <button onClick={aoNovoLead} className="flex items-center justify-center gap-1 border-t border-gray-100 py-2 text-xs font-medium text-gray-400 hover:text-primary">
        <Plus size={13} /> Novo lead
      </button>
    </div>
  );
}

function CardArrastavel({ contato, usuarios, etapa, aoAbrir }: {
  contato: Contact; usuarios: User[]; etapa: PipelineStage; aoAbrir: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: contato.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && aoAbrir()}
      style={{ transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined, opacity: isDragging ? 0.4 : 1 }}
      className="cursor-grab active:cursor-grabbing"
    >
      <CardLead contato={contato} usuarios={usuarios} etapa={etapa} />
    </div>
  );
}

// =====================================================================
// Card do lead com indicador de SLA
// =====================================================================
function CardLead({ contato, usuarios, etapa, overlay }: {
  contato: Contact; usuarios: User[]; etapa?: PipelineStage; overlay?: boolean;
}) {
  const closer = usuarios.find((u) => (u.uid ?? u.id) === contato.assignedTo);

  // SLA: verde < 70% do prazo, amarelo 70-100%, vermelho estourado
  let corSla: string | null = null;
  if (etapa?.slaHours && contato.stageEnteredAt) {
    const entrada = contato.stageEnteredAt.toDate?.();
    if (entrada) {
      const horasNaEtapa = (Date.now() - entrada.getTime()) / 36e5;
      const proporcao = horasNaEtapa / etapa.slaHours;
      corSla = proporcao >= 1 ? '#dc2626' : proporcao >= 0.7 ? '#F8B90C' : '#10b981';
    }
  }

  return (
    <div className={`rounded-xl border border-gray-100 bg-white p-3 shadow-card ${overlay ? 'rotate-2 shadow-xl' : ''}`}>
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-tight text-navy">{contato.name}</span>
        {corSla && <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: corSla }} title="Indicador de SLA" />}
      </div>
      <p className="mb-2 text-xs text-gray-400">{fmtTelefone(contato.phone)}</p>
      {contato.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {contato.tags.slice(0, 2).map((t) => <Badge key={t} cor="azul">{t}</Badge>)}
          {contato.tags.length > 2 && <Badge cor="cinza">+{contato.tags.length - 2}</Badge>}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-10 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full" style={{ width: `${contato.score}%`, backgroundColor: corScore(contato.score) }} />
          </div>
          {contato.dealValue != null && <span className="text-[11px] font-semibold text-gray-500">{fmtReais(contato.dealValue)}</span>}
        </div>
        <div className="flex items-center gap-1">
          {contato.stageEnteredAt && <span className="text-[10px] text-gray-300">{fmtRelativo(contato.stageEnteredAt)}</span>}
          {closer && <Avatar nome={closer.name} url={closer.avatar} tamanho={20} />}
        </div>
      </div>
    </div>
  );
}
