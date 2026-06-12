// =====================================================================
// 4Flow — Importação de contatos via CSV
// Fluxo: upload → preview → mapeamento de colunas → config de
// duplicatas/tags/etapa → processamento em batches de 50 → relatório
// =====================================================================
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Papa from 'papaparse';
import {
  collection, addDoc, getDocs, query, where, updateDoc, doc, serverTimestamp, limit,
  type UpdateData, type DocumentData,
} from 'firebase/firestore';
import { UploadCloud, ArrowLeft, FileSpreadsheet, CheckCircle2, Download } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useUi } from '../../store/ui';
import { useAuth } from '../../store/auth';
import { useAuditLog } from '../../hooks/useAuditLog';
import { useColecao } from '../../hooks/useColecao';
import { Botao, Selecao, Campo, Cartao, CabecalhoPagina, Badge } from '../../components/ui';
import { normalizarTelefone, exportarCsv } from '../../lib/utils';
import type { Pipeline } from '../../types';

type Etapa = 'upload' | 'mapeamento' | 'processando' | 'concluido';

const CAMPOS_SISTEMA = [
  { id: 'name', rotulo: 'Nome', obrigatorio: true },
  { id: 'email', rotulo: 'E-mail', obrigatorio: false },
  { id: 'phone', rotulo: 'Telefone', obrigatorio: false },
  { id: 'tags', rotulo: 'Tags (separadas por vírgula)', obrigatorio: false },
  { id: 'score', rotulo: 'Score (0-100)', obrigatorio: false },
  { id: 'source', rotulo: 'Fonte', obrigatorio: false },
  { id: 'segment', rotulo: 'Segmento', obrigatorio: false },
  { id: 'dealValue', rotulo: 'Valor do deal', obrigatorio: false },
];

const TAMANHO_BATCH = 50;

