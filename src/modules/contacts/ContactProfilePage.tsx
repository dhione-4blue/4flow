// =====================================================================
// 4Flow — Perfil unificado do lead (tela mais importante do sistema)
// Abas: Dados | Respostas de Formulários | Histórico | Conversas
// Nenhuma resposta de formulário é omitida — diferencial central
// =====================================================================
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  doc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, orderBy, limit,
  type UpdateData, type DocumentData,
} from 'firebase/firestore';
import {
  MessageCircle, History, FileText, User as UserIcon, Plus, ArrowLeft,
  Tag, TrendingUp, ArrowRightLeft, StickyNote, Mail, FormInput, Archive,
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { useUi } from '../../store/ui';
import { useAuditLog } from '../../hooks/useAuditLog';
import { useColecao } from '../../hooks/useColecao';
import { Botao, Badge, Avatar, Spinner, EstadoVazio, Campo, Selecao, Cartao, ModalConfirmacao } from '../../components/ui';
import { fmtTelefone, fmtData, fmtRelativo, fmtReais, corScore } from '../../lib/utils';
import type { Contact, User, Pipeline, Conversation, FormResponseField } from '../../types';

type Aba = 'dados' | 'respostas' | 'historico' | 'conversas';

interface EventoHistorico {
  tipo: string;
  descricao: string;
  autor?: string;
  data: Date | null;
}

export default function ContactProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useUi((s) => s.toast);
  const { registrar } = useAuditLog();
  const [contato, setContato] = useState<Contact | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState<Aba>('dados');
  const [novaTag, setNovaTag] = useState('');
  const [conversas, setConversas] = useState<Conversation[]>([]);
  const [historico, setHistorico] = useState<EventoHistorico[]>([]);
  const [confirmaArquivar, setConfirmaArquivar] = useState(false);

  const { itens: usuarios } = useColecao<User>('users', { ordenarPor: 'name', direcao: 'asc', tamanhoPagina: 100 });
  const { itens: pipelines } = useColecao<Pipeline>('pipelines', { tamanhoPagina: 50 });

  useEffect(() => {
    async function carregar() {
      if (!id) return;
      setCarregando(true);
      try {
        const snap = await getDoc(doc(db, 'contacts', id));
        if (!snap.exists()) {
          toast('erro', 'Contato não encontrado.');
          navigate('/contacts');
          return;
        }
        setContato({ ...(snap.data() as Contact), id: snap.id });

        // conversas do contato
        const convSnap = await getDocs(query(collection(db, 'conversations'), where('contactId', '==', id), limit(50)));
        setConversas(convSnap.docs.map((d) => ({ ...(d.data() as Conversation), id: d.id })));

        // histórico via audit_logs do recurso (se o usuário tiver permissão) — silencioso se negado
        try {
          const logSnap = await getDocs(
            query(collection(db, 'audit_logs'), where('resourceId', '==', id), orderBy('timestamp', 'desc'), limit(100))
          );
          setHistorico(
            logSnap.docs.map((d) => {
              const l = d.data();
              return {
                tipo: String(l.action ?? ''),
                descricao: descricaoAcao(String(l.action ?? ''), l),
                autor: String(l.userName ?? ''),
                data: l.timestamp?.toDate?.() ?? null,
              };
            })
          );
        } catch {
          setHistorico([]);
        }
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [id]);

  const pipelineAtual = useMemo(() => pipelines.find((p) => p.id === contato?.pipelineId), [pipelines, contato]);

  async function atualizar(campos: Partial<Contact>, acao: string, antes?: Record<string, unknown>) {
    if (!contato) return;
    try {
      await updateDoc(doc(db, 'contacts', contato.id), { ...campos, updatedAt: serverTimestamp() } as UpdateData<DocumentData>);
      setContato({ ...contato, ...campos });
      await registrar({
        action: acao, resourceType: 'contact', resourceId: contato.id, resourceName: contato.name,
        before: antes ?? null, after: campos as Record<string, unknown>,
      });
    } catch {
      toast('erro', 'Erro ao atualizar contato.');
    }
  }

  function adicionarTag() {
    const t = novaTag.trim().toLowerCase();
    if (!t || !contato || contato.tags.includes(t)) return;
    atualizar({ tags: [...contato.tags, t] }, 'tag.added', { tags: contato.tags });
    setNovaTag('');
  }

  function removerTag(t: string) {
    if (!contato) return;
    atualizar({ tags: contato.tags.filter((x) => x !== t) }, 'tag.removed', { tags: contato.tags });
  }

  async function arquivar() {
    if (!contato) return;
    // contatos nunca são deletados — apenas arquivados (regra de negócio)
    await atualizar({ status: 'archived' }, 'contact.archived', { status: 'active' });
    toast('sucesso', 'Contato arquivado.');
    navigate('/contacts');
  }

  if (carregando || !contato) return <Spinner texto="Carregando perfil..." />;

  const abas: { id: Aba; rotulo: string; icone: typeof UserIcon }[] = [
    { id: 'dados', rotulo: 'Dados', icone: UserIcon },
    { id: 'respostas', rotulo: `Respostas (${contato.formResponses?.length ?? 0})`, icone: FileText },
    { id: 'historico', rotulo: 'Histórico', icone: History },
    { id: 'conversas', rotulo: `Conversas (${conversas.length})`, icone: MessageCircle },
  ];

  return (
    <div>
      {/* cabeçalho do perfil */}
      <button onClick={() => navigate(-1)} className="mb-3 flex items-center gap-1 text-sm text-gray-500 hover:text-navy">
        <ArrowLeft size={15} /> Voltar
      </button>

      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar nome={contato.name} tamanho={56} />
          <div>
            <h1 className="text-xl font-bold text-navy">{contato.name}</h1>
            <p className="text-sm text-gray-500">
              {fmtTelefone(contato.phone)} {contato.email ? `· ${contato.email}` : ''}
            </p>
            <p className="text-xs text-gray-400">Fonte: {contato.source} · Entrada em {fmtData(contato.createdAt)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {contato.phone && (
            <Link to={`/inbox?novo=${contato.id}`}>
              <Botao icone={<MessageCircle size={15} />}>Iniciar conversa no WhatsApp</Botao>
            </Link>
          )}
          <Botao variante="ghost" icone={<Archive size={15} />} onClick={() => setConfirmaArquivar(true)}>Arquivar</Botao>
        </div>
      </div>

      {/* abas */}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-gray-200">
        {abas.map(({ id: a, rotulo, icone: Icone }) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              aba === a ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-navy'
            }`}
          >
            <Icone size={15} /> {rotulo}
          </button>
        ))}
      </div>

      {/* ===== ABA DADOS ===== */}
      {aba === 'dados' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Cartao>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-400">Qualificação</h3>
            <div className="space-y-5">
              <div>
                <label className="label-base">Tags</label>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {contato.tags.map((t) => <Badge key={t} cor="azul" onRemove={() => removerTag(t)}>{t}</Badge>)}
                  {contato.tags.length === 0 && <span className="text-xs text-gray-400">Sem tags</span>}
                </div>
                <div className="flex gap-2">
                  <input
                    className="input-base"
                    placeholder="Nova tag..."
                    value={novaTag}
                    onChange={(e) => setNovaTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && adicionarTag()}
                  />
                  <Botao variante="secondary" icone={<Plus size={14} />} onClick={adicionarTag}>Adicionar</Botao>
                </div>
              </div>

              <div>
                <label className="label-base">Score: <span style={{ color: corScore(contato.score) }}>{contato.score}</span></label>
                <input
                  type="range" min={0} max={100} value={contato.score}
                  onChange={(e) => setContato({ ...contato, score: Number(e.target.value) })}
                  onMouseUp={() => atualizar({ score: contato.score }, 'contact.score_changed')}
                  onTouchEnd={() => atualizar({ score: contato.score }, 'contact.score_changed')}
                  className="w-full accent-[#006AB1]"
                />
              </div>
            </div>
          </Cartao>

          <Cartao>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-400">Comercial</h3>
            <div className="space-y-4">
              <Selecao
                label="Closer atribuído"
                value={contato.assignedTo ?? ''}
                onChange={(e) => atualizar({ assignedTo: e.target.value || null }, 'contact.assigned', { assignedTo: contato.assignedTo })}
              >
                <option value="">Nenhum</option>
                {usuarios.filter((u) => ['closer', 'operador', 'admin'].includes(u.role)).map((u) => (
                  <option key={u.id} value={u.uid ?? u.id}>{u.name}</option>
                ))}
              </Selecao>

              <Selecao
                label="Pipeline"
                value={contato.pipelineId ?? ''}
                onChange={(e) => atualizar({ pipelineId: e.target.value || null, pipelineStage: null }, 'contact.pipeline_changed')}
              >
                <option value="">Nenhum</option>
                {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Selecao>

              {pipelineAtual && (
                <Selecao
                  label="Etapa no pipeline"
                  value={contato.pipelineStage ?? ''}
                  onChange={(e) =>
                    atualizar(
                      { pipelineStage: e.target.value || null, stageEnteredAt: serverTimestamp() as unknown as Contact['stageEnteredAt'] },
                      'stage.changed',
                      { pipelineStage: contato.pipelineStage }
                    )
                  }
                >
                  <option value="">Nenhuma</option>
                  {[...pipelineAtual.stages].sort((a, b) => a.order - b.order).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Selecao>
              )}

              <Campo
                label="Valor do deal (R$)"
                type="number"
                defaultValue={contato.dealValue ?? ''}
                onBlur={(e) => atualizar({ dealValue: e.target.value ? Number(e.target.value) : null }, 'contact.deal_changed')}
              />
              <p className="text-xs text-gray-400">Valor atual: {fmtReais(contato.dealValue)}</p>
            </div>
          </Cartao>
        </div>
      )}

      {/* ===== ABA RESPOSTAS ===== */}
      {aba === 'respostas' && (
        <div className="space-y-4">
          {(!contato.formResponses || contato.formResponses.length === 0) ? (
            <EstadoVazio titulo="Nenhuma resposta de formulário" descricao="Quando o lead responder um formulário ou quiz, todas as respostas aparecerão aqui, sem omissões." />
          ) : (
            [...contato.formResponses]
              .sort((a, b) => (b.answeredAt?.toMillis?.() ?? 0) - (a.answeredAt?.toMillis?.() ?? 0))
              .map((r, i) => (
                <details key={i} className="group rounded-xl border border-gray-100 bg-white shadow-card" open={i === 0}>
                  <summary className="flex cursor-pointer items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary"><FormInput size={16} /></div>
                      <div>
                        <h4 className="font-semibold text-navy">{r.formName}</h4>
                        <p className="text-xs text-gray-400">Respondido em {fmtData(r.answeredAt)}</p>
                      </div>
                    </div>
                    <Badge cor="cinza">{r.fields.length} respostas</Badge>
                  </summary>
                  <div className="space-y-4 border-t border-gray-50 px-5 py-4">
                    {r.fields.map((f) => <RespostaCampo key={f.fieldId} campo={f} />)}
                  </div>
                </details>
              ))
          )}
        </div>
      )}

      {/* ===== ABA HISTÓRICO ===== */}
      {aba === 'historico' && (
        <div className="space-y-0">
          {historico.length === 0 ? (
            <EstadoVazio titulo="Sem eventos registrados" descricao="A timeline une formulários, mensagens, automações, mudanças de etapa, notas e tags. Configure o Apps Script de auditoria para popular este histórico." />
          ) : (
            <div className="relative ml-3 border-l-2 border-gray-200 pl-6">
              {historico.map((ev, i) => (
                <div key={i} className="relative pb-6">
                  <div className="absolute -left-[31px] rounded-full border-2 border-white bg-cloud p-1.5 text-primary shadow-sm">
                    <IconeEvento tipo={ev.tipo} />
                  </div>
                  <p className="text-sm font-medium text-navy">{ev.descricao}</p>
                  <p className="text-xs text-gray-400">
                    {ev.autor ? `${ev.autor} · ` : ''}{ev.data ? fmtRelativo(ev.data) : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== ABA CONVERSAS ===== */}
      {aba === 'conversas' && (
        <div className="space-y-3">
          {conversas.length === 0 ? (
            <EstadoVazio titulo="Nenhuma conversa" descricao="As conversas deste contato em todos os canais aparecerão aqui." />
          ) : (
            conversas.map((c) => (
              <Cartao key={c.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600"><MessageCircle size={16} /></div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold capitalize text-navy">{c.channel}</span>
                      <Badge cor={c.status === 'open' ? 'verde' : c.status === 'resolved' ? 'cinza' : c.status === 'bot' ? 'gold' : 'amarelo'}>
                        {{ open: 'Aberta', pending: 'Pendente', resolved: 'Resolvida', bot: 'Bot' }[c.status]}
                      </Badge>
                    </div>
                    <p className="max-w-md truncate text-xs text-gray-500">{c.lastMessagePreview ?? 'Sem mensagens'}</p>
                  </div>
                </div>
                <Link to={`/inbox/${c.id}`}><Botao variante="outline">Abrir no Inbox</Botao></Link>
              </Cartao>
            ))
          )}
        </div>
      )}

      <ModalConfirmacao
        aberto={confirmaArquivar}
        titulo="Arquivar contato"
        mensagem={`${contato.name} será arquivado e sairá das listagens ativas. Os dados nunca são apagados permanentemente e podem ser restaurados depois.`}
        textoConfirmar="Arquivar"
        onConfirmar={arquivar}
        onCancelar={() => setConfirmaArquivar(false)}
      />
    </div>
  );
}

// ---------- Renderização de cada resposta (incluindo mídia inline) ----------
function RespostaCampo({ campo }: { campo: FormResponseField }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{campo.label}</p>
      {campo.type === 'audio' && campo.mediaUrl ? (
        <audio controls src={campo.mediaUrl} className="w-full max-w-sm" />
      ) : campo.type === 'photo' && campo.mediaUrl ? (
        <img src={campo.mediaUrl} alt={campo.label} className="max-h-48 rounded-lg border border-gray-100" />
      ) : campo.type === 'video' && campo.mediaUrl ? (
        <video controls src={campo.mediaUrl} className="max-h-64 w-full max-w-md rounded-lg" />
      ) : (
        <p className="text-sm text-navy">{Array.isArray(campo.value) ? campo.value.join(', ') : String(campo.value)}</p>
      )}
    </div>
  );
}

// ---------- Helpers do histórico ----------
function IconeEvento({ tipo }: { tipo: string }) {
  if (tipo.startsWith('tag')) return <Tag size={13} />;
  if (tipo.includes('score')) return <TrendingUp size={13} />;
  if (tipo.includes('stage')) return <ArrowRightLeft size={13} />;
  if (tipo.includes('note')) return <StickyNote size={13} />;
  if (tipo.includes('email')) return <Mail size={13} />;
  if (tipo.includes('form')) return <FormInput size={13} />;
  if (tipo.includes('message') || tipo.includes('conversation')) return <MessageCircle size={13} />;
  return <History size={13} />;
}

function descricaoAcao(acao: string, log: Record<string, unknown>): string {
  const mapa: Record<string, string> = {
    'contact.created': 'Contato criado',
    'contact.updated': 'Dados atualizados',
    'contact.archived': 'Contato arquivado',
    'contact.assigned': 'Closer atribuído',
    'contact.score_changed': 'Score alterado',
    'contact.deal_changed': 'Valor do deal alterado',
    'contact.pipeline_changed': 'Pipeline alterado',
    'stage.changed': 'Movido de etapa no pipeline',
    'tag.added': 'Tag adicionada',
    'tag.removed': 'Tag removida',
    'form.submitted': 'Formulário respondido',
    'message.received': 'Mensagem recebida',
    'email.sent': 'E-mail enviado',
    'automation.triggered': 'Automação disparada',
  };
  return mapa[acao] ?? acao ?? String(log.action ?? 'Evento');
}
