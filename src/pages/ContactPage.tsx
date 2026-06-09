import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft, Mail, Clock, MessageCircle } from 'lucide-react';

const ContactPage = () => {
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
                {/* Title */}
                <div className="mb-10 text-center">
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">Partner Support</h1>
                    <p className="text-gray-500 dark:text-gray-400">We're here to help you run your shop smoothly.</p>
                </div>

                {/* Main Card */}
                <div className="card divide-y divide-gray-100 dark:divide-gray-700">
                    {/* Email - Primary */}
                    <div className="p-6 sm:p-8">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center shrink-0 shadow-large">
                                <Mail className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Email Support</h2>
                                <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">For shop owners, priority support is available via email.</p>
                                <a
                                    href="mailto:support@printget.in"
                                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold text-lg transition-colors"
                                >
                                    support@printget.in
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Response Time & Tips */}
                    <div className="p-6 sm:p-8">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Clock className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Response Time</h3>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    We prioritize shop partners and respond within <strong className="text-gray-800 dark:text-gray-200">12–24 hours</strong>.
                                </p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <MessageCircle className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Helpful Tips</h3>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Include your <strong className="text-gray-800 dark:text-gray-200">Shop ID</strong> when contacting us for faster resolution.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* What to contact about */}
                    <div className="p-6 sm:p-8">
                        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">You can reach out to us for:</h3>
                        <div className="space-y-2">
                            {[
                                'Setup and installation issues',
                                'Printer configuration help',
                                'Payment and settlement questions',
                                'Disputes regarding customer orders',
                                'App bugs or feature requests',
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-400">
                                    <div className="w-1.5 h-1.5 bg-blue-400 dark:bg-blue-500 rounded-full shrink-0" />
                                    {item}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Registered Address */}
                    <div className="p-6 sm:p-8 bg-gray-50/50 dark:bg-gray-800/50">
                        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Registered Business Address</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                            PrintGet<br />
                            Adgaon, Nashik, Maharashtra 422003<br />
                            India
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                            Note: This is a registered correspondence address. We do not offer walk-in support.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContactPage;
