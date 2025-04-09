// Tipo para representar um quadrado no grid
export interface Square {
  id: number;
  owner: string | null;
  price: number;
  color: string | null;
  imageData: string | null;
  priceHistory: PriceHistoryEntry[];
}

// Interface para representar o histórico de preços de um quadrado
export interface PriceHistoryEntry {
  owner: string;
  price: number;
  timestamp: number;
}

// Interface para representar um usuário
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

// Interface para representar as configurações do app
export interface AppSettings {
  showGrid: boolean;
  showOwnerInfo: boolean;
  defaultZoom: number;
}

// Interface para informações de pagamento
export interface PaymentInfo {
  amount: number;
  currency: string;
  squareIds: number[];
  timestamp: number;
  status: 'pending' | 'completed' | 'failed';
}

// Interface para estatísticas do grid
export interface GridStats {
  total: number;
  purchased: number;
  available: number;
  percentagePurchased: number;
}

// Interface para dimensões do grid
export interface GridDimensions {
  width: number;
  height: number;
  squareSize: number;
  visibleCols?: number;
  visibleRows?: number;
}