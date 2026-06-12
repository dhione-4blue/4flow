// =====================================================================
// 4Flow — Abstração de provider WhatsApp (arquitetura dual-provider)
// MVP: Evolution API (open source, WhatsApp Web emulado)
// Futuro: Meta Cloud API oficial — basta implementar a mesma interface
// Troca via variável de ambiente VITE_WA_PROVIDER=evolution|meta
// =====================================================================
import axios from 'axios';
import type { WhatsAppProvider, MessageResult, InstanceStatus } from '../types';

const EVOLUTION_URL = (import.meta.env.VITE_EVOLUTION_API_URL as string | undefined) ?? '';
const EVOLUTION_KEY = (import.meta.env.VITE_EVOLUTION_API_KEY as string | undefined) ?? '';
const PROVIDER = (import.meta.env.VITE_WA_PROVIDER as string | undefined) ?? 'evolution';

/** Implementação Evolution API — usada no MVP */
class EvolutionApiProvider implements WhatsAppProvider {
  private instancia: string;

  constructor(instancia: string) {
    this.instancia = instancia;
  }

  private get headers() {
    return { apikey: EVOLUTION_KEY, 'Content-Type': 'application/json' };
  }

  async sendText(to: string, text: string): Promise<MessageResult> {
    try {
      const r = await axios.post(
        `${EVOLUTION_URL}/message/sendText/${this.instancia}`,
        { number: to, text },
        { headers: this.headers }
      );
      return { success: true, messageId: r.data?.key?.id ?? null };
    } catch (e: unknown) {
      return { success: false, messageId: null, error: e instanceof Error ? e.message : 'Erro desconhecido' };
    }
  }

  async sendMedia(to: string, type: string, url: string, caption?: string): Promise<MessageResult> {
    try {
      const r = await axios.post(
        `${EVOLUTION_URL}/message/sendMedia/${this.instancia}`,
        { number: to, mediatype: type, media: url, caption: caption ?? '' },
        { headers: this.headers }
      );
      return { success: true, messageId: r.data?.key?.id ?? null };
    } catch (e: unknown) {
      return { success: false, messageId: null, error: e instanceof Error ? e.message : 'Erro desconhecido' };
    }
  }

  async sendTemplate(to: string, templateName: string, params: string[]): Promise<MessageResult> {
    // Evolution API não tem templates oficiais — envia como texto simples
    return this.sendText(to, `[${templateName}] ${params.join(' ')}`);
  }

  async getInstanceStatus(instanceId: string): Promise<InstanceStatus> {
    try {
      const r = await axios.get(`${EVOLUTION_URL}/instance/connectionState/${instanceId}`, { headers: this.headers });
      const estado = r.data?.instance?.state ?? 'disconnected';
      const mapa: Record<string, InstanceStatus['status']> = {
        open: 'connected',
        connecting: 'connecting',
        close: 'disconnected',
      };
      return { instanceId, status: mapa[estado] ?? 'disconnected' };
    } catch {
      return { instanceId, status: 'disconnected' };
    }
  }

  /** Cria instância e retorna QR Code em base64 para conexão */
  async conectarInstancia(nome: string): Promise<{ qrcode: string | null }> {
    try {
      await axios.post(
        `${EVOLUTION_URL}/instance/create`,
        { instanceName: nome, qrcode: true, integration: 'WHATSAPP-BAILEYS' },
        { headers: this.headers }
      );
      const r = await axios.get(`${EVOLUTION_URL}/instance/connect/${nome}`, { headers: this.headers });
      return { qrcode: r.data?.base64 ?? null };
    } catch {
      return { qrcode: null };
    }
  }

  async desconectarInstancia(nome: string): Promise<void> {
    await axios.delete(`${EVOLUTION_URL}/instance/logout/${nome}`, { headers: this.headers }).catch(() => undefined);
  }

  async deletarInstancia(nome: string): Promise<void> {
    await axios.delete(`${EVOLUTION_URL}/instance/delete/${nome}`, { headers: this.headers }).catch(() => undefined);
  }
}

/** Implementação Meta Cloud API — esqueleto pronto para o futuro */
class MetaCloudApiProvider implements WhatsAppProvider {
  async sendText(_to: string, _text: string): Promise<MessageResult> {
    return { success: false, messageId: null, error: 'Meta Cloud API ainda não configurada.' };
  }
  async sendMedia(): Promise<MessageResult> {
    return { success: false, messageId: null, error: 'Meta Cloud API ainda não configurada.' };
  }
  async sendTemplate(): Promise<MessageResult> {
    return { success: false, messageId: null, error: 'Meta Cloud API ainda não configurada.' };
  }
  async getInstanceStatus(instanceId: string): Promise<InstanceStatus> {
    return { instanceId, status: 'disconnected' };
  }
}

/** Factory — retorna o provider conforme VITE_WA_PROVIDER */
export function obterProviderWhatsApp(instancia: string): WhatsAppProvider {
  if (PROVIDER === 'meta') return new MetaCloudApiProvider();
  return new EvolutionApiProvider(instancia);
}

export { EvolutionApiProvider, MetaCloudApiProvider };
export const evolutionConfigurada = Boolean(EVOLUTION_URL && EVOLUTION_KEY);
