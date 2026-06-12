// =====================================================================
// 4Flow — Roteamento principal
// Rotas lazy-loaded por módulo (code splitting)
// =====================================================================
import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from './store/auth';
import { Spinner, Botao } from './components/ui';
import Shell from './components/layout/Shell';
import ProtectedRoute from './modules/auth/ProtectedRoute';
import LoginPage from './modules/auth/LoginPage';
import TrocarSenhaPage from './modules/auth/TrocarSenhaPage';

// ----- Lazy imports (um chunk por módulo) -----
const DashboardPage = lazy(() => import('./modules/dashboard/DashboardPage'));
const ContactsListPage = lazy(() => import('./modules/contacts/ContactsListPage'));
const ContactProfilePage = lazy(() => import('./modules/contacts/ContactProfilePage'));
const ContactImportPage = lazy(() => import('./modules/contacts/ContactImportPage'));
const FormsListPage = lazy(() => import('./modules/forms/FormsListPage'));
const FormBuilderPage = lazy(() => import('./modules/forms/FormBuilderPage'));
const FormResponsesPage = lazy(() => import('./modules/forms/FormResponsesPage'));
const PublicFormPage = lazy(() => import('./modules/forms/PublicFormPage'));
const FlowsListPage = lazy(() => import('./modules/automation/FlowsListPage'));
const FlowEditorPage = lazy(() => import('./modules/automation/FlowEditorPage'));
const InboxPage = lazy(() => import('./modules/inbox/InboxPage'));
const CrmPage = lazy(() => import('./modules/crm/CrmPage'));
const EmailPage = lazy(() => import('./modules/email/EmailPage'));
const ReportsPage = lazy(() => import('./modules/reports/ReportsPage'));
const SettingsPage = lazy(() => import('./modules/settings/SettingsPage'));

function PaginaNaoAutorizada() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="rounded-full bg-red-50 p-4 text-red-600"><ShieldAlert size={32} /></div>
      <h1 className="text-xl font-bold text-navy">Acesso não autorizado</h1>
      <p className="max-w-sm text-sm text-gray-500">
        Seu perfil não tem permissão para acessar esta área. Se acredita que isso é um erro, fale com um administrador.
      </p>
      <Link to="/dashboard"><Botao variante="secondary">Voltar ao Dashboard</Botao></Link>
    </div>
  );
}

export default function App() {
  const iniciar = useAuth((s) => s.iniciar);
  useEffect(() => iniciar(), [iniciar]);

  return (
    <Suspense fallback={<Spinner texto="Carregando módulo..." />}>
      <Routes>
        {/* públicas */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/f/:id" element={<PublicFormPage />} />
        <Route path="/trocar-senha" element={<ProtectedRoute><TrocarSenhaPage /></ProtectedRoute>} />
        <Route path="/unauthorized" element={<PaginaNaoAutorizada />} />

        {/* autenticadas — dentro do shell */}
        <Route element={<ProtectedRoute><Shell /></ProtectedRoute>}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          <Route path="/contacts" element={<ContactsListPage />} />
          <Route path="/contacts/import" element={<ProtectedRoute requiredRole="operador"><ContactImportPage /></ProtectedRoute>} />
          <Route path="/contacts/:id" element={<ContactProfilePage />} />

          <Route path="/forms" element={<ProtectedRoute requiredRole="operador"><FormsListPage /></ProtectedRoute>} />
          <Route path="/forms/:id/edit" element={<ProtectedRoute requiredRole="operador"><FormBuilderPage /></ProtectedRoute>} />
          <Route path="/forms/:id/responses" element={<ProtectedRoute requiredRole="operador"><FormResponsesPage /></ProtectedRoute>} />

          <Route path="/automation" element={<ProtectedRoute requiredRole="operador"><FlowsListPage /></ProtectedRoute>} />
          <Route path="/automation/:id/edit" element={<ProtectedRoute requiredRole="operador"><FlowEditorPage /></ProtectedRoute>} />

          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/inbox/:conversationId" element={<InboxPage />} />

          <Route path="/crm" element={<CrmPage />} />
          <Route path="/crm/list" element={<CrmPage />} />

          <Route path="/email/:secao" element={<ProtectedRoute requiredRole="operador"><EmailPage /></ProtectedRoute>} />
          <Route path="/email/:secao/:id" element={<ProtectedRoute requiredRole="operador"><EmailPage /></ProtectedRoute>} />

          <Route path="/reports/:tipo" element={<ReportsPage />} />

          <Route path="/settings/:secao" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
