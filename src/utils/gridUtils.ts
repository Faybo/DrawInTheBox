import { Square } from '../types';

// Grid size constants - grid cobrindo a tela inteira
export const GRID_SIZE = 120; // Mantido em 120x120
export const SQUARE_SIZE = 14; // Aumentado de 12 para 14 para melhor visualização
export const SQUARE_MIN_SIZE = 14; // Aumentado de 12 para 14 para evitar quadrados muito pequenos
export const SQUARE_MAX_SIZE = 24; // Aumentado para permitir quadrados maiores

// Canvas size for drawing
export const CANVAS_WIDTH = 1500;
export const CANVAS_HEIGHT = 1500;

// Preço inicial de um quadrado
export const INITIAL_SQUARE_PRICE = 1; // 1 dollar as initial price

// Interface para posição do quadrado
export interface SquarePosition {
  x: number;
  y: number;
}

// Calcular posição do quadrado a partir do ID
export const calculateSquarePosition = (id: number): SquarePosition => {
  return {
    x: id % GRID_SIZE,
    y: Math.floor(id / GRID_SIZE)
  };
};

// Calcular ID do quadrado a partir da posição
export const calculateSquareId = (x: number, y: number): number => {
  return y * GRID_SIZE + x;
};

// Função para calcular o tamanho recomendado do canvas para desenho
export function getCanvasSize(): { width: number; height: number } {
  // Tamanho fixo para o canvas de desenho, independente do tamanho da tela
  return {
    width: 500,
    height: 500
  };
}

// Função para calcular o tamanho do grid baseado no tamanho da janela
export function calculateGridSize(windowWidth: number, windowHeight: number) {
  // Reduzi a margem para usar mais espaço da tela
  const headerHeight = 60; // altura aproximada do cabeçalho
  const availableHeight = windowHeight - headerHeight - 20; // margem reduzida
  const availableWidth = windowWidth - 20; // margem reduzida
  
  // Calcular quantos quadrados cabem na largura e altura disponíveis
  const maxVisibleCols = Math.floor(availableWidth / SQUARE_MIN_SIZE);
  const maxVisibleRows = Math.floor(availableHeight / SQUARE_MIN_SIZE);
  
  // Usar um tamanho de quadrado que aproveite melhor o espaço disponível
  let squareSize = Math.max(
    SQUARE_MIN_SIZE,
    Math.min(
      Math.floor(availableWidth / Math.min(maxVisibleCols, GRID_SIZE)), 
      Math.floor(availableHeight / Math.min(maxVisibleRows, GRID_SIZE)),
      SQUARE_MAX_SIZE
    )
  );
  
  // Calcular quantos quadrados serão efetivamente mostrados
  const visibleCols = Math.min(Math.floor(availableWidth / squareSize), GRID_SIZE);
  const visibleRows = Math.min(Math.floor(availableHeight / squareSize), GRID_SIZE);
  
  // Calcular dimensões do grid
  const width = visibleCols * squareSize;
  const height = visibleRows * squareSize;
  
  return {
    width,
    height,
    squareSize,
    visibleCols,
    visibleRows
  };
}

// Função para inicializar o grid com quadrados vazios
export function initializeGrid() {
  const squares = [];
  
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    squares.push({
      id: i,
      owner: null,
      price: 1, // Initial price
      color: "#ffffff", // default color for new squares
      imageData: null,
      priceHistory: []
    });
  }
  
  return squares;
}

// Função para verificar se um ID está dentro do grid
export function isValidSquareId(id: number): boolean {
  return id >= 0 && id < GRID_SIZE * GRID_SIZE;
}

// Função para verificar se duas posições são vizinhas
export function areNeighbors(pos1: SquarePosition, pos2: SquarePosition): boolean {
  const rowDiff = Math.abs(pos1.y - pos2.y);
  const colDiff = Math.abs(pos1.x - pos2.x);
  
  // Two positions are neighbors if they are one cell apart
  return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
}

// Função para calcular quantos quadrados visíveis cabem na tela atual
export function calculateVisibleGrid(windowWidth: number, windowHeight: number) {
  const { squareSize } = calculateGridSize(windowWidth, windowHeight);
  
  // Adjust for available space
  const headerHeight = 52;
  const availableWidth = windowWidth - 10; 
  const availableHeight = windowHeight - headerHeight - 10;
  
  // Calculate how many squares fit on screen
  const visibleCols = Math.floor(availableWidth / squareSize);
  const visibleRows = Math.floor(availableHeight / squareSize);
  
  // Make sure we never show more squares than exist
  const effectiveCols = Math.min(visibleCols, GRID_SIZE);
  const effectiveRows = Math.min(visibleRows, GRID_SIZE);
  
  return {
    visibleCols: effectiveCols,
    visibleRows: effectiveRows,
    width: effectiveCols * squareSize,
    height: effectiveRows * squareSize,
    squareSize
  };
}

