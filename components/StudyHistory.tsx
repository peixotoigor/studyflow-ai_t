import React, { useState, useMemo } from 'react';
import { Subject, StudyLog, getSubjectIcon } from '../types';

interface StudyHistoryProps {
    subjects: Subject[];
    onUpdateLog: (subjectId: string, logId: string, updatedLog: Partial<StudyLog>) => void;
    onDeleteLog: (subjectId: string, logId: string) => void;
}

export const StudyHistory: React.FC<StudyHistoryProps> = ({ subjects, onUpdateLog, onDeleteLog }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSubject, setFilterSubject] = useState('ALL');
    
    // State for Log Editing
    const [editingLogId, setEditingLogId] = useState<string | null>(null);
    const [editLogData, setEditLogData] = useState<Partial<StudyLog>>({});

    // Achatar todos os logs em uma única lista com metadados da matéria
    const allLogs = useMemo(() => {
        const flattened = subjects.flatMap(subject => 
            (subject.logs || []).map(log => ({
                ...log,
                subjectId: subject.id,
                subjectName: subject.name,
                subjectColor: subject.color || 'blue'
            }))
        );
        return flattened.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [subjects]);

    const filteredLogs = allLogs.filter(log => {
        const matchesSearch = 
            log.topicName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.subjectName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSubject = filterSubject === 'ALL' || log.subjectId === filterSubject;
        
        return matchesSearch && matchesSubject;
    });

    // --- Editing Handlers ---
    const startEditingLog = (log: any) => {
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

    return (
        <div className="flex-1 w-full max-w-[1400px] mx-auto p-4 md:p-8 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 shrink-0">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <span className="material-symbols-outlined text-4xl text-primary">history</span>
                        Histórico Global
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-base max-w-2xl">
                        Acompanhe, audite e ajuste todos os seus registros de estudo em um único lugar.
                    </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Buscar conteúdo..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-card-dark text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 outline-none w-full sm:w-64 text-sm"
                        />
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                    </div>
                    <select 
                        value={filterSubject}
                        onChange={(e) => setFilterSubject(e.target.value)}
                        className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-card-dark text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 outline-none text-sm cursor-pointer"
                    >
                        <option value="ALL">Todas Disciplinas</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Tabela de Histórico */}
            <div className="flex-1 bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-y-auto custom-scrollbar flex-1">
                    {filteredLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-400 opacity-60">
                            <span className="material-symbols-outlined text-6xl mb-4">history_edu</span>
                            <p className="text-lg font-medium">Nenhum registro encontrado.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm border-collapse">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 dark:text-slate-400 font-bold sticky top-0 z-10 backdrop-blur-sm">
                                <tr>
                                    <th className="p-4 rounded-tl-lg">Data</th>
                                    <th className="p-4">Disciplina</th>
                                    <th className="p-4">Tópico / Conteúdo</th>
                                    <th className="p-4 text-center">Tempo</th>
                                    <th className="p-4 text-center">Desempenho</th>
                                    <th className="p-4 text-right rounded-tr-lg">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredLogs.map(log => {
                                    const isEditing = editingLogId === log.id;
                                    const accuracy = (editLogData.questionsCount || log.questionsCount) > 0 
                                        ? Math.round(((editLogData.correctCount ?? log.correctCount) / (editLogData.questionsCount ?? log.questionsCount)) * 100) 
                                        : 0;

                                    return (
                                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                                            {isEditing ? (
                                                // --- EDIT MODE ---
                                                <>
                                                    <td className="p-4">
                                                        <input 
                                                            type="date" 
                                                            value={editLogData.date ? new Date(editLogData.date).toISOString().split('T')[0] : ''}
                                                            onChange={e => setEditLogData({...editLogData, date: new Date(e.target.value)})}
                                                            className="w-full text-xs p-1.5 rounded border border-primary/50 bg-white dark:bg-black/20"
                                                        />
                                                    </td>
                                                    <td className="p-4 text-slate-400 text-xs italic">
                                                        {log.subjectName} (Fixo)
                                                    </td>
                                                    <td className="p-4">
                                                        <input 
                                                            type="text" 
                                                            value={editLogData.topicName}
                                                            onChange={e => setEditLogData({...editLogData, topicName: e.target.value})}
                                                            className="w-full text-xs p-1.5 rounded border border-primary/50 bg-white dark:bg-black/20"
                                                        />
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <div className="flex items-center gap-1 justify-center">
                                                            <input 
                                                                type="number" 
                                                                min="1"
                                                                value={editLogData.durationMinutes}
                                                                onChange={e => setEditLogData({...editLogData, durationMinutes: parseInt(e.target.value)})}
                                                                className="w-16 text-xs p-1.5 rounded border border-primary/50 bg-white dark:bg-black/20 text-center"
                                                            />
                                                            <span className="text-[10px]">min</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <div className="flex flex-col gap-1 items-center">
                                                            <div className="flex items-center gap-1">
                                                                <input 
                                                                    type="number" min="0"
                                                                    value={editLogData.questionsCount}
                                                                    onChange={e => setEditLogData({...editLogData, questionsCount: parseInt(e.target.value)})}
                                                                    className="w-12 text-xs p-1 rounded border border-primary/50 bg-white dark:bg-black/20 text-center"
                                                                    placeholder="Tot"
                                                                />
                                                                <span className="text-gray-400">/</span>
                                                                <input 
                                                                    type="number" min="0" max={editLogData.questionsCount}
                                                                    value={editLogData.correctCount}
                                                                    onChange={e => setEditLogData({...editLogData, correctCount: parseInt(e.target.value)})}
                                                                    className="w-12 text-xs p-1 rounded border border-green-500/50 bg-white dark:bg-black/20 text-center"
                                                                    placeholder="OK"
                                                                />
                                                            </div>
                                                            <span className={`text-[10px] font-bold ${accuracy >= 80 ? 'text-green-500' : accuracy >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                                                                {accuracy}% Acerto
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <div className="flex justify-end gap-1">
                                                            <button onClick={() => saveEditingLog(log.subjectId)} className="p-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded hover:bg-green-200"><span className="material-symbols-outlined text-[18px]">check</span></button>
                                                            <button onClick={cancelEditingLog} className="p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200"><span className="material-symbols-outlined text-[18px]">close</span></button>
                                                        </div>
                                                    </td>
                                                </>
                                            ) : (
                                                // --- VIEW MODE ---
                                                <>
                                                    <td className="p-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                        {new Date(log.date).toLocaleDateString()}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`size-8 rounded flex items-center justify-center bg-${log.subjectColor}-100 dark:bg-${log.subjectColor}-900/30 text-${log.subjectColor}-600`}>
                                                                <span className="material-symbols-outlined text-[16px]">{getSubjectIcon(log.subjectName)}</span>
                                                            </div>
                                                            <span className="font-bold text-slate-700 dark:text-slate-200 text-xs md:text-sm truncate max-w-[150px]" title={log.subjectName}>
                                                                {log.subjectName}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 font-medium text-slate-800 dark:text-white truncate max-w-[200px]" title={log.topicName}>
                                                        {log.topicName}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono">
                                                            {log.durationMinutes} min
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        {log.questionsCount > 0 ? (
                                                            <div className="flex flex-col items-center">
                                                                <div className="flex items-baseline gap-1">
                                                                    <span className="font-bold text-slate-900 dark:text-white">{log.correctCount}</span>
                                                                    <span className="text-xs text-slate-400">/ {log.questionsCount}</span>
                                                                </div>
                                                                <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full mt-1 overflow-hidden">
                                                                    <div 
                                                                        className={`h-full ${
                                                                            (log.correctCount/log.questionsCount) >= 0.8 ? 'bg-green-500' : 
                                                                            (log.correctCount/log.questionsCount) >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                                                                        }`} 
                                                                        style={{ width: `${(log.correctCount/log.questionsCount)*100}%` }}
                                                                    ></div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-slate-400">-</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button 
                                                                onClick={() => startEditingLog(log)}
                                                                className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                                                title="Editar registro"
                                                            >
                                                                <span className="material-symbols-outlined text-[18px]">edit</span>
                                                            </button>
                                                            <button 
                                                                onClick={() => onDeleteLog(log.subjectId, log.id)}
                                                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                                title="Apagar registro"
                                                            >
                                                                <span className="material-symbols-outlined text-[18px]">delete</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 text-xs text-slate-500 flex justify-between">
                    <span>Total de Registros: {filteredLogs.length}</span>
                    <span>Mostrando mais recentes primeiro</span>
                </div>
            </div>
        </div>
    );
};