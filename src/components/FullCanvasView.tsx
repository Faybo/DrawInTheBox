import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Download, ZoomIn, ZoomOut, Move, Grid, Filter, BarChart2 } from 'lucide-react';
import { Square } from '../types';

interface FullCanvasViewProps {
  isOpen: boolean;
  onClose: () => void;
  squares: Square[];
  gridSize: number;
}

interface ViewStats {
  totalSquares: number;
  purchasedSquares: number;
  squaresWithImages: number;
  totalRevenue: number;
}

const FullCanvasView: React.FC<FullCanvasViewProps> = ({
  isOpen,
  onClose,
  squares,
  gridSize
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [renderedCount, setRenderedCount] = useState(0);
  const [batchesProcessed, setBatchesProcessed] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'purchased' | 'withImages'>('all');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [stats, setStats] = useState<ViewStats>({
    totalSquares: 0,
    purchasedSquares: 0,
    squaresWithImages: 0,
    totalRevenue: 0
  });

  // Otimizar renderização do canvas principal
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let isMounted = true;
    let abortController = new AbortController();
    let animationFrameId: number;
    
    const renderCanvas = async () => {
      try {
        setLoading(true);
        setLoadingProgress(0);
        setRenderedCount(0);
        
        const size = 2400;
        canvas.width = size;
        canvas.height = size;

        // Usar cores mais suaves para o fundo
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const squareSize = size / gridSize;
        
        // Filtrar quadrados baseado no modo de visualização
        const filteredSquares = squares.filter(square => {
          switch (viewMode) {
            case 'purchased':
              return square.owner !== null;
            case 'withImages':
              return square.imageData !== null;
            default:
              return true;
          }
        });

        const batchSize = 100;
        let drawnCount = 0;
        const totalSquares = filteredSquares.length;
        const totalBatches = Math.ceil(totalSquares / batchSize);
        
        const drawBatch = async (startIdx: number) => {
          if (!isMounted || abortController.signal.aborted) return;
          
          const endIdx = Math.min(startIdx + batchSize, filteredSquares.length);
          
          for (let i = startIdx; i < endIdx; i++) {
            const square = filteredSquares[i];
            const row = Math.floor(i / gridSize);
            const col = i % gridSize;
            const x = col * squareSize;
            const y = row * squareSize;
            
            // Desenhar com efeitos visuais baseados no modo
            if (viewMode === 'purchased') {
              // Gradiente suave para quadrados comprados
              const gradient = ctx.createLinearGradient(x, y, x + squareSize, y + squareSize);
              gradient.addColorStop(0, square.color || '#f0f0f0');
              gradient.addColorStop(1, square.color || '#e0e0e0');
              ctx.fillStyle = gradient;
              ctx.fillRect(x, y, squareSize, squareSize);
              
              // Efeito de sombra suave
              ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
              ctx.shadowBlur = 2;
              ctx.shadowOffsetX = 1;
              ctx.shadowOffsetY = 1;
            } else {
              ctx.fillStyle = square.owner ? (square.color || '#f0f0f0') : '#ffffff';
              ctx.fillRect(x, y, squareSize, squareSize);
            }
            
            // Resetar sombra
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            drawnCount++;
          }
          
          const currentBatch = Math.floor(endIdx / batchSize);
          const progress = Math.min(85, Math.round((drawnCount / totalSquares) * 100));
          
          if (isMounted) {
            setLoadingProgress(progress);
            setRenderedCount(drawnCount);
            setBatchesProcessed(currentBatch);
          }
          
          // Usar requestAnimationFrame para melhor performance
          if (endIdx < filteredSquares.length && isMounted && !abortController.signal.aborted) {
            animationFrameId = requestAnimationFrame(() => drawBatch(endIdx));
          } else if (isMounted) {
            await drawImages();
          }
        };
        
        const drawImages = async () => {
          if (!isMounted || abortController.signal.aborted) return;
          
          const squaresWithImages = filteredSquares.filter(square => square.imageData);
          
          if (squaresWithImages.length === 0) {
            if (isMounted) {
              setLoading(false);
              setLoadingProgress(100);
            }
            return;
          }
          
          const imageBatchSize = 20;
          let imageCount = 0;
          
          for (let i = 0; i < squaresWithImages.length; i += imageBatchSize) {
            if (!isMounted || abortController.signal.aborted) return;
            
            const batch = squaresWithImages.slice(i, i + imageBatchSize);
            const promises = batch.map(square => {
              return new Promise<void>(resolve => {
                try {
                  const image = new Image();
                  image.crossOrigin = "Anonymous";
                  image.src = square.imageData!;
                  
                  const timeout = setTimeout(() => {
                    console.warn(`Timeout ao carregar imagem para quadrado ${square.id}`);
                    resolve();
                  }, 1000);
                  
                  image.onload = () => {
                    clearTimeout(timeout);
                    const index = filteredSquares.findIndex(s => s.id === square.id);
                    if (index !== -1) {
                      const row = Math.floor(index / gridSize);
                      const col = index % gridSize;
                      const x = col * squareSize;
                      const y = row * squareSize;
                      
                      // Adicionar suavização de imagem
                      ctx.imageSmoothingEnabled = true;
                      ctx.imageSmoothingQuality = 'high';
                      ctx.drawImage(image, x, y, squareSize, squareSize);
                      imageCount++;
                    }
                    resolve();
                  };
                  
                  image.onerror = () => {
                    clearTimeout(timeout);
                    console.warn(`Erro ao carregar imagem para quadrado ${square.id}`);
                    resolve();
                  };
                } catch (error) {
                  console.error(`Erro ao processar imagem: ${error}`);
                  resolve();
                }
              });
            });
            
            await Promise.all(promises);
            
            const imageProgress = 85 + Math.round((i / squaresWithImages.length) * 15);
            if (isMounted) {
              setLoadingProgress(Math.min(99, imageProgress));
            }
            
            // Usar requestAnimationFrame para melhor performance
            animationFrameId = requestAnimationFrame(() => {
              if (i + imageBatchSize < squaresWithImages.length) {
                drawImages();
              }
            });
          }
          
          if (isMounted) {
            setLoading(false);
            setLoadingProgress(100);
          }
        };
        
        await drawBatch(0);
        
      } catch (err) {
        console.error('Erro na renderização do canvas:', err);
        if (isMounted) {
          setError('Falha ao renderizar a tela. Por favor, tente novamente.');
          setLoading(false);
        }
      }
    };

    renderCanvas();
    
    return () => {
      isMounted = false;
      abortController.abort();
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isOpen, squares, gridSize, viewMode]);

  // Calcular estatísticas
  useEffect(() => {
    const newStats: ViewStats = {
      totalSquares: squares.length,
      purchasedSquares: squares.filter(s => s.owner).length,
      squaresWithImages: squares.filter(s => s.imageData).length,
      totalRevenue: squares.reduce((acc, s) => acc + (s.price || 0), 0)
    };
    setStats(newStats);
  }, [squares]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY;
    const zoomFactor = 0.1;
    
    setZoom(prev => {
      const newZoom = delta > 0 
        ? Math.max(prev - zoomFactor, 0.5)
        : Math.min(prev + zoomFactor, 4);
      
      // Calcular o ponto de zoom baseado na posição do mouse
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return newZoom;
      
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Ajustar a posição para manter o ponto de zoom fixo
      const scale = newZoom / prev;
      setPosition(prev => ({
        x: mouseX - (mouseX - prev.x) * scale,
        y: mouseY - (mouseY - prev.y) * scale
      }));
      
      return newZoom;
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // Botão esquerdo do mouse
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    } else if (e.button === 2) { // Botão direito do mouse
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
      setRotation(angle * (180 / Math.PI));
    }
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    
    // Calcular a nova posição com suavização
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    // Aplicar a nova posição com transição suave
    setPosition(prev => ({
      x: newX,
      y: newY
    }));
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.25, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  }, []);

  const downloadCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    
    const link = document.createElement('a');
    link.download = 'million-dollar-painting.png';
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  }, []);

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    setLoadingProgress(0);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div 
        ref={containerRef}
        className="relative bg-white rounded-lg shadow-xl w-full h-full max-w-7xl max-h-[90vh] overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
      >
        {/* Barra de ferramentas com efeito de vidro */}
        <div className="absolute top-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-b p-2 flex items-center justify-between z-10">
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <button
              onClick={handleZoomIn}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowStats(!showStats)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <BarChart2 className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as any)}
              className="p-2 border rounded bg-white/50 backdrop-blur-sm"
            >
              <option value="all">Todos os Quadrados</option>
              <option value="purchased">Quadrados Comprados</option>
              <option value="withImages">Com Imagens</option>
            </select>
            <button
              onClick={downloadCanvas}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Canvas principal com efeito de sombra */}
        <div className="absolute inset-0 overflow-hidden">
          <canvas
            ref={canvasRef}
            className="absolute shadow-2xl"
            style={{
              transform: `scale(${zoom}) translate(${position.x}px, ${position.y}px) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              cursor: isDragging ? 'grabbing' : 'grab',
              transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
              willChange: 'transform',
              touchAction: 'none'
            }}
          />
        </div>

        {/* Estatísticas com efeito de vidro */}
        {showStats && (
          <div className="absolute top-16 left-4 bg-white/80 backdrop-blur-sm rounded-lg shadow-lg p-4">
            <h3 className="font-bold mb-2">Estatísticas da Obra</h3>
            <div className="space-y-1">
              <p>Total de Quadrados: {stats.totalSquares}</p>
              <p>Quadrados Comprados: {stats.purchasedSquares}</p>
              <p>Quadrados com Imagens: {stats.squaresWithImages}</p>
              <p>Receita Total: ${stats.totalRevenue.toFixed(2)}</p>
            </div>
          </div>
        )}

        {/* Barra de progresso com efeito de vidro */}
        {loading && (
          <div className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t p-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Carregando... {loadingProgress}%
            </div>
          </div>
        )}

        {/* Mensagem de erro com efeito de vidro */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm">
            <div className="text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Tentar Novamente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FullCanvasView; 