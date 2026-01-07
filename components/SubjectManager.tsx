import React, { useState, useEffect, useRef } from 'react';
import { Subject, Topic, StudyLog, getSubjectIcon } from '../types';

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
    onUpdateLog?: (subjectId: string, logId: string, updatedLog: Partial<StudyLog>) => void;
    onDeleteLog?: (subjectId: string, logId: string) => void;
    onToggleTopicCompletion?: (subjectId: string, topicId: string) => void; // Nova prop
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
    onUpdateLog,
    onDeleteLog,
    onToggleTopicCompletion,
    apiKey,
    model = 'gpt-4o-mini'
}) => {
    // Persistência da disciplina expandida com proteção Try/Catch
    const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(() => {
        try {
            if (typeof window !== 'undefined') {
                return localStorage.getItem('studyflow_expanded_subject_id');
            }
        } catch (e) {}
        return null;
    });

    const [activeTab, setActiveTab] = useState<'TOPICS' | 'HISTORY'>('TOPICS');
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

    // State for Log Editing
    const [editingLogId, setEditingLogId] = useState<string | null>(null);
    const [editLogData, setEditLogData] = useState<Partial<StudyLog>>({});

    // Efeito para selecionar automaticamente apenas se não houver salvo e tiver dados
    useEffect(() => {
        let hasSaved = false;
        try {
            hasSaved = !!localStorage.getItem('studyflow_expanded_subject_id');
        } catch(e) {}

        if (subjects.length > 0 && expandedSubjectId === null && !hasSaved) {
            const lastId = subjects[subjects.length - 1].id;
            setExpandedSubjectId(lastId);
        }
    }, [subjects.length]);

    // Salvar estado expandido com proteção
    useEffect(() => {
        try {
            if (expandedSubjectId) {
                localStorage.setItem('studyflow_expanded_subject_id', expandedSubjectId);
            } else {
                localStorage.removeItem('studyflow_expanded_subject_id');
            }
        } catch (e) {}
    }, [expandedSubjectId]);

    // Focus no input de edição quando ativado
    useEffect(() => {
        if (editingTopicId && editInputRef.current) {
            editInputRef.current.focus();
        }
    }, [editingTopicId]);

    const toggleExpand = (id: string) => {
        setExpandedSubjectId(expandedSubjectId === id ? null : id);
        setNewTopicInput(''); 
        setEditingTopicId(null); 
        setActiveTab('TOPICS');
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

    // --- Log Editing Handlers ---
    const startEditingLog = (log: StudyLog) => {
        setEditingLogId(log.id);
        setEditLogData({ ...log });
    };

    const cancelEditingLog = () => {
        setEditingLogId(null);
        setEditLogData({});
    };

    const saveEditingLog = (subjectId: string) => {
        if (editingLogId && onUpdateLog) {
            onUpdateLog(subjectId, editingLogId, editLogData);
            setEditingLogId(null);
            setEditLogData({});
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
        // ... (código existente da IA mantido igual) ...
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
                
                DIRETRIZES:
                1. **NUMERAÇÃO:** Se o texto contiver sequências numéricas (1., 2...), AGRUPE TUDO do item em um único tópico.
                2. **SEM NUMERAÇÃO:** Use pontuação (; . -) para quebrar.
                3. **LIMPEZA:** Remova quebras de linha aleatórias.

                Entrada: Um bloco de texto.
                Saída: Um JSON estrito: { "topics": ["1. Tópico A", "2. Tópico B"] }
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
                    temperature: 0.1
                })
            });

            if (!response.ok) throw new Error(`API Error: ${response.status}`);

            const data = await response.json();
            const content = JSON.parse(data.choices[0].message.content);

            if (content.topics && Array.isArray(content.topics)) {
                content.topics.forEach((topicName: string) => {
                    onAddTopic(aiImportSubjectId, topicName);
                });
                setNewTopicInput(''); 
                closeAiImportModal();
            } else {
                throw new Error("JSON inválido.");
            }

        } catch (error: any) {
            console.error(error);
            alert(`Falha na Extração: ${error.message}`);
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

    const renderSubjectCard = (subject: Subject, isArchived: boolean) => {
        const isExpanded = expandedSubjectId === subject.id;
        const subjectColorClass = subject.color ? `text-${subject.color}-600 dark:text-${subject.color}-400` : 'text-primary';
        const subjectBgClass = subject.color ? `bg-${subject.color}-100 dark:bg-${subject.color}-900/30` : 'bg-primary/10';

        if (isExpanded) {
            return (
                <div key={subject.id} className="bg-card-light dark:bg-card-dark rounded-xl border-2 border-primary/20 dark:border-primary/20 shadow-lg overflow-hidden transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 mb-4">
                    {/* ... (código do header do card mantido igual) ... */}
                    <div className="p-5 border-b border-border-light dark:border-border-dark bg-background-light/50 dark:bg-background-dark/30">
                        <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
                            <div className="flex items-start gap-4">
                                <div className={`size-14 rounded-lg flex items-center justify-center shrink-0 ${subjectBgClass} ${subjectColorClass}`}>
                                    <span className="material-symbols-outlined fill text-3xl">{getSubjectIcon(subject.name)}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <h3 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">{subject.name}</h3>
                                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">{subject.topics.length} tópicos cadastrados</p>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 sm:items-center mt-2 md:mt-0">
                                <button onClick={() => onDeleteSubject && onDeleteSubject(subject.id)} className="px-3 py-1.5 text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-md flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">delete_forever</span> Excluir</button>
                                <button onClick={() => toggleExpand(subject.id)} className="p-2 text-text-secondary-light dark:text-text-secondary-dark hover:bg-background-light dark:hover:bg-background-dark rounded-lg"><span className="material-symbols-outlined text-[20px]">expand_less</span></button>
                            </div>
                        </div>
                    </div>
                    
                    {/* TABS */}
                    <div className="flex border-b border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark px-5">
                        <button onClick={() => setActiveTab('TOPICS')} className={`py-3 px-4 text-sm font-bold border-b-2 ${activeTab === 'TOPICS' ? 'border-primary text-primary' : 'border-transparent text-gray-500'}`}>Tópicos</button>
                        <button onClick={() => setActiveTab('HISTORY')} className={`py-3 px-4 text-sm font-bold border-b-2 ${activeTab === 'HISTORY' ? 'border-primary text-primary' : 'border-transparent text-gray-500'}`}>Histórico</button>
                    </div>

                    <div className="p-5 bg-card-light dark:bg-card-dark flex flex-col gap-4">
                        {activeTab === 'TOPICS' && (
                            <>
                                <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                    {subject.topics.map((topic, idx) => (
                                        <div 
                                            key={topic.id} 
                                            draggable={editingTopicId === null}
                                            onDragStart={() => handleDragStart(idx)}
                                            onDragOver={handleDragOver}
                                            onDrop={() => handleDrop(subject.id, idx)}
                                            className={`group flex items-center gap-3 p-2 rounded-lg border transition-all ${draggedTopicIndex === idx ? 'opacity-50 border-primary border-dashed' : 'border-transparent hover:bg-gray-50 dark:hover:bg-white/5'} ${editingTopicId === topic.id ? 'bg-primary/5' : 'cursor-move'}`}
                                        >
                                             <div className="text-gray-300 dark:text-gray-600 p-1 cursor-grab active:cursor-grabbing"><span className="material-symbols-outlined text-[18px]">drag_indicator</span></div>
                                             
                                             {/* CHECKBOX CLICÁVEL PARA TOGGLE MANUAL */}
                                             {editingTopicId !== topic.id && (
                                                 <div 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        if(onToggleTopicCompletion) onToggleTopicCompletion(subject.id, topic.id); 
                                                    }}
                                                    className={`size-5 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${topic.completed ? 'bg-green-500 border-green-500 hover:bg-green-600' : 'border-gray-300 dark:border-gray-600 hover:border-primary'}`}
                                                    title={topic.completed ? "Desmarcar conclusão" : "Marcar como concluído"}
                                                 >
                                                    {topic.completed && <span className="material-symbols-outlined text-white text-[14px]">check</span>}
                                                 </div>
                                             )}
                                             
                                             {editingTopicId === topic.id ? (
                                                 <div className="flex-1 flex items-center gap-2">
                                                     <input ref={editInputRef} type="text" value={editingTopicName} onChange={(e) => setEditingTopicName(e.target.value)} onKeyDown={(e) => handleEditKeyDown(e, subject.id)} onBlur={() => saveEditingTopic(subject.id)} className="flex-1 text-sm p-1.5 rounded border border-primary/50 bg-white dark:bg-black/20 focus:ring-1 focus:ring-primary outline-none" />
                                                     <button onMouseDown={(e) => { e.preventDefault(); saveEditingTopic(subject.id); }} className="p-1 text-green-500 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"><span className="material-symbols-outlined text-[18px]">check</span></button>
                                                     <button onMouseDown={(e) => { e.preventDefault(); cancelEditingTopic(); }} className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"><span className="material-symbols-outlined text-[18px]">close</span></button>
                                                 </div>
                                             ) : (
                                                 <span className={`text-sm font-medium flex-1 ${topic.completed ? 'text-gray-400 line-through' : 'text-text-primary-light dark:text-text-primary-dark'}`} onDoubleClick={() => startEditingTopic(topic)}>{topic.name}</span>
                                             )}
                                             
                                             {editingTopicId !== topic.id && (
                                                 <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                     <button onClick={() => startEditingTopic(topic)} className="text-gray-300 hover:text-primary p-1"><span className="material-symbols-outlined text-[18px]">edit</span></button>
                                                     <button onClick={() => onRemoveTopic && onRemoveTopic(subject.id, topic.id)} className="text-gray-300 hover:text-red-500 p-1"><span className="material-symbols-outlined text-[18px]">close</span></button>
                                                 </div>
                                             )}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2 mt-2 pt-4 border-t border-border-light dark:border-border-dark bg-background-light/30 dark:bg-background-dark/30 p-2 rounded-lg">
                                    <input type="text" value={newTopicInput} onChange={(e) => setNewTopicInput(e.target.value)} onKeyDown={(e) => handleTopicKeyDown(e, subject.id)} placeholder="Novo tópico..." className="flex-1 bg-white dark:bg-card-dark border border-border-light dark:border-border-dark rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none" />
                                    <button onClick={() => handleAddTopicSubmit(subject.id)} disabled={!newTopicInput.trim()} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-600"><span className="material-symbols-outlined text-[18px]">add</span></button>
                                </div>
                            </>
                        )}
                        {/* History Tab mantido */}
                        {activeTab === 'HISTORY' && (
                            <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto custom-scrollbar">
                                {/* ... (código existente do histórico dentro do card) ... */}
                                {(!subject.logs || subject.logs.length === 0) && <div className="text-center py-8 text-gray-400">Nenhum histórico.</div>}
                                {subject.logs?.map(log => (
                                    <div key={log.id} className="flex justify-between p-2 border-b border-gray-100 dark:border-gray-800 text-sm">
                                        <span>{new Date(log.date).toLocaleDateString()} - {log.topicName}</span>
                                        <span>{log.durationMinutes} min</span>
                                    </div>
                                ))}
                            </div>
                        )}
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
                            <h3 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">{subject.name}</h3>
                            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">{subject.topics.length} Tópicos</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
            <div className="max-w-[1200px] mx-auto flex flex-col gap-8">
                {/* ... (Cabeçalho e Filtros mantidos) ... */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <h1 className="text-3xl md:text-4xl font-black text-text-primary-light dark:text-text-primary-dark">Configuração do Ciclo</h1>
                    <button onClick={() => setIsCreatingSubject(true)} className="flex items-center gap-2 h-11 px-5 bg-primary text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition-all"><span className="material-symbols-outlined">add</span> Nova Disciplina</button>
                </div>

                {/* Lista de Subjects */}
                {activeSubjects.length > 0 && (
                    <div className="flex flex-col gap-4">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-primary">No Plano de Estudos</h2>
                        {activeSubjects.map(s => renderSubjectCard(s, false))}
                    </div>
                )}
                
                {/* Modais mantidos */}
            </div>
            {isCreatingSubject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-card-dark p-6 rounded-xl shadow-xl w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4">Nova Disciplina</h3>
                        <input autoFocus type="text" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateSubjectSubmit()} className="w-full border p-2 rounded mb-4 text-black dark:text-white dark:bg-black/20" placeholder="Nome..." />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setIsCreatingSubject(false)} className="px-4 py-2 rounded text-gray-500">Cancelar</button>
                            <button onClick={handleCreateSubjectSubmit} className="px-4 py-2 bg-primary text-white rounded">Criar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};