// Calcula as dimensões ideais do grid com base no tamanho da tela
export const calculateGridDimensions = (windowWidth: number, windowHeight: number): {
  gridSize: number;
  squareSize: number;
} => {
  // A altura disponível excluindo o cabeçalho
  const headerHeight = 40;
  const availableHeight = windowHeight - headerHeight;
  
  // Determinar o número desejado de quadrados (entre 50 e 200 em cada dimensão)
  const MIN_GRID_SIZE = 50;
  const MAX_GRID_SIZE = 200;
  const MIN_SQUARE_SIZE = 6; // Aumentado de 4 para 6
  
  // Determinar quantos quadrados cabem horizontal e verticalmente
  const maxHorizontalSquares = Math.floor(windowWidth / MIN_SQUARE_SIZE);
  const maxVerticalSquares = Math.floor(availableHeight / MIN_SQUARE_SIZE);
  
  // Usar o menor valor para manter o grid quadrado
  let desiredGridSize = Math.min(maxHorizontalSquares, maxVerticalSquares);
  
  // Limitar entre MIN_GRID_SIZE e MAX_GRID_SIZE
  desiredGridSize = Math.max(MIN_GRID_SIZE, Math.min(desiredGridSize, MAX_GRID_SIZE));
  
  // Calcular o tamanho de cada quadrado para caber na tela
  const squareSize = Math.min(
    Math.floor(windowWidth / desiredGridSize),
    Math.floor(availableHeight / desiredGridSize)
  );
  
  return {
    gridSize: desiredGridSize,
    squareSize: squareSize
  };
};

// Calcula o tamanho do grid para preencher toda a tela
export const calculateGridSizeForFullScreen = (windowWidth: number, windowHeight: number): {
  width: number;
  height: number;
  squareSize: number;
} => {
  // Usar todo o espaço disponível da tela
  // Subtrair 52px para a altura do header
  const availableWidth = windowWidth;
  const availableHeight = windowHeight - 52;
  
  // Determinar o tamanho do quadrado para ocupar todo o espaço
  const squareSizeWidth = Math.max(Math.floor(availableWidth / GRID_SIZE), 1);
  const squareSizeHeight = Math.max(Math.floor(availableHeight / GRID_SIZE), 1);
  
  // Escolher o maior tamanho possível que ainda caiba na tela
  const squareSize = Math.max(squareSizeWidth, squareSizeHeight);
  
  // O grid pode ser maior que a tela em uma dimensão, permitindo rolagem
  const totalWidth = GRID_SIZE * squareSize;
  const totalHeight = GRID_SIZE * squareSize;

  return {
    width: totalWidth,
    height: totalHeight,
    squareSize: squareSize
  };
};

// Verificar se uma posição é válida dentro do grid
export const isValidSquarePosition = (x: number, y: number): boolean => {
  return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
};

// Obter quadrados vizinhos a partir de um ID
export const getNeighborSquareIds = (id: number): number[] => {
  const { x, y } = calculateSquarePosition(id);
  const neighbors: number[] = [];
  
  const directions = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],           [1, 0],
    [-1, 1],  [0, 1],  [1, 1]
  ];
  
  for (const [dx, dy] of directions) {
    const nx = x + dx;
    const ny = y + dy;
    if (isValidSquarePosition(nx, ny)) {
      neighbors.push(calculateSquareId(nx, ny));
    }
  }
  
  return neighbors;
};

// Calcular quais quadrados estão visíveis na janela atual
export const calculateVisibleSquares = (scrollLeft: number, scrollTop: number, width: number, height: number, squareSize: number) => {
  // Calcular índices dos quadrados visíveis
  const startCol = Math.floor(scrollLeft / squareSize);
  const endCol = Math.min(Math.ceil((scrollLeft + width) / squareSize), GRID_SIZE);
  const startRow = Math.floor(scrollTop / squareSize);
  const endRow = Math.min(Math.ceil((scrollTop + height) / squareSize), GRID_SIZE);
  
  // Obter IDs dos quadrados visíveis
  const visibleSquareIds: number[] = [];
  for (let row = startRow; row < endRow; row++) {
    for (let col = startCol; col < endCol; col++) {
      visibleSquareIds.push(calculateSquareId(col, row));
    }
  }
  
  return {
    startCol,
    endCol,
    startRow,
    endRow,
    visibleSquareIds
  };
};