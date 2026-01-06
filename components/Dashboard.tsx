import React, { useMemo, useState } from 'react';
import { Screen, UserProfile, Subject, getSubjectIcon, ErrorLog } from '../types';

interface DashboardProps {
    onNavigate: (screen: Screen) => void;
    user: UserProfile;
    subjects: Subject[];
    errorLogs?: ErrorLog[];
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, user, subjects, errorLogs = [] }) => {
    const firstName = user.name.split(' ')[0];
    const [aiInsight, setAiInsight] = useState<string | null>(null);
    const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);

    // Cálculos Estatísticos e de Planejamento
    const data = useMemo(() => {
        const activeSubjects = subjects.filter(s => s.active);
        
        // 1. Meta do Dia (Simulação do Algoritmo de Prioridade)
        const todaysPlan = activeSubjects
            .sort((a, b) => {
                const priorityWeight = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
                const pA = priorityWeight[a.priority || 'MEDIUM'];
                const pB = priorityWeight[b.priority || 'MEDIUM'];
                if (pA === pB) {
                    const progressA = a.topics.length > 0 ? a.topics.filter(t => t.completed).length / a.topics.length : 1;
                    const progressB = b.topics.length > 0 ? b.topics.filter(t => t.completed).length / b.topics.length : 1;
                    return progressA - progressB;
                }
                return pB - pA;
            })
            .slice(0, 3)
            .map(sub => {
                const nextTopic = sub.topics.find(t => !t.completed);
                return {
                    subject: sub,
                    nextTopic: nextTopic,
                    remainingTopics: sub.topics.filter(t => !t.completed).length
                };
            });

        // 2. Métricas de Desempenho (Questões e Acertos)
        let totalQuestions = 0;
        let totalCorrect = 0;
        let totalStudyMinutes = 0;

        const performanceBySubject = activeSubjects.map(sub => {
            let subQuestions = 0;
            let subCorrect = 0;
            let subMinutes = 0;

            if (sub.logs) {
                sub.logs.forEach(log => {
                    subQuestions += log.questionsCount;
                    subCorrect += log.correctCount;
                    subMinutes += log.durationMinutes;
                });
            }

            totalQuestions += subQuestions;
            totalCorrect += subCorrect;
            totalStudyMinutes += subMinutes;

            const accuracy = subQuestions > 0 ? Math.round((subCorrect / subQuestions) * 100) : 0;
            const explicitErrors = errorLogs.filter(e => e.subjectId === sub.id).length;

            return {
                id: sub.id,
                name: sub.name,
                color: sub.color || 'blue',
                questions: subQuestions,
                correct: subCorrect,
                accuracy: accuracy,
                minutes: subMinutes,
                explicitErrors: explicitErrors
            };
        }).sort((a, b) => b.minutes - a.minutes); 

        // 3. Radar de Atenção (Ranking de Urgência)
        const attentionRanking = performanceBySubject
            .map(sub => {
                // Cálculo de Urgência
                let urgencyScore = (100 - sub.accuracy);
                if (sub.questions === 0) urgencyScore = 50;
                urgencyScore += (sub.explicitErrors * 5); 
                if (sub.minutes > 120 && sub.accuracy < 60) urgencyScore += 20;
                return { ...sub, urgencyScore };
            })
            .sort((a, b) => b.urgencyScore - a.urgencyScore)
            .filter(sub => sub.urgencyScore > 0) 
            .slice(0, 4); 

        const globalAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

        // 4. Dados para Curva de Aprendizagem (Histórico Diário)
        const dailyStats: Record<string, { totalQ: number; totalC: number }> = {};
        activeSubjects.forEach(sub => {
            if (sub.logs) {
                sub.logs.forEach(log => {
                    const dateKey = new Date(log.date).toISOString().split('T')[0];
                    if (!dailyStats[dateKey]) dailyStats[dateKey] = { totalQ: 0, totalC: 0 };
                    dailyStats[dateKey].totalQ += log.questionsCount;
                    dailyStats[dateKey].totalC += log.correctCount;
                });
            }
        });

        const historyData = Object.entries(dailyStats)
            .map(([dateStr, stats]) => {
                const dateObj = new Date(dateStr);
                // Ajuste de fuso horário simples para exibição correta do dia
                const userTimezoneOffset = dateObj.getTimezoneOffset() * 60000;
                const adjustedDate = new Date(dateObj.getTime() + userTimezoneOffset);
                
                return {
                    date: adjustedDate.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' }),
                    rawDate: new Date(dateStr),
                    accuracy: stats.totalQ > 0 ? Math.round((stats.totalC / stats.totalQ) * 100) : 0
                };
            })
            .sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime())
            .slice(-10); // Últimos 10 dias com atividade

        return {
            todaysPlan,
            performanceBySubject,
            attentionRanking,
            historyData,
            global: {
                totalQuestions,
                totalCorrect,
                accuracy: globalAccuracy,
                totalStudyHours: (totalStudyMinutes / 60).toFixed(1)
            }
        };
    }, [subjects, errorLogs]);

    const getAccuracyColor = (acc: number) => {
        if (acc >= 80) return 'text-green-600 bg-green-500';
        if (acc >= 60) return 'text-yellow-600 bg-yellow-500';
        return 'text-red-600 bg-red-500';
    };

    const generateAiInsights = async () => {
        // Validação da Chave API
        if (!user.openAiApiKey) {
            alert("Atenção: Nenhuma chave de API encontrada. Por favor, configure sua OpenAI Key no seu perfil (clique na sua foto no menu lateral).");
            return;
        }

        const cleanApiKey = user.openAiApiKey.trim().replace(/[^\x00-\x7F]/g, "");
        
        if (!cleanApiKey.startsWith('sk-')) {
            alert("Erro: A chave de API parece inválida. Certifique-se de que ela começa com 'sk-' e não contém espaços extras.");
            return;
        }

        setIsGeneratingInsight(true);

        try {
            const context = data.attentionRanking.map(s => 
                `- ${s.name}: Acurácia ${s.accuracy}% (${s.questions} questões), ${s.explicitErrors} erros registrados no caderno, Tempo estudado: ${s.minutes} min.`
            ).join('\n');

            const prompt = `
                Aja como um mentor de estudos de alta performance.
                Analise os dados das disciplinas críticas do aluno abaixo e forneça um diagnóstico estratégico RÁPIDO (máx 3 frases por disciplina) e uma dica geral.
                
                DISCIPLINAS CRÍTICAS:
                ${context}

                Retorne em formato HTML simples (sem tags html/body, apenas p, strong, ul, li).
            `;

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cleanApiKey}`
                },
                body: JSON.stringify({
                    model: user.openAiModel || 'gpt-4o-mini',
                    messages: [
                        { role: "system", content: "Você é um estrategista de concursos." },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || "Erro desconhecido na API da OpenAI");
            }
            
            const resData = await response.json();
            setAiInsight(resData.choices[0].message.content);

        } catch (error: any) {
            console.error(error);
            alert(`Falha ao gerar insights: ${error.message}`);
        } finally {
            setIsGeneratingInsight(false);
        }
    };

    // Componente Interno do Gráfico
    const LearningCurveChart = () => {
        if (data.historyData.length < 2) return (
            <div className="flex flex-col items-center justify-center h-48 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
                <span className="material-symbols-outlined text-3xl mb-2">show_chart</span>
                <p className="text-xs">Estude por pelo menos 2 dias para visualizar sua curva.</p>
            </div>
        );

        const height = 200;
        const width = 600;
        const paddingX = 30;
        const paddingY = 20;
        const maxY = 100;
        
        const getX = (index: number) => paddingX + (index * ((width - paddingX * 2) / (data.historyData.length - 1)));
        const getY = (value: number) => height - paddingY - ((value / maxY) * (height - paddingY * 2));

        const points = data.historyData.map((d, i) => `${getX(i)},${getY(d.accuracy)}`).join(' ');
        const targetY = getY(80);

        return (
            <div className="w-full bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">trending_up</span>
                        Curva de Aprendizagem
                    </h4>
                    <span className="text-[10px] font-medium px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                        Meta: 80%
                    </span>
                </div>
                <div className="relative w-full aspect-[3/1] min-h-[180px]">
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                        {/* Linhas de Grade */}
                        {[0, 20, 40, 60, 100].map(val => (
                            <g key={val}>
                                <line x1={paddingX} y1={getY(val)} x2={width - paddingX} y2={getY(val)} stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="1" />
                                <text x={paddingX - 10} y={getY(val) + 3} className="text-[8px] fill-slate-400 text-right">{val}%</text>
                            </g>
                        ))}

                        {/* LINHA DE META (80%) */}
                        <line x1={paddingX} y1={targetY} x2={width - paddingX} y2={targetY} stroke="currentColor" className="text-green-500/50" strokeWidth="2" strokeDasharray="6,4" />
                        <text x={width - paddingX + 5} y={targetY + 3} className="text-[9px] fill-green-600 dark:fill-green-400 font-bold">80%</text>

                        {/* Linha do Gráfico */}
                        <polyline points={points} fill="none" stroke="currentColor" className="text-primary" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                        {/* Pontos de Dados */}
                        {data.historyData.map((d, i) => (
                            <g key={i} className="group">
                                <circle cx={getX(i)} cy={getY(d.accuracy)} r="4" className="fill-white dark:fill-card-dark stroke-primary stroke-2 hover:r-6 transition-all" />
                                {/* Tooltip */}
                                <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    <rect x={getX(i) - 18} y={getY(d.accuracy) - 30} width="36" height="20" rx="4" className="fill-slate-800 dark:fill-white" />
                                    <text x={getX(i)} y={getY(d.accuracy) - 16} className="text-[10px] fill-white dark:fill-slate-900 font-bold" textAnchor="middle">{d.accuracy}%</text>
                                </g>
                                <text x={getX(i)} y={height} className="text-[9px] fill-slate-400" textAnchor="middle">{d.date}</text>
                            </g>
                        ))}
                    </svg>
                </div>
            </div>
        );
    };

    return (
        <div className="w-full max-w-[1400px] mx-auto p-4 md:p-8 flex flex-col gap-8 pb-20 overflow-y-auto custom-scrollbar">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">Dashboard</h2>
                    <p className="text-slate-500 dark:text-slate-400">
                        Visão geral do seu plano para <span className="font-bold text-primary">Hoje</span> e seu desempenho acumulado.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => onNavigate(Screen.DYNAMIC_SCHEDULE)}
                        className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        Ver Calendário Completo
                    </button>
                </div>
            </div>

            {/* SEÇÃO 1: RADAR DE ATENÇÃO */}
            <div className="flex flex-col gap-4">
                 <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-red-500 animate-pulse">crisis_alert</span>
                    Radar de Atenção
                </h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Lista de Ranking */}
                    <div className="lg:col-span-2 bg-white dark:bg-card-dark rounded-xl border border-red-100 dark:border-red-900/20 shadow-sm p-5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <span className="material-symbols-outlined text-9xl text-red-500">warning</span>
                        </div>
                        
                        <div className="relative z-10">
                            <p className="text-sm text-slate-500 mb-4">Baseado na sua taxa de erros e tempo de dedicação, estas disciplinas precisam de reforço imediato.</p>
                            
                            {data.attentionRanking.length === 0 ? (
                                <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium flex items-center gap-2">
                                    <span className="material-symbols-outlined">check_circle</span>
                                    Tudo sob controle! Nenhuma disciplina crítica detectada no momento.
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {data.attentionRanking.map((sub, idx) => (
                                        <div key={sub.id} className="flex items-center gap-4 p-3 bg-background-light dark:bg-background-dark/50 rounded-lg border border-slate-100 dark:border-slate-800/50">
                                            <div className="flex items-center justify-center size-8 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 font-bold text-sm shrink-0">
                                                #{idx + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-1">
                                                    <h4 className="font-bold text-slate-900 dark:text-white truncate">{sub.name}</h4>
                                                    <span className="text-[10px] uppercase font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">
                                                        Urgência Alta
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                                        {100 - sub.accuracy}% Erro
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[14px]">assignment_late</span>
                                                        {sub.explicitErrors} Registros
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                                                        {sub.minutes} min
                                                    </span>
                                                </div>
                                                {/* Visual Bar */}
                                                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                                                    <div className="bg-red-500 h-full rounded-full" style={{ width: `${Math.min(sub.urgencyScore, 100)}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Card de Insight IA */}
                    <div className="lg:col-span-1 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl shadow-lg text-white p-6 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-2xl">psychology</span>
                                <h3 className="font-bold text-lg">Diagnóstico IA</h3>
                            </div>
                            
                            {aiInsight ? (
                                <div className="text-sm leading-relaxed opacity-90 max-h-[200px] overflow-y-auto custom-scrollbar pr-2" dangerouslySetInnerHTML={{ __html: aiInsight }}></div>
                            ) : (
                                <p className="text-sm opacity-80">
                                    Peça à IA para analisar seus dados de erro e sugerir uma estratégia de recuperação para as disciplinas críticas.
                                </p>
                            )}
                        </div>

                        <button 
                            onClick={generateAiInsights}
                            disabled={isGeneratingInsight || data.attentionRanking.length === 0}
                            className="mt-4 w-full py-2.5 bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold text-sm backdrop-blur-sm transition-all flex items-center justify-center gap-2"
                        >
                            {isGeneratingInsight ? (
                                <span className="size-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></span>
                            ) : (
                                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                            )}
                            {isGeneratingInsight ? 'Analisando...' : 'Gerar Estratégia'}
                        </button>
                    </div>
                </div>
            </div>

            {/* SEÇÃO 2: META DO DIA */}
            <div className="flex flex-col gap-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">today</span>
                    Meta do Dia: Tópicos Programados
                </h3>
                
                {data.todaysPlan.length === 0 ? (
                    <div className="p-8 bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                        <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">event_available</span>
                        <p className="text-slate-500">Nenhuma disciplina ativa encontrada para hoje. Configure suas matérias.</p>
                        <button onClick={() => onNavigate(Screen.SUBJECTS)} className="mt-4 text-primary font-bold text-sm hover:underline">Ir para Disciplinas</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {data.todaysPlan.map((item, idx) => (
                            <div key={item.subject.id} className="relative bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between h-full">
                                <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl bg-primary/0 group-hover:bg-primary transition-colors"></div>
                                
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className={`size-10 rounded-lg flex items-center justify-center bg-${item.subject.color}-100 dark:bg-${item.subject.color}-900/30 text-${item.subject.color}-600`}>
                                            <span className="material-symbols-outlined">{getSubjectIcon(item.subject.name)}</span>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase`}>
                                            {item.subject.priority === 'HIGH' ? 'Prioridade Alta' : 'Programado'}
                                        </span>
                                    </div>
                                    
                                    <h4 className="font-bold text-slate-900 dark:text-white text-lg leading-tight mb-1 truncate" title={item.subject.name}>
                                        {item.subject.name}
                                    </h4>
                                    
                                    <div className="min-h-[3rem]">
                                        <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Próximo Tópico:</p>
                                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300 line-clamp-2" title={item.nextTopic?.name}>
                                            {item.nextTopic ? item.nextTopic.name : <span className="text-green-500 italic">Disciplina Finalizada! Revisar.</span>}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                    <span className="text-xs text-slate-400">
                                        {item.remainingTopics} tópicos restantes
                                    </span>
                                    <button 
                                        onClick={() => onNavigate(Screen.STUDY_PLAYER)}
                                        className="size-8 rounded-full bg-primary text-white flex items-center justify-center hover:bg-blue-600 transition-colors shadow-lg shadow-primary/20 active:scale-95"
                                        title="Começar agora"
                                    >
                                        <span className="material-symbols-outlined text-lg">play_arrow</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* SEÇÃO 3: DESEMPENHO GERAL E EVOLUÇÃO */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Métricas Globais */}
                <div className="lg:col-span-1 flex flex-col gap-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">monitoring</span>
                        Métricas Globais
                    </h3>
                    
                    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col items-center justify-center gap-6">
                        {/* Circular Progress Big */}
                        <div className="relative size-40">
                            <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                                <path className="text-slate-100 dark:text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                                <path 
                                    className={`${data.global.accuracy >= 80 ? 'text-green-500' : data.global.accuracy >= 60 ? 'text-yellow-500' : 'text-red-500'} transition-all duration-1000 ease-out`}
                                    strokeDasharray={`${data.global.accuracy}, 100`} 
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="3" 
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-4xl font-black text-slate-900 dark:text-white">{data.global.accuracy}%</span>
                                <span className="text-[10px] uppercase font-bold text-slate-400">Taxa de Acerto</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 w-full">
                            <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                <p className="text-xs text-slate-400 uppercase font-bold">Questões</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">{data.global.totalQuestions}</p>
                            </div>
                            <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                <p className="text-xs text-slate-400 uppercase font-bold">Horas</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">{data.global.totalStudyHours}h</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Evolução e Desempenho */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">leaderboard</span>
                        Evolução e Detalhes
                    </h3>

                    {/* Novo Gráfico de Curva de Aprendizagem */}
                    <LearningCurveChart />

                    {/* Tabela de Desempenho */}
                    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full max-h-[400px]">
                        <div className="overflow-y-auto custom-scrollbar p-1">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase font-bold text-slate-400 sticky top-0 z-10">
                                    <tr>
                                        <th className="p-4">Matéria</th>
                                        <th className="p-4 text-center">Questões</th>
                                        <th className="p-4 w-1/3">Acurácia</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {data.performanceBySubject.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="p-8 text-center text-slate-400">
                                                Nenhum dado de estudo registrado ainda. Comece a estudar para ver suas métricas!
                                            </td>
                                        </tr>
                                    ) : (
                                        data.performanceBySubject.map((item) => (
                                            <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`size-2 rounded-full bg-${item.color}-500 shadow-[0_0_8px_rgba(0,0,0,0.3)] shadow-${item.color}-500`}></div>
                                                        <span className="font-bold text-slate-700 dark:text-slate-200">{item.name}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center font-mono text-slate-600 dark:text-slate-400">
                                                    {item.questions} <span className="text-xs text-slate-400">({item.correct} ok)</span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full rounded-full ${getAccuracyColor(item.accuracy).split(' ')[1]}`} 
                                                                style={{ width: `${item.accuracy}%` }}
                                                            ></div>
                                                        </div>
                                                        <span className={`text-xs font-bold w-10 text-right ${getAccuracyColor(item.accuracy).split(' ')[0]}`}>
                                                            {item.accuracy}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};