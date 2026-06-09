import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';

const PrivacyPage = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-16">
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

            <div className="max-w-3xl mx-auto px-6 py-10 mt-4">
                <div className="mb-10 text-center">
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">Privacy Policy</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Last updated: {new Date().toLocaleDateString()}</p>
                </div>

                <div className="card divide-y divide-gray-100 dark:divide-gray-700">
                    <div className="p-6 sm:p-8">
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                            At <strong className="text-gray-800 dark:text-gray-100">PrintGet</strong>, data privacy is a top priority—especially because our platform handles customer documents.
                            This policy explains data handling specifically for shop owners using the PrintGet Shop Management Desktop App.
                        </p>
                    </div>

                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">1. Information We Collect from Shop Owners</h2>
                        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                            <li className="flex gap-2">
                                <span className="text-blue-400 shrink-0">•</span>
                                <span><strong className="text-gray-800 dark:text-gray-100">Shop Details:</strong> Name, address, location coordinates (to show customers), and contact information.</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-400 shrink-0">•</span>
                                <span><strong className="text-gray-800 dark:text-gray-100">Payment Info:</strong> Bank details or UPI IDs required strictly for transaction settlements.</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-400 shrink-0">•</span>
                                <span><strong className="text-gray-800 dark:text-gray-100">Hardware Info:</strong> Basic system data to ensure printing compatibility (e.g., connected printers).</span>
                            </li>
                        </ul>
                    </div>

                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">2. Customer Data & Document Handling</h2>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm mb-3">
                            When a customer sends a file to your shop, the following strict privacy rules apply:
                        </p>
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl p-4 space-y-3">
                            <div className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <strong>End-to-End Encryption:</strong> Files are transferred securely over HTTPS directly to the target machine running the PrintGet app.
                            </div>
                            <div className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <strong>Auto-Deletion:</strong> Once a print command is successfully executed, the downloaded file is automatically scrubbed from your local system cache within minutes.
                            </div>
                            <div className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <strong>No Local Archiving:</strong> Providing a safe print experience means the software prevents unintentional archiving of sensitive customer forms, IDs, or documents.
                            </div>
                        </div>
                    </div>

                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">3. Data Sharing</h2>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                            We do not sell, rent, or lease shop data or customer data. We only share transaction data with the respective payment processors handling the settlement of funds.
                        </p>
                    </div>

                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">4. Security</h2>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                            Access to this desktop application is secured via your shop's credentials. It is the shop owner's responsibility to ensure that the physical computer running the PrintGet software is kept secure and unauthorized individuals do not access the PrintGet dashboard.
                        </p>
                    </div>

                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">5. Data Retention</h2>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                            We retain your shop registration data for as long as your account remains active on the PrintGet platform. Customer print files are automatically purged from your local machine within minutes of the print job executing. Transaction records are retained for a period of 12 months for accounting and dispute resolution purposes, after which they are securely archived or deleted.
                        </p>
                    </div>

                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">6. Your Rights</h2>
                        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                            <li className="flex gap-2">
                                <span className="text-blue-400 shrink-0">•</span>
                                <span><strong className="text-gray-800 dark:text-gray-100">Access:</strong> You can request a copy of all personal and business data we hold about your shop at any time by contacting support.</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-400 shrink-0">•</span>
                                <span><strong className="text-gray-800 dark:text-gray-100">Correction:</strong> If any shop details are inaccurate, you can update them directly within the app settings or by contacting us.</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-400 shrink-0">•</span>
                                <span><strong className="text-gray-800 dark:text-gray-100">Deletion:</strong> You may request complete deletion of your shop data by emailing support@printget.in. Account deletion requests are processed within 30 days.</span>
                            </li>
                        </ul>
                    </div>

                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">7. Compliance</h2>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                            PrintGet operates in compliance with the Information Technology Act, 2000 and its applicable rules, including the IT (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011. We implement reasonable security practices and procedures to protect the personal and sensitive data of all users on the platform.
                        </p>
                    </div>

                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">8. Changes to This Policy</h2>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                            We may update this Privacy Policy periodically to reflect changes in our practices or legal requirements. Any significant changes will be communicated via the desktop app notification system or email. We encourage you to review this policy regularly. Continued use of PrintGet after changes constitutes acceptance of the updated policy.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPage;
