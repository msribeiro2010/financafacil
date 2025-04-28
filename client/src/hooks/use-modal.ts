import { create } from 'zustand';

type ModalType = 'expense' | 'income' | 'accountSettings' | null;

interface ModalStore {
  type: ModalType;
  data: any;
  isOpen: boolean;
  onOpen: (type: ModalType, data?: any) => void;
  onClose: () => void;
}

export const useModalStore = create<ModalStore>((set) => ({
  type: null,
  data: null,
  isOpen: false,
  onOpen: (type, data = {}) => set({ isOpen: true, type, data }),
  onClose: () => set({ isOpen: false, type: null }),
}));

export const useModal = () => {
  const store = useModalStore();
  
  return {
    type: store.type,
    data: store.data,
    isOpen: store.isOpen,
    openModal: store.onOpen,
    closeModal: store.onClose,
  };
};
