// =====================================================================
// 4Flow — Hook de auditoria
// Toda escrita relevante no sistema passa por aqui.
// O registro é enviado ao Apps Script, que grava em audit_logs com
// Admin SDK (o client não tem permissão de escrita nessa coleção).
// =====================================================================
import { useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../store/auth';

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined;

export interface RegistroAuditoria {
  action: string;        // 'contact.updated', 'user.created', 'stage.changed'...
  resourceType: string;  // 'contact', 'user', 'form', 'flow'...
  resourceId: string;
  resourceName?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export function useAuditLog() {
  const perfil = useAuth((s) => s.perfil);

  const registrar = useCallback(
    async (registro: RegistroAuditoria): Promise<void> => {
      if (!perfil) return;
      const payload = {
        tipo: 'audit_log',
        userId: perfil.uid,
        userName: perfil.name,
        userRole: perfil.role,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        ...registro,
      };
      if (!APPS_SCRIPT_URL) {
        // Apps Script ainda não configurado — loga no console para não perder rastro em dev
        console.info('[auditoria]', payload);
        return;
      }
      try {
        // text/plain evita preflight CORS no Apps Script
        await axios.post(APPS_SCRIPT_URL, JSON.stringify(payload), {
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        });
      } catch (e) {
        console.error('Falha ao registrar auditoria:', e);
      }
    },
    [perfil]
  );

  return { registrar };
}
