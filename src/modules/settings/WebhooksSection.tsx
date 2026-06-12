// =====================================================================
// 4Flow — Webhooks de saída e de entrada (somente admin)
// Saída: eventos do sistema → POST assinado com HMAC para URLs externas
// Entrada: endpoint público /webhook/in/{key} com mapeamento de campos
// =====================================================================
import { useState } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import axios from 'axios';
import { Plus, Trash2, Send, Copy, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useColecao } from '../../hooks/useColecao';
import { useAuth } from '../../store/auth';
import { useUi } from '../../store/ui';
import { useAuditLog } from '../../hooks/useAuditLog';
import { Botao, Campo, Cartao, Modal, ModalConfirmacao, Badge, Spinner, EstadoVazio, Selecao } from '../../components/ui';
import { gerarId, fmtData } from '../../lib/utils';
import type { WebhookConfig, InboundWebhook } from '../../types';

const EVENTOS = [
  'contact.created', 'contact.updated', 'form.submitted', 'stage.changed',
  'tag.added', 'message.received', 'conversation.resolved',
];

export default function WebhooksSection() {
  const [aba, setAba] = useState<'saida' | 'entrada'>('saida');
  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setAba('saida')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${aba === 'saida' ? 'bg-white text-navy shadow-sm' : 'text-gray-500'}`}
        >
          <ArrowUpFromLine size={14} /> Webhooks de saída
        </button>
        <button
          onClick={() => setAba('entrada')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${aba === 'entrada' ? 'bg-white text-navy shadow-sm' : 'text-gray-500'}`}
        >
          <ArrowDownToLine size={14} /> Webhooks de entrada
        </button>
      </div>
      {aba === 'saida' ? <WebhooksSaida /> : <WebhooksEntrada />}
    </div>
  );
}

// ---------- SAÍDA ----------
function WebhooksSaida() {
  const { itens, carregando, recarregar } = useColecao<WebhookConfig>('webhooks');
  const perfil = useAuth((s) => s.perfil);
  const toast = useUi((s) => s.toast);
  const { registrar } = useAuditLog();
  const [modal, setModal] = useState(false);
  const [confirmando, setConfirmando] = useState<WebhookConfig | null>(null);
  const [nome, setNome] = useState('');
  const [url, setUrl] = useState('');
  const [eventos, setEventos] = useState<string[]>([]);

  async function criar() {
    if (!nome.trim() || !url.trim() || eventos.length === 0) {
      toast('aviso', 'Preencha nome, URL e ao menos um evento.');
      return;
    }
    await addDoc(collection(db, 'webhooks'), {
      name: nome.trim(), url: url.trim(), events: eventos,
      secret: gerarId('whsec_') + gerarId(), active: true,
      lastTriggeredAt: null, successCount: 0, failureCount: 0,
      createdBy: perfil?.uid ?? '', createdAt: serverTimestamp(),
    });
    await registrar({ action: 'webhook.created', resourceType: 'webhook', resourceId: url, resourceName: nome });
    setModal(false); setNome(''); setUrl(''); setEventos([]);
    toast('sucesso', 'Webhook criado.');
    recarregar();
  }

  async function testar(w: WebhookConfig) {
    try {
      await axios.post(w.url, {
        evento: 'webhook.test',
        origem: '4flow',
        timestamp: new Date().toISOString(),
        dados: { mensagem: 'Payload de teste enviado pela 4Flow' },
      }, { timeout: 8000 });
      toast('sucesso', 'A URL respondeu com sucesso.');
    } catch {
      toast('erro', 'A URL não respondeu ou retornou erro. Observação: em produção o disparo é feito pelo Apps Script (sem restrição de CORS).');
    }
  }

  if (carregando) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Botao icone={<Plus size={15} />} onClick={() => setModal(true)}>Novo webhook</Botao>
      </div>

      {itens.length === 0 ? (
        <EstadoVazio titulo="Nenhum webhook de saída" descricao="Notifique sistemas externos quando eventos acontecerem na 4Flow." />
      ) : (
        itens.map((w) => (
          <Cartao key={w.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-navy">{w.name}</h3>
              <Badge cor={w.active ? 'verde' : 'cinza'}>{w.active ? 'Ativo' : 'Inativo'}</Badge>
              <div className="ml-auto flex gap-1.5">
                <Botao variante="ghost" icone={<Send size={13} />} onClick={() => testar(w)}>Testar</Botao>
                <Botao variante="ghost" icone={<Trash2 size={13} />} onClick={() => setConfirmando(w)}>{''}</Botao>
              </div>
            </div>
            <code className="block truncate rounded-lg bg-cloud px-3 py-1.5 text-xs text-ocean">{w.url}</code>
            <div className="flex flex-wrap gap-1">
              {w.events.map((e) => <Badge key={e} cor="azul">{e}</Badge>)}
            </div>
            <div className="flex gap-4 text-[11px] text-gray-400">
              <span>Sucessos: {w.successCount}</span>
              <span>Falhas: {w.failureCount}</span>
              <span>Último disparo: {fmtData(w.lastTriggeredAt)}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(w.secret); toast('sucesso', 'Segredo HMAC copiado.'); }}
                className="ml-auto flex items-center gap-1 text-primary hover:underline"
              >
                <Copy size={10} /> Copiar segredo HMAC
              </button>
            </div>
          </Cartao>
        ))
      )}

      <Modal
        aberto={modal}
        titulo="Novo webhook de saída"
        onFechar={() => setModal(false)}
        rodape={<><Botao variante="secondary" onClick={() => setModal(false)}>Cancelar</Botao><Botao onClick={criar}>Criar webhook</Botao></>}
      >
        <div className="space-y-4">
          <Campo label="Nome" placeholder="ex: Notificar planilha de vendas" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Campo label="URL de destino" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
          <div>
            <label className="label-base">Eventos que disparam</label>
            <div className="grid grid-cols-2 gap-1.5">
              {EVENTOS.map((e) => (
                <label key={e} className="flex items-center gap-2 rounded-lg border border-gray-100 px-2.5 py-1.5 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={eventos.includes(e)}
                    onChange={(ev) => setEventos(ev.target.checked ? [...eventos, e] : eventos.filter((x) => x !== e))}
                  />
                  {e}
                </label>
              ))}
            </div>
          </div>
          <p className="rounded-lg bg-cloud px-3 py-2 text-xs text-gray-500">
            Cada disparo é assinado com HMAC-SHA256 no header <code>X-4Flow-Signature</code>. O envio em produção é feito pelo Apps Script.
          </p>
        </div>
      </Modal>

      <ModalConfirmacao
        aberto={Boolean(confirmando)}
        titulo="Excluir webhook"
        mensagem={`O webhook "${confirmando?.name}" deixará de receber eventos imediatamente.`}
        textoConfirmar="Excluir"
        onConfirmar={async () => {
          if (confirmando) {
            await deleteDoc(doc(db, 'webhooks', confirmando.id));
            setConfirmando(null);
            recarregar();
          }
        }}
        onCancelar={() => setConfirmando(null)}
      />
    </div>
  );
}