export default function ContactImportPage() {
  const [etapa, setEtapa] = useState<Etapa>('upload');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [linhas, setLinhas] = useState<Record<string, string>[]>([]);
  const [colunas, setColunas] = useState<string[]>([]);
  const [mapeamento, setMapeamento] = useState<Record<string, string>>({});
  const [estrategiaDuplicata, setEstrategiaDuplicata] = useState<'update' | 'skip' | 'duplicate'>('update');
  const [tagsAuto, setTagsAuto] = useState('');
  const [pipelineDestino, setPipelineDestino] = useState('');
  const [etapaDestino, setEtapaDestino] = useState('');
  const [progresso, setProgresso] = useState(0);
  const [resultado, setResultado] = useState({ criados: 0, atualizados: 0, ignorados: 0, erros: [] as { linha: number; motivo: string }[] });
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);

  const toast = useUi((s) => s.toast);
  const perfil = useAuth((s) => s.perfil);
  const { registrar } = useAuditLog();
  const { itens: pipelines } = useColecao<Pipeline>('pipelines', { tamanhoPagina: 50 });

  function processarArquivo(f: File) {
    if (!f.name.toLowerCase().endsWith('.csv')) {
      toast('erro', 'Envie um arquivo .csv');
      return;
    }
    setArquivo(f);
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (res.data.length === 0) {
          toast('erro', 'O arquivo está vazio.');
          return;
        }
        setLinhas(res.data);
        const cols = res.meta.fields ?? [];
        setColunas(cols);
        // auto-mapeamento por similaridade de nome
        const auto: Record<string, string> = {};
        for (const campo of CAMPOS_SISTEMA) {
          const achada = cols.find((c) => {
            const n = c.toLowerCase();
            if (campo.id === 'name') return n.includes('nome') || n === 'name';
            if (campo.id === 'email') return n.includes('mail');
            if (campo.id === 'phone') return n.includes('telefone') || n.includes('celular') || n.includes('phone') || n.includes('whats');
            return n.includes(campo.id);
          });
          if (achada) auto[campo.id] = achada;
        }
        setMapeamento(auto);
        setEtapa('mapeamento');
      },
      error: () => toast('erro', 'Erro ao ler o CSV.'),
    });
  }

  async function importar() {
    if (!mapeamento.name) {
      toast('aviso', 'Mapeie ao menos a coluna de Nome.');
      return;
    }
    setEtapa('processando');
    const tags = tagsAuto.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    const res = { criados: 0, atualizados: 0, ignorados: 0, erros: [] as { linha: number; motivo: string }[] };

    // registra o batch de importação
    const batchRef = await addDoc(collection(db, 'import_batches'), {
      fileName: arquivo?.name ?? 'arquivo.csv',
      totalRows: linhas.length,
      created: 0, updated: 0, skipped: 0, errors: [],
      status: 'processing',
      columnMapping: mapeamento,
      duplicateStrategy: estrategiaDuplicata,
      importedBy: perfil?.uid ?? '',
      createdAt: serverTimestamp(),
      completedAt: null,
    });

    // processa em batches de 50 para não travar o navegador
    for (let i = 0; i < linhas.length; i += TAMANHO_BATCH) {
      const lote = linhas.slice(i, i + TAMANHO_BATCH);
      await Promise.all(
        lote.map(async (linha, j) => {
          const numLinha = i + j + 2; // +2: header + índice 1-based
          try {
            const nome = (linha[mapeamento.name] ?? '').trim();
            if (!nome) {
              res.erros.push({ linha: numLinha, motivo: 'Nome vazio' });
              return;
            }
            const telefone = mapeamento.phone ? normalizarTelefone(linha[mapeamento.phone] ?? '') : '';
            const email = mapeamento.email ? (linha[mapeamento.email] ?? '').trim().toLowerCase() : '';

            // deduplicação por telefone (prioritário) ou e-mail
            let existenteId: string | null = null;
            if (telefone) {
              const s = await getDocs(query(collection(db, 'contacts'), where('phone', '==', telefone), limit(1)));
              if (!s.empty) existenteId = s.docs[0].id;
            }
            if (!existenteId && email) {
              const s = await getDocs(query(collection(db, 'contacts'), where('email', '==', email), limit(1)));
              if (!s.empty) existenteId = s.docs[0].id;
            }

            const tagsLinha = mapeamento.tags
              ? (linha[mapeamento.tags] ?? '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
              : [];

            const dados: Record<string, unknown> = {
              name: nome,
              email: email || null,
              phone: telefone || null,
              tags: [...new Set([...tagsLinha, ...tags])],
              score: mapeamento.score ? Math.min(100, Math.max(0, Number(linha[mapeamento.score]) || 0)) : 0,
              source: mapeamento.source ? linha[mapeamento.source] || 'csv_import' : 'csv_import',
              sourceDetail: arquivo?.name ?? null,
              segment: mapeamento.segment ? linha[mapeamento.segment] || null : null,
              dealValue: mapeamento.dealValue ? Number(linha[mapeamento.dealValue]) || null : null,
              pipelineId: pipelineDestino || null,
              pipelineStage: etapaDestino || null,
              updatedAt: serverTimestamp(),
              importBatchId: batchRef.id,
            };

            if (existenteId) {
              if (estrategiaDuplicata === 'skip') {
                res.ignorados++;
                return;
              }
              if (estrategiaDuplicata === 'update') {
                await updateDoc(doc(db, 'contacts', existenteId), dados as UpdateData<DocumentData>);
                res.atualizados++;
                return;
              }
              // 'duplicate' cai no fluxo de criação abaixo
            }

            await addDoc(collection(db, 'contacts'), {
              ...dados,
              assignedTo: null, status: 'active', formResponses: [],
              createdAt: serverTimestamp(),
            });
            res.criados++;
          } catch (e) {
            res.erros.push({ linha: numLinha, motivo: e instanceof Error ? e.message : 'Erro desconhecido' });
          }
        })
      );
      setProgresso(Math.round(((i + lote.length) / linhas.length) * 100));
    }

    // finaliza o batch
    await updateDoc(doc(db, 'import_batches', batchRef.id), {
      created: res.criados, updated: res.atualizados, skipped: res.ignorados,
      errors: res.erros.slice(0, 200).map((e) => ({ row: e.linha, reason: e.motivo })),
      status: 'completed', completedAt: serverTimestamp(),
    });
    await registrar({
      action: 'contacts.imported', resourceType: 'import_batch', resourceId: batchRef.id,
      resourceName: arquivo?.name ?? '', after: { criados: res.criados, atualizados: res.atualizados, ignorados: res.ignorados, erros: res.erros.length },
    });

    setResultado(res);
    setEtapa('concluido');
  }

  return (
    <div className="max-w-3xl">
      <Link to="/contacts" className="mb-3 flex items-center gap-1 text-sm text-gray-500 hover:text-navy">
        <ArrowLeft size={15} /> Contatos
      </Link>
      <CabecalhoPagina titulo="Importar contatos via CSV" descricao="Upload, mapeamento de colunas, deduplicação e relatório completo." />

      {/* ===== ETAPA 1: UPLOAD ===== */}
      {etapa === 'upload' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            const f = e.dataTransfer.files[0];
            if (f) processarArquivo(f);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-14 text-center transition-colors ${
            arrastando ? 'border-primary bg-primary/5' : 'border-gray-300 bg-white hover:border-primary/60'
          }`}
        >
          <div className="rounded-full bg-primary/10 p-4 text-primary"><UploadCloud size={32} /></div>
          <div>
            <p className="font-semibold text-navy">Arraste o arquivo CSV aqui ou clique para selecionar</p>
            <p className="text-sm text-gray-500">A primeira linha deve conter os cabeçalhos das colunas.</p>
          </div>
          <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && processarArquivo(e.target.files[0])} />
        </div>
      )}

      {/* ===== ETAPA 2: MAPEAMENTO ===== */}
      {etapa === 'mapeamento' && (
        <div className="space-y-5">
          <Cartao>
            <div className="mb-3 flex items-center gap-2 text-sm text-gray-500">
              <FileSpreadsheet size={16} className="text-primary" />
              <strong className="text-navy">{arquivo?.name}</strong> — {linhas.length} linhas
            </div>
            {/* preview das 10 primeiras linhas */}
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-cloud text-left text-gray-500">
                    {colunas.map((c) => <th key={c} className="whitespace-nowrap px-3 py-2 font-semibold">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {linhas.slice(0, 10).map((l, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      {colunas.map((c) => <td key={c} className="whitespace-nowrap px-3 py-1.5 text-gray-600">{l[c]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Cartao>

          <Cartao>
            <h3 className="mb-4 font-bold text-navy">Mapeamento de colunas</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {CAMPOS_SISTEMA.map((campo) => (
                <Selecao
                  key={campo.id}
                  label={`${campo.rotulo}${campo.obrigatorio ? ' *' : ''}`}
                  value={mapeamento[campo.id] ?? ''}
                  onChange={(e) => setMapeamento({ ...mapeamento, [campo.id]: e.target.value })}
                >
                  <option value="">— Não importar —</option>
                  {colunas.map((c) => <option key={c} value={c}>{c}</option>)}
                </Selecao>
              ))}
            </div>
          </Cartao>

          <Cartao>
            <h3 className="mb-4 font-bold text-navy">Configurações da importação</h3>
            <div className="space-y-4">
              <Selecao
                label="Se o telefone ou e-mail já existir no sistema"
                value={estrategiaDuplicata}
                onChange={(e) => setEstrategiaDuplicata(e.target.value as typeof estrategiaDuplicata)}
              >
                <option value="update">Atualizar o contato existente</option>
                <option value="skip">Ignorar a linha</option>
                <option value="duplicate">Criar duplicata mesmo assim</option>
              </Selecao>
              <Campo
                label="Aplicar tags a todos os leads desta importação (separadas por vírgula)"
                placeholder="ex: otr-2026, importacao-junho"
                value={tagsAuto}
                onChange={(e) => setTagsAuto(e.target.value)}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Selecao label="Mover para pipeline (opcional)" value={pipelineDestino} onChange={(e) => { setPipelineDestino(e.target.value); setEtapaDestino(''); }}>
                  <option value="">Nenhum</option>
                  {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Selecao>
                <Selecao label="Etapa de destino" value={etapaDestino} onChange={(e) => setEtapaDestino(e.target.value)} disabled={!pipelineDestino}>
                  <option value="">Nenhuma</option>
                  {pipelines.find((p) => p.id === pipelineDestino)?.stages.sort((a, b) => a.order - b.order).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Selecao>
              </div>
            </div>
          </Cartao>

          <div className="flex justify-between">
            <Botao variante="secondary" onClick={() => setEtapa('upload')}>Voltar</Botao>
            <Botao onClick={importar}>Importar {linhas.length} contatos</Botao>
          </div>
        </div>
      )}

      {/* ===== ETAPA 3: PROCESSANDO ===== */}
      {etapa === 'processando' && (
        <Cartao className="text-center">
          <h3 className="mb-4 font-bold text-navy">Importando contatos...</h3>
          <div className="mx-auto mb-3 h-3 max-w-md overflow-hidden rounded-full bg-gray-200">
            <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progresso}%` }} />
          </div>
          <p className="text-sm text-gray-500">{progresso}% — processando em lotes de {TAMANHO_BATCH} registros</p>
        </Cartao>
      )}

      {/* ===== ETAPA 4: RELATÓRIO ===== */}
      {etapa === 'concluido' && (
        <div className="space-y-5">
          <Cartao className="text-center">
            <div className="mx-auto mb-3 w-fit rounded-full bg-emerald-50 p-4 text-emerald-600"><CheckCircle2 size={32} /></div>
            <h3 className="mb-1 text-lg font-bold text-navy">Importação concluída</h3>
            <p className="mb-5 text-sm text-gray-500">{arquivo?.name} — {linhas.length} linhas processadas</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-emerald-50 p-4"><div className="text-2xl font-bold text-emerald-700">{resultado.criados}</div><div className="text-xs text-emerald-600">Criados</div></div>
              <div className="rounded-xl bg-sky/10 p-4"><div className="text-2xl font-bold text-ocean">{resultado.atualizados}</div><div className="text-xs text-sky">Atualizados</div></div>
              <div className="rounded-xl bg-gray-100 p-4"><div className="text-2xl font-bold text-gray-600">{resultado.ignorados}</div><div className="text-xs text-gray-500">Ignorados</div></div>
              <div className="rounded-xl bg-red-50 p-4"><div className="text-2xl font-bold text-red-600">{resultado.erros.length}</div><div className="text-xs text-red-500">Erros</div></div>
            </div>
          </Cartao>

          {resultado.erros.length > 0 && (
            <Cartao>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-bold text-navy">Erros encontrados</h3>
                <Botao
                  variante="secondary"
                  icone={<Download size={14} />}
                  onClick={() => exportarCsv('erros-importacao.csv', resultado.erros.map((e) => ({ linha: e.linha, motivo: e.motivo })))}
                >
                  Exportar erros em CSV
                </Botao>
              </div>
              <div className="max-h-60 space-y-1 overflow-y-auto">
                {resultado.erros.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-red-50/50 px-3 py-1.5 text-xs">
                    <Badge cor="vermelho">Linha {e.linha}</Badge>
                    <span className="text-gray-600">{e.motivo}</span>
                  </div>
                ))}
              </div>
            </Cartao>
          )}

          <div className="flex justify-end gap-2">
            <Botao variante="secondary" onClick={() => { setEtapa('upload'); setProgresso(0); }}>Nova importação</Botao>
            <Link to="/contacts"><Botao>Ver contatos</Botao></Link>
          </div>
        </div>
      )}
    </div>
  );
}
