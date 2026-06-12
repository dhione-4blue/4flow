// =====================================================================
// 4Flow — Listagem de automações/fluxos
// =====================================================================
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addDoc, collection, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { Plus, Pencil, Play, Pause, Workflow } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useColecao } from '../../hooks/useColecao';
import { useAuth } from '../../store/auth';
import { useUi } from '../../store/ui';
import { useAuditLog } from '../../hooks/useAuditLog';
import { Botao, Badge, Spinner, EstadoVazio, CabecalhoPagina, Cartao } from '../../components/ui';
import { infoTrigger } from './nosCatalogo';
import { fmtData, gerarId } from '../../lib/utils';
import type { Flow } from '../../types';

export default function FlowsListPage() {
  const { itens: flows, carregando, recarregar } = useColecao<Flow>('flows', { ordenarPor: 'updatedAt', direcao: 'desc' });
  const perfil = useAuth((s) => s.perfil);
  const toast = useUi((s) => s.toast);
  const { registrar } = useAuditLog();
  const navigate = useNavigate();
  const [criando, setCriando] = useState(false);

  async function criarFluxo() {
    setCriando(true);
    try {
      const inicioId = gerarId('n_');
      const ref = await addDoc(collection(db, 'flows'), {
        name: 'Nova automação',
        description: null,
        trigger: { type: 'manual', config: {} },
        nodes: [
          { id: inicioId, type: 'message_whatsapp', position: { x: 120, y: 140 }, data: { texto: 'Olá {{nome}}, tudo bem?' } },
        ],
        edges: [],
        status: 'draft',
        stats: { triggered: 0, completed: 0, dropped: 0 },
        createdBy: perfil?.uid ?? '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await registrar({ action: 'flow.created', resourceType: 'flow', resourceId: ref.id, resourceName: 'Nova automação' });
      navigate(`/automation/${ref.id}/edit`);
    } catch {
      toast('erro', 'Erro ao criar automação.');
    } finally {
      setCriando(false);
    }
  }

  async function alternarStatus(f: Flow) {
    const novo = f.status === 'active' ? 'paused' : 'active';
    await updateDoc(doc(db, 'flows', f.id), { status: novo, updatedAt: serverTimestamp() });
    await registrar({ action: `flow.${novo}`, resourceType: 'flow', resourceId: f.id, resourceName: f.name });
    toast('sucesso', novo === 'active' ? 'Automação ativada.' : 'Automação pausada.');
    recarregar();
  }

  if (carregando && flows.length === 0) return <Spinner />;

  return (
    <div>
      <CabecalhoPagina
        titulo="Automações"
        descricao="Fluxos automáticos de mensagens, tags, score e movimentação no CRM"
        acoes={<Botao icone={<Plus size={15} />} onClick={criarFluxo} carregando={criando}>Nova automação</Botao>}
      />

      {flows.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma automação criada"
          descricao="Monte fluxos visuais com triggers, condições, delays e ações."
          acao={<Botao icone={<Plus size={15} />} onClick={criarFluxo}>Criar automação</Botao>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {flows.map((f) => {
            const trigger = infoTrigger(f.trigger?.type ?? 'manual');
            const IconeTrigger = trigger.icone;
            return (
              <Cartao key={f.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary"><Workflow size={16} /></div>
                    <div>
                      <h3 className="font-bold leading-tight text-navy">{f.name}</h3>
                      <p className="text-xs text-gray-400">Atualizado {fmtData(f.updatedAt, 'dd/MM/yyyy')}</p>
                    </div>
                  </div>
                  <Badge cor={f.status === 'active' ? 'verde' : f.status === 'paused' ? 'amarelo' : 'cinza'}>
                    {{ active: 'Ativa', paused: 'Pausada', draft: 'Rascunho' }[f.status]}
                  </Badge>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <IconeTrigger size={13} className="text-primary" />
                  {trigger.rotulo}
                  <span className="ml-auto">{f.nodes?.length ?? 0} nós</span>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-lg bg-cloud/70 p-2 text-center">
                  <div><div className="text-sm font-bold text-navy">{f.stats?.triggered ?? 0}</div><div className="text-[10px] text-gray-400">Disparos</div></div>
                  <div><div className="text-sm font-bold text-emerald-600">{f.stats?.completed ?? 0}</div><div className="text-[10px] text-gray-400">Concluídos</div></div>
                  <div><div className="text-sm font-bold text-red-500">{f.stats?.dropped ?? 0}</div><div className="text-[10px] text-gray-400">Abandonos</div></div>
                </div>

                <div className="mt-auto flex gap-1.5 border-t border-gray-50 pt-3">
                  <Link to={`/automation/${f.id}/edit`}><Botao variante="ghost" icone={<Pencil size={14} />}>Editar</Botao></Link>
                  <Botao
                    variante={f.status === 'active' ? 'secondary' : 'gold'}
                    icone={f.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                    onClick={() => alternarStatus(f)}
                    className="ml-auto"
                  >
                    {f.status === 'active' ? 'Pausar' : 'Ativar'}
                  </Botao>
                </div>
              </Cartao>
            );
          })}
        </div>
      )}
    </div>
  );
}
