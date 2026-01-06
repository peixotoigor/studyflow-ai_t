import React from 'react';

export const AlgorithmicCycle: React.FC = () => {
    return (
        <div className="flex-1 flex flex-col max-w-[1440px] mx-auto w-full px-6 lg:px-12 py-8 overflow-y-auto">
            <div className="flex flex-wrap justify-between items-end gap-6 mb-8">
                <div className="flex min-w-72 flex-col gap-2">
                    <div className="flex items-center gap-2 text-primary font-medium text-sm">
                        <span className="material-symbols-outlined text-lg">autorenew</span>
                        <span>Ciclo Ativo: Semana 4</span>
                    </div>
                    <h1 className="text-[#0d0d1b] dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]">Motor Central</h1>
                    <p className="text-[#4c4c9a] dark:text-gray-400 text-base font-normal leading-normal max-w-2xl">Visualização em tempo real da sua fila de estudos. O algoritmo prioriza tópicos com base no seu desempenho e na curva de esquecimento.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
                <div className="lg:col-span-7 flex flex-col gap-6">
                    <div className="relative bg-white dark:bg-[#1a1a2e] rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col">
                        <div className="absolute inset-0 z-0 opacity-10 dark:opacity-20 pointer-events-none" style={{background: 'radial-gradient(circle at top right, #2b2bee 0%, transparent 40%)'}}></div>
                        <div className="relative z-10 p-6 flex flex-col gap-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-primary text-white mb-3">
                                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                                        BLOCO ATUAL
                                    </span>
                                    <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Direito Constitucional</h2>
                                    <p className="text-lg text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-base">topic</span>
                                        Tópico: Controle de Constitucionalidade
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Prioridade</span>
                                    <div className="flex gap-1">
                                        <div className="w-2 h-6 rounded-sm bg-red-500"></div>
                                        <div className="w-2 h-6 rounded-sm bg-red-500"></div>
                                        <div className="w-2 h-6 rounded-sm bg-red-500/30"></div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-background-light dark:bg-[#101022] rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                                <div className="flex gap-4 justify-center items-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="bg-white dark:bg-[#1a1a2e] w-20 h-24 rounded-lg flex items-center justify-center text-4xl font-bold text-gray-800 dark:text-gray-100 shadow-sm border-b-4 border-gray-200 dark:border-gray-700">00</div>
                                    </div>
                                    <span className="text-3xl font-bold text-gray-300 dark:text-gray-600 -mt-6">:</span>
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="bg-white dark:bg-[#1a1a2e] w-20 h-24 rounded-lg flex items-center justify-center text-4xl font-bold text-primary shadow-sm border-b-4 border-primary/30">50</div>
                                    </div>
                                    <span className="text-3xl font-bold text-gray-300 dark:text-gray-600 -mt-6">:</span>
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="bg-white dark:bg-[#1a1a2e] w-20 h-24 rounded-lg flex items-center justify-center text-4xl font-bold text-gray-800 dark:text-gray-100 shadow-sm border-b-4 border-gray-200 dark:border-gray-700">00</div>
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={() => alert("Iniciando bloco de estudo...")}
                                className="flex-1 flex items-center justify-center gap-2 h-14 bg-primary hover:bg-blue-700 text-white rounded-lg text-lg font-bold shadow-lg shadow-primary/30 transition-all transform active:scale-[0.98]"
                            >
                                <span className="material-symbols-outlined">play_circle</span>
                                Iniciar Bloco
                            </button>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-5 flex flex-col h-full">
                    <div className="bg-white dark:bg-[#1a1a2e] rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col h-full">
                        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">change_circle</span>
                                    Fila Circular
                                </h3>
                            </div>
                            <div className="flex gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm">
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                    Intercalação Ativa
                                </span>
                            </div>
                        </div>
                        <div className="flex-1 p-5 overflow-y-auto relative">
                             <div className="absolute left-[39px] top-6 bottom-6 w-[2px] bg-gray-100 dark:bg-gray-800 z-0"></div>
                             <div className="space-y-6 relative z-10">
                                {[
                                    { time: '10:00', title: 'Língua Portuguesa', sub: 'Sintaxe', color: 'bg-purple-100 text-purple-600', border: 'hover:border-purple-300' },
                                    { time: '11:00', title: 'Raciocínio Lógico', sub: 'Tabelas Verdade', color: 'bg-teal-100 text-teal-600', border: 'hover:border-teal-300' },
                                ].map((item, i) => (
                                    <div key={i} className="flex gap-4 group cursor-pointer" onClick={() => alert(`Detalhes de ${item.title}`)}>
                                        <div className="flex flex-col items-center gap-1 min-w-[32px]">
                                            <div className={`w-10 h-10 rounded-full ${item.color.split(' ')[0]} dark:bg-opacity-30 ${item.color.split(' ')[1]} flex items-center justify-center border-2 border-white dark:border-[#1a1a2e] shadow-sm`}>
                                                <span className="material-symbols-outlined text-lg">book</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-400 mt-1">{item.time}</span>
                                        </div>
                                        <div className={`flex-1 bg-white dark:bg-[#15152a] p-3 rounded-lg border border-gray-200 dark:border-gray-700 ${item.border} transition-colors shadow-sm`}>
                                            <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm">{item.title}</h4>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{item.sub}</p>
                                        </div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};