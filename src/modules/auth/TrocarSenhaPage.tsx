// =====================================================================
// 4Flow — Troca obrigatória de senha no primeiro acesso
// =====================================================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../../store/auth';
import { useUi } from '../../store/ui';
import { Botao, Campo, Cartao } from '../../components/ui';

const esquema = z
  .object({
    senha: z.string().min(8, 'Mínimo de 8 caracteres'),
    confirmacao: z.string(),
  })
  .refine((d) => d.senha === d.confirmacao, { message: 'As senhas não conferem', path: ['confirmacao'] });

type Dados = z.infer<typeof esquema>;

export default function TrocarSenhaPage() {
  const trocarSenha = useAuth((s) => s.trocarSenha);
  const toast = useUi((s) => s.toast);
  const [enviando, setEnviando] = useState(false);
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<Dados>({ resolver: zodResolver(esquema) });

  async function aoEnviar(dados: Dados) {
    setEnviando(true);
    try {
      await trocarSenha(dados.senha);
      toast('sucesso', 'Senha alterada com sucesso.');
      navigate('/dashboard', { replace: true });
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Erro ao alterar a senha.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-cloud p-4">
      <Cartao className="w-full max-w-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-full bg-gold/20 p-2 text-yellow-700"><KeyRound size={20} /></div>
          <div>
            <h1 className="font-bold text-navy">Defina sua nova senha</h1>
            <p className="text-xs text-gray-500">Por segurança, troque a senha temporária no primeiro acesso.</p>
          </div>
        </div>
        <form onSubmit={handleSubmit(aoEnviar)} className="space-y-4">
          <Campo label="Nova senha" type="password" erro={errors.senha?.message} {...register('senha')} />
          <Campo label="Confirme a nova senha" type="password" erro={errors.confirmacao?.message} {...register('confirmacao')} />
          <Botao type="submit" carregando={enviando} className="w-full">Salvar nova senha</Botao>
        </form>
      </Cartao>
    </div>
  );
}
