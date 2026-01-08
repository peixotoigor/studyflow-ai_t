
import React, { useState, useEffect, useRef } from 'react';
import { Subject, Topic, StudyLog, getSubjectIcon, StudyPlan } from '../types';

interface SubjectManagerProps {
    subjects?: Subject[];
    allSubjects?: Subject[];
    plans?: StudyPlan[];
    onImportFromPlan?: (sourcePlanId: string, subjectIdsToCopy: string[]) => void;
    onDeleteSubject?: (id: string) => void;
    onBulkDeleteSubjects?: (ids: string[]) => void;
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
    onRestoreSubjects?: (subjects: Subject[]) => void;
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
    onBulkDeleteSubjects,
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
    onRestoreSubjects,
    apiKey,
    model = 'gpt-4o-mini'
}) => {
    const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(() => {
        try {
            if (typeof window !== 'undefined') return localStorage.getItem('studyflow_expanded_subject_id');
        } catch (e) {}
        return null;
    });

    const [activeTab, setActiveTab] = useState<'TOPICS' | 'HISTORY'>('TOPICS');
    const [viewMode, setViewMode] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE'); // Novo estado para controlar a visualização
    const [newTopicInput, setNewTopicInput] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    
    // States for New Subject Modal
    const [isCreatingSubject, setIsCreatingSubject] = useState(false);
    const [newSubjectName, setNewSubjectName] = useState('');
    const [newSubjectWeight, setNewSubjectWeight] = useState<number>(1);
    const [hasCustomWeight, setHasCustomWeight] = useState(false);
    const [newSubjectColor, setNewSubjectColor] = useState<string>('');
    const [creationSyllabusText, setCreationSyllabusText] = useState(''); 

    // States for EDIT Subject Modal
    const [editingSubjectData, setEditingSubjectData] = useState<Subject | null>(null);
    const [editName, setEditName] = useState('');
    const [editWeight, setEditWeight] = useState<number>(1);
    const [editHasWeight, setEditHasWeight] = useState(false);
    const [editColor, setEditColor] = useState('');

    // States for IMPORT FROM PLAN Modal
    const [isImporting, setIsImporting] = useState(false);
    const [sourcePlanId, setSourcePlanId] = useState('');
    const [selectedImportSubjects, setSelectedImportSubjects] = useState<Set<string>>(new Set());

    // AI Import Modal State
    const [aiImportModalOpen, setAiImportModalOpen] = useState(false);
    const [aiTargetSubjectId, setAiTargetSubjectId] = useState<string | null>(null);
    const [rawSyllabusText, setRawSyllabusText] = useState('');
    const [isAiProcessing, setIsAiProcessing] = useState(false);

    // State for Bulk Actions
    const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(new Set());
    const [isBulkWeightModalOpen, setIsBulkWeightModalOpen] = useState(false);
    const [bulkWeightValue, setBulkWeightValue] = useState(1);

    // State for UNDO
    const [lastDeletedBatch, setLastDeletedBatch] = useState<Subject[] | null>(null);
    const [showUndoToast, setShowUndoToast] = useState(false);
    const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Drag and Drop & Editing
    const [draggedTopicIndex, setDraggedTopicIndex] = useState<number | null>(null);
    const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
    const [editingTopicName, setEditingTopicName] = useState('');
    const editInputRef = useRef<HTMLInputElement>(null);

    // Effects
    useEffect(() => {
        let hasSaved = false;
        try { hasSaved = !!localStorage.getItem('studyflow_expanded_subject_id'); } catch(e) {}
        if (subjects.length > 0 && expandedSubjectId === null && !hasSaved) setExpandedSubjectId(null);
    }, [subjects.length]);

    useEffect(() => {
        if (expandedSubjectId && !subjects.find(s => s.id === expandedSubjectId)) setExpandedSubjectId(null);
    }, [subjects, expandedSubjectId]);

    useEffect(() => {
        try {
            if (expandedSubjectId) localStorage.setItem('studyflow_expanded_subject_id', expandedSubjectId);
            else localStorage.removeItem('studyflow_expanded_subject_id');
        } catch (e) {}
    }, [expandedSubjectId]);

    useEffect(() => {
        if (editingTopicId && editInputRef.current) editInputRef.current.focus();
    }, [editingTopicId]);

    const toggleExpand = (id: string) => {
        setExpandedSubjectId(prev => prev === id ? null : id);
        setNewTopicInput(''); 
        setEditingTopicId(null); 
        setActiveTab('TOPICS');
    };

    // Filter Logic baseada no ViewMode
    const filteredSubjects = subjects.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Lista exibida depende da aba selecionada
    const displayedSubjects = filteredSubjects.filter(s => 
        viewMode === 'ACTIVE' ? s.active : !s.active
    );

    // Importable logic
    const importableSubjects = sourcePlanId ? allSubjects.filter(s => s.planId === sourcePlanId) : [];

    // --- Bulk Selection Handlers ---
    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedSubjectIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedSubjectIds(newSet);
    };

    const selectAll = () => {
        if (selectedSubjectIds.size === displayedSubjects.length) setSelectedSubjectIds(new Set());
        else setSelectedSubjectIds(new Set(displayedSubjects.map(s => s.id)));
    };

    // Ação inteligente: Se estiver em Ativas, arquiva. Se em Arquivadas, restaura.
    const handleBulkToggleStatus = () => {
        if (selectedSubjectIds.size === 0 || !onToggleStatus) return;
        selectedSubjectIds.forEach(id => onToggleStatus(id));
        setSelectedSubjectIds(new Set());
    };

    const handleBulkDelete = () => {
        if (selectedSubjectIds.size === 0) return;
        
        // 1. Guardar backup para Undo
        const subjectsToDelete = subjects.filter(s => selectedSubjectIds.has(s.id));
        setLastDeletedBatch(subjectsToDelete);

        // 2. Excluir de fato
        if (onBulkDeleteSubjects) {
            onBulkDeleteSubjects(Array.from(selectedSubjectIds));
        } else {
            subjectsToDelete.forEach(s => onDeleteSubject && onDeleteSubject(s.id));
        }

        // 3. UI Updates
        setSelectedSubjectIds(new Set());
        setShowUndoToast(true);

        if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
        undoTimeoutRef.current = setTimeout(() => {
            setShowUndoToast(false);
            setLastDeletedBatch(null);
        }, 6000);
    };

    const handleUndoDelete = () => {
        if (lastDeletedBatch && onRestoreSubjects) {
            onRestoreSubjects(lastDeletedBatch);
            setLastDeletedBatch(null);
            setShowUndoToast(false);
            if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
        }
    };

    const handleBulkWeightUpdate = () => {
        if (selectedSubjectIds.size === 0 || !onUpdateSubject) return;
        selectedSubjectIds.forEach(id => {
            const sub = subjects.find(s => s.id === id);
            if (sub) onUpdateSubject({ ...sub, weight: bulkWeightValue });
        });
        setIsBulkWeightModalOpen(false);
        setSelectedSubjectIds(new Set());
        alert("Pesos atualizados com sucesso!");
    };

    // --- Handlers Básicos ---
    const handleCreateSubjectSubmit = async () => {
        if (newSubjectName.trim() && onAddSubject) {
            onAddSubject(newSubjectName, hasCustomWeight ? newSubjectWeight : undefined, newSubjectColor);
            if (creationSyllabusText.trim()) setTimeout(() => alert("Disciplina criada! Use a varinha mágica para processar o texto colado."), 500);
            
            setNewSubjectName('');
            setNewSubjectWeight(1);
            setHasCustomWeight(false);
            setNewSubjectColor('');
            setCreationSyllabusText('');
            setIsCreatingSubject(false);
        }
    };

    const handleUpdateSubjectSubmit = () => {
        if (editingSubjectData && editName.trim() && onUpdateSubject) {
            onUpdateSubject({
                ...editingSubjectData,
                name: editName,
                color: editColor,
                weight: editHasWeight ? editWeight : undefined
            });
            setEditingSubjectData(null);
        }
    };

    // --- Topic Editing Handlers ---
    const startEditingTopic = (topic: Topic) => { setEditingTopicId(topic.id); setEditingTopicName(topic.name); };
    const cancelEditingTopic = () => { setEditingTopicId(null); setEditingTopicName(''); };
    const saveEditingTopic = (subjectId: string) => {
        if (editingTopicId && editingTopicName.trim() && onEditTopic) {
            onEditTopic(subjectId, editingTopicId, editingTopicName);
            setEditingTopicId(null);
            setEditingTopicName('');
        }
    };
    const handleEditKeyDown = (e: React.KeyboardEvent, subjectId: string) => {
        if (e.key === 'Enter') saveEditingTopic(subjectId);
        else if (e.key === 'Escape') cancelEditingTopic();
    };
    const handleAddTopicSubmit = (subjectId: string) => {
        if (newTopicInput.trim() && onAddTopic) {
            onAddTopic(subjectId, newTopicInput);
            setNewTopicInput('');
        }
    };
    const handleTopicKeyDown = (e: React.KeyboardEvent, subjectId: string) => {
        if (e.key === 'Enter') handleAddTopicSubmit(subjectId);
    };

    // --- AI Handlers ---
    const openAiModalForSubject = (e: React.MouseEvent, subjectId: string) => {
        e.stopPropagation();
        setAiTargetSubjectId(subjectId);
        setRawSyllabusText('');
        setAiImportModalOpen(true);
    };

    const handleAiProcess = async () => {
        if (!apiKey) {
            alert("Erro: Configure sua chave de API (OpenAI) no perfil.");
            return;
        }
        if (!rawSyllabusText.trim() || !aiTargetSubjectId || !onAddTopic) return;

        const cleanApiKey = apiKey.trim().replace(/[^\x00-\x7F]/g, "");
        setIsAiProcessing(true);

        try {
            // PROMPT ESPECÍFICO PARA EXTRAÇÃO LITERAL E ROBUSTA DE TÓPICOS NUMERADOS
            const prompt = `
                Sua ÚNICA função é atuar como um parser de texto LITERAL. Você deve extrair a lista de tópicos respeitando estritamente a numeração original do edital.

                REGRAS ABSOLUTAS (NÃO QUEBRE NENHUMA):
                1. MANTENHA A LITERALIDADE: Se um item começa com um número (1., 2., 3., ...), capture TODO o texto associado a ele como UMA ÚNICA STRING até o próximo número ou fim do texto.
                2. PROIBIDO FRAGMENTAR POR PONTUAÇÃO: NUNCA separe um tópico numerado por vírgulas, ponto e vírgula ou traços. O item numerado é um bloco atômico.
                3. PROIBIDO INFERIR SUBTÓPICOS: Não tente "melhorar" a didática separando conceitos. Mantenha o bloco de texto bruto junto com seu número.
                4. LISTAS NÃO NUMERADAS: Se o texto NÃO tiver números, quebre por linhas (parágrafos), mas mantenha o texto agrupado logicamente.

                EXEMPLO DE CORREÇÃO:
                Entrada: 
                "1. Contabilidade. Conceito, objeto, campo de atuação e usuários.
                2. Princípios e Normas Brasileiras."

                Saída CORRETA (Obrigatória):
                { "topics": [
                    "1. Contabilidade. Conceito, objeto, campo de atuação e usuários.",
                    "2. Princípios e Normas Brasileiras."
                ]}

                Saída ERRADA (Proibida - Não faça isso):
                { "topics": ["1. Contabilidade", "Conceito", "objeto", "2. Princípios"] }

                ENTRADA PARA PROCESSAR:
                ${rawSyllabusText}
            `;

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cleanApiKey}` },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: "system", content: "Você é um extrator de texto cego e literal. Você ignora pontuação interna e preserva blocos numerados inteiros." }, 
                        { role: "user", content: prompt }
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.0 // Temperatura zero para determinismo máximo
                })
            });

            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            const data = await response.json();
            const content = JSON.parse(data.choices[0].message.content);

            if (content.topics && Array.isArray(content.topics)) {
                content.topics.forEach((topicName: string) => onAddTopic(aiTargetSubjectId, topicName));
                setAiImportModalOpen(false);
                setRawSyllabusText('');
                alert(`${content.topics.length} tópicos adicionados com sucesso!`);
            } else { throw new Error("JSON inválido."); }
        } catch (error: any) {
            console.error(error);
            alert(`Falha: ${error.message}`);
        } finally { setIsAiProcessing(false); }
    };

    // --- Drag Handlers ---
    const handleDragStart = (index: number) => setDraggedTopicIndex(index);
    const handleDragOver = (e: React.DragEvent) => e.preventDefault();
    const handleDrop = (subjectId: string, targetIndex: number) => {
        if (draggedTopicIndex === null || draggedTopicIndex === targetIndex || !onMoveTopic) return;
        onMoveTopic(subjectId, draggedTopicIndex, targetIndex);
        setDraggedTopicIndex(null);
    };

    // --- Import Handlers ---
    const handleToggleImportSelection = (id: string) => {
        const newSet = new Set(selectedImportSubjects);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        setSelectedImportSubjects(newSet);
    };
    const handleSelectAllImport = (visibleIds: string[]) => {
        if (selectedImportSubjects.size === visibleIds.length) setSelectedImportSubjects(new Set());
        else setSelectedImportSubjects(new Set(visibleIds));
    };
    const confirmImport = () => {
        if (onImportFromPlan && sourcePlanId && selectedImportSubjects.size > 0) {
            onImportFromPlan(sourcePlanId, Array.from(selectedImportSubjects));
            setIsImporting(false);
            setSourcePlanId('');
            setSelectedImportSubjects(new Set());
        }
    };

    const openEditSubjectModal = (e: React.MouseEvent, subject: Subject) => {
        e.stopPropagation();
        setEditingSubjectData(subject);
        setEditName(subject.name);
        setEditColor(subject.color || 'blue');
        if (subject.weight !== undefined) { setEditHasWeight(true); setEditWeight(subject.weight); } 
        else { setEditHasWeight(false); setEditWeight(1); }
    };

    // --- RENDER HELPERS ---
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
                                        <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-bold text-slate-500">Peso {subject.weight}</span>
                                    )}
                                </h3>
                                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">{subject.topics.length} tópicos cadastrados</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={(e) => openAiModalForSubject(e, subject.id)} className="px-3 py-1.5 text-xs font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 rounded-md flex items-center gap-1 transition-colors"><span className="material-symbols-outlined text-[16px]">auto_fix</span> IA</button>
                            <button onClick={(e) => openEditSubjectModal(e, subject)} className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-100 rounded-md flex items-center gap-1 transition-colors"><span className="material-symbols-outlined text-[16px]">edit</span> Editar</button>
                            <button onClick={() => toggleExpand(subject.id)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"><span className="material-symbols-outlined text-[18px]">grid_view</span> Voltar</button>
                        </div>
                    </div>
                </div>
                
                <div className="flex border-b border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark px-5">
                    <button onClick={() => setActiveTab('TOPICS')} className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'TOPICS' ? 'border-primary text-primary' : 'border-transparent text-gray-500'}`}>Tópicos</button>
                    <button onClick={() => setActiveTab('HISTORY')} className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'HISTORY' ? 'border-primary text-primary' : 'border-transparent text-gray-500'}`}>Histórico</button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-slate-50 dark:bg-[#0c0c1d]">
                    {activeTab === 'TOPICS' && (
                        <div className="max-w-3xl mx-auto">
                            <div className="flex flex-col gap-2">
                                {subject.topics.map((topic, idx) => (
                                    <div key={topic.id} draggable={editingTopicId === null} onDragStart={() => handleDragStart(idx)} onDragOver={handleDragOver} onDrop={() => handleDrop(subject.id, idx)} className={`group flex items-center gap-3 p-3 rounded-lg border bg-white dark:bg-card-dark transition-all ${draggedTopicIndex === idx ? 'opacity-50 border-primary border-dashed' : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-sm'} ${editingTopicId === topic.id ? 'bg-primary/5' : 'cursor-move'}`}>
                                            <div className="text-gray-300 dark:text-gray-600 p-1 cursor-grab active:cursor-grabbing"><span className="material-symbols-outlined text-[18px]">drag_indicator</span></div>
                                            {editingTopicId !== topic.id && (
                                                <div onClick={(e) => { e.stopPropagation(); if(onToggleTopicCompletion) onToggleTopicCompletion(subject.id, topic.id); }} className={`size-5 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${topic.completed ? 'bg-green-500 border-green-500 hover:bg-green-600' : 'border-gray-300 dark:border-gray-600 hover:border-primary'}`}>
                                                {topic.completed && <span className="material-symbols-outlined text-white text-[14px]">check</span>}
                                                </div>
                                            )}
                                            {editingTopicId === topic.id ? (
                                                <div className="flex-1 flex items-center gap-2">
                                                    <input ref={editInputRef} type="text" value={editingTopicName} onChange={(e) => setEditingTopicName(e.target.value)} onKeyDown={(e) => handleEditKeyDown(e, subject.id)} onBlur={() => saveEditingTopic(subject.id)} className="flex-1 text-sm p-1.5 rounded border border-primary/50 bg-white dark:bg-black/20 focus:ring-1 focus:ring-primary outline-none" />
                                                    <button onMouseDown={(e) => { e.preventDefault(); saveEditingTopic(subject.id); }} className="p-1 text-green-500"><span className="material-symbols-outlined text-[18px]">check</span></button>
                                                    <button onMouseDown={(e) => { e.preventDefault(); cancelEditingTopic(); }} className="p-1 text-red-500"><span className="material-symbols-outlined text-[18px]">close</span></button>
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
            {expandedSubjectId ? (
                <div className="flex-1 p-4 md:p-6 overflow-hidden">
                    {subjects.find(s => s.id === expandedSubjectId) ? renderExpandedSubject(subjects.find(s => s.id === expandedSubjectId)!) : null}
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative">
                    <div className="max-w-[1600px] mx-auto flex flex-col gap-8 pb-20">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                            <div className="flex flex-col gap-1">
                                <h1 className="text-3xl md:text-4xl font-black text-text-primary-light dark:text-text-primary-dark">Configuração do Ciclo</h1>
                                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">Gerencie suas disciplinas e conteúdo programático.</p>
                            </div>
                            
                            <div className="flex flex-wrap gap-2 items-center">
                                {/* Toggle Ativas/Arquivadas */}
                                <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded-lg">
                                    <button 
                                        onClick={() => { setViewMode('ACTIVE'); setSelectedSubjectIds(new Set()); }}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'ACTIVE' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                                    >
                                        Ativas
                                    </button>
                                    <button 
                                        onClick={() => { setViewMode('ARCHIVED'); setSelectedSubjectIds(new Set()); }}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'ARCHIVED' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                                    >
                                        Arquivadas
                                    </button>
                                </div>

                                <div className="h-8 w-px bg-gray-300 dark:bg-gray-700 mx-2 hidden md:block"></div>

                                <button onClick={selectAll} className="text-xs font-bold text-primary px-3 hover:bg-primary/5 rounded h-10">
                                    {selectedSubjectIds.size === displayedSubjects.length && displayedSubjects.length > 0 ? 'Desmarcar' : 'Selecionar Tudo'}
                                </button>
                                
                                {plans.length > 1 && (
                                    <button onClick={() => setIsImporting(true)} className="flex items-center gap-2 h-10 px-4 bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                                        <span className="material-symbols-outlined text-[18px]">input</span><span className="hidden sm:inline">Importar</span>
                                    </button>
                                )}
                                <button onClick={() => setIsCreatingSubject(true)} className="flex items-center gap-2 h-10 px-5 bg-primary text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition-all"><span className="material-symbols-outlined">add</span> Nova</button>
                            </div>
                        </div>

                        {displayedSubjects.length > 0 ? (
                            <div className="flex flex-col gap-4">
                                <h2 className="text-sm font-bold uppercase tracking-wider text-primary">
                                    {viewMode === 'ACTIVE' ? 'No Plano de Estudos' : 'Disciplinas Arquivadas (Inativas)'}
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                                    {displayedSubjects.map(subject => {
                                        const subjectColorClass = subject.color ? `text-${subject.color}-600 dark:text-${subject.color}-400` : 'text-primary';
                                        const subjectBgClass = subject.color ? `bg-${subject.color}-100 dark:bg-${subject.color}-900/30` : 'bg-primary/10';
                                        const isSelected = selectedSubjectIds.has(subject.id);
                                        const isArchived = !subject.active;
                                        
                                        return (
                                            <div 
                                                key={subject.id} 
                                                onClick={() => toggleExpand(subject.id)} 
                                                className={`group bg-card-light dark:bg-card-dark rounded-xl border p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer relative flex flex-col justify-between h-[140px] ${isSelected ? 'border-primary ring-1 ring-primary/30' : 'border-border-light dark:border-border-dark'} ${isArchived ? 'opacity-80 grayscale-[0.5] hover:grayscale-0' : ''}`}
                                            >
                                                <div className="absolute top-2 left-2 z-10" onClick={(e) => { e.stopPropagation(); toggleSelection(subject.id); }}>
                                                    <div className={`size-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary' : 'bg-white/80 dark:bg-black/50 border-gray-300 dark:border-gray-600 hover:border-primary'}`}>
                                                        {isSelected && <span className="material-symbols-outlined text-white text-[14px]">check</span>}
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-start pl-6">
                                                    <div className={`size-10 rounded-lg flex items-center justify-center ${subjectBgClass} ${subjectColorClass}`}>
                                                        <span className="material-symbols-outlined fill text-xl">{getSubjectIcon(subject.name)}</span>
                                                    </div>
                                                    {subject.weight !== undefined && (
                                                        <span className="text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded">Peso {subject.weight}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-base text-text-primary-light dark:text-text-primary-dark line-clamp-2 leading-tight mb-1" title={subject.name}>{subject.name}</h3>
                                                    <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{subject.topics.length} Tópicos</p>
                                                </div>
                                                <div className="absolute top-2 right-2 flex gap-1">
                                                    {!isArchived && (
                                                        <button onClick={(e) => openAiModalForSubject(e, subject.id)} className="p-1 rounded bg-white/80 dark:bg-black/50 hover:bg-purple-100 dark:hover:bg-purple-900 text-slate-500 hover:text-purple-600 transition-colors shadow-sm opacity-0 group-hover:opacity-100" title="IA"><span className="material-symbols-outlined text-[16px]">auto_fix</span></button>
                                                    )}
                                                    <button onClick={(e) => openEditSubjectModal(e, subject)} className="p-1 rounded bg-white/80 dark:bg-black/50 hover:bg-blue-100 dark:hover:bg-blue-900 text-slate-500 hover:text-blue-600 transition-colors shadow-sm opacity-0 group-hover:opacity-100" title="Editar"><span className="material-symbols-outlined text-[16px]">edit</span></button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-20 text-gray-400">
                                <span className="material-symbols-outlined text-6xl mb-4">{viewMode === 'ACTIVE' ? 'layers_clear' : 'inventory_2'}</span>
                                <p className="text-lg">{viewMode === 'ACTIVE' ? 'Nenhuma disciplina ativa.' : 'Nenhuma disciplina arquivada.'}</p>
                                {viewMode === 'ACTIVE' && <p className="text-sm">Crie uma nova ou verifique as arquivadas.</p>}
                            </div>
                        )}
                    </div>

                    {/* Barra de Ações em Massa Inteligente */}
                    {selectedSubjectIds.size > 0 && (
                        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-2 rounded-xl shadow-2xl z-40 flex items-center gap-2 animate-in slide-in-from-bottom-4">
                            <span className="px-3 text-xs font-bold bg-white/10 rounded-lg py-1.5">{selectedSubjectIds.size} selecionadas</span>
                            <div className="h-6 w-px bg-white/20"></div>
                            
                            {/* Botão de Toggle Status (Arquivar/Restaurar) */}
                            <button onClick={handleBulkToggleStatus} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-xs font-bold ${viewMode === 'ACTIVE' ? 'hover:bg-white/10 text-slate-300 hover:text-white' : 'hover:bg-green-500/20 text-green-300 hover:text-green-200'}`}>
                                <span className="material-symbols-outlined text-sm">{viewMode === 'ACTIVE' ? 'archive' : 'unarchive'}</span>
                                {viewMode === 'ACTIVE' ? 'Arquivar' : 'Restaurar'}
                            </button>

                            {viewMode === 'ACTIVE' && (
                                <button onClick={() => setIsBulkWeightModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/10 rounded-lg transition-colors text-xs font-bold text-slate-300 hover:text-white"><span className="material-symbols-outlined text-sm">monitor_weight</span> Peso</button>
                            )}
                            
                            <button onClick={handleBulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-red-500/20 text-red-300 hover:text-red-200 rounded-lg transition-colors text-xs font-bold"><span className="material-symbols-outlined text-sm">delete</span> Excluir</button>
                            <button onClick={() => setSelectedSubjectIds(new Set())} className="ml-2 p-1 hover:bg-white/10 rounded-full"><span className="material-symbols-outlined text-sm">close</span></button>
                        </div>
                    )}

                    {showUndoToast && lastDeletedBatch && (
                        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
                            <div className="bg-slate-800 text-white pl-4 pr-2 py-3 rounded-lg shadow-2xl flex items-center gap-4 border border-slate-700">
                                <div className="flex flex-col"><span className="text-sm font-bold">{lastDeletedBatch.length} excluídas</span></div>
                                <button onClick={handleUndoDelete} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-md transition-colors shadow-lg">DESFAZER</button>
                                <button onClick={() => setShowUndoToast(false)} className="text-slate-400 hover:text-white p-1"><span className="material-symbols-outlined text-sm">close</span></button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {isCreatingSubject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-card-dark p-6 rounded-xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
                        <h3 className="text-lg font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2"><span className="material-symbols-outlined text-primary">add_circle</span> Nova Disciplina</h3>
                        <div className="flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold uppercase text-slate-500">Nome</label>
                                <input autoFocus type="text" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateSubjectSubmit()} className="w-full border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-black dark:text-white bg-white dark:bg-black/20 focus:ring-2 focus:ring-primary outline-none" placeholder="Ex: Direito Constitucional" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold uppercase text-slate-500">Peso</label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-gray-400">{hasCustomWeight ? 'Ativado' : 'Padrão'}</span>
                                        <div onClick={() => setHasCustomWeight(!hasCustomWeight)} className={`w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors ${hasCustomWeight ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}><div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${hasCustomWeight ? 'translate-x-4' : 'translate-x-0'}`}></div></div>
                                    </div>
                                </div>
                                {hasCustomWeight && (<div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1"><input type="range" min="0.5" max="5" step="0.5" value={newSubjectWeight} onChange={(e) => setNewSubjectWeight(parseFloat(e.target.value))} className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary" /><span className="w-12 text-center font-bold text-primary bg-primary/10 rounded px-1">{newSubjectWeight}x</span></div>)}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold uppercase text-slate-500">Cor</label>
                                <div className="flex flex-wrap gap-2">{AVAILABLE_COLORS.map(c => (<button key={c} onClick={() => setNewSubjectColor(newSubjectColor === c ? '' : c)} className={`size-6 rounded-full bg-${c}-500 transition-all ${newSubjectColor === c ? 'ring-2 ring-offset-2 ring-primary dark:ring-offset-gray-900 scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'}`} />))}</div>
                            </div>
                            <div className="mt-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <label className="text-xs font-bold uppercase text-purple-600 dark:text-purple-400 flex items-center gap-1 mb-2"><span className="material-symbols-outlined text-sm">auto_fix</span> Estrutura de Tópicos (IA)</label>
                                <textarea value={creationSyllabusText} onChange={(e) => setCreationSyllabusText(e.target.value)} placeholder="Cole aqui o conteúdo do edital..." className="w-full h-24 p-3 rounded-lg bg-purple-50/50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/30 text-xs focus:ring-2 focus:ring-purple-500/50 outline-none resize-none" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <button onClick={() => setIsCreatingSubject(false)} className="px-4 py-2 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-bold">Cancelar</button>
                            <button onClick={handleCreateSubjectSubmit} disabled={!newSubjectName.trim()} className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-50 shadow-lg shadow-primary/20">{creationSyllabusText.trim() ? 'Criar & Processar IA' : 'Criar'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de EDIÇÃO */}
            {editingSubjectData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-card-dark p-6 rounded-xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800">
                        <h3 className="text-lg font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2"><span className="material-symbols-outlined text-primary">edit</span> Editar Disciplina</h3>
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold uppercase text-slate-500">Nome</label>
                                <input autoFocus type="text" value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleUpdateSubjectSubmit()} className="w-full border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-black dark:text-white bg-white dark:bg-black/20 focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold uppercase text-slate-500">Peso</label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-gray-400">{editHasWeight ? 'Ativado' : 'Padrão'}</span>
                                        <div onClick={() => setEditHasWeight(!editHasWeight)} className={`w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors ${editHasWeight ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}><div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${editHasWeight ? 'translate-x-4' : 'translate-x-0'}`}></div></div>
                                    </div>
                                </div>
                                {editHasWeight && (<div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1"><input type="range" min="0.5" max="5" step="0.5" value={editWeight} onChange={(e) => setEditWeight(parseFloat(e.target.value))} className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary" /><span className="w-12 text-center font-bold text-primary bg-primary/10 rounded px-1">{editWeight}x</span></div>)}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold uppercase text-slate-500">Cor</label>
                                <div className="flex flex-wrap gap-2">{AVAILABLE_COLORS.map(c => (<button key={c} onClick={() => setEditColor(editColor === c ? '' : c)} className={`size-6 rounded-full bg-${c}-500 transition-all ${editColor === c ? 'ring-2 ring-offset-2 ring-primary dark:ring-offset-gray-900 scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'}`} />))}</div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-8 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <button onClick={() => setEditingSubjectData(null)} className="px-4 py-2 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-bold">Cancelar</button>
                            <button onClick={handleUpdateSubjectSubmit} disabled={!editName.trim()} className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-50 shadow-lg shadow-primary/20">Salvar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals de Importação, IA e Peso em Massa (Mantidos igual ao anterior) */}
            {isImporting && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1e1e2d] w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[85vh]">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><span className="material-symbols-outlined text-primary">folder_copy</span> Importar</h3>
                        </div>
                        <div className="p-6 flex flex-col gap-6 overflow-y-auto">
                            <div className="flex flex-col gap-2"><label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Plano de Origem</label><select value={sourcePlanId} onChange={(e) => { setSourcePlanId(e.target.value); setSelectedImportSubjects(new Set()); }} className="w-full p-3 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 outline-none cursor-pointer"><option value="">Selecione um plano...</option>{plans.filter(p => subjects.length === 0 || p.id !== subjects[0].planId).map(plan => (<option key={plan.id} value={plan.id}>{plan.name}</option>))}</select></div>
                            {sourcePlanId && (<div className="flex flex-col gap-2 flex-1 min-h-0"><div className="flex justify-between items-center"><label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Disciplinas Disponíveis</label><button onClick={() => handleSelectAllImport(importableSubjects.map(s => s.id))} className="text-xs text-primary font-bold hover:underline">{selectedImportSubjects.size === importableSubjects.length ? 'Desmarcar Todas' : 'Selecionar Todas'}</button></div><div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-y-auto max-h-[300px] p-2 bg-gray-50/50 dark:bg-black/10 custom-scrollbar">{importableSubjects.length > 0 ? (importableSubjects.map(sub => (<div key={sub.id} onClick={() => handleToggleImportSelection(sub.id)} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedImportSubjects.has(sub.id) ? 'bg-primary/10 border border-primary/30' : 'hover:bg-white dark:hover:bg-white/5 border border-transparent'}`}><div className={`size-5 rounded border flex items-center justify-center ${selectedImportSubjects.has(sub.id) ? 'bg-primary border-primary' : 'border-gray-300 dark:border-gray-600'}`}>{selectedImportSubjects.has(sub.id) && <span className="material-symbols-outlined text-white text-[14px]">check</span>}</div><div className="flex-1"><p className="text-sm font-bold text-gray-900 dark:text-white">{sub.name}</p></div></div>))) : (<div className="text-center py-8 text-gray-400 text-sm">Este plano não possui disciplinas.</div>)}</div></div>)}
                        </div>
                        <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50 dark:bg-black/20"><button onClick={() => setIsImporting(false)} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">Cancelar</button><button onClick={confirmImport} disabled={!sourcePlanId || selectedImportSubjects.size === 0} className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-primary hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20">Importar</button></div>
                    </div>
                </div>
            )}

            {aiImportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-card-dark w-full max-w-lg rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-6">
                        <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><span className="material-symbols-outlined text-purple-600">auto_fix</span> Adicionar Tópicos via IA</h3><button onClick={() => setAiImportModalOpen(false)}><span className="material-symbols-outlined text-gray-400">close</span></button></div>
                        <p className="text-sm text-gray-500 mb-4">Cole o conteúdo do edital.</p>
                        <textarea value={rawSyllabusText} onChange={(e) => setRawSyllabusText(e.target.value)} className="w-full h-40 p-3 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-gray-700 text-sm focus:ring-2 focus:ring-purple-500/50 outline-none resize-none mb-4" />
                        <div className="flex justify-end gap-2"><button onClick={() => setAiImportModalOpen(false)} className="px-4 py-2 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-bold">Cancelar</button><button onClick={handleAiProcess} disabled={isAiProcessing || !rawSyllabusText.trim()} className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-bold shadow-lg flex items-center gap-2 disabled:opacity-50">{isAiProcessing ? 'Processando...' : 'Extrair'}</button></div>
                    </div>
                </div>
            )}

            {isBulkWeightModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-card-dark p-6 rounded-xl shadow-xl w-full max-w-sm border border-slate-200 dark:border-slate-800">
                        <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Alterar Peso em Massa</h3>
                        <div className="flex items-center gap-3 mb-8"><input type="range" min="0.5" max="5" step="0.5" value={bulkWeightValue} onChange={(e) => setBulkWeightValue(parseFloat(e.target.value))} className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary" /><span className="w-12 text-center font-bold text-primary bg-primary/10 rounded px-1 text-lg">{bulkWeightValue}x</span></div>
                        <div className="flex justify-end gap-2"><button onClick={() => setIsBulkWeightModalOpen(false)} className="px-4 py-2 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-bold">Cancelar</button><button onClick={handleBulkWeightUpdate} className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-blue-600 shadow-lg">Aplicar</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};
