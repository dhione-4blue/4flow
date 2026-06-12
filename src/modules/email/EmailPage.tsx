// =====================================================================
// 4Flow — E-mail Marketing
// Campanhas (broadcast), sequências drip e biblioteca de templates
// Editor HTML com Monaco; envio efetivo via Apps Script + Resend/Brevo
// =====================================================================
import { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import Editor from '@monaco-editor/react';
import { Plus, Send, Pencil, Trash2, Mail, ListOrdered, LayoutTemplate, Eye, CalendarClock } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useColecao } from '../../hooks/useColecao';
import { useAuth } from '../../store/auth';
import { useUi } from '../../store/ui';
import { useAuditLog } from '../../hooks/useAuditLog';
import { Botao, Badge, Spinner, EstadoVazio, CabecalhoPagina, Modal, Campo, Selecao, Cartao, ModalConfirmacao, AreaTexto } from '../../components/ui';
import { fmtData, gerarId } from '../../lib/utils';
import type { EmailCampaign, EmailSequence, EmailTemplate, EmailSequenceStep } from '../../types';

const HTML_PADRAO = `<!DOCTYPE html>
<html lang="pt-BR">
<body style="font-family: Montserrat, Arial, sans-serif; background:#F3F3FA; padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
    <h1 style="color:#011628;">Olá {{nome}},</h1>
    <p style="color:#333;line-height:1.6;">Escreva aqui o conteúdo do seu e-mail.</p>
    <a href="#" style="display:inline-block;background:#006AB1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Chamada para ação</a>
    <p style="color:#999;font-size:12px;margin-top:32px;">4blue · <a href="{{descadastro}}" style="color:#999;">descadastrar</a></p>
  </div>
</body>
</html>`;

export default function EmailPage() {
  const { secao = 'campaigns' } = useParams();
  return (
    <div>
      <CabecalhoPagina titulo="E-mail Marketing" descricao="Campanhas, sequências automáticas e templates" />
      <div className="mb-6 flex gap-1 border-b border-gray-200">
        {[
          { id: 'campaigns', rotulo: 'Campanhas', icone: Mail },
          { id: 'sequences', rotulo: 'Sequências', icone: ListOrdered },
          { id: 'templates', rotulo: 'Templates', icone: LayoutTemplate },
        ].map(({ id, rotulo, icone: Icone }) => (
          <NavLink
            key={id}
            to={`/email/${id}`}
            className={({ isActive }) =>
              `flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-navy'
              }`
            }
          >
            <Icone size={15} /> {rotulo}
          </NavLink>
        ))}
      </div>
      {secao === 'campaigns' && <Campanhas />}
      {secao === 'sequences' && <Sequencias />}
      {secao === 'templates' && <Templates />}
    </div>
  );
}

