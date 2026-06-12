// =====================================================================
// 4Flow — Inbox unificado (estilo WhatsApp Web)
// Lista de conversas + tela de conversa em tempo real (onSnapshot),
// notas internas, envio via Evolution API, painel lateral do contato
// =====================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  collection, query, orderBy, limit, onSnapshot, doc, updateDoc, addDoc,
  serverTimestamp, getDoc, where, getDocs, increment,
} from 'firebase/firestore';
import {
  Search, Send, StickyNote, CheckCheck, Check, Clock, Bot, UserCheck2,
  PanelRightOpen, PanelRightClose, CheckCircle2, MessageSquare, Paperclip, AlertCircle,
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../store/auth';
import { useUi } from '../../store/ui';
import { useAuditLog } from '../../hooks/useAuditLog';
import { useColecao } from '../../hooks/useColecao';
import { obterProviderWhatsApp, evolutionConfigurada } from '../../lib/whatsapp';
import { Badge, Avatar, Spinner, EstadoVazio, Botao, Selecao, BarraScore } from '../../components/ui';
import { fmtRelativo, fmtData, fmtTelefone, normalizarTelefone } from '../../lib/utils';
import type { Conversation, Message, Contact, User } from '../../types';

type Filtro = 'todas' | 'abertas' | 'pendentes' | 'resolvidas' | 'bot' | 'minhas';

export default function InboxPage() {
  const { conversationId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const perfil = useAuth((s) => s.perfil);
  const toast = useUi((s) => s.toast);
  const { registrar } = useAuditLog();

  const [conversas, setConversas] = useState<Conversation[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [busca, setBusca] = useState('');

  const { itens: usuarios } = useColecao<User>('users', { ordenarPor: 'name', direcao: 'asc', tamanhoPagina: 100 });

  // conversas em tempo real
  useEffect(() => {
    const q = query(collection(db, 'conversations'), orderBy('lastMessageAt', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      setConversas(snap.docs.map((d) => ({ ...(d.data() as Conversation), id: d.id })));
      setCarregando(false);
    }, () => setCarregando(false));
    return unsub;
  }, []);

  // criar conversa a partir do perfil do contato (?novo=contactId)
  useEffect(() => {
    const novoContato = params.get('novo');
    if (!novoContato) return;
    (async () => {
      const existente = await getDocs(query(collection(db, 'conversations'), where('contactId', '==', novoContato), where('channel', '==', 'whatsapp'), limit(1)));
      if (!existente.empty) {
        navigate(`/inbox/${existente.docs[0].id}`, { replace: true });
        return;
      }
      const cSnap = await getDoc(doc(db, 'contacts', novoContato));
      if (!cSnap.exists()) return;
      const contato = cSnap.data() as Contact;
      const ref = await addDoc(collection(db, 'conversations'), {
        contactId: novoContato, contactName: contato.name, channel: 'whatsapp',
        instanceId: null, waId: contato.phone ? normalizarTelefone(contato.phone) : null,
        status: 'open', assignedTo: perfil?.uid ?? null, queueId: null, unreadCount: 0,
        lastMessageAt: serverTimestamp(), lastMessagePreview: null, slaDeadline: null,
        labels: [], notes: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      navigate(`/inbox/${ref.id}`, { replace: true });
    })();
  }, [params]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return conversas.filter((c) => {
      if (filtro === 'abertas' && c.status !== 'open') return false;
      if (filtro === 'pendentes' && c.status !== 'pending') return false;
      if (filtro === 'resolvidas' && c.status !== 'resolved') return false;
      if (filtro === 'bot' && c.status !== 'bot') return false;
      if (filtro === 'minhas' && c.assignedTo !== perfil?.uid) return false;
      if (termo && !(c.contactName ?? '').toLowerCase().includes(termo) && !(c.lastMessagePreview ?? '').toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [conversas, filtro, busca, perfil]);

  const filtros: { id: Filtro; rotulo: string }[] = [
    { id: 'todas', rotulo: 'Todas' }, { id: 'abertas', rotulo: 'Abertas' },
    { id: 'pendentes', rotulo: 'Pendentes' }, { id: 'resolvidas', rotulo: 'Resolvidas' },
    { id: 'bot', rotulo: 'Bot' }, { id: 'minhas', rotulo: 'Minhas' },
  ];

  return (
    <div className="flex h-[calc(100vh-130px)] overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card md:h-[calc(100vh-110px)]">
      {/* ===== Lista de conversas ===== */}
      <div className={`flex w-full flex-col border-r border-gray-100 md:w-80 ${conversationId ? 'hidden md:flex' : ''}`}>
        <div className="border-b border-gray-100 p-3">
          <div className="relative mb-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-base pl-8" placeholder="Buscar conversa..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {filtros.map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  filtro === f.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {f.rotulo}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {carregando ? (
            <Spinner texto="Carregando conversas..." />
          ) : filtradas.length === 0 ? (
            <EstadoVazio titulo="Nenhuma conversa" descricao="As conversas de WhatsApp aparecerão aqui quando o webhook da Evolution API estiver configurado." />
          ) : (
            filtradas.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/inbox/${c.id}`)}
                className={`flex w-full items-center gap-3 border-b border-gray-50 px-3 py-3 text-left transition-colors hover:bg-cloud/60 ${
                  conversationId === c.id ? 'bg-primary/5' : ''
                }`}
              >
                <Avatar nome={c.contactName ?? 'Contato'} tamanho={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-navy">{c.contactName ?? 'Contato'}</span>
                    <span className="shrink-0 text-[10px] text-gray-400">{c.lastMessageAt ? fmtRelativo(c.lastMessageAt) : ''}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-gray-500">{c.lastMessagePreview ?? 'Sem mensagens'}</span>
                    {c.unreadCount > 0 && (
                      <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-navy">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex gap-1">
                    <Badge cor={c.status === 'open' ? 'verde' : c.status === 'bot' ? 'gold' : c.status === 'resolved' ? 'cinza' : 'amarelo'}>
                      {{ open: 'Aberta', pending: 'Pendente', resolved: 'Resolvida', bot: 'Bot' }[c.status]}
                    </Badge>
                    <Badge cor="cinza">{c.channel}</Badge>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ===== Conversa aberta ===== */}
      {conversationId ? (
        <TelaConversa key={conversationId} conversaId={conversationId} usuarios={usuarios} registrar={registrar} toast={toast} />
      ) : (
        <div className="hidden flex-1 items-center justify-center md:flex">
          <div className="text-center text-gray-400">
            <MessageSquare size={40} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Selecione uma conversa</p>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Tela da conversa
// =====================================================================
function TelaConversa({ conversaId, usuarios, registrar, toast }: {
  conversaId: string;
  usuarios: User[];
  registrar: (r: { action: string; resourceType: string; resourceId: string; resourceName?: string | null }) => Promise<void>;
  toast: (t: 'sucesso' | 'erro' | 'info' | 'aviso', m: string) => void;
}) {
  const perfil = useAuth((s) => s.perfil);
  const [conversa, setConversa] = useState<Conversation | null>(null);
  const [mensagens, setMensagens] = useState<Message[]>([]);
  const [contato, setContato] = useState<Contact | null>(null);
  const [texto, setTexto] = useState('');
  const [modoNota, setModoNota] = useState(false);
  const [painelAberto, setPainelAberto] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // conversa + mensagens em tempo real
  useEffect(() => {
    const unsubConv = onSnapshot(doc(db, 'conversations', conversaId), (snap) => {
      if (snap.exists()) {
        const c = { ...(snap.data() as Conversation), id: snap.id };
        setConversa(c);
        if (c.contactId) {
          getDoc(doc(db, 'contacts', c.contactId)).then((cs) => {
            if (cs.exists()) setContato({ ...(cs.data() as Contact), id: cs.id });
          });
        }
      }
    });
    const q = query(collection(db, 'conversations', conversaId, 'messages'), orderBy('sentAt', 'asc'), limit(200));
    const unsubMsgs = onSnapshot(q, (snap) => {
      setMensagens(snap.docs.map((d) => ({ ...(d.data() as Message), id: d.id })));
    });
    // zera não lidas ao abrir
    updateDoc(doc(db, 'conversations', conversaId), { unreadCount: 0 }).catch(() => undefined);
    return () => { unsubConv(); unsubMsgs(); };
  }, [conversaId]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens.length]);

  async function enviar() {
    if (!texto.trim() || !conversa || !perfil) return;
    setEnviando(true);
    const conteudo = texto.trim();
    setTexto('');
    try {
      if (modoNota) {
        // nota interna — não enviada ao contato
        await addDoc(collection(db, 'conversations', conversaId, 'messages'), {
          fromContact: false, authorId: perfil.uid, authorName: perfil.name,
          type: 'note', content: conteudo, mediaUrl: null, mediaCaption: null,
          status: 'sent', waMessageId: null, sentAt: serverTimestamp(), isAutomated: false, flowId: null,
        });
      } else {
        // envia via provider WhatsApp
        let status: Message['status'] = 'sent';
        let waMessageId: string | null = null;
        if (conversa.channel === 'whatsapp' && conversa.waId) {
          if (evolutionConfigurada && conversa.instanceId) {
            const provider = obterProviderWhatsApp(conversa.instanceId);
            const r = await provider.sendText(conversa.waId, conteudo);
            if (!r.success) {
              status = 'failed';
              toast('aviso', `Falha no envio via WhatsApp: ${r.error ?? 'erro desconhecido'}. Mensagem registrada.`);
            }
            waMessageId = r.messageId;
          } else {
            status = 'failed';
            toast('aviso', 'Evolution API não configurada — mensagem registrada apenas no sistema.');
          }
        }
        await addDoc(collection(db, 'conversations', conversaId, 'messages'), {
          fromContact: false, authorId: perfil.uid, authorName: perfil.name,
          type: 'text', content: conteudo, mediaUrl: null, mediaCaption: null,
          status, waMessageId, sentAt: serverTimestamp(), isAutomated: false, flowId: null,
        });
        await updateDoc(doc(db, 'conversations', conversaId), {
          lastMessageAt: serverTimestamp(), lastMessagePreview: conteudo.slice(0, 80), updatedAt: serverTimestamp(),
        });
      }
    } catch {
      toast('erro', 'Erro ao enviar mensagem.');
    } finally {
      setEnviando(false);
    }
  }

  async function mudarStatus(status: Conversation['status']) {
    await updateDoc(doc(db, 'conversations', conversaId), { status, updatedAt: serverTimestamp() });
    await registrar({ action: `conversation.${status}`, resourceType: 'conversation', resourceId: conversaId, resourceName: conversa?.contactName });
    if (status === 'resolved') toast('sucesso', 'Conversa resolvida.');
  }

  async function atribuir(uid: string) {
    await updateDoc(doc(db, 'conversations', conversaId), { assignedTo: uid || null, updatedAt: serverTimestamp() });
    await registrar({ action: 'conversation.assigned', resourceType: 'conversation', resourceId: conversaId });
  }

  if (!conversa) return <div className="flex flex-1 items-center justify-center"><Spinner /></div>;

  return (
    <div className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* cabeçalho */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-2.5">
          <button onClick={() => navigate('/inbox')} className="text-gray-400 hover:text-navy md:hidden">←</button>
          <Avatar nome={conversa.contactName ?? 'Contato'} tamanho={36} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-bold text-navy">{conversa.contactName ?? 'Contato'}</h2>
            <p className="text-[11px] text-gray-400 capitalize">{conversa.channel} · {fmtTelefone(conversa.waId)}</p>
          </div>
          <Selecao value={conversa.assignedTo ?? ''} onChange={(e) => atribuir(e.target.value)} className="hidden w-36 sm:block">
            <option value="">Sem agente</option>
            {usuarios.filter((u) => ['closer', 'operador', 'admin'].includes(u.role)).map((u) => (
              <option key={u.id} value={u.uid ?? u.id}>{u.name}</option>
            ))}
          </Selecao>
          {conversa.status !== 'resolved' ? (
            <Botao variante="secondary" icone={<CheckCircle2 size={14} />} onClick={() => mudarStatus('resolved')} className="!px-2.5 !py-1.5 text-xs">
              Resolver
            </Botao>
          ) : (
            <Botao variante="secondary" onClick={() => mudarStatus('open')} className="!px-2.5 !py-1.5 text-xs">Reabrir</Botao>
          )}
          {conversa.status === 'bot' && (
            <Botao variante="gold" icone={<UserCheck2 size={14} />} onClick={() => mudarStatus('open')} className="!px-2.5 !py-1.5 text-xs">
              Assumir do bot
            </Botao>
          )}
          <button onClick={() => setPainelAberto(!painelAberto)} className="hidden text-gray-400 hover:text-navy lg:block" aria-label="Painel do contato">
            {painelAberto ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
          </button>
        </div>

        {/* mensagens */}
        <div className="flex-1 space-y-2 overflow-y-auto bg-cloud/50 p-4">
          {mensagens.map((m) => <BolhaMensagem key={m.id} m={m} />)}
          <div ref={fimRef} />
        </div>

        {/* input */}
        <div className="border-t border-gray-100 p-3">
          {modoNota && (
            <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-amber-600">
              <StickyNote size={12} /> Nota interna — não será enviada ao contato
            </p>
          )}
          <div className="flex items-end gap-2">
            <button
              onClick={() => setModoNota(!modoNota)}
              className={`rounded-lg p-2.5 transition-colors ${modoNota ? 'bg-amber-100 text-amber-600' : 'text-gray-400 hover:bg-gray-100'}`}
              title="Alternar nota interna"
            >
              <StickyNote size={17} />
            </button>
            <button className="rounded-lg p-2.5 text-gray-400 hover:bg-gray-100" title="Anexar arquivo">
              <Paperclip size={17} />
            </button>
            <textarea
              className={`input-base max-h-32 min-h-[42px] flex-1 resize-none ${modoNota ? 'border-amber-300 bg-amber-50' : ''}`}
              placeholder={modoNota ? 'Escreva uma nota interna...' : 'Escreva uma mensagem...'}
              value={texto}
              rows={1}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
              }}
            />
            <Botao onClick={enviar} carregando={enviando} icone={<Send size={15} />} className="!px-3.5">{''}</Botao>
          </div>
        </div>
      </div>

      {/* ===== painel lateral do contato ===== */}
      {painelAberto && contato && (
        <div className="hidden w-64 shrink-0 overflow-y-auto border-l border-gray-100 p-4 lg:block">
          <div className="mb-4 flex flex-col items-center gap-2 text-center">
            <Avatar nome={contato.name} tamanho={56} />
            <div>
              <h3 className="font-bold text-navy">{contato.name}</h3>
              <p className="text-xs text-gray-400">{fmtTelefone(contato.phone)}</p>
              {contato.email && <p className="text-xs text-gray-400">{contato.email}</p>}
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <p className="label-base">Score</p>
              <BarraScore score={contato.score} />
            </div>
            <div>
              <p className="label-base">Tags</p>
              <div className="flex flex-wrap gap-1">
                {contato.tags.length > 0 ? contato.tags.map((t) => <Badge key={t} cor="azul">{t}</Badge>) : <span className="text-xs text-gray-400">Sem tags</span>}
              </div>
            </div>
            <div>
              <p className="label-base">Fonte</p>
              <p className="text-xs text-gray-600">{contato.source}</p>
            </div>
            <div>
              <p className="label-base">Entrada</p>
              <p className="text-xs text-gray-600">{fmtData(contato.createdAt)}</p>
            </div>
            <Link to={`/contacts/${contato.id}`}>
              <Botao variante="outline" className="mt-2 w-full">Ver perfil completo</Botao>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- bolha de mensagem ----------
function BolhaMensagem({ m }: { m: Message }) {
  // nota interna: fundo amarelo, centralizada
  if (m.type === 'note') {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
        <p className="flex items-center gap-1 text-[11px] font-semibold text-amber-600"><StickyNote size={11} /> Nota de {m.authorName}</p>
        <p className="whitespace-pre-wrap text-sm text-amber-900">{m.content}</p>
        <p className="mt-0.5 text-right text-[10px] text-amber-400">{fmtData(m.sentAt, 'HH:mm')}</p>
      </div>
    );
  }

  const minha = !m.fromContact;
  return (
    <div className={`flex ${minha ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 shadow-sm ${minha ? 'rounded-br-md bg-primary text-white' : 'rounded-bl-md bg-white text-navy'}`}>
        {m.isAutomated && (
          <span className={`mb-0.5 flex w-fit items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${minha ? 'bg-white/20' : 'bg-gold/20 text-yellow-700'}`}>
            <Bot size={9} /> bot
          </span>
        )}
        {m.mediaUrl && m.type === 'image' && <img src={m.mediaUrl} alt="" className="mb-1 max-h-56 rounded-lg" />}
        {m.mediaUrl && m.type === 'audio' && <audio controls src={m.mediaUrl} className="mb-1 max-w-full" />}
        {m.mediaUrl && m.type === 'video' && <video controls src={m.mediaUrl} className="mb-1 max-h-56 rounded-lg" />}
        {m.mediaUrl && m.type === 'document' && (
          <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="mb-1 flex items-center gap-1 underline">
            <Paperclip size={13} /> Documento
          </a>
        )}
        <p className="whitespace-pre-wrap text-sm">{m.content}</p>
        <div className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${minha ? 'text-white/60' : 'text-gray-400'}`}>
          {!m.fromContact && m.authorName && !m.isAutomated && <span>{m.authorName} ·</span>}
          {fmtData(m.sentAt, 'HH:mm')}
          {minha && <StatusMensagem status={m.status} />}
        </div>
      </div>
    </div>
  );
}

function StatusMensagem({ status }: { status: Message['status'] }) {
  if (status === 'read') return <CheckCheck size={13} className="text-sky" />;
  if (status === 'delivered') return <CheckCheck size={13} />;
  if (status === 'sent') return <Check size={13} />;
  if (status === 'failed') return <AlertCircle size={13} className="text-red-300" />;
  return <Clock size={11} />;
}
