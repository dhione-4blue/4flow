// =====================================================================
// 4Flow — Proteção de rotas por autenticação e role
// <ProtectedRoute requiredRole="admin"><UsersPage /></ProtectedRoute>
// =====================================================================
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import { Spinner } from '../../components/ui';
import type { UserRole } from '../../types';

interface Props {
  children: ReactNode;
  requiredRole?: UserRole;
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { firebaseUser, perfil, carregando, temRole } = useAuth();
  const location = useLocation();

  if (carregando) return <Spinner texto="Verificando sessão..." />;

  // não autenticado → login
  if (!firebaseUser || !perfil) {
    return <Navigate to="/login" state={{ de: location.pathname }} replace />;
  }

  // troca obrigatória de senha no primeiro acesso
  if (perfil.mustChangePassword && location.pathname !== '/trocar-senha') {
    return <Navigate to="/trocar-senha" replace />;
  }

  // role insuficiente → página de não autorizado
  if (requiredRole && !temRole(requiredRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
