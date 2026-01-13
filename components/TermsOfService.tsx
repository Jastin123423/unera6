
import React from 'react';

export const TermsOfServicePage: React.FC<{ onNavigateHome: () => void }> = ({ onNavigateHome }) => {
    return (
        <div className="w-full min-h-screen bg-[#18191A] font-sans text-[#E4E6EB] pb-20">
            {/* Header */}
            <div className="bg-[#242526] border-b border-[#3E4042] sticky top-0 z-50 shadow-sm">
                <div className="max-w-[1000px] mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={onNavigateHome}>
                        <i className="fas fa-globe-americas text-[#1877F2] text-2xl"></i>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-[#1877F2] to-[#1D8AF2] text-transparent bg-clip-text">UNERA Terms</h1>
                    </div>
                    <button onClick={onNavigateHome} className="text-[#B0B3B8] hover:text-[#E4E6EB] font-semibold text-sm transition-colors">Back to Home</button>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-[800px] mx-auto px-4 py-8 animate-fade-in">
                <div className="mb-8 border-b border-[#3E4042] pb-6">
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Terms of Service</h1>
                    <p className="text-[#B0B3B8]">Effective Date: February 14, 2025</p>
                </div>

                <div className="space-y-10 text-[16px] leading-relaxed text-[#D0D2D6]">
                    <div className="bg-[#263951] p-4 rounded-lg border border-[#2D88FF]/30 text-sm">
                        <strong>Note:</strong> By accessing or using the UNERA Platform, you agree to be bound by these Terms. If you disagree with any part of the terms, then you may not access the Service.
                    </div>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">1. Accounts</h2>
                        <p>When you create an account with us, you must provide us information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.</p>
                        <p className="mt-2">You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password, whether your password is with our Service or a third-party service.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">2. Content</h2>
                        <p className="mb-3">Our Service allows you to post, link, store, share and otherwise make available certain information, text, graphics, videos, or other material ("Content"). You are responsible for the Content that you post to the Service, including its legality, reliability, and appropriateness.</p>
                        <div className="bg-[#242526] p-4 rounded-lg border border-[#3E4042]">
                            <h4 className="font-bold text-[#E4E6EB] mb-2">Prohibited Content:</h4>
                            <ul className="list-disc list-inside space-y-1 text-[#B0B3B8] text-sm">
                                <li>Hate speech or discrimination</li>
                                <li>Violence or incitement to violence</li>
                                <li>Nudity or sexual activity</li>
                                <li>Spam, scams, or misleading information</li>
                                <li>Illegal activities or goods</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">3. Intellectual Property</h2>
                        <p>The Service and its original content (excluding Content provided by users), features and functionality are and will remain the exclusive property of UNERA and its licensors. The Service is protected by copyright, trademark, and other laws of both the Tanzania and foreign countries.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">4. Links To Other Web Sites</h2>
                        <p>Our Service may contain links to third-party web sites or services that are not owned or controlled by UNERA.</p>
                        <p className="mt-2">UNERA has no control over, and assumes no responsibility for, the content, privacy policies, or practices of any third-party web sites or services. You further acknowledge and agree that UNERA shall not be responsible or liable, directly or indirectly, for any damage or loss caused or alleged to be caused by or in connection with use of or reliance on any such content, goods or services available on or through any such web sites or services.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">5. Termination</h2>
                        <p>We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.</p>
                        <p className="mt-2">Upon termination, your right to use the Service will immediately cease. If you wish to terminate your account, you may simply discontinue using the Service.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">6. Limitation Of Liability</h2>
                        <p>In no event shall UNERA, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from (i) your access to or use of or inability to access or use the Service; (ii) any conduct or content of any third party on the Service; (iii) any content obtained from the Service; and (iv) unauthorized access, use or alteration of your transmissions or content.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">7. Changes</h2>
                        <p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material we will try to provide at least 30 days notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">8. Contact Us</h2>
                        <p>If you have any questions about these Terms, please contact us:</p>
                        <div className="mt-4 p-4 bg-[#242526] rounded-lg border border-[#3E4042] inline-block">
                            <p className="text-[#E4E6EB] font-semibold"><i className="fas fa-envelope mr-2"></i> legal@unera.social</p>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};
