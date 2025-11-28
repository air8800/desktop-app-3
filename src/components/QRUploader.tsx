import React, { useState, useEffect } from 'react';
import { Upload, QrCode, Image, AlertCircle, Plus, Smartphone, CreditCard } from 'lucide-react';

const QRUploader: React.FC = () => {
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Load QR image from electron store on component mount
    const loadQRImage = async () => {
      try {
        if (window.electron) {
          const result = await window.electron.getQRImage();
          if (result.success && result.data) {
            setQrImage(result.data);
          }
        }
      } catch (error) {
        console.error('Error loading QR image:', error);
      }
    };

    loadQRImage();
  }, []);

  const handleUpload = async () => {
    setIsUploading(true);
    setErrorMessage(null);
    
    try {
      if (window.electron) {
        const result = await window.electron.uploadQRImage();
        if (result.success) {
          setQrImage(result.path);
        } else {
          setErrorMessage(result.error || 'Failed to upload QR image');
        }
      } else {
        setErrorMessage('Electron API not available');
      }
    } catch (error) {
      console.error('Error uploading QR image:', error);
      setErrorMessage('An unexpected error occurred');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="card p-8 shadow-large">
      <div className="flex items-center mb-8">
        <div className="w-16 h-16 bg-gradient-secondary rounded-2xl flex items-center justify-center shadow-large mr-6">
          <QrCode className="h-8 w-8 text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Payment QR Code</h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg">Upload your UPI payment QR code for customers</p>
        </div>
      </div>

      {qrImage ? (
        <div className="flex flex-col items-center mb-8">
          <div className="bg-white p-8 rounded-3xl shadow-2xl mb-8 border-4 border-gray-100 dark:border-gray-600 max-w-sm">
            <img 
              src={qrImage} 
              alt="Payment QR Code" 
              className="w-full h-auto max-w-80 max-h-80 object-contain rounded-2xl"
            />
          </div>
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className={`btn-primary shadow-large hover:shadow-xl ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Upload className="h-5 w-5 mr-3" />
            {isUploading ? 'Uploading...' : 'Change QR Code'}
          </button>
        </div>
      ) : (
        <div className="mb-8">
          <div 
            className="flex flex-col items-center p-16 border-3 border-dashed border-gray-300 dark:border-gray-600 rounded-3xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-all duration-300 hover:border-purple-400 dark:hover:border-purple-500 group bg-gradient-to-br from-gray-50/50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-700/50" 
            onClick={handleUpload}
          >
            {/* FIXED: Removed demo QR, added proper icon */}
            <div className="w-32 h-32 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/50 dark:to-pink-900/50 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300 shadow-large">
              <div className="relative">
                <QrCode className="h-16 w-16 text-purple-500 dark:text-purple-400 group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors" />
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center shadow-lg">
                  <Plus className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-700 dark:text-gray-300 mb-4 text-center">No payment QR code uploaded</h3>
            <p className="text-lg text-gray-500 dark:text-gray-500 mb-8 text-center max-w-lg leading-relaxed">
              Upload your UPI payment QR code (GPay, PhonePe, Paytm, etc.) that customers will use for payments
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUpload();
              }}
              disabled={isUploading}
              className={`btn-primary shadow-large hover:shadow-xl ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Upload className="h-6 w-6 mr-3" />
              {isUploading ? 'Uploading...' : 'Upload Payment QR Code'}
            </button>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="alert-error mb-8 shadow-large">
          <AlertCircle className="h-6 w-6 mr-3" />
          <span className="text-lg">{errorMessage}</span>
        </div>
      )}

      {/* Enhanced Instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="alert-info shadow-large">
          <div className="flex items-start">
            <QrCode className="h-6 w-6 mr-4 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-lg mb-4">Payment QR Code Instructions</h3>
              <ul className="text-base space-y-2">
                <li>• Upload your UPI payment QR code (GPay, PhonePe, Paytm, etc.)</li>
                <li>• Customers will see this QR code after placing orders</li>
                <li>• Make sure the QR code is clear and scannable</li>
                <li>• Supported formats: JPG, PNG, JPEG</li>
                <li>• Recommended size: 300x300px or larger</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-green-200 dark:border-green-800">
          <div className="flex items-start">
            <Smartphone className="h-6 w-6 mr-4 mt-1 flex-shrink-0 text-green-600 dark:text-green-400" />
            <div>
              <h3 className="font-bold text-lg mb-4 text-green-800 dark:text-green-300">How Payment Works</h3>
              <div className="space-y-3 text-sm text-green-700 dark:text-green-400">
                <div className="flex items-center">
                  <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3">1</div>
                  <span>Customer places order through web app</span>
                </div>
                <div className="flex items-center">
                  <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3">2</div>
                  <span>They see your payment QR code with order total</span>
                </div>
                <div className="flex items-center">
                  <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3">3</div>
                  <span>Customer scans QR and makes payment</span>
                </div>
                <div className="flex items-center">
                  <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3">4</div>
                  <span>Order appears in your desktop app</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRUploader;