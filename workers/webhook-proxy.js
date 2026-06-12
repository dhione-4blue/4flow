/* =====================================================================
   4Flow — Cloudflare Worker: proxy de webhooks de entrada
   Endpoints:
     POST /webhook/in/{webhookKey}  → leads externos (Hotmart, Meta, etc.)
     POST /api/whatsapp/webhook     → eventos da Evolution API

   SETUP:
   1. dash.cloudflare.com → Workers → Create → cole este código
   2. Variáveis de ambiente (Settings → Variables):
      - FIREBASE_PROJECT_ID
      - FIREBASE_API_KEY (Web API key — usada com REST + regras públicas
        de form_submissions/inbound_events; o processamento fino é
        feito pelo Apps Script com Admin SDK)
   3. Rota: api.4flow.com.br/* → este worker
   ===================================================================== */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS p/ chamadas de browser quando necessário
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors() });
    }

    if (request.method !== 'POST') {
      return json({ ok: false, erro: 'Use POST' }, 405);
    }

    try {
      // ---------- Webhook de entrada genérico ----------
      const matchIn = url.pathname.match(/^\/webhook\/in\/([\w-]+)$/);
      if (matchIn) {
        const webhookKey = matchIn[1];
        const payload = await request.json().catch(() => ({}));

        // grava o evento bruto; o Apps Script mapeia campos e cria o contato
        await criarDoc(env, 'inbound_events', {
          webhookKey: { stringValue: webhookKey },
          payload: { stringValue: JSON.stringify(payload).slice(0, 90000) },
          processed: { booleanValue: false },
          receivedAt: { timestampValue: new Date().toISOString() },
        });

        return json({ ok: true, recebido: true });
      }

      // ---------- Webhook da Evolution API (WhatsApp) ----------
      if (url.pathname === '/api/whatsapp/webhook') {
        const evento = await request.json().catch(() => ({}));
        const tipo = evento.event || '';

        // grava o evento bruto; Apps Script (ou processamento posterior)
        // cria contato/conversa/mensagem com Admin SDK
        if (['messages.upsert', 'messages.update', 'connection.update'].includes(tipo)) {
          await criarDoc(env, 'whatsapp_events', {
            event: { stringValue: tipo },
            instance: { stringValue: evento.instance || '' },
            payload: { stringValue: JSON.stringify(evento).slice(0, 90000) },
            processed: { booleanValue: false },
            receivedAt: { timestampValue: new Date().toISOString() },
          });
        }

        return json({ ok: true });
      }

      return json({ ok: false, erro: 'Rota não encontrada' }, 404);
    } catch (err) {
      return json({ ok: false, erro: String(err) }, 500);
    }
  },
};

async function criarDoc(env, colecao, fields) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}` +
    `/databases/(default)/documents/${colecao}?key=${env.FIREBASE_API_KEY}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!resp.ok) throw new Error(`Firestore ${resp.status}: ${await resp.text()}`);
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  });
}
