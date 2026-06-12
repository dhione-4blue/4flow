// =====================================================================
// 4Flow — Respostas de um formulário
// Tabela de submissões, filtro por data, visualização por campo
// e exportação CSV. Clique na linha abre o perfil do lead.
// =====================================================================
import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, Download, ListFilter } from 'lucide-react';
import { db } from '../../lib/firebase';
import { Botao, Spinner, EstadoVazio, CabecalhoPagina, Campo, Selecao, Badge, Cartao } from '../../components/ui';
import { fmtData, exportarCsv } from '../../lib/utils';
import type { Form, FormSubmission } from '../../types';

export default function FormResponsesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form | null>(null);
  const [respostas, setRespostas] = useState<FormSubmission[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');
  const [campoFiltro, setCampoFiltro] = useState('');
  const [valorFiltro, setValorFiltro] = useState('');

  useEffect(() => {
    async function carregar() {
      if (!id) return;
      setCarregando(true);
      try {
        const fSnap = await getDoc(doc(db, 'forms', id));
        if (fSnap.exists()) setForm({ ...(fSnap.data() as Form), id: fSnap.id });
        const rSnap = await getDocs(
          query(collection(db, 'form_submissions'), where('formId', '==', id), orderBy('createdAt', 'desc'), limit(500))
        );
        setRespostas(rSnap.docs.map((d) => ({ ...(d.data() as FormSubmission), id: d.id })));
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [id]);

  const filtradas = useMemo(() => {
    return respostas.filter((r) => {
      const data = r.createdAt?.toDate?.();
      if (dataDe && data && data < new Date(dataDe)) return false;
      if (dataAte && data && data > new Date(dataAte + 'T23:59:59')) return false;
      if (campoFiltro && valorFiltro) {
        const campo = r.fields.find((f) => f.fieldId === campoFiltro);
        const v = Array.isArray(campo?.value) ? campo?.value.join(',') : String(campo?.value ?? '');
        if (!v.toLowerCase().includes(valorFiltro.toLowerCase())) return false;
      }
      return true;
    });
  }, [respostas, dataDe, dataAte, campoFiltro, valorFiltro]);

  function exportar() {
    exportarCsv(
      `respostas-${form?.name ?? 'formulario'}.csv`,
      filtradas.map((r) => {
        const linha: Record<string, unknown> = {
          data: fmtData(r.createdAt),
          nome: r.name ?? '', email: r.email ?? '', telefone: r.phone ?? '',
        };
        for (const f of r.fields) linha[f.label] = Array.isArray(f.value) ? f.value.join(', ') : f.value;
        return linha;
      })
    );
  }

  if (carregando) return <Spinner texto="Carregando respostas..." />;

  return (
    <div>
      <Link to="/forms" className="mb-3 flex items-center gap-1 text-sm text-gray-500 hover:text-navy">
        <ArrowLeft size={15} /> Formulários
      </Link>
      <CabecalhoPagina
        titulo={`Respostas — ${form?.name ?? ''}`}
        descricao={`${respostas.length} submissões no total`}
        acoes={<Botao variante="secondary" icone={<Download size={15} />} onClick={exportar}>Exportar CSV</Botao>}
      />

      <Cartao className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo label="De" type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} />
          <Campo label="Até" type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} />
          <Selecao label="Filtrar por campo" value={campoFiltro} onChange={(e) => setCampoFiltro(e.target.value)}>
            <option value="">— Qualquer —</option>
            {form?.fields.map((f) => <option key={f.id} value={f.id}>{f.label.slice(0, 40)}</option>)}
          </Selecao>
          <Campo label="Valor contém" placeholder="ex: Sim" value={valorFiltro} onChange={(e) => setValorFiltro(e.target.value)} />
        </div>
      </Cartao>

      {filtradas.length === 0 ? (
        <EstadoVazio titulo="Nenhuma resposta" descricao="As respostas recebidas pelo formulário público aparecerão aqui." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-card">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Resumo das respostas</th>
                <th className="px-4 py-3">Lead</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-gray-50 last:border-0 hover:bg-cloud/60 ${r.contactId ? 'cursor-pointer' : ''}`}
                  onClick={() => r.contactId && navigate(`/contacts/${r.contactId}`)}
                >
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">{fmtData(r.createdAt)}</td>
                  <td className="px-4 py-3 font-semibold text-navy">{r.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {r.email ?? ''}{r.email && r.phone ? ' · ' : ''}{r.phone ?? ''}
                  </td>
                  <td className="max-w-md px-4 py-3 text-gray-600">
                    <span className="line-clamp-2">
                      {r.fields.slice(0, 4).map((f) => `${f.label}: ${Array.isArray(f.value) ? f.value.join(',') : f.value}`).join(' · ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.contactId
                      ? <Badge cor="verde">Vinculado</Badge>
                      : <Badge cor="cinza"><span className="flex items-center gap-1"><ListFilter size={11} /> Pendente</span></Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
