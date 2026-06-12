// =====================================================================
// 4Flow — Configuração de pipelines e etapas
// Múltiplos pipelines, etapas com nome, cor, SLA e automação ao entrar
// =====================================================================
import { useState } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Plus, Trash2, Star, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useColecao } from '../../hooks/useColecao';
import { useAuth } from '../../store/auth';
import { useUi } from '../../store/ui';
import { useAuditLog } from '../../hooks/useAuditLog';
import { Botao, Campo, Cartao, Spinner, EstadoVazio, ModalConfirmacao, Badge, Selecao } from '../../components/ui';
import { gerarId } from '../../lib/utils';
import type { Pipeline, PipelineStage, Flow } from '../../types';

const CORES_ETAPA = ['#0082C6', '#006AB1', '#03427D', '#F8B90C', '#10b981', '#7c3aed', '#dc2626', '#6b7280'];

export default function PipelinesSection() {
  const { itens: pipelines, carregando, recarregar } = useColecao<Pipeline>('pipelines', { tamanhoPagina: 50 });
  const { itens: flows } = useColecao<Flow>('flows', { tamanhoPagina: 100 });
  const perfil = useAuth((s) => s.perfil);
  const toast = useUi((s) => s.toast);
  const { registrar } = useAuditLog();
  const [novoNome, setNovoNome] = useState('');
  const [confirmando, setConfirmando] = useState<Pipeline | null>(null);

  async function criarPipeline() {
    if (!novoNome.trim()) return;
    try {
      const ref = await addDoc(collection(db, 'pipelines'), {
        name: novoNome.trim(),
        stages: [
          { id: gerarId('st_'), name: 'Novo lead', order: 0, color: '#0082C6', automationOnEnter: null, slaHours: null },
          { id: gerarId('st_'), name: 'Em contato', order: 1, color: '#006AB1', automationOnEnter: null, slaHours: 24 },
          { id: gerarId('st_'), name: 'Proposta', order: 2, color: '#F8B90C', automationOnEnter: null, slaHours: 48 },
          { id: gerarId('st_'), name: 'Fechado', order: 3, color: '#10b981', automationOnEnter: null, slaHours: null },
        ],
        isDefault: pipelines.length === 0,
        createdBy: perfil?.uid ?? '',
        createdAt: serverTimestamp(),
      });
      await registrar({ action: 'pipeline.created', resourceType: 'pipeline', resourceId: ref.id, resourceName: novoNome });
      setNovoNome('');
      toast('sucesso', 'Pipeline criado com etapas padrão.');
      recarregar();
    } catch {
      toast('erro', 'Erro ao criar pipeline.');
    }
  }

  async function salvarEtapas(p: Pipeline, stages: PipelineStage[]) {
    try {
      await updateDoc(doc(db, 'pipelines', p.id), { stages });
      recarregar();
    } catch {
      toast('erro', 'Erro ao salvar etapas.');
    }
  }

  async function definirPadrao(p: Pipeline) {
    for (const outro of pipelines) {
      if (outro.isDefault && outro.id !== p.id) await updateDoc(doc(db, 'pipelines', outro.id), { isDefault: false });
    }
    await updateDoc(doc(db, 'pipelines', p.id), { isDefault: true });
    toast('sucesso', `"${p.name}" agora é o pipeline padrão para novos leads.`);
    recarregar();
  }

  async function excluirPipeline(p: Pipeline) {
    await deleteDoc(doc(db, 'pipelines', p.id));
    await registrar({ action: 'pipeline.deleted', resourceType: 'pipeline', resourceId: p.id, resourceName: p.name });
    setConfirmando(null);
    toast('sucesso', 'Pipeline excluído.');
    recarregar();
  }

  if (carregando) return <Spinner />;

  return (
    <div className="max-w-4xl space-y-5">
      <Cartao>
        <h3 className="mb-3 font-bold text-navy">Novo pipeline</h3>
        <div className="flex gap-2">
          <Campo placeholder='ex: "OTR 2026", "MDL", "Iluminismo Financeiro"' value={novoNome} onChange={(e) => setNovoNome(e.target.value)} className="flex-1" />
          <Botao icone={<Plus size={15} />} onClick={criarPipeline}>Criar</Botao>
        </div>
      </Cartao>

      {pipelines.length === 0 ? (
        <EstadoVazio titulo="Nenhum pipeline" descricao="Crie o primeiro pipeline para usar o CRM." />
      ) : (
        pipelines.map((p) => (
          <Cartao key={p.id}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-navy">{p.name}</h3>
                {p.isDefault && <Badge cor="gold">Padrão</Badge>}
              </div>
              <div className="flex gap-1.5">
                {!p.isDefault && (
                  <Botao variante="ghost" icone={<Star size={14} />} onClick={() => definirPadrao(p)}>Tornar padrão</Botao>
                )}
                <Botao variante="ghost" icone={<Trash2 size={14} />} onClick={() => setConfirmando(p)}>Excluir</Botao>
              </div>
            </div>

            <EditorEtapas
              etapas={[...p.stages].sort((a, b) => a.order - b.order)}
              flows={flows}
              aoSalvar={(stages) => salvarEtapas(p, stages)}
            />
          </Cartao>
        ))
      )}

      <ModalConfirmacao
        aberto={Boolean(confirmando)}
        titulo="Excluir pipeline"
        mensagem={`O pipeline "${confirmando?.name}" será excluído. Os contatos nele permanecem na base, mas perdem a referência de etapa.`}
        textoConfirmar="Excluir pipeline"
        onConfirmar={() => confirmando && excluirPipeline(confirmando)}
        onCancelar={() => setConfirmando(null)}
      />
    </div>
  );
}