// =====================================================================
// CAMPANHAS
// =====================================================================
function Campanhas() {
  const { itens, carregando, recarregar } = useColecao<EmailCampaign>('email_campaigns');
  const perfil = useAuth((s) => s.perfil);
  const toast = useUi((s) => s.toast);
  const { registrar } = useAuditLog();
  const [editando, setEditando] = useState<EmailCampaign | null>(null);
  const [confirmando, setConfirmando] = useState<EmailCampaign | null>(null);

  async function criar() {
    const ref = await addDoc(collection(db, 'email_campaigns'), {
      name: 'Nova campanha', subject: '', fromName: '4blue', fromEmail: 'contato@4blue.com.br',
      audience: { type: 'all', tags: [], segment: null },
      html: HTML_PADRAO, status: 'draft', scheduledAt: null,
      metrics: { sent: 0, delivered: 0, opened: 0, clicked: 0, unsubscribed: 0 },
      createdBy: perfil?.uid ?? '', createdAt: serverTimestamp(),
    });
    await registrar({ action: 'email_campaign.created', resourceType: 'email_campaign', resourceId: ref.id });
    recarregar();
    toast('sucesso', 'Campanha criada.');
  }

  async function enviar(c: EmailCampaign, agendarPara?: string) {
    // marca para envio — o Apps Script processa a fila e chama Resend/Brevo
    await updateDoc(doc(db, 'email_campaigns', c.id), {
      status: agendarPara ? 'scheduled' : 'sending',
      scheduledAt: agendarPara ? new Date(agendarPara) : serverTimestamp(),
    });
    await addDoc(collection(db, 'automation_queue'), {
      type: 'email_campaign', campaignId: c.id, contactId: null, flowId: null, nodeId: null,
      scheduledFor: agendarPara ? new Date(agendarPara) : serverTimestamp(),
      status: 'pending', createdAt: serverTimestamp(),
    });
    await registrar({ action: 'email_campaign.queued', resourceType: 'email_campaign', resourceId: c.id, resourceName: c.name });
    toast('sucesso', agendarPara ? 'Campanha agendada.' : 'Campanha na fila de envio (processada pelo Apps Script).');
    recarregar();
  }

  if (carregando && itens.length === 0) return <Spinner />;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Botao icone={<Plus size={15} />} onClick={criar}>Nova campanha</Botao>
      </div>
      {itens.length === 0 ? (
        <EstadoVazio titulo="Nenhuma campanha" descricao="Crie campanhas de e-mail para segmentos, tags ou toda a base." />
      ) : (
        <div className="space-y-3">
          {itens.map((c) => (
            <Cartao key={c.id} className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-navy">{c.name}</h3>
                  <Badge cor={{ draft: 'cinza', scheduled: 'amarelo', sending: 'azul', sent: 'verde' }[c.status]}>
                    {{ draft: 'Rascunho', scheduled: 'Agendada', sending: 'Enviando', sent: 'Enviada' }[c.status]}
                  </Badge>
                </div>
                <p className="text-xs text-gray-400">{c.subject || 'Sem assunto'} · criada em {fmtData(c.createdAt, 'dd/MM/yyyy')}</p>
              </div>
              <div className="flex gap-4 text-center text-xs">
                <div><div className="font-bold text-navy">{c.metrics.sent}</div><div className="text-gray-400">Enviados</div></div>
                <div><div className="font-bold text-navy">{c.metrics.opened}</div><div className="text-gray-400">Abertos</div></div>
                <div><div className="font-bold text-navy">{c.metrics.clicked}</div><div className="text-gray-400">Cliques</div></div>
                <div><div className="font-bold text-navy">{c.metrics.unsubscribed}</div><div className="text-gray-400">Descad.</div></div>
              </div>
              <div className="flex gap-1.5">
                <Botao variante="ghost" icone={<Pencil size={14} />} onClick={() => setEditando(c)}>Editar</Botao>
                {c.status === 'draft' && <Botao icone={<Send size={14} />} onClick={() => enviar(c)}>Enviar</Botao>}
                <Botao variante="ghost" icone={<Trash2 size={14} />} onClick={() => setConfirmando(c)}>{''}</Botao>
              </div>
            </Cartao>
          ))}
        </div>
      )}

      {editando && (
        <EditorCampanha
          campanha={editando}
          onFechar={() => { setEditando(null); recarregar(); }}
          onEnviar={(agendar) => { enviar(editando, agendar); setEditando(null); }}
        />
      )}

      <ModalConfirmacao
        aberto={Boolean(confirmando)}
        titulo="Excluir campanha"
        mensagem={`A campanha "${confirmando?.name}" e suas métricas serão excluídas permanentemente.`}
        textoConfirmar="Excluir"
        onConfirmar={async () => {
          if (confirmando) {
            await deleteDoc(doc(db, 'email_campaigns', confirmando.id));
            setConfirmando(null);
            recarregar();
          }
        }}
        onCancelar={() => setConfirmando(null)}
      />
    </div>
  );
}

