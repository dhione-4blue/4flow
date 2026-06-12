// =====================================================================
// 4Flow — Integrações pré-configuradas (Hotmart, Meta Lead Ads,
// Google Sheets) e configuração do provider de e-mail
// =====================================================================
import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ShoppingCart, Megaphone, Sheet, Mail, ExternalLink } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useUi } from '../../store/ui';
import { useAuditLog } from '../../hooks/useAuditLog';
import { Botao, Campo, Cartao, Selecao, Badge } from '../../components/ui';

interface ConfigIntegracoes {
  emailProvider: 'resend' | 'brevo';
  emailApiKeyConfigured: boolean;
  hotmartActive: boolean;
  metaActive: boolean;
  metaPageId: string;
  sheetsActive: boolean;
  sheetsSpreadsheetId: string;
}

const PADRAO: ConfigIntegracoes = {
  emailProvider: 'resend', emailApiKeyConfigured: false,
  hotmartActive: false, metaActive: false, metaPageId: '',
  sheetsActive: false, sheetsSpreadsheetId: '',
};

export default function IntegrationsSection() {
  const toast = useUi((s) => s.toast);
  const { registrar } = useAuditLog();
  const [cfg, setCfg] = useState<ConfigIntegracoes>(PADRAO);
  const [apiKey, setApiKey] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'settings', 'integrations')).then((snap) => {
      if (snap.exists()) setCfg({ ...PADRAO, ...(snap.data() as ConfigIntegracoes) });
    }).catch(() => undefined);
  }, []);

  async function salvar() {
    setSalvando(true);
    try {
      // A API key NUNCA fica no Firestore lido pelo client em produção:
      // ela é enviada ao Apps Script, que guarda em PropertiesService.
      // Aqui gravamos apenas a configuração e a flag de que existe key.
      await setDoc(doc(db, 'settings', 'integrations'), {
        ...cfg,
        emailApiKeyConfigured: cfg.emailApiKeyConfigured || Boolean(apiKey),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      if (apiKey) {
        toast('info', 'Importante: cole esta API key também no Apps Script (PropertiesService) — segredos não ficam no frontend.');
      }
      await registrar({ action: 'integrations.updated', resourceType: 'settings', resourceId: 'integrations' });
      toast('sucesso', 'Integrações salvas.');
      setApiKey('');
    } catch {
      toast('erro', 'Erro ao salvar integrações.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* E-mail provider */}
      <Cartao>
        <div className="mb-3 flex items-center gap-2">
          <div className="rounded-lg bg-sky/10 p-2 text-sky"><Mail size={17} /></div>
          <div>
            <h3 className="font-bold text-navy">Provider de e-mail</h3>
            <p className="text-xs text-gray-500">Resend (3.000/mês grátis) ou Brevo (300/dia grátis)</p>
          </div>
          {cfg.emailApiKeyConfigured && <Badge cor="verde">Configurado</Badge>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Selecao label="Provider" value={cfg.emailProvider} onChange={(e) => setCfg({ ...cfg, emailProvider: e.target.value as 'resend' | 'brevo' })}>
            <option value="resend">Resend (recomendado)</option>
            <option value="brevo">Brevo</option>
          </Selecao>
          <Campo label="API Key" type="password" placeholder={cfg.emailApiKeyConfigured ? '••••••••  (já configurada)' : 'cole a API key'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        </div>
      </Cartao>

      {/* Hotmart */}
      <Cartao>
        <div className="mb-2 flex items-center gap-2">
          <div className="rounded-lg bg-orange-50 p-2 text-orange-600"><ShoppingCart size={17} /></div>
          <div className="flex-1">
            <h3 className="font-bold text-navy">Hotmart</h3>
            <p className="text-xs text-gray-500">Mapeia automaticamente purchase.approved, purchase.canceled e purchase.refunded</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={cfg.hotmartActive} onChange={(e) => setCfg({ ...cfg, hotmartActive: e.target.checked })} />
            Ativa
          </label>
        </div>
        <p className="rounded-lg bg-cloud px-3 py-2 text-xs text-gray-500">
          Crie um webhook de entrada com fonte "Hotmart" na aba Webhooks e cole a URL gerada no painel da Hotmart
          (Ferramentas → Webhook). <ExternalLink size={10} className="inline" />
        </p>
      </Cartao>

      {/* Meta Lead Ads */}
      <Cartao>
        <div className="mb-2 flex items-center gap-2">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-600"><Megaphone size={17} /></div>
          <div className="flex-1">
            <h3 className="font-bold text-navy">Meta Lead Ads</h3>
            <p className="text-xs text-gray-500">Sincronização de leads dos formulários do Facebook/Instagram</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={cfg.metaActive} onChange={(e) => setCfg({ ...cfg, metaActive: e.target.checked })} />
            Ativa
          </label>
        </div>
        <Campo label="ID da página do Facebook" value={cfg.metaPageId} onChange={(e) => setCfg({ ...cfg, metaPageId: e.target.value })} />
        <p className="mt-2 rounded-lg bg-cloud px-3 py-2 text-xs text-gray-500">
          Configure o webhook do app Meta apontando para o webhook de entrada "Meta Lead Ads" criado na aba Webhooks.
        </p>
      </Cartao>

      {/* Google Sheets */}
      <Cartao>
        <div className="mb-2 flex items-center gap-2">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600"><Sheet size={17} /></div>
          <div className="flex-1">
            <h3 className="font-bold text-navy">Google Sheets</h3>
            <p className="text-xs text-gray-500">Exportação automática de contatos para uma planilha (sync via Apps Script)</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={cfg.sheetsActive} onChange={(e) => setCfg({ ...cfg, sheetsActive: e.target.checked })} />
            Ativa
          </label>
        </div>
        <Campo label="ID da planilha" placeholder="da URL: docs.google.com/spreadsheets/d/{ID}/..." value={cfg.sheetsSpreadsheetId} onChange={(e) => setCfg({ ...cfg, sheetsSpreadsheetId: e.target.value })} />
      </Cartao>

      <div className="flex justify-end">
        <Botao onClick={salvar} carregando={salvando}>Salvar integrações</Botao>
      </div>
    </div>
  );
}
