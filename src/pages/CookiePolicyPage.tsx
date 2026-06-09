import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';

const CookiePolicyPage = () => {
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
            <div className="max-w-3xl mx-auto px-6 py-10 mt-4">
                <div className="mb-10 text-center">
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">Cookie & Local Storage Policy</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Last updated: {new Date().toLocaleDateString()}</p>
                </div>

                <div className="card divide-y divide-gray-100 dark:divide-gray-700">
                    <div className="p-6 sm:p-8">
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                            This Policy explains how the <strong className="text-gray-800 dark:text-gray-100">PrintGet Desktop App</strong> uses local storage, cache, and session data. 
                            Unlike web browsers, this is a local application, and we store settings directly on your machine to ensure smooth operation.
                        </p>
                    </div>

                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">1. What We Store Locally</h2>
                        <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                            <li className="flex gap-2">
                                <span className="text-blue-400 dark:text-blue-500 shrink-0">•</span>
                                <div>
                                    <strong className="text-gray-800 dark:text-gray-100 block">Authentication Tokens</strong>
                                    Stored securely to keep you logged in to your shop dashboard.
                                </div>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-400 dark:text-blue-500 shrink-0">•</span>
                                <div>
                                    <strong className="text-gray-800 dark:text-gray-100 block">Printer Configurations</strong>
                                    We save your default printer, pricing settings, and margin configurations so you don't have to enter them every time.
                                </div>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-400 dark:text-blue-500 shrink-0">•</span>
                                <div>
                                    <strong className="text-gray-800 dark:text-gray-100 block">UI Preferences</strong>
                                    Details like sidebar collapse state and local preferences.
                                </div>
                            </li>
                        </ul>
                    </div>

                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">2. Temporary Files & Cache</h2>
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl p-4">
                            <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
                                <strong>Customer PDF Files:</strong> When a customer submits an order, the PDF is temporarily downloaded into a hidden system temp folder to send to your printer. 
                                These files are <strong>automatically purged</strong> shortly after the print job runs to protect customer privacy and save your disk space.
                            </p>
                        </div>
                    </div>

                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">3. Managing Data</h2>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                            You can clear your local session at any time by simply logging out of the application. 
                            Note that uninstalling the app will clear the local storage data entirely.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CookiePolicyPage;
