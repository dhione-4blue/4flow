// =====================================================================
// 4Flow — Relatórios: funil, canais, closers e formulários
// Filtros globais (período, pipeline, fonte, closer) + export CSV
// =====================================================================
import { useEffect, useMemo, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { collection, query, where, getDocs, limit, Timestamp } from 'firebase/firestore';
import { subDays } from 'date-fns';
import { Download, Filter as FilterIcon, BarChart3, Share2, UserCheck2, FormInput } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { db } from '../../lib/firebase';
import { useColecao } from '../../hooks/useColecao';
import { Botao, Cartao, Spinner, CabecalhoPagina, Selecao, Campo, Avatar, Badge, EstadoVazio } from '../../components/ui';
import { exportarCsv, fmtData } from '../../lib/utils';
import type { Contact, Pipeline, User, Form } from '../../types';

const TIPOS = [
  { id: 'funnel', rotulo: 'Funil', icone: BarChart3 },
  { id: 'channels', rotulo: 'Canais', icone: Share2 },
  { id: 'closers', rotulo: 'Closers', icone: UserCheck2 },
  { id: 'forms', rotulo: 'Formulários', icone: FormInput },
];

export default function ReportsPage() {
  const { tipo = 'funnel' } = useParams();
  const [contatos, setContatos] = useState<Contact[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [dias, setDias] = useState(30);
  const [pipelineId, setPipelineId] = useState('');
  const [fonte, setFonte] = useState('');
  const [closer, setCloser] = useState('');

  const { itens: pipelines } = useColecao<Pipeline>('pipelines', { tamanhoPagina: 50 });
  const { itens: usuarios } = useColecao<User>('users', { ordenarPor: 'name', direcao: 'asc', tamanhoPagina: 100 });
  const { itens: forms } = useColecao<Form>('forms', { tamanhoPagina: 100 });

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      try {
        const inicio = Timestamp.fromDate(subDays(new Date(), dias));
        const snap = await getDocs(query(collection(db, 'contacts'), where('createdAt', '>=', inicio), limit(3000)));
        setContatos(snap.docs.map((d) => ({ ...(d.data() as Contact), id: d.id })));
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [dias]);

  const filtrados = useMemo(() => contatos.filter((c) => {
    if (pipelineId && c.pipelineId !== pipelineId) return false;
    if (fonte && c.source !== fonte) return false;
    if (closer && c.assignedTo !== closer) return false;
    return true;
  }), [contatos, pipelineId, fonte, closer]);

  const pipeline = pipelines.find((p) => p.id === pipelineId) ?? pipelines.find((p) => p.isDefault) ?? pipelines[0];
  const fontes = useMemo(() => [...new Set(contatos.map((c) => c.source).filter(Boolean))], [contatos]);

  function exportar() {
    exportarCsv(
      `relatorio-${tipo}-${dias}d.csv`,
      filtrados.map((c) => ({
        nome: c.name, email: c.email ?? '', telefone: c.phone ?? '',
        fonte: c.source, score: c.score, tags: c.tags.join(','),
        etapa: pipeline?.stages.find((s) => s.id === c.pipelineStage)?.name ?? '',
        closer: usuarios.find((u) => (u.uid ?? u.id) === c.assignedTo)?.name ?? '',
        entrada: fmtData(c.createdAt),
      }))
    );
  }

  return (
    <div>
      <CabecalhoPagina
        titulo="Relatórios"
        acoes={<Botao variante="secondary" icone={<Download size={15} />} onClick={exportar}>Exportar CSV</Botao>}
      />

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-gray-200">
        {TIPOS.map(({ id, rotulo, icone: Icone }) => (
          <NavLink
            key={id}
            to={`/reports/${id}`}
            className={({ isActive }) =>
              `flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-navy'
              }`
            }
          >
            <Icone size={15} /> {rotulo}
          </NavLink>
        ))}
      </div>

      {/* filtros globais */}
      <Cartao className="mb-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          <FilterIcon size={13} /> Filtros
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Selecao label="Período" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
            <option value={365}>Último ano</option>
          </Selecao>
          <Selecao label="Pipeline" value={pipelineId} onChange={(e) => setPipelineId(e.target.value)}>
            <option value="">Padrão</option>
            {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Selecao>
          <Selecao label="Fonte / canal" value={fonte} onChange={(e) => setFonte(e.target.value)}>
            <option value="">Todas</option>
            {fontes.map((f) => <option key={f} value={f}>{f}</option>)}
          </Selecao>
          <Selecao label="Closer" value={closer} onChange={(e) => setCloser(e.target.value)}>
            <option value="">Todos</option>
            {usuarios.filter((u) => ['closer', 'operador', 'admin'].includes(u.role)).map((u) => (
              <option key={u.id} value={u.uid ?? u.id}>{u.name}</option>
            ))}
          </Selecao>
        </div>
      </Cartao>

      {carregando ? (
        <Spinner texto="Processando dados..." />
      ) : (
        <>
          {tipo === 'funnel' && <RelatorioFunil contatos={filtrados} pipeline={pipeline} />}
          {tipo === 'channels' && <RelatorioCanais contatos={filtrados} />}
          {tipo === 'closers' && <RelatorioClosers contatos={filtrados} usuarios={usuarios} pipeline={pipeline} />}
          {tipo === 'forms' && <RelatorioForms forms={forms} contatos={filtrados} />}
        </>
      )}
    </div>
  );
}

// ---------- Funil ----------
function RelatorioFunil({ contatos, pipeline }: { contatos: Contact[]; pipeline?: Pipeline }) {
  if (!pipeline) return <EstadoVazio titulo="Sem pipeline" descricao="Configure um pipeline para ver o funil de conversão." />;
  const etapas = [...pipeline.stages].sort((a, b) => a.order - b.order);
  const dados = etapas.map((s) => ({ etapa: s.name, total: contatos.filter((c) => c.pipelineStage === s.id).length, cor: s.color }));
  const max = Math.max(1, ...dados.map((d) => d.total));

  return (
    <Cartao>
      <h3 className="mb-5 text-sm font-bold text-navy">Conversão entre etapas — {pipeline.name}</h3>
      <div className="space-y-3">
        {dados.map((d, i) => {
          const anterior = i > 0 ? dados[i - 1].total : null;
          const conversao = anterior && anterior > 0 ? ((d.total / anterior) * 100).toFixed(0) : null;
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="w-32 truncate text-sm font-medium text-gray-600">{d.etapa}</span>
              <div className="h-9 flex-1 overflow-hidden rounded-lg bg-cloud">
                <div
                  className="flex h-full items-center rounded-lg px-3 text-sm font-bold text-white"
                  style={{ width: `${Math.max(7, (d.total / max) * 100)}%`, backgroundColor: d.cor || '#006AB1' }}
                >
                  {d.total}
                </div>
              </div>
              {conversao && <Badge cor={Number(conversao) >= 50 ? 'verde' : Number(conversao) >= 25 ? 'amarelo' : 'vermelho'}>{conversao}%</Badge>}
            </div>
          );
        })}
      </div>
    </Cartao>
  );
}

// ---------- Canais ----------
function RelatorioCanais({ contatos }: { contatos: Contact[] }) {
  const dados = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const c of contatos) mapa.set(c.source || 'desconhecida', (mapa.get(c.source || 'desconhecida') ?? 0) + 1);
    return [...mapa.entries()].map(([fonte, total]) => ({ fonte, total })).sort((a, b) => b.total - a.total);
  }, [contatos]);

  return (
    <Cartao>
      <h3 className="mb-4 text-sm font-bold text-navy">Leads por fonte / canal ({contatos.length} no período)</h3>
      <ResponsiveContainer width="100%" height={Math.max(220, dados.length * 36)}>
        <BarChart data={dados} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
          <YAxis type="category" dataKey="fonte" tick={{ fontSize: 11, fill: '#6b7280' }} width={150} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Bar dataKey="total" name="Leads" fill="#0082C6" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Cartao>
  );
}

