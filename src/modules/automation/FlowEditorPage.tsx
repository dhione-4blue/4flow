// =====================================================================
// 4Flow — Editor visual de fluxos de automação
// Canvas com pan/zoom, nós arrastáveis, conexões por clique nas portas,
// painel de configuração, editor JSON (Monaco) e simulação dry-run
// =====================================================================
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, getDocs, limit, where } from 'firebase/firestore';
import Editor from '@monaco-editor/react';
import { z } from 'zod';
import {
  ArrowLeft, Save, Braces, Trash2, Plus, ZoomIn, ZoomOut, PlayCircle, X, Download, Upload as UploadIcon,
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { useUi } from '../../store/ui';
import { useAuditLog } from '../../hooks/useAuditLog';
import { Botao, Campo, Selecao, Modal, Spinner, Badge, AreaTexto } from '../../components/ui';
import { CATALOGO_NOS, CATALOGO_TRIGGERS, infoNo } from './nosCatalogo';
import { gerarId } from '../../lib/utils';
import type { Flow, FlowNode, FlowEdge, FlowNodeType, Contact } from '../../types';

const NODE_W = 200;
const NODE_H = 64;

const esquemaFlow = z.object({
  name: z.string().min(1),
  trigger: z.object({ type: z.string(), config: z.record(z.unknown()) }),
  nodes: z.array(z.object({
    id: z.string(), type: z.string(),
    position: z.object({ x: z.number(), y: z.number() }),
    data: z.record(z.unknown()),
  })),
  edges: z.array(z.object({ id: z.string(), source: z.string(), target: z.string(), label: z.string().optional() })),
});

export default function FlowEditorPage() {
  const { id } = useParams();
  const toast = useUi((s) => s.toast);
  const { registrar } = useAuditLog();
  const [flow, setFlow] = useState<Flow | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [conectandoDe, setConectandoDe] = useState<{ nodeId: string; label?: string } | null>(null);
  const [modalJson, setModalJson] = useState(false);
  const [jsonTexto, setJsonTexto] = useState('');
  const [modalSimular, setModalSimular] = useState(false);

  // pan & zoom
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef<{ ativo: boolean; x: number; y: number }>({ ativo: false, x: 0, y: 0 });
  const arrastoRef = useRef<{ nodeId: string; dx: number; dy: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function carregar() {
      if (!id) return;
      const snap = await getDoc(doc(db, 'flows', id));
      if (snap.exists()) setFlow({ ...(snap.data() as Flow), id: snap.id });
      setCarregando(false);
    }
    carregar();
  }, [id]);

  const noAtivo = useMemo(() => flow?.nodes.find((n) => n.id === selecionado) ?? null, [flow, selecionado]);

  function mutar(fn: (f: Flow) => Flow) {
    setFlow((prev) => (prev ? fn(prev) : prev));
  }

  function adicionarNo(tipo: FlowNodeType) {
    const node: FlowNode = {
      id: gerarId('n_'),
      type: tipo,
      position: { x: 120 - pan.x / zoom + Math.random() * 60, y: 120 - pan.y / zoom + Math.random() * 60 },
      data: {},
    };
    mutar((f) => ({ ...f, nodes: [...f.nodes, node] }));
    setSelecionado(node.id);
  }

  function removerNo(nodeId: string) {
    mutar((f) => ({
      ...f,
      nodes: f.nodes.filter((n) => n.id !== nodeId),
      edges: f.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    }));
    if (selecionado === nodeId) setSelecionado(null);
  }

  function conectar(alvo: string) {
    if (!conectandoDe || conectandoDe.nodeId === alvo) {
      setConectandoDe(null);
      return;
    }
    const edge: FlowEdge = { id: gerarId('e_'), source: conectandoDe.nodeId, target: alvo, label: conectandoDe.label };
    mutar((f) => ({
      ...f,
      // substitui conexão existente da mesma porta
      edges: [...f.edges.filter((e) => !(e.source === edge.source && (e.label ?? '') === (edge.label ?? ''))), edge],
    }));
    setConectandoDe(null);
  }

  // ---------- mouse no canvas ----------
  function aoMouseDownCanvas(e: ReactMouseEvent) {
    if (e.target !== e.currentTarget) return;
    panRef.current = { ativo: true, x: e.clientX - pan.x, y: e.clientY - pan.y };
    setSelecionado(null);
    setConectandoDe(null);
  }

  function aoMouseMove(e: ReactMouseEvent) {
    if (arrastoRef.current && flow) {
      const { nodeId, dx, dy } = arrastoRef.current;
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom - dx;
      const y = (e.clientY - rect.top - pan.y) / zoom - dy;
      mutar((f) => ({ ...f, nodes: f.nodes.map((n) => (n.id === nodeId ? { ...n, position: { x, y } } : n)) }));
    } else if (panRef.current.ativo) {
      setPan({ x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y });
    }
  }

  function aoMouseUp() {
    panRef.current.ativo = false;
    arrastoRef.current = null;
  }

  function iniciarArrastoNo(e: ReactMouseEvent, node: FlowNode) {
    e.stopPropagation();
    const rect = canvasRef.current!.getBoundingClientRect();
    arrastoRef.current = {
      nodeId: node.id,
      dx: (e.clientX - rect.left - pan.x) / zoom - node.position.x,
      dy: (e.clientY - rect.top - pan.y) / zoom - node.position.y,
    };
    setSelecionado(node.id);
  }

  // ---------- persistência ----------
  async function salvar() {
    if (!flow || !id) return;
    setSalvando(true);
    try {
      await updateDoc(doc(db, 'flows', id), {
        name: flow.name, description: flow.description, trigger: flow.trigger,
        nodes: flow.nodes, edges: flow.edges, updatedAt: serverTimestamp(),
      });
      await registrar({ action: 'flow.updated', resourceType: 'flow', resourceId: id, resourceName: flow.name });
      toast('sucesso', 'Automação salva.');
    } catch {
      toast('erro', 'Erro ao salvar automação.');
    } finally {
      setSalvando(false);
    }
  }

  // ---------- editor JSON ----------
  function abrirJson() {
    if (!flow) return;
    setJsonTexto(JSON.stringify({ name: flow.name, trigger: flow.trigger, nodes: flow.nodes, edges: flow.edges }, null, 2));
    setModalJson(true);
  }

  function aplicarJson() {
    try {
      const valido = esquemaFlow.parse(JSON.parse(jsonTexto));
      mutar((f) => ({
        ...f,
        name: valido.name,
        trigger: valido.trigger as Flow['trigger'],
        nodes: valido.nodes as unknown as FlowNode[],
        edges: valido.edges as FlowEdge[],
      }));
      setModalJson(false);
      toast('sucesso', 'Schema aplicado.');
    } catch (e) {
      toast('erro', e instanceof z.ZodError ? `Schema inválido: ${e.errors[0]?.message}` : 'JSON malformado.');
    }
  }

  if (carregando) return <Spinner />;
  if (!flow) return <p className="text-sm text-gray-500">Automação não encontrada.</p>;

  return (
    <div className="flex h-[calc(100vh-110px)] flex-col">
      {/* barra superior */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link to="/automation" className="text-gray-500 hover:text-navy"><ArrowLeft size={16} /></Link>
        <input
          className="min-w-[160px] flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-bold text-navy hover:border-gray-200 focus:border-primary focus:outline-none"
          value={flow.name}
          onChange={(e) => mutar((f) => ({ ...f, name: e.target.value }))}
        />
        <Selecao
          value={flow.trigger.type}
          onChange={(e) => mutar((f) => ({ ...f, trigger: { type: e.target.value as Flow['trigger']['type'], config: {} } }))}
          className="w-52"
        >
          {CATALOGO_TRIGGERS.map((t) => <option key={t.tipo} value={t.tipo}>Trigger: {t.rotulo}</option>)}
        </Selecao>
        <Botao variante="ghost" icone={<Braces size={15} />} onClick={abrirJson}>JSON</Botao>
        <Botao variante="ghost" icone={<PlayCircle size={15} />} onClick={() => setModalSimular(true)}>Testar com contato</Botao>
        <Botao icone={<Save size={15} />} onClick={salvar} carregando={salvando}>Salvar</Botao>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[200px_1fr_280px]">
        {/* paleta */}
        <div className="overflow-y-auto rounded-xl border border-gray-100 bg-white p-2.5 shadow-card">
          <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-gray-400">Ações</h3>
          <div className="space-y-1">
            {CATALOGO_NOS.map(({ tipo, rotulo, icone: Icone, cor }) => (
              <button
                key={tipo}
                onClick={() => adicionarNo(tipo)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-gray-600 hover:bg-cloud"
              >
                <span className="rounded-md p-1" style={{ backgroundColor: `${cor}18`, color: cor }}><Icone size={13} /></span>
                {rotulo}
                <Plus size={11} className="ml-auto text-gray-300" />
              </button>
            ))}
          </div>
        </div>

        {/* ===== canvas ===== */}
        <div className="relative overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
          {/* controles de zoom */}
          <div className="absolute right-3 top-3 z-10 flex flex-col gap-1 rounded-lg border border-gray-100 bg-white p-1 shadow">
            <button onClick={() => setZoom((z) => Math.min(1.6, z + 0.15))} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Aproximar"><ZoomIn size={15} /></button>
            <button onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Afastar"><ZoomOut size={15} /></button>
          </div>
          {conectandoDe && (
            <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-navy shadow">
              Clique no nó de destino para conectar — ESC cancela
            </div>
          )}

          <div
            ref={canvasRef}
            className="h-full w-full cursor-grab active:cursor-grabbing"
            style={{ backgroundImage: 'radial-gradient(circle, #d8dbe8 1px, transparent 1px)', backgroundSize: `${22 * zoom}px ${22 * zoom}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }}
            onMouseDown={aoMouseDownCanvas}
            onMouseMove={aoMouseMove}
            onMouseUp={aoMouseUp}
            onMouseLeave={aoMouseUp}
            onKeyDown={(e) => e.key === 'Escape' && setConectandoDe(null)}
            tabIndex={0}
          >
            <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
              {/* arestas em SVG */}
              <svg className="pointer-events-none absolute" style={{ width: 4000, height: 3000, overflow: 'visible' }}>
                {flow.edges.map((e) => {
                  const de = flow.nodes.find((n) => n.id === e.source);
                  const para = flow.nodes.find((n) => n.id === e.target);
                  if (!de || !para) return null;
                  const x1 = de.position.x + NODE_W / 2;
                  const y1 = de.position.y + NODE_H;
                  const x2 = para.position.x + NODE_W / 2;
                  const y2 = para.position.y;
                  const meio = (y1 + y2) / 2;
                  return (
                    <g key={e.id}>
                      <path
                        d={`M ${x1} ${y1} C ${x1} ${meio}, ${x2} ${meio}, ${x2} ${y2}`}
                        fill="none"
                        stroke={e.label === 'não' ? '#dc2626' : e.label === 'sim' ? '#10b981' : '#0082C6'}
                        strokeWidth={2}
                      />
                      {e.label && (
                        <text x={(x1 + x2) / 2} y={meio - 4} textAnchor="middle" fontSize={11} fontWeight={700}
                          fill={e.label === 'não' ? '#dc2626' : '#10b981'}>
                          {e.label}
                        </text>
                      )}
                      <circle cx={x2} cy={y2} r={3.5} fill="#0082C6" />
                    </g>
                  );
                })}
              </svg>

              {/* nós */}
              {flow.nodes.map((node) => {
                const info = infoNo(node.type);
                const Icone = info.icone;
                const ativo = selecionado === node.id;
                const ehCondicao = node.type === 'condition';
                return (
                  <div
                    key={node.id}
                    style={{ left: node.position.x, top: node.position.y, width: NODE_W }}
                    className={`absolute select-none rounded-xl border-2 bg-white shadow-md transition-shadow ${
                      ativo ? 'border-primary shadow-lg' : 'border-gray-100'
                    } ${conectandoDe ? 'cursor-crosshair' : 'cursor-move'}`}
                    onMouseDown={(e) => !conectandoDe && iniciarArrastoNo(e, node)}
                    onClick={(e) => { e.stopPropagation(); if (conectandoDe) conectar(node.id); }}
                  >
                    <div className="flex items-center gap-2 px-3 py-2">
                      <span className="rounded-lg p-1.5" style={{ backgroundColor: `${info.cor}18`, color: info.cor }}>
                        <Icone size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-navy">{info.rotulo}</p>
                        <p className="truncate text-[10px] text-gray-400">{resumoNo(node)}</p>
                      </div>
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); removerNo(node.id); }}
                        className="text-gray-300 hover:text-red-500"
                        aria-label="Remover nó"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {/* portas de saída */}
                    {node.type !== 'end' && (
                      <div className="flex justify-center gap-2 pb-1.5">
                        {ehCondicao ? (
                          <>
                            <PortaSaida rotulo="sim" cor="#10b981" ativa={conectandoDe?.nodeId === node.id && conectandoDe.label === 'sim'}
                              onClick={(e) => { e.stopPropagation(); setConectandoDe({ nodeId: node.id, label: 'sim' }); }} />
                            <PortaSaida rotulo="não" cor="#dc2626" ativa={conectandoDe?.nodeId === node.id && conectandoDe.label === 'não'}
                              onClick={(e) => { e.stopPropagation(); setConectandoDe({ nodeId: node.id, label: 'não' }); }} />
                          </>
                        ) : (
                          <PortaSaida rotulo="próximo" cor="#0082C6" ativa={conectandoDe?.nodeId === node.id}
                            onClick={(e) => { e.stopPropagation(); setConectandoDe({ nodeId: node.id }); }} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ===== painel de configuração ===== */}
        <div className="overflow-y-auto rounded-xl border border-gray-100 bg-white p-4 shadow-card">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400">Configuração</h3>
          {noAtivo ? (
            <ConfigNo no={noAtivo} aoAtualizar={(data) => mutar((f) => ({ ...f, nodes: f.nodes.map((n) => (n.id === noAtivo.id ? { ...n, data: { ...n.data, ...data } } : n)) }))} />
          ) : (
            <ConfigTrigger flow={flow} mutar={mutar} />
          )}
        </div>
      </div>

      {/* modal JSON */}
      <Modal
        aberto={modalJson}
        titulo="Schema JSON do fluxo"
        onFechar={() => setModalJson(false)}
        largura="max-w-4xl"
        rodape={
          <>
            <Botao variante="ghost" icone={<UploadIcon size={14} />} onClick={() => {
              const input = document.createElement('input');
              input.type = 'file'; input.accept = '.json';
              input.onchange = async () => { const f = input.files?.[0]; if (f) setJsonTexto(await f.text()); };
              input.click();
            }}>Importar</Botao>
            <Botao variante="ghost" icone={<Download size={14} />} onClick={() => {
              const blob = new Blob([jsonTexto], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `${flow.name}.json`;
              a.click();
            }}>Exportar</Botao>
            <Botao variante="secondary" onClick={() => setModalJson(false)}>Cancelar</Botao>
            <Botao onClick={aplicarJson}>Aplicar</Botao>
          </>
        }
      >
        <div className="h-[55vh] overflow-hidden rounded-lg border border-gray-200">
          <Editor defaultLanguage="json" value={jsonTexto} onChange={(v) => setJsonTexto(v ?? '')} options={{ minimap: { enabled: false }, fontSize: 13 }} />
        </div>
      </Modal>

      {/* modal simulação */}
      <SimuladorFluxo aberto={modalSimular} flow={flow} onFechar={() => setModalSimular(false)} />
    </div>
  );
}

function PortaSaida({ rotulo, cor, ativa, onClick }: { rotulo: string; cor: string; ativa: boolean; onClick: (e: ReactMouseEvent) => void }) {
  return (
    <button
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className={`rounded-full border px-2 py-0.5 text-[9px] font-bold transition-colors ${ativa ? 'text-white' : 'bg-white'}`}
      style={{ borderColor: cor, color: ativa ? '#fff' : cor, backgroundColor: ativa ? cor : undefined }}
    >
      {rotulo} →
    </button>
  );
}

// ---------- resumo do nó no card ----------
function resumoNo(node: FlowNode): string {
  const d = node.data;
  switch (node.type) {
    case 'message_whatsapp': return String(d.texto ?? 'Sem mensagem').slice(0, 36);
    case 'message_email': return String(d.assunto ?? 'Sem assunto').slice(0, 36);
    case 'condition': return `${d.campo ?? '?'} ${d.operador ?? '='} ${d.valor ?? '?'}`;
    case 'delay': return `${d.quantidade ?? '?'} ${d.unidade ?? 'minutos'}`;
    case 'delay_until': return String(d.ate ?? 'data/hora');
    case 'apply_tag': case 'remove_tag': return String(d.tag ?? 'tag');
    case 'set_score': return `${d.operacao ?? 'definir'} ${d.valor ?? 0}`;
    case 'move_stage': return String(d.etapaNome ?? 'etapa');
    case 'assign_closer': return d.roundRobin ? 'round-robin' : String(d.closerNome ?? 'closer');
    case 'webhook_call': return String(d.url ?? 'URL').slice(0, 36);
    case 'human_handoff': return 'Transfere para o Inbox';
    case 'end': return 'Fim do fluxo';
    default: return '';
  }
}

// ---------- configuração do trigger ----------
function ConfigTrigger({ flow, mutar }: { flow: Flow; mutar: (fn: (f: Flow) => Flow) => void }) {
  const cfg = flow.trigger.config as Record<string, string>;
  function setCfg(k: string, v: string) {
    mutar((f) => ({ ...f, trigger: { ...f.trigger, config: { ...f.trigger.config, [k]: v } } }));
  }
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">Nenhum nó selecionado. Configure o trigger do fluxo:</p>
      <Badge cor="gold">{CATALOGO_TRIGGERS.find((t) => t.tipo === flow.trigger.type)?.rotulo}</Badge>
      {flow.trigger.type === 'form_submitted' && <Campo label="ID do formulário" value={cfg.formId ?? ''} onChange={(e) => setCfg('formId', e.target.value)} />}
      {(flow.trigger.type === 'tag_added' || flow.trigger.type === 'tag_removed') && <Campo label="Tag" value={cfg.tag ?? ''} onChange={(e) => setCfg('tag', e.target.value)} />}
      {flow.trigger.type === 'stage_changed' && <Campo label="ID da etapa" value={cfg.stageId ?? ''} onChange={(e) => setCfg('stageId', e.target.value)} />}
      {flow.trigger.type === 'score_reached' && <Campo label="Score mínimo" type="number" value={cfg.score ?? ''} onChange={(e) => setCfg('score', e.target.value)} />}
      {flow.trigger.type === 'webhook_received' && <Campo label="Chave do webhook" value={cfg.webhookKey ?? ''} onChange={(e) => setCfg('webhookKey', e.target.value)} />}
      {flow.trigger.type === 'scheduled' && <Campo label="Horário (HH:mm) ou intervalo em minutos" value={cfg.agenda ?? ''} onChange={(e) => setCfg('agenda', e.target.value)} />}
      <AreaTexto label="Descrição do fluxo" value={flow.description ?? ''} onChange={(e) => mutar((f) => ({ ...f, description: e.target.value || null }))} />
    </div>
  );
}

// ---------- configuração do nó selecionado ----------
function ConfigNo({ no, aoAtualizar }: { no: FlowNode; aoAtualizar: (data: Record<string, unknown>) => void }) {
  const d = no.data as Record<string, string | number | boolean>;
  const info = infoNo(no.type);
  return (
    <div className="space-y-4">
      <Badge cor="azul">{info.rotulo}</Badge>

      {no.type === 'message_whatsapp' && (
        <>
          <AreaTexto label="Mensagem" placeholder="Olá {{nome}}! ..." value={String(d.texto ?? '')} onChange={(e) => aoAtualizar({ texto: e.target.value })} />
          <p className="text-[11px] text-gray-400">Variáveis: {'{{nome}}'}, {'{{email}}'}, {'{{telefone}}'} e {'{{campo_formulario}}'}</p>
        </>
      )}

      {no.type === 'message_email' && (
        <>
          <Campo label="Assunto" value={String(d.assunto ?? '')} onChange={(e) => aoAtualizar({ assunto: e.target.value })} />
          <AreaTexto label="Corpo (HTML permitido)" value={String(d.html ?? '')} onChange={(e) => aoAtualizar({ html: e.target.value })} />
        </>
      )}

      {no.type === 'message_sms' && (
        <AreaTexto label="Texto do SMS" value={String(d.texto ?? '')} onChange={(e) => aoAtualizar({ texto: e.target.value })} />
      )}

      {no.type === 'condition' && (
        <>
          <Campo label="Campo do contato" placeholder="score | tag | etapa | resposta:ID" value={String(d.campo ?? '')} onChange={(e) => aoAtualizar({ campo: e.target.value })} />
          <Selecao label="Operador" value={String(d.operador ?? 'equals')} onChange={(e) => aoAtualizar({ operador: e.target.value })}>
            <option value="equals">igual a</option>
            <option value="not_equals">diferente de</option>
            <option value="contains">contém</option>
            <option value="greater_than">maior que</option>
            <option value="less_than">menor que</option>
          </Selecao>
          <Campo label="Valor" value={String(d.valor ?? '')} onChange={(e) => aoAtualizar({ valor: e.target.value })} />
          <p className="text-[11px] text-gray-400">Use as portas "sim" e "não" do nó para os dois caminhos.</p>
        </>
      )}

      {no.type === 'delay' && (
        <div className="grid grid-cols-2 gap-2">
          <Campo label="Quantidade" type="number" value={Number(d.quantidade ?? 1)} onChange={(e) => aoAtualizar({ quantidade: Number(e.target.value) })} />
          <Selecao label="Unidade" value={String(d.unidade ?? 'minutos')} onChange={(e) => aoAtualizar({ unidade: e.target.value })}>
            <option value="minutos">minutos</option>
            <option value="horas">horas</option>
            <option value="dias">dias</option>
          </Selecao>
        </div>
      )}

      {no.type === 'delay_until' && (
        <>
          <Campo label="Até (data/hora ou dia da semana + hora)" placeholder="2026-06-15 09:00 ou segunda 09:00" value={String(d.ate ?? '')} onChange={(e) => aoAtualizar({ ate: e.target.value })} />
        </>
      )}

      {(no.type === 'apply_tag' || no.type === 'remove_tag') && (
        <Campo label="Tag(s) — separe por vírgula" value={String(d.tag ?? '')} onChange={(e) => aoAtualizar({ tag: e.target.value })} />
      )}

      {no.type === 'set_score' && (
        <div className="grid grid-cols-2 gap-2">
          <Selecao label="Operação" value={String(d.operacao ?? 'definir')} onChange={(e) => aoAtualizar({ operacao: e.target.value })}>
            <option value="definir">Definir</option>
            <option value="incrementar">Incrementar</option>
            <option value="decrementar">Decrementar</option>
          </Selecao>
          <Campo label="Valor" type="number" value={Number(d.valor ?? 0)} onChange={(e) => aoAtualizar({ valor: Number(e.target.value) })} />
        </div>
      )}

      {no.type === 'move_stage' && (
        <>
          <Campo label="ID da etapa de destino" value={String(d.etapaId ?? '')} onChange={(e) => aoAtualizar({ etapaId: e.target.value })} />
          <Campo label="Nome da etapa (exibição)" value={String(d.etapaNome ?? '')} onChange={(e) => aoAtualizar({ etapaNome: e.target.value })} />
        </>
      )}

      {no.type === 'assign_closer' && (
        <>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={Boolean(d.roundRobin)} onChange={(e) => aoAtualizar({ roundRobin: e.target.checked })} />
            Distribuir por round-robin
          </label>
          {!d.roundRobin && (
            <>
              <Campo label="UID do closer" value={String(d.closerUid ?? '')} onChange={(e) => aoAtualizar({ closerUid: e.target.value })} />
              <Campo label="Nome (exibição)" value={String(d.closerNome ?? '')} onChange={(e) => aoAtualizar({ closerNome: e.target.value })} />
            </>
          )}
        </>
      )}

      {no.type === 'webhook_call' && (
        <>
          <Campo label="URL de destino" placeholder="https://..." value={String(d.url ?? '')} onChange={(e) => aoAtualizar({ url: e.target.value })} />
          <AreaTexto label="Payload JSON (variáveis permitidas)" value={String(d.payload ?? '{\n  "nome": "{{nome}}"\n}')} onChange={(e) => aoAtualizar({ payload: e.target.value })} />
        </>
      )}

      {no.type === 'human_handoff' && (
        <p className="text-xs text-gray-500">A conversa sai do modo bot e aparece como "Aberta" no Inbox para atendimento humano.</p>
      )}

      {no.type === 'end' && <p className="text-xs text-gray-500">Marca a conclusão do fluxo para o contato.</p>}
    </div>
  );
}

// =====================================================================
// Simulador dry-run: percorre o grafo a partir do primeiro nó
// =====================================================================
function SimuladorFluxo({ aberto, flow, onFechar }: { aberto: boolean; flow: Flow; onFechar: () => void }) {
  const [buscaContato, setBuscaContato] = useState('');
  const [contato, setContato] = useState<Contact | null>(null);
  const [caminho, setCaminho] = useState<string[]>([]);
  const toast = useUi((s) => s.toast);

  async function buscar() {
    const termo = buscaContato.trim().toLowerCase();
    if (!termo) return;
    const snap = await getDocs(query(collection(db, 'contacts'), where('email', '==', termo), limit(1)));
    if (snap.empty) {
      toast('aviso', 'Contato não encontrado pelo e-mail. A simulação usará um contato fictício.');
      setContato({ name: 'Lead de Teste', email: termo, phone: '5541999990000', tags: ['teste'], score: 50 } as unknown as Contact);
    } else {
      setContato({ ...(snap.docs[0].data() as Contact), id: snap.docs[0].id });
    }
  }

  function simular() {
    if (!contato) return;
    const passos: string[] = [`Trigger: ${CATALOGO_TRIGGERS.find((t) => t.tipo === flow.trigger.type)?.rotulo}`];
    // primeiro nó: sem aresta de entrada
    const comEntrada = new Set(flow.edges.map((e) => e.target));
    let atual: FlowNode | undefined = flow.nodes.find((n) => !comEntrada.has(n.id)) ?? flow.nodes[0];
    let protecao = 0;
    while (atual && protecao++ < 50) {
      const info = infoNo(atual.type);
      passos.push(`${info.rotulo} — ${resumoNo(atual)}`);
      if (atual.type === 'end') break;
      let proximaAresta = flow.edges.find((e) => e.source === atual!.id && !e.label);
      if (atual.type === 'condition') {
        // avalia a condição com os dados do contato
        const d = atual.data as Record<string, string>;
        const valorContato = d.campo === 'score' ? contato.score : d.campo === 'tag' ? contato.tags.join(',') : '';
        const v = String(valorContato);
        let resultado = false;
        switch (d.operador) {
          case 'equals': resultado = v === d.valor; break;
          case 'not_equals': resultado = v !== d.valor; break;
          case 'contains': resultado = v.includes(d.valor ?? ''); break;
          case 'greater_than': resultado = Number(v) > Number(d.valor); break;
          case 'less_than': resultado = Number(v) < Number(d.valor); break;
        }
        passos.push(`Condição avaliada: ${resultado ? 'SIM' : 'NÃO'}`);
        proximaAresta = flow.edges.find((e) => e.source === atual!.id && e.label === (resultado ? 'sim' : 'não'));
      }
      if (!proximaAresta) { passos.push('Fim (sem próxima conexão)'); break; }
      atual = flow.nodes.find((n) => n.id === proximaAresta!.target);
    }
    setCaminho(passos);
  }

  return (
    <Modal aberto={aberto} titulo="Simular execução (dry-run)" onFechar={onFechar} largura="max-w-xl">
      <div className="space-y-4">
        <div className="flex gap-2">
          <Campo placeholder="E-mail do contato para teste" value={buscaContato} onChange={(e) => setBuscaContato(e.target.value)} className="flex-1" />
          <Botao variante="secondary" onClick={buscar}>Buscar</Botao>
        </div>
        {contato && (
          <div className="flex items-center justify-between rounded-lg bg-cloud p-3 text-sm">
            <span className="font-semibold text-navy">{contato.name}</span>
            <span className="text-xs text-gray-500">score {contato.score} · tags: {contato.tags.join(', ') || '—'}</span>
            <Botao onClick={simular} icone={<PlayCircle size={14} />}>Executar simulação</Botao>
          </div>
        )}
        {caminho.length > 0 && (
          <div className="space-y-1.5">
            <p className="label-base">Caminho percorrido</p>
            {caminho.map((p, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-1.5 text-xs">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">{i + 1}</span>
                <span className="text-gray-700">{p}</span>
              </div>
            ))}
            <p className="text-[11px] text-gray-400">Simulação em modo dry-run — nenhuma mensagem foi enviada e nenhum dado foi alterado.</p>
          </div>
        )}
        {caminho.length > 0 && <button onClick={() => setCaminho([])} className="flex items-center gap-1 text-xs text-gray-400 hover:text-navy"><X size={11} /> Limpar</button>}
      </div>
    </Modal>
  );
}
