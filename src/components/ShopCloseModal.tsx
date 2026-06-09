import React from 'react';
import ConfirmationModal from './ConfirmationModal';

interface ShopCloseModalProps {
  isOpen: boolean;
  onStayOpen: () => void;
  onConfirmClose: () => void;
  isProcessing?: boolean;
}

const ShopCloseModal: React.FC<ShopCloseModalProps> = ({
  isOpen,
  onStayOpen,
  onConfirmClose,
  isProcessing = false,
}) => (
  <ConfirmationModal
    isOpen={isOpen}
    onClose={onStayOpen}
    onConfirm={onConfirmClose}
    title="Closing will take your shop offline"
    message="While PrintGet is open, customers can find your shop and place orders on the website.

If you close the app, your shop will show as Closed online until you open PrintGet again.

You can change your usual hours anytime in Settings — but the app must be running for customers to order right now."
    cancelText="Stay open"
    confirmText="Close app & go offline"
    type="warning"
    isProcessing={isProcessing}
  />
);

export default ShopCloseModal;
