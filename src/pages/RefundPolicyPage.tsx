import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft, RefreshCw, AlertCircle, Clock } from 'lucide-react';

const RefundPolicyPage = () => {
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
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">Refund & Cancellation Policy</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Guidelines for Shop Operators</p>
                </div>

                <div className="card">
                    <div className="p-6 sm:p-8 space-y-8">
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                            As a print shop partner, understanding how customer refunds are processed is crucial. Since documents are physically printed (consuming ink and paper), cancellations and refunds are strictly governed.
                        </p>

                        {/* Section 1 */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white mb-3">
                                <Clock className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                                Cancellations
                            </h2>
                            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                <li><strong>Before Printing:</strong> If a customer requests cancellation and the print job has <em>not</em> been processed yet by your machine, the order can be marked cancelled.</li>
                                <li><strong>After Printing:</strong> If the file has already been printed, the order <strong>cannot be cancelled</strong> and no refund can be automatically issued through the platform, as physical materials have been consumed.</li>
                            </ul>
                        </div>

                        {/* Section 2 */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white mb-3">
                                <RefreshCw className="w-5 h-5 text-green-500 dark:text-green-400" />
                                Valid Refund Cases
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Customers can claim refunds in these scenarios which you must accommodate:</p>
                            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                <li>• <strong>Hardware Failure:</strong> Your machine jams, runs out of ink, or prints garbled text making the document illegible.</li>
                                <li>• <strong>Shop Closed:</strong> An order was accepted but the shop was physically closed upon customer pickup.</li>
                            </ul>
                        </div>

                        {/* Section 3 */}
                        <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-5 border border-red-100 dark:border-red-900/30">
                            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white mb-3">
                                <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
                                Non-Refundable Cases
                            </h2>
                            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                <li>• Customer uploaded a file with existing errors or wrong content.</li>
                                <li>• Customer selected the wrong settings (e.g., chose B&W instead of Color) but the app and printer executed exactly what was ordered.</li>
                                <li>• Customer never came to pick up the documents.</li>
                            </ul>
                        </div>

                        {/* Section 4 */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Dispute Processing</h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                If a refund dispute arises, the PrintGet admin team might contact you to verify machine status. Upon mutual agreement or proven technical failure, PrintGet will process the refund manually back to the customer's UPI account. Settlements related to refunded jobs will be deducted from your final payout.
                            </p>
                        </div>

                        {/* Section 5 */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-5 border border-blue-100 dark:border-blue-800/30">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Refund Timeline &amp; Method</h2>
                            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                <li>• <strong>Processing Time:</strong> Approved refunds are processed within <strong>5–7 business days</strong> from the date of approval.</li>
                                <li>• <strong>Refund Method:</strong> All refunds are credited back to the customer's <strong>original payment method</strong> (the UPI account used during the transaction).</li>
                                <li>• <strong>Partial Refunds:</strong> In cases of partial print failures (e.g., only some pages were illegible), a proportional refund may be issued based on the affected portion of the order.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RefundPolicyPage;
