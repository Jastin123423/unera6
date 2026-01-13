
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";

interface Tool {
    id: string;
    name: string;
    icon: string;
    category: 'PDF Tools' | 'AI Tools' | 'Image & Other' | 'You May Like';
    color: string;
    description: string;
    accept?: string;
}

const ALL_TOOLS: Tool[] = [
    // PDF Tools
    { id: 'pdf-edit', name: 'PDF Edit', icon: 'fas fa-pen-square', category: 'PDF Tools', color: '#E41E3F', description: 'Add text, shapes, and signatures to your PDF.', accept: '.pdf' },
    { id: 'pdf-to-word', name: 'PDF to Word', icon: 'fas fa-file-word', category: 'PDF Tools', color: '#2D88FF', description: 'Convert PDF documents to editable Word files.', accept: '.pdf' },
    { id: 'pdf-password', name: 'PDF Password', icon: 'fas fa-lock', category: 'PDF Tools', color: '#F7B928', description: 'Protect your PDF with a password.', accept: '.pdf' },
    { id: 'pdf-annotation', name: 'PDF Annotation', icon: 'fas fa-highlighter', category: 'PDF Tools', color: '#E41E3F', description: 'Highlight and annotate PDF text.', accept: '.pdf' },
    { id: 'pdf-to-ppt', name: 'PDF to PPT', icon: 'fas fa-file-powerpoint', category: 'PDF Tools', color: '#F02849', description: 'Convert PDF slides to PowerPoint presentations.', accept: '.pdf' },
    { id: 'pdf-to-excel', name: 'PDF to Excel', icon: 'fas fa-file-excel', category: 'PDF Tools', color: '#45BD62', description: 'Extract PDF tables to Excel spreadsheets.', accept: '.pdf' },
    { id: 'merge-pdf', name: 'Merge PDF', icon: 'fas fa-object-group', category: 'PDF Tools', color: '#E41E3F', description: 'Combine multiple PDFs into one file.', accept: '.pdf' },
    { id: 'pdf-signature', name: 'PDF Signature', icon: 'fas fa-signature', category: 'PDF Tools', color: '#2D88FF', description: 'Sign your PDF documents digitally.', accept: '.pdf' },
    { id: 'word-to-pdf', name: 'Word to PDF', icon: 'fas fa-file-alt', category: 'PDF Tools', color: '#2D88FF', description: 'Convert Word documents to PDF.', accept: '.doc,.docx' },
    { id: 'image-to-pdf', name: 'Image to PDF', icon: 'fas fa-file-image', category: 'PDF Tools', color: '#F7B928', description: 'Convert JPG/PNG images to PDF.', accept: 'image/*' },
    { id: 'ppt-to-pdf', name: 'PPT to PDF', icon: 'fas fa-file-powerpoint', category: 'PDF Tools', color: '#F02849', description: 'Convert PowerPoint slides to PDF.', accept: '.ppt,.pptx' },
    { id: 'excel-to-pdf', name: 'Excel to PDF', icon: 'fas fa-file-excel', category: 'PDF Tools', color: '#45BD62', description: 'Convert Excel sheets to PDF.', accept: '.xls,.xlsx' },
    { id: 'split-pdf', name: 'Split PDF', icon: 'fas fa-cut', category: 'PDF Tools', color: '#E41E3F', description: 'Extract pages from a PDF.', accept: '.pdf' },
    { id: 'pdf-numbering', name: 'PDF Numbering', icon: 'fas fa-list-ol', category: 'PDF Tools', color: '#2D88FF', description: 'Add page numbers to your PDF.', accept: '.pdf' },
    
    // Image & Other
    { id: 'image-resize', name: 'Image Resize', icon: 'fas fa-compress-arrows-alt', category: 'Image & Other', color: '#1877F2', description: 'Resize images to specific dimensions.', accept: 'image/*' },
    { id: 'scanner', name: 'Scanner', icon: 'fas fa-camera', category: 'Image & Other', color: '#242526', description: 'Scan documents using your camera.', accept: 'image/*' },
    
    // AI Tools
    { id: 'ai-chat', name: 'AI Assistant', icon: 'fas fa-robot', category: 'AI Tools', color: '#A033FF', description: 'Chat with UNERA AI Assistant powered by Gemini.', accept: '' },
    { id: 'ai-summary', name: 'AI Summary', icon: 'fas fa-file-alt', category: 'AI Tools', color: '#45BD62', description: 'Summarize long documents with AI.', accept: '.pdf,.txt,.doc' },
];

