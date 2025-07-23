import React from 'react';
import toast from 'react-hot-toast';

interface OrderNotification {
  marketplace: string;
  order: {
    orderId: string;
    total: number;
    items: number;
    product: string;
  };
}

export const showOrderNotification = (notification: OrderNotification) => {
  const marketplaceLogo = notification.marketplace === 'amazon' ? '🟠' : '💛';
  const marketplaceName = notification.marketplace === 'amazon' ? 'Amazon' : 'Mercado Livre';
  
  toast.custom((t) => (
    <div
      className={`${
        t.visible ? 'animate-enter' : 'animate-leave'
      } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
    >
      <div className="flex-1 w-0 p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0 pt-0.5">
            <div className="h-10 w-10 rounded-full bg-primary-orange flex items-center justify-center text-white animate-pulse">
              🔔
            </div>
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-medium text-gray-900">
              Novo Pedido! {marketplaceLogo} {marketplaceName}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {notification.order.product}
            </p>
            <div className="mt-2 flex space-x-4 text-sm">
              <span className="font-medium text-primary-orange">
                R$ {notification.order.total.toFixed(2)}
              </span>
              <span className="text-gray-500">
                {notification.order.items} {notification.order.items > 1 ? 'itens' : 'item'}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              #{notification.order.orderId}
            </p>
          </div>
        </div>
      </div>
      <div className="flex border-l border-gray-200">
        <button
          onClick={() => toast.dismiss(t.id)}
          className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-primary-orange hover:text-orange-600 focus:outline-none"
        >
          Fechar
        </button>
      </div>
    </div>
  ), {
    duration: 6000,
    position: 'top-right',
  });

  // Tocar som de notificação
  playNotificationSound();
};

const playNotificationSound = () => {
  // Criar um som de notificação usando Web Audio API
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = 800;
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);
};