import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft, Store, Zap, Shield, MapPin, Upload } from 'lucide-react';

const AboutPage = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-16">
            {/* Header */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 w-full px-6 py-4 flex items-center justify-between shadow-soft">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                    <span className="font-medium">Back</span>
                </button>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center shadow-soft">
                        <Printer className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-bold text-gray-900 dark:text-white">
                        Print<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-500 text-gradient-primary">Get</span>
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-6 py-10 mt-4">
                {/* Hero */}
                <div className="mb-12 text-center">
                    <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-large">
                        <Printer className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
                        About Print<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-500 text-gradient-primary">Get</span>
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-lg max-w-lg mx-auto leading-relaxed">
                        A dedicated platform empowering print shops with modern tools.
                    </p>
                </div>

                {/* Story */}
                <div className="card divide-y divide-gray-100 dark:divide-gray-700">
                    {/* The Problem */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">The Problem We Saw</h2>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                            Print shops handle hundreds of documents a day. Often, customers send files via messaging apps, leading to lost files, confusion over print settings, and an overall chaotic management system. 
                        </p>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed mt-3">
                            Managing pending jobs, completed prints, and tracking revenue shouldn't require complex spreadsheets or mental notes. 
                        </p>
                    </div>

                    {/* The Solution */}
                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">What PrintGet Does For Your Shop</h2>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-5">
                            PrintGet connects you directly to customers. This desktop application provides you with a robust dashboard to manage print queues, track earnings, and execute print jobs instantly without manual file transfers.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 flex gap-3 border border-blue-100 dark:border-blue-800/30">
                                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-800 rounded-lg flex items-center justify-center shrink-0">
                                    <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Centralized Queue</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">All customer files appear here instantly.</p>
                                </div>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 flex gap-3 border border-blue-100 dark:border-blue-800/30">
                                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-800 rounded-lg flex items-center justify-center shrink-0">
                                    <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">1-Click Printing</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Directly print to local hardware without downloading manually.</p>
                                </div>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 flex gap-3 border border-blue-100 dark:border-blue-800/30">
                                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-800 rounded-lg flex items-center justify-center shrink-0">
                                    <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Secure File Handling</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Files are auto-deleted after printing.</p>
                                </div>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 flex gap-3 border border-blue-100 dark:border-blue-800/30">
                                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-800 rounded-lg flex items-center justify-center shrink-0">
                                    <Store className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Digital Storefront</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Customers discover your shop online.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Built in India */}
                    <div className="p-6 sm:p-8 text-center bg-gray-50/50 dark:bg-gray-800/50">
                        <p className="text-2xl mb-2">🇮🇳</p>
                        <p className="text-gray-800 dark:text-gray-200 font-semibold">Built in India</p>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Because organizing print jobs shouldn't be a hassle.</p>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default AboutPage;
