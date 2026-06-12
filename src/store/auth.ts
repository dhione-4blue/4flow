// =====================================================================
// 4Flow — Store de autenticação (Zustand)
// Observa o Firebase Auth e carrega o perfil/role do Firestore
// =====================================================================
import { create } from 'zustand';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { User, UserRole } from '../types';

interface AuthState {
  firebaseUser: FirebaseUser | null;
  perfil: User | null;
  carregando: boolean;
  erro: string | null;
  iniciar: () => void;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
  trocarSenha: (novaSenha: string) => Promise<void>;
  temRole: (minima: UserRole) => boolean;
}

// Hierarquia de roles: admin > operador > closer > viewer
const HIERARQUIA: Record<UserRole, number> = { admin: 4, operador: 3, closer: 2, viewer: 1 };

let observando = false;

export const useAuth = create<AuthState>((set, get) => ({
  firebaseUser: null,
  perfil: null,
  carregando: true,
  erro: null,

  iniciar: () => {
    if (observando) return;
    observando = true;
    onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        set({ firebaseUser: null, perfil: null, carregando: false });
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', fbUser.uid));
        if (!snap.exists()) {
          // usuário existe no Auth mas não no Firestore — sem acesso
          set({ firebaseUser: fbUser, perfil: null, carregando: false, erro: 'Usuário sem perfil cadastrado. Contate um administrador.' });
          return;
        }
        const perfil = { ...(snap.data() as User), uid: fbUser.uid };
        if (!perfil.active) {
          await signOut(auth);
          set({ firebaseUser: null, perfil: null, carregando: false, erro: 'Usuário desativado. Contate um administrador.' });
          return;
        }
        // registra último login (não bloqueia a UI)
        updateDoc(doc(db, 'users', fbUser.uid), { lastLoginAt: serverTimestamp() }).catch(() => undefined);
        set({ firebaseUser: fbUser, perfil, carregando: false, erro: null });
      } catch (e) {
        set({ firebaseUser: fbUser, perfil: null, carregando: false, erro: 'Erro ao carregar perfil.' });
      }
    });
  },

  login: async (email, senha) => {
    set({ erro: null });
    try {
      await signInWithEmailAndPassword(auth, email, senha);
    } catch (e: unknown) {
      const cod = (e as { code?: string }).code ?? '';
      const msgs: Record<string, string> = {
        'auth/invalid-credential': 'E-mail ou senha incorretos.',
        'auth/user-not-found': 'Usuário não encontrado.',
        'auth/wrong-password': 'Senha incorreta.',
        'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
        'auth/invalid-email': 'E-mail inválido.',
      };
      throw new Error(msgs[cod] ?? 'Erro ao fazer login. Tente novamente.');
    }
  },

  logout: async () => {
    await signOut(auth);
    set({ firebaseUser: null, perfil: null });
  },

  trocarSenha: async (novaSenha) => {
    const fbUser = auth.currentUser;
    if (!fbUser) throw new Error('Sessão expirada. Faça login novamente.');
    await updatePassword(fbUser, novaSenha);
    await updateDoc(doc(db, 'users', fbUser.uid), { mustChangePassword: false });
    const { perfil } = get();
    if (perfil) set({ perfil: { ...perfil, mustChangePassword: false } });
  },

  temRole: (minima) => {
    const { perfil } = get();
    if (!perfil) return false;
    return HIERARQUIA[perfil.role] >= HIERARQUIA[minima];
  },
}));
