// =====================================================================
// 4Flow — Gerenciamento de instâncias WhatsApp (Evolution API)
// Adicionar instância com QR Code, status, reconectar/desconectar
// =====================================================================
import { useState } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Plus, QrCode, RefreshCw, Unplug, Trash2, Smartphone } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useColecao } from '../../hooks/useColecao';
import { useUi } from '../../store/ui';
import { useAuditLog } from '../../hooks/useAuditLog';
import { EvolutionApiProvider, evolutionConfigurada } from '../../lib/whatsapp';
import { Botao, Campo, Cartao, Modal, ModalConfirmacao, Badge, Spinner, EstadoVazio } from '../../components/ui';
import type { WhatsAppInstance } from '../../types';

const corStatus: Record<WhatsAppInstance['status'], string> = {
  connected: 'verde', disconnected: 'vermelho', connecting: 'amarelo', banned: 'navy',
};
const rotuloStatus: Record<WhatsAppInstance['status'], string> = {
  connected: 'Conectado', disconnected: 'Desconectado', connecting: 'Conectando', banned: 'Banido',
};

export default function WhatsAppSection() {
  const { itens: instancias, carregando, recarregar } = useColecao<WhatsAppInstance>('whatsapp_instances', { tamanhoPagina: 50 });
  const toast = useUi((s) => s.toast);
  const { registrar } = useAuditLog();
  const [modalNova, setModalNova] = useState(false);
  const [nomeNova, setNomeNova] = useState('');
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [conectando, setConectando] = useState(false);
  const [confirmando, setConfirmando] = useState<WhatsAppInstance | null>(null);

  async function criarInstancia() {
    const nome = nomeNova.trim().toLowerCase().replace(/\s+/g, '-');
    if (!nome) return;
    setConectando(true);
    try {
      const ref = await addDoc(collection(db, 'whatsapp_instances'), {
        name: nome, displayName: nomeNova.trim(), status: 'connecting', phone: null,
        defaultQueueId: null, inboundWebhookActive: true, createdAt: serverTimestamp(),
      });
      await registrar({ action: 'whatsapp.instance_created', resourceType: 'whatsapp_instance', resourceId: ref.id, resourceName: nome });

      if (evolutionConfigurada) {
        const provider = new EvolutionApiProvider(nome);
        const { qrcode: qr } = await provider.conectarInstancia(nome);
        if (qr) {
          setQrcode(qr);
        } else {
          toast('aviso', 'Instância criada, mas o QR Code não foi retornado. Use "Reconectar".');
        }
      } else {
        toast('aviso', 'Configure VITE_EVOLUTION_API_URL e VITE_EVOLUTION_API_KEY no .env para conectar de verdade.');
      }
      recarregar();
    } catch {
      toast('erro', 'Erro ao criar instância.');
    } finally {
      setConectando(false);
    }
  }

  async function reconectar(inst: WhatsAppInstance) {
    if (!evolutionConfigurada) {
      toast('aviso', 'Evolution API não configurada no .env.');
      return;
    }
    const provider = new EvolutionApiProvider(inst.name);
    const { qrcode: qr } = await provider.conectarInstancia(inst.name);
    if (qr) {
      setQrcode(qr);
      setModalNova(true);
    } else {
      const st = await provider.getInstanceStatus(inst.name);
      await updateDoc(doc(db, 'whatsapp_instances', inst.id), { status: st.status });
      toast('info', `Status atual: ${rotuloStatus[st.status]}`);
      recarregar();
    }
  }

  async function desconectar(inst: WhatsAppInstance) {
    if (evolutionConfigurada) await new EvolutionApiProvider(inst.name).desconectarInstancia(inst.name);
    await updateDoc(doc(db, 'whatsapp_instances', inst.id), { status: 'disconnected' });
    await registrar({ action: 'whatsapp.instance_disconnected', resourceType: 'whatsapp_instance', resourceId: inst.id, resourceName: inst.name });
    recarregar();
  }

  async function deletar(inst: WhatsAppInstance) {
    if (evolutionConfigurada) await new EvolutionApiProvider(inst.name).deletarInstancia(inst.name);
    await deleteDoc(doc(db, 'whatsapp_instances', inst.id));
    await registrar({ action: 'whatsapp.instance_deleted', resourceType: 'whatsapp_instance', resourceId: inst.id, resourceName: inst.name });
    setConfirmando(null);
    toast('sucesso', 'Instância removida.');
    recarregar();
  }

  if (carregando) return <Spinner />;

  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-navy">Instâncias WhatsApp</h2>
          <p className="text-sm text-gray-500">Cada instância corresponde a um número conectado via Evolution API.</p>
        </div>
        <Botao icone={<Plus size={15} />} onClick={() => { setModalNova(true); setQrcode(null); setNomeNova(''); }}>
          Adicionar instância
        </Botao>
      </div>

      {!evolutionConfigurada && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Evolution API não configurada. Preencha VITE_EVOLUTION_API_URL e VITE_EVOLUTION_API_KEY no arquivo .env
          (deploy gratuito no Railway — veja evolution-api/docker-compose.yml no repositório).
        </p>
      )}

      {instancias.length === 0 ? (
        <EstadoVazio titulo="Nenhuma instância" descricao="Adicione uma instância e escaneie o QR Code com o WhatsApp do número desejado." />
      ) : (
        <div className="space-y-3">
          {instancias.map((inst) => (
            <Cartao key={inst.id} className="flex flex-wrap items-center gap-3">
              <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-600"><Smartphone size={18} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-navy">{inst.displayName}</h3>
                  <Badge cor={corStatus[inst.status]}>{rotuloStatus[inst.status]}</Badge>
                </div>
                <p className="text-xs text-gray-400">instância: {inst.name}{inst.phone ? ` · ${inst.phone}` : ''}</p>
              </div>
              <div className="flex gap-1.5">
                <Botao variante="ghost" icone={<RefreshCw size={14} />} onClick={() => reconectar(inst)}>Reconectar</Botao>
                <Botao variante="ghost" icone={<Unplug size={14} />} onClick={() => desconectar(inst)}>Desconectar</Botao>
                <Botao variante="ghost" icone={<Trash2 size={14} />} onClick={() => setConfirmando(inst)}>Excluir</Botao>
              </div>
            </Cartao>
          ))}
        </div>
      )}

      {/* modal nova instância / QR Code */}
      <Modal
        aberto={modalNova}
        titulo={qrcode ? 'Escaneie o QR Code' : 'Nova instância WhatsApp'}
        onFechar={() => { setModalNova(false); setQrcode(null); }}
        rodape={
          qrcode ? (
            <Botao onClick={() => { setModalNova(false); setQrcode(null); recarregar(); }}>Concluído</Botao>
          ) : (
            <>
              <Botao variante="secondary" onClick={() => setModalNova(false)}>Cancelar</Botao>
              <Botao onClick={criarInstancia} carregando={conectando} icone={<QrCode size={15} />}>Criar e gerar QR Code</Botao>
            </>
          )
        }
      >
        {qrcode ? (
          <div className="flex flex-col items-center gap-3">
            <img src={qrcode} alt="QR Code do WhatsApp" className="h-60 w-60 rounded-xl border border-gray-200" />
            <p className="max-w-xs text-center text-xs text-gray-500">
              No celular: WhatsApp → Configurações → Aparelhos conectados → Conectar um aparelho.
            </p>
          </div>
        ) : (
          <Campo
            label="Nome da instância"
            placeholder="ex: comercial-01"
            value={nomeNova}
            onChange={(e) => setNomeNova(e.target.value)}
          />
        )}
      </Modal>

      <ModalConfirmacao
        aberto={Boolean(confirmando)}
        titulo="Excluir instância"
        mensagem={`A instância "${confirmando?.displayName}" será desconectada e removida. As conversas existentes permanecem no sistema.`}
        textoConfirmar="Excluir"
        onConfirmar={() => confirmando && deletar(confirmando)}
        onCancelar={() => setConfirmando(null)}
      />
    </div>
  );
}
