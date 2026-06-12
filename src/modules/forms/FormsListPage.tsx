// =====================================================================
// 4Flow — Listagem de formulários
// Inclui geração de código de embed (iframe + script, estilo
// ActiveCampaign) e link público
// =====================================================================
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addDoc, collection, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { Plus, Code2, ExternalLink, BarChart2, Pencil, Copy, Archive } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useColecao } from '../../hooks/useColecao';
import { useAuth } from '../../store/auth';
import { useUi } from '../../store/ui';
import { useAuditLog } from '../../hooks/useAuditLog';
import { Botao, Badge, Spinner, EstadoVazio, CabecalhoPagina, Modal, Campo, Cartao } from '../../components/ui';
import { fmtData } from '../../lib/utils';
import type { Form } from '../../types';

const URL_APP = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) ?? window.location.origin;

/** Gera os snippets de embed de um formulário */
export function gerarEmbed(formId: string) {
  const urlPublica = `${URL_APP}/#/f/${formId}`;
  return {
    urlPublica,
    iframe: `<iframe src="${urlPublica}" id="_4flow-form-${formId}" style="width:100%;border:none;min-height:560px" title="Formulário 4Flow" allow="camera; microphone"></iframe>\n<script>window.addEventListener("message",function(e){var f=document.getElementById("_4flow-form-${formId}");if(f&&e.data&&e.data._4flowHeight&&e.data.formId==="${formId}")f.style.height=e.data._4flowHeight+"px"});</script>`,
    script: `<div data-4flow-form="${formId}"></div>\n<script src="${URL_APP}/embed.js" async></script>`,
  };
}

