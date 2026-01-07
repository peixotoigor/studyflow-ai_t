import React, { useState, useEffect, useRef } from 'react';
import { Subject, Topic, StudyLog, getSubjectIcon, StudyPlan } from '../types';

interface SubjectManagerProps {
    subjects?: Subject[];
    allSubjects?: Subject[]; // Para importar de outros planos
    plans?: StudyPlan[]; // Para selecionar plano de origem
    onImportFromPlan?: (sourcePlanId: string, subjectIdsToCopy: string[]) => void;
    onDeleteSubject?: (id: string) => void;
    onAddSubject?: (name: string, weight?: number, color?: string) => void;
    onToggleStatus?: (id: string) => void;
    onAddTopic?: (subjectId: string, name: string) => void;
    onRemoveTopic?: (subjectId: string, topicId: string) => void;
    onMoveTopic?: (subjectId: string, fromIndex: number, toIndex: number) => void;
    onUpdateSubject?: (subject: Subject) => void;
    onEditTopic?: (subjectId: string, topicId: string, newName: string) => void;
    onUpdateLog?: (subjectId: string, logId: string, updatedLog: Partial<StudyLog>) => void;
    onDeleteLog?: (subjectId: string, logId: string) => void;
    onToggleTopicCompletion?: (subjectId: string, topicId: string) => void; 
    apiKey?: string;
    model?: string;
}

const AVAILABLE_COLORS = [
    'blue', 'red', 'green', 'purple', 'orange', 'teal', 'pink', 'indigo', 'gray'
];

