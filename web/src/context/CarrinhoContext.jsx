// Estado global do carrinho
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CarrinhoContext = createContext(null);

export function CarrinhoProvider({ children }) {
  const [linhas, setLinhas] = useState(() => {
    try {
      const guardado = localStorage.getItem('dcm_carrinho');
      const produtos = guardado ? JSON.parse(guardado) : [];

      return Array.isArray(produtos) ? produtos : [];
    } catch {
      return [];
    }
  });// [{ produto, quantidade }]
  useEffect(() => {
    localStorage.setItem('dcm_carrinho', JSON.stringify(linhas));
  }, [linhas]);
  function adicionar(produto, quantidade = 1) {
    setLinhas((atual) => {
      const existe = atual.find((l) => l.produto._id === produto._id);
      if (existe) {
        return atual.map((l) => l.produto._id === produto._id
          ? { ...l, quantidade: l.quantidade + quantidade } : l);
      }
      return [...atual, { produto, quantidade }];
    });
  }

  function remover(produtoId) {
    setLinhas((atual) => atual.filter((l) => l.produto._id !== produtoId));
  }


  function alterarQuantidade(produtoId, quantidade) {
    const novaQuantidade = Number(quantidade);

    if (!Number.isSafeInteger(novaQuantidade) || novaQuantidade < 1) {
      return;
    }

    setLinhas((atual) =>
      atual.map((linha) =>
        linha.produto._id === produtoId
          ? { ...linha, quantidade: novaQuantidade }
          : linha
      )
    );
  }

  // Remove apenas os produtos de uma encomenda confirmada
  function removerVarios(produtoIds) {
    const ids = new Set(produtoIds.map(String));

    setLinhas((atual) =>
      atual.filter((linha) => !ids.has(String(linha.produto._id)))
    );
  }


  // TODO: alterar quantidade, esvaziar após encomendar, agrupar por produtor
  const total = useMemo(
    () => linhas.reduce((s, l) => s + l.produto.preco * l.quantidade, 0), [linhas]);

  return (
    <CarrinhoContext.Provider value={{
      linhas,
      adicionar,
      remover,
      alterarQuantidade,
      removerVarios,
      total
    }}>
      {children}
    </CarrinhoContext.Provider>
  );
}

export const useCarrinho = () => useContext(CarrinhoContext);
