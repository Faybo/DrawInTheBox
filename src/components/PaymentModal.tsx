import React from 'react';
import { X } from 'lucide-react';
import { User } from '../types';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  amount: number;
  squareCount: number;
  cart: number[];
  user: User | null;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  amount,
  squareCount,
  cart,
  user
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Purchase Square</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-t border-b py-4 my-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-700">Square ID{squareCount > 1 ? 's' : ''}:</span>
            <span className="text-gray-900 font-medium">
              {cart.map(id => `#${id}`).join(', ')}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Price:</span>
            <span className="text-lg text-indigo-600 font-bold">${amount}</span>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="border rounded-lg p-4 bg-indigo-50">
            <p className="text-sm text-indigo-800">
              By purchasing this square, you'll own a piece of The Million Dollar Painting. 
              You can customize it with your own design.
              <br /><br />
              <strong>Note:</strong> Others can purchase your square for double the price 
              you paid. If that happens, you'll receive your money back plus a profit.
            </p>
          </div>

          <button
            onClick={onSuccess}
            className="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
          >
            Proceed to Payment
          </button>
        </div>

        <div className="mt-4 text-xs text-center text-gray-500">
          This is a demonstration. No real payment will be processed.
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
