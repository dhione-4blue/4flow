// =====================================================================
// 4Flow — Inicialização do Firebase (Auth, Firestore, Storage)
// As credenciais vêm do arquivo .env (nunca commitadas)
// =====================================================================
import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
// Observação: NÃO usamos Firebase Storage (exige plano pago).
// Mídia dos formulários sobe via Cloudinary — veja src/lib/mediaUpload.ts

// Sessão persistente no navegador (mantém login entre visitas)
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error('Erro ao configurar persistência de sessão:', err);
});

/** Indica se as credenciais Firebase foram configuradas no .env */
export const firebaseConfigurado = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
