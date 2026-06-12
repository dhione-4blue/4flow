// =====================================================================
// 4Flow — Edição do próprio perfil
// =====================================================================
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../store/auth';
import { useUi } from '../../store/ui';
import { useAuditLog } from '../../hooks/useAuditLog';
import { Botao, Campo, Cartao, Avatar } from '../../components/ui';

const esquema = z.object({
  name: z.string().min(2, 'Informe seu nome'),
  avatar: z.string().url('URL inválida').nullable().or(z.literal('')),
});

type Dados = z.infer<typeof esquema>;

export default function ProfileSection() {
  const perfil = useAuth((s) => s.perfil);
  const trocarSenha = useAuth((s) => s.trocarSenha);
  const toast = useUi((s) => s.toast);
  const { registrar } = useAuditLog();
  const [salvando, setSalvando] = useState(false);
  const [novaSenha, setNovaSenha] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<Dados>({
    resolver: zodResolver(esquema),
    defaultValues: { name: perfil?.name ?? '', avatar: perfil?.avatar ?? '' },
  });

  if (!perfil) return null;

  async function salvar(dados: Dados) {
    if (!perfil) return;
    setSalvando(true);
    try {
      await updateDoc(doc(db, 'users', perfil.uid), { name: dados.name, avatar: dados.avatar || null });
      await registrar({ action: 'user.profile_updated', resourceType: 'user', resourceId: perfil.uid, resourceName: dados.name });
      toast('sucesso', 'Perfil atualizado.');
    } catch {
      toast('erro', 'Erro ao salvar perfil.');
    } finally {
      setSalvando(false);
    }
  }

  async function alterarSenha() {
    if (novaSenha.length < 8) {
      toast('aviso', 'A nova senha precisa de pelo menos 8 caracteres.');
      return;
    }
    try {
      await trocarSenha(novaSenha);
      setNovaSenha('');
      toast('sucesso', 'Senha alterada com sucesso.');
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Erro ao alterar senha. Faça login novamente e tente de novo.');
    }
  }

  return (
    <div className="grid max-w-3xl gap-6 md:grid-cols-2">
      <Cartao>
        <div className="mb-4 flex items-center gap-3">
          <Avatar nome={perfil.name} url={perfil.avatar} tamanho={48} />
          <div>
            <h2 className="font-bold text-navy">{perfil.name}</h2>
            <p className="text-xs text-gray-500">{perfil.email}</p>
          </div>
        </div>
        <form onSubmit={handleSubmit(salvar)} className="space-y-4">
          <Campo label="Nome" erro={errors.name?.message} {...register('name')} />
          <Campo label="URL do avatar (opcional)" placeholder="https://..." erro={errors.avatar?.message} {...register('avatar')} />
          <Botao type="submit" carregando={salvando}>Salvar alterações</Botao>
        </form>
      </Cartao>

      <Cartao>
        <h2 className="mb-4 font-bold text-navy">Alterar senha</h2>
        <div className="space-y-4">
          <Campo label="Nova senha" type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Mínimo 8 caracteres" />
          <Botao variante="secondary" onClick={alterarSenha}>Alterar senha</Botao>
        </div>
      </Cartao>
    </div>
  );
}
