// =====================================================================
// 4Flow — Shell principal: sidebar + topbar + área de conteúdo
// Em mobile (<768px) a sidebar vira bottom navigation
// =====================================================================
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, Workflow, MessageSquare,
  KanbanSquare, Mail, BarChart3, Settings, LogOut, Search, Bell, Menu,
} from 'lucide-react';
import { useAuth } from '../../store/auth';
import { useUi } from '../../store/ui';
import { Avatar, ContainerToasts } from '../ui';

const itensMenu = [
  { rota: '/dashboard', rotulo: 'Dashboard', icone: LayoutDashboard },
  { rota: '/contacts', rotulo: 'Contatos', icone: Users },
  { rota: '/forms', rotulo: 'Formulários', icone: FileText },
  { rota: '/automation', rotulo: 'Automações', icone: Workflow },
  { rota: '/inbox', rotulo: 'Inbox', icone: MessageSquare },
  { rota: '/crm', rotulo: 'CRM', icone: KanbanSquare },
  { rota: '/email/campaigns', rotulo: 'E-mail', icone: Mail },
  { rota: '/reports/funnel', rotulo: 'Relatórios', icone: BarChart3 },
];

const rotuloRole: Record<string, string> = {
  admin: 'Administrador', operador: 'Operador', closer: 'Closer', viewer: 'Visualizador',
};

export default function Shell() {
  const perfil = useAuth((s) => s.perfil);
  const logout = useAuth((s) => s.logout);
  const sidebarAberta = useUi((s) => s.sidebarAberta);
  const alternarSidebar = useUi((s) => s.alternarSidebar);
  const navigate = useNavigate();

  async function sair() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="flex h-full">
      {/* ===== Sidebar (desktop) ===== */}
      <aside
        className={`hidden flex-col bg-navy text-white transition-all duration-200 md:flex ${sidebarAberta ? 'w-56' : 'w-16'}`}
      >
        <div className="flex h-14 items-center gap-2 px-4">
          <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0">
            <rect width="32" height="32" rx="7" fill="#03427D" />
            <path d="M8 22 L14 10 L17 16 L20 12 L24 22" fill="none" stroke="#F8B90C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {sidebarAberta && <span className="text-lg font-extrabold tracking-tight">4Flow</span>}
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-2">
          {itensMenu.map(({ rota, rotulo, icone: Icone }) => (
            <NavLink
              key={rota}
              to={rota}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-primary text-white' : 'text-gray-300 hover:bg-ocean/60 hover:text-white'
                }`
              }
              title={rotulo}
            >
              <Icone size={18} className="shrink-0" />
              {sidebarAberta && rotulo}
            </NavLink>
          ))}
          <div className="my-3 border-t border-white/10" />
          <NavLink
            to="/settings/users"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-primary text-white' : 'text-gray-300 hover:bg-ocean/60 hover:text-white'
              }`
            }
            title="Configurações"
          >
            <Settings size={18} className="shrink-0" />
            {sidebarAberta && 'Configurações'}
          </NavLink>
        </nav>

        <button
          onClick={sair}
          className="m-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-ocean/60 hover:text-white"
          title="Sair"
        >
          <LogOut size={18} className="shrink-0" />
          {sidebarAberta && 'Sair'}
        </button>
      </aside>

      {/* ===== Conteúdo ===== */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4">
          <button onClick={alternarSidebar} className="hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100 md:block" aria-label="Alternar menu">
            <Menu size={18} />
          </button>
          <span className="font-extrabold tracking-tight text-navy md:hidden">4Flow</span>

          <div className="relative ml-auto hidden w-72 sm:block">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Busca global..."
              className="input-base pl-9"
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/contacts?q=${encodeURIComponent((e.target as HTMLInputElement).value)}`);
              }}
            />
          </div>

          <button className="relative ml-auto rounded-lg p-2 text-gray-500 hover:bg-gray-100 sm:ml-0" aria-label="Notificações">
            <Bell size={18} />
          </button>

          {perfil && (
            <div className="flex items-center gap-2">
              <Avatar nome={perfil.name} url={perfil.avatar} tamanho={32} />
              <div className="hidden leading-tight sm:block">
                <div className="text-sm font-semibold text-navy">{perfil.name}</div>
                <div className="text-[11px] text-gray-500">{rotuloRole[perfil.role]}</div>
              </div>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-20 sm:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* ===== Bottom navigation (mobile) ===== */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-around border-t border-gray-200 bg-white py-1 md:hidden">
        {itensMenu.slice(0, 5).map(({ rota, rotulo, icone: Icone }) => (
          <NavLink
            key={rota}
            to={rota}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium ${
                isActive ? 'text-primary' : 'text-gray-500'
              }`
            }
          >
            <Icone size={19} />
            {rotulo}
          </NavLink>
        ))}
      </nav>

      <ContainerToasts />
    </div>
  );
}
