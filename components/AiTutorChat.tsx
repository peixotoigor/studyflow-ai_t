import React, { useState, useEffect, useRef } from 'react';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    text: string;
}

interface AiTutorChatProps {
    isOpen: boolean;
    onClose: () => void;
    subject: string;
    topic: string;
    apiKey?: string;
    model?: string;
    onSaveNote?: (content: string, subject: string, topic: string) => void;
}

export const AiTutorChat: React.FC<AiTutorChatProps> = ({ isOpen, onClose, subject, topic, apiKey, model = 'gpt-4o-mini', onSaveNote }) => {
    const [messages, setMessages] = useState<Message[]>([
        { id: 'welcome', role: 'assistant', text: `Olá! Sou seu Tutor de ${subject}. Como posso te ajudar com ${topic} hoje?` }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim()) return;
        
        if (!apiKey) {
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: "Por favor, configure sua OpenAI API Key no perfil para usar o tutor." }]);
            return;
        }

        const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        const currentInput = input;
        setInput('');
        setIsLoading(true);

        const cleanApiKey = apiKey.trim().replace(/[^\x00-\x7F]/g, "");

        try {
            const systemInstruction = `Você é um Tutor de Estudos IA amigável, especialista e socrático. 
            O aluno está estudando a disciplina: "${subject}", focando no tópico: "${topic}".
            Suas respostas devem ser concisas, pedagógicas e encorajadoras.
            Não dê a resposta direta imediatamente se for uma questão de raciocínio; guie o aluno.
            Use formatação Markdown simples (negrito, listas) para melhorar a legibilidade.`;

            // Preparar histórico para OpenAI
            const apiMessages = [
                { role: "system", content: systemInstruction },
                ...messages.map(m => ({
                    role: m.role === 'assistant' || m.role === 'user' ? m.role : 'system',
                    content: m.text
                })),
                { role: "user", content: currentInput }
            ];

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cleanApiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: apiMessages,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || "Erro na API da OpenAI");
            }

            const data = await response.json();
            const text = data.choices[0].message.content || "Não consegui formular uma resposta.";
            
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text }]);

        } catch (error: any) {
            console.error("Erro no Tutor IA:", error);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: `Erro: ${error.message}. Verifique sua chave de API.` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="absolute top-0 right-0 h-full w-full md:w-[400px] bg-white dark:bg-[#15152a] border-l border-border-light dark:border-border-dark shadow-2xl z-50 flex flex-col transition-transform duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border-light dark:border-border-dark bg-primary/5 dark:bg-primary/10">
                <div className="flex items-center gap-3">
                    <div className="bg-primary text-white p-2 rounded-lg">
                        <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                    </div>
                    <div>
                        <h3 className="font-bold text-text-primary-light dark:text-white text-sm">Tutor IA (OpenAI)</h3>
                        <p className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark truncate max-w-[200px]">{subject} • {topic}</p>
                    </div>
                </div>
                <button onClick={onClose} className="text-text-secondary-light dark:text-text-secondary-dark hover:text-red-500 transition-colors">
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-background-light dark:bg-background-dark/50">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm group relative ${
                            msg.role === 'user' 
                                ? 'bg-primary text-white rounded-br-none' 
                                : 'bg-white dark:bg-[#1e1e2d] text-text-primary-light dark:text-text-primary-dark border border-border-light dark:border-border-dark rounded-bl-none pr-8'
                        }`}>
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                            
                            {/* Save Button for Assistant Messages */}
                            {msg.role === 'assistant' && onSaveNote && (
                                <button 
                                    onClick={() => onSaveNote(msg.text, subject, topic)}
                                    className="absolute -right-2 -bottom-2 bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400 p-1.5 rounded-full shadow-sm hover:scale-110 transition-transform opacity-0 group-hover:opacity-100"
                                    title="Salvar Insight"
                                >
                                    <span className="material-symbols-outlined text-[16px]">bookmark_add</span>
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white dark:bg-[#1e1e2d] border border-border-light dark:border-border-dark rounded-2xl rounded-bl-none p-4 flex items-center gap-2">
                            <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce"></span>
                            <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                            <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-[#15152a] border-t border-border-light dark:border-border-dark">
                <div className="flex gap-2 items-end bg-background-light dark:bg-background-dark/50 p-2 rounded-xl border border-border-light dark:border-border-dark focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                    <textarea 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Digite sua dúvida..."
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-text-primary-light dark:text-white resize-none max-h-32 min-h-[44px] py-3"
                        rows={1}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className={`p-2.5 rounded-lg mb-0.5 transition-all ${
                            input.trim() 
                                ? 'bg-primary text-white shadow-md hover:bg-blue-600 active:scale-95' 
                                : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[20px] fill">send</span>
                    </button>
                </div>
                <p className="text-[10px] text-center text-text-secondary-light dark:text-text-secondary-dark mt-2">
                    O Tutor IA pode cometer erros. Verifique informações importantes.
                </p>
            </div>
        </div>
    );
};