// ---------- ENTRADA ----------
function WebhooksEntrada() {
  const { itens, carregando, recarregar } = useColecao<InboundWebhook>('inbound_webhooks');
  const toast = useUi((s) => s.toast);
  const [modal, setModal] = useState(false);
  const [nome, setNome] = useState('');
  const [fonte, setFonte] = useState<InboundWebhook['source']>('generic');
  const [tags, setTags] = useState('');

  const URL_WORKER = 'https://api.4flow.com.br/webhook/in';

  async function criar() {
    if (!nome.trim()) return;
    const key = gerarId('in_');
    await addDoc(collection(db, 'inbound_webhooks'), {
      name: nome.trim(), key, source: fonte,
      fieldMapping: fonte === 'hotmart'
        ? { 'data.buyer.name': 'name', 'data.buyer.email': 'email', 'data.buyer.checkout_phone': 'phone' }
        : { name: 'name', email: 'email', phone: 'phone' },
      defaultTags: tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      active: true, receivedCount: 0, createdAt: serverTimestamp(),
    });
    setModal(false); setNome(''); setTags('');
    toast('sucesso', 'Webhook de entrada criado.');
    recarregar();
  }

  if (carregando) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Botao icone={<Plus size={15} />} onClick={() => setModal(true)}>Novo webhook de entrada</Botao>
      </div>

      {itens.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum webhook de entrada"
          descricao="Receba leads de Hotmart, Meta Lead Ads, ActiveCampaign ou qualquer sistema que envie POST JSON."
        />
      ) : (
        itens.map((w) => (
          <Cartao key={w.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-navy">{w.name}</h3>
              <Badge cor="gold">{w.source}</Badge>
              <Badge cor={w.active ? 'verde' : 'cinza'}>{w.active ? 'Ativo' : 'Inativo'}</Badge>
              <div className="ml-auto flex gap-1.5">
                <Botao
                  variante="ghost"
                  onClick={async () => {
                    await updateDoc(doc(db, 'inbound_webhooks', w.id), { active: !w.active });
                    recarregar();
                  }}
                >
                  {w.active ? 'Desativar' : 'Ativar'}
                </Botao>
                <Botao variante="ghost" icone={<Trash2 size={13} />} onClick={async () => { await deleteDoc(doc(db, 'inbound_webhooks', w.id)); recarregar(); }}>{''}</Botao>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-cloud px-3 py-1.5 text-xs text-ocean">{URL_WORKER}/{w.key}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(`${URL_WORKER}/${w.key}`); toast('sucesso', 'URL copiada.'); }}
                className="text-primary"
                aria-label="Copiar URL"
              >
                <Copy size={14} />
              </button>
            </div>
            <p className="text-[11px] text-gray-400">
              {w.receivedCount} payloads recebidos · tags automáticas: {w.defaultTags.join(', ') || 'nenhuma'}
            </p>
          </Cartao>
        ))
      )}

      <Modal
        aberto={modal}
        titulo="Novo webhook de entrada"
        onFechar={() => setModal(false)}
        rodape={<><Botao variante="secondary" onClick={() => setModal(false)}>Cancelar</Botao><Botao onClick={criar}>Criar</Botao></>}
      >
        <div className="space-y-4">
          <Campo label="Nome" placeholder="ex: Compras Hotmart OTR" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Selecao label="Fonte" value={fonte} onChange={(e) => setFonte(e.target.value as InboundWebhook['source'])}>
            <option value="generic">Genérico (POST JSON)</option>
            <option value="hotmart">Hotmart</option>
            <option value="meta_lead_ads">Meta Lead Ads</option>
            <option value="activecampaign">ActiveCampaign</option>
          </Selecao>
          <Campo label="Tags automáticas (vírgula)" placeholder="ex: hotmart, comprou" value={tags} onChange={(e) => setTags(e.target.value)} />
          <p className="rounded-lg bg-cloud px-3 py-2 text-xs text-gray-500">
            O endpoint é servido pelo Cloudflare Worker (workers/webhook-proxy.js no repositório). O mapeamento de campos pode ser ajustado depois.
          </p>
        </div>
      </Modal>
    </div>
  );
}