// ---------- Closers ----------
function RelatorioClosers({ contatos, usuarios, pipeline }: { contatos: Contact[]; usuarios: User[]; pipeline?: Pipeline }) {
  const ultima = pipeline ? [...pipeline.stages].sort((a, b) => b.order - a.order)[0] : null;
  const linhas = useMemo(() => {
    const closers = usuarios.filter((u) => ['closer', 'operador', 'admin'].includes(u.role));
    return closers.map((u) => {
      const uid = u.uid ?? u.id;
      const atribuidos = contatos.filter((c) => c.assignedTo === uid);
      const convertidos = ultima ? atribuidos.filter((c) => c.pipelineStage === ultima.id) : [];
      const valor = convertidos.reduce((s, c) => s + (c.dealValue ?? 0), 0);
      return { user: u, atribuidos: atribuidos.length, convertidos: convertidos.length, valor,
        taxa: atribuidos.length > 0 ? ((convertidos.length / atribuidos.length) * 100).toFixed(0) : '0' };
    }).filter((l) => l.atribuidos > 0).sort((a, b) => b.convertidos - a.convertidos);
  }, [contatos, usuarios, ultima]);

  if (linhas.length === 0) return <EstadoVazio titulo="Sem dados" descricao="Nenhum lead atribuído a closers no período." />;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-card">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
            <th className="px-4 py-3">Closer</th>
            <th className="px-4 py-3">Leads atribuídos</th>
            <th className="px-4 py-3">Conversões</th>
            <th className="px-4 py-3">Taxa</th>
            <th className="px-4 py-3">Valor fechado</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.user.id} className="border-b border-gray-50 last:border-0">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Avatar nome={l.user.name} url={l.user.avatar} tamanho={28} />
                  <span className="font-semibold text-navy">{l.user.name}</span>
                </div>
              </td>
              <td className="px-4 py-3">{l.atribuidos}</td>
              <td className="px-4 py-3 font-semibold text-emerald-600">{l.convertidos}</td>
              <td className="px-4 py-3"><Badge cor={Number(l.taxa) >= 30 ? 'verde' : 'amarelo'}>{l.taxa}%</Badge></td>
              <td className="px-4 py-3 font-semibold">{l.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Formulários ----------
function RelatorioForms({ forms, contatos }: { forms: Form[]; contatos: Contact[] }) {
  const linhas = forms
    .filter((f) => f.status !== 'archived')
    .map((f) => {
      const leadsDoForm = contatos.filter((c) => c.formResponses?.some((r) => r.formId === f.id)).length;
      return { form: f, respostas: f.responses ?? 0, leads: leadsDoForm };
    })
    .sort((a, b) => b.respostas - a.respostas);

  if (linhas.length === 0) return <EstadoVazio titulo="Sem formulários" descricao="Crie formulários para acompanhar conversão de respostas." />;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-card">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
            <th className="px-4 py-3">Formulário</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Modo</th>
            <th className="px-4 py-3">Respostas</th>
            <th className="px-4 py-3">Leads no período</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.form.id} className="border-b border-gray-50 last:border-0">
              <td className="px-4 py-3 font-semibold text-navy">{l.form.name}</td>
              <td className="px-4 py-3">
                <Badge cor={l.form.status === 'published' ? 'verde' : 'amarelo'}>
                  {l.form.status === 'published' ? 'Publicado' : 'Rascunho'}
                </Badge>
              </td>
              <td className="px-4 py-3 text-gray-500">{l.form.mode === 'classic' ? 'Clássico' : 'Conversacional'}</td>
              <td className="px-4 py-3 font-semibold">{l.respostas}</td>
              <td className="px-4 py-3">{l.leads}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
