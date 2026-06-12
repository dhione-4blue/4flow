// =====================================================================
// 4Flow — Upload de mídia dos formulários (áudio, foto, vídeo)
//
// O Firebase Storage exige plano pago (Blaze) para novos buckets,
// então o upload usa o CLOUDINARY (gratuito: ~25GB/mês) via
// "unsigned upload preset" — sem precisar de backend.
//
// Fallback sem Cloudinary: arquivos pequenos (até 700KB) são salvos
// como data URL (base64) dentro do próprio Firestore.
// =====================================================================

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const LIMITE_BASE64 = 700 * 1024; // ~700KB — margem segura no limite de 1MB/documento do Firestore

export const cloudinaryConfigurado = Boolean(CLOUD_NAME && UPLOAD_PRESET);

/** Faz upload de um arquivo/blob e retorna a URL pública (ou data URL no fallback) */
export async function uploadMidia(arquivo: File | Blob, pasta: string): Promise<string> {
  if (cloudinaryConfigurado) {
    const fd = new FormData();
    fd.append('file', arquivo);
    fd.append('upload_preset', UPLOAD_PRESET as string);
    fd.append('folder', pasta);
    // "auto" detecta imagem, áudio ou vídeo automaticamente
    const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
      method: 'POST',
      body: fd,
    });
    const json = (await resp.json()) as { secure_url?: string; error?: { message?: string } };
    if (json.secure_url) return json.secure_url;
    throw new Error(json.error?.message ?? 'Falha no upload para o Cloudinary.');
  }

  // fallback: base64 dentro do Firestore (somente arquivos pequenos)
  if (arquivo.size > LIMITE_BASE64) {
    throw new Error(
      'Arquivo grande demais para o modo sem Cloudinary (máx 700KB). ' +
      'Configure VITE_CLOUDINARY_CLOUD_NAME e VITE_CLOUDINARY_UPLOAD_PRESET no deploy.'
    );
  }
  return blobParaDataUrl(arquivo);
}

function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
    leitor.readAsDataURL(blob);
  });
}