export const SubjectManager: React.FC<SubjectManagerProps> = ({ 
    subjects = [], 
    allSubjects = [],
    plans = [],
    onImportFromPlan,
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
    const [newSubjectWeight, setNewSubjectWeight] = useState<number>(1);
    const [hasCustomWeight, setHasCustomWeight] = useState(false); // Flag para peso opcional
    const [newSubjectColor, setNewSubjectColor] = useState<string>('');

    // States for IMPORT FROM PLAN Modal
    const [isImporting, setIsImporting] = useState(false);
    const [sourcePlanId, setSourcePlanId] = useState('');
    const [selectedImportSubjects, setSelectedImportSubjects] = useState<Set<string>>(new Set());

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
            setExpandedSubjectId(null);
        }
    }, [subjects.length]);

    // Cleanup effect: if expanded subject is deleted/missing, clear the state
    useEffect(() => {
        if (expandedSubjectId && !subjects.find(s => s.id === expandedSubjectId)) {
            setExpandedSubjectId(null);
        }
    }, [subjects, expandedSubjectId]);

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
        setExpandedSubjectId(prev => prev === id ? null : id);
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
            // Se o usuário não ativou o peso, mandamos undefined ou 1, o App.tsx trata.
            // Aqui decidimos mandar undefined se não for customizado para que a lógica padrão do App ou backend decida.
            const weightToSend = hasCustomWeight ? newSubjectWeight : undefined;
            onAddSubject(newSubjectName, weightToSend, newSubjectColor);
            
            // Reset
            setNewSubjectName('');
            setNewSubjectWeight(1);
            setHasCustomWeight(false);
            setNewSubjectColor('');
            setIsCreatingSubject(false);
        }
    };

    // --- Import Handlers ---
    const handleToggleImportSelection = (id: string) => {
        const newSet = new Set(selectedImportSubjects);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedImportSubjects(newSet);
    };

    const handleSelectAllImport = (visibleIds: string[]) => {
        if (selectedImportSubjects.size === visibleIds.length) {
            setSelectedImportSubjects(new Set());
        } else {
            setSelectedImportSubjects(new Set(visibleIds));
        }
    };

    const confirmImport = () => {
        if (onImportFromPlan && sourcePlanId && selectedImportSubjects.size > 0) {
            onImportFromPlan(sourcePlanId, Array.from(selectedImportSubjects));
            setIsImporting(false);
            setSourcePlanId('');
            setSelectedImportSubjects(new Set());
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
    
    // Lista de disciplinas para o Modal de Importação
    const importableSubjects = sourcePlanId 
        ? allSubjects.filter(s => s.planId === sourcePlanId)
        : [];

    const renderExpandedSubject = (subject: Subject) => {
        const subjectColorClass = subject.color ? `text-${subject.color}-600 dark:text-${subject.color}-400` : 'text-primary';
        const subjectBgClass = subject.color ? `bg-${subject.color}-100 dark:bg-${subject.color}-900/30` : 'bg-primary/10';

        return (
            <div className="flex-1 flex flex-col h-full bg-card-light dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden animate-in fade-in duration-200">
                <div className="p-5 border-b border-border-light dark:border-border-dark bg-background-light/50 dark:bg-background-dark/30">
                    <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
                        <div className="flex items-start gap-4">
                            <div className={`size-14 rounded-lg flex items-center justify-center shrink-0 ${subjectBgClass} ${subjectColorClass}`}>
                                <span className="material-symbols-outlined fill text-3xl">{getSubjectIcon(subject.name)}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <h3 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark flex items-center gap-2">
                                    {subject.name}
                                    {subject.weight !== undefined && (
                                        <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-bold text-slate-500">
                                            Peso {subject.weight}
                                        </span>
                                    )}
                                </h3>
                                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">{subject.topics.length} tópicos cadastrados</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => onDeleteSubject && onDeleteSubject(subject.id)} className="px-3 py-1.5 text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-md flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">delete_forever</span> Excluir</button>
                            <button onClick={() => toggleExpand(subject.id)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                                <span className="material-symbols-outlined text-[18px]">grid_view</span> Voltar
                            </button>
                        </div>
                    </div>
                </div>
                
                {/* TABS */}
                <div className="flex border-b border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark px-5">
                    <button onClick={() => setActiveTab('TOPICS')} className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'TOPICS' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Tópicos</button>
                    <button onClick={() => setActiveTab('HISTORY')} className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'HISTORY' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Histórico</button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-slate-50 dark:bg-[#0c0c1d]">
                    {activeTab === 'TOPICS' && (
                        <div className="max-w-3xl mx-auto">
                            <div className="flex flex-col gap-2">
                                {subject.topics.map((topic, idx) => (
                                    <div 
                                        key={topic.id} 
                                        draggable={editingTopicId === null}
                                        onDragStart={() => handleDragStart(idx)}
                                        onDragOver={handleDragOver}
                                        onDrop={() => handleDrop(subject.id, idx)}
                                        className={`group flex items-center gap-3 p-3 rounded-lg border bg-white dark:bg-card-dark transition-all ${draggedTopicIndex === idx ? 'opacity-50 border-primary border-dashed' : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-sm'} ${editingTopicId === topic.id ? 'bg-primary/5' : 'cursor-move'}`}
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
                            <div className="flex gap-2 mt-4 bg-white dark:bg-card-dark p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                                <input type="text" value={newTopicInput} onChange={(e) => setNewTopicInput(e.target.value)} onKeyDown={(e) => handleTopicKeyDown(e, subject.id)} placeholder="Adicionar novo tópico..." className="flex-1 bg-transparent border-none focus:ring-0 text-sm outline-none px-2" />
                                <button onClick={() => handleAddTopicSubmit(subject.id)} disabled={!newTopicInput.trim()} className="bg-primary text-white size-8 rounded-lg flex items-center justify-center hover:bg-blue-600 disabled:opacity-50"><span className="material-symbols-outlined text-[20px]">add</span></button>
                            </div>
                        </div>
                    )}
                    {/* History Tab */}
                    {activeTab === 'HISTORY' && (
                        <div className="max-w-3xl mx-auto flex flex-col gap-4">
                            {(!subject.logs || subject.logs.length === 0) && <div className="text-center py-12 text-gray-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">Nenhum histórico registrado.</div>}
                            {subject.logs?.map(log => (
                                <div key={log.id} className="flex justify-between items-center p-4 bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 text-sm shadow-sm">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-800 dark:text-white">{log.topicName}</span>
                                        <span className="text-xs text-slate-500">{new Date(log.date).toLocaleDateString()}</span>
                                    </div>
                                    <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs">{log.durationMinutes} min</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 overflow-hidden relative flex flex-col h-full">
            {/* SE UMA DISCIPLINA ESTIVER EXPANDIDA, MOSTRA APENAS ELA (MODO FOCO) */}
            {expandedSubjectId ? (
                <div className="flex-1 p-4 md:p-6 overflow-hidden">
                    {subjects.find(s => s.id === expandedSubjectId) ? renderExpandedSubject(subjects.find(s => s.id === expandedSubjectId)!) : null}
                </div>
            ) : (
                // MODO GRID (VISÃO GERAL)
                <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                    <div className="max-w-[1600px] mx-auto flex flex-col gap-8">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                            <h1 className="text-3xl md:text-4xl font-black text-text-primary-light dark:text-text-primary-dark">Configuração do Ciclo</h1>
                            <div className="flex gap-2">
                                {plans.length > 1 && (
                                    <button onClick={() => setIsImporting(true)} className="flex items-center gap-2 h-11 px-4 bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                                        <span className="material-symbols-outlined text-[18px]">input</span> 
                                        <span className="hidden sm:inline">Importar</span>
                                    </button>
                                )}
                                <button onClick={() => setIsCreatingSubject(true)} className="flex items-center gap-2 h-11 px-5 bg-primary text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition-all"><span className="material-symbols-outlined">add</span> Nova Disciplina</button>
                            </div>
                        </div>

                        {activeSubjects.length > 0 ? (
                            <div className="flex flex-col gap-4">
                                <h2 className="text-sm font-bold uppercase tracking-wider text-primary">No Plano de Estudos</h2>
                                
                                {/* GRID LAYOUT MUDANÇA PRINCIPAL */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                                    {activeSubjects.map(subject => {
                                        const subjectColorClass = subject.color ? `text-${subject.color}-600 dark:text-${subject.color}-400` : 'text-primary';
                                        const subjectBgClass = subject.color ? `bg-${subject.color}-100 dark:bg-${subject.color}-900/30` : 'bg-primary/10';
                                        
                                        return (
                                            <div 
                                                key={subject.id} 
                                                onClick={() => toggleExpand(subject.id)}
                                                className="group bg-card-light dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer relative flex flex-col justify-between h-[140px]"
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div className={`size-10 rounded-lg flex items-center justify-center ${subjectBgClass} ${subjectColorClass}`}>
                                                        <span className="material-symbols-outlined fill text-xl">{getSubjectIcon(subject.name)}</span>
                                                    </div>
                                                    {/* Mostra o peso se ele existir e for diferente de 1, OU se existir (decisão de design: mostrar sempre que for diferente de 1 para evitar poluição visual, mas se o usuário setar 1 explicitamente, ele pode querer ver? Vamos mostrar se definido.) */}
                                                    {subject.weight !== undefined && (
                                                        <span className="text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded">
                                                            Peso {subject.weight}
                                                        </span>
                                                    )}
                                                </div>
                                                
                                                <div>
                                                    <h3 className="font-bold text-base text-text-primary-light dark:text-text-primary-dark line-clamp-2 leading-tight mb-1" title={subject.name}>
                                                        {subject.name}
                                                    </h3>
                                                    <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{subject.topics.length} Tópicos</p>
                                                </div>

                                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <span className="material-symbols-outlined text-gray-400">open_in_full</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-20 text-gray-400">
                                <span className="material-symbols-outlined text-6xl mb-4">layers_clear</span>
                                <p className="text-lg">Nenhuma disciplina neste plano.</p>
                                <p className="text-sm">Crie uma nova ou importe de outro edital.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Criação (ATUALIZADO COM PESO E COR) */}
            {isCreatingSubject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-card-dark p-6 rounded-xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800">
                        <h3 className="text-lg font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">add_circle</span>
                            Nova Disciplina
                        </h3>
                        
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold uppercase text-slate-500">Nome</label>
                                <input 
                                    autoFocus 
                                    type="text" 
                                    value={newSubjectName} 
                                    onChange={(e) => setNewSubjectName(e.target.value)} 
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateSubjectSubmit()} 
                                    className="w-full border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-black dark:text-white bg-white dark:bg-black/20 focus:ring-2 focus:ring-primary outline-none" 
                                    placeholder="Ex: Direito Constitucional" 
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold uppercase text-slate-500">Peso no Edital</label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-gray-400">{hasCustomWeight ? 'Ativado' : 'Padrão'}</span>
                                        <div 
                                            onClick={() => setHasCustomWeight(!hasCustomWeight)}
                                            className={`w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors ${hasCustomWeight ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
                                        >
                                            <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${hasCustomWeight ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                        </div>
                                    </div>
                                </div>
                                
                                {hasCustomWeight && (
                                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                                        <input 
                                            type="range" 
                                            min="0.5" 
                                            max="5" 
                                            step="0.5" 
                                            value={newSubjectWeight} 
                                            onChange={(e) => setNewSubjectWeight(parseFloat(e.target.value))} 
                                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary" 
                                        />
                                        <span className="w-12 text-center font-bold text-primary bg-primary/10 rounded px-1">{newSubjectWeight}x</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold uppercase text-slate-500">Cor (Opcional)</label>
                                <div className="flex flex-wrap gap-2">
                                    {AVAILABLE_COLORS.map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setNewSubjectColor(newSubjectColor === c ? '' : c)}
                                            className={`size-6 rounded-full bg-${c}-500 transition-all ${newSubjectColor === c ? 'ring-2 ring-offset-2 ring-primary dark:ring-offset-gray-900 scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-8 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <button onClick={() => setIsCreatingSubject(false)} className="px-4 py-2 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-bold">Cancelar</button>
                            <button onClick={handleCreateSubjectSubmit} disabled={!newSubjectName.trim()} className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-50 shadow-lg shadow-primary/20">Criar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Importação (Mantido) */}
            {isImporting && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1e1e2d] w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[85vh]">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">folder_copy</span>
                                Importar de Outro Plano
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">Copie disciplinas inteiras de seus editais anteriores.</p>
                        </div>
                        
                        <div className="p-6 flex flex-col gap-6 overflow-y-auto">
                            {/* Seletor de Plano */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Plano de Origem</label>
                                <select 
                                    value={sourcePlanId} 
                                    onChange={(e) => {
                                        setSourcePlanId(e.target.value);
                                        setSelectedImportSubjects(new Set()); // Reset seleção ao mudar plano
                                    }}
                                    className="w-full p-3 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 outline-none cursor-pointer"
                                >
                                    <option value="">Selecione um plano...</option>
                                    {plans.filter(p => subjects.length === 0 || p.id !== subjects[0].planId).map(plan => (
                                        <option key={plan.id} value={plan.id}>{plan.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Lista de Seleção */}
                            {sourcePlanId && (
                                <div className="flex flex-col gap-2 flex-1 min-h-0">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Disciplinas Disponíveis</label>
                                        <button 
                                            onClick={() => handleSelectAllImport(importableSubjects.map(s => s.id))}
                                            className="text-xs text-primary font-bold hover:underline"
                                        >
                                            {selectedImportSubjects.size === importableSubjects.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                                        </button>
                                    </div>
                                    
                                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-y-auto max-h-[300px] p-2 bg-gray-50/50 dark:bg-black/10 custom-scrollbar">
                                        {importableSubjects.length > 0 ? (
                                            importableSubjects.map(sub => (
                                                <div 
                                                    key={sub.id} 
                                                    onClick={() => handleToggleImportSelection(sub.id)}
                                                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedImportSubjects.has(sub.id) ? 'bg-primary/10 border border-primary/30' : 'hover:bg-white dark:hover:bg-white/5 border border-transparent'}`}
                                                >
                                                    <div className={`size-5 rounded border flex items-center justify-center ${selectedImportSubjects.has(sub.id) ? 'bg-primary border-primary' : 'border-gray-300 dark:border-gray-600'}`}>
                                                        {selectedImportSubjects.has(sub.id) && <span className="material-symbols-outlined text-white text-[14px]">check</span>}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{sub.name}</p>
                                                        <p className="text-xs text-gray-500">{sub.topics.length} tópicos</p>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-8 text-gray-400 text-sm">Este plano não possui disciplinas.</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50 dark:bg-black/20">
                            <button onClick={() => setIsImporting(false)} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">Cancelar</button>
                            <button 
                                onClick={confirmImport} 
                                disabled={!sourcePlanId || selectedImportSubjects.size === 0}
                                className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-primary hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20 transition-all active:scale-95"
                            >
                                Importar {selectedImportSubjects.size > 0 && `(${selectedImportSubjects.size})`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};