function EditorCampanha({ campanha, onFechar, onEnviar }: {
  campanha: EmailCampaign;
  onFechar: () => void;
  onEnviar: (agendarPara?: string) => void;
}) {
  const [c, setC] = useState(campanha);
  const [abaHtml, setAbaHtml] = useState(false);
  const [preview, setPreview] = useState(false);
  const [agendarPara, setAgendarPara] = useState('');
  const toast = useUi((s) => s.toast);

  async function salvar() {
    await updateDoc(doc(db, 'email_campaigns', c.id), {
      name: c.name, subject: c.subject, fromName: c.fromName, fromEmail: c.fromEmail,
      audience: c.audience, html: c.html,
    });
    toast('sucesso', 'Campanha salva.');
    onFechar();
  }

  return (
    <Modal
      aberto
      titulo="Editar campanha"
      onFechar={onFechar}
      largura="max-w-4xl"
      rodape={
        <>
          <div className="mr-auto flex items-center gap-2">
            <CalendarClock size={14} className="text-gray-400" />
            <input type="datetime-local" className="input-base !w-auto" value={agendarPara} onChange={(e) => setAgendarPara(e.target.value)} />
            {agendarPara && <Botao variante="gold" onClick={() => onEnviar(agendarPara)}>Agendar envio</Botao>}
          </div>
          <Botao variante="secondary" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={salvar}>Salvar</Botao>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Nome interno" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
          <Campo label="Assunto" value={c.subject} onChange={(e) => setC({ ...c, subject: e.target.value })} />
          <Campo label="Nome do remetente" value={c.fromName} onChange={(e) => setC({ ...c, fromName: e.target.value })} />
          <Campo label="E-mail do remetente" value={c.fromEmail} onChange={(e) => setC({ ...c, fromEmail: e.target.value })} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Selecao
            label="Destinatários"
            value={c.audience.type}
            onChange={(e) => setC({ ...c, audience: { ...c.audience, type: e.target.value as EmailCampaign['audience']['type'] } })}
          >
            <option value="all">Todos os contatos ativos</option>
            <option value="tags">Por tags</option>
            <option value="segment">Por segmento</option>
          </Selecao>
          {c.audience.type === 'tags' && (
            <Campo
              label="Tags (separadas por vírgula)"
              value={c.audience.tags.join(', ')}
              onChange={(e) => setC({ ...c, audience: { ...c.audience, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) } })}
            />
          )}
          {c.audience.type === 'segment' && (
            <Campo label="Segmento" value={c.audience.segment ?? ''} onChange={(e) => setC({ ...c, audience: { ...c.audience, segment: e.target.value || null } })} />
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="label-base !mb-0">Template do e-mail</label>
            <div className="flex gap-1">
              <Botao variante={preview ? 'primary' : 'ghost'} icone={<Eye size={13} />} onClick={() => setPreview(!preview)} className="!px-2 !py-1 text-xs">Preview</Botao>
              <Botao variante={abaHtml ? 'primary' : 'ghost'} onClick={() => setAbaHtml(!abaHtml)} className="!px-2 !py-1 text-xs">HTML</Botao>
            </div>
          </div>
          {preview ? (
            <iframe srcDoc={c.html} className="h-80 w-full rounded-lg border border-gray-200 bg-white" title="Preview do e-mail" />
          ) : abaHtml ? (
            <div className="h-80 overflow-hidden rounded-lg border border-gray-200">
              <Editor defaultLanguage="html" value={c.html} onChange={(v) => setC({ ...c, html: v ?? '' })} options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on' }} />
            </div>
          ) : (
            <AreaTexto value={c.html} onChange={(e) => setC({ ...c, html: e.target.value })} className="[&_textarea]:h-80 [&_textarea]:font-mono [&_textarea]:text-xs" />
          )}
          <p className="mt-1 text-[11px] text-gray-400">Variáveis: {'{{nome}}'}, {'{{email}}'}, {'{{telefone}}'}, {'{{descadastro}}'}</p>
        </div>
      </div>
    </Modal>
  );
}

// =====================================================================
// SEQUÊNCIAS DRIP
// =====================================================================
function Sequencias() {
  const { itens, carregando, recarregar } = useColecao<EmailSequence>('email_sequences');
  const toast = useUi((s) => s.toast);
  const [editando, setEditando] = useState<EmailSequence | null>(null);

  async function criar() {
    await addDoc(collection(db, 'email_sequences'), {
      name: 'Nova sequência', description: null,
      trigger: { type: 'tag_added', value: '' }, exitTag: null,
      steps: [{ id: gerarId('sq_'), subject: 'E-mail 1', html: HTML_PADRAO, delayDays: 0 }],
      status: 'draft', enrolled: 0, createdAt: serverTimestamp(),
    });
    recarregar();
    toast('sucesso', 'Sequência criada.');
  }

  if (carregando && itens.length === 0) return <Spinner />;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Botao icone={<Plus size={15} />} onClick={criar}>Nova sequência</Botao>
      </div>
      {itens.length === 0 ? (
        <EstadoVazio titulo="Nenhuma sequência" descricao="Sequências drip enviam e-mails automáticos com intervalos após um trigger." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {itens.map((s) => (
            <Cartao key={s.id}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-bold text-navy">{s.name}</h3>
                <Badge cor={s.status === 'active' ? 'verde' : s.status === 'paused' ? 'amarelo' : 'cinza'}>
                  {{ active: 'Ativa', paused: 'Pausada', draft: 'Rascunho' }[s.status]}
                </Badge>
              </div>
              <p className="mb-3 text-xs text-gray-500">
                Trigger: {{ tag_added: 'tag adicionada', form_submitted: 'formulário respondido', stage_changed: 'mudança de etapa' }[s.trigger.type]}
                {s.trigger.value ? ` (${s.trigger.value})` : ''} · {s.steps.length} e-mails · {s.enrolled} inscritos
              </p>
              <div className="mb-3 space-y-1">
                {s.steps.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2 rounded-lg bg-cloud/70 px-2.5 py-1.5 text-xs">
                    <Badge cor="azul">{i === 0 ? 'Imediato' : `+${p.delayDays}d`}</Badge>
                    <span className="truncate text-gray-600">{p.subject}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5">
                <Botao variante="ghost" icone={<Pencil size={14} />} onClick={() => setEditando(s)}>Editar</Botao>
                <Botao
                  variante={s.status === 'active' ? 'secondary' : 'gold'}
                  onClick={async () => {
                    await updateDoc(doc(db, 'email_sequences', s.id), { status: s.status === 'active' ? 'paused' : 'active' });
                    recarregar();
                  }}
                  className="ml-auto"
                >
                  {s.status === 'active' ? 'Pausar' : 'Ativar'}
                </Botao>
              </div>
            </Cartao>
          ))}
        </div>
      )}

      {editando && <EditorSequencia sequencia={editando} onFechar={() => { setEditando(null); recarregar(); }} />}
    </div>
  );
}

function EditorSequencia({ sequencia, onFechar }: { sequencia: EmailSequence; onFechar: () => void }) {
  const [s, setS] = useState(sequencia);
  const toast = useUi((sx) => sx.toast);

  function mutarPasso(i: number, m: Partial<EmailSequenceStep>) {
    setS({ ...s, steps: s.steps.map((p, j) => (j === i ? { ...p, ...m } : p)) });
  }

  async function salvar() {
    await updateDoc(doc(db, 'email_sequences', s.id), {
      name: s.name, description: s.description, trigger: s.trigger, exitTag: s.exitTag, steps: s.steps,
    });
    toast('sucesso', 'Sequência salva.');
    onFechar();
  }

  return (
    <Modal
      aberto
      titulo="Editar sequência drip"
      onFechar={onFechar}
      largura="max-w-3xl"
      rodape={<><Botao variante="secondary" onClick={onFechar}>Cancelar</Botao><Botao onClick={salvar}>Salvar</Botao></>}
    >
      <div className="space-y-4">
        <Campo label="Nome" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Selecao
            label="Trigger de entrada"
            value={s.trigger.type}
            onChange={(e) => setS({ ...s, trigger: { ...s.trigger, type: e.target.value as EmailSequence['trigger']['type'] } })}
          >
            <option value="tag_added">Tag adicionada</option>
            <option value="form_submitted">Formulário respondido</option>
            <option value="stage_changed">Mudança de etapa</option>
          </Selecao>
          <Campo label="Valor do trigger" placeholder="tag / formId / stageId" value={s.trigger.value} onChange={(e) => setS({ ...s, trigger: { ...s.trigger, value: e.target.value } })} />
          <Campo label='Tag de saída (ex: "comprou")' value={s.exitTag ?? ''} onChange={(e) => setS({ ...s, exitTag: e.target.value || null })} />
        </div>

        <div>
          <label className="label-base">E-mails da sequência</label>
          <div className="space-y-3">
            {s.steps.map((p, i) => (
              <div key={p.id} className="rounded-xl border border-gray-100 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Badge cor="azul">E-mail {i + 1}</Badge>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    delay
                    <input type="number" min={0} className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-sm" value={p.delayDays} onChange={(e) => mutarPasso(i, { delayDays: Number(e.target.value) })} />
                    dias após o anterior
                  </div>
                  {s.steps.length > 1 && (
                    <button onClick={() => setS({ ...s, steps: s.steps.filter((_, j) => j !== i) })} className="ml-auto text-gray-300 hover:text-red-500" aria-label="Remover e-mail">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <Campo label="Assunto" value={p.subject} onChange={(e) => mutarPasso(i, { subject: e.target.value })} />
                <div className="mt-2 h-44 overflow-hidden rounded-lg border border-gray-200">
                  <Editor defaultLanguage="html" value={p.html} onChange={(v) => mutarPasso(i, { html: v ?? '' })} options={{ minimap: { enabled: false }, fontSize: 12 }} />
                </div>
              </div>
            ))}
          </div>
          <Botao
            variante="ghost"
            icone={<Plus size={13} />}
            onClick={() => setS({ ...s, steps: [...s.steps, { id: gerarId('sq_'), subject: `E-mail ${s.steps.length + 1}`, html: HTML_PADRAO, delayDays: 3 }] })}
            className="mt-2"
          >
            Adicionar e-mail
          </Botao>
        </div>
      </div>
    </Modal>
  );
}

// =====================================================================
// TEMPLATES
// =====================================================================
function Templates() {
  const { itens, carregando, recarregar } = useColecao<EmailTemplate>('email_templates');
  const toast = useUi((s) => s.toast);
  const [editando, setEditando] = useState<EmailTemplate | null>(null);

  async function criar() {
    await addDoc(collection(db, 'email_templates'), { name: 'Novo template', html: HTML_PADRAO, createdAt: serverTimestamp() });
    recarregar();
  }

  if (carregando && itens.length === 0) return <Spinner />;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Botao icone={<Plus size={15} />} onClick={criar}>Novo template</Botao>
      </div>
      {itens.length === 0 ? (
        <EstadoVazio titulo="Nenhum template" descricao="Salve templates HTML reutilizáveis para campanhas e sequências." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {itens.map((t) => (
            <Cartao key={t.id}>
              <iframe srcDoc={t.html} className="pointer-events-none mb-3 h-40 w-full origin-top scale-100 rounded-lg border border-gray-100 bg-white" title={t.name} />
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-navy">{t.name}</h3>
                <div className="flex gap-1">
                  <Botao variante="ghost" icone={<Pencil size={13} />} onClick={() => setEditando(t)}>{''}</Botao>
                  <Botao variante="ghost" icone={<Trash2 size={13} />} onClick={async () => { await deleteDoc(doc(db, 'email_templates', t.id)); recarregar(); }}>{''}</Botao>
                </div>
              </div>
            </Cartao>
          ))}
        </div>
      )}

      {editando && (
        <Modal
          aberto
          titulo="Editar template"
          onFechar={() => setEditando(null)}
          largura="max-w-3xl"
          rodape={
            <>
              <Botao variante="secondary" onClick={() => setEditando(null)}>Cancelar</Botao>
              <Botao onClick={async () => {
                await updateDoc(doc(db, 'email_templates', editando.id), { name: editando.name, html: editando.html });
                toast('sucesso', 'Template salvo.');
                setEditando(null);
                recarregar();
              }}>Salvar</Botao>
            </>
          }
        >
          <div className="space-y-3">
            <Campo label="Nome" value={editando.name} onChange={(e) => setEditando({ ...editando, name: e.target.value })} />
            <div className="h-[50vh] overflow-hidden rounded-lg border border-gray-200">
              <Editor defaultLanguage="html" value={editando.html} onChange={(v) => setEditando({ ...editando, html: v ?? '' })} options={{ minimap: { enabled: false }, fontSize: 13 }} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
