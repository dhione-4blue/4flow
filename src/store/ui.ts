// =====================================================================
// 4Flow — Store de UI (toasts, sidebar)
// =====================================================================
import { create } from 'zustand';

export interface Toast {
  id: number;
  tipo: 'sucesso' | 'erro' | 'info' | 'aviso';
  mensagem: string;
}

interface UiState {
  toasts: Toast[];
  sidebarAberta: boolean;
  toast: (tipo: Toast['tipo'], mensagem: string) => void;
  removerToast: (id: number) => void;
  alternarSidebar: () => void;
}

let proximoId = 1;

export const useUi = create<UiState>((set) => ({
  toasts: [],
  sidebarAberta: true,

  toast: (tipo, mensagem) => {
    const id = proximoId++;
    set((s) => ({ toasts: [...s.toasts, { id, tipo, mensagem }] }));
    // auto-remove após 4 segundos
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },

  removerToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  alternarSidebar: () => set((s) => ({ sidebarAberta: !s.sidebarAberta })),
}));
