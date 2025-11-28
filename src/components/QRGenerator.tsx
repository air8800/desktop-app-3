import React, { useState, useEffect } from 'react';
import { QrCode, Download, Eye, AlertTriangle, CheckCircle, MapPin, Phone, Clock, ExternalLink, Copy, Check, Printer, RefreshCw, Edit3, Save, X, Palette, Type, Languages, Sparkles, FileText, Globe } from 'lucide-react';
import QRCodeLib from 'qrcode';

interface ShopInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  googleMapsLink: string;
}

interface ShopTiming {
  day: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

interface PrintInstructions {
  language: string;
  title: string;
  subtitle: string;
  steps: string[];
  footer: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor: string;
}

const QRGenerator: React.FC = () => {
  const [shopInfo, setShopInfo] = useState<ShopInfo>({
    name: '',
    address: '',
    phone: '',
    email: '',
    googleMapsLink: ''
  });
  
  const [shopTiming, setShopTiming] = useState<ShopTiming[]>([]);
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [webAppUrl, setWebAppUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [shopId, setShopId] = useState('');
  const [copied, setCopied] = useState(false);
  const [isExtractingAddress, setIsExtractingAddress] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [isEditingInstructions, setIsEditingInstructions] = useState(false);

  const [printInstructions, setPrintInstructions] = useState<PrintInstructions>({
    language: 'english',
    title: 'How to Order Prints Online',
    subtitle: 'Scan QR Code & Place Your Order',
    steps: [
      '1. Open your phone camera or Google Lens app',
      '2. Point camera at the QR code and tap the link',
      '3. Upload your documents (PDF, Word, Images)',
      '4. Select paper size, copies, and print options',
      '5. Review your order and total cost',
      '6. Make payment using UPI/Card',
      '7. Your order will be ready for pickup!'
    ],
    footer: 'For help, call us or visit our shop',
    fontFamily: 'Arial',
    fontSize: 14,
    color: '#000000',
    backgroundColor: '#ffffff'
  });

  const languageTemplates = {
    english: {
      title: 'How to Order Prints Online',
      subtitle: 'Scan QR Code & Place Your Order',
      steps: [
        '1. Open your phone camera or Google Lens app',
        '2. Point camera at the QR code and tap the link',
        '3. Upload your documents (PDF, Word, Images)',
        '4. Select paper size, copies, and print options',
        '5. Review your order and total cost',
        '6. Make payment using UPI/Card',
        '7. Your order will be ready for pickup!'
      ],
      footer: 'For help, call us or visit our shop'
    },
    hindi: {
      title: 'ऑनलाइन प्रिंट कैसे ऑर्डर करें',
      subtitle: 'QR कोड स्कैन करें और ऑर्डर करें',
      steps: [
        '1. अपने फोन का कैमरा या Google Lens ऐप खोलें',
        '2. QR कोड पर कैमरा पॉइंट करें और लिंक पर टैप करें',
        '3. अपने दस्तावेज़ अपलोड करें (PDF, Word, Images)',
        '4. पेपर साइज़, कॉपी और प्रिंट विकल्प चुनें',
        '5. अपना ऑर्डर और कुल लागत देखें',
        '6. UPI/Card से पेमेंट करें',
        '7. आपका ऑर्डर पिकअप के लिए तैयार हो जाएगा!'
      ],
      footer: 'मदद के लिए हमें कॉल करें या दुकान पर आएं'
    },
    gujarati: {
      title: 'ઓનલાઇન પ્રિન્ટ કેવી રીતે ઓર્ડર કરવું',
      subtitle: 'QR કોડ સ્કેન કરો અને ઓર્ડર કરો',
      steps: [
        '1. તમારા ફોનનો કેમેરા અથવા Google Lens એપ ખોલો',
        '2. QR કોડ પર કેમેરા પોઇન્ટ કરો અને લિંક પર ટેપ કરો',
        '3. તમારા દસ્તાવેજો અપલોડ કરો (PDF, Word, Images)',
        '4. પેપર સાઇઝ, કોપી અને પ્રિન્ટ વિકલ્પો પસંદ કરો',
        '5. તમારો ઓર્ડર અને કુલ ખર્ચ જુઓ',
        '6. UPI/Card થી પેમેન્ટ કરો',
        '7. તમારો ઓર્ડર પિકઅપ માટે તૈયાર થઈ જશે!'
      ],
      footer: 'મદદ માટે અમને કૉલ કરો અથવા દુકાનમાં આવો'
    },
    marathi: {
      title: 'ऑनलाइन प्रिंट कसे ऑर्डर करावे',
      subtitle: 'QR कोड स्कॅन करा आणि ऑर्डर करा',
      steps: [
        '1. तुमचा फोन कॅमेरा किंवा Google Lens अॅप उघडा',
        '2. QR कोडवर कॅमेरा पॉइंट करा आणि लिंकवर टॅप करा',
        '3. तुमचे दस्तऐवज अपलोड करा (PDF, Word, Images)',
        '4. पेपर साइझ, कॉपी आणि प्रिंट पर्याय निवडा',
        '5. तुमचा ऑर्डर आणि एकूण खर्च पहा',
        '6. UPI/Card ने पेमेंट करा',
        '7. तुमचा ऑर्डर पिकअपसाठी तयार होईल!'
      ],
      footer: 'मदतीसाठी आम्हाला कॉल करा किंवा दुकानात या'
    },
    tamil: {
      title: 'ஆன்லைன் பிரிண்ட் எப்படி ஆர்டர் செய்வது',
      subtitle: 'QR கோடை ஸ்கேன் செய்து ஆர்டர் செய்யுங்கள்',
      steps: [
        '1. உங்கள் போன் கேமரா அல்லது Google Lens ஆப்பை திறக்கவும்',
        '2. QR கோடில் கேமராவை காட்டி லிங்கை டேப் செய்யவும்',
        '3. உங்கள் ஆவணங்களை அப்லோட் செய்யவும் (PDF, Word, Images)',
        '4. பேப்பர் சைஸ், காப்பி மற்றும் பிரிண்ட் விருப்பங்களை தேர்ந்தெடுக்கவும்',
        '5. உங்கள் ஆர்டர் மற்றும் மொத்த செலவை பார்க்கவும்',
        '6. UPI/Card மூலம் பேமெண்ட் செய்யவும்',
        '7. உங்கள் ஆர்டர் பிக்கப்பிற்கு தயாராகிவிடும்!'
      ],
      footer: 'உதவிக்கு எங்களை அழைக்கவும் அல்லது கடைக்கு வாருங்கள்'
    }
  };

  const fontOptions = [
    'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana', 
    'Tahoma', 'Trebuchet MS', 'Impact', 'Comic Sans MS'
  ];

  useEffect(() => {
    const savedShopInfo = localStorage.getItem('shop-info');
    if (savedShopInfo) {
      setShopInfo(JSON.parse(savedShopInfo));
    }

    const savedTiming = localStorage.getItem('shop-timing');
    if (savedTiming) {
      setShopTiming(JSON.parse(savedTiming));
    }

    const savedShopId = localStorage.getItem('shop-id');
    if (savedShopId) {
      setShopId(savedShopId);
    }

    const savedInstructions = localStorage.getItem('print-instructions');
    if (savedInstructions) {
      setPrintInstructions(JSON.parse(savedInstructions));
    }
  }, []);

  const extractAddressFromMapsLink = (mapsLink: string): string => {
    try {
      const url = new URL(mapsLink);
      
      const queryParam = url.searchParams.get('query');
      if (queryParam) {
        return decodeURIComponent(queryParam);
      }
      
      const qParam = url.searchParams.get('q');
      if (qParam) {
        return decodeURIComponent(qParam);
      }
      
      const pathname = url.pathname;
      if (pathname.includes('/place/')) {
        const placeName = pathname.split('/place/')[1].split('/')[0];
        return decodeURIComponent(placeName.replace(/\+/g, ' '));
      }
      
      if (pathname.includes('/search/')) {
        const searchTerm = pathname.split('/search/')[1].split('/')[0];
        return decodeURIComponent(searchTerm.replace(/\+/g, ' '));
      }
      
      if (pathname.includes('/maps/')) {
        const parts = pathname.split('/');
        const addressIndex = parts.findIndex(part => part === 'maps') + 1;
        if (addressIndex < parts.length) {
          return decodeURIComponent(parts[addressIndex].replace(/\+/g, ' '));
        }
      }
      
      return '';
    } catch (error) {
      console.error('Error extracting address from maps link:', error);
      return '';
    }
  };

  const handleExtractAddress = async () => {
    if (!shopInfo.googleMapsLink) return;
    
    setIsExtractingAddress(true);
    try {
      const extractedAddress = extractAddressFromMapsLink(shopInfo.googleMapsLink);
      if (extractedAddress) {
        setShopInfo(prev => ({
          ...prev,
          address: extractedAddress
        }));
      } else {
        alert('Could not extract address from the provided Google Maps link. Please check the link format.');
      }
    } catch (error) {
      console.error('Error extracting address:', error);
      alert('Error extracting address. Please try again.');
    } finally {
      setIsExtractingAddress(false);
    }
  };

  const validateShopInfo = (): string[] => {
    const errors: string[] = [];
    
    if (!shopInfo.name.trim()) {
      errors.push('Shop name is required');
    }
    
    if (!shopInfo.address.trim()) {
      errors.push('Shop address is required');
    }
    
    if (!shopInfo.phone.trim()) {
      errors.push('Phone number is required');
    }
    
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (shopInfo.phone.trim() && !phoneRegex.test(shopInfo.phone.replace(/[\s\-\(\)]/g, ''))) {
      errors.push('Please enter a valid phone number');
    }
    
    const hasOpenDays = shopTiming.some(timing => timing.isOpen);
    if (shopTiming.length > 0 && !hasOpenDays) {
      errors.push('Shop must be open at least one day of the week');
    }
    
    return errors;
  };

  const generateQRCode = async (): Promise<string> => {
    let currentShopId = shopId;
    if (!currentShopId) {
      currentShopId = `shop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setShopId(currentShopId);
      localStorage.setItem('shop-id', currentShopId);
    }
    
    const baseUrl = 'https://xerox-print-shop.vercel.app';
    const fullWebAppUrl = `${baseUrl}/shop/${currentShopId}`;
    setWebAppUrl(fullWebAppUrl);
    
    const qrData = {
      url: fullWebAppUrl,
      shopId: currentShopId,
      shopInfo: {
        name: shopInfo.name,
        address: shopInfo.address,
        phone: shopInfo.phone,
        email: shopInfo.email || '',
        googleMapsLink: shopInfo.googleMapsLink || ''
      },
      timing: shopTiming.filter(t => t.isOpen).map(t => ({
        day: t.day,
        open: t.openTime,
        close: t.closeTime
      })),
      type: 'xerox_shop',
      version: '1.0',
      generated: new Date().toISOString()
    };
    
    const qrOptions = {
      errorCorrectionLevel: 'M' as const,
      type: 'image/png' as const,
      quality: 0.92,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 400
    };
    
    try {
      const qrDataURL = await QRCodeLib.toDataURL(JSON.stringify(qrData), qrOptions);
      return qrDataURL;
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  };

  const handleGenerateQR = async () => {
    const errors = validateShopInfo();
    
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    
    setValidationErrors([]);
    setIsGenerating(true);
    
    try {
      const qrDataURL = await generateQRCode();
      setQrCodeDataURL(qrDataURL);
      setShowPreview(true);
      
      if (window.electron) {
        await window.electron.saveQRImage(qrDataURL);
      }
      
      localStorage.setItem('shop-info', JSON.stringify(shopInfo));
      
    } catch (error) {
      console.error('Error generating QR code:', error);
      setValidationErrors(['Failed to generate QR code. Please try again.']);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeDataURL) return;
    
    const link = document.createElement('a');
    link.download = `${shopInfo.name.replace(/\s+/g, '_')}_QR_Code.png`;
    link.href = qrCodeDataURL;
    link.click();
  };

  const copyUrlToClipboard = async () => {
    if (!webAppUrl) return;
    
    try {
      await navigator.clipboard.writeText(webAppUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  const handleLanguageChange = (language: string) => {
    const template = languageTemplates[language as keyof typeof languageTemplates];
    if (template) {
      setPrintInstructions(prev => ({
        ...prev,
        language,
        ...template
      }));
    }
  };

  const savePrintInstructions = () => {
    localStorage.setItem('print-instructions', JSON.stringify(printInstructions));
    setIsEditingInstructions(false);
  };

  const generatePrintLayout = () => {
    if (!qrCodeDataURL) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print QR Code with Instructions</title>
        <style>
          @page {
            size: A4;
            margin: 20mm;
          }
          body {
            font-family: ${printInstructions.fontFamily}, sans-serif;
            font-size: ${printInstructions.fontSize}px;
            color: ${printInstructions.color};
            background-color: ${printInstructions.backgroundColor};
            margin: 0;
            padding: 0;
            line-height: 1.6;
          }
          .container {
            display: flex;
            height: 100vh;
            gap: 30px;
          }
          .qr-section {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            border-right: 2px dashed #ccc;
            padding-right: 30px;
          }
          .instructions-section {
            flex: 1;
            padding-left: 30px;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .qr-code {
            width: 300px;
            height: 300px;
            margin: 20px 0;
            border: 3px solid #000;
            padding: 10px;
            background: white;
          }
          .shop-info {
            margin-top: 20px;
            text-align: center;
          }
          .shop-name {
            font-size: ${printInstructions.fontSize + 6}px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .shop-details {
            font-size: ${printInstructions.fontSize - 2}px;
            margin: 5px 0;
          }
          .title {
            font-size: ${printInstructions.fontSize + 8}px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #2563eb;
          }
          .subtitle {
            font-size: ${printInstructions.fontSize + 2}px;
            margin-bottom: 20px;
            color: #4b5563;
          }
          .steps {
            list-style: none;
            padding: 0;
            margin: 20px 0;
          }
          .steps li {
            margin: 12px 0;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .footer {
            margin-top: 30px;
            font-weight: bold;
            text-align: center;
            padding: 15px;
            background: #f3f4f6;
            border-radius: 8px;
          }
          @media print {
            .container {
              height: auto;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="qr-section">
            <img src="${qrCodeDataURL}" alt="QR Code" class="qr-code" />
            <div class="shop-info">
              <div class="shop-name">${shopInfo.name}</div>
              <div class="shop-details">📍 ${shopInfo.address}</div>
              <div class="shop-details">📞 ${shopInfo.phone}</div>
              ${shopInfo.email ? `<div class="shop-details">✉️ ${shopInfo.email}</div>` : ''}
            </div>
          </div>
          
          <div class="instructions-section">
            <h1 class="title">${printInstructions.title}</h1>
            <h2 class="subtitle">${printInstructions.subtitle}</h2>
            
            <ul class="steps">
              ${printInstructions.steps.map(step => `<li>${step}</li>`).join('')}
            </ul>
            
            <div class="footer">
              ${printInstructions.footer}<br>
              ${shopInfo.phone}
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const formatTiming = (): string => {
    if (shopTiming.length === 0) return 'No timing set';
    
    const openDays = shopTiming.filter(t => t.isOpen);
    if (openDays.length === 0) return 'Closed all days';
    
    return openDays.map(t => 
      `${t.day}: ${t.openTime} - ${t.closeTime}`
    ).join(', ');
  };

  return (
    <div className="space-y-6">
      {/* PROFESSIONAL: Header Section */}
      <div className="card p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-blue-200 dark:border-blue-800 shadow-large">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center shadow-large mr-4">
            <QrCode className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-blue-800 dark:text-blue-300">Generate Shop QR Code</h2>
            <p className="text-blue-600 dark:text-blue-400">Create a professional QR code that customers can scan to access your web app</p>
          </div>
        </div>
      </div>

      {/* Auto-extracted address notification */}
      {shopInfo.googleMapsLink && shopInfo.address && (
        <div className="alert-success animate-scale-in">
          <CheckCircle className="h-5 w-5 mr-2" />
          <span>Address automatically extracted from Google Maps link!</span>
        </div>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="alert-error animate-scale-in">
          <AlertTriangle className="h-5 w-5 mr-2" />
          <div>
            <strong>Please fix the following issues:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* PROFESSIONAL: Current Shop Information Summary */}
      <div className="card p-6 shadow-large">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          Current Shop Information
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <Globe className="h-4 w-4 text-blue-600 mr-3" />
              <div className="flex-1">
                <span className="font-medium text-gray-700 dark:text-gray-300">Shop Name:</span>
                <p className={`${shopInfo.name ? 'text-gray-900 dark:text-white' : 'text-red-500'} font-semibold`}>
                  {shopInfo.name || 'Not set'}
                </p>
              </div>
            </div>
            
            <div className="flex items-start p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <MapPin className="h-4 w-4 text-green-600 mr-3 mt-1" />
              <div className="flex-1">
                <span className="font-medium text-gray-700 dark:text-gray-300">Address:</span>
                <p className={`${shopInfo.address ? 'text-gray-900 dark:text-white' : 'text-red-500'} font-semibold`}>
                  {shopInfo.address || 'Not set'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <Phone className="h-4 w-4 text-blue-600 mr-3" />
              <div className="flex-1">
                <span className="font-medium text-gray-700 dark:text-gray-300">Phone:</span>
                <p className={`${shopInfo.phone ? 'text-gray-900 dark:text-white' : 'text-red-500'} font-semibold`}>
                  {shopInfo.phone || 'Not set'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <Clock className="h-4 w-4 text-orange-600 mr-3" />
              <div className="flex-1">
                <span className="font-medium text-gray-700 dark:text-gray-300">Timing:</span>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {formatTiming()}
                </p>
              </div>
            </div>

            {shopId && (
              <div className="flex items-center p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <QrCode className="h-4 w-4 text-blue-600 mr-3" />
                <div className="flex-1">
                  <span className="font-medium text-blue-700 dark:text-blue-300">Shop ID:</span>
                  <p className="text-blue-600 dark:text-blue-400 text-sm font-mono">
                    {shopId}
                  </p>
                </div>
              </div>
            )}

            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center text-blue-800 dark:text-blue-300 mb-2">
                <Sparkles className="h-4 w-4 mr-2" />
                <span className="text-sm font-medium">Quick Tip</span>
              </div>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                Go to Settings to update this information before generating your QR code
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* PROFESSIONAL: Generate Button */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={handleGenerateQR}
          disabled={isGenerating}
          className={`flex-1 btn-primary py-3 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 ${
            isGenerating ? 'opacity-50 cursor-not-allowed scale-100' : ''
          }`}
        >
          {isGenerating ? (
            <div className="flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
              Generating QR Code...
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <QrCode className="h-5 w-5 mr-3" />
              Generate Professional QR Code
              <Sparkles className="h-5 w-5 ml-3" />
            </div>
          )}
        </button>
        
        {qrCodeDataURL && (
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="btn-secondary py-3 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
          >
            <Eye className="h-5 w-5 mr-3" />
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
        )}
      </div>

      {/* PROFESSIONAL: QR Code Preview */}
      {qrCodeDataURL && showPreview && (
        <div className="card p-6 shadow-large animate-scale-in">
          <div className="flex flex-col items-center">
            <div className="bg-white p-6 rounded-xl shadow-2xl mb-6 border-4 border-gray-100 dark:border-gray-600">
              <img 
                src={qrCodeDataURL} 
                alt="Shop QR Code" 
                className="w-64 h-64 object-contain"
              />
            </div>
            
            <div className="text-center space-y-3 w-full max-w-md">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {shopInfo.name} - QR Code
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                High-quality QR code ready for printing and display
              </p>
              
              {webAppUrl && (
                <div className="card p-4 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Web App URL:</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={webAppUrl}
                      readOnly
                      className="flex-1 text-sm text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-600 rounded-lg px-3 py-2"
                    />
                    <button
                      onClick={copyUrlToClipboard}
                      className="btn-primary px-3 py-2"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex flex-wrap gap-4 mt-6">
              <button
                onClick={downloadQRCode}
                className="btn-success shadow-large hover:shadow-xl transform hover:scale-105 transition-all duration-300"
              >
                <Download className="h-4 w-4 mr-2" />
                Download QR Code
              </button>

              <button
                onClick={() => setShowPrintPreview(!showPrintPreview)}
                className="btn-secondary shadow-large hover:shadow-xl transform hover:scale-105 transition-all duration-300"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print with Instructions
              </button>
              
              {webAppUrl && (
                <a
                  href={webAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary shadow-large hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Test Web App
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PROFESSIONAL: Print Instructions Configuration */}
      {qrCodeDataURL && showPrintPreview && (
        <div className="card p-6 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900/30 dark:to-slate-900/30 border-gray-200 dark:border-gray-800 shadow-large animate-scale-in">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-secondary rounded-lg flex items-center justify-center shadow-soft mr-3">
                <Printer className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-300">Print Instructions Configuration</h3>
                <p className="text-gray-600 dark:text-gray-400">Customize the instructions that will be printed with your QR code</p>
              </div>
            </div>
            <button
              onClick={() => setIsEditingInstructions(!isEditingInstructions)}
              className={`btn-primary shadow-large hover:shadow-xl transform hover:scale-105 transition-all duration-300 ${
                isEditingInstructions ? 'bg-red-600 hover:bg-red-700' : ''
              }`}
            >
              {isEditingInstructions ? (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Cancel Editing
                </>
              ) : (
                <>
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit Instructions
                </>
              )}
            </button>
          </div>

          {isEditingInstructions ? (
            <div className="space-y-6">
              {/* Style Controls */}
              <div className="card p-4 bg-white dark:bg-gray-800 shadow-soft">
                <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                  <Palette className="h-4 w-4 mr-2" />
                  Style & Language Settings
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="form-group">
                    <label className="form-label flex items-center">
                      <Languages className="h-4 w-4 mr-2" />
                      Language
                    </label>
                    <select
                      value={printInstructions.language}
                      onChange={(e) => handleLanguageChange(e.target.value)}
                      className="input cursor-pointer"
                    >
                      <option value="english">English</option>
                      <option value="hindi">हिंदी (Hindi)</option>
                      <option value="gujarati">ગુજરાતી (Gujarati)</option>
                      <option value="marathi">मराठी (Marathi)</option>
                      <option value="tamil">தமிழ் (Tamil)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label flex items-center">
                      <Type className="h-4 w-4 mr-2" />
                      Font Family
                    </label>
                    <select
                      value={printInstructions.fontFamily}
                      onChange={(e) => setPrintInstructions(prev => ({ ...prev, fontFamily: e.target.value }))}
                      className="input cursor-pointer"
                    >
                      {fontOptions.map(font => (
                        <option key={font} value={font}>{font}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Font Size: {printInstructions.fontSize}px</label>
                    <input
                      type="range"
                      min="10"
                      max="20"
                      value={printInstructions.fontSize}
                      onChange={(e) => setPrintInstructions(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                      className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>10px</span>
                      <span>15px</span>
                      <span>20px</span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Text Color</label>
                    <input
                      type="color"
                      value={printInstructions.color}
                      onChange={(e) => setPrintInstructions(prev => ({ ...prev, color: e.target.value }))}
                      className="w-full h-10 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Content Editing */}
              <div className="card p-4 bg-white dark:bg-gray-800 shadow-soft">
                <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Content Editing
                </h4>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="form-label">Title</label>
                      <input
                        type="text"
                        value={printInstructions.title}
                        onChange={(e) => setPrintInstructions(prev => ({ ...prev, title: e.target.value }))}
                        className="input cursor-visible"
                        autoComplete="off"
                        spellCheck="false"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Subtitle</label>
                      <input
                        type="text"
                        value={printInstructions.subtitle}
                        onChange={(e) => setPrintInstructions(prev => ({ ...prev, subtitle: e.target.value }))}
                        className="input cursor-visible"
                        autoComplete="off"
                        spellCheck="false"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Steps (one per line)</label>
                    <textarea
                      rows={6}
                      value={printInstructions.steps.join('\n')}
                      onChange={(e) => setPrintInstructions(prev => ({ ...prev, steps: e.target.value.split('\n').filter(step => step.trim()) }))}
                      className="input resize-none cursor-visible"
                      placeholder="Enter each step on a new line..."
                      autoComplete="off"
                      spellCheck="false"
                    />
                    <p className="form-help">Each line will become a separate step in the instructions</p>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Footer Message</label>
                    <input
                      type="text"
                      value={printInstructions.footer}
                      onChange={(e) => setPrintInstructions(prev => ({ ...prev, footer: e.target.value }))}
                      className="input cursor-visible"
                      autoComplete="off"
                      spellCheck="false"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={savePrintInstructions}
                  className="btn-success flex-1 py-3 shadow-large hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Instructions
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="card p-4 bg-white dark:bg-gray-800 shadow-soft">
                  <h5 className="font-bold text-gray-900 dark:text-white mb-3">Current Settings</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Language:</span>
                      <span className="font-medium">{printInstructions.language.charAt(0).toUpperCase() + printInstructions.language.slice(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Font:</span>
                      <span className="font-medium">{printInstructions.fontFamily} {printInstructions.fontSize}px</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Steps:</span>
                      <span className="font-medium">{printInstructions.steps.length} instructions</span>
                    </div>
                  </div>
                </div>

                <div className="card p-4 bg-white dark:bg-gray-800 shadow-soft">
                  <h5 className="font-bold text-gray-900 dark:text-white mb-3">Preview</h5>
                  <div className="space-y-2 text-sm">
                    <div className="font-bold text-blue-600">{printInstructions.title}</div>
                    <div className="text-gray-600">{printInstructions.subtitle}</div>
                    <div className="text-xs text-gray-500">
                      {printInstructions.steps.slice(0, 3).map((step, i) => (
                        <div key={i}>{step}</div>
                      ))}
                      {printInstructions.steps.length > 3 && <div>... and {printInstructions.steps.length - 3} more</div>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-4">
            <button
              onClick={generatePrintLayout}
              className="btn-secondary flex-1 py-3 shadow-large hover:shadow-xl transform hover:scale-105 transition-all duration-300"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print A4 Sheet with Instructions
            </button>
          </div>
        </div>
      )}

      {/* PROFESSIONAL: QR Code Features */}
      {qrCodeDataURL && (
        <div className="card p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-green-200 dark:border-green-800 shadow-large">
          <h3 className="text-lg font-bold text-green-800 dark:text-green-300 mb-4 flex items-center">
            <CheckCircle className="h-5 w-5 mr-2" />
            QR Code Features
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-soft">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mr-3">
                <Globe className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Direct Web App Link</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Instant access to your shop</p>
              </div>
            </div>

            <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-soft">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mr-3">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Complete Shop Info</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Name, address, phone, timing</p>
              </div>
            </div>

            <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-soft">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mr-3">
                <QrCode className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">High Quality</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">400x400px, print-ready</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROFESSIONAL: Instructions */}
      <div className="card p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-blue-200 dark:border-blue-800 shadow-large">
        <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-4">How it works:</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ol className="space-y-3 text-blue-700 dark:text-blue-400">
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">1</span>
              <span>Complete your shop information in Settings</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">2</span>
              <span>Click "Generate Professional QR Code" to create your unique shop QR</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">3</span>
              <span>Download the high-quality PNG file</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">4</span>
              <span>Print and display the QR code in your shop</span>
            </li>
          </ol>
          
          <ol className="space-y-3 text-blue-700 dark:text-blue-400" start={5}>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">5</span>
              <span>Customers scan the QR code to access your web app</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">6</span>
              <span>They can browse services, upload files, and place orders</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">7</span>
              <span>Orders appear instantly in your desktop app</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">8</span>
              <span>Manage everything from one dashboard!</span>
            </li>
          </ol>
        </div>
        
        <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong className="text-blue-800 dark:text-blue-300">Professional Features:</strong> High-quality 400x400px resolution, error correction level M, 
            contains complete shop data including direct web app link, shop info, timing, and unique shop ID. 
            Ready for professional printing and display with customizable multilingual instructions.
          </p>
        </div>
      </div>
    </div>
  );
};

export default QRGenerator;