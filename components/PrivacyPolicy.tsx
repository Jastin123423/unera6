
import React from 'react';

export const PrivacyPolicyPage: React.FC<{ onNavigateHome: () => void }> = ({ onNavigateHome }) => {
    return (
        <div className="w-full min-h-screen bg-[#18191A] font-sans text-[#E4E6EB] pb-20">
            {/* Header */}
            <div className="bg-[#242526] border-b border-[#3E4042] sticky top-0 z-50 shadow-sm">
                <div className="max-w-[1000px] mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={onNavigateHome}>
                        <i className="fas fa-globe-americas text-[#1877F2] text-2xl"></i>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-[#1877F2] to-[#1D8AF2] text-transparent bg-clip-text">UNERA Privacy</h1>
                    </div>
                    <button onClick={onNavigateHome} className="text-[#B0B3B8] hover:text-[#E4E6EB] font-semibold text-sm transition-colors">Back to Home</button>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-[800px] mx-auto px-4 py-8 animate-fade-in">
                <div className="mb-8 border-b border-[#3E4042] pb-6">
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Privacy Policy</h1>
                    <p className="text-[#B0B3B8]">Effective Date: February 14, 2025</p>
                </div>

                <div className="space-y-10 text-[16px] leading-relaxed text-[#D0D2D6]">
                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">1. Introduction</h2>
                        <p>Welcome to UNERA. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our website or use our application and tell you about your privacy rights and how the law protects you.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">2. Data We Collect</h2>
                        <p className="mb-3">We may collect, use, store and transfer different kinds of personal data about you which we have grouped together follows:</p>
                        <ul className="list-disc list-inside space-y-2 ml-2 text-[#B0B3B8]">
                            <li><strong>Identity Data:</strong> includes first name, last name, username or similar identifier, marital status, title, date of birth and gender.</li>
                            <li><strong>Contact Data:</strong> includes email address and telephone numbers.</li>
                            <li><strong>Technical Data:</strong> includes internet protocol (IP) address, your login data, browser type and version, time zone setting and location, browser plug-in types and versions, operating system and platform.</li>
                            <li><strong>Profile Data:</strong> includes your username and password, purchases or orders made by you, your interests, preferences, feedback and survey responses.</li>
                            <li><strong>Usage Data:</strong> includes information about how you use our website, products and services.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">3. How We Use Your Data</h2>
                        <p className="mb-3">We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:</p>
                        <div className="bg-[#242526] p-4 rounded-lg border border-[#3E4042]">
                            <ul className="space-y-3">
                                <li className="flex gap-3">
                                    <i className="fas fa-check-circle text-[#45BD62] mt-1"></i>
                                    <span>To register you as a new customer and provide the services you request.</span>
                                </li>
                                <li className="flex gap-3">
                                    <i className="fas fa-check-circle text-[#45BD62] mt-1"></i>
                                    <span>To manage our relationship with you including notifying you about changes to our terms or privacy policy.</span>
                                </li>
                                <li className="flex gap-3">
                                    <i className="fas fa-check-circle text-[#45BD62] mt-1"></i>
                                    <span>To enable you to partake in a prize draw, competition or complete a survey.</span>
                                </li>
                                <li className="flex gap-3">
                                    <i className="fas fa-check-circle text-[#45BD62] mt-1"></i>
                                    <span>To improve our website, products/services, marketing, customer relationships and experiences.</span>
                                </li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">4. Data Security</h2>
                        <p>We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorized way, altered or disclosed. In addition, we limit access to your personal data to those employees, agents, contractors and other third parties who have a business need to know.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">5. Data Retention</h2>
                        <p>We will only retain your personal data for as long as necessary to fulfill the purposes we collected it for, including for the purposes of satisfying any legal, accounting, or reporting requirements.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">6. Your Legal Rights</h2>
                        <p className="mb-3">Under certain circumstances, you have rights under data protection laws in relation to your personal data, including the right to:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-[#242526] p-4 rounded-lg border border-[#3E4042]">
                                <h3 className="font-bold text-[#1877F2] mb-1">Request Access</h3>
                                <p className="text-sm text-[#B0B3B8]">Request a copy of the personal data we hold about you.</p>
                            </div>
                            <div className="bg-[#242526] p-4 rounded-lg border border-[#3E4042]">
                                <h3 className="font-bold text-[#1877F2] mb-1">Request Correction</h3>
                                <p className="text-sm text-[#B0B3B8]">Correct any incomplete or inaccurate data we hold.</p>
                            </div>
                            <div className="bg-[#242526] p-4 rounded-lg border border-[#3E4042]">
                                <h3 className="font-bold text-[#1877F2] mb-1">Request Erasure</h3>
                                <p className="text-sm text-[#B0B3B8]">Ask us to delete or remove personal data where there is no good reason for us continuing to process it.</p>
                            </div>
                            <div className="bg-[#242526] p-4 rounded-lg border border-[#3E4042]">
                                <h3 className="font-bold text-[#1877F2] mb-1">Withdraw Consent</h3>
                                <p className="text-sm text-[#B0B3B8]">Withdraw consent at any time where we are relying on consent to process your personal data.</p>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">7. Contact Us</h2>
                        <p>If you have any questions about this privacy policy or our privacy practices, please contact us at:</p>
                        <div className="mt-4 p-4 bg-[#263951] rounded-lg border border-[#2D88FF]/30 inline-block">
                            <p className="text-[#E4E6EB] font-semibold"><i className="fas fa-envelope mr-2"></i> privacy@unera.social</p>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};
