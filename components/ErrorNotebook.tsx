import React, { useState, useMemo } from 'react';
import { ErrorLog, Subject, ErrorReason } from '../types';

interface ErrorNotebookProps {
    subjects: Subject[];
    logs: ErrorLog[];
    onAddLog: (log: ErrorLog) => void;
    onDeleteLog: (id: string) => void;
}

export const ErrorNotebook: React.FC<ErrorNotebookProps> = ({ subjects, logs, onAddLog, onDeleteLog }) => {
    const [isAdding, setIsAdding] = useState(false);
    
    // Form States
    const [selectedSubjectId, setSelectedSubjectId] = useState('');
    const [topicName, setTopicName] = useState('');
    const [questionSource, setQuestionSource] = useState('');
    const [reason, setReason] = useState<ErrorReason>('KNOWLEDGE_GAP');
    const [description, setDescription] = useState('');
    const [correction, setCorrection] = useState('');

    // Filter & Search States
    const [filterSubject, setFilterSubject] = useState('ALL');
    const [filterReason, setFilterReason] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    const errorReasons: { value: ErrorReason; label: string; icon: string; color: string; borderColor: string }[] = [
        { value: 'KNOWLEDGE_GAP', label: 'Lacuna Teórica', icon: 'psychology_alt', color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30', borderColor: 'border-purple-500' },
        { value: 'ATTENTION', label: 'Falta de Atenção', icon: 'visibility_off', color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30', borderColor: 'border-orange-500' },
        { value: 'INTERPRETATION', label: 'Interpretação', icon: 'translate', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30', borderColor: 'border-blue-500' },
        { value: 'TRICK', label: 'Pegadinha', icon: 'warning', color: 'text-red-600 bg-red-100 dark:bg-red-900/30', borderColor: 'border-red-500' },
        { value: 'TIME', label: 'Falta de Tempo', icon: 'timer', color: 'text-gray-600 bg-gray-100 dark:bg-gray-800', borderColor: 'border-gray-500' },
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSubjectId || !description.trim()) return;

        const newLog: ErrorLog = {
            id: Date.now().toString(),
            subjectId: selectedSubjectId,
            topicName: topicName || 'Geral',
            questionSource: questionSource || 'Não informada',
            reason,
            description,
            correction,
            createdAt: new Date(),
            reviewCount: 0
        };

        onAddLog(newLog);
        setIsAdding(false);
        // Reset Form
        setDescription('');
        setCorrection('');
        setTopicName('');
        setQuestionSource('');
    };

    const getSubjectName = (id: string) => subjects.find(s => s.id === id)?.name || 'Disciplina Desconhecida';

    // Statistics
    const stats = useMemo(() => {
        const total = logs.length;
        const byReason = logs.reduce((acc, log) => {
            acc[log.reason] = (acc[log.reason] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const mostFrequentReason = Object.entries(byReason).sort((a: [string, number], b: [string, number]) => b[1] - a[1])[0];

        return { total, byReason, mostFrequentReason };
    }, [logs]);

    // Filtering Logic (Robust Search)
    const filteredLogs = logs.filter(log => {
        // 1. Strict Filters (Dropdowns)
        if (filterSubject !== 'ALL' && log.subjectId !== filterSubject) return false;
        if (filterReason !== 'ALL' && log.reason !== filterReason) return false;
        
        // 2. Text Search (Topic OR Subject Name) - Case Insensitive
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            const subjectName = getSubjectName(log.subjectId).toLowerCase();
            const topic = log.topicName.toLowerCase();
            const description = log.description.toLowerCase();
            
            // Verifica se o termo está no tópico, no nome da disciplina ou na descrição
            return topic.includes(term) || subjectName.includes(term) || description.includes(term);
        }

        return true;
    });

    const clearFilters = () => {
        setFilterSubject('ALL');
        setFilterReason('ALL');
        setSearchTerm('');
    };

    const hasActiveFilters = filterSubject !== 'ALL' || filterReason !== 'ALL' || searchTerm !== '';

    return (
        <div className="flex-1 w-full max-w-[1400px] mx-auto p-4 md:p-8 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 shrink-0">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <span className="material-symbols-outlined text-4xl text-red-500">assignment_late</span>
                        Caderno de Erros
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-base max-w-2xl">
                        "Errar é humano, persistir no erro é perder a vaga." Registre seus erros para diagnosticar suas fraquezas e revisar o que realmente importa.
                    </p>
                </div>
                <button 
                    onClick={() => setIsAdding(true)}
                    className="flex items-center justify-center gap-2 h-12 px-6 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all active:scale-95 shrink-0"
                >
                    <span className="material-symbols-outlined">add_circle</span>
                    Registrar Erro
                </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 shrink-0">
                <div className="bg-white dark:bg-card-dark p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                    <div className="size-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                        <span className="material-symbols-outlined text-2xl">list_alt</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase text-slate-400">Total de Erros</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-card-dark p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                    <div className="size-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center text-red-600">
                        <span className="material-symbols-outlined text-2xl">analytics</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase text-slate-400">Principal Diagnóstico</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {stats.mostFrequentReason 
                                ? errorReasons.find(r => r.value === stats.mostFrequentReason[0])?.label 
                                : 'Sem dados'}
                        </p>
                        {stats.mostFrequentReason && (
                            <p className="text-xs text-slate-500">{Math.round((stats.mostFrequentReason[1] / stats.total) * 100)}% dos erros</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Search and Filter Toolbar */}
            <div className="flex flex-col md:flex-row gap-3 mb-4 shrink-0 bg-white dark:bg-card-dark p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex-1 relative">
                    <input 
                        type="text" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por tópico, disciplina ou descrição..."
                        className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 outline-none text-sm transition-all"
                    />
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                </div>
                
                <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
                    <select 
                        value={filterSubject} 
                        onChange={(e) => setFilterSubject(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm rounded-lg px-3 py-2 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary/50 outline-none min-w-[150px]"
                    >
                        <option value="ALL">Todas Disciplinas</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>

                    <select 
                        value={filterReason} 
                        onChange={(e) => setFilterReason(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm rounded-lg px-3 py-2 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary/50 outline-none min-w-[150px]"
                    >
                        <option value="ALL">Todos Diagnósticos</option>
                        {errorReasons.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>

                    {hasActiveFilters && (
                        <button 
                            onClick={clearFilters}
                            className="flex items-center gap-1 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors text-sm font-bold whitespace-nowrap"
                        >
                            <span className="material-symbols-outlined text-[16px]">filter_alt_off</span>
                            Limpar
                        </button>
                    )}
                </div>
            </div>

            {/* List Area */}
            <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0c0c1d] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 custom-scrollbar">
                {filteredLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                        <span className="material-symbols-outlined text-6xl mb-4">search_off</span>
                        <p className="text-lg font-medium">Nenhum erro encontrado.</p>
                        {hasActiveFilters ? (
                            <p className="text-sm">Tente limpar os filtros ou buscar por outro termo.</p>
                        ) : (
                             <p className="text-sm">Use o botão "Registrar Erro" para começar.</p>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {filteredLogs.map(log => {
                            const reasonInfo = errorReasons.find(r => r.value === log.reason);
                            return (
                                <div key={log.id} className={`bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:shadow-lg transition-all flex flex-col gap-4 border-l-4 ${reasonInfo?.borderColor || 'border-l-gray-300'}`}>
                                    
                                    {/* Header Row */}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                        <div className="flex items-start gap-4 flex-1">
                                            <div className={`size-10 rounded-full ${reasonInfo?.color} flex items-center justify-center shrink-0`}>
                                                <span className="material-symbols-outlined text-lg">{reasonInfo?.icon}</span>
                                            </div>
                                            <div className="flex flex-col gap-0.5 w-full">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                                                        {getSubjectName(log.subjectId)}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                        {log.createdAt.toLocaleDateString()}
                                                    </span>
                                                    <span className="text-[10px] font-semibold text-slate-400 border border-slate-200 dark:border-slate-700 px-1.5 rounded">
                                                        {reasonInfo?.label}
                                                    </span>
                                                </div>
                                                <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                                    {log.topicName}
                                                </h3>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2 self-end md:self-auto">
                                            <button 
                                                onClick={() => onDeleteLog(log.id)}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                                title="Apagar registro"
                                            >
                                                <span className="material-symbols-outlined">delete</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Content Columns */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-lg border border-red-100 dark:border-red-900/20">
                                            <p className="text-xs font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-sm">cancel</span>
                                                Onde Errei
                                            </p>
                                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                                {log.description}
                                            </p>
                                        </div>
                                        <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-lg border border-green-100 dark:border-green-900/20">
                                            <p className="text-xs font-bold text-green-600 dark:text-green-400 mb-2 flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-sm">check_circle</span>
                                                Pulo do Gato
                                            </p>
                                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                                {log.correction}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {/* Footer */}
                                    {log.questionSource && (
                                        <div className="flex items-center gap-1.5 text-xs text-slate-400 pl-1 border-t border-slate-100 dark:border-slate-800 pt-3 mt-1">
                                            <span className="material-symbols-outlined text-[14px]">link</span>
                                            <span>Fonte: <span className="font-medium text-slate-500 dark:text-slate-400">{log.questionSource}</span></span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal de Adição */}
            {isAdding && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-card-dark w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 sticky top-0 z-10 backdrop-blur">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-red-500">rate_review</span>
                                Registrar Novo Erro
                            </h2>
                            <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Disciplina *</label>
                                    <select 
                                        required
                                        value={selectedSubjectId}
                                        onChange={(e) => setSelectedSubjectId(e.target.value)}
                                        className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50"
                                    >
                                        <option value="">Selecione...</option>
                                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Tópico / Assunto</label>
                                    <input 
                                        type="text"
                                        value={topicName}
                                        onChange={(e) => setTopicName(e.target.value)}
                                        placeholder="Ex: Crase"
                                        className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Fonte da Questão</label>
                                    <input 
                                        type="text"
                                        value={questionSource}
                                        onChange={(e) => setQuestionSource(e.target.value)}
                                        placeholder="Ex: CESPE 2024 - Polícia Federal"
                                        className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Diagnóstico do Erro</label>
                                    <select 
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value as ErrorReason)}
                                        className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50"
                                    >
                                        {errorReasons.map(r => (
                                            <option key={r.value} value={r.value}>{r.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold uppercase text-red-500">Por que eu errei? (Análise)</label>
                                <textarea 
                                    required
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Ex: Achei que era caso facultativo, mas era obrigatório..."
                                    rows={3}
                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500/50"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold uppercase text-green-600 dark:text-green-400">Resumo da Correção (Pulo do Gato)</label>
                                <textarea 
                                    value={correction}
                                    onChange={(e) => setCorrection(e.target.value)}
                                    placeholder="Ex: Diante de pronome possessivo feminino, a crase é facultativa."
                                    rows={3}
                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500/50"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                                <button 
                                    type="button"
                                    onClick={() => setIsAdding(false)}
                                    className="px-4 py-2 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all active:scale-95"
                                >
                                    Salvar no Caderno
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};