const AIChatInterface: React.FC = () => {
    const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, isTyping]);

    const handleSend = async () => {
        if (!input.trim() || isTyping) return;
        
        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsTyping(true);

        try {
            // Using the exclusive environment variable API_KEY
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: userMsg,
                config: {
                    systemInstruction: "You are the UNERA AI Assistant, a core part of the UNERA Social Network. You help users with their tasks, technical questions, and social interactions. You are helpful, professional, and friendly. Always refer to the user as a valued member of the UNERA community."
                }
            });
            
            // Extracting text directly from property as per guidelines
            const modelText = response.text || "I'm sorry, I couldn't process that request.";
            setMessages(prev => [...prev, { role: 'model', text: modelText }]);
        } catch (error) {
            console.error("AI Error:", error);
            setMessages(prev => [...prev, { role: 'model', text: "I'm having trouble connecting to my brain right now. Please make sure the UNERA AI service is active." }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="flex flex-col h-[500px] bg-[#18191A]">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-50 px-6">
                        <div className="w-16 h-16 rounded-3xl bg-[#A033FF]/10 flex items-center justify-center mb-4">
                            <i className="fas fa-robot text-3xl text-[#A033FF]"></i>
                        </div>
                        <p className="text-sm font-bold text-white mb-1">Hello! I'm your UNERA Assistant</p>
                        <p className="text-xs text-[#B0B3B8]">Ask me anything about UNERA, or let me help you with a task.</p>
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-[#1877F2] text-white shadow-lg' : 'bg-[#3A3B3C] text-[#E4E6EB]'}`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-[#3A3B3C] p-3 rounded-2xl flex gap-1">
                            <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></div>
                            <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                            <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                        </div>
                    </div>
                )}
            </div>
            <div className="p-3 border-t border-[#3E4042] flex gap-2 bg-[#242526]">
                <input 
                    type="text" 
                    value={input} 
                    onChange={e => setInput(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder="Type a message..." 
                    className="flex-1 bg-[#3A3B3C] text-white rounded-full px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-[#1877F2] placeholder-[#B0B3B8]" 
                />
                <button 
                    onClick={handleSend} 
                    disabled={!input.trim() || isTyping}
                    className="w-10 h-10 bg-[#1877F2] text-white rounded-full flex items-center justify-center hover:bg-[#166FE5] disabled:opacity-50 transition-all active:scale-90"
                >
                    <i className="fas fa-paper-plane text-sm"></i>
                </button>
            </div>
        </div>
    );
};

interface ToolModalProps {
    tool: Tool;
    onClose: () => void;
}

const ToolModal: React.FC<ToolModalProps> = ({ tool, onClose }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setIsComplete(false);
        }
    };

    const handleProcess = () => {
        if (!file && tool.accept) return;
        setIsProcessing(true);
        setTimeout(() => {
            setIsProcessing(false);
            setIsComplete(true);
        }, 2500);
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
            <div className={`bg-[#242526] w-full ${tool.id === 'ai-chat' ? 'max-w-[500px]' : 'max-w-[400px]'} rounded-3xl border border-[#3E4042] shadow-2xl overflow-hidden flex flex-col relative animate-slide-up`}>
                
                <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 bg-[#3A3B3C] rounded-full flex items-center justify-center text-[#B0B3B8] hover:text-white hover:bg-[#4E4F50] transition-colors z-10">
                    <i className="fas fa-times"></i>
                </button>

                {tool.id === 'ai-chat' ? (
                    <>
                        <div className="p-4 border-b border-[#3E4042] bg-[#242526] flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#3A3B3C] flex items-center justify-center">
                                <i className={`${tool.icon} text-lg`} style={{ color: tool.color }}></i>
                            </div>
                            <div>
                                <h2 className="font-bold text-white text-[16px]">{tool.name}</h2>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-[#45BD62] animate-pulse"></div>
                                    <span className="text-[11px] text-[#B0B3B8] font-medium uppercase">Active</span>
                                </div>
                            </div>
                        </div>
                        <AIChatInterface />
                    </>
                ) : (
                    <>
                        <div className="flex flex-col items-center pt-10 pb-6 px-6 text-center">
                            <div className="w-24 h-24 rounded-3xl bg-[#3A3B3C] flex items-center justify-center mb-4 shadow-xl border border-[#3E4042]">
                                <i className={`${tool.icon} text-[48px]`} style={{ color: tool.color }}></i>
                            </div>
                            <h2 className="text-2xl font-bold text-[#E4E6EB] mb-2">{tool.name}</h2>
                            <p className="text-[#B0B3B8] text-[15px] leading-relaxed max-w-[300px]">{tool.description}</p>
                        </div>

                        <div className="p-6 bg-[#18191A] border-t border-[#3E4042]">
                            {!isComplete ? (
                                <>
                                    {tool.accept && (
                                        <div 
                                            onClick={() => !isProcessing && fileInputRef.current?.click()}
                                            className={`border-2 border-dashed ${file ? 'border-[#45BD62] bg-[#45BD62]/10' : 'border-[#3E4042] hover:border-[#B0B3B8] hover:bg-[#3A3B3C]'} rounded-2xl p-8 text-center cursor-pointer transition-all mb-5`}
                                        >
                                            {file ? (
                                                <div className="flex flex-col items-center gap-2 text-[#E4E6EB]">
                                                    <i className="fas fa-file-circle-check text-3xl text-[#45BD62]"></i>
                                                    <span className="text-sm font-bold truncate max-w-[240px]">{file.name}</span>
                                                    <span className="text-[11px] text-[#B0B3B8] uppercase">Click to change file</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <i className="fas fa-cloud-arrow-up text-3xl text-[#1877F2]"></i>
                                                    <span className="text-[#E4E6EB] text-sm font-bold">Choose a file to start</span>
                                                    <span className="text-[11px] text-[#B0B3B8] uppercase">{tool.accept.replace('.', '')} format supported</span>
                                                </div>
                                            )}
                                            <input type="file" ref={fileInputRef} className="hidden" accept={tool.accept} onChange={handleFileChange} />
                                        </div>
                                    )}

                                    <button 
                                        onClick={handleProcess} 
                                        disabled={isProcessing || (!!tool.accept && !file)}
                                        className={`w-full py-4 rounded-2xl font-black text-[17px] transition-all flex items-center justify-center gap-3 ${
                                            isProcessing || (!!tool.accept && !file)
                                            ? 'bg-[#3A3B3C] text-[#B0B3B8] cursor-not-allowed' 
                                            : 'bg-[#1877F2] text-white hover:bg-[#166FE5] shadow-xl hover:shadow-blue-500/20 active:scale-95'
                                        }`}
                                    >
                                        {isProcessing ? (
                                            <>
                                                <i className="fas fa-circle-notch fa-spin"></i> Processing...
                                            </>
                                        ) : (
                                            'Run Tool'
                                        )}
                                    </button>
                                </>
                            ) : (
                                <div className="text-center animate-fade-in py-4">
                                    <div className="w-20 h-20 bg-[#45BD62]/20 text-[#45BD62] rounded-full flex items-center justify-center text-4xl mx-auto mb-4 border border-[#45BD62]/50 shadow-inner">
                                        <i className="fas fa-check"></i>
                                    </div>
                                    <h3 className="text-[#E4E6EB] font-black text-xl mb-1">Task Completed!</h3>
                                    <p className="text-[#B0B3B8] text-sm mb-8 px-4">The operation was successful and your result is ready.</p>
                                    <button 
                                        onClick={() => { setIsComplete(false); setFile(null); onClose(); }} 
                                        className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white py-4 rounded-2xl font-black transition-all shadow-xl active:scale-95"
                                    >
                                        Save Result
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export const ToolsPage: React.FC = () => {
    const [activeTool, setActiveTool] = useState<Tool | null>(null);

    const categories = ['You May Like', 'AI Tools', 'PDF Tools', 'Image & Other'];

    const getToolsByCategory = (cat: string) => {
        if (cat === 'You May Like') {
            return ALL_TOOLS.filter(t => ['pdf-to-word', 'ai-chat', 'scanner', 'image-resize'].includes(t.id));
        }
        return ALL_TOOLS.filter(t => t.category === cat);
    };

    return (
        <div className="w-full max-w-[800px] mx-auto min-h-screen bg-[#18191A] font-sans pb-24">
            <div className="sticky top-14 bg-[#18191A]/95 backdrop-blur-md z-30 px-5 py-5 border-b border-[#3E4042]">
                <h1 className="text-3xl font-black text-white tracking-tight">UNERA Tools</h1>
                <p className="text-[#B0B3B8] text-sm mt-1 font-medium">Smart utilities for your everyday productivity.</p>
            </div>

            <div className="p-4 space-y-8 mt-2">
                {categories.map(cat => {
                    const tools = getToolsByCategory(cat);
                    if (tools.length === 0) return null;

                    return (
                        <div key={cat} className="animate-fade-in">
                            <div className="flex items-center gap-3 mb-4 px-1">
                                <h3 className="text-[#E4E6EB] font-black text-sm uppercase tracking-widest">{cat}</h3>
                                <div className="h-px flex-1 bg-[#3E4042]"></div>
                            </div>
                            <div className="bg-[#242526] rounded-3xl p-5 border border-[#3E4042] shadow-sm">
                                <div className="grid grid-cols-4 sm:grid-cols-4 gap-y-8 gap-x-4">
                                    {tools.map(tool => (
                                        <div 
                                            key={tool.id} 
                                            className="flex flex-col items-center cursor-pointer group"
                                            onClick={() => setActiveTool(tool)}
                                        >
                                            <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-[#3A3B3C] group-hover:bg-[#4E4F50] group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-300 mb-2.5 relative shadow-lg">
                                                <i className={`${tool.icon} text-[28px]`} style={{ color: tool.color }}></i>
                                            </div>
                                            <span className="text-[#E4E6EB] text-[12px] font-bold text-center leading-tight line-clamp-2 px-1">
                                                {tool.name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="px-5 mt-10 opacity-30 text-center">
                <i className="fas fa-shield-halved text-2xl mb-2"></i>
                <p className="text-[10px] uppercase font-black tracking-[0.2em]">UNERA Secure Tool Ecosystem</p>
            </div>

            {activeTool && <ToolModal tool={activeTool} onClose={() => setActiveTool(null)} />}
        </div>
    );
};