export default function FormsListPage() {
  const { itens: forms, carregando, recarregar } = useColecao<Form>('forms', { ordenarPor: 'updatedAt', direcao: 'desc' });
  const perfil = useAuth((s) => s.perfil);
  const toast = useUi((s) => s.toast);
  const { registrar } = useAuditLog();
  const navigate = useNavigate();
  const [modalEmbed, setModalEmbed] = useState<Form | null>(null);
  const [criando, setCriando] = useState(false);

  async function criarFormulario() {
    setCriando(true);
    try {
      const ref = await addDoc(collection(db, 'forms'), {
        name: 'Novo formulário',
        description: null,
        mode: 'classic',
        status: 'draft',
        fields: [],
        settings: {
          redirectUrl: null, webhookUrl: null,
          thankYouMessage: 'Obrigado pela sua resposta!',
          progressBar: true, allowMultipleSubmissions: true,
          primaryColor: '#006AB1', logoUrl: null,
          backgroundType: 'color', backgroundColor: '#F3F3FA', backgroundImageUrl: null,
        },
        embedCode: '',
        responses: 0,
        createdBy: perfil?.uid ?? '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'forms', ref.id), { embedCode: gerarEmbed(ref.id).iframe });
      await registrar({ action: 'form.created', resourceType: 'form', resourceId: ref.id, resourceName: 'Novo formulário' });
      navigate(`/forms/${ref.id}/edit`);
    } catch {
      toast('erro', 'Erro ao criar formulário.');
    } finally {
      setCriando(false);
    }
  }

  async function alternarStatus(f: Form) {
    const novo = f.status === 'published' ? 'draft' : 'published';
    await updateDoc(doc(db, 'forms', f.id), { status: novo, updatedAt: serverTimestamp() });
    await registrar({ action: `form.${novo}`, resourceType: 'form', resourceId: f.id, resourceName: f.name });
    toast('sucesso', novo === 'published' ? 'Formulário publicado.' : 'Formulário despublicado.');
    recarregar();
  }

  async function arquivarForm(f: Form) {
    await updateDoc(doc(db, 'forms', f.id), { status: 'archived', updatedAt: serverTimestamp() });
    await registrar({ action: 'form.archived', resourceType: 'form', resourceId: f.id, resourceName: f.name });
    recarregar();
  }

  function copiar(texto: string, rotulo: string) {
    navigator.clipboard.writeText(texto);
    toast('sucesso', `${rotulo} copiado para a área de transferência.`);
  }

  if (carregando && forms.length === 0) return <Spinner />;

  const ativos = forms.filter((f) => f.status !== 'archived');

  return (
    <div>
      <CabecalhoPagina
        titulo="Formulários"
        descricao="Crie formulários e quizzes para captação e qualificação de leads"
        acoes={<Botao icone={<Plus size={15} />} onClick={criarFormulario} carregando={criando}>Novo formulário</Botao>}
      />

      {ativos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum formulário criado"
          descricao="Crie seu primeiro formulário com o builder visual — modo clássico ou conversacional."
          acao={<Botao icone={<Plus size={15} />} onClick={criarFormulario}>Criar formulário</Botao>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ativos.map((f) => (
            <Cartao key={f.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-navy">{f.name}</h3>
                  <p className="text-xs text-gray-400">Atualizado {fmtData(f.updatedAt, 'dd/MM/yyyy')}</p>
                </div>
                <Badge cor={f.status === 'published' ? 'verde' : 'amarelo'}>
                  {f.status === 'published' ? 'Publicado' : 'Rascunho'}
                </Badge>
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-500">
                <Badge cor="cinza">{f.mode === 'classic' ? 'Clássico' : 'Conversacional'}</Badge>
                <span>{f.fields?.length ?? 0} campos</span>
                <span>{f.responses ?? 0} respostas</span>
              </div>

              <div className="mt-auto flex flex-wrap gap-1.5 border-t border-gray-50 pt-3">
                <Link to={`/forms/${f.id}/edit`}><Botao variante="ghost" icone={<Pencil size={14} />}>Editar</Botao></Link>
                <Link to={`/forms/${f.id}/responses`}><Botao variante="ghost" icone={<BarChart2 size={14} />}>Respostas</Botao></Link>
                <Botao variante="ghost" icone={<Code2 size={14} />} onClick={() => setModalEmbed(f)}>Embed</Botao>
                <Botao variante="ghost" icone={<Archive size={14} />} onClick={() => arquivarForm(f)}>Arquivar</Botao>
                <Botao variante={f.status === 'published' ? 'secondary' : 'gold'} onClick={() => alternarStatus(f)} className="ml-auto !px-3 !py-1.5 text-xs">
                  {f.status === 'published' ? 'Despublicar' : 'Publicar'}
                </Botao>
              </div>
            </Cartao>
          ))}
        </div>
      )}

      {/* ===== Modal de embed (estilo ActiveCampaign) ===== */}
      <Modal aberto={Boolean(modalEmbed)} titulo={`Embedar: ${modalEmbed?.name ?? ''}`} onFechar={() => setModalEmbed(null)} largura="max-w-2xl">
        {modalEmbed && (() => {
          const embed = gerarEmbed(modalEmbed.id);
          return (
            <div className="space-y-5">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="label-base !mb-0">Link público direto</label>
                  <button onClick={() => copiar(embed.urlPublica, 'Link')} className="flex items-center gap-1 text-xs text-primary hover:underline"><Copy size={12} /> Copiar</button>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg bg-cloud px-3 py-2 text-xs text-ocean">{embed.urlPublica}</code>
                  <a href={embed.urlPublica} target="_blank" rel="noreferrer" className="text-primary"><ExternalLink size={15} /></a>
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="label-base !mb-0">Embed simples (script) — recomendado</label>
                  <button onClick={() => copiar(embed.script, 'Código')} className="flex items-center gap-1 text-xs text-primary hover:underline"><Copy size={12} /> Copiar</button>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-navy p-3 text-xs leading-relaxed text-emerald-300">{embed.script}</pre>
                <p className="mt-1 text-xs text-gray-400">Cole em qualquer página externa. O script injeta o formulário e ajusta a altura automaticamente.</p>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="label-base !mb-0">Embed via iframe (controle total)</label>
                  <button onClick={() => copiar(embed.iframe, 'Código')} className="flex items-center gap-1 text-xs text-primary hover:underline"><Copy size={12} /> Copiar</button>
                </div>
                <pre className="max-h-36 overflow-auto rounded-lg bg-navy p-3 text-xs leading-relaxed text-emerald-300">{embed.iframe}</pre>
              </div>

              {modalEmbed.status !== 'published' && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Este formulário está em rascunho. Publique-o para que o embed funcione na página externa.
                </p>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
