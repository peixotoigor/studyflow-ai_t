
import React, { useState, useMemo } from 'react';
import { Screen, UserProfile, Subject, getSubjectIcon, ErrorLog, StudyLog, Topic } from '../types';

interface DashboardProps {
    onNavigate: (screen: Screen) => void;
    user: UserProfile;
    subjects: Subject[];
    errorLogs?: ErrorLog[];
    onManualRestore?: (token: string) => Promise<void>; // Nova prop para restaurar
}

// Tipos auxiliares para o Mapa do Edital
type TopicStatus = 'NOT_SEEN' | 'SEEN' | 'REVIEWED' | 'MASTERED';

interface TopicNode {
    name: string;
    originalTopic: Topic;
    status: TopicStatus;
    accuracy: number;
    timeSpent: number;
}

interface TopicGroup {
    name: string;
    isGroup: boolean;
    children: TopicNode[];
    progress: number; // % completed/mastered inside group
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, user, subjects, errorLogs = [], onManualRestore }) => {
    const firstName = user.name.split(' ')[0];
    const [aiInsight, setAiInsight] = useState<string | null>(null);
    const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
    
    // States para o modo de recuperação
    const [showRestoreInput, setShowRestoreInput] = useState(false);
    const [manualToken, setManualToken] = useState('');
    const [isRestoring, setIsRestoring] = useState(false);

    // State para o Mapa do Edital
    const [expandedSubjectMap, setExpandedSubjectMap] = useState<string | null>(null);
    
    // State para o Gráfico de Pizza (Hover)
    const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

    // --- CÁLCULOS EM TEMPO REAL ---
    // Garante que apenas matérias ativas sejam consideradas em todo o dashboard
    const activeSubjects = useMemo(() => subjects.filter(s => s.active), [subjects]);

    // =================================================================================
    // LÓGICA DO MAPA DO EDITAL (STATUS & HIERARQUIA & MÉTRICAS)
    // =================================================================================
    
    const getTopicStatus = (subject: Subject, topic: Topic): { status: TopicStatus; accuracy: number; timeSpent: number } => {
        const logs = subject.logs?.filter(l => l.topicId === topic.id) || [];
        
        const totalMinutes = logs.reduce((a, b) => a + (b.durationMinutes || 0), 0);
        
        // 1. Not Seen
        if (!topic.completed && logs.length === 0) return { status: 'NOT_SEEN', accuracy: 0, timeSpent: 0 };

        const totalQ = logs.reduce((a, b) => a + (b.questionsCount || 0), 0);
        const totalC = logs.reduce((a, b) => a + (b.correctCount || 0), 0);
        const acc = totalQ > 0 ? (totalC / totalQ) : 0;
        
        // Datas únicas de estudo para verificar espaçamento
        const uniqueDays = new Set(logs.map(l => new Date(l.date).toDateString())).size;
        const hasReviewLog = logs.some(l => l.modalities?.includes('REVIEW'));

        let status: TopicStatus = 'SEEN';

        // 4. Mastered (Critério: >80% acerto com volume relevante ou marcado como completo com alta confiança)
        if (acc >= 0.8 && totalQ >= 5) status = 'MASTERED';
        // 3. Reviewed (Estudou em mais de 1 dia diferente OU fez sessão de revisão específica)
        else if (uniqueDays > 1 || hasReviewLog) status = 'REVIEWED';
        
        return { status, accuracy: Math.round(acc * 100), timeSpent: totalMinutes };
    };

    const processSyllabusMap = (subject: Subject): TopicGroup[] => {
        const groups: Record<string, TopicNode[]> = {};
        const rootNodes: TopicNode[] = [];

        subject.topics.forEach(topic => {
            const { status, accuracy, timeSpent } = getTopicStatus(subject, topic);
            const node: TopicNode = { name: topic.name, originalTopic: topic, status, accuracy, timeSpent };

            // Tentativa de Agrupamento Hierárquico
            const separators = [/ - /, /: /, / – /, / > /];
            let grouped = false;

            for (const sep of separators) {
                const parts = topic.name.split(sep);
                if (parts.length > 1) {
                    const groupName = parts[0].trim();
                    const subTopicName = parts.slice(1).join(' ').trim();
                    
                    if (!groups[groupName]) groups[groupName] = [];
                    groups[groupName].push({ ...node, name: subTopicName });
                    grouped = true;
                    break;
                }
            }

            if (!grouped) {
                rootNodes.push(node);
            }
        });

        const groupList: TopicGroup[] = Object.entries(groups).map(([name, children]) => {
            const completedOrSeen = children.filter(c => c.status !== 'NOT_SEEN').length;
            return {
                name,
                isGroup: true,
                children,
                progress: Math.round((completedOrSeen / children.length) * 100)
            };
        });

        const rootList: TopicGroup[] = rootNodes.map(node => ({
            name: node.name,
            isGroup: false,
            children: [node],
            progress: node.status !== 'NOT_SEEN' ? 100 : 0
        }));

        return [...groupList, ...rootList].sort((a, b) => a.name.localeCompare(b.name));
    };

    const statusConfig = {
        'NOT_SEEN': { label: 'Não Visto', color: 'bg-slate-100 dark:bg-slate-800 text-slate-400', icon: 'check_box_outline_blank' },
        'SEEN': { label: 'Visto', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400', icon: 'check_box' },
        'REVIEWED': { label: 'Revisado', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400', icon: 'cached' },
        'MASTERED': { label: 'Domínio', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400', icon: 'stars' }
    };

    // =================================================================================
    // ESTADO ZERO (RECUPERAÇÃO)
    // =================================================================================
    if (subjects.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-full bg-background-light dark:bg-background-dark animate-in fade-in duration-500">
                <div className="max-w-2xl w-full text-center space-y-8">
                    <div className="mx-auto size-24 bg-primary/10 rounded-3xl flex items-center justify-center mb-6 ring-8 ring-primary/5">
                        <span className="material-symbols-outlined text-6xl text-primary">school</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">Bem-vindo ao StudyFlow</h1>
                    <p className="text-lg text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">Seu sistema de estudo de alta performance. Configure seu plano ou restaure um backup.</p>
                    {!showRestoreInput ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                            <button onClick={() => onNavigate(Screen.IMPORTER)} className="group relative flex flex-col items-center p-6 bg-white dark:bg-card-dark border-2 border-slate-200 dark:border-slate-800 rounded-2xl hover:border-primary hover:shadow-xl transition-all">
                                <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full mb-4 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform"><span className="material-symbols-outlined text-3xl">upload_file</span></div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Novo Usuário</h3>
                            </button>
                            <button onClick={() => setShowRestoreInput(true)} className="group relative flex flex-col items-center p-6 bg-white dark:bg-card-dark border-2 border-slate-200 dark:border-slate-800 rounded-2xl hover:border-green-500 hover:shadow-xl transition-all">
                                <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full mb-4 text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform"><span className="material-symbols-outlined text-3xl">cloud_sync</span></div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Já uso o App</h3>
                            </button>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-card-dark p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md mx-auto animate-in zoom-in-95">
                            <div className="flex items-center gap-2 mb-4 text-left"><button onClick={() => setShowRestoreInput(false)} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">arrow_back</span></button><h3 className="font-bold text-lg text-slate-900 dark:text-white">Recuperação Manual</h3></div>
                            <input type="password" value={manualToken} onChange={(e) => setManualToken(e.target.value)} placeholder="ghp_..." className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-black/20 mb-4 focus:ring-2 focus:ring-primary/50 outline-none" />
                            <button onClick={async () => { if(!manualToken) return; setIsRestoring(true); if(onManualRestore) await onManualRestore(manualToken); setIsRestoring(false); }} disabled={isRestoring || !manualToken} className="w-full py-3 bg-primary hover:bg-blue-600 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">{isRestoring ? 'Buscando...' : 'Buscar e Restaurar'}</button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // --- CÁLCULOS DO DASHBOARD ---
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

    let totalQuestions = 0;
    let totalCorrect = 0;
    let totalStudyMinutes = 0;

    const performanceBySubject = activeSubjects.map(sub => {
        let subQuestions = 0;
        let subCorrect = 0;
        let subMinutes = 0;
        let lastSessionDate: Date | null = null;

        if (sub.logs && Array.isArray(sub.logs)) {
            sub.logs.forEach(log => {
                subQuestions += (log.questionsCount || 0);
                subCorrect += (log.correctCount || 0);
                subMinutes += (log.durationMinutes || 0);
                
                const logDate = new Date(log.date);
                if (!lastSessionDate || logDate > lastSessionDate) {
                    lastSessionDate = logDate;
                }
            });
        }

        const accuracy = subQuestions > 0 ? Math.round((subCorrect / subQuestions) * 100) : 0;
        const explicitErrors = errorLogs.filter(e => e.subjectId === sub.id).length;
        
        // Cálculo de dias desde o último estudo
        const daysSinceLastStudy = lastSessionDate 
            ? Math.floor((new Date().getTime() - lastSessionDate.getTime()) / (1000 * 3600 * 24)) 
            : null;

        totalQuestions += subQuestions;
        totalCorrect += subCorrect;
        totalStudyMinutes += subMinutes;

        return {
            id: sub.id,
            name: sub.name,
            color: sub.color || 'blue',
            questions: subQuestions,
            correct: subCorrect,
            accuracy: accuracy,
            minutes: subMinutes,
            explicitErrors: explicitErrors,
            daysSinceLastStudy: daysSinceLastStudy !== null ? daysSinceLastStudy : 'Nunca',
            rawDaysSince: daysSinceLastStudy !== null ? daysSinceLastStudy : 999,
            active: sub.active // Propagar status ativo
        };
    }).sort((a, b) => b.minutes - a.minutes); 

    // --- REFINAMENTO DO ALGORITMO DO RADAR DE ATENÇÃO ---
    const attentionRanking = performanceBySubject
        .filter(sub => sub.active) // Redundante pois activeSubjects já filtra, mas seguro
        .map(sub => {
            let urgencyScore = 0;
            
            // Fator 1: Baixa Acurácia (Só conta se tiver feito questões)
            if (sub.questions > 10) {
                if (sub.accuracy < 60) urgencyScore += 40;
                else if (sub.accuracy < 75) urgencyScore += 20;
            }
            
            // Fator 2: Erros Críticos Registrados
            urgencyScore += (sub.explicitErrors * 15); 
            
            // Fator 3: "Esquecimento" (Recência) - Só se já tiver estudado
            if (typeof sub.rawDaysSince === 'number' && sub.rawDaysSince > 7 && sub.minutes > 0) {
                urgencyScore += Math.min(40, sub.rawDaysSince * 2); 
            }

            // Fator 4: Muito estudo, pouca prática
            if (sub.minutes > 120 && sub.questions < 5) urgencyScore += 25;

            return { ...sub, urgencyScore };
        })
        .filter(sub => {
            // FILTRO INTELIGENTE: Só mostra no radar se:
            // 1. Tem score de urgência relevante (> 15)
            // 2. E (Já estudou algo OU tem erro registrado) -> Remove matérias "virgens"
            const hasStarted = sub.minutes > 0 || sub.questions > 0;
            const hasErrors = sub.explicitErrors > 0;
            return sub.urgencyScore > 15 && (hasStarted || hasErrors);
        }) 
        .sort((a, b) => b.urgencyScore - a.urgencyScore)
        .slice(0, 3); // Limita a 3 itens para manter minimalismo

    const globalAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    const dailyStats: Record<string, { totalQ: number; totalC: number }> = {};
    activeSubjects.forEach(sub => {
        if (sub.logs) {
            sub.logs.forEach(log => {
                try {
                    const dateKey = new Date(log.date).toISOString().split('T')[0];
                    if (!dailyStats[dateKey]) dailyStats[dateKey] = { totalQ: 0, totalC: 0 };
                    dailyStats[dateKey].totalQ += (log.questionsCount || 0);
                    dailyStats[dateKey].totalC += (log.correctCount || 0);
                } catch(e) {}
            });
        }
    });

    const historyData = Object.entries(dailyStats)
        .map(([dateStr, stats]) => {
            const dateObj = new Date(dateStr);
            const userTimezoneOffset = dateObj.getTimezoneOffset() * 60000;
            const adjustedDate = new Date(dateObj.getTime() + userTimezoneOffset);
            return {
                date: adjustedDate.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' }),
                rawDate: new Date(dateStr),
                accuracy: stats.totalQ > 0 ? Math.round((stats.totalC / stats.totalQ) * 100) : 0
            };
        })
        .sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime())
        .slice(-10);

    const data = {
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

    const generateAiInsights = async () => {
        if (!user.openAiApiKey) return alert("Configure a API Key no perfil.");
        setIsGeneratingInsight(true);
        try {
            // Prompt enriquecido com Tópicos Específicos
            const subjectsContext = data.attentionRanking.map(s => {
                // Recupera dados originais para extrair tópicos
                const originalSubject = subjects.find(sub => sub.id === s.id);
                
                // Tópicos já concluídos (Contexto do que ele já sabe)
                const completedTopics = originalSubject?.topics
                    .filter(t => t.completed)
                    .map(t => t.name)
                    .slice(0, 8) 
                    .join(', ') || 'Nenhum concluído';

                // Tópicos com erros (Caderno de Erros)
                const problematicTopics = errorLogs
                    .filter(e => e.subjectId === s.id)
                    .map(e => e.topicName)
                    .slice(0, 5)
                    .join(', ') || 'Sem erros registrados';

                // Acurácia por tópico (questões respondidas)
                const topicStats: Record<string, { name: string; questions: number; correct: number }> = {};
                (originalSubject?.logs || []).forEach(log => {
                    const topicName = log.topicName || 'Sem tópico';
                    if (!topicStats[topicName]) {
                        topicStats[topicName] = { name: topicName, questions: 0, correct: 0 };
                    }
                    topicStats[topicName].questions += (log.questionsCount || 0);
                    topicStats[topicName].correct += (log.correctCount || 0);
                });

                const topicBreakdown = Object.values(topicStats)
                    .filter(t => t.questions > 0)
                    .map(t => ({
                        ...t,
                        accuracy: Math.round((t.correct / t.questions) * 100)
                    }))
                    .sort((a, b) => b.questions - a.questions)
                    .slice(0, 6)
                    .map(t => `${t.name}: ${t.accuracy}% (${t.correct}/${t.questions} questões)`)
                    .join('; ') || 'Sem questões registradas por tópico';

                return {
                    Materia: s.name,
                    AcuraciaGeral: `${s.accuracy}% (Baseado em ${s.questions} questões)`,
                    Recencia: typeof s.daysSinceLastStudy === 'number' ? `${s.daysSinceLastStudy} dias sem ver` : 'Nunca estudado',
                    TopicosJaEstudados: completedTopics,
                    TopicosComErros: problematicTopics,
                    TopicosComAcuracia: topicBreakdown
                };
            });

            const prompt = `
                Você é o motor de inteligência do StudyFlow. Sua função é EXPLICAR POR QUE certas matérias estão no 'Radar de Atenção', usando dados específicos.
                
                DADOS DO ALUNO:
                ${JSON.stringify(subjectsContext)}

                OBJETIVO:
                Para cada matéria, forneça uma análise de 1 frase justificando a prioridade.
                
                REGRAS DE OURO:
                1. MENCIONE TÓPICOS ESPECÍFICOS de 'TopicosComErros' e de 'TopicosComAcuracia'. Priorize tópicos com acurácia < 70% ou com muitas questões.
                2. SE NÃO HOUVER ERROS, foque em recência/curva de esquecimento e nas lacunas de acurácia por tópico.
                3. USE O CONTEXTO: Se há muita prática mas acurácia baixa, recomende revisão teórica; se acurácia estável mas tempo sem ver é alto, recomende revisão rápida.
                4. FORMATO: HTML (<ul>, <li> com <strong> no nome da matéria) com frases curtas, tom direto para concurseiro.
                5. Evite generalidades: cite pelo menos um tópico e a acurácia dele quando disponível.

                Exemplo Ideal:
                <ul>
                  <li><strong>Direito Penal:</strong> Alerta crítico em 'Teoria do Crime' (múltiplos erros). Sua acurácia geral de 40% indica necessidade de voltar à teoria.</li>
                  <li><strong>Português:</strong> Faz 12 dias que você não revisa tópicos como 'Crase' e 'Sintaxe', risco alto de curva de esquecimento.</li>
                </ul>
            `;

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.openAiApiKey}` },
                body: JSON.stringify({ 
                    model: user.openAiModel || 'gpt-4o-mini', 
                    messages: [
                        { role: "system", content: "Você é um analista de dados educacionais focado em explicar decisões algorítmicas com precisão cirúrgica." }, 
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.3 
                })
            });
            const resData = await response.json();
            setAiInsight(resData.choices[0].message.content);
        } catch (e: any) { alert(e.message); } finally { setIsGeneratingInsight(false); }
    };

    const LearningCurveChart = () => {
        if (data.historyData.length < 2) return <div className="h-48 flex items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800"><p className="text-xs">Estude 2 dias para ver o gráfico.</p></div>;
        const height = 150; const width = 600; const paddingX = 30; const paddingY = 20;
        const getX = (index: number) => paddingX + (index * ((width - paddingX * 2) / (data.historyData.length - 1)));
        const getY = (value: number) => height - paddingY - ((value / 100) * (height - paddingY * 2));
        const points = data.historyData.map((d, i) => `${getX(i)},${getY(d.accuracy)}`).join(' ');
        
        return (
            <div className="w-full bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm mb-6">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4"><span className="material-symbols-outlined text-primary">trending_up</span>Curva de Aprendizagem</h4>
                <div className="relative w-full aspect-[4/1] min-h-[150px]">
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                        {[0, 50, 100].map(val => <line key={val} x1={paddingX} y1={getY(val)} x2={width - paddingX} y2={getY(val)} stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="1" />)}
                        <line x1={paddingX} y1={getY(80)} x2={width - paddingX} y2={getY(80)} stroke="currentColor" className="text-green-500/50" strokeDasharray="4,4" />
                        <text x={width - paddingX - 4} y={getY(80) - 6} textAnchor="end" className="fill-green-600 dark:fill-green-400 text-[10px] font-bold">
                            80% ideal
                        </text>
                        <polyline points={points} fill="none" stroke="currentColor" className="text-primary" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        {data.historyData.map((d, i) => {
                            const x = getX(i);
                            const y = getY(d.accuracy);
                            return (
                                <g key={i}>
                                    <circle cx={x} cy={y} r="4" className="fill-white stroke-primary stroke-2" />
                                    <text x={x} y={y - 8} textAnchor="middle" className="fill-slate-500 dark:fill-slate-300 text-[10px] font-bold">
                                        {d.accuracy}%
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                </div>
            </div>
        );
    };

    // COMPONENTE: GRÁFICO CIRCULAR DE TEMPO POR DISCIPLINA
    const SubjectTimeChart = () => {
        // Filtra disciplinas com tempo > 0 e ordena
        const chartData = performanceBySubject
            .filter(s => s.minutes > 0)
            .sort((a, b) => b.minutes - a.minutes);

        // Geometria do Donut
        const size = 160;
        const center = size / 2;
        const radius = 60;
        const circumference = 2 * Math.PI * radius;
        let cumulativePercent = 0;

        return (
            <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col items-center">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white w-full flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-purple-500">pie_chart</span>
                    Distribuição do Tempo
                </h4>
                
                <div className="relative size-40 group">
                    <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90 transform">
                        {/* Background Ring */}
                        <circle cx={center} cy={center} r={radius} fill="transparent" stroke="currentColor" strokeWidth="20" className="text-slate-100 dark:text-slate-800" />
                        
                        {chartData.map((sub, i) => {
                            const percent = sub.minutes / totalStudyMinutes;
                            const dashArray = `${percent * circumference} ${circumference}`;
                            const offset = -cumulativePercent * circumference;
                            cumulativePercent += percent;
                            
                            const colorMap: Record<string, string> = {
                                blue: '#3b82f6', red: '#ef4444', green: '#22c55e', purple: '#a855f7',
                                orange: '#f97316', teal: '#14b8a6', pink: '#ec4899', indigo: '#6366f1',
                                cyan: '#06b6d4', rose: '#f43f5e', violet: '#8b5cf6', emerald: '#10b981',
                                amber: '#f59e0b', fuchsia: '#d946ef', sky: '#0ea5e9', lime: '#84cc16'
                            };
                            const strokeColor = colorMap[sub.color] || '#3b82f6';

                            return (
                                <circle 
                                    key={sub.id}
                                    cx={center} cy={center} r={radius}
                                    fill="transparent"
                                    stroke={strokeColor}
                                    strokeWidth="20"
                                    strokeDasharray={dashArray}
                                    strokeDashoffset={offset}
                                    className="transition-all duration-300 hover:stroke-[24] cursor-pointer opacity-90 hover:opacity-100"
                                    onMouseEnter={() => setHoveredSlice(sub.id)}
                                    onMouseLeave={() => setHoveredSlice(null)}
                                />
                            );
                        })}
                    </svg>
                    {/* Texto Central */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-black text-slate-800 dark:text-white">
                            {(totalStudyMinutes / 60).toFixed(1)}h
                        </span>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Total</span>
                    </div>
                </div>

                {/* Legenda */}
                {chartData.length > 0 ? (
                    <div className="w-full mt-6 flex flex-col gap-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                        {chartData.map(sub => (
                            <div 
                                key={sub.id} 
                                className={`flex justify-between items-center text-xs p-2 rounded-lg transition-colors ${hoveredSlice === sub.id ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
                                onMouseEnter={() => setHoveredSlice(sub.id)}
                                onMouseLeave={() => setHoveredSlice(null)}
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <div className={`size-2.5 rounded-full bg-${sub.color}-500 shrink-0`}></div>
                                    <span className="font-bold text-slate-700 dark:text-slate-300 truncate">{sub.name}</span>
                                </div>
                                <span className="font-mono text-slate-500">{sub.minutes}m ({Math.round((sub.minutes/totalStudyMinutes)*100)}%)</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-slate-400 mt-4 text-center">Nenhum dado registrado.</p>
                )}
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

            {/* SEÇÃO 1: RADAR DE ATENÇÃO DINÂMICO (NOVO DESIGN COMPACTO) */}
            <div className="flex flex-col gap-4">
                 <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-red-500 animate-pulse">crisis_alert</span>
                    Radar de Atenção
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-gradient-to-br from-[#0c0c1d] to-[#15152a] rounded-xl border border-white/5 shadow-xl p-4 relative overflow-hidden flex flex-col">
                        <div className="absolute inset-0 bg-red-500/5 pointer-events-none z-0"></div>
                        
                        <div className="flex justify-between items-center mb-4 relative z-10">
                            <span className="text-[10px] font-mono text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                                <span className="size-1.5 rounded-full bg-red-500 animate-ping"></span>
                                Análise de Prioridade
                            </span>
                        </div>

                        <div className="relative z-10 flex-1 flex flex-col justify-center">
                            {data.attentionRanking.length === 0 ? (
                                <div className="flex flex-col items-center justify-center text-center p-4">
                                    <span className="material-symbols-outlined text-3xl text-green-500/50 mb-2">verified_user</span>
                                    <h4 className="text-green-400/80 font-bold text-sm">Sistema Estável</h4>
                                    <p className="text-slate-500 text-xs">Nenhuma anomalia crítica detectada.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {data.attentionRanking.map((sub, idx) => {
                                        // Cálculo de Nível de Ameaça (Visual)
                                        const threatLevel = Math.min(100, sub.urgencyScore * 2); 
                                        
                                        return (
                                            <div key={sub.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                                                {/* Indicador Lateral */}
                                                <div className="w-1 h-8 rounded-full bg-red-500 shrink-0"></div>
                                                
                                                {/* Info Principal */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <h4 className="font-bold text-slate-200 text-sm truncate pr-2">{sub.name}</h4>
                                                        <span className="text-[10px] font-mono text-red-400 font-bold">{threatLevel > 80 ? 'CRÍTICO' : 'ALTO'}</span>
                                                    </div>
                                                    
                                                    {/* Barra de Progresso 'Negativo' */}
                                                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mb-1.5">
                                                        <div className="h-full bg-gradient-to-r from-orange-500 to-red-600" style={{ width: `${threatLevel}%` }}></div>
                                                    </div>

                                                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                                        <span className="flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-[10px]">target</span>
                                                            {sub.accuracy}% Acurácia
                                                        </span>
                                                        {typeof sub.daysSinceLastStudy === 'number' && sub.daysSinceLastStudy > 7 && (
                                                            <span className="flex items-center gap-1 text-orange-400">
                                                                <span className="material-symbols-outlined text-[10px]">history</span>
                                                                {sub.daysSinceLastStudy}d ausente
                                                            </span>
                                                        )}
                                                        {sub.explicitErrors > 0 && (
                                                            <span className="flex items-center gap-1 text-red-400">
                                                                <span className="material-symbols-outlined text-[10px]">warning</span>
                                                                {sub.explicitErrors} Erros
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Card de IA Compacto */}
                    <div className="lg:col-span-1 bg-gradient-to-br from-indigo-900 to-[#1e1e2d] border border-indigo-500/20 rounded-xl shadow-lg p-4 flex flex-col h-full min-h-[200px]">
                        <div className="flex items-center gap-2 mb-3 text-indigo-300">
                            <span className="material-symbols-outlined text-lg">psychology</span>
                            <h3 className="font-bold text-sm uppercase tracking-wide">Diagnóstico IA</h3>
                        </div>
                        
                        <div className="flex-1 bg-black/20 rounded-lg p-3 border border-white/5 mb-3 overflow-y-auto custom-scrollbar">
                            {aiInsight ? (
                                <div className="text-xs text-slate-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: aiInsight }}></div>
                            ) : (
                                <p className="text-xs text-slate-500 italic text-center mt-4">
                                    Peça à IA para explicar a priorização do radar ao lado.
                                </p>
                            )}
                        </div>

                        <button 
                            onClick={generateAiInsights} 
                            disabled={isGeneratingInsight || data.attentionRanking.length === 0} 
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold text-xs text-white transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-indigo-500/20"
                        >
                            {isGeneratingInsight ? (
                                <>
                                    <span className="size-3 border-2 border-white/50 border-t-white rounded-full animate-spin"></span>
                                    Processando...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                                    Explicar Prioridade
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* SEÇÃO 2: META DO DIA */}
            <div className="flex flex-col gap-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">today</span>
                    Meta do Dia
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
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase`}>{item.subject.priority === 'HIGH' ? 'Prioridade Alta' : 'Programado'}</span>
                                    </div>
                                    <h4 className="font-bold text-slate-900 dark:text-white text-lg leading-tight mb-1 truncate" title={item.subject.name}>{item.subject.name}</h4>
                                    <div className="min-h-[3rem]">
                                        <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Próximo Tópico:</p>
                                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300 line-clamp-2" title={item.nextTopic?.name}>{item.nextTopic ? item.nextTopic.name : <span className="text-green-500 italic">Disciplina Finalizada! Revisar.</span>}</p>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                    <span className="text-xs text-slate-400">{item.remainingTopics} tópicos restantes</span>
                                    <button onClick={() => onNavigate(Screen.STUDY_PLAYER)} className="size-8 rounded-full bg-primary text-white flex items-center justify-center hover:bg-blue-600 transition-colors shadow-lg shadow-primary/20 active:scale-95" title="Começar agora"><span className="material-symbols-outlined text-lg">play_arrow</span></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* SEÇÃO 3: DESEMPENHO GERAL E EVOLUÇÃO */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Coluna Esquerda: Métricas + Donut Chart */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <div className="flex flex-col gap-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">monitoring</span>
                            Métricas Globais
                        </h3>
                        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col items-center justify-center gap-6">
                            <div className="relative size-40">
                                <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                                    <path className="text-slate-100 dark:text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                                    <path className={`${data.global.accuracy >= 80 ? 'text-green-500' : data.global.accuracy >= 60 ? 'text-yellow-500' : 'text-red-500'} transition-all duration-1000 ease-out`} strokeDasharray={`${data.global.accuracy}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
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

                    {/* Novo Gráfico Circular (Posicionado explicitamente aqui) */}
                    <SubjectTimeChart />
                </div>

                {/* Coluna Direita: Evolução e MAPA DO EDITAL */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">leaderboard</span>
                        Evolução e Detalhes
                    </h3>

                    <LearningCurveChart />

                    {/* --- MAPA DO EDITAL (CHECKLIST VISUAL) --- */}
                    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex justify-between items-center">
                            <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">map</span>
                                Mapa do Edital
                            </h4>
                            <div className="flex gap-3 text-[10px] uppercase font-bold">
                                {Object.values(statusConfig).map(sc => (
                                    <div key={sc.label} className="flex items-center gap-1">
                                        <div className={`size-2 rounded-full ${sc.color.split(' ')[0].replace('bg-','bg-')}`}></div>
                                        <span className="text-slate-500">{sc.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto max-h-[500px] custom-scrollbar p-2">
                            {subjects.length === 0 ? (
                                <div className="p-8 text-center text-slate-400">Nenhuma disciplina cadastrada.</div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {subjects.map(subject => {
                                        const isExpanded = expandedSubjectMap === subject.id;
                                        const groups = useMemo(() => processSyllabusMap(subject), [subject, subject.logs]);
                                        
                                        // Estatísticas de Progresso do Subject
                                        const totalTopics = subject.topics.length;
                                        const completedCount = groups.reduce((acc, g) => acc + g.children.filter(c => c.status !== 'NOT_SEEN').length, 0);
                                        const progressPct = totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0;

                                        // Métricas Agregadas do Subject para o Cabeçalho
                                        const subjectTotalMinutes = subject.logs?.reduce((acc, log) => acc + log.durationMinutes, 0) || 0;
                                        const subjectTotalQuestions = subject.logs?.reduce((acc, log) => acc + log.questionsCount, 0) || 0;
                                        const subjectTotalCorrect = subject.logs?.reduce((acc, log) => acc + log.correctCount, 0) || 0;
                                        const subjectAccuracy = subjectTotalQuestions > 0 ? Math.round((subjectTotalCorrect / subjectTotalQuestions) * 100) : 0;

                                        return (
                                            <div key={subject.id} className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden transition-all">
                                                {/* Subject Header */}
                                                <button 
                                                    onClick={() => setExpandedSubjectMap(isExpanded ? null : subject.id)}
                                                    className={`w-full flex items-center justify-between p-3 transition-colors ${isExpanded ? 'bg-slate-50 dark:bg-slate-800/50' : 'bg-white dark:bg-card-dark hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                                                >
                                                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                                                        <div className={`size-8 rounded flex items-center justify-center shrink-0 bg-${subject.color || 'blue'}-100 dark:bg-${subject.color || 'blue'}-900/30 text-${subject.color || 'blue'}-600`}>
                                                            <span className="material-symbols-outlined text-sm">{getSubjectIcon(subject.name)}</span>
                                                        </div>
                                                        <div className="flex flex-col items-start min-w-0 flex-1">
                                                            <div className="flex items-center gap-2 mb-1 w-full">
                                                                <span className="font-bold text-sm text-slate-900 dark:text-white truncate" title={subject.name}>{subject.name}</span>
                                                                {subject.weight !== undefined && (
                                                                    <span className="shrink-0 text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded">
                                                                        Peso {subject.weight}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-3 w-full">
                                                                {/* Progresso */}
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                        <div className={`h-full bg-${subject.color || 'blue'}-500`} style={{ width: `${progressPct}%` }}></div>
                                                                    </div>
                                                                    <span className="text-[9px] text-slate-500">{progressPct}%</span>
                                                                </div>
                                                                
                                                                {/* Métricas Agregadas no Header */}
                                                                {subjectTotalMinutes > 0 && (
                                                                    <div className="flex items-center gap-1 text-[9px] font-mono text-slate-400 border-l border-slate-200 dark:border-slate-700 pl-2 shrink-0">
                                                                        <span className="material-symbols-outlined text-[10px]">schedule</span>
                                                                        {subjectTotalMinutes}m
                                                                    </div>
                                                                )}
                                                                {subjectTotalQuestions > 0 && (
                                                                    <div className={`flex items-center gap-1 text-[9px] font-bold border-l border-slate-200 dark:border-slate-700 pl-2 shrink-0 ${subjectAccuracy >= 80 ? 'text-green-600 dark:text-green-400' : subjectAccuracy >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                                                                        <span className="material-symbols-outlined text-[10px]">target</span>
                                                                        {subjectAccuracy}%
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span className="material-symbols-outlined text-slate-400 ml-2 shrink-0">{isExpanded ? 'expand_less' : 'expand_more'}</span>
                                                </button>

                                                {/* Expandable Content (Topics) */}
                                                {isExpanded && (
                                                    <div className="p-3 bg-white dark:bg-[#15152a] border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3 animate-in slide-in-from-top-2">
                                                        {groups.map((group, idx) => (
                                                            <div key={idx} className="flex flex-col gap-1">
                                                                {group.isGroup && (
                                                                    <div className="flex items-center gap-2 px-2 py-1">
                                                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{group.name}</span>
                                                                        <span className="h-px flex-1 bg-slate-100 dark:bg-slate-800"></span>
                                                                    </div>
                                                                )}
                                                                
                                                                <div className="flex flex-col gap-1 pl-2">
                                                                    {group.children.map((node, cIdx) => {
                                                                        const config = statusConfig[node.status];
                                                                        return (
                                                                            <div key={cIdx} className={`flex items-center justify-between p-2 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors ${node.status === 'NOT_SEEN' ? 'opacity-70 hover:opacity-100' : ''} bg-slate-50/50 dark:bg-slate-800/20`}>
                                                                                <div className="flex items-center gap-2 overflow-hidden flex-1">
                                                                                    <span className={`material-symbols-outlined text-sm ${node.status === 'MASTERED' ? 'text-emerald-500' : node.status === 'REVIEWED' ? 'text-amber-500' : node.status === 'SEEN' ? 'text-blue-500' : 'text-slate-300'}`}>
                                                                                        {node.status === 'NOT_SEEN' ? 'radio_button_unchecked' : config.icon}
                                                                                    </span>
                                                                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate" title={node.name}>{node.name}</span>
                                                                                </div>
                                                                                
                                                                                {node.status !== 'NOT_SEEN' && (
                                                                                    <div className="flex items-center gap-2">
                                                                                        {/* BADGE DE TEMPO GASTO */}
                                                                                        {node.timeSpent > 0 && (
                                                                                            <span className="flex items-center gap-1 text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700/50 px-1.5 py-0.5 rounded">
                                                                                                <span className="material-symbols-outlined text-[10px]">schedule</span>
                                                                                                {node.timeSpent}m
                                                                                            </span>
                                                                                        )}
                                                                                        
                                                                                        {/* BADGE DE ACURÁCIA (SE HOUVER QUESTÕES) */}
                                                                                        {node.accuracy > 0 ? (
                                                                                            <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${node.accuracy >= 80 ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : node.accuracy >= 60 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600' : 'bg-red-100 dark:bg-red-900/30 text-red-600'}`}>
                                                                                                <span className="material-symbols-outlined text-[10px]">target</span>
                                                                                                {node.accuracy}%
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${config.color}`}>
                                                                                                {config.label}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        
                                                        {groups.length === 0 && <p className="text-xs text-center text-slate-400 py-2">Sem tópicos cadastrados.</p>}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
