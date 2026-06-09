import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';

const TermsPage = () => {
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
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">Terms & Conditions</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">For Print Shops</p>
                </div>

                <div className="card divide-y divide-gray-100 dark:divide-gray-700">
                    <div className="p-6 sm:p-8">
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                            Welcome to the <strong className="text-gray-800 dark:text-gray-100">PrintGet Shop Network</strong>. 
                            These Terms & Conditions ("Terms") govern your use of the PrintGet Desktop App and seller platform. By operating your shop through this software, you agree to these terms.
                        </p>
                    </div>

                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">1. Platform Role</h2>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                            PrintGet acts as an intermediary connecting customers needing print services with local print shops (you). We provide the software (this desktop app) to receive orders and manage files. We are not responsible for hardware issues, paper quality, or the physical operation of your shop.
                        </p>
                    </div>

                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">2. Shop Responsibilities</h2>
                        <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                            <li><strong>Order Fulfillment:</strong> You agree to print orders promptly once they appear in the PrintGet app queue.</li>
                            <li><strong>Quality Control:</strong> Your shop must maintain adequate hardware, ink, and paper to fulfill orders in the quality requested by the customer.</li>
                            <li><strong>Status Updates:</strong> It is your responsibility to monitor the app to ensure your shop is marked "Offline" if you are closed or out of supplies.</li>
                        </ul>
                    </div>

                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">3. Payments & Settlement</h2>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                            Transactions are processed centrally. PrintGet will remit earnings to your registered bank account/UPI ID according to the agreed payout schedule. Small platform handling fees are deducted before settlement as per your vendor agreement.
                        </p>
                    </div>

                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">4. Software License</h2>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                            You are granted a limited, non-exclusive license to use this Desktop printing application solely for fulfilling PrintGet orders. Reverse engineering, duplicating, or using its underlying printing algorithms for non-PrintGet business is strictly prohibited.
                        </p>
                    </div>

                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">5. Termination</h2>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                            We reserve the right to suspend or remove your shop from the network if you consistently fail to fulfill orders, accumulate high refund requests, or violate platform standards.
                        </p>
                    </div>

                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">6. Limitation of Liability</h2>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                            PrintGet shall not be liable for any indirect, incidental, or consequential damages arising from the use of the software, including but not limited to loss of revenue, hardware damage, or data loss. Our total liability in any matter related to the services shall not exceed the fees paid by your shop in the preceding one (1) month.
                        </p>
                    </div>

                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">7. Eligibility</h2>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                            To use the PrintGet Shop Partner platform, you must be a legally registered business entity or sole proprietorship operating a physical print shop in India. The person creating the account must be at least 18 years of age and authorized to act on behalf of the business.
                        </p>
                    </div>

                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">8. Governing Law</h2>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                            These Terms are governed by and construed in accordance with the laws of India. Any disputes arising from or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts in Nashik, Maharashtra.
                        </p>
                    </div>

                    <div className="p-6 sm:p-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">9. Changes to These Terms</h2>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                            We may update these Terms from time to time. When significant changes are made, we will notify you via the desktop app or email. Continued use of the PrintGet application after changes have been communicated constitutes your acceptance of the revised Terms.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TermsPage;
