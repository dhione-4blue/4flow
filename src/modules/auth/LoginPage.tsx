// =====================================================================
// 4Flow — Tela de login (e-mail + senha, sem autocadastro)
// =====================================================================
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LogIn } from 'lucide-react';
import { useAuth } from '../../store/auth';
import { Botao, Campo } from '../../components/ui';

const esquema = z.object({
  email: z.string().min(1, 'Informe seu e-mail').email('E-mail inválido'),
  senha: z.string().min(6, 'A senha tem no mínimo 6 caracteres'),
});

type Dados = z.infer<typeof esquema>;

export default function LoginPage() {
  const login = useAuth((s) => s.login);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const { register, handleSubmit, formState: { errors } } = useForm<Dados>({ resolver: zodResolver(esquema) });

  async function aoEnviar(dados: Dados) {
    setEnviando(true);
    setErroGeral(null);
    try {
      await login(dados.email, dados.senha);
      const destino = (location.state as { de?: string } | null)?.de ?? '/dashboard';
      navigate(destino, { replace: true });
    } catch (e) {
      setErroGeral(e instanceof Error ? e.message : 'Erro ao fazer login.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-navy p-4">
      <div className="anim-fade w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <svg viewBox="0 0 32 32" className="h-14 w-14">
            <rect width="32" height="32" rx="7" fill="#03427D" />
            <path d="M8 22 L14 10 L17 16 L20 12 L24 22" fill="none" stroke="#F8B90C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="text-center">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">4Flow</h1>
            <p className="text-sm text-gray-400">Plataforma de operação comercial da 4blue</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(aoEnviar)} className="space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
          <Campo label="E-mail" type="email" placeholder="voce@4blue.com.br" autoComplete="email" erro={errors.email?.message} {...register('email')} />
          <Campo label="Senha" type="password" placeholder="Sua senha" autoComplete="current-password" erro={errors.senha?.message} {...register('senha')} />

          {erroGeral && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erroGeral}</p>}

          <Botao type="submit" carregando={enviando} icone={<LogIn size={16} />} className="w-full">
            Entrar
          </Botao>

          <p className="text-center text-xs text-gray-400">
            Acesso restrito à equipe 4blue. Não há autocadastro — solicite acesso a um administrador.
          </p>
        </form>
      </div>
    </div>
  );
}
