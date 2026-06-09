import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Settings as SettingsIcon, User, Building, CreditCard, Globe, QrCode, Palette, Bell, Shield, Database, Wifi, CheckCircle, AlertTriangle, RefreshCw, Save, Eye, EyeOff, Copy, ExternalLink, Clock, MapPin, Link2, FileText, Info, ArrowRight, Scale, ShieldCheck, HelpCircle } from 'lucide-react';
import QRUploader from '../components/QRUploader';
import QRGenerator from '../components/QRGenerator';
import WebAppConnection from '../components/WebAppConnection';
import { testConnection, syncShopInfoToDatabase, syncPaymentInfo, syncBusinessDetails, fetchShopSettingsFromDatabase } from '../utils/supabase';
import { DEFAULT_SHOP_TIMING, type ShopTiming } from '../utils/defaultShopHours';
import {
  generateGoogleMapsLinkFromAddress,
  extractAddressFromMapsLink as extractAddressFromLink,
  extractCoordinatesFromMapsLink as extractCoordsFromLink,
  detectCurrentLocationFull,
  getExpandUrlFn,
} from '../utils/locationHelpers';

interface SettingsProps {
  currentUser?: any;
}

interface ShopInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  googleMapsLink: string;
  latitude: string;
  longitude: string;
  /** Shop web QR image URL from database (Settings → QR), used on print slip */
  qr_code_url?: string;
}

interface PaymentInfo {
  upiId: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  accountHolderName: string;
  qrCodeImage: string;
}

interface BusinessDetails {
  businessType: string;
  gstNumber: string;
  panNumber: string;
  registrationNumber: string;
  ownerName: string;
  establishedYear: string;
}

