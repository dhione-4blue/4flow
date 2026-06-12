// =====================================================================
// 4Flow — Log de auditoria (somente admin, não deletável pela UI)
// Filtros por usuário, ação, recurso e período; expande before/after
// =====================================================================
import { useMemo, useState } from 'react';
import { where, type QueryConstraint } from 'firebase/firestore';
import { ChevronDown, ChevronRight, ScrollText } from 'lucide-react';
import { useColecao } from '../../hooks/useColecao';
import { Spinner, EstadoVazio, Campo, Selecao, Badge, Botao } from '../../components/ui';
import { fmtData } from '../../lib/utils';
import type { AuditLog } from '../../types';

export default function AuditSection() {
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroRecurso, setFiltroRecurso] = useState('');
  const [filtroAcao, setFiltroAcao] = useState('');
  const [expandido, setExpandido] = useState<string | null>(null);

  const filtros = useMemo(() => {
    const f: QueryConstraint[] = [];
    if (filtroRecurso) f.push(where('resourceType', '==', filtroRecurso));
    return f;
  }, [filtroRecurso]);

  const { itens, carregando, temMais, carregarMais } = useColecao<AuditLog>('audit_logs', {
    ordenarPor: 'timestamp', direcao: 'desc', filtros, tamanhoPagina: 50,
  });

  const visiveis = itens.filter((l) => {
    if (filtroUsuario && !l.userName?.toLowerCase().includes(filtroUsuario.toLowerCase())) return false;
    if (filtroAcao && !l.action?.includes(filtroAcao)) return false;
    return true;
  });

  if (carregando && itens.length === 0) return <Spinner />;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <ScrollText size={15} className="text-primary" />
        Registro imutável de todas as ações no sistema. Gravado pelo Apps Script com Admin SDK — não deletável pela interface.
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Campo label="Usuário" placeholder="nome..." value={filtroUsuario} onChange={(e) => setFiltroUsuario(e.target.value)} />
        <Campo label="Ação contém" placeholder="ex: stage.changed" value={filtroAcao} onChange={(e) => setFiltroAcao(e.target.value)} />
        <Selecao label="Recurso" value={filtroRecurso} onChange={(e) => setFiltroRecurso(e.target.value)}>
          <option value="">Todos</option>
          {['contact', 'user', 'form', 'flow', 'pipeline', 'webhook', 'conversation', 'email_campaign', 'import_batch'].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </Selecao>
      </div>

      {visiveis.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum evento registrado"
          descricao="Os logs aparecem aqui quando o Apps Script de auditoria estiver publicado e configurado no .env."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="w-8 px-2 py-3"></th>
                <th className="px-4 py-3">Quando</th>
                <th className="px-4 py-3">Usuário</th>
                <th className="px-4 py-3">Ação</th>
                <th className="px-4 py-3">Recurso</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => (
                <>
                  <tr
                    key={l.id}
                    onClick={() => setExpandido(expandido === l.id ? null : l.id)}
                    className="cursor-pointer border-b border-gray-50 hover:bg-cloud/60"
                  >
                    <td className="px-2 py-2.5 text-gray-300">
                      {expandido === l.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">{fmtData(l.timestamp)}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-navy">{l.userName}</span>
                      <span className="ml-1.5 text-[10px] uppercase text-gray-400">{l.userRole}</span>
                    </td>
                    <td className="px-4 py-2.5"><Badge cor="azul">{l.action}</Badge></td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {l.resourceType}{l.resourceName ? ` · ${l.resourceName}` : ''}
                    </td>
                    <td className="px-4 py-2.5 text-gray-400">{l.ip ?? '—'}</td>
                  </tr>
                  {expandido === l.id && (
                    <tr key={`${l.id}-detalhe`} className="border-b border-gray-50 bg-cloud/40">
                      <td colSpan={6} className="px-6 py-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="label-base">Antes</p>
                            <pre className="max-h-40 overflow-auto rounded-lg bg-navy p-2.5 text-[11px] text-emerald-300">
                              {l.before ? JSON.stringify(l.before, null, 2) : 'null'}
                            </pre>
                          </div>
                          <div>
                            <p className="label-base">Depois</p>
                            <pre className="max-h-40 overflow-auto rounded-lg bg-navy p-2.5 text-[11px] text-emerald-300">
                              {l.after ? JSON.stringify(l.after, null, 2) : 'null'}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {temMais && (
        <div className="mt-4 flex justify-center">
          <Botao variante="secondary" onClick={carregarMais}>Carregar mais</Botao>
        </div>
      )}
    </div>
  );
}
