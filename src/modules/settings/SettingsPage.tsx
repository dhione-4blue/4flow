// =====================================================================
// 4Flow — Configurações (hub com navegação por seção)
// /settings/users | profile | audit | whatsapp | integrations |
// webhooks | pipelines | tags
// =====================================================================
import { NavLink, useParams } from 'react-router-dom';
import { Users, UserCircle, ScrollText, Smartphone, Plug, Webhook, KanbanSquare, Tags } from 'lucide-react';
import { useAuth } from '../../store/auth';
import UsersSection from './UsersSection';
import ProfileSection from './ProfileSection';
import AuditSection from './AuditSection';
import WhatsAppSection from './WhatsAppSection';
import IntegrationsSection from './IntegrationsSection';
import WebhooksSection from './WebhooksSection';
import PipelinesSection from './PipelinesSection';
import TagsSection from './TagsSection';

const secoes = [
  { id: 'users', rotulo: 'Usuários', icone: Users, roleMinima: 'admin' as const },
  { id: 'profile', rotulo: 'Meu perfil', icone: UserCircle, roleMinima: 'viewer' as const },
  { id: 'pipelines', rotulo: 'Pipelines', icone: KanbanSquare, roleMinima: 'operador' as const },
  { id: 'tags', rotulo: 'Tags', icone: Tags, roleMinima: 'operador' as const },
  { id: 'whatsapp', rotulo: 'WhatsApp', icone: Smartphone, roleMinima: 'operador' as const },
  { id: 'integrations', rotulo: 'Integrações', icone: Plug, roleMinima: 'admin' as const },
  { id: 'webhooks', rotulo: 'Webhooks', icone: Webhook, roleMinima: 'admin' as const },
  { id: 'audit', rotulo: 'Auditoria', icone: ScrollText, roleMinima: 'admin' as const },
];

export default function SettingsPage() {
  const { secao = 'profile' } = useParams();
  const temRole = useAuth((s) => s.temRole);
  const visiveis = secoes.filter((s) => temRole(s.roleMinima));

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-navy">Configurações</h1>

      {/* navegação horizontal por seção */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-gray-200 pb-px">
        {visiveis.map(({ id, rotulo, icone: Icone }) => (
          <NavLink
            key={id}
            to={`/settings/${id}`}
            className={({ isActive }) =>
              `flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-navy'
              }`
            }
          >
            <Icone size={15} />
            {rotulo}
          </NavLink>
        ))}
      </div>

      {secao === 'users' && <UsersSection />}
      {secao === 'profile' && <ProfileSection />}
      {secao === 'audit' && <AuditSection />}
      {secao === 'whatsapp' && <WhatsAppSection />}
      {secao === 'integrations' && <IntegrationsSection />}
      {secao === 'webhooks' && <WebhooksSection />}
      {secao === 'pipelines' && <PipelinesSection />}
      {secao === 'tags' && <TagsSection />}
    </div>
  );
}
