import React from 'react';

export const TimeAnamnesis: React.FC = () => {
    return (
        <div className="p-4 md:p-8 lg:px-20 lg:py-10 max-w-[1400px] mx-auto">
            <div className="flex flex-col gap-6 mb-10 max-w-4xl">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-primary text-sm font-semibold uppercase tracking-wider">
                        <span className="material-symbols-outlined text-lg">timeline</span>
                        <span>Passo 2 de 4: Bases da Rotina</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-[#0d0d1b] dark:text-white">
                        Anamnese Temporal
                    </h1>
                    <p className="text-[#4c4c9a] dark:text-[#a0a0b0] text-lg max-w-2xl leading-relaxed">
                        Não podemos criar tempo, mas podemos orçá-lo. Vamos calcular seu <span className="font-semibold text-primary">Teto Realista</span> com base em seus compromissos fixos.
                    </p>
                </div>
                <div className="w-full max-w-md h-2 rounded-full bg-[#cfcfe7] dark:bg-[#2d2d3b] overflow-hidden">
                    <div className="h-full rounded-full bg-primary w-1/2 shadow-[0_0_10px_rgba(43,43,238,0.5)]"></div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                <div className="lg:col-span-7 flex flex-col gap-6">
                     {[
                         { icon: 'bedtime', title: 'Sono', sub: 'Média de horas por noite', val: '7.5h', color: 'text-primary', rangeColor: 'accent-primary', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
                         { icon: 'work', title: 'Trabalho e Educação', sub: 'Compromissos diários fixos', val: '8.0h', color: 'text-orange-600 dark:text-orange-400', rangeColor: 'accent-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/30' },
                         { icon: 'commute', title: 'Deslocamento', sub: 'Tempo total de viagem por dia', val: '1.5h', color: 'text-teal-600 dark:text-teal-400', rangeColor: 'accent-teal-600', bg: 'bg-teal-50 dark:bg-teal-900/30' },
                     ].map((item, i) => (
                        <div key={i} className="group bg-white dark:bg-[#1a1a2e] p-6 rounded-xl border border-[#e7e7f3] dark:border-[#2d2d3b] shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex gap-4">
                                    <div className={`size-10 rounded-full ${item.bg} flex items-center justify-center ${item.color.split(' ')[0]}`}>
                                        <span className="material-symbols-outlined">{item.icon}</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold">{item.title}</h3>
                                        <p className="text-sm text-[#4c4c9a] dark:text-[#a0a0b0]">{item.sub}</p>
                                    </div>
                                </div>
                                <span className={`text-2xl font-bold font-mono ${item.color}`}>{item.val}</span>
                            </div>
                            <div className="relative h-6 flex items-center">
                                <input className={`w-full h-2 bg-[#cfcfe7] dark:bg-[#2d2d3b] rounded-lg appearance-none cursor-pointer ${item.rangeColor}`} type="range"/>
                            </div>
                        </div>
                     ))}
                </div>

                <div className="lg:col-span-5 relative">
                    <div className="sticky top-28 flex flex-col gap-6">
                        <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl shadow-xl shadow-primary/5 border border-[#e7e7f3] dark:border-[#2d2d3b] overflow-hidden">
                            <div className="p-6 border-b border-[#e7e7f3] dark:border-[#2d2d3b]">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">pie_chart</span>
                                    Seu Orçamento de 24h
                                </h2>
                            </div>
                            <div className="p-6 flex flex-col gap-6">
                                <div className="flex flex-col gap-2">
                                    <div className="flex h-12 w-full rounded-lg overflow-hidden bg-[#f0f0f5] dark:bg-[#222233] border border-[#e7e7f3] dark:border-[#2d2d3b]">
                                        <div className="h-full bg-primary/80 flex items-center justify-center text-xs text-white font-medium" style={{width:'31%'}}>Sono</div>
                                        <div className="h-full bg-orange-400 flex items-center justify-center text-xs text-white font-medium" style={{width:'33%'}}>Trabalho</div>
                                        <div className="h-full bg-emerald-100 dark:bg-emerald-900/20 flex flex-1 items-center justify-center text-xs text-emerald-700 dark:text-emerald-400 font-bold relative overflow-hidden">
                                            Disponível
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-xs text-[#4c4c9a] dark:text-[#a0a0b0]">
                                        <span>0h</span>
                                        <span>12h</span>
                                        <span>24h</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-xl bg-[#f8f8fc] dark:bg-[#151525]">
                                        <p className="text-xs font-semibold uppercase text-[#4c4c9a] dark:text-[#a0a0b0] mb-1">Total Fixo</p>
                                        <p className="text-2xl font-black text-[#0d0d1b] dark:text-white">19.5h</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/10">
                                        <p className="text-xs font-semibold uppercase text-primary mb-1">Horas Líquidas</p>
                                        <p className="text-3xl font-black text-primary">4.5h</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};