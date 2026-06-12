// =====================================================================
// 4Flow — Gestão de usuários (somente admin)
// Criação via Apps Script (Admin SDK) + e-mail de boas-vindas
// =====================================================================
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { doc, updateDoc } from 'firebase/firestore';
import { UserPlus, Ban, CheckCircle2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useColecao } from '../../hooks/useColecao';
import { useAuditLog } from '../../hooks/useAuditLog';
import { useAuth } from '../../store/auth';
import { useUi } from '../../store/ui';
import { Botao, Campo, Selecao, Modal, ModalConfirmacao, Badge, Avatar, Spinner, EstadoVazio, CabecalhoPagina } from '../../components/ui';
import { fmtData } from '../../lib/utils';
import type { User, UserRole } from '../../types';

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined;

const esquemaNovo = z.object({
  name: z.string().min(2, 'Informe o nome completo'),
  email: z.string().email('E-mail inválido'),
  role: z.enum(['admin', 'operador', 'closer', 'viewer']),
});

type DadosNovo = z.infer<typeof esquemaNovo>;

const rotuloRole: Record<UserRole, string> = { admin: 'Administrador', operador: 'Operador', closer: 'Closer', viewer: 'Visualizador' };
const corRole: Record<UserRole, string> = { admin: 'gold', operador: 'azul', closer: 'verde', viewer: 'cinza' };

export default function UsersSection() {
  const { itens: usuarios, carregando, recarregar } = useColecao<User>('users', { ordenarPor: 'name', direcao: 'asc' });
  const perfil = useAuth((s) => s.perfil);
  const toast = useUi((s) => s.toast);
  const { registrar } = useAuditLog();
  const [modalNovo, setModalNovo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [confirmando, setConfirmando] = useState<User | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<DadosNovo>({
    resolver: zodResolver(esquemaNovo),
    defaultValues: { role: 'closer' },
  });

  async function criarUsuario(dados: DadosNovo) {
    if (!APPS_SCRIPT_URL) {
      toast('aviso', 'Configure VITE_APPS_SCRIPT_URL no .env para criar usuários (requer Admin SDK).');
      return;
    }
    setEnviando(true);
    try {
      // Apps Script cria no Firebase Auth + Firestore e envia e-mail de boas-vindas
      const r = await axios.post(
        APPS_SCRIPT_URL,
        JSON.stringify({ tipo: 'create_user', ...dados, createdBy: perfil?.uid }),
        { headers: { 'Content-Type': 'text/plain;charset=utf-8' } }
      );
      if (r.data?.ok === false) throw new Error(r.data?.erro ?? 'Erro no Apps Script');
      await registrar({ action: 'user.created', resourceType: 'user', resourceId: dados.email, resourceName: dados.name, after: dados as unknown as Record<string, unknown> });
      toast('sucesso', `Usuário criado. E-mail de boas-vindas enviado para ${dados.email}.`);
      setModalNovo(false);
      reset();
      recarregar();
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Erro ao criar usuário.');
    } finally {
      setEnviando(false);
    }
  }

  async function alternarAtivo(u: User) {
    try {
      await updateDoc(doc(db, 'users', u.uid), { active: !u.active });
      await registrar({
        action: u.active ? 'user.deactivated' : 'user.activated',
        resourceType: 'user', resourceId: u.uid, resourceName: u.name,
        before: { active: u.active }, after: { active: !u.active },
      });
      toast('sucesso', u.active ? `${u.name} desativado.` : `${u.name} reativado.`);
      setConfirmando(null);
      recarregar();
    } catch {
      toast('erro', 'Erro ao atualizar usuário.');
    }
  }

  async function mudarRole(u: User, role: UserRole) {
    try {
      await updateDoc(doc(db, 'users', u.uid), { role });
      await registrar({ action: 'user.role_changed', resourceType: 'user', resourceId: u.uid, resourceName: u.name, before: { role: u.role }, after: { role } });
      toast('sucesso', `Role de ${u.name} alterada para ${rotuloRole[role]}.`);
      recarregar();
    } catch {
      toast('erro', 'Erro ao alterar role.');
    }
  }

  if (carregando) return <Spinner />;

  return (
    <div>
      <CabecalhoPagina
        titulo="Usuários do sistema"
        descricao="Somente administradores podem criar e gerenciar usuários."
        acoes={<Botao icone={<UserPlus size={16} />} onClick={() => setModalNovo(true)}>Novo usuário</Botao>}
      />

      {usuarios.length === 0 ? (
        <EstadoVazio titulo="Nenhum usuário cadastrado" descricao="Crie o primeiro usuário do sistema." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">Usuário</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Último login</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.uid ?? u.id} className="border-b border-gray-50 last:border-0 hover:bg-cloud/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar nome={u.name} url={u.avatar} tamanho={32} />
                      <div>
                        <div className="font-semibold text-navy">{u.name}</div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => mudarRole(u, e.target.value as UserRole)}
                      disabled={u.uid === perfil?.uid}
                      className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
                    >
                      {(Object.keys(rotuloRole) as UserRole[]).map((r) => (
                        <option key={r} value={r}>{rotuloRole[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <Badge cor={u.active ? 'verde' : 'vermelho'}>{u.active ? 'Ativo' : 'Inativo'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{fmtData(u.lastLoginAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {u.uid !== perfil?.uid && (
                      <Botao
                        variante="ghost"
                        icone={u.active ? <Ban size={14} /> : <CheckCircle2 size={14} />}
                        onClick={() => (u.active ? setConfirmando(u) : alternarAtivo(u))}
                      >
                        {u.active ? 'Desativar' : 'Reativar'}
                      </Botao>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: novo usuário */}
      <Modal
        aberto={modalNovo}
        titulo="Novo usuário"
        onFechar={() => setModalNovo(false)}
        rodape={
          <>
            <Botao variante="secondary" onClick={() => setModalNovo(false)}>Cancelar</Botao>
            <Botao onClick={handleSubmit(criarUsuario)} carregando={enviando}>Criar e enviar convite</Botao>
          </>
        }
      >
        <div className="space-y-4">
          <Campo label="Nome completo" placeholder="Maria Silva" erro={errors.name?.message} {...register('name')} />
          <Campo label="E-mail" type="email" placeholder="maria@4blue.com.br" erro={errors.email?.message} {...register('email')} />
          <Selecao label="Role" erro={errors.role?.message} {...register('role')}>
            <option value="admin">Administrador — acesso total</option>
            <option value="operador">Operador — gerencia contatos, formulários e fluxos</option>
            <option value="closer">Closer — CRM, inbox e contatos atribuídos</option>
            <option value="viewer">Visualizador — somente leitura</option>
          </Selecao>
          <p className="rounded-lg bg-cloud px-3 py-2 text-xs text-gray-500">
            O usuário receberá um e-mail com senha temporária e deverá trocá-la no primeiro acesso.
          </p>
        </div>
      </Modal>

      <ModalConfirmacao
        aberto={Boolean(confirmando)}
        titulo="Desativar usuário"
        mensagem={`${confirmando?.name} perderá o acesso ao sistema imediatamente. Os dados e o histórico permanecem registrados.`}
        textoConfirmar="Desativar"
        onConfirmar={() => confirmando && alternarAtivo(confirmando)}
        onCancelar={() => setConfirmando(null)}
      />
    </div>
  );
}
