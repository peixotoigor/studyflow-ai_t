import React from 'react';

export const Wizard: React.FC = () => {
    return (
        <div className="flex flex-1 relative overflow-hidden h-full">
            <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hidden lg:flex flex-col p-4 gap-6">
                <div className="flex flex-col gap-2">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-3">Progresso</div>
                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/10 text-primary border-l-4 border-primary">
                        <span className="material-symbols-outlined text-[20px]">schedule</span>
                        <p className="text-sm font-bold">1. Disponibilidade</p>
                    </div>
                    {['2. Disciplinas', '3. Calibragem', '4. Resultado'].map((step, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2 text-slate-500 dark:text-slate-400">
                             <span className="material-symbols-outlined text-[20px]">circle</span>
                            <p className="text-sm font-medium">{step}</p>
                        </div>
                    ))}
                </div>
            </aside>
            <main className="flex-1 overflow-y-auto bg-background-light dark:bg-background-dark p-4 md:p-8 lg:p-12 flex justify-center">
                <div className="max-w-4xl w-full flex flex-col gap-8">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">Defina sua Disponibilidade</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-lg">Para criar um ciclo realista, precisamos saber quanto tempo você pode dedicar aos estudos.</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-slate-400">calendar_today</span>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Tempo Diário (Segunda a Sexta)</h3>
                                </div>
                                <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold">4h 30min</span>
                            </div>
                            <div className="flex items-center gap-4 mb-4">
                                <span className="text-sm font-medium text-slate-500">0h</span>
                                <div className="relative flex h-4 flex-1 rounded-full bg-slate-200 dark:bg-slate-700">
                                    <div className="h-full rounded-full bg-primary relative" style={{width: '37%'}}>
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 size-6 bg-white border-2 border-primary rounded-full shadow cursor-pointer hover:scale-110 transition-transform"></div>
                                    </div>
                                </div>
                                <span className="text-sm font-medium text-slate-500">12h</span>
                            </div>
                        </div>
                        <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Estudar aos Finais de Semana?</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Ciclos maiores podem incluir sábados para revisão.</p>
                                </div>
                                <label className="inline-flex items-center cursor-pointer">
                                    <input defaultChecked className="sr-only peer" type="checkbox"/>
                                    <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};