/**
 * Serviço de integração com Stripe
 * Este arquivo gerencia a comunicação com o Stripe para processamentos de pagamento
 */

import { PaymentInfo, CheckoutSessionResponse, PaymentStatusResponse, Transaction, StripeAccountDetails } from './stripeService.d';

// Constantes para a integração com Stripe
const STRIPE_API_VERSION = '2022-11-15';
const STRIPE_PUBLIC_KEY = process.env.REACT_APP_STRIPE_PUBLIC_KEY || 'pk_test_sua_chave_publica';

/**
 * Inicializa uma sessão de checkout do Stripe
 * @param {Object} paymentInfo - Informações de pagamento
 * @param {number} paymentInfo.squareId - ID do quadrado sendo comprado
 * @param {number} paymentInfo.price - Preço do quadrado (já considerando se é dobrado)
 * @param {string} paymentInfo.userId - ID do usuário comprador
 * @param {string|null} paymentInfo.previousOwnerId - ID do proprietário anterior (se houver)
 * @returns {Promise<{sessionId: string}>} - ID da sessão do Stripe para redirecionamento
 */
export const createCheckoutSession = async (paymentInfo: PaymentInfo): Promise<CheckoutSessionResponse> => {
  try {
    // Adicionar o isOwned explicitamente se não foi fornecido
    const isOwned = paymentInfo.isOwned !== undefined 
      ? paymentInfo.isOwned 
      : !!paymentInfo.previousOwnerId;

    // Em ambiente de produção, você faria uma chamada ao seu backend
    // que então criaria a sessão no Stripe de forma segura
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        squareId: paymentInfo.squareId,
        price: paymentInfo.price,
        userId: paymentInfo.userId,
        previousOwnerId: paymentInfo.previousOwnerId,
        isOwned
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Erro ao criar sessão de checkout');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro no serviço do Stripe:', error);
    throw error;
  }
};

/**
 * Verifica o status de um pagamento
 * @param {string} sessionId - ID da sessão do Stripe
 * @returns {Promise<{status: string}>} - Status do pagamento
 */
export const checkPaymentStatus = async (sessionId: string): Promise<PaymentStatusResponse> => {
  try {
    const response = await fetch(`/api/check-payment-status?session_id=${sessionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Erro ao verificar status do pagamento');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao verificar status do pagamento:', error);
    throw error;
  }
};

/**
 * Registra que um pagamento foi concluído
 * @param {Object} paymentData - Dados do pagamento concluído
 * @returns {Promise<void>}
 */
export const recordSuccessfulPayment = async (paymentData: any): Promise<void> => {
  try {
    const response = await fetch('/api/record-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Erro ao registrar pagamento');
    }
  } catch (error) {
    console.error('Erro ao registrar pagamento concluído:', error);
    // Não lançamos o erro aqui porque isso é apenas um registro, não um bloqueador
  }
};

/**
 * Carrega os detalhes da conta do Stripe
 * Útil para o dashboard do vendedor ou administrador
 * @returns {Promise<Object>} - Detalhes da conta Stripe
 */
export const loadStripeAccountDetails = async (): Promise<StripeAccountDetails> => {
  try {
    const response = await fetch('/api/stripe-account-details', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Erro ao carregar detalhes da conta Stripe');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao carregar detalhes da conta Stripe:', error);
    throw error;
  }
};

/**
 * Recupera o histórico de transações de um usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<Array>} - Lista de transações
 */
export const getUserTransactions = async (userId: string): Promise<Transaction[]> => {
  try {
    const response = await fetch(`/api/user-transactions?user_id=${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Erro ao recuperar transações do usuário');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao recuperar transações:', error);
    throw error;
  }
};

// Exportação padrão para facilitar importação
const stripeService = {
  createCheckoutSession,
  checkPaymentStatus,
  recordSuccessfulPayment,
  loadStripeAccountDetails,
  getUserTransactions
};

export default stripeService; 