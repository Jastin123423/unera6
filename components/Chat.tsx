
import React, { useState, useEffect, useRef } from 'react';
import { User, Message } from '../types';
import { StickerPicker, EmojiPicker } from './Pickers';

const apiFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('unera_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) throw new Error("API Error");
    return res.json();
};

export const ChatWindow: React.FC<{ currentUser: User; recipient: User; messages: Message[]; onClose: () => void; onSendMessage: (t: string, s?: string) => void; }> = ({ currentUser, recipient, onClose }) => {
    const [inputText, setInputText] = useState('');
    const [msgs, setMsgs] = useState<Message[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const fetchHistory = async () => {
        try {
            // Find conversation ID first (mock logic for simplicity here, but using real endpoints)
            const conversations = await apiFetch('/api/messages/conversations');
            const conv = conversations.find((c: any) => c.recipient_id === recipient.id);
            if (conv) {
                const history = await apiFetch(`/api/messages/conversations/${conv.id}`);
                setMsgs(history);
            }
        } catch (e) {}
    };

    useEffect(() => {
        fetchHistory();
        const interval = setInterval(fetchHistory, 5000); // Polling for new messages
        return () => clearInterval(interval);
    }, [recipient.id]);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim()) return;
        try {
            const data = await apiFetch('/api/messages/send', {
                method: 'POST',
                body: JSON.stringify({ recipient_id: recipient.id, text_content: inputText })
            });
            setMsgs([...msgs, data]);
            setInputText('');
        } catch (e) { alert("Failed to send"); }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col font-sans">
            <div className="flex items-center justify-between px-3 py-2 bg-[#202c33] h-16 shadow-md">
                <div className="flex items-center gap-3">
                    <i className="fas fa-arrow-left text-[#E4E6EB] text-xl cursor-pointer" onClick={onClose}></i>
                    <img src={recipient.profile_image_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                    <div>
                        <h4 className="font-semibold text-white leading-tight">{recipient.name}</h4>
                        <span className="text-[13px] text-[#8696a0]">online</span>
                    </div>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 bg-[#0b141a]">
                {msgs.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] px-3 py-1.5 rounded-lg text-[17px] ${msg.sender_id === currentUser.id ? 'bg-[#005c4b] text-white rounded-tr-none' : 'bg-[#202c33] text-white rounded-tl-none'}`}>
                            {msg.text_content}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form className="p-2 bg-[#202c33] flex items-center gap-2" onSubmit={handleSubmit}>
                <input type="text" value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Message" className="flex-1 bg-[#2a3942] rounded-lg px-4 py-2 text-white outline-none" />
                <button type="submit" className="bg-[#00a884] w-10 h-10 rounded-full flex items-center justify-center text-white"><i className="fas fa-paper-plane"></i></button>
            </form>
        </div>
    );
};