// ---------- Editor de etapas de um pipeline ----------
function EditorEtapas({ etapas, flows, aoSalvar }: {
  etapas: PipelineStage[];
  flows: Flow[];
  aoSalvar: (s: PipelineStage[]) => void;
}) {
  const [lista, setLista] = useState(etapas);
  const [alterado, setAlterado] = useState(false);

  function mutar(novas: PipelineStage[]) {
    setLista(novas.map((s, i) => ({ ...s, order: i })));
    setAlterado(true);
  }

  function mover(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= lista.length) return;
    const novas = [...lista];
    [novas[i], novas[j]] = [novas[j], novas[i]];
    mutar(novas);
  }

  return (
    <div className="space-y-2">
      {lista.map((etapa, i) => (
        <div key={etapa.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-cloud/70 p-2">
          <GripVertical size={14} className="text-gray-300" />
          <div className="flex gap-0.5">
            <button onClick={() => mover(i, -1)} className="text-gray-300 hover:text-navy" aria-label="Subir"><ArrowUp size={13} /></button>
            <button onClick={() => mover(i, 1)} className="text-gray-300 hover:text-navy" aria-label="Descer"><ArrowDown size={13} /></button>
          </div>
          <input
            className="w-36 rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-medium"
            value={etapa.name}
            onChange={(e) => mutar(lista.map((s, j) => (j === i ? { ...s, name: e.target.value } : s)))}
          />
          <div className="flex items-center gap-1">
            {CORES_ETAPA.map((cor) => (
              <button
                key={cor}
                onClick={() => mutar(lista.map((s, j) => (j === i ? { ...s, color: cor } : s)))}
                className={`h-5 w-5 rounded-full border-2 ${etapa.color === cor ? 'border-navy' : 'border-transparent'}`}
                style={{ backgroundColor: cor }}
                aria-label={`Cor ${cor}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            SLA
            <input
              type="number"
              className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              placeholder="—"
              value={etapa.slaHours ?? ''}
              onChange={(e) => mutar(lista.map((s, j) => (j === i ? { ...s, slaHours: e.target.value ? Number(e.target.value) : null } : s)))}
            />
            h
          </div>
          <Selecao
            value={etapa.automationOnEnter ?? ''}
            onChange={(e) => mutar(lista.map((s, j) => (j === i ? { ...s, automationOnEnter: e.target.value || null } : s)))}
            className="w-48"
          >
            <option value="">Sem automação ao entrar</option>
            {flows.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </Selecao>
          <button
            onClick={() => mutar(lista.filter((_, j) => j !== i))}
            className="ml-auto text-gray-300 hover:text-red-500"
            aria-label="Remover etapa"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <Botao
          variante="ghost"
          icone={<Plus size={13} />}
          onClick={() => mutar([...lista, { id: gerarId('st_'), name: 'Nova etapa', order: lista.length, color: '#0082C6', automationOnEnter: null, slaHours: null }])}
        >
          Adicionar etapa
        </Botao>
        {alterado && <Botao onClick={() => { aoSalvar(lista); setAlterado(false); }}>Salvar etapas</Botao>}
      </div>
    </div>
  );
}
