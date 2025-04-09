import React, { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import { Palette, ShoppingCart, Edit3, LogIn, LogOut, User, X, CheckCircle } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, setDoc, getDoc, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from './firebase';
import { Square, User as UserType } from './types';
import AuthModal from './components/AuthModal';
import { useLocation } from 'react-router-dom';
import { 
  GRID_SIZE, 
  SQUARE_MIN_SIZE, 
  SQUARE_MAX_SIZE,
  initializeGrid,
  getCanvasSize,
  calculateGridSize
} from './utils/gridUtils';

// Lazy load componentes pesados para melhorar a performance inicial
const PaymentModal = lazy(() => import('./components/PaymentModal'));
const DrawingCanvas = lazy(() => import('./components/DrawingCanvas'));
const FullCanvasView = lazy(() => import('./components/FullCanvasView'));

// Interface para dimensões do grid com número de quadrados visíveis
interface GridDimensions {
  width: number;
  height: number;
  squareSize: number;
  visibleCols?: number;
  visibleRows?: number;
}

// Função otimizada de virtualização para renderizar apenas quadrados visíveis
const useVirtualGrid = (
  gridRef: React.RefObject<HTMLDivElement>, 
  squares: Square[], 
  gridDimensions: GridDimensions,
  renderSquare: (square: Square) => JSX.Element
) => {
  const [visibleSquares, setVisibleSquares] = useState<JSX.Element[]>([]);
  const visibleRangeRef = useRef({
    startCol: 0,
    endCol: 0,
    startRow: 0,
    endRow: 0
  });
  const requestRef = useRef<number | null>(null);
  const squaresCacheRef = useRef<Map<number, JSX.Element>>(new Map());
  
  // Limpar cache quando as props principais mudam
  useEffect(() => {
    squaresCacheRef.current.clear();
  }, [gridDimensions.squareSize]);
  
  // Função otimizada de atualização com debounce e request animation frame
  const updateVisibleSquares = useCallback(() => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    
    requestRef.current = requestAnimationFrame(() => {
      if (!gridRef.current) return;
      
      // Usar as dimensões calculadas de quadrados visíveis
      const visibleCols = gridDimensions.visibleCols || 0;
      const visibleRows = gridDimensions.visibleRows || 0;
      
      // Centralizar o grid - determinar o quadrado inicial para ficar centralizado
      const startCol = Math.max(0, Math.floor((GRID_SIZE - visibleCols) / 2));
      const startRow = Math.max(0, Math.floor((GRID_SIZE - visibleRows) / 2));
      
      // Calcular os índices finais
      const endCol = Math.min(GRID_SIZE - 1, startCol + visibleCols - 1);
      const endRow = Math.min(GRID_SIZE - 1, startRow + visibleRows - 1);
      
      // Evitar atualizações desnecessárias verificando se a área visível mudou
      const currentRange = visibleRangeRef.current;
      if (
        currentRange.startCol === startCol &&
        currentRange.endCol === endCol &&
        currentRange.startRow === startRow &&
        currentRange.endRow === endRow
      ) {
        return;
      }
      
      // Atualizar a referência da área visível
      visibleRangeRef.current = {
        startCol,
        endCol,
        startRow,
        endRow
      };
      
      // Renderizar apenas os quadrados visíveis com otimização de performance
      const visible: JSX.Element[] = [];
      
      // Cache para quadrados já renderizados
      const cache = squaresCacheRef.current;
      
      for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
          const index = row * GRID_SIZE + col;
          if (index >= 0 && index < squares.length) {
            const square = squares[index];
            
            // Verificar se este quadrado já está em cache
            if (cache.has(square.id)) {
              visible.push(cache.get(square.id)!);
            } else {
              const renderedSquare = renderSquare(square);
              cache.set(square.id, renderedSquare);
              visible.push(renderedSquare);
            }
          }
        }
      }
      
      // Limitar tamanho do cache para economizar memória
      if (cache.size > 1000) {
        // Preservar apenas os quadrados recentemente usados
        const keysToPreserve = new Set<number>();
        for (let row = startRow - 10; row <= endRow + 10; row++) {
          for (let col = startCol - 10; col <= endCol + 10; col++) {
            const index = row * GRID_SIZE + col;
            if (index >= 0 && index < squares.length) {
              keysToPreserve.add(squares[index].id);
            }
          }
        }
        
        // Remover quadrados antigos do cache
        for (const key of cache.keys()) {
          if (!keysToPreserve.has(key)) {
            cache.delete(key);
          }
        }
      }
      
      setVisibleSquares(visible);
    });
  }, [gridRef, gridDimensions, squares, renderSquare]);
  
  // Efeito para configuração inicial e limpeza
  useEffect(() => {
    updateVisibleSquares();
    
    const container = gridRef.current;
    if (!container) return;
    
    // Usar passive: true para melhor desempenho de scroll
    container.addEventListener('scroll', updateVisibleSquares, { passive: true });
    
    // Usar ResizeObserver para mudanças de tamanho
    const resizeObserver = new ResizeObserver(() => {
      updateVisibleSquares();
    });
    resizeObserver.observe(container);
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      container.removeEventListener('scroll', updateVisibleSquares);
      resizeObserver.disconnect();
    };
  }, [gridRef, updateVisibleSquares]);
  
  return visibleSquares;
};

