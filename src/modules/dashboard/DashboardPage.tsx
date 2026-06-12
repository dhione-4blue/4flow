// =====================================================================
// 4Flow — Dashboard principal (home)
// Cards de métricas + gráficos: leads/dia, leads por fonte,
// funil do pipeline padrão e ranking de closers
// =====================================================================
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, limit, Timestamp } from 'firebase/firestore';
import { subDays, format, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Users, MessageSquare, AlarmClock, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid,
} from 'recharts';
import { db } from '../../lib/firebase';
import { useColecao } from '../../hooks/useColecao';
import { Cartao, Spinner, Avatar, Badge } from '../../components/ui';
import type { Contact, Conversation, Pipeline, User } from '../../types';

export default function DashboardPage() {
  const [contatos, setContatos] = useState<Contact[]>([]);
  const [conversas, setConversas] = useState<Conversation[]>([]);
  const [carregando, setCarregando] = useState(true);
  const { itens: pipelines } = useColecao<Pipeline>('pipelines', { tamanhoPagina: 50 });
  const { itens: usuarios } = useColecao<User>('users', { ordenarPor: 'name', direcao: 'asc', tamanhoPagina: 100 });

  useEffect(() => {
    async function carregar() {
      try {
        const inicio = Timestamp.fromDate(subDays(new Date(), 60));
        const [cSnap, vSnap] = await Promise.all([
          getDocs(query(collection(db, 'contacts'), where('createdAt', '>=', inicio), limit(2000))),
          getDocs(query(collection(db, 'conversations'), limit(500))),
        ]);
        setContatos(cSnap.docs.map((d) => ({ ...(d.data() as Contact), id: d.id })));
        setConversas(vSnap.docs.map((d) => ({ ...(d.data() as Conversation), id: d.id })));
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, []);

  const metricas = useMemo(() => {
    const agora = new Date();
    const hoje = startOfDay(agora);
    const semana = subDays(agora, 7);
    const mes = subDays(agora, 30);
    const mesAnterior = subDays(agora, 60);

    const dataDe = (c: Contact) => c.createdAt?.toDate?.() ?? new Date(0);
    const leadsHoje = contatos.filter((c) => dataDe(c) >= hoje).length;
    const leadsSemana = contatos.filter((c) => dataDe(c) >= semana).length;
    const leadsMes = contatos.filter((c) => dataDe(c) >= mes).length;
    const leadsMesAnterior = contatos.filter((c) => { const d = dataDe(c); return d >= mesAnterior && d < mes; }).length;
    const variacao = leadsMesAnterior > 0 ? Math.round(((leadsMes - leadsMesAnterior) / leadsMesAnterior) * 100) : null;

    const conversasAbertas = conversas.filter((c) => c.status === 'open' || c.status === 'pending').length;
    const em2h = new Date(agora.getTime() + 2 * 36e5);
    const slasVencendo = conversas.filter((c) => {
      const sla = c.slaDeadline?.toDate?.();
      return sla && sla <= em2h && c.status !== 'resolved';
    }).length;

    // conversão: leads do mês na última etapa do pipeline padrão
    const padrao = pipelines.find((p) => p.isDefault) ?? pipelines[0];
    const ultimaEtapa = padrao ? [...padrao.stages].sort((a, b) => b.order - a.order)[0] : null;
    const doMes = contatos.filter((c) => dataDe(c) >= mes);
    const convertidos = ultimaEtapa ? doMes.filter((c) => c.pipelineStage === ultimaEtapa.id).length : 0;
    const taxa = doMes.length > 0 ? ((convertidos / doMes.length) * 100).toFixed(1) : '0.0';

    return { leadsHoje, leadsSemana, leadsMes, variacao, conversasAbertas, slasVencendo, taxa };
  }, [contatos, conversas, pipelines]);

  // série: leads por dia (30 dias)
  const seriePorDia = useMemo(() => {
    const dias: { dia: string; leads: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = startOfDay(subDays(new Date(), i));
      const prox = startOfDay(subDays(new Date(), i - 1));
      const total = contatos.filter((c) => {
        const dt = c.createdAt?.toDate?.();
        return dt && dt >= d && dt < prox;
      }).length;
      dias.push({ dia: format(d, 'dd/MM', { locale: ptBR }), leads: total });
    }
    return dias;
  }, [contatos]);

  // leads por fonte
  const porFonte = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const c of contatos) mapa.set(c.source || 'desconhecida', (mapa.get(c.source || 'desconhecida') ?? 0) + 1);
    return [...mapa.entries()].map(([fonte, total]) => ({ fonte, total })).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [contatos]);

  // funil do pipeline padrão
  const funil = useMemo(() => {
    const padrao = pipelines.find((p) => p.isDefault) ?? pipelines[0];
    if (!padrao) return [];
    return [...padrao.stages].sort((a, b) => a.order - b.order).map((s) => ({
      etapa: s.name,
      total: contatos.filter((c) => c.pipelineStage === s.id).length,
      cor: s.color,
    }));
  }, [pipelines, contatos]);

  // ranking de closers por leads na última etapa
  const ranking = useMemo(() => {
    const padrao = pipelines.find((p) => p.isDefault) ?? pipelines[0];
    const ultima = padrao ? [...padrao.stages].sort((a, b) => b.order - a.order)[0] : null;
    const mapa = new Map<string, number>();
    for (const c of contatos) {
      if (c.assignedTo && (!ultima || c.pipelineStage === ultima.id)) {
        mapa.set(c.assignedTo, (mapa.get(c.assignedTo) ?? 0) + 1);
      }
    }
    return [...mapa.entries()]
      .map(([uid, total]) => ({ user: usuarios.find((u) => (u.uid ?? u.id) === uid), total }))
      .filter((r) => r.user)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [contatos, usuarios, pipelines]);

  if (carregando) return <Spinner texto="Carregando métricas..." />;

  const maxFunil = Math.max(1, ...funil.map((f) => f.total));

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-navy">Dashboard</h1>

      {/* ===== cards de métricas ===== */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CardMetrica
          icone={<Users size={18} />}
          rotulo="Leads (hoje / semana / mês)"
          valor={`${metricas.leadsHoje} / ${metricas.leadsSemana} / ${metricas.leadsMes}`}
          extra={metricas.variacao != null ? `${metricas.variacao >= 0 ? '+' : ''}${metricas.variacao}% vs mês anterior` : undefined}
          positivo={(metricas.variacao ?? 0) >= 0}
        />
        <CardMetrica icone={<MessageSquare size={18} />} rotulo="Conversas abertas" valor={String(metricas.conversasAbertas)} link="/inbox" />
        <CardMetrica icone={<AlarmClock size={18} />} rotulo="SLAs vencendo em 2h" valor={String(metricas.slasVencendo)} alerta={metricas.slasVencendo > 0} />
        <CardMetrica icone={<TrendingUp size={18} />} rotulo="Taxa de conversão (30d)" valor={`${metricas.taxa}%`} />
      </div>

      {/* ===== gráficos ===== */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Cartao>
          <h3 className="mb-4 text-sm font-bold text-navy">Volume de leads por dia (últimos 30 dias)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={seriePorDia}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" />
              <XAxis dataKey="dia" tick={{ fontSize: 10, fill: '#9ca3af' }} interval={4} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} width={28} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Line type="monotone" dataKey="leads" name="Leads" stroke="#006AB1" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Cartao>

        <Cartao>
          <h3 className="mb-4 text-sm font-bold text-navy">Leads por fonte / canal</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={porFonte} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
              <YAxis type="category" dataKey="fonte" tick={{ fontSize: 10, fill: '#6b7280' }} width={110} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="total" name="Leads" fill="#0082C6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Cartao>

        <Cartao>
          <h3 className="mb-4 text-sm font-bold text-navy">Funil — pipeline principal</h3>
          {funil.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Configure um pipeline para ver o funil.</p>
          ) : (
            <div className="space-y-2">
              {funil.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-28 truncate text-xs font-medium text-gray-600">{f.etapa}</span>
                  <div className="h-7 flex-1 overflow-hidden rounded-lg bg-cloud">
                    <div
                      className="flex h-full items-center rounded-lg px-2 text-xs font-bold text-white transition-all"
                      style={{ width: `${Math.max(8, (f.total / maxFunil) * 100)}%`, backgroundColor: f.cor || '#006AB1' }}
                    >
                      {f.total}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Cartao>

        <Cartao>
          <h3 className="mb-4 text-sm font-bold text-navy">Ranking de closers (conversões)</h3>
          {ranking.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Sem conversões atribuídas no período.</p>
          ) : (
            <div className="space-y-2.5">
              {ranking.map((r, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-5 text-center text-sm font-bold text-gray-300">{i + 1}</span>
                  <Avatar nome={r.user!.name} url={r.user!.avatar} tamanho={30} />
                  <span className="flex-1 text-sm font-medium text-navy">{r.user!.name}</span>
                  <Badge cor="gold">{r.total} conversões</Badge>
                </div>
              ))}
            </div>
          )}
        </Cartao>
      </div>
    </div>
  );
}

function CardMetrica({ icone, rotulo, valor, extra, positivo, alerta, link }: {
  icone: React.ReactNode; rotulo: string; valor: string;
  extra?: string; positivo?: boolean; alerta?: boolean; link?: string;
}) {
  const conteudo = (
    <Cartao className={`h-full transition-shadow hover:shadow-md ${alerta ? 'border-red-200 bg-red-50/40' : ''}`}>
      <div className={`mb-2 w-fit rounded-lg p-2 ${alerta ? 'bg-red-100 text-red-600' : 'bg-primary/10 text-primary'}`}>{icone}</div>
      <div className="text-lg font-extrabold text-navy">{valor}</div>
      <div className="text-xs text-gray-500">{rotulo}</div>
      {extra && <div className={`mt-1 text-[11px] font-semibold ${positivo ? 'text-emerald-600' : 'text-red-500'}`}>{extra}</div>}
    </Cartao>
  );
  return link ? <Link to={link}>{conteudo}</Link> : conteudo;
}