const Settings: React.FC<SettingsProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'shop' | 'timing' | 'payment' | 'business' | 'qr' | 'webapp' | 'legal'>('profile');
  const [shopInfo, setShopInfo] = useState<ShopInfo>({
    name: '',
    address: '',
    phone: '',
    email: '',
    googleMapsLink: '',
    latitude: '',
    longitude: ''
  });
  
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    upiId: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    accountHolderName: '',
    qrCodeImage: ''
  });
  
  const [businessDetails, setBusinessDetails] = useState<BusinessDetails>({
    businessType: '',
    gstNumber: '',
    panNumber: '',
    registrationNumber: '',
    ownerName: '',
    establishedYear: ''
  });

  const [shopTiming, setShopTiming] = useState<ShopTiming>(DEFAULT_SHOP_TIMING);

  const [isSaving, setIsSaving] = useState(false);
  const [isExtractingAddress, setIsExtractingAddress] = useState(false);
  const [isExtractingCoords, setIsExtractingCoords] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    isConnected: boolean;
    testing: boolean;
    error: string | null;
  }>({
    isConnected: false,
    testing: false,
    error: null
  });
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    void loadSettings();
    testSupabaseConnection();
  }, []);

  const loadSettings = async () => {
    const emptyShopInfo: ShopInfo = {
      name: '',
      address: '',
      phone: '',
      email: '',
      googleMapsLink: '',
      latitude: '',
      longitude: '',
    };

    let mergedShopInfo = { ...emptyShopInfo };
    let mergedBusinessDetails = { ...businessDetails };
    let mergedShopTiming = { ...shopTiming };

    const savedShopInfo = localStorage.getItem('shop-info');
    if (savedShopInfo) {
      mergedShopInfo = { ...mergedShopInfo, ...JSON.parse(savedShopInfo) };
    }

    const savedBusinessDetails = localStorage.getItem('business-details');
    if (savedBusinessDetails) {
      mergedBusinessDetails = { ...mergedBusinessDetails, ...JSON.parse(savedBusinessDetails) };
    }

    const savedShopTiming = localStorage.getItem('shop-timing');
    if (savedShopTiming) {
      mergedShopTiming = { ...mergedShopTiming, ...JSON.parse(savedShopTiming) };
    }

    const shopId = localStorage.getItem('shop-id');
    if (shopId) {
      const dbResult = await fetchShopSettingsFromDatabase(shopId);
      if (dbResult.success) {
        mergedShopInfo = { ...mergedShopInfo, ...dbResult.shopInfo };
        mergedBusinessDetails = { ...mergedBusinessDetails, ...dbResult.businessDetails };
        mergedShopTiming = dbResult.shopTiming;

        localStorage.setItem('shop-info', JSON.stringify(mergedShopInfo));
        localStorage.setItem('business-details', JSON.stringify(mergedBusinessDetails));
        localStorage.setItem('shop-timing', JSON.stringify(mergedShopTiming));
      }
    }

    setShopInfo(mergedShopInfo);
    setBusinessDetails(mergedBusinessDetails);
    setShopTiming(mergedShopTiming);

    const savedPaymentInfo = localStorage.getItem('payment-info');
    if (savedPaymentInfo) {
      setPaymentInfo(JSON.parse(savedPaymentInfo));
    }
  };

  const testSupabaseConnection = async () => {
    setConnectionStatus(prev => ({ ...prev, testing: true, error: null }));
    
    try {
      console.log('🔍 Testing Supabase connection...');
      const result = await testConnection();
      
      if (result.success) {
        console.log('✅ Supabase connection successful!');
        setConnectionStatus({
          isConnected: true,
          testing: false,
          error: null
        });
        
        // Show success notification
        const event = new CustomEvent('show-notification', {
          detail: {
            type: 'success',
            message: 'Successfully connected to Supabase database!'
          }
        });
        window.dispatchEvent(event);
      } else {
        console.error('❌ Supabase connection failed:', result.error);
        setConnectionStatus({
          isConnected: false,
          testing: false,
          error: result.error || 'Connection failed'
        });
      }
    } catch (error) {
      console.error('❌ Connection test error:', error);
      setConnectionStatus({
        isConnected: false,
        testing: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const saveShopInfo = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem('shop-info', JSON.stringify(shopInfo));
      
      // Sync to Supabase if connected
      const shopId = localStorage.getItem('shop-id');
      if (shopId && connectionStatus.isConnected) {
        const result = await syncShopInfoToDatabase(shopId, shopInfo, currentUser?.id);
        if (result.success) {
          console.log('✅ Shop info synced to database');
        }
      }
      
      // Show success notification
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'success',
          message: 'Shop information saved successfully!'
        }
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Error saving shop info:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const savePaymentInfo = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem('payment-info', JSON.stringify(paymentInfo));
      
      // Sync to Supabase if connected
      const shopId = localStorage.getItem('shop-id');
      if (shopId && connectionStatus.isConnected) {
        const result = await syncPaymentInfo(shopId, paymentInfo);
        if (result.success) {
          console.log('✅ Payment info synced to database');
        }
      }
      
      // Show success notification
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'success',
          message: 'Payment information saved successfully!'
        }
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Error saving payment info:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const saveBusinessDetails = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem('business-details', JSON.stringify(businessDetails));
      
      // Sync to Supabase if connected
      const shopId = localStorage.getItem('shop-id');
      if (shopId && connectionStatus.isConnected) {
        const result = await syncBusinessDetails(shopId, businessDetails);
        if (result.success) {
          console.log('✅ Business details synced to database');
        }
      }
      
      // Show success notification
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'success',
          message: 'Business details saved successfully!'
        }
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Error saving business details:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const expandUrl = getExpandUrlFn();

  const generateGoogleMapsLink = () => {
    if (!shopInfo.address) {
      alert('Please enter an address first');
      return;
    }
    const mapsLink = generateGoogleMapsLinkFromAddress(shopInfo.address);
    setShopInfo(prev => ({ ...prev, googleMapsLink: mapsLink }));
    window.dispatchEvent(new CustomEvent('show-notification', {
      detail: { type: 'success', message: 'Google Maps link generated from address!' },
    }));
  };

  const extractAddressFromMapsLink = async () => {
    if (!shopInfo.googleMapsLink) {
      alert('Please enter a Google Maps link first');
      return;
    }
    setIsExtractingAddress(true);
    try {
      const address = await extractAddressFromLink(shopInfo.googleMapsLink, expandUrl);
      setShopInfo(prev => ({ ...prev, address }));
      window.dispatchEvent(new CustomEvent('show-notification', {
        detail: { type: 'success', message: 'Address extracted successfully!' },
      }));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Invalid Google Maps link format');
    } finally {
      setIsExtractingAddress(false);
    }
  };

  const extractCoordinatesFromMapsLink = async () => {
    if (!shopInfo.googleMapsLink) {
      alert('Please enter a Google Maps link first');
      return;
    }
    setIsExtractingCoords(true);
    try {
      const coords = await extractCoordsFromLink(shopInfo.googleMapsLink, expandUrl);
      setShopInfo(prev => ({ ...prev, latitude: coords.latitude, longitude: coords.longitude }));
      window.dispatchEvent(new CustomEvent('show-notification', {
        detail: { type: 'success', message: 'Coordinates extracted successfully!' },
      }));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Invalid link format');
    } finally {
      setIsExtractingCoords(false);
    }
  };

  const detectCurrentLocation = async () => {
    setIsDetectingLocation(true);
    try {
      const patch = await detectCurrentLocationFull();
      setShopInfo(prev => ({
        ...prev,
        latitude: patch.latitude || prev.latitude,
        longitude: patch.longitude || prev.longitude,
        address: patch.address || prev.address,
        googleMapsLink: patch.googleMapsLink || prev.googleMapsLink,
      }));
      window.dispatchEvent(new CustomEvent('show-notification', {
        detail: { type: 'success', message: 'Location detected successfully!' },
      }));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to detect location.');
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const saveShopTiming = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem('shop-timing', JSON.stringify(shopTiming));

      // Show success notification
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'success',
          message: 'Shop timing saved successfully!'
        }
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Error saving shop timing:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    {
      id: 'profile',
      label: 'Profile',
      icon: User,
      description: 'Manage your account and personal information'
    },
    {
      id: 'shop',
      label: 'Shop Info',
      icon: Building,
      description: 'Configure your shop details and location'
    },
    {
      id: 'timing',
      label: 'Shop Timing',
      icon: Clock,
      description: 'Set opening hours and holidays'
    },
    {
      id: 'payment',
      label: 'Payment',
      icon: CreditCard,
      description: 'Set up payment methods and bank details'
    },
    {
      id: 'business',
      label: 'Business',
      icon: Shield,
      description: 'Business registration and tax information'
    },
    {
      id: 'qr',
      label: 'QR Codes',
      icon: QrCode,
      description: 'Generate and manage QR codes for your shop'
    },
    {
      id: 'webapp',
      label: 'Web App',
      icon: Globe,
      description: 'Connect with your customer web application'
    },
    {
      id: 'legal',
      label: 'Legal',
      icon: Scale,
      description: 'Terms, privacy, and policy information'
    },
  ];

  return (
    <div className="container-max-space animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center shadow-large mr-4">
              <SettingsIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gradient-primary">Settings</h1>
              <p className="text-gray-600 dark:text-gray-400">Manage your PrintGet shop profile, payments, and hours</p>
            </div>
          </div>
          
          {/* Connection Status */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center px-3 py-2 rounded-lg ${
              connectionStatus.isConnected 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
            }`}>
              {connectionStatus.testing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : connectionStatus.isConnected ? (
                <Wifi className="h-4 w-4 mr-2" />
              ) : (
                <Database className="h-4 w-4 mr-2" />
              )}
              <span className="font-medium text-sm">
                {connectionStatus.testing ? 'Testing...' : connectionStatus.isConnected ? 'Connected' : 'Database'}
              </span>
            </div>
            
            <button
              onClick={testSupabaseConnection}
              disabled={connectionStatus.testing}
              className="btn-primary shadow-large hover:shadow-xl disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${connectionStatus.testing ? 'animate-spin' : ''}`} />
              Test Connection
            </button>
          </div>
        </div>

        {/* Connection Error */}
        {connectionStatus.error && (
          <div className="alert-error mb-4">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <div>
              <strong>Database Connection Error:</strong>
              <p className="mt-1">{connectionStatus.error}</p>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`card p-4 text-left transition-all duration-300 border-2 cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-blue-500 dark:border-blue-400 shadow-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30'
                    : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-large'
                }`}
              >
                <div className="flex items-center mb-2">
                  <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center shadow-soft mr-2">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-bold text-sm ${
                      activeTab === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
                    }`}>
                      {tab.label}
                    </h3>
                  </div>
                  {activeTab === tab.id && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-tight">
                  {tab.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="content-max-space animate-slide-up">
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="card p-6 shadow-large">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <User className="h-5 w-5 mr-2" />
                Profile Information
              </h3>
              
              {currentUser ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="form-group">
                        <label className="form-label">Full Name</label>
                        <input
                          type="text"
                          value={currentUser.name || ''}
                          readOnly
                          className="input bg-gray-50 dark:bg-gray-700"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Email Address</label>
                        <input
                          type="email"
                          value={currentUser.email || ''}
                          readOnly
                          className="input bg-gray-50 dark:bg-gray-700"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Role</label>
                        <input
                          type="text"
                          value={currentUser.role || 'Owner'}
                          readOnly
                          className="input bg-gray-50 dark:bg-gray-700"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="form-group">
                        <label className="form-label">Account Status</label>
                        <div className="flex items-center p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                          <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                          <span className="text-green-800 dark:text-green-300 font-medium">Active</span>
                        </div>
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Member Since</label>
                        <input
                          type="text"
                          value={currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : 'Unknown'}
                          readOnly
                          className="input bg-gray-50 dark:bg-gray-700"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Last Login</label>
                        <input
                          type="text"
                          value={currentUser.lastLogin ? new Date(currentUser.lastLogin).toLocaleString() : 'Unknown'}
                          readOnly
                          className="input bg-gray-50 dark:bg-gray-700"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <User className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No user information available</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'shop' && (
          <div className="space-y-6">
            <div className="card p-6 shadow-large">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                  <Building className="h-5 w-5 mr-2" />
                  Shop Information
                </h3>
                <button
                  onClick={saveShopInfo}
                  disabled={isSaving}
                  className="btn-primary shadow-large hover:shadow-xl disabled:opacity-50"
                >
                  {isSaving ? (
                    <div className="flex items-center">
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </div>
                  )}
                </button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="form-group">
                    <label className="form-label">Shop Name *</label>
                    <input
                      type="text"
                      value={shopInfo.name}
                      onChange={(e) => setShopInfo(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Your shop name"
                      className="input cursor-visible"
                      autoComplete="off"
                      spellCheck="false"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Phone Number *</label>
                    <input
                      type="tel"
                      value={shopInfo.phone}
                      onChange={(e) => setShopInfo(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+91 9876543210"
                      className="input cursor-visible"
                      autoComplete="off"
                      spellCheck="false"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      value={shopInfo.email}
                      onChange={(e) => setShopInfo(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="shop@example.com"
                      className="input cursor-visible"
                      autoComplete="off"
                      spellCheck="false"
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="form-group">
                    <label className="form-label flex items-center justify-between">
                      <span>Shop Address *</span>
                      <button
                        type="button"
                        onClick={extractAddressFromMapsLink}
                        disabled={!shopInfo.googleMapsLink || isExtractingAddress}
                        className="btn-secondary text-xs py-1 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isExtractingAddress ? (
                          <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-1"></div>
                        ) : (
                          <MapPin className="h-3 w-3 mr-1" />
                        )}
                        {isExtractingAddress ? 'Extracting...' : 'Extract from Link'}
                      </button>
                    </label>
                    <textarea
                      rows={3}
                      value={shopInfo.address}
                      onChange={(e) => setShopInfo(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Complete shop address with pincode"
                      className="input resize-none cursor-visible"
                      autoComplete="off"
                      spellCheck="false"
                    />
                    <p className="form-help">Enter address manually or extract it from Google Maps link below</p>
                  </div>

                  <div className="form-group">
                    <label className="form-label flex items-center justify-between">
                      <span>Google Maps Link</span>
                      <button
                        type="button"
                        onClick={generateGoogleMapsLink}
                        disabled={!shopInfo.address}
                        className="btn-secondary text-xs py-1 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Link2 className="h-3 w-3 mr-1" />
                        Generate from Address
                      </button>
                    </label>
                    <input
                      type="url"
                      value={shopInfo.googleMapsLink}
                      onChange={(e) => setShopInfo(prev => ({ ...prev, googleMapsLink: e.target.value }))}
                      placeholder="https://maps.google.com/..."
                      className="input cursor-visible"
                      autoComplete="off"
                      spellCheck="false"
                    />
                    <div className="flex items-center justify-between mt-1">
                      <p className="form-help m-0">Paste link to extract coordinates automatically</p>
                      {shopInfo.googleMapsLink ? (
                        <button
                          type="button"
                          onClick={extractCoordinatesFromMapsLink}
                          disabled={isExtractingCoords}
                          className="btn-secondary text-[10px] py-1 px-2 border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-50 flex items-center"
                        >
                          {isExtractingCoords ? (
                            <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-1"></div>
                          ) : null}
                          {isExtractingCoords ? 'Extracting...' : 'Extract Coordinates'}
                        </button>
                      ) : (
                        <a
                          href="https://www.google.com/maps"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-[10px] py-1 px-2"
                        >
                          Open Maps to Pinpoint
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="form-label h-5 flex items-center justify-between">
                        <span>Latitude</span>
                        <button
                          type="button"
                          onClick={detectCurrentLocation}
                          disabled={isDetectingLocation}
                          className="btn-secondary text-[10px] py-0.5 px-2 border-green-200 text-green-600 hover:bg-green-50 flex items-center gap-1 -mr-2 shadow-sm disabled:opacity-50"
                        >
                          {isDetectingLocation ? (
                            <div className="w-2.5 h-2.5 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <MapPin className="w-2.5 h-2.5" />
                          )}
                          {isDetectingLocation ? 'Detecting...' : 'Auto-Detect Location'}
                        </button>
                      </label>
                      <input
                        type="text"
                        value={shopInfo.latitude || ''}
                        onChange={(e) => setShopInfo(prev => ({ ...prev, latitude: e.target.value }))}
                        placeholder="e.g. 18.5204"
                        className="input cursor-visible"
                        autoComplete="off"
                        spellCheck="false"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label h-5 flex items-center">Longitude</label>
                      <input
                        type="text"
                        value={shopInfo.longitude || ''}
                        onChange={(e) => setShopInfo(prev => ({ ...prev, longitude: e.target.value }))}
                        placeholder="e.g. 73.8567"
                        className="input cursor-visible"
                        autoComplete="off"
                        spellCheck="false"
                      />
                    </div>
                  </div>
                  {shopInfo.latitude && shopInfo.longitude && (
                    <p className="form-help mt-2 text-green-700">
                      Location is saved to your PrintGet shop — no need to re-enter unless you move.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timing' && (
          <div className="space-y-6">
            <div className="card p-6 shadow-large">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                  <Clock className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                  Shop Operating Hours
                </h3>
                <button
                  onClick={saveShopTiming}
                  disabled={isSaving}
                  className="btn-primary shadow-large hover:shadow-xl disabled:opacity-50"
                >
                  {isSaving ? (
                    <div className="flex items-center">
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Save className="h-4 w-4 mr-2" />
                      Save Timing
                    </div>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/40 dark:to-cyan-950/40 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-4">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-500 dark:bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                      <Clock className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Weekly Schedule</p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">Configure your operating hours</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40 border-2 border-green-200 dark:border-green-800 rounded-xl p-4">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-green-500 dark:bg-green-600 rounded-lg flex items-center justify-center mr-3">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-green-600 dark:text-green-400 font-medium">Live on Web App</p>
                      <p className="text-xs text-green-700 dark:text-green-300">Customers can see your timing</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {Object.entries(shopTiming).map(([day, timing]) => (
                  <div
                    key={day}
                    className={`${
                      timing.closed
                        ? 'bg-gray-50 dark:bg-gray-800/50'
                        : 'bg-white dark:bg-gray-800'
                    } border-2 ${
                      timing.closed
                        ? 'border-gray-200 dark:border-gray-700'
                        : 'border-blue-200 dark:border-blue-800'
                    } rounded-xl p-4 transition-all duration-200 hover:shadow-md`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-2 h-2 rounded-full ${timing.closed ? 'bg-gray-400' : 'bg-green-500'}`}></div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white capitalize min-w-[100px]">
                          {day}
                        </h4>

                        {!timing.closed ? (
                          <div className="flex items-center gap-3 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Opens:</span>
                              <input
                                type="time"
                                value={timing.open}
                                onChange={(e) => setShopTiming(prev => ({
                                  ...prev,
                                  [day]: { ...prev[day as keyof ShopTiming], open: e.target.value }
                                }))}
                                className="text-sm font-semibold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <span className="text-gray-400">-</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Closes:</span>
                              <input
                                type="time"
                                value={timing.close}
                                onChange={(e) => setShopTiming(prev => ({
                                  ...prev,
                                  [day]: { ...prev[day as keyof ShopTiming], close: e.target.value }
                                }))}
                                className="text-sm font-semibold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500 dark:text-gray-400 font-medium flex-1">
                            Shop Closed
                          </span>
                        )}
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!timing.closed}
                          onChange={(e) => setShopTiming(prev => ({
                            ...prev,
                            [day]: { ...prev[day as keyof ShopTiming], closed: !e.target.checked }
                          }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-xl">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-3 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
                      Important Note
                    </h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      These timings will be displayed on your customer-facing web app. Make sure to keep them updated, especially during holidays or special occasions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'payment' && (
          <div className="space-y-6">
            <div className="card p-6 shadow-large">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                  <CreditCard className="h-5 w-5 mr-2" />
                  Payment Information
                </h3>
                <button
                  onClick={savePaymentInfo}
                  disabled={isSaving}
                  className="btn-primary shadow-large hover:shadow-xl disabled:opacity-50"
                >
                  {isSaving ? (
                    <div className="flex items-center">
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Save className="h-4 w-4 mr-2" />
                      Save Payment Info
                    </div>
                  )}
                </button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="form-group">
                    <label className="form-label">UPI ID</label>
                    <input
                      type="text"
                      value={paymentInfo.upiId}
                      onChange={(e) => setPaymentInfo(prev => ({ ...prev, upiId: e.target.value }))}
                      placeholder="yourname@paytm"
                      className="input cursor-visible"
                      autoComplete="off"
                      spellCheck="false"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Bank Name</label>
                    <input
                      type="text"
                      value={paymentInfo.bankName}
                      onChange={(e) => setPaymentInfo(prev => ({ ...prev, bankName: e.target.value }))}
                      placeholder="State Bank of India"
                      className="input cursor-visible"
                      autoComplete="off"
                      spellCheck="false"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Account Holder Name</label>
                    <input
                      type="text"
                      value={paymentInfo.accountHolderName}
                      onChange={(e) => setPaymentInfo(prev => ({ ...prev, accountHolderName: e.target.value }))}
                      placeholder="Full name as per bank records"
                      className="input cursor-visible"
                      autoComplete="off"
                      spellCheck="false"
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="form-group">
                    <label className="form-label">Account Number</label>
                    <div className="relative">
                      <input
                        type={showSensitiveData ? 'text' : 'password'}
                        value={paymentInfo.accountNumber}
                        onChange={(e) => setPaymentInfo(prev => ({ ...prev, accountNumber: e.target.value }))}
                        placeholder="Bank account number"
                        className="input cursor-visible pr-20"
                        autoComplete="off"
                        spellCheck="false"
                      />
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
                        <button
                          type="button"
                          onClick={() => setShowSensitiveData(!showSensitiveData)}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {showSensitiveData ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        {paymentInfo.accountNumber && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(paymentInfo.accountNumber, 'account')}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            {copied === 'account' ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">IFSC Code</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={paymentInfo.ifscCode}
                        onChange={(e) => setPaymentInfo(prev => ({ ...prev, ifscCode: e.target.value.toUpperCase() }))}
                        placeholder="SBIN0001234"
                        className="input cursor-visible pr-10"
                        autoComplete="off"
                        spellCheck="false"
                      />
                      {paymentInfo.ifscCode && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(paymentInfo.ifscCode, 'ifsc')}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {copied === 'ifsc' ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <QRUploader />
          </div>
        )}

        {activeTab === 'business' && (
          <div className="space-y-6">
            <div className="card p-6 shadow-large">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Business Details
                </h3>
                <button
                  onClick={saveBusinessDetails}
                  disabled={isSaving}
                  className="btn-primary shadow-large hover:shadow-xl disabled:opacity-50"
                >
                  {isSaving ? (
                    <div className="flex items-center">
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Save className="h-4 w-4 mr-2" />
                      Save Business Details
                    </div>
                  )}
                </button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="form-group">
                    <label className="form-label">Business Type</label>
                    <select
                      value={businessDetails.businessType}
                      onChange={(e) => setBusinessDetails(prev => ({ ...prev, businessType: e.target.value }))}
                      className="input cursor-pointer"
                    >
                      <option value="">Select business type</option>
                      <option value="sole_proprietorship">Sole Proprietorship</option>
                      <option value="partnership">Partnership</option>
                      <option value="private_limited">Private Limited Company</option>
                      <option value="llp">Limited Liability Partnership</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Owner Name</label>
                    <input
                      type="text"
                      value={businessDetails.ownerName}
                      onChange={(e) => setBusinessDetails(prev => ({ ...prev, ownerName: e.target.value }))}
                      placeholder="Business owner full name"
                      className="input cursor-visible"
                      autoComplete="off"
                      spellCheck="false"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Established Year</label>
                    <input
                      type="number"
                      min="1900"
                      max={new Date().getFullYear()}
                      value={businessDetails.establishedYear}
                      onChange={(e) => setBusinessDetails(prev => ({ ...prev, establishedYear: e.target.value }))}
                      placeholder="2020"
                      className="input cursor-visible"
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="form-group">
                    <label className="form-label">GST Number</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={businessDetails.gstNumber}
                        onChange={(e) => setBusinessDetails(prev => ({ ...prev, gstNumber: e.target.value.toUpperCase() }))}
                        placeholder="22AAAAA0000A1Z5"
                        className="input cursor-visible pr-10"
                        autoComplete="off"
                        spellCheck="false"
                      />
                      {businessDetails.gstNumber && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(businessDetails.gstNumber, 'gst')}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {copied === 'gst' ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">PAN Number</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={businessDetails.panNumber}
                        onChange={(e) => setBusinessDetails(prev => ({ ...prev, panNumber: e.target.value.toUpperCase() }))}
                        placeholder="AAAAA0000A"
                        className="input cursor-visible pr-10"
                        autoComplete="off"
                        spellCheck="false"
                      />
                      {businessDetails.panNumber && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(businessDetails.panNumber, 'pan')}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {copied === 'pan' ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Registration Number</label>
                    <input
                      type="text"
                      value={businessDetails.registrationNumber}
                      onChange={(e) => setBusinessDetails(prev => ({ ...prev, registrationNumber: e.target.value }))}
                      placeholder="Business registration number"
                      className="input cursor-visible"
                      autoComplete="off"
                      spellCheck="false"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'qr' && (
          <div className="space-y-6">
            <QRGenerator />
          </div>
        )}

        {activeTab === 'webapp' && (
          <div className="space-y-6">
            {/* Supabase Connection Status */}
            <div className="card p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-blue-200 dark:border-blue-800 shadow-large">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center shadow-soft mr-3">
                    <Database className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300">Supabase Database</h3>
                    <p className="text-blue-600 dark:text-blue-400">Real-time database connection status</p>
                  </div>
                </div>
                
                <div className={`flex items-center px-4 py-2 rounded-lg ${
                  connectionStatus.isConnected 
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                }`}>
                  {connectionStatus.testing ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : connectionStatus.isConnected ? (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 mr-2" />
                  )}
                  <span className="font-medium">
                    {connectionStatus.testing ? 'Testing...' : connectionStatus.isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
              
              {connectionStatus.isConnected && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-soft">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                    <span className="text-gray-900 dark:text-white font-medium text-sm">Real-time sync active</span>
                  </div>
                  <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-soft">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                    <span className="text-gray-900 dark:text-white font-medium text-sm">File storage ready</span>
                  </div>
                  <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-soft">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                    <span className="text-gray-900 dark:text-white font-medium text-sm">Web app integration</span>
                  </div>
                </div>
              )}
              
              {connectionStatus.error && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-red-600 mr-3 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800 dark:text-red-300">Connection Failed</p>
                      <p className="text-sm text-red-700 dark:text-red-400 mt-1">{connectionStatus.error}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <WebAppConnection />
          </div>
        )}

        {activeTab === 'legal' && (
          <div className="space-y-6">
            <div className="card p-6 shadow-large">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                <Scale className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                Legal & Policies
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { to: '/about', label: 'About Us', desc: 'Learn more about PrintGet', icon: Info, color: 'blue' },
                  { to: '/terms', label: 'Terms & Conditions', desc: 'Usage rules for shop owners', icon: FileText, color: 'indigo' },
                  { to: '/privacy', label: 'Privacy Policy', desc: 'How we handle your data', icon: ShieldCheck, color: 'green' },
                  { to: '/refund-policy', label: 'Refund Policy', desc: 'Guidelines for customer refunds', icon: RefreshCw, color: 'orange' },
                  { to: '/cookie-policy', label: 'Cookie Policy', desc: 'Local storage and cache usage', icon: Database, color: 'purple' },
                  { to: '/contact', label: 'Partner Support', desc: 'Get help with your shop', icon: HelpCircle, color: 'rose' },
                ].map((item) => (
                  <Link 
                    key={item.to}
                    to={item.to} 
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl transition-all group shadow-sm hover:shadow-md hover:-translate-y-0.5"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform bg-${item.color}-100 dark:bg-${item.color}-900/30 text-${item.color}-600 dark:text-${item.color}-400`}>
                        <item.icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{item.label}</h4>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{item.desc}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Settings;