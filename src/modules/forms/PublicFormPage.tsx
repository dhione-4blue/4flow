// =====================================================================
// 4Flow — Página pública do formulário (/f/:id)
// Sem header, sem navegação — somente o formulário, mobile-first.
// Mídia vai para o Firebase Storage; a resposta é gravada em
// form_submissions e o Apps Script associa ao contato.
// Envia a altura via postMessage para o embed externo (auto-resize).
// =====================================================================
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import axios from 'axios';
import { db } from '../../lib/firebase';
import { uploadMidia } from '../../lib/mediaUpload';
import FormRenderer, { type ValoresFormulario } from './FormRenderer';
import { Spinner } from '../../components/ui';
import { normalizarTelefone } from '../../lib/utils';
import type { Form, FormResponseField, FormField } from '../../types';

export default function PublicFormPage() {
  const { id } = useParams();
  const [form, setForm] = useState<Form | null>(null);
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'indisponivel'>('carregando');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function carregar() {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, 'forms', id));
        if (!snap.exists() || (snap.data() as Form).status !== 'published') {
          setEstado('indisponivel');
          return;
        }
        setForm({ ...(snap.data() as Form), id: snap.id });
        setEstado('ok');
      } catch {
        setEstado('indisponivel');
      }
    }
    carregar();
  }, [id]);

  // auto-resize para embed externo: envia a altura ao container pai
  useEffect(() => {
    if (!containerRef.current || !id) return;
    const enviar = () => {
      window.parent?.postMessage({ _4flowHeight: document.body.scrollHeight, formId: id }, '*');
    };
    const obs = new ResizeObserver(enviar);
    obs.observe(containerRef.current);
    enviar();
    return () => obs.disconnect();
  }, [id, estado]);

  async function submeter(valores: ValoresFormulario) {
    if (!form || !id) return;

    // upload de mídia para o Firebase Storage
    const campos: FormResponseField[] = [];
    for (const campo of form.fields) {
      const v = valores[campo.id];
      if (v == null || v === '') continue;
      if (v instanceof File || v instanceof Blob) {
        // upload via Cloudinary (gratuito) ou base64 no Firestore como fallback
        const url = await uploadMidia(v, `4flow/forms/${id}`);
        campos.push({
          fieldId: campo.id,
          label: campo.label,
          value: v instanceof File ? v.name : 'gravacao-audio',
          type: tipoMidia(campo),
          mediaUrl: url,
        });
      } else {
        campos.push({
          fieldId: campo.id,
          label: campo.label,
          value: v as string | string[] | number,
          type: tipoResposta(campo),
        });
      }
    }

    // extrai identificadores para associação ao contato
    const nome = extrair(form.fields, valores, ['text'], ['nome', 'name']);
    const email = extrairPorTipo(form.fields, valores, 'email');
    const telefone = extrairPorTipo(form.fields, valores, 'phone');

    await addDoc(collection(db, 'form_submissions'), {
      formId: id,
      formName: form.name,
      fields: campos,
      contactId: null, // associado pelo Apps Script (deduplicação por telefone/e-mail)
      name: nome,
      email: email ? String(email).toLowerCase() : null,
      phone: telefone ? normalizarTelefone(String(telefone)) : null,
      createdAt: serverTimestamp(),
    });

    // webhook configurado no formulário
    if (form.settings.webhookUrl) {
      axios.post(form.settings.webhookUrl, {
        evento: 'form.submitted',
        formId: id,
        formName: form.name,
        respostas: campos.map((c) => ({ pergunta: c.label, resposta: c.value, mediaUrl: c.mediaUrl ?? null })),
      }).catch(() => undefined);
    }
  }

  if (estado === 'carregando') return <div className="min-h-screen bg-cloud"><Spinner texto="Carregando formulário..." /></div>;

  if (estado === 'indisponivel' || !form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cloud p-6 text-center">
        <div>
          <h1 className="mb-2 text-lg font-bold text-navy">Formulário indisponível</h1>
          <p className="text-sm text-gray-500">Este formulário não existe ou não está publicado.</p>
        </div>
      </div>
    );
  }

  const fundo = form.settings.backgroundType === 'image' && form.settings.backgroundImageUrl
    ? { backgroundImage: `url(${form.settings.backgroundImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundColor: form.settings.backgroundColor || '#F3F3FA' };

  return (
    <div ref={containerRef} className="min-h-screen px-4 py-10 sm:py-14" style={fundo}>
      {form.settings.logoUrl && (
        <img src={form.settings.logoUrl} alt="Logo" className="mx-auto mb-8 max-h-14" />
      )}
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-xl sm:p-10">
        <h1 className="mb-1 text-2xl font-bold text-navy">{form.name}</h1>
        {form.description && <p className="mb-6 text-sm text-gray-500">{form.description}</p>}
        {!form.description && <div className="mb-6" />}
        <FormRenderer form={form} aoSubmeter={submeter} />
      </div>
      <p className="mt-6 text-center text-xs text-gray-400">Desenvolvido com 4Flow</p>
    </div>
  );
}

// ---------- helpers de extração ----------
function tipoMidia(campo: FormField): FormResponseField['type'] {
  if (campo.type.startsWith('audio')) return 'audio';
  if (campo.type.startsWith('photo')) return 'photo';
  return 'video';
}

function tipoResposta(campo: FormField): FormResponseField['type'] {
  if (campo.type === 'choice_single' || campo.type === 'choice_multiple') return 'choice';
  if (campo.type === 'scale' || campo.type === 'nps') return 'scale';
  return 'text';
}

function extrairPorTipo(campos: FormField[], valores: ValoresFormulario, tipo: string): string | null {
  const campo = campos.find((c) => c.type === tipo);
  const v = campo ? valores[campo.id] : null;
  return v != null && typeof v !== 'object' ? String(v) : null;
}

function extrair(campos: FormField[], valores: ValoresFormulario, tipos: string[], palavras: string[]): string | null {
  const campo = campos.find((c) => tipos.includes(c.type) && palavras.some((p) => c.label.toLowerCase().includes(p)));
  const v = campo ? valores[campo.id] : null;
  return v != null && typeof v !== 'object' ? String(v) : null;
}
