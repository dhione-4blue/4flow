/// <reference types="vite/client" />

// Tipagem das variáveis de ambiente da 4Flow
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_WA_PROVIDER?: string;
  readonly VITE_EVOLUTION_API_URL?: string;
  readonly VITE_EVOLUTION_API_KEY?: string;
  readonly VITE_APPS_SCRIPT_URL?: string;
  readonly VITE_PUBLIC_APP_URL?: string;
  readonly VITE_CLOUDINARY_CLOUD_NAME?: string;
  readonly VITE_CLOUDINARY_UPLOAD_PRESET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
