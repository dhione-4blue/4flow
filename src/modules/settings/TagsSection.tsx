// =====================================================================
// 4Flow — Gerenciamento de tags do sistema
// =====================================================================
import { useState } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Plus, Trash2, Tag as TagIcon } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useColecao } from '../../hooks/useColecao';
import { useUi } from '../../store/ui';
import { useAuditLog } from '../../hooks/useAuditLog';
import { Botao, Campo, Cartao, Spinner, EstadoVazio, ModalConfirmacao } from '../../components/ui';
import type { TagDef } from '../../types';

const CORES = ['#006AB1', '#0082C6', '#03427D', '#F8B90C', '#10b981', '#7c3aed', '#dc2626', '#6b7280'];

export default function TagsSection() {
  const { itens: tags, carregando, recarregar } = useColecao<TagDef>('tags', { ordenarPor: 'name', direcao: 'asc', tamanhoPagina: 200 });
  const toast = useUi((s) => s.toast);
  const { registrar } = useAuditLog();
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState(CORES[0]);
  const [confirmando, setConfirmando] = useState<TagDef | null>(null);

  async function criar() {
    const limpo = nome.trim().toLowerCase().replace(/\s+/g, '-');
    if (!limpo) return;
    if (tags.some((t) => t.name === limpo)) {
      toast('aviso', 'Essa tag já existe.');
      return;
    }
    await addDoc(collection(db, 'tags'), { name: limpo, color: cor, contactCount: 0, createdAt: serverTimestamp() });
    await registrar({ action: 'tag.created', resourceType: 'tag', resourceId: limpo, resourceName: limpo });
    setNome('');
    toast('sucesso', `Tag "${limpo}" criada.`);
    recarregar();
  }

  if (carregando) return <Spinner />;

  return (
    <div className="max-w-2xl space-y-5">
      <Cartao>
        <h3 className="mb-3 font-bold text-navy">Nova tag</h3>
        <div className="flex flex-wrap items-end gap-2">
          <Campo label="Nome" placeholder="ex: otr-2026" value={nome} onChange={(e) => setNome(e.target.value)} className="min-w-[180px] flex-1" />
          <div>
            <label className="label-base">Cor</label>
            <div className="flex gap-1">
              {CORES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCor(c)}
                  className={`h-8 w-8 rounded-lg border-2 ${cor === c ? 'border-navy' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>
          <Botao icone={<Plus size={15} />} onClick={criar}>Criar</Botao>
        </div>
        <p className="mt-2 text-xs text-gray-400">Tags em minúsculas, sem espaços (viram hífens). Também é possível criar tags livres direto no perfil do contato.</p>
      </Cartao>

      {tags.length === 0 ? (
        <EstadoVazio titulo="Nenhuma tag cadastrada" descricao="Tags organizam, segmentam e disparam automações." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {tags.map((t) => (
            <div key={t.id} className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-card">
              <span className="rounded-lg p-1.5" style={{ backgroundColor: `${t.color}18`, color: t.color }}>
                <TagIcon size={14} />
              </span>
              <span className="flex-1 text-sm font-semibold text-navy">{t.name}</span>
              <span className="text-xs text-gray-400">{t.contactCount} contatos</span>
              <button onClick={() => setConfirmando(t)} className="text-gray-300 hover:text-red-500" aria-label="Excluir tag">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <ModalConfirmacao
        aberto={Boolean(confirmando)}
        titulo="Excluir tag"
        mensagem={`A tag "${confirmando?.name}" será removida do catálogo. Ela NÃO é removida automaticamente dos contatos que já a possuem.`}
        textoConfirmar="Excluir"
        onConfirmar={async () => {
          if (confirmando) {
            await deleteDoc(doc(db, 'tags', confirmando.id));
            await registrar({ action: 'tag.deleted', resourceType: 'tag', resourceId: confirmando.name });
            setConfirmando(null);
            recarregar();
          }
        }}
        onCancelar={() => setConfirmando(null)}
      />
    </div>
  );
}
