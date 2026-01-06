import React, { useState } from 'react';
import { SavedNote } from '../types';

interface SavedNotesProps {
    notes: SavedNote[];
    onDeleteNote: (id: string) => void;
}

export const SavedNotes: React.FC<SavedNotesProps> = ({ notes, onDeleteNote }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredNotes = notes.filter(note => 
        note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.subjectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.topicName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Conteúdo copiado para a área de transferência!');
    };

    return (
        <div className="flex-1 w-full max-w-[1400px] mx-auto p-4 md:p-8 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 shrink-0">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <span className="material-symbols-outlined text-4xl text-amber-500">lightbulb</span>
                        Insights do Tutor
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-base">
                        Sua coleção de explicações, resumos e dicas salvas durante as sessões de estudo com a IA.
                    </p>
                </div>
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Buscar nas notas..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-card-dark text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50 outline-none w-full md:w-64"
                    />
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                </div>
            </div>

            {/* Grid de Notas */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
                {filteredNotes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl min-h-[400px]">
                        <span className="material-symbols-outlined text-6xl mb-4">bookmarks</span>
                        <p className="text-lg font-medium">Nenhum insight salvo ainda.</p>
                        <p className="text-sm">Use o botão de "Salvar" no chat do Tutor IA durante seus estudos.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredNotes.map(note => (
                            <div key={note.id} className="group flex flex-col bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl p-5 shadow-sm hover:shadow-md transition-all relative">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 truncate max-w-[200px]">
                                            {note.subjectName}
                                        </span>
                                        <span className="text-xs text-amber-500/80 dark:text-amber-400/60 truncate max-w-[200px]">
                                            {note.topicName}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-black/20 rounded-lg p-1">
                                        <button 
                                            onClick={() => handleCopy(note.content)}
                                            className="p-1.5 text-slate-400 hover:text-primary rounded-md transition-colors"
                                            title="Copiar texto"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">content_copy</span>
                                        </button>
                                        <button 
                                            onClick={() => onDeleteNote(note.id)}
                                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-md transition-colors"
                                            title="Excluir nota"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="flex-1 bg-white dark:bg-[#1a1a2e] rounded-lg p-3 border border-amber-100 dark:border-amber-900/20 text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto custom-scrollbar">
                                    {note.content}
                                </div>

                                <div className="mt-3 flex justify-between items-center text-[10px] text-amber-500/60 font-medium">
                                    <span>Salvo em {note.createdAt.toLocaleDateString()}</span>
                                    <span className="material-symbols-outlined text-[16px]">bookmark_added</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};