// Função de debounce para otimizar eventos frequentes
const debounce = <F extends (...args: any[]) => any>(func: F, wait: number) => {
  let timeout: NodeJS.Timeout;
  return function(...args: Parameters<F>) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Substituir a função SquareGrid para preencher horizontalmente sem scroll
const SquareGrid = ({ 
  squares, 
  onSquareClick,
  user,
  selectedSquare 
}: { 
  squares: Square[], 
  onSquareClick: (id: number) => void,
  user: UserType | null,
  selectedSquare: number | null
}) => {
  // Referência ao tamanho da tela atual
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });
  
  // Atualizar dimensões quando a tela for redimensionada
  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Calcular o tamanho ideal dos quadrados para preencher a tela
  const headerHeight = 52; // Altura do cabeçalho
  const availableWidth = dimensions.width - 20; // Margem
  const availableHeight = dimensions.height - headerHeight - 20; // Margem
  
  // Calcular o tamanho do quadrado para maximizar o número visível
  const squareSize = Math.max(
    SQUARE_MIN_SIZE,
    Math.min(
      Math.floor(availableWidth / GRID_SIZE), 
      Math.floor(availableHeight / GRID_SIZE),
      18 // Limitamos a 18px para garantir que caibam muitos quadrados
    )
  );

  // Criar array com os quadrados a exibir
  const rows = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    const cols = [];
    for (let col = 0; col < GRID_SIZE; col++) {
      const id = row * GRID_SIZE + col;
      if (id < squares.length) {
        const square = squares[id];
        const isOwned = square.owner !== null;
        const isCurrentUserOwner = isOwned && user && square.owner === user.uid;
        const isSelected = selectedSquare === id;
        
        // Estilo para o quadrado com tamanho dinâmico
        const style: React.CSSProperties = {
          width: `${squareSize}px`,
          height: `${squareSize}px`,
          backgroundColor: isOwned ? (square.color || (isCurrentUserOwner ? '#9900ff' : '#ff6666')) : '#ffffff',
          backgroundImage: square.imageData ? `url(${square.imageData})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          border: isCurrentUserOwner 
            ? '1px solid #9900ff'  // Contorno para quadrados do usuário
            : '0.5px solid #ddd',  // Borda para todos os outros quadrados (tanto comprados quanto disponíveis)
          display: 'inline-block',
          position: 'relative',
          cursor: 'pointer',
          // Destaque visual quando selecionado
          boxShadow: isSelected ? '0 0 0 1px rgba(79, 70, 229, 0.8)' : 'none',
        };
        
        // Conteúdo do quadrado - adaptado para o novo tamanho
        let squareContent = null;
        
        if (isCurrentUserOwner) {
          // Indicador visual para quadrados próprios
          squareContent = (
            <div style={{
              position: 'absolute',
              top: '0px',
              right: '0px',
              width: squareSize > 10 ? '4px' : '3px',
              height: squareSize > 10 ? '4px' : '3px',
              backgroundColor: '#9900ff', 
              borderRadius: '50%'
            }} />
          );
        }
        
        cols.push(
          <div 
            key={id} 
            style={style}
            onClick={() => onSquareClick(id)}
            title={`Quadrado ${id}${isOwned ? (isCurrentUserOwner ? ' (seu)' : ' (comprado)') : ''}`}
            data-owner={square.owner || 'none'}
            data-is-yours={isCurrentUserOwner ? 'true' : 'false'}
          >
            {squareContent}
          </div>
        );
      }
    }
    rows.push(<div key={row} style={{ display: 'flex', lineHeight: 0 }}>{cols}</div>);
  }

  return (
    <div style={{ 
      border: '1px solid #ddd', 
      padding: '1px', 
      maxWidth: '100%', 
      maxHeight: '100%', 
      overflow: 'auto'
    }}>
      {rows}
    </div>
  );
};

function App() {
  // Estados principais - manter apenas os essenciais
  const [squares, setSquares] = useState<Square[]>(initializeGrid());
  const [user, setUser] = useState<UserType | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [preparePaymentModalOpen, setPreparePaymentModalOpen] = useState(false);
  const [paymentOptionsModalOpen, setPaymentOptionsModalOpen] = useState(false);
  const [cardPaymentModalOpen, setCardPaymentModalOpen] = useState(false);
  const [payPalProcessingModalOpen, setPayPalProcessingModalOpen] = useState(false);
  const [fullCanvasViewOpen, setFullCanvasViewOpen] = useState(false);
  const [viewSquareModalOpen, setViewSquareModalOpen] = useState(false);
  const [cardDetails, setCardDetails] = useState({
    number: '',
    expiry: '',
    cvc: '',
    name: ''
  });
  const [currentSquare, setCurrentSquare] = useState<Square | null>(null);
  const [drawingCanvasOpen, setDrawingCanvasOpen] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<boolean>(false);
  const [cardDetailsErrors, setCardDetailsErrors] = useState({
    number: false,
    expiry: false,
    cvc: false,
    name: false
  });
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isLoadingSquares, setIsLoadingSquares] = useState(true);
  
  const location = useLocation();
  const gridRef = useRef<HTMLDivElement>(null);
  
  // Calcular tamanho do canvas e dimensões do grid apenas quando necessário
  const canvasSize = useMemo(() => getCanvasSize(), []);
  const [gridDimensions, setGridDimensions] = useState<GridDimensions>(calculateGridSize(window.innerWidth, window.innerHeight));
  
  // Calcular estatísticas do grid - otimizado com useMemo para prevenir recálculos desnecessários
  const gridStats = useMemo(() => {
    // Forçar recálculo garantindo todos os quadrados
    const totalSquares = GRID_SIZE * GRID_SIZE;
    // Contar explicitamente quadrados com owner diferente de null
    const purchasedSquares = squares.reduce((count, square) => 
      square.owner !== null ? count + 1 : count, 0);
    const availableSquares = totalSquares - purchasedSquares;
    const percentagePurchased = totalSquares > 0 ? (purchasedSquares / totalSquares) * 100 : 0;
    
    return {
      total: totalSquares,
      purchased: purchasedSquares,
      available: availableSquares,
      percentagePurchased: Math.round(percentagePurchased)
    };
  }, [squares]);
  
  // Debounce para o redimensionamento da janela
  const debouncedResize = useCallback(
    debounce(() => {
      setGridDimensions(calculateGridSize(window.innerWidth, window.innerHeight));
    }, 150),
    []
  );
  
  // Otimizar useEffect para atualizar o grid apenas quando necessário
  useEffect(() => {
    // Registrar event listener com debounce
    window.addEventListener('resize', debouncedResize);
    
    return () => {
      window.removeEventListener('resize', debouncedResize);
    };
  }, [debouncedResize]);
  
  // Firebase Auth listener - CORRIGIDO para garantir que usuários sejam reconhecidos corretamente
  useEffect(() => {
    // Remover força o logout para permitir troca de conta
    const forceLogout = new URLSearchParams(location.search).get('logout');
    if (forceLogout === 'true') {
      console.log("Forçando logout por parâmetro de URL");
      auth.signOut();
      localStorage.removeItem('currentUser');
      window.history.replaceState({}, document.title, location.pathname);
    }
    
    // Verificar se já existe usuário no localStorage para evitar flashes de UI
    const cachedUser = localStorage.getItem('currentUser');
    if (cachedUser && !forceLogout) {
      try {
        const parsed = JSON.parse(cachedUser);
        setUser({
          uid: parsed.uid,
          email: parsed.email || '',
          displayName: parsed.displayName || parsed.email?.split('@')[0] || 'Usuário'
        });
      } catch (e) {
        console.error("Erro ao carregar usuário do cache:", e);
        localStorage.removeItem('currentUser');
      }
    }
    
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      if (authUser) {
        const userInfo = {
          uid: authUser.uid,
          email: authUser.email || '',
          displayName: authUser.displayName || authUser.email?.split('@')[0] || 'Usuário'
        };
        setUser(userInfo);
        
        // Salvar no localStorage para persistência
        localStorage.setItem('currentUser', JSON.stringify(userInfo));
      } else {
        setUser(null);
        localStorage.removeItem('currentUser');
      }
    });
    
    return () => unsubscribe();
  }, [location]);
  
  // Load squares data from Firestore
  useEffect(() => {
    const squaresRef = collection(db, 'squares');
    
    const unsubscribe = onSnapshot(squaresRef, (snapshot) => {
      const updatedSquares = [...initializeGrid()];
      
      console.log(`Recebendo ${snapshot.docs.length} quadrados do Firestore`);
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const squareId = parseInt(doc.id);
        
        if (squareId >= 0 && squareId < updatedSquares.length) {
          // Garantir que cor e outros dados sejam mantidos
          updatedSquares[squareId] = {
            ...updatedSquares[squareId],
            owner: data.owner,
            imageData: data.imageData || null,
            color: data.color || '#ffffff'
          };
          
          // Log para depuração - verificar se estamos de fato recebendo os dados
          if (data.owner) {
            console.log(`Quadrado ${squareId} pertence a: ${data.owner}`);
          }
        }
      });
      
      setSquares(updatedSquares);
      setIsLoadingSquares(false);
    });
    
    return () => unsubscribe();
  }, []);
  
  // Update grid size when window is resized - CORRIGIDO para ocupar toda a tela disponível
  useEffect(() => {
    const updateGridSize = () => {
      // Cálculo simplificado para garantir melhor visibilidade
      const headerHeight = 52; // Altura do cabeçalho
      const availableWidth = window.innerWidth - 10; // Margem mínima
      const availableHeight = window.innerHeight - headerHeight - 10; // Margem mínima
      
      // Usar um tamanho de quadrado maior para melhor visualização
      const optimizedSquareSize = Math.max(
        SQUARE_MIN_SIZE,
        Math.min(
          Math.floor(availableWidth / GRID_SIZE), 
          Math.floor(availableHeight / GRID_SIZE),
          SQUARE_MAX_SIZE
        )
      );
      
      // Calcular quantas colunas e linhas cabem na tela
      const visibleCols = Math.floor(availableWidth / optimizedSquareSize);
      const visibleRows = Math.floor(availableHeight / optimizedSquareSize);
      
      // Certificar-se de que nunca mostramos mais quadrados do que existem
      const effectiveCols = Math.min(visibleCols, GRID_SIZE);
      const effectiveRows = Math.min(visibleRows, GRID_SIZE);
      
      // Calcular dimensões totais para o grid visível
      const width = effectiveCols * optimizedSquareSize;
      const height = effectiveRows * optimizedSquareSize;
      
      console.log(`Grid dimensões atualizadas: ${width}x${height}, quadrados: ${effectiveCols}x${effectiveRows}, tamanho: ${optimizedSquareSize}px`);
      
      // Atualizar as dimensões com os novos valores
      setGridDimensions({
        width,
        height,
        squareSize: optimizedSquareSize,
        visibleCols: effectiveCols,
        visibleRows: effectiveRows
      });
    };

    // Calculate initial size
    updateGridSize();

    // Add window resize listener with throttling for better performance
    let timeout: NodeJS.Timeout | null = null;
    const throttledResize = () => {
      if (timeout) return;
      timeout = setTimeout(() => {
        updateGridSize();
        timeout = null;
      }, 150); // Throttle reduzido para 150ms para resposta mais rápida
    };
    
    window.addEventListener('resize', throttledResize);

    // Cleanup
    return () => {
      if (timeout) clearTimeout(timeout);
      window.removeEventListener('resize', throttledResize);
    };
  }, []);
  
  // Update handleSquareClick function - CORRIGIDO para melhor fluxo de autenticação
  const handleSquareClick = (squareId: number) => {
    console.log(`Clique no quadrado ${squareId}, usuário logado: ${user ? 'Sim' : 'Não'}`);
    
    // Sempre definir o quadrado selecionado
    setSelectedSquare(squareId);
    
    // Buscar o quadrado pelo ID
    const square = squares.find(s => s.id === squareId);
    if (!square) {
      console.error("Quadrado não encontrado:", squareId);
      return;
    }
    
    // Verificação explícita do estado de login
    if (!user) {
      console.log("Usuário não logado, abrindo modal de autenticação");
      setAuthModalOpen(true);
      return;
    }
    
    // A partir daqui sabemos que o usuário está logado
    const isOwner = square.owner === user.uid;
    
    // Se o usuário é o dono, abrir para edição
    if (isOwner) {
      console.log("Usuário é dono do quadrado, abrindo modo de edição");
      setCurrentSquare(square);
      setIsEditing(true);
      setDrawingCanvasOpen(true);
      return;
    }
    
    // Se o quadrado já tem algum desenho e não pertence ao usuário, mostrar o modal de visualização
    if (square.owner !== null && (square.imageData || square.color !== '#ffffff')) {
      console.log("Quadrado pertence a outro usuário, abrindo modal de visualização");
      setCurrentSquare(square);
      setViewSquareModalOpen(true);
      return;
    }
    
    // Se não é dono e o quadrado está vazio, mostrar modal de pagamento diretamente
    console.log("Usuário não é dono, abrindo modal de pagamento");
    setPaymentModalOpen(true);
  };

  // Handle mouse up to end selection
  const handleMouseUp = () => {
    // Keep empty, but don't remove for potential additional changes in code
  };

  // Handle sign out
  const handleSignOut = () => {
    auth.signOut();
    localStorage.removeItem('currentUser');
    setSelectedSquare(null);
    // Adicionar um recarregamento para limpar completamente o estado
    window.location.href = `${window.location.pathname}?logout=true`;
  };
  
  // Atualizar a função handlePurchaseComplete para integrar com Stripe corretamente
  const handlePurchaseComplete = async () => {
    if (!selectedSquare || !user) return;
    
    try {
      // Fechar modal de pagamento
      setPaymentModalOpen(false);
      
      // Mostrar modal de opções de pagamento
      setPaymentOptionsModalOpen(true);
    } catch (error) {
      console.error("Erro ao iniciar processo de compra:", error);
      alert("Erro ao processar pagamento. Por favor, tente novamente.");
    }
  };
  
  // Função para integração com Stripe (conexão com API)
  const initiateStripeCheckout = async (squareId: number | null, price: number) => {
    if (!squareId || !user) return;
    
    try {
      setIsProcessingPayment(true);
      
      // No ambiente real, aqui faria uma chamada à API:
      // const response = await fetch('/api/create-checkout-session', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ squareId, price, userId: user.uid })
      // });
      // 
      // const { sessionId } = await response.json();
      // 
      // const stripe = await loadStripe('pk_test_your_key');
      // stripe.redirectToCheckout({ sessionId });
      
      // Simulação para ambiente de demonstração:
      console.log(`Iniciando checkout do Stripe para quadrado ${squareId} ao preço de $${price}`);
      
      // Simular redirecionamento e retorno bem-sucedido
      setTimeout(() => {
        setIsProcessingPayment(false);
        finalizeSquarePurchase();
      }, 800);
      
    } catch (error) {
      console.error("Erro ao processar pagamento com Stripe:", error);
      setIsProcessingPayment(false);
      alert("Erro ao processar pagamento. Por favor, tente novamente.");
    }
  };

  // Função para processar pagamento via PayPal
  const handlePayPalPayment = () => {
    setPaymentOptionsModalOpen(false);
    setPayPalProcessingModalOpen(true);
    
    // Simular integração com PayPal
    setTimeout(() => {
      setPayPalProcessingModalOpen(false);
      finalizeSquarePurchase();
    }, 800); // Reduzido para 800ms
  };

  // Função para processar pagamento via cartão
  const proceedToCardPayment = () => {
    setPaymentOptionsModalOpen(false);
    setCardPaymentModalOpen(true);
  };

  // Função para finalizar pagamento por cartão
  const handleCardPayment = () => {
    if (!cardDetails.number || !cardDetails.expiry || !cardDetails.cvc || !cardDetails.name) {
      setCardDetailsErrors({
        number: !cardDetails.number,
        expiry: !cardDetails.expiry,
        cvc: !cardDetails.cvc,
        name: !cardDetails.name
      });
      return;
    }
    
    setIsProcessingPayment(true);
    // Simulação de integração com Stripe
    setTimeout(() => {
      setCardPaymentModalOpen(false);
      finalizeSquarePurchase();
    }, 800); // Reduzido de 1500 para 800ms para ser mais rápido
  };

  // Função para finalizar a compra do quadrado
  const finalizeSquarePurchase = async () => {
    if (!selectedSquare || !user) return;
    
    try {
      setIsProcessingPayment(true);
      
      // Obter o quadrado selecionado
      const square = squares.find(s => s.id === selectedSquare);
      if (!square) return;
      
      // Verificar se o quadrado já tem dono
      const isOwned = square.owner !== null;
      
      // Se o quadrado já tem dono, o preço é o dobro do último preço de compra
      const price = isOwned ? square.price * 2 : square.price;
      
      console.log(`Finalizando compra do quadrado ${selectedSquare} por ${user.uid}`);
      
      // Atualizar no array local (preservar o desenho quando comprar de outro usuário)
      setSquares(prevSquares => 
        prevSquares.map(s => {
          if (s.id === selectedSquare) {
            const newPriceHistory = [...(s.priceHistory || [])];
            if (isOwned && s.owner) {
              newPriceHistory.push({
                owner: s.owner,
                price: s.price,
                timestamp: Date.now()
              });
            }
            
            return {
              ...s,
              owner: user.uid,
              price: price,
              // Preservar a cor e o desenho do quadrado quando for comprado de outro usuário
              color: isOwned ? s.color : '#ffffff',
              imageData: isOwned ? s.imageData : null,
              priceHistory: newPriceHistory
            };
          }
          return s;
        })
      );
      
      // Atualizar no Firebase (preservar o desenho quando comprar de outro usuário)
      const squareRef = doc(db, 'squares', selectedSquare.toString());
      await setDoc(squareRef, {
        owner: user.uid,
        price: price,
        priceHistory: square.priceHistory ? [
          ...square.priceHistory,
          ...(isOwned ? [{ owner: square.owner, price: square.price, timestamp: Date.now() }] : [])
        ] : [],
        // Preservar a cor e o desenho do quadrado quando for comprado de outro usuário
        ...(isOwned ? {} : { imageData: null, color: '#ffffff' }),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      // Registrar a compra no "sistema" do Stripe (simulação)
      console.log(`Registrando compra do quadrado ${selectedSquare} no Stripe`);
      
      // Notificar usuário que a compra foi bem-sucedida
      setPurchaseSuccess(true);
      setTimeout(() => setPurchaseSuccess(false), 3000);
      
    } catch (error) {
      console.error("Erro ao finalizar compra:", error);
      alert("Erro ao finalizar a compra. Por favor, tente novamente.");
    } finally {
      setIsProcessingPayment(false);
    }
  };
  
  // Função otimizada para salvar canvas
  const handleSaveDrawing = useCallback(async (imageData: string) => {
    if (!currentSquare || !user) return;
    
    try {
      // Due to CORS issues with Firebase Storage in development,
      // we'll save the image directly to Firestore as base64
      // Note: In production, it would be better to use Storage for large files
      
      // Compress the image to reduce size
      const compressedImageData = imageData; // Already compressed by DrawingCanvas
      
      // Update the square with the image
      setSquares(prevSquares => 
        prevSquares.map(s => 
          s.id === currentSquare.id
            ? { ...s, imageData: compressedImageData }
            : s
        )
      );
      
      // Save to Firestore
      const squareRef = doc(db, 'squares', `${currentSquare.id}`);
      await setDoc(squareRef, {
        owner: user.uid,
        imageData: compressedImageData
      }, { merge: true });
      
      // Close the canvas
      setDrawingCanvasOpen(false);
      setCurrentSquare(null);
      
      console.log('Image saved successfully!');
    } catch (error) {
      console.error('Error saving image:', error);
      alert('An error occurred while saving the image. Please try again.');
    }
  }, [currentSquare, user]);
  
  // Get initial image data for current square
  const getSquareImageData = () => {
    return currentSquare?.imageData || null;
  };

  // Update handleDrawingCanvasClose to reset isEditing
  const handleDrawingCanvasClose = () => {
    setDrawingCanvasOpen(false);
    setCurrentSquare(null);
    setIsEditing(false); // Reset editing state explicitly
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <header className="bg-white shadow-sm p-1 z-10 flex-shrink-0">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Palette className="h-6 w-6 text-indigo-600" />
            <div>
              <h1 className="text-xl font-bold">The Million Dollar Painting</h1>
              <div className="text-xs text-gray-600 flex flex-wrap items-center">
                <span className="mr-2">{gridStats.purchased} quadrados comprados</span>
                <span className="mr-2">{gridStats.available} disponíveis</span>
                <span>{gridStats.percentagePurchased}% preenchido</span>
              </div>
            </div>
          </div>
          
          <div className="flex space-x-2 items-center">
            {user ? (
              <>
                <div className="mr-2 text-sm text-gray-700">
                  <User className="h-4 w-4 inline align-text-bottom mr-1 text-indigo-600" /> 
                  <span className="font-medium">{user.displayName || user.email}</span>
                </div>
                <button
                  className="text-sm text-white bg-gray-600 py-1 px-3 rounded hover:bg-gray-700 flex items-center"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4 mr-1" /> Sair
                </button>
              </>
            ) : (
              <button
                className="text-sm bg-indigo-600 text-white py-1 px-3 rounded hover:bg-indigo-700 flex items-center"
                onClick={() => setAuthModalOpen(true)}
              >
                <LogIn className="h-4 w-4 mr-1" /> Entrar
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Grid centralizado e adaptado para não precisar de scroll */}
      <main className="flex-1 w-full h-full overflow-hidden relative flex bg-gray-100 p-2">
        {/* Informações de status */}
        <div className="absolute top-3 left-3 bg-white px-3 py-2 text-xs rounded-lg shadow-md text-gray-700 z-10 border border-gray-200">
          <div>Quadrados comprados: {!isLoadingSquares ? squares.filter(s => s.owner !== null).length : '...'}</div>
          <div>Grid: {GRID_SIZE}x{GRID_SIZE} quadrados</div>
          <div>Status: {isLoadingSquares ? 'Carregando...' : 'Pronto'}</div>
        </div>
        
        {/* Ajuda para novos usuários */}
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 bg-yellow-50 px-3 py-2 text-sm rounded-lg shadow-md text-yellow-800 font-medium border border-yellow-200 z-10">
          <div className="flex items-center">
            <span className="mr-2">🖱️</span>
            Clique em um quadrado para comprar ou editar
          </div>
        </div>
      
        {/* Container do grid sem scroll e ocupando mais espaço */}
        <div 
          className="w-full h-full flex-1 bg-white shadow-lg rounded-lg overflow-auto"
          style={{margin: '0 0 0 auto', paddingLeft: '10px'}}
        >
          {isLoadingSquares ? (
            <div className="p-8 flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-indigo-700 font-medium">Carregando quadrados...</p>
            </div>
          ) : (
            <SquareGrid
              squares={squares}
              onSquareClick={handleSquareClick}
              user={user}
              selectedSquare={selectedSquare}
            />
          )}
        </div>
        
        {/* Botão para ver a obra completa */}
        <button 
          onClick={() => setFullCanvasViewOpen(true)}
          className="absolute bottom-3 left-3 bg-indigo-600 text-white px-3 py-2 rounded-full shadow-md hover:bg-indigo-700 transition-colors flex items-center space-x-2"
        >
          <Palette className="h-4 w-4" />
          <span>Ver Obra Completa</span>
        </button>
      </main>

      {/* Suspense para componentes lazy */}
      <Suspense fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl flex items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-4"></div>
            <p>Carregando...</p>
          </div>
        </div>
      }>
        {/* Modais */}
        <AuthModal 
          isOpen={authModalOpen} 
          onClose={() => setAuthModalOpen(false)} 
        />
        
        {paymentModalOpen && (
          <PaymentModal
            isOpen={paymentModalOpen}
            onClose={() => setPaymentModalOpen(false)}
            onSuccess={handlePurchaseComplete}
            amount={selectedSquare ? squares.find(s => s.id === selectedSquare)?.price || 1 : 0}
            squareCount={1}
            cart={selectedSquare !== null ? [selectedSquare] : []}
            user={user}
          />
        )}
        
        {drawingCanvasOpen && (
          <DrawingCanvas 
            isOpen={drawingCanvasOpen}
            onClose={handleDrawingCanvasClose}
            onSave={handleSaveDrawing}
            initialImageData={currentSquare?.imageData || null}
            canvasSize={canvasSize}
            isOwner={!!currentSquare && currentSquare.owner === user?.uid}
          />
        )}
        
        {/* Outros modais condicional */}
        {preparePaymentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
              <div className="flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                <h3 className="text-lg font-medium text-gray-900">Processing Payment</h3>
                <p className="text-gray-500 text-center mt-2">Please wait while we prepare your payment...</p>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Opções de Pagamento */}
        {paymentOptionsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Escolha o Método de Pagamento</h2>
                <button onClick={() => {
                  setPaymentOptionsModalOpen(false);
                  setPaymentModalOpen(true);
                }} className="text-gray-400 hover:text-gray-500">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <button 
                  onClick={proceedToCardPayment}
                  className="w-full flex items-center justify-between bg-white border border-gray-300 p-4 rounded-lg hover:bg-gray-50 transition duration-200 mb-3"
                >
                  <div className="flex items-center">
                    <div className="bg-indigo-100 p-2 rounded-full mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Cartão de Crédito/Débito</p>
                      <p className="text-xs text-gray-500">Pagamento seguro via Stripe</p>
                    </div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                
                <button 
                  onClick={handlePayPalPayment}
                  className="w-full flex items-center justify-between bg-white border border-gray-300 p-4 rounded-lg hover:bg-gray-50 transition duration-200 mb-3"
                >
                  <div className="flex items-center">
                    <div className="bg-blue-100 p-2 rounded-full mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-700" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.641.641 0 0 1 .632-.525h6.006c2.243 0 3.596.82 4.112 2.472.256.814.344 1.686.267 2.545-.47 5.243-3.262 6.874-6.72 6.874H7.076z"/>
                        <path d="M10.994 8.58c.19-.842.094-1.283-.308-1.714-.4-.43-1.1-.645-2.005-.645H5.68a.513.513 0 0 0-.507.427l-1.44 9.095a.41.41 0 0 0 .402.468h2.376l.175-1.107c.043-.268.205-.424.477-.424h1.064c2.003 0 3.517-.875 3.926-3.383a3.385 3.385 0 0 0-.159-1.718z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">PayPal</p>
                      <p className="text-xs text-gray-500">Pagamento rápido e seguro com PayPal</p>
                    </div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <button 
                  onClick={() => {
                    if (selectedSquare !== null) {
                      const square = squares.find(s => s.id === selectedSquare);
                      if (square) {
                        const isOwned = square.owner !== null;
                        const price = isOwned ? square.price * 2 : square.price;
                        setPaymentOptionsModalOpen(false);
                        initiateStripeCheckout(selectedSquare, price);
                      }
                    }
                  }}
                  className="w-full flex items-center justify-between bg-white border border-gray-300 p-4 rounded-lg hover:bg-gray-50 transition duration-200 mb-3"
                >
                  <div className="flex items-center">
                    <div className="bg-black p-2 rounded-full mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Apple Pay / Google Pay</p>
                      <p className="text-xs text-gray-500">Pagamento rápido com um clique</p>
                    </div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <button 
                  onClick={() => {
                    setPaymentOptionsModalOpen(false);
                    finalizeSquarePurchase(); // Opção mais rápida para uma demonstração
                  }}
                  className="w-full flex items-center justify-between bg-white border border-gray-300 p-4 rounded-lg hover:bg-gray-50 transition duration-200"
                >
                  <div className="flex items-center">
                    <div className="bg-indigo-100 p-2 rounded-full mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Stripe Link</p>
                      <p className="text-xs text-gray-500">Pagamento mais rápido com um clique</p>
                    </div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              
              <div className="text-xs text-gray-500 text-center mt-4">
                <p className="mb-1">
                  <strong>Ambiente de Teste:</strong> Nenhum pagamento real será processado durante o desenvolvimento.
                </p>
                <p>
                  Na versão de produção, os pagamentos serão processados de forma segura pelo Stripe.
                </p>
                <div className="flex justify-center items-center mt-2">
                  <svg className="h-6" viewBox="0 0 60 25" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#635BFF" d="M59.64 14.28h-8.06v1.59h5.39v3.98h-5.39v1.65h8.06v3.33H46.76V10.82h12.88v3.46zM37.73 14.77a4.7 4.7 0 0 1 1.9.39 4.8 4.8 0 0 1 1.51 1.06 4.9 4.9 0 0 1 .98 1.56c.24.6.35 1.23.34 1.87 0 .66-.12 1.31-.36 1.93a4.96 4.96 0 0 1-1.01 1.64 4.73 4.73 0 0 1-1.57 1.13 4.83 4.83 0 0 1-2.03.42c-.76 0-1.5-.14-2.19-.43a4.76 4.76 0 0 1-1.73-1.21l2.66-2.42a1.83 1.83 0 0 0 1.23.56c.28.01.57-.05.82-.17.23-.11.39-.34.38-.6.02-.24-.12-.47-.34-.59-.4-.22-.84-.36-1.3-.43-.28-.07-.7-.14-1.25-.21-.55-.08-1.1-.24-1.6-.47a4.65 4.65 0 0 1-1.36-.93 4.5 4.5 0 0 1-.98-1.42c-.25-.6-.37-1.25-.36-1.9 0-.63.12-1.25.34-1.82.23-.58.57-1.1 1-1.56a4.38 4.38 0 0 1 1.52-1.08 4.82 4.82 0 0 1 1.89-.39c.66 0 1.31.11 1.93.34.63.23 1.2.58 1.69 1.05l-2.38 2.52a1.75 1.75 0 0 0-1.22-.55 1.4 1.4 0 0 0-.72.17c-.19.1-.31.3-.32.52 0 .24.12.45.33.57.37.17.76.28 1.17.33.3.03.74.12 1.31.25.58.13 1.14.34 1.67.63zM25.15 10.82H29.53V25.04H25.15zM19.9 10.82h4.38v3.33h-4.38V10.82zM19.9 15.76h4.38v9.28H19.9V15.76zM16.14 10.82h1.61V20.5c0 .31-.03.61-.07.91a2.9 2.9 0 0 1-.9 1.88c-.77.69-1.77 1.1-2.82 1.15-.63.02-1.25-.12-1.81-.4-.55-.27-1.01-.7-1.33-1.22-.35-.53-.55-1.13-.59-1.75-.01-.14-.02-.3-.02-.47v-9.16h4.53v9.17c0 .25.05.5.16.72.1.2.26.33.48.33a.62.62 0 0 0 .56-.33c.11-.22.16-.46.17-.72l.03-9.8zM4.4 13.7h1.1a2.55 2.55 0 0 0 1.37-.35c.3-.28.47-.67.47-1.08 0-.42-.16-.8-.47-1.09a2.55 2.55 0 0 0-1.37-.35H4.4V13.7zM0 10.82h5.86a7.87 7.87 0 0 1 2.42.35c.7.22 1.36.58 1.94 1.05.5.44.9.98 1.15 1.58.25.59.37 1.22.36 1.86 0 .9-.2 1.8-.59 2.61-.42.8-1.07 1.45-1.87 1.87a7.66 7.66 0 0 1-3.01.67H4.38v4.22H0v-14.2z"></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Modal de Processamento do PayPal */}
        {payPalProcessingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
              <div className="flex flex-col items-center justify-center">
                <div className="mb-4 bg-blue-100 p-3 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-700" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.641.641 0 0 1 .632-.525h6.006c2.243 0 3.596.82 4.112 2.472.256.814.344 1.686.267 2.545-.47 5.243-3.262 6.874-6.72 6.874H7.076z"/>
                    <path d="M10.994 8.58c.19-.842.094-1.283-.308-1.714-.4-.43-1.1-.645-2.005-.645H5.68a.513.513 0 0 0-.507.427l-1.44 9.095a.41.41 0 0 0 .402.468h2.376l.175-1.107c.043-.268.205-.424.477-.424h1.064c2.003 0 3.517-.875 3.926-3.383a3.385 3.385 0 0 0-.159-1.718z"/>
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900">Processando Pagamento PayPal</h3>
                <div className="animate-pulse flex space-x-4 mt-4">
                  <div className="h-2 w-8 bg-blue-300 rounded"></div>
                  <div className="h-2 w-8 bg-blue-500 rounded"></div>
                  <div className="h-2 w-8 bg-blue-300 rounded"></div>
                </div>
                <p className="text-gray-600 text-center my-4">
                  Processando seu pagamento via PayPal...
                </p>
                <div className="mb-4 bg-yellow-50 border border-yellow-200 p-3 rounded-md w-full">
                  <p className="text-sm text-yellow-800">
                    <strong>Importante:</strong> Ao comprar um quadrado, você obtém direitos exclusivos para desenhar nele.
                    Se alguém comprar seu quadrado, você perderá todos os direitos sobre ele sem compensação financeira.
                  </p>
                </div>
                <p className="text-xs text-gray-500 text-center mt-4">
                  <p className="mb-1">
                    <strong>Ambiente de Teste:</strong> Nenhum pagamento real será processado durante o desenvolvimento.
                  </p>
                  <p>
                    Na versão de produção, os pagamentos serão processados de forma segura pelo PayPal.
                  </p>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Pagamento com Cartão */}
        {cardPaymentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Pagamento Seguro com Stripe</h2>
                <button 
                  onClick={() => {
                    setCardPaymentModalOpen(false);
                    setPaymentOptionsModalOpen(true);
                  }} 
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="py-2">
                <div className="mb-4 bg-indigo-50 border border-indigo-200 p-3 rounded-md">
                  <p className="text-sm text-indigo-800">
                    <strong>Ambiente de Teste:</strong><br />
                    • Para testar, use o cartão: 4242 4242 4242 4242<br />
                    • Qualquer data futura e CVC de 3 dígitos
                  </p>
                </div>
                
                <div className="mb-4">
                  <div className="mb-4 border border-gray-300 p-4 rounded-md bg-gray-50">
                    <div className="flex items-center mb-2">
                      <div className="w-10 h-6 bg-blue-600 rounded mr-2 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">VISA</span>
                      </div>
                      <div className="w-10 h-6 bg-red-600 rounded mr-2 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">MC</span>
                      </div>
                      <div className="w-10 h-6 bg-gray-800 rounded flex items-center justify-center">
                        <span className="text-white text-xs font-bold">AMEX</span>
                      </div>
                    </div>
                    
                    {/* Simulação do Stripe Elements */}
                    <div className="border border-gray-300 rounded p-3 mb-3 bg-white">
                      <div className="text-gray-400 text-sm">Número do Cartão</div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-800 font-medium">•••• •••• •••• 4242</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    
                    <div className="flex space-x-3 mb-3">
                      <div className="flex-1 border border-gray-300 rounded p-3 bg-white">
                        <div className="text-gray-400 text-sm">Validade</div>
                        <div className="text-gray-800 font-medium">12/25</div>
                      </div>
                      <div className="flex-1 border border-gray-300 rounded p-3 bg-white">
                        <div className="text-gray-400 text-sm">CVC</div>
                        <div className="text-gray-800 font-medium">•••</div>
                      </div>
                    </div>
                    
                    <div className="border border-gray-300 rounded p-3 bg-white">
                      <div className="text-gray-400 text-sm">Nome no Cartão</div>
                      <div className="text-gray-800 font-medium">CLIENTE TESTE</div>
                    </div>
                  </div>
                </div>
                
                <div className="mb-4 bg-yellow-50 border border-yellow-200 p-3 rounded-md">
                  <p className="text-sm text-yellow-800">
                    <strong>Importante:</strong> Ao comprar um quadrado, você obtém direitos exclusivos para desenhar nele.
                    Se alguém comprar seu quadrado, você perderá todos os direitos sobre ele sem compensação financeira.
                  </p>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <button
                  onClick={() => {
                    setIsProcessingPayment(true);
                    // Simulando o redirecionamento para o Stripe Checkout
                    setTimeout(() => {
                      setCardPaymentModalOpen(false);
                      finalizeSquarePurchase();
                    }, 800);
                  }}
                  disabled={isProcessingPayment}
                  className="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition duration-200 disabled:opacity-50 font-medium"
                >
                  {isProcessingPayment ? 'Processando...' : 'Pagar Agora'}
                </button>
              </div>
              
              <div className="mt-4 text-xs text-center text-gray-500">
                <p className="mb-1">
                  <strong>Ambiente de Teste:</strong> Nenhum pagamento real será processado durante o desenvolvimento.
                </p>
                <p>
                  Na versão de produção, os pagamentos serão processados de forma segura pelo Stripe.
                </p>
                <div className="flex justify-center items-center mt-2">
                  <svg className="h-6" viewBox="0 0 60 25" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#635BFF" d="M59.64 14.28h-8.06v1.59h5.39v3.98h-5.39v1.65h8.06v3.33H46.76V10.82h12.88v3.46zM37.73 14.77a4.7 4.7 0 0 1 1.9.39 4.8 4.8 0 0 1 1.51 1.06 4.9 4.9 0 0 1 .98 1.56c.24.6.35 1.23.34 1.87 0 .66-.12 1.31-.36 1.93a4.96 4.96 0 0 1-1.01 1.64 4.73 4.73 0 0 1-1.57 1.13 4.83 4.83 0 0 1-2.03.42c-.76 0-1.5-.14-2.19-.43a4.76 4.76 0 0 1-1.73-1.21l2.66-2.42a1.83 1.83 0 0 0 1.23.56c.28.01.57-.05.82-.17.23-.11.39-.34.38-.6.02-.24-.12-.47-.34-.59-.4-.22-.84-.36-1.3-.43-.28-.07-.7-.14-1.25-.21-.55-.08-1.1-.24-1.6-.47a4.65 4.65 0 0 1-1.36-.93 4.5 4.5 0 0 1-.98-1.42c-.25-.6-.37-1.25-.36-1.9 0-.63.12-1.25.34-1.82.23-.58.57-1.1 1-1.56a4.38 4.38 0 0 1 1.52-1.08 4.82 4.82 0 0 1 1.89-.39c.66 0 1.31.11 1.93.34.63.23 1.2.58 1.69 1.05l-2.38 2.52a1.75 1.75 0 0 0-1.22-.55 1.4 1.4 0 0 0-.72.17c-.19.1-.31.3-.32.52 0 .24.12.45.33.57.37.17.76.28 1.17.33.3.03.74.12 1.31.25.58.13 1.14.34 1.67.63zM25.15 10.82H29.53V25.04H25.15zM19.9 10.82h4.38v3.33h-4.38V10.82zM19.9 15.76h4.38v9.28H19.9V15.76zM16.14 10.82h1.61V20.5c0 .31-.03.61-.07.91a2.9 2.9 0 0 1-.9 1.88c-.77.69-1.77 1.1-2.82 1.15-.63.02-1.25-.12-1.81-.4-.55-.27-1.01-.7-1.33-1.22-.35-.53-.55-1.13-.59-1.75-.01-.14-.02-.3-.02-.47v-9.16h4.53v9.17c0 .25.05.5.16.72.1.2.26.33.48.33a.62.62 0 0 0 .56-.33c.11-.22.16-.46.17-.72l.03-9.8zM4.4 13.7h1.1a2.55 2.55 0 0 0 1.37-.35c.3-.28.47-.67.47-1.08 0-.42-.16-.8-.47-1.09a2.55 2.55 0 0 0-1.37-.35H4.4V13.7zM0 10.82h5.86a7.87 7.87 0 0 1 2.42.35c.7.22 1.36.58 1.94 1.05.5.44.9.98 1.15 1.58.25.59.37 1.22.36 1.86 0 .9-.2 1.8-.59 2.61-.42.8-1.07 1.45-1.87 1.87a7.66 7.66 0 0 1-3.01.67H4.38v4.22H0v-14.2z"></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de visualização do canvas completo */}
        {fullCanvasViewOpen && (
          <FullCanvasView
            isOpen={fullCanvasViewOpen}
            onClose={() => setFullCanvasViewOpen(false)}
            squares={squares}
            gridSize={GRID_SIZE}
          />
        )}

        {/* Modal de visualização de quadrado de outros usuários */}
        {viewSquareModalOpen && currentSquare && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Quadrado #{currentSquare.id}</h2>
                <button 
                  onClick={() => setViewSquareModalOpen(false)} 
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="py-2">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Quadrado ampliado */}
                  <div className="flex-1 flex items-center justify-center">
                    <div 
                      style={{
                        width: '300px',
                        height: '300px',
                        backgroundColor: currentSquare.color || '#ffffff',
                        backgroundImage: currentSquare.imageData ? `url(${currentSquare.imageData})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        boxShadow: '0 0 10px rgba(0,0,0,0.1)'
                      }}
                    />
                  </div>
                  
                  {/* Informações do quadrado */}
                  <div className="flex-1">
                    <div className="mb-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Detalhes</h3>
                      <p className="text-gray-700">
                        <span className="font-semibold">Proprietário:</span> {currentSquare.owner ? 'Outro artista' : 'Disponível'}
                      </p>
                      <p className="text-gray-700">
                        <span className="font-semibold">Preço:</span> ${currentSquare.price || 1}
                      </p>
                      {currentSquare.priceHistory && currentSquare.priceHistory.length > 0 && (
                        <p className="text-gray-700">
                          <span className="font-semibold">Transações:</span> {currentSquare.priceHistory.length}
                        </p>
                      )}
                    </div>
                    
                    <div className="mb-4 bg-yellow-50 border border-yellow-200 p-3 rounded-md">
                      <p className="text-sm text-yellow-800">
                        Se você comprar este quadrado, você manterá o desenho atual e obterá direitos exclusivos para editá-lo.
                      </p>
                    </div>
                    
                    <button
                      onClick={() => {
                        setViewSquareModalOpen(false);
                        setPaymentModalOpen(true);
                      }}
                      className="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition duration-200 font-medium mt-2"
                    >
                      Comprar este Quadrado por ${(currentSquare.price || 1) * 2}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Suspense>

      {/* Feedback de sucesso de compra */}
      {purchaseSuccess && (
        <div className="fixed bottom-4 right-4 bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg max-w-sm z-50 animate-fade-in-up">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
            <div>
              <p className="font-medium text-green-800">Compra realizada com sucesso!</p>
              <p className="text-sm text-green-600">Agora você pode desenhar no seu quadrado.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(App);
