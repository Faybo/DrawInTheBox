import React, { useRef, useEffect, useState, ChangeEvent, useCallback } from 'react';
import { 
  Command, 
  Download, 
  Droplet, 
  Edit3, 
  Eraser, 
  Layers, 
  RotateCcw, 
  RotateCw, 
  Save, 
  Trash2, 
  Upload, 
  X, 
  Zap,
  Undo,
  ChevronRight
} from 'lucide-react';
import tinycolor from 'tinycolor2';

interface DrawingCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (imageData: string) => void;
  initialImageData: string | null;
  canvasSize: { width: number; height: number };
  isOwner: boolean;
}

// Tipos de brush disponíveis - expandidos
type BrushType = 'pencil' | 'eraser' | 'spray' | 'fill' | 'highlighter';

// Tipos de simetria disponíveis
type SymmetryType = 'none' | 'horizontal' | 'vertical' | 'both';

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  isOpen,
  onClose,
  onSave,
  initialImageData,
  canvasSize,
  isOwner
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [brushType, setBrushType] = useState<BrushType>('pencil');
  const [brushSize, setBrushSize] = useState(5);
  const [opacity, setOpacity] = useState(100);
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const [redoStack, setRedoStack] = useState<ImageData[]>([]);
  const [scale, setScale] = useState(1);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [isEyeDropperActive, setIsEyeDropperActive] = useState(false);
  
  // Add state for canvas position
  const [canvasPosition, setCanvasPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(10);
  const [symmetryType, setSymmetryType] = useState<SymmetryType>('none');
  
  // Desenho prévio para otimização
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Adicionar função para desenhar linhas guia de simetria
  const drawSymmetryGuides = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas) return;
    
    const ctx = previewCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    // Limpar o canvas de preview
    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    
    if (symmetryType === 'none') return;
    
    // Configurar estilo para as linhas guia
    ctx.strokeStyle = 'rgba(100, 100, 255, 0.7)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    // Desenhar linha guia de simetria horizontal (espelho vertical)
    if (symmetryType === 'horizontal' || symmetryType === 'both') {
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    }
    
    // Desenhar linha guia de simetria vertical (espelho horizontal)
    if (symmetryType === 'vertical' || symmetryType === 'both') {
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.stroke();
    }
    
    ctx.setLineDash([]);
  }, [symmetryType]);
  
  // Efeito para atualizar as linhas guia quando o tipo de simetria muda
  useEffect(() => {
    drawSymmetryGuides();
  }, [symmetryType, drawSymmetryGuides]);

  useEffect(() => {
    if (!canvasRef.current || !isOpen) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    // Configurar o canvas com as dimensões fixas uma única vez
    // Estas dimensões são fixas independente do zoom
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    
    // Preencher com fundo branco
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Carregar imagem existente, se houver
    if (initialImageData) {
      // Criar uma imagem com tipo explicitamente
      const img: HTMLImageElement = document.createElement('img');
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Salvar o estado inicial no histórico de desfazer
        saveToUndoStack();
      };
      img.src = initialImageData;
    } else {
      // Salvar o estado inicial (canvas em branco) no histórico
      saveToUndoStack();
    }
  }, [isOpen, initialImageData]);

  // Salvar estado atual do canvas na pilha de desfazer
  const saveToUndoStack = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setUndoStack(prev => [...prev, imageData]);
    // Limpar a pilha de refazer quando uma nova ação é realizada
    setRedoStack([]);
  };

  // Função para desfazer a última ação
  const handleUndo = () => {
    if (undoStack.length <= 1) return; // Manter pelo menos um estado (o inicial)
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Remover o último estado da pilha de desfazer
    const newUndoStack = [...undoStack];
    const lastState = newUndoStack.pop();
    
    if (!lastState) return;
    
    // Adicionar o estado atual à pilha de refazer antes de desfazer
    const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setRedoStack(prev => [...prev, currentState]);
    
    // Obter o estado anterior e aplicá-lo
    const previousState = newUndoStack[newUndoStack.length - 1];
    if (previousState) {
      ctx.putImageData(previousState, 0, 0);
    }
    
    setUndoStack(newUndoStack);
  };

  // Função para refazer uma ação desfeita
  const handleRedo = () => {
    if (redoStack.length === 0) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Remover o último estado da pilha de refazer
    const newRedoStack = [...redoStack];
    const stateToRestore = newRedoStack.pop();
    
    if (!stateToRestore) return;
    
    // Adicionar o estado atual à pilha de desfazer
    const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setUndoStack(prev => [...prev, currentState]);
    
    // Aplicar o estado a ser restaurado
    ctx.putImageData(stateToRestore, 0, 0);
    
    setRedoStack(newRedoStack);
  };

  // Ajustar a função startDrawing para melhorar a calibração com zoom
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Certifique-se de que estamos usando apenas o botão esquerdo do mouse para desenhar
    if (!isOwner || isDrawingRef.current || e.button !== 0) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    
    // Corrected calculation for mouse position in zoomed canvas
    const mouseX = (e.clientX - rect.left) / scale;
    const mouseY = (e.clientY - rect.top) / scale;
    
    isDrawingRef.current = true;
    lastPosRef.current = { x: mouseX, y: mouseY };
    
    if (brushType === 'fill') {
      floodFill(mouseX, mouseY, selectedColor);
      saveToUndoStack();
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = brushType === 'eraser' ? '#FFFFFF' : selectedColor;
    ctx.lineWidth = brushType === 'highlighter' ? brushSize * 2 : brushSize;
    ctx.globalAlpha = brushType === 'highlighter' ? 0.4 : opacity / 100;
    
    ctx.moveTo(mouseX, mouseY);
    ctx.lineTo(mouseX, mouseY);
    ctx.stroke();
  };

  // Função de preenchimento (flood fill)
  const floodFill = (startX: number, startY: number, fillColor: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Garantir que as coordenadas são números inteiros
    startX = Math.floor(startX);
    startY = Math.floor(startY);
    
    // Converter a cor de preenchimento para RGBA
    const fillColorObj = hexToRgba(fillColor);
    const fillR = fillColorObj.r;
    const fillG = fillColorObj.g;
    const fillB = fillColorObj.b;
    const fillA = fillColorObj.a;
    
    // Obter os dados da imagem do canvas
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    // Cor do pixel de início
    const startPos = (startY * canvas.width + startX) * 4;
    const startR = pixels[startPos];
    const startG = pixels[startPos + 1];
    const startB = pixels[startPos + 2];
    const startA = pixels[startPos + 3];
    
    // Se a cor de preenchimento for igual à cor de início, não fazer nada
    if (
      fillR === startR &&
      fillG === startG &&
      fillB === startB &&
      fillA === startA
    ) {
      return;
    }
    
    // Função para verificar se a cor de um pixel é igual à cor de início
    const matchStartColor = (pixelPos: number) => {
      return (
        pixels[pixelPos] === startR &&
        pixels[pixelPos + 1] === startG &&
        pixels[pixelPos + 2] === startB &&
        pixels[pixelPos + 3] === startA
      );
    };
    
    // Função para colorir um pixel
    const colorPixel = (pixelPos: number) => {
      pixels[pixelPos] = fillR;
      pixels[pixelPos + 1] = fillG;
      pixels[pixelPos + 2] = fillB;
      pixels[pixelPos + 3] = fillA;
    };
    
    // Algoritmo de preenchimento por inundação (flood fill)
    const stack: number[] = [startPos];
    const visited = new Set<number>();
    
    while (stack.length) {
      const pixelPos = stack.pop() as number;
      
      if (visited.has(pixelPos)) continue;
      visited.add(pixelPos);
      
      if (!matchStartColor(pixelPos)) continue;
      
      colorPixel(pixelPos);
      
      const x = (pixelPos / 4) % canvas.width;
      const y = Math.floor((pixelPos / 4) / canvas.width);
      
      // Verificar os pixels vizinhos (norte, sul, leste, oeste)
      if (x > 0) stack.push(pixelPos - 4); // oeste
      if (x < canvas.width - 1) stack.push(pixelPos + 4); // leste
      if (y > 0) stack.push(pixelPos - canvas.width * 4); // norte
      if (y < canvas.height - 1) stack.push(pixelPos + canvas.width * 4); // sul
    }
    
    // Atualizar o canvas com os novos dados da imagem
    ctx.putImageData(imageData, 0, 0);
  };

  const hexToRgba = (hex: string, alpha = 1) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b, a: Math.round(alpha * 255) };
  };

  // Função para desenho de spray
  const drawSpray = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    // Salvar estado atual do contexto
    ctx.save();
    
    // Configurar a cor de preenchimento com base na cor selecionada
    ctx.fillStyle = brushType === 'eraser' ? '#FFFFFF' : selectedColor;
    
    // Densidade do spray
    const density = brushSize * 2;
    
    // Raio do spray
    const radius = brushSize * 2;
    
    for (let i = 0; i < density; i++) {
      const offsetX = (Math.random() - 0.5) * radius * 2;
      const offsetY = (Math.random() - 0.5) * radius * 2;
      
      // Verificar se o ponto está dentro do raio
      if (offsetX * offsetX + offsetY * offsetY < radius * radius) {
        const sprayX = x + offsetX;
        const sprayY = y + offsetY;
        
        // Variação do tamanho das partículas para efeito mais natural
        const particleSize = Math.random() * 1 + 0.5;
        
        ctx.beginPath();
        ctx.arc(sprayX, sprayY, particleSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Restaurar o estado anterior do contexto
    ctx.restore();
  };

  // Update the draw function with correct coordinates
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !isOwner) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    
    // Corrected calculation for mouse position in zoomed canvas
    const mouseX = (e.clientX - rect.left) / scale;
    const mouseY = (e.clientY - rect.top) / scale;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    if (brushType === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else if (brushType === 'highlighter') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.strokeStyle = selectedColor;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = selectedColor;
    }
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushType === 'highlighter' ? brushSize * 2 : brushSize;
    ctx.globalAlpha = brushType === 'highlighter' ? 0.4 : opacity / 100;
    
    // Função para desenhar no local do mouse
    const drawAtPosition = (x: number, y: number) => {
      if (brushType === 'spray') {
        drawSpray(ctx, x, y);
      } else {
        // Normal drawing (pencil, eraser, or highlighter)
        ctx.beginPath();
        ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    };
    
    // Desenhar na posição normal do mouse
    drawAtPosition(mouseX, mouseY);
    
    // Aplicar simetria com base no tipo selecionado
    if (symmetryType !== 'none') {
      // Salvar a última posição original
      const originalLastX = lastPosRef.current.x;
      const originalLastY = lastPosRef.current.y;
      
      // Simetria vertical (espelhar horizontalmente)
      if (symmetryType === 'vertical' || symmetryType === 'both') {
        const mirrorX = canvas.width - mouseX;
        const mirrorLastX = canvas.width - originalLastX;
        
        // Atualizar temporariamente a última posição
        lastPosRef.current.x = mirrorLastX;
        
        // Desenhar na posição espelhada horizontalmente
        drawAtPosition(mirrorX, mouseY);
        
        // Restaurar última posição
        lastPosRef.current.x = originalLastX;
      }
      
      // Simetria horizontal (espelhar verticalmente)
      if (symmetryType === 'horizontal' || symmetryType === 'both') {
        const mirrorY = canvas.height - mouseY;
        const mirrorLastY = canvas.height - originalLastY;
        
        // Atualizar temporariamente a última posição
        lastPosRef.current.y = mirrorLastY;
        
        // Desenhar na posição espelhada verticalmente
        drawAtPosition(mouseX, mirrorY);
        
        // Restaurar última posição
        lastPosRef.current.y = originalLastY;
      }
      
      // Simetria completa (espelhar diagonalmente) - apenas quando ambos estão ativos
      if (symmetryType === 'both') {
        const mirrorX = canvas.width - mouseX;
        const mirrorY = canvas.height - mouseY;
        const mirrorLastX = canvas.width - originalLastX;
        const mirrorLastY = canvas.height - originalLastY;
        
        // Atualizar temporariamente a última posição
        lastPosRef.current.x = mirrorLastX;
        lastPosRef.current.y = mirrorLastY;
        
        // Desenhar na posição espelhada diagonalmente
        drawAtPosition(mirrorX, mirrorY);
        
        // Restaurar última posição
        lastPosRef.current.x = originalLastX;
        lastPosRef.current.y = originalLastY;
      }
    }
    
    // Atualizar a última posição para a posição atual do mouse
    lastPosRef.current = { x: mouseX, y: mouseY };
  };

  // Function to stop drawing
  const stopDrawing = () => {
    if (!isDrawingRef.current) return;

    isDrawingRef.current = false;
    saveToUndoStack();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Salvar o estado atual antes de limpar
      saveToUndoStack();
      
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };
  
  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const imageData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imageData;
      link.download = 'canvas-drawing.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
  
  const importImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && canvasRef.current) {
      const reader = new FileReader();
      reader.onload = (event) => {
        // Criar uma imagem com tipo explicitamente
        const img: HTMLImageElement = document.createElement('img');
        img.onload = () => {
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              // Salvar o estado atual antes de importar
              saveToUndoStack();
              
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            }
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Função para comprimir a imagem antes de salvá-la
  const compressImageData = (canvas: HTMLCanvasElement, quality: number = 0.8): string => {
    // Criar um canvas temporário com fundo branco
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      // Preencher com fundo branco primeiro
      tempCtx.fillStyle = '#FFFFFF';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      
      // Desenhar o conteúdo do canvas original sobre o fundo branco
      tempCtx.drawImage(canvas, 0, 0);
      
      // Usar PNG para manter a qualidade e evitar artefatos de compressão
      return tempCanvas.toDataURL('image/png');
    }
    
    // Se algo der errado, volta para o canvas original com PNG
    return canvas.toDataURL('image/png');
  };

  // Substituir outras funções de manipulação de cor por versões usando tinycolor2
  const updateSelectedColor = (color: string) => {
    // Verificar se é uma cor válida usando tinycolor2
    const newColor = tinycolor(color);
    if (newColor.isValid()) {
      // Obter a cor em formato hexadecimal
      const hexColor = newColor.toHexString();
      setSelectedColor(hexColor);
      
      // Adicionar à lista de cores recentes
      if (!recentColors.includes(hexColor)) {
        setRecentColors(prev => [hexColor, ...prev.slice(0, 9)]);
      }
    }
  };
  
  // Função para ativar o eyedropper
  const activateEyeDropper = () => {
    setIsEyeDropperActive(true);
  };
  
  // Update pickColorFromCanvas with the new coordinates
  const pickColorFromCanvas = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    
    // Corrected calculation for mouse position in zoomed canvas
    const mouseX = (e.clientX - rect.left) / scale;
    const mouseY = (e.clientY - rect.top) / scale;
    
    // Make sure the coordinates are within the canvas
    if (mouseX >= 0 && mouseY >= 0 && mouseX < canvas.width && mouseY < canvas.height) {
      const pixelData = ctx.getImageData(mouseX, mouseY, 1, 1).data;
      const color = tinycolor({r: pixelData[0], g: pixelData[1], b: pixelData[2]});
      
      if (color.isValid()) {
        const hexColor = color.toHexString();
        updateSelectedColor(hexColor);
        setRecentColors(prevColors => {
          if (!prevColors.includes(hexColor)) {
            return [hexColor, ...prevColors.slice(0, 9)];
          }
          return prevColors;
        });
      }
    }
    
    setIsEyeDropperActive(false);
  };

  // Function to handle mouse wheel for zooming
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!containerRef.current) return;
    
    e.preventDefault();
    
    // Get the mouse position relative to the canvas
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Get the position of the point under mouse in the scaled canvas
    const pointXBeforeZoom = (mouseX - canvasPosition.x) / scale;
    const pointYBeforeZoom = (mouseY - canvasPosition.y) / scale;
    
    // Calculate new scale
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.25, Math.min(5, scale * zoomFactor));
    
    // Calculate new position to keep the point under mouse at the same position
    const newPosX = mouseX - pointXBeforeZoom * newScale;
    const newPosY = mouseY - pointYBeforeZoom * newScale;
    
    setScale(newScale);
    setCanvasPosition({ x: newPosX, y: newPosY });
  };

  // Function to start dragging the canvas
  const startDraggingCanvas = (e: React.MouseEvent<HTMLDivElement>) => {
    // Garantir que só arrastamos o canvas com o botão direito do mouse
    if (e.button !== 2) return;
    e.preventDefault();
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // Function to drag the canvas
  const dragCanvas = (e: React.MouseEvent<HTMLDivElement>) => {
    // Garantir que estamos arrastando apenas com o botão direito pressionado
    if (e.buttons !== 2) return;
    
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    setCanvasPosition(prev => ({
      x: prev.x + dx,
      y: prev.y + dy
    }));
    
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // Function to stop dragging the canvas
  const stopDraggingCanvas = () => {
    // Nothing needed here, we're using the buttons check in dragCanvas
  };

  const setSymmetryMode = (type: SymmetryType) => {
    setSymmetryType(type);
    drawSymmetryGuides();
  };

  // Função para limpar o estado ao fechar o canvas
  const handleClose = () => {
    // Reset all drawing states
    isDrawingRef.current = false;
    setIsEyeDropperActive(false);
    
    // Reset cursor style explicitly
    if (document.body) {
      document.body.style.cursor = 'default';
    }
    
    // Call the parent's onClose function
    onClose();
  };

  // Função para salvar e fechar
  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const compressedImageData = compressImageData(canvas);
      onSave(compressedImageData);
    }
    
    // Usar o handleClose para garantir que os estados sejam limpos
    handleClose();
  };

  // Função para cancelar sem salvar
  const handleCancel = () => {
    // Usar o handleClose para garantir que os estados sejam limpos
    handleClose();
  };

  if (!isOpen) return null;
  
  return (
    <div
      className={`fixed inset-0 flex items-center justify-center z-50 ${isOpen ? 'visible' : 'invisible'}`}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full h-[90vh] overflow-hidden flex flex-col">
        <div className="p-2 border-b flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">Drawing Canvas</h2>
          <button
            onClick={handleCancel}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex flex-1 overflow-hidden">
          <div className="w-80 p-4 border-r overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Drawing Tools
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  title="Pencil: Precise drawing with full opacity"
                  onClick={() => setBrushType('pencil')}
                  className={`p-2 rounded flex flex-col items-center justify-center ${brushType === 'pencil' ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  <Edit3 size={20} />
                  <span className="text-xs mt-1">Pencil</span>
                </button>
                <button
                  title="Highlighter: Semi-transparent marker effect"
                  onClick={() => setBrushType('highlighter')}
                  className={`p-2 rounded flex flex-col items-center justify-center ${brushType === 'highlighter' ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  <Zap size={20} />
                  <span className="text-xs mt-1">Marker</span>
                </button>
                <button
                  title="Eraser: Remove parts of drawing"
                  onClick={() => setBrushType('eraser')}
                  className={`p-2 rounded flex flex-col items-center justify-center ${brushType === 'eraser' ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  <Eraser size={20} />
                  <span className="text-xs mt-1">Eraser</span>
                </button>
                <button
                  title="Fill: Fill an area with color"
                  onClick={() => setBrushType('fill')}
                  className={`p-2 rounded flex flex-col items-center justify-center ${brushType === 'fill' ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  <Droplet size={20} />
                  <span className="text-xs mt-1">Fill</span>
                </button>
                <button
                  title="Spray: Create spray paint effect"
                  onClick={() => setBrushType('spray')}
                  className={`p-2 rounded flex flex-col items-center justify-center ${brushType === 'spray' ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  <Command size={20} />
                  <span className="text-xs mt-1">Spray</span>
                </button>
              </div>
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Brush Size: {brushSize}px
              </label>
              <input
                type="range"
                min="1"
                max="50"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="w-full h-2"
              />
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Opacity: {opacity}%
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={opacity}
                onChange={(e) => setOpacity(parseInt(e.target.value))}
                className="w-full h-2"
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color
              </label>
              <div className="flex items-center space-x-2 mb-3">
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => updateSelectedColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={selectedColor}
                  onChange={(e) => {
                    const color = tinycolor(e.target.value);
                    if (color.isValid()) {
                      updateSelectedColor(color.toHexString());
                    }
                  }}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                />
                <button
                  onClick={activateEyeDropper}
                  className={`p-2 rounded ${isEyeDropperActive ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 hover:bg-gray-200'}`}
                  title="Pick color from canvas"
                >
                  <Droplet size={18} />
                </button>
              </div>
              
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="flex flex-col">
                  <label className="text-xs text-gray-600 mb-1">R</label>
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={tinycolor(selectedColor).toRgb().r}
                    onChange={(e) => {
                      const color = tinycolor(selectedColor).toRgb();
                      color.r = parseInt(e.target.value);
                      updateSelectedColor(tinycolor(color).toHexString());
                    }}
                    className="w-full h-2"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-gray-600 mb-1">G</label>
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={tinycolor(selectedColor).toRgb().g}
                    onChange={(e) => {
                      const color = tinycolor(selectedColor).toRgb();
                      color.g = parseInt(e.target.value);
                      updateSelectedColor(tinycolor(color).toHexString());
                    }}
                    className="w-full h-2"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-gray-600 mb-1">B</label>
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={tinycolor(selectedColor).toRgb().b}
                    onChange={(e) => {
                      const color = tinycolor(selectedColor).toRgb();
                      color.b = parseInt(e.target.value);
                      updateSelectedColor(tinycolor(color).toHexString());
                    }}
                    className="w-full h-2"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs text-gray-600 mb-1">Colors</label>
                <div className="grid grid-cols-8 gap-1">
                  {['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF',
                   '#C0C0C0', '#808080', '#800000', '#808000', '#008000', '#800080', '#008080', '#000080'].map((color) => (
                    <div
                      key={color}
                      className="w-7 h-7 cursor-pointer border border-gray-300"
                      style={{ backgroundColor: color }}
                      onClick={() => updateSelectedColor(color)}
                      title={color}
                    />
                  ))}
                </div>
              </div>
              
              {recentColors.length > 0 && (
                <div className="mt-2">
                  <label className="block text-xs text-gray-600 mb-1">Recent</label>
                  <div className="grid grid-cols-8 gap-1">
                    {recentColors.map((color) => (
                      <div
                        key={color}
                        className="w-7 h-7 cursor-pointer border border-gray-300"
                        style={{ backgroundColor: color }}
                        onClick={() => updateSelectedColor(color)}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Zoom: {Math.round(scale * 100)}%
              </label>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setScale(prev => Math.max(0.25, prev - 0.25))}
                  className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 text-sm"
                  title="Zoom Out"
                >
                  -
                </button>
                <input
                  type="range"
                  min="0.25"
                  max="5"
                  step="0.25"
                  value={scale}
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  className="flex-1 h-2"
                />
                <button
                  onClick={() => setScale(prev => Math.min(5, prev + 0.25))}
                  className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 text-sm"
                  title="Zoom In"
                >
                  +
                </button>
                <button
                  onClick={() => {
                    setScale(1);
                    setCanvasPosition({ x: 0, y: 0 });
                  }}
                  className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm"
                  title="Reset Zoom"
                >
                  Reset
                </button>
              </div>
            </div>
            
            <div className="flex space-x-2 mt-5 mb-4">
              <button
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className={`p-2 rounded flex items-center text-sm ${undoStack.length === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                title="Undo"
              >
                <RotateCcw size={16} className="mr-1" />
                <span>Undo</span>
              </button>
              <button
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className={`p-2 rounded flex items-center text-sm ${redoStack.length === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                title="Redo"
              >
                <RotateCw size={16} className="mr-1" />
                <span>Redo</span>
              </button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={clearCanvas}
                className="p-2 rounded flex items-center bg-red-50 text-red-600 hover:bg-red-100 text-sm"
                title="Clear canvas"
              >
                <Trash2 size={16} className="mr-1" />
                <span>Clear</span>
              </button>
              
              <label 
                className="p-2 rounded flex items-center bg-purple-50 text-purple-600 hover:bg-purple-100 cursor-pointer text-sm"
                title="Import image"
              >
                <Upload size={16} className="mr-1" />
                <span>Import</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={importImage}
                />
              </label>
              
              <button
                onClick={downloadCanvas}
                className="p-2 rounded flex items-center bg-teal-50 text-teal-600 hover:bg-teal-100 text-sm"
                title="Download image"
              >
                <Download size={16} className="mr-1" />
                <span>Download</span>
              </button>
            </div>

            <div className="flex-wrap gap-2" style={{ marginTop: '20px' }}>
              <div className="font-medium text-gray-700 mb-2">Tool Tips:</div>
              <ul className="text-sm text-gray-600 space-y-1 list-disc pl-5">
                <li>Use the scroll wheel to zoom in/out at cursor position</li>
                <li>Right-click and drag to move around when zoomed in</li>
                <li>Pencil: Draw precisely with full opacity</li>
                <li>Marker: Semi-transparent highlighter effect</li>
                <li>Eraser: Remove parts of your drawing</li>
                <li>Fill: Click to fill an area with the selected color</li>
                <li>Spray: Create spray paint effect with particles</li>
                <li>Eyedropper: Pick colors from your drawing</li>
                <li>Mirror: Creates symmetrical drawings automatically</li>
                <li>Grid: Helps with alignment and proportions</li>
              </ul>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <div className="flex items-center">
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    className="mr-2 h-4 w-4"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                  />
                  Show Grid
                </label>
              </div>
              
              <div className="flex items-center ml-4">
                <label className="text-sm mr-2">Grid Size:</label>
                <select 
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                  value={gridSize}
                  onChange={(e) => setGridSize(parseInt(e.target.value))}
                >
                  <option value="10">10px</option>
                  <option value="20">20px</option>
                  <option value="50">50px</option>
                </select>
              </div>
              
              <div className="flex items-center ml-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Desenho Espelhado (Mirror)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSymmetryMode(symmetryType === 'none' ? 'vertical' : 'none')}
                    className={`px-2 py-2 rounded text-sm ${symmetryType === 'vertical' || symmetryType === 'both' ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300' : 'bg-gray-100 text-gray-700'}`}
                    title="Espelho Vertical (esquerda/direita)"
                  >
                    <div className="flex flex-col items-center">
                      <Layers size={16} className="mb-1" />
                      <span>Vertical</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setSymmetryMode(symmetryType === 'none' ? 'horizontal' : 'none')}
                    className={`px-2 py-2 rounded text-sm ${symmetryType === 'horizontal' || symmetryType === 'both' ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300' : 'bg-gray-100 text-gray-700'}`}
                    title="Espelho Horizontal (cima/baixo)"
                  >
                    <div className="flex flex-col items-center">
                      <Layers size={16} className="mb-1 transform rotate-90" />
                      <span>Horizontal</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setSymmetryMode(symmetryType === 'none' ? 'both' : 'none')}
                    className={`px-2 py-2 rounded text-sm ${symmetryType === 'both' ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300' : 'bg-gray-100 text-gray-700'}`}
                    title="Simetria Total (quatro quadrantes)"
                    style={{gridColumn: 'span 2'}}
                  >
                    <div className="flex flex-col items-center">
                      <Command size={16} className="mb-1" />
                      <span>Simetria Total</span>
                    </div>
                  </button>
                </div>
                
                {/* Adicionar uma pequena explicação */}
                {symmetryType !== 'none' && (
                  <div className="text-xs mt-2 text-gray-600 bg-blue-50 p-2 rounded">
                    <p className="mb-1"><strong>Desenho Espelhado Ativo</strong></p>
                    <p>Seu desenho será espelhado automaticamente conforme você pinta.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex-1 bg-gray-50 p-2 relative">
            <div 
              ref={containerRef}
              className="relative w-full h-full overflow-hidden" 
              onMouseDown={startDraggingCanvas}
              onMouseMove={dragCanvas}
              onMouseUp={stopDraggingCanvas}
              onMouseLeave={stopDraggingCanvas}
              onContextMenu={(e) => e.preventDefault()}
            >
              <div 
                style={{
                  width: canvasSize.width * scale,
                  height: canvasSize.height * scale,
                  transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px)`,
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  marginLeft: -(canvasSize.width * scale) / 2,
                  marginTop: -(canvasSize.height * scale) / 2,
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={canvasSize.width}
                  height={canvasSize.height}
                  style={{
                    width: canvasSize.width * scale,
                    height: canvasSize.height * scale,
                    touchAction: 'none',
                    display: 'block',
                    boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)',
                  }}
                  onMouseDown={isEyeDropperActive ? pickColorFromCanvas : startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onWheel={handleWheel}
                />
                
                {/* Canvas de preview para linhas guia */}
                <canvas
                  ref={previewCanvasRef}
                  width={canvasSize.width}
                  height={canvasSize.height}
                  style={{
                    width: canvasSize.width * scale,
                    height: canvasSize.height * scale,
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    pointerEvents: 'none',
                  }}
                />
                
                {/* Grade de apoio */}
                {showGrid && (
                  <div
                    style={{
                      width: canvasSize.width * scale,
                      height: canvasSize.height * scale,
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      pointerEvents: 'none',
                      backgroundImage: `
                        linear-gradient(to right, rgba(200, 200, 200, 0.1) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(200, 200, 200, 0.1) 1px, transparent 1px)
                      `,
                      backgroundSize: `${gridSize * scale}px ${gridSize * scale}px`,
                    }}
                  />
                )}
              </div>
            </div>
            
            {/* Controles flutuantes para melhor usabilidade */}
            <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md p-2 flex space-x-2">
              <button
                onClick={handleUndo}
                disabled={undoStack.length <= 1}
                className={`p-2 rounded ${undoStack.length <= 1 ? 'text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                title="Desfazer"
              >
                <RotateCcw size={20} />
              </button>
              <button
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className={`p-2 rounded ${redoStack.length === 0 ? 'text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                title="Refazer"
              >
                <RotateCw size={20} />
              </button>
              <div className="w-px h-6 bg-gray-300 mx-1"></div>
              <button
                onClick={() => {
                  setScale(1);
                  setCanvasPosition({ x: 0, y: 0 });
                }}
                className="p-2 rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                title="Resetar Zoom"
              >
                <Zap size={20} />
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t flex justify-between">
          <button
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center"
          >
            <Save size={18} className="mr-1" />
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

export default DrawingCanvas;