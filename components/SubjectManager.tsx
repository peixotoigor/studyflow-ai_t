import React, { useState, useEffect, useRef } from 'react';
import { Subject, Topic, getSubjectIcon } from '../types';

interface SubjectManagerProps {
    subjects?: Subject[];
    onDeleteSubject?: (id: string) => void;
    onAddSubject?: (name: string) => void;
    onToggleStatus?: (id: string) => void;
    onAddTopic?: (subjectId: string, name: string) => void;
    onRemoveTopic?: (subjectId: string, topicId: string) => void;
    onMoveTopic?: (subjectId: string, fromIndex: number, toIndex: number) => void;
    onUpdateSubject?: (subject: Subject) => void;
    onEditTopic?: (subjectId: string, topicId: string, newName: string) => void;
    apiKey?: string;
    model?: string;
}

const AVAILABLE_COLORS = [
    'blue', 'red', 'green', 'purple', 'orange', 'teal', 'pink', 'indigo', 'gray'
];

export const SubjectManager: React.FC<SubjectManagerProps> = ({ 
    subjects = [], 
    onDeleteSubject, 
    onAddSubject,
    onToggleStatus,
    onAddTopic,
    onRemoveTopic,
    onMoveTopic,
    onUpdateSubject,
    onEditTopic,
    apiKey,
    model = 'gpt-4o-mini'
}) => {
    // Persistência da disciplina expandida
    const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('studyflow_expanded_subject_id');
        }
        return null;
    });

    const [newTopicInput, setNewTopicInput] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    
    // States for New Subject Modal
    const [isCreatingSubject, setIsCreatingSubject] = useState(false);
    const [newSubjectName, setNewSubjectName] = useState('');

    // AI Import Modal State
    const [aiImportSubjectId, setAiImportSubjectId] = useState<string | null>(null);
    const [rawSyllabusText, setRawSyllabusText] = useState('');
    const [isAiProcessing, setIsAiProcessing] = useState(false);

    // State for Drag and Drop
    const [draggedTopicIndex, setDraggedTopicIndex] = useState<number | null>(null);

    // State for Topic Editing
    const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
    const [editingTopicName, setEditingTopicName] = useState('');
    const editInputRef = useRef<HTMLInputElement>(null);

    // Efeito para selecionar automaticamente apenas se não houver salvo e tiver dados
    useEffect(() => {
        if (subjects.length > 0 && expandedSubjectId === null && !localStorage.getItem('studyflow_expanded_subject_id')) {
            const lastId = subjects[subjects.length - 1].id;
            setExpandedSubjectId(lastId);
        }
    }, [subjects.length]);

    // Salvar estado expandido
    useEffect(() => {
        if (expandedSubjectId) {
            localStorage.setItem('studyflow_expanded_subject_id', expandedSubjectId);
        } else {
            localStorage.removeItem('studyflow_expanded_subject_id');
        }
    }, [expandedSubjectId]);

    // Focus no input de edição quando ativado
    useEffect(() => {
        if (editingTopicId && editInputRef.current) {
            editInputRef.current.focus();
        }
    }, [editingTopicId]);

    const toggleExpand = (id: string) => {
        setExpandedSubjectId(expandedSubjectId === id ? null : id);
        setNewTopicInput(''); // Reset input
        setEditingTopicId(null); // Cancel edit if closed
    };

    const handleAddTopicSubmit = (subjectId: string) => {
        if (newTopicInput.trim() && onAddTopic) {
            onAddTopic(subjectId, newTopicInput);
            setNewTopicInput('');
        }
    };

    const handleTopicKeyDown = (e: React.KeyboardEvent, subjectId: string) => {
        if (e.key === 'Enter') {
            handleAddTopicSubmit(subjectId);
        }
    };

    const handleCreateSubjectSubmit = () => {
        if (newSubjectName.trim() && onAddSubject) {
            onAddSubject(newSubjectName);
            setNewSubjectName('');
            setIsCreatingSubject(false);
        }
    };

    // --- Topic Editing Handlers ---
    const startEditingTopic = (topic: Topic) => {
        setEditingTopicId(topic.id);
        setEditingTopicName(topic.name);
    };

    const cancelEditingTopic = () => {
        setEditingTopicId(null);
        setEditingTopicName('');
    };

    const saveEditingTopic = (subjectId: string) => {
        if (editingTopicId && editingTopicName.trim() && onEditTopic) {
            onEditTopic(subjectId, editingTopicId, editingTopicName);
            setEditingTopicId(null);
            setEditingTopicName('');
        }
    };

    const handleEditKeyDown = (e: React.KeyboardEvent, subjectId: string) => {
        if (e.key === 'Enter') {
            saveEditingTopic(subjectId);
        } else if (e.key === 'Escape') {
            cancelEditingTopic();
        }
    };

    // --- Drag and Drop Handlers ---
    const handleDragStart = (index: number) => {
        setDraggedTopicIndex(index);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Necessary to allow dropping
    };

    const handleDrop = (subjectId: string, targetIndex: number) => {
        if (draggedTopicIndex === null || draggedTopicIndex === targetIndex || !onMoveTopic) return;
        onMoveTopic(subjectId, draggedTopicIndex, targetIndex);
        setDraggedTopicIndex(null);
    };

    // --- AI Handlers ---
    const openAiImportModal = (subjectId: string, initialText: string = '') => {
        setAiImportSubjectId(subjectId);
        setRawSyllabusText(initialText);
        setIsAiProcessing(false);
    };

    const closeAiImportModal = () => {
        setAiImportSubjectId(null);
    };

    const handleAiProcess = async () => {
        if (!apiKey) {
            alert("Erro: Configure sua chave de API (OpenAI) no perfil antes de usar este recurso.");
            return;
        }
        if (!rawSyllabusText.trim() || !aiImportSubjectId || !onAddTopic) return;

        const cleanApiKey = apiKey.trim().replace(/[^\x00-\x7F]/g, "");
        if (!cleanApiKey.startsWith('sk-')) {
            alert("Erro de Configuração: A chave de API fornecida parece inválida (deve começar com 'sk-'). Verifique seu perfil.");
            return;
        }

        setIsAiProcessing(true);

        try {
            const prompt = `
                Você é um especialista sênior em Pedagogia e Concursos Públicos.
                OBJETIVO: Converter o texto cru fornecido em uma lista estruturada de tópicos para estudo.
                
                REGRA DE OURO: **NENHUMA INFORMAÇÃO PODE SER PERDIDA.**
                
                DIRETRIZES DE ESTRUTURAÇÃO (LEIA COM ATENÇÃO):

                1. **PRIORIDADE ABSOLUTA - DETECÇÃO DE NUMERAÇÃO:**
                   - Se o texto contiver uma sequência numérica clara (ex: "1. Contabilidade...", "2. Princípios...", "3. Conceitos..."), você deve **AGRUPAR TUDO** o que pertence àquele número em um único tópico.
                   - **NÃO QUEBRE** a descrição de um item numerado em vários tópicos menores.
                   - O tópico deve conter o Número + Título + Descrição Completa até chegar no próximo número.
                   
                   **Exemplo do que fazer (CORRETO):**
                   Entrada: "1. Contabilidade. Conceito, objeto e fins. 2. Patrimônio."
                   Saída: ["1. Contabilidade. Conceito, objeto e fins.", "2. Patrimônio."]

                   **Exemplo do que NÃO fazer (ERRADO):**
                   Entrada: "1. Contabilidade. Conceito, objeto e fins."
                   Saída: ["1. Contabilidade", "Conceito", "Objeto", "Fins"] -> ISSO ESTÁ ERRADO.

                2. **Caso SEM Numeração:**
                   - Apenas se o texto for um bloco corrido sem números (1., 2., I, II), use pontuação (; . -) para quebrar conceitos distintos em linhas individuais.

                3. **Limpeza:**
                   - Mantenha a terminologia técnica exata.
                   - Remova quebras de linha aleatórias dentro da mesma frase (comuns em PDFs copiados).

                Entrada: Um bloco de texto.
                Saída: Um JSON estrito com a lista ordenada.

                Retorne APENAS JSON:
                {
                    "topics": ["1. Tópico Completo", "2. Outro Tópico Completo com descrição"]
                }
            `;

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cleanApiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: "system", content: "Você é um extrator de conteúdo educacional que prioriza a estrutura numérica original." },
                        { role: "user", content: prompt + "\n\n--- TEXTO DO EDITAL ---\n" + rawSyllabusText }
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.1 // Temperatura baixa para maior fidelidade
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                const apiErrorMessage = errorData?.error?.message || `Status Code: ${response.status}`;
                throw new Error(apiErrorMessage);
            }

            const data = await response.json();
            
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error("Resposta da IA vazia ou mal formatada.");
            }

            let content;
            try {
                content = JSON.parse(data.choices[0].message.content);
            } catch (e) {
                throw new Error("A IA não retornou um JSON válido. O texto pode estar muito confuso.");
            }

            if (content.topics && Array.isArray(content.topics)) {
                content.topics.forEach((topicName: string) => {
                    onAddTopic(aiImportSubjectId, topicName);
                });
                setNewTopicInput(''); 
                closeAiImportModal();
            } else {
                throw new Error("O JSON retornado não contem a lista de 'topics' esperada.");
            }

        } catch (error: any) {
            console.error("Erro na extração IA:", error);
            
            let userFriendlyMessage = `Erro técnico: ${error.message}`;

            // Tradução de Erros Comuns da OpenAI
            if (error.message.includes("401") || error.message.toLowerCase().includes("invalid api key")) {
                userFriendlyMessage = "Chave de API Inválida (401). Verifique se você colou a chave corretamente no seu perfil.";
            } else if (error.message.includes("429") || error.message.toLowerCase().includes("quota") || error.message.toLowerCase().includes("billing")) {
                userFriendlyMessage = "Cota da OpenAI Excedida (429). Verifique se você tem créditos/faturamento ativo na sua conta da OpenAI.";
            } else if (error.message.includes("500") || error.message.includes("503")) {
                userFriendlyMessage = "Instabilidade nos servidores da OpenAI. Tente novamente em alguns instantes.";
            } else if (error.message.includes("JSON")) {
                userFriendlyMessage = "Erro de formatação. A IA falhou em estruturar o texto. Tente enviar um trecho menor.";
            }

            alert(`Falha na Extração:\n\n${userFriendlyMessage}`);
        } finally {
            setIsAiProcessing(false);
        }
    };

    // Filter and Group
    const filteredSubjects = subjects.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const activeSubjects = filteredSubjects.filter(s => s.active);
    const archivedSubjects = filteredSubjects.filter(s => !s.active);

    // Stats
    const totalActiveTopics = subjects.reduce((acc, s) => s.active ? acc + s.topics.length : acc, 0);

    const renderSubjectCard = (subject: Subject, isArchived: boolean) => {
        const isExpanded = expandedSubjectId === subject.id;
        const subjectColorClass = subject.color ? `text-${subject.color}-600 dark:text-${subject.color}-400` : 'text-primary';
        const subjectBgClass = subject.color ? `bg-${subject.color}-100 dark:bg-${subject.color}-900/30` : 'bg-primary/10';

        if (isExpanded) {
            return (
                <div key={subject.id} className="bg-card-light dark:bg-card-dark rounded-xl border-2 border-primary/20 dark:border-primary/20 shadow-lg overflow-hidden transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 mb-4">
                    <div className="p-5 border-b border-border-light dark:border-border-dark bg-background-light/50 dark:bg-background-dark/30">
                        <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
                            <div className="flex items-start gap-4">
                                <div className={`size-14 rounded-lg flex items-center justify-center shrink-0 ${subjectBgClass} ${subjectColorClass}`}>
                                    <span className="material-symbols-outlined fill text-3xl">{getSubjectIcon(subject.name)}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <h3 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">{subject.name}</h3>
                                        <button 
                                            onClick={() => onToggleStatus && onToggleStatus(subject.id)}
                                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors ${subject.active ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 ring-green-600/20 hover:bg-green-200' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 ring-gray-600/20 hover:bg-gray-200'}`}
                                            title={subject.active ? "Clique para Arquivar" : "Clique para Ativar"}
                                        >
                                            {subject.active ? 'Ativo no Ciclo' : 'Arquivado'}
                                            <span className="material-symbols-outlined text-[14px]">{subject.active ? 'check_circle' : 'archive'}</span>
                                        </button>
                                    </div>
                                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                                        {subject.topics.length} tópicos cadastrados
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 sm:items-center mt-2 md:mt-0">
                                <button 
                                    onClick={() => onDeleteSubject && onDeleteSubject(subject.id)}
                                    className="px-3 py-1.5 text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-md transition-colors flex items-center gap-1 active:scale-95"
                                    title="Excluir Definitivamente"
                                >
                                    <span className="material-symbols-outlined text-[16px]">delete_forever</span> Excluir
                                </button>
                                <button 
                                    onClick={() => toggleExpand(subject.id)}
                                    className="p-2 text-text-secondary-light dark:text-text-secondary-dark hover:bg-background-light dark:hover:bg-background-dark rounded-lg transition-colors active:scale-95"
                                >
                                    <span className="material-symbols-outlined text-[20px]">expand_less</span>
                                </button>
                            </div>
                        </div>

                         {/* Seletor de Cores */}
                         <div className="flex flex-col gap-2 mt-4 px-1">
                             <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Cor da Etiqueta</span>
                             </div>
                             <div className="flex gap-2 flex-wrap">
                                 {AVAILABLE_COLORS.map(color => (
                                     <button
                                        key={color}
                                        onClick={() => onUpdateSubject && onUpdateSubject({ ...subject, color })}
                                        className={`size-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95 bg-${color}-500 ${subject.color === color ? 'ring-2 ring-offset-2 ring-primary dark:ring-offset-[#1a1a2e]' : ''}`}
                                        title={`Cor ${color}`}
                                     >
                                        {subject.color === color && <span className="material-symbols-outlined text-white text-[14px] font-bold">check</span>}
                                     </button>
                                 ))}
                             </div>
                        </div>

                    </div>
                    
                    <div className="p-5 bg-card-light dark:bg-card-dark flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                             <h4 className="text-sm font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark flex items-center gap-2">
                                <span className="material-symbols-outlined text-[18px]">list</span>
                                Tópicos e Ordem de Estudo
                             </h4>
                             <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">drag_indicator</span>
                                Arraste para reordenar
                             </span>
                        </div>

                        <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                            {subject.topics.length === 0 && (
                                <div className="text-center py-8 border-2 border-dashed border-border-light dark:border-border-dark rounded-lg text-text-secondary-light dark:text-text-secondary-dark text-sm">
                                    Nenhum tópico adicionado ainda.
                                </div>
                            )}
                            
                            {subject.topics.map((topic, idx) => (
                                <div 
                                    key={topic.id} 
                                    draggable={editingTopicId === null} // Disable drag while editing
                                    onDragStart={() => handleDragStart(idx)}
                                    onDragOver={handleDragOver}
                                    onDrop={() => handleDrop(subject.id, idx)}
                                    className={`group flex items-center gap-3 p-2 rounded-lg border transition-all 
                                        ${draggedTopicIndex === idx 
                                            ? 'opacity-50 border-primary border-dashed bg-primary/5' 
                                            : 'border-transparent hover:bg-gray-50 dark:hover:bg-white/5 hover:border-border-light dark:hover:border-border-dark'
                                        }
                                        ${editingTopicId === topic.id ? 'bg-primary/5 border-primary/20' : 'cursor-move'}
                                    `}
                                >
                                     <div className="text-text-secondary-light dark:text-text-secondary-dark p-1">
                                         {editingTopicId !== topic.id && (
                                            <span className="material-symbols-outlined text-[18px] text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing">drag_indicator</span>
                                         )}
                                     </div>
                                     
                                     {editingTopicId !== topic.id && (
                                         <div className={`size-5 rounded border flex items-center justify-center shrink-0 ${topic.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600'}`}>
                                            {topic.completed && <span className="material-symbols-outlined text-white text-[14px]">check</span>}
                                         </div>
                                     )}
                                     
                                     {editingTopicId === topic.id ? (
                                         <div className="flex-1 flex items-center gap-2">
                                             <input
                                                ref={editInputRef}
                                                type="text"
                                                value={editingTopicName}
                                                onChange={(e) => setEditingTopicName(e.target.value)}
                                                onKeyDown={(e) => handleEditKeyDown(e, subject.id)}
                                                onBlur={() => saveEditingTopic(subject.id)}
                                                className="flex-1 text-sm p-1.5 rounded border border-primary/50 bg-white dark:bg-black/20 focus:ring-1 focus:ring-primary outline-none"
                                             />
                                             <button 
                                                onMouseDown={(e) => { e.preventDefault(); saveEditingTopic(subject.id); }} // onMouseDown fires before onBlur
                                                className="p-1 text-green-500 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                                             >
                                                 <span className="material-symbols-outlined text-[18px]">check</span>
                                             </button>
                                             <button 
                                                onMouseDown={(e) => { e.preventDefault(); cancelEditingTopic(); }}
                                                className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                                             >
                                                 <span className="material-symbols-outlined text-[18px]">close</span>
                                             </button>
                                         </div>
                                     ) : (
                                         <span 
                                            className={`text-sm font-medium flex-1 ${topic.completed ? 'text-gray-400 line-through' : 'text-text-primary-light dark:text-text-primary-dark'}`}
                                            onDoubleClick={() => startEditingTopic(topic)}
                                            title="Duplo clique para editar"
                                         >
                                             {topic.name}
                                         </span>
                                     )}
                                     
                                     {editingTopicId !== topic.id && (
                                         <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                             <button 
                                                onClick={() => startEditingTopic(topic)}
                                                className="text-gray-300 hover:text-primary p-1"
                                                title="Editar Tópico"
                                             >
                                                 <span className="material-symbols-outlined text-[18px]">edit</span>
                                             </button>
                                             <button 
                                                onClick={() => onRemoveTopic && onRemoveTopic(subject.id, topic.id)}
                                                className="text-gray-300 hover:text-red-500 p-1"
                                                title="Remover Tópico"
                                             >
                                                 <span className="material-symbols-outlined text-[18px]">close</span>
                                             </button>
                                         </div>
                                     )}
                                </div>
                            ))}
                        </div>

                        {/* Add Topic Input */}
                        <div className="flex gap-2 mt-2 pt-4 border-t border-border-light dark:border-border-dark bg-background-light/30 dark:bg-background-dark/30 p-2 rounded-lg">
                            <input 
                                type="text" 
                                value={newTopicInput}
                                onChange={(e) => setNewTopicInput(e.target.value)}
                                onKeyDown={(e) => handleTopicKeyDown(e, subject.id)}
                                placeholder="Digite um tópico único OU cole o texto do edital aqui..."
                                className="flex-1 bg-white dark:bg-card-dark border border-border-light dark:border-border-dark rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none text-text-primary-light dark:text-text-primary-dark"
                            />
                            <button 
                                onClick={() => handleAddTopicSubmit(subject.id)}
                                disabled={!newTopicInput.trim()}
                                className="bg-primary disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-600 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[18px]">add</span>
                                <span className="hidden sm:inline">Adicionar</span>
                            </button>
                             <button 
                                onClick={() => openAiImportModal(subject.id, newTopicInput)}
                                className={`px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors border ${newTopicInput.length > 30 ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-200 dark:hover:bg-purple-900/50'}`}
                                title="Usar IA para estruturar texto em lista de tópicos"
                            >
                                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                                {newTopicInput.length > 30 && <span className="hidden sm:inline">Estruturar Texto</span>}
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        // Collapsed View
        return (
            <div key={subject.id} className={`group bg-card-light dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark p-5 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer mb-4 ${isArchived ? 'opacity-75 grayscale-[0.5]' : ''}`} onClick={() => toggleExpand(subject.id)}>
                <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
                    <div className="flex items-start gap-4">
                        <div className={`size-12 rounded-lg flex items-center justify-center shrink-0 ${subjectBgClass} ${subjectColorClass}`}>
                            <span className="material-symbols-outlined fill">{isArchived ? 'archive' : getSubjectIcon(subject.name)}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">{subject.name}</h3>
                                {isArchived && <span className="text-[10px] uppercase font-bold bg-gray-200 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded">Arquivado</span>}
                            </div>
                            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">{subject.topics.length} Tópicos</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                         <span className="text-xs text-primary font-bold">Gerenciar</span>
                         <span className="material-symbols-outlined text-primary">edit</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
            <div className="max-w-[1200px] mx-auto flex flex-col gap-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-text-primary-light dark:text-text-primary-dark">
                            Configuração do Ciclo
                        </h1>
                        <p className="text-text-secondary-light dark:text-text-secondary-dark text-base max-w-2xl">
                            Selecione quais disciplinas farão parte do seu ciclo de estudos ativo. Arquive as que já finalizou ou não está estudando no momento.
                        </p>
                    </div>
                    <button 
                        onClick={() => setIsCreatingSubject(true)}
                        className="flex items-center justify-center gap-2 h-11 px-5 bg-primary hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-primary/20 transition-all active:scale-95 shrink-0"
                    >
                        <span className="material-symbols-outlined text-[20px]">add</span>
                        <span>Nova Disciplina</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                     <div className="bg-card-light dark:bg-card-dark p-4 rounded-xl border border-border-light dark:border-border-dark shadow-sm flex items-center gap-4">
                         <div className="bg-primary/10 text-primary p-3 rounded-full">
                             <span className="material-symbols-outlined">layers</span>
                         </div>
                         <div>
                             <p className="text-xs font-bold uppercase text-text-secondary-light dark:text-text-secondary-dark">Disciplinas Ativas</p>
                             <p className="text-2xl font-black text-text-primary-light dark:text-text-primary-dark">{activeSubjects.length} <span className="text-sm font-normal text-gray-400">/ {subjects.length}</span></p>
                         </div>
                     </div>
                     <div className="bg-card-light dark:bg-card-dark p-4 rounded-xl border border-border-light dark:border-border-dark shadow-sm flex items-center gap-4">
                         <div className="bg-green-100 dark:bg-green-900/30 text-green-600 p-3 rounded-full">
                             <span className="material-symbols-outlined">format_list_numbered</span>
                         </div>
                         <div>
                             <p className="text-xs font-bold uppercase text-text-secondary-light dark:text-text-secondary-dark">Tópicos Ativos</p>
                             <p className="text-2xl font-black text-text-primary-light dark:text-text-primary-dark">{totalActiveTopics}</p>
                         </div>
                     </div>
                     <div className="bg-card-light dark:bg-card-dark p-4 rounded-xl border border-border-light dark:border-border-dark shadow-sm flex items-center gap-2 px-6">
                         <div className="flex-1">
                             <input 
                                type="text" 
                                placeholder="Filtrar..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-transparent border-none focus:ring-0 text-sm p-0 text-text-primary-light dark:text-text-primary-dark"
                             />
                         </div>
                         <span className="material-symbols-outlined text-gray-400">search</span>
                     </div>
                </div>

                {subjects.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-12 bg-card-light dark:bg-card-dark rounded-xl border border-dashed border-border-light dark:border-border-dark">
                        <span className="material-symbols-outlined text-5xl text-text-secondary-light dark:text-text-secondary-dark mb-4">folder_off</span>
                        <h3 className="text-lg font-bold text-text-primary-light dark:text-white">Nenhuma disciplina encontrada</h3>
                        <p className="text-text-secondary-light dark:text-text-secondary-dark text-center max-w-md mt-2">
                            Comece importando um edital no menu "Importador" ou adicione uma disciplina manualmente.
                        </p>
                    </div>
                )}

                {/* Active Subjects Section */}
                {activeSubjects.length > 0 && (
                    <div className="flex flex-col gap-4">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">play_circle</span>
                            No Plano de Estudos ({activeSubjects.length})
                        </h2>
                        <div className="flex flex-col">
                            {activeSubjects.map(s => renderSubjectCard(s, false))}
                        </div>
                    </div>
                )}

                {/* Archived Subjects Section */}
                {archivedSubjects.length > 0 && (
                    <div className="flex flex-col gap-4 mt-4">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                            Biblioteca / Arquivados ({archivedSubjects.length})
                        </h2>
                         <div className="flex flex-col">
                            {archivedSubjects.map(s => renderSubjectCard(s, true))}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Nova Disciplina */}
            {isCreatingSubject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-card-dark w-full max-w-md rounded-xl shadow-2xl border border-border-light dark:border-border-dark transform scale-100 transition-all p-6">
                        <h3 className="text-lg font-bold text-text-primary-light dark:text-white mb-4">Nova Disciplina</h3>
                        <div className="flex flex-col gap-2 mb-6">
                            <label className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark uppercase">Nome da Matéria</label>
                            <input 
                                autoFocus
                                type="text" 
                                value={newSubjectName}
                                onChange={(e) => setNewSubjectName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateSubjectSubmit()}
                                placeholder="Ex: Direito Constitucional"
                                className="w-full bg-background-light dark:bg-background-dark/50 border border-border-light dark:border-border-dark rounded-lg px-4 py-3 text-text-primary-light dark:text-white focus:ring-2 focus:ring-primary/50 outline-none"
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setIsCreatingSubject(false)}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleCreateSubjectSubmit}
                                disabled={!newSubjectName.trim()}
                                className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20 transition-all"
                            >
                                Criar Disciplina
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Importação de Texto IA */}
            {aiImportSubjectId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-card-dark w-full max-w-2xl rounded-xl shadow-2xl border border-border-light dark:border-border-dark flex flex-col max-h-[90vh]">
                         <div className="p-6 border-b border-border-light dark:border-border-dark bg-purple-50 dark:bg-purple-900/10">
                            <h3 className="text-lg font-bold text-text-primary-light dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-purple-600 dark:text-purple-400">auto_awesome</span>
                                Extração Inteligente (Fidelidade Máxima)
                            </h3>
                            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
                                Cole o bloco de texto do edital abaixo. A IA quebrará em tópicos <strong>sem resumir</strong>.
                            </p>
                        </div>
                        
                        <div className="p-6 flex-1 overflow-hidden flex flex-col gap-4">
                            <textarea
                                value={rawSyllabusText}
                                onChange={(e) => setRawSyllabusText(e.target.value)}
                                placeholder="Ex: Direito Administrativo: Conceito, fontes e princípios. Organização administrativa: administração direta e indireta..."
                                className="w-full flex-1 min-h-[200px] p-4 bg-background-light dark:bg-background-dark/50 border border-border-light dark:border-border-dark rounded-lg resize-none focus:ring-2 focus:ring-purple-500/50 outline-none text-sm leading-relaxed"
                            />
                            {!apiKey && (
                                <p className="text-xs text-red-500 font-bold bg-red-50 dark:bg-red-900/20 p-2 rounded">
                                    Atenção: Configure sua chave da OpenAI no Perfil para usar este recurso.
                                </p>
                            )}
                        </div>

                        <div className="p-6 border-t border-border-light dark:border-border-dark flex justify-end gap-3 bg-gray-50/50 dark:bg-gray-900/30">
                            <button 
                                onClick={closeAiImportModal}
                                disabled={isAiProcessing}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleAiProcess}
                                disabled={!rawSyllabusText.trim() || isAiProcessing || !apiKey}
                                className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-600/20 transition-all flex items-center gap-2"
                            >
                                {isAiProcessing ? (
                                    <>
                                        <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        Processando...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-[18px]">bolt</span>
                                        Processar Texto
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};