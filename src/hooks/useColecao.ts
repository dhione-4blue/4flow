// =====================================================================
// 4Flow — Hook genérico de leitura de coleção Firestore
// Suporta filtros, ordenação e paginação por cursor (25 itens/página)
// =====================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export const ITENS_POR_PAGINA = 25;

interface Opcoes {
  ordenarPor?: string;
  direcao?: 'asc' | 'desc';
  filtros?: QueryConstraint[];
  tamanhoPagina?: number;
}

export function useColecao<T extends { id: string }>(nomeColecao: string, opcoes: Opcoes = {}) {
  const { ordenarPor = 'createdAt', direcao = 'desc', filtros = [], tamanhoPagina = ITENS_POR_PAGINA } = opcoes;
  const [itens, setItens] = useState<T[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [temMais, setTemMais] = useState(false);
  const ultimoDoc = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  // serializa filtros para detectar mudanças sem loop infinito
  const chaveFiltros = JSON.stringify(filtros.map((f) => String((f as unknown as { type?: string }).type ?? '')) ) + ordenarPor + direcao + nomeColecao;

  const carregar = useCallback(
    async (resetar: boolean) => {
      setCarregando(true);
      setErro(null);
      try {
        const restricoes: QueryConstraint[] = [...filtros, orderBy(ordenarPor, direcao), limit(tamanhoPagina)];
        if (!resetar && ultimoDoc.current) restricoes.push(startAfter(ultimoDoc.current));
        const snap = await getDocs(query(collection(db, nomeColecao), ...restricoes));
        const novos = snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }));
        ultimoDoc.current = snap.docs[snap.docs.length - 1] ?? null;
        setTemMais(snap.docs.length === tamanhoPagina);
        setItens((prev) => (resetar ? novos : [...prev, ...novos]));
      } catch (e) {
        console.error(`Erro ao carregar ${nomeColecao}:`, e);
        setErro('Erro ao carregar dados. Verifique sua conexão e permissões.');
      } finally {
        setCarregando(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chaveFiltros]
  );

  useEffect(() => {
    ultimoDoc.current = null;
    carregar(true);
  }, [carregar]);

  return {
    itens,
    carregando,
    erro,
    temMais,
    carregarMais: () => carregar(false),
    recarregar: () => {
      ultimoDoc.current = null;
      carregar(true);
    },
    setItens,
  };
}
