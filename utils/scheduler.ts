import { Subject, ScheduleItem, Topic, ErrorLog } from '../types';

export interface ScheduleSettings {
    subjectsPerDay: number;
    srsPace: 'ACCELERATED' | 'NORMAL' | 'RELAXED';
    srsMode: 'SMART' | 'MANUAL';
    activeWeekDays: number[];
}

// Gerador de Números Pseudo-Aleatórios (Seeded)
const seededRandom = (seed: number) => {
    let state = seed;
    return () => {
        state = (state * 9301 + 49297) % 233280;
        return state / 233280;
    };
};

// Helper para obter data YYYY-MM-DD local (evita bugs de UTC -3h vs UTC 0)
const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const generateMonthlySchedule = (
    viewingDate: Date,
    subjects: Subject[],
    errorLogs: ErrorLog[],
    settings: ScheduleSettings,
    dailyTimeMinutes: number,
    targetDayOnly?: number 
): Record<number, ScheduleItem[] | null> => {
    const schedule: Record<number, ScheduleItem[] | null> = {};
    
    // 1. Normalização e Ordenação
    const activeSubjects = subjects.filter(s => s.active).sort((a, b) => a.id.localeCompare(b.id));
    if (activeSubjects.length === 0) return {};

    const year = viewingDate.getFullYear();
    const month = viewingDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Data de "Hoje" zerada para comparação LOCAL
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = getLocalDateString(today);

    // 3. Setup do Deck (Baralho)
    const seedBase = year * 1000 + month;
    const random = seededRandom(seedBase);

    let cycleDeck: Subject[] = [];
    
    activeSubjects.forEach(sub => {
        const pWeight = sub.priority === 'HIGH' ? 3 : sub.priority === 'LOW' ? 1 : 2;
        const kWeight = sub.proficiency === 'BEGINNER' ? 3 : sub.proficiency === 'ADVANCED' ? 1 : 2;
        const totalWeight = Math.min(pWeight * kWeight, 9); 

        for(let k=0; k < totalWeight; k++) cycleDeck.push(sub);
    });

    // Embaralhamento Fisher-Yates
    for (let i = cycleDeck.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [cycleDeck[i], cycleDeck[j]] = [cycleDeck[j], cycleDeck[i]];
    }

    // Otimização de Adjacência
    for (let i = 1; i < cycleDeck.length - 1; i++) {
        if (cycleDeck[i].id === cycleDeck[i-1].id) {
            [cycleDeck[i], cycleDeck[i+1]] = [cycleDeck[i+1], cycleDeck[i]];
        }
    }

    // 4. Variáveis de Estado
    let globalDeckCursor = 0;
    const pendingReviews: { [key: number]: Subject[] } = {};
    const subjectTopicCursors: Record<string, number> = {};
    const subjectErrorCounts: Record<string, number> = {};
    
    errorLogs.forEach(log => {
        subjectErrorCounts[log.subjectId] = (subjectErrorCounts[log.subjectId] || 0) + 1;
    });

    // Inicializa cursores no primeiro tópico NÃO concluído
    activeSubjects.forEach(s => {
        const firstPendingIndex = s.topics.findIndex(t => !t.completed);
        subjectTopicCursors[s.id] = firstPendingIndex === -1 ? 0 : firstPendingIndex;
    });

    const getNextSubject = (): Subject | null => {
        if (cycleDeck.length === 0) return null;
        const sub = cycleDeck[globalDeckCursor % cycleDeck.length];
        globalDeckCursor++;
        return sub;
    };

    const getReviewIntervals = (subject: Subject): number[] => {
        if (settings.srsMode === 'MANUAL') {
            if (settings.srsPace === 'ACCELERATED') return [1, 3, 7];
            if (settings.srsPace === 'RELAXED') return [3, 10, 20];
            return [1, 7, 14]; 
        }
        const subErrors = subjectErrorCounts[subject.id] || 0;
        if (subErrors > 3) return [1, 3, 7]; 
        return [1, 7, 14];
    };

    const addReview = (targetDay: number, subject: Subject) => {
        if (!pendingReviews[targetDay]) pendingReviews[targetDay] = [];
        // Evita duplicatas de revisão para a mesma matéria no mesmo dia
        if (!pendingReviews[targetDay].some(s => s.id === subject.id)) {
            pendingReviews[targetDay].push(subject);
        }
    };

    // 5. Loop Principal (Dia a Dia)
    const limitDay = targetDayOnly || daysInMonth;

    for (let day = 1; day <= limitDay; day++) {
        const currentDateObj = new Date(year, month, day);
        const currentDateStr = getLocalDateString(currentDateObj);
        const currentDayOfWeek = currentDateObj.getDay();
        const isDayActive = settings.activeWeekDays.includes(currentDayOfWeek);
        
        // Comparação robusta de datas (String vs String)
        const isPastDate = currentDateStr < todayStr;

        const dailyItems: ScheduleItem[] = [];

        // =================================================================================
        // RAMIFICAÇÃO A: PROCESSAR PASSADO (Baseado em LOGS REAIS)
        // =================================================================================
        if (isPastDate) {
            // Procura logs reais para este dia
            activeSubjects.forEach(sub => {
                if (sub.logs) {
                    sub.logs.forEach(log => {
                        const logDateStr = getLocalDateString(new Date(log.date));
                        
                        if (logDateStr === currentDateStr) {
                            // Busca o tópico REAL na lista atual de tópicos da matéria
                            // Se o log for manual (id não bate), tenta achar por nome ou ignora
                            const realTopic = sub.topics.find(t => t.id === log.topicId);
                            
                            // Objeto de exibição
                            const displayTopic = realTopic || { id: 'unknown', name: log.topicName, completed: true };
                            
                            // Adiciona item histórico ao agendamento
                            dailyItems.push({
                                subject: sub,
                                type: 'THEORY', // Logs passados contam como estudo realizado
                                topic: displayTopic as Topic,
                                durationMinutes: log.durationMinutes
                            });

                            // CRÍTICO: O estudo passado GERA revisões futuras APENAS SE:
                            // 1. O tópico existe na disciplina
                            // 2. O tópico está marcado como COMPLETED (garante integridade se usuário desmarcou)
                            if (realTopic && realTopic.completed) {
                                const intervals = getReviewIntervals(sub);
                                intervals.forEach(interval => {
                                    if (day + interval <= daysInMonth + 45) addReview(day + interval, sub);
                                });
                            }
                        }
                    });
                }
            });

            // Se não houver logs no passado, não geramos nada.
            schedule[day] = dailyItems.length > 0 ? dailyItems : [];
            continue; 
        }

        // =================================================================================
        // RAMIFICAÇÃO B: SIMULAR FUTURO (Baseado em ALGORITMO)
        // =================================================================================
        
        if (!isDayActive) {
            schedule[day] = null;
            if (pendingReviews[day]) {
                const nextDay = day + 1;
                if (!pendingReviews[nextDay]) pendingReviews[nextDay] = [];
                pendingReviews[day].forEach(r => {
                    if (!pendingReviews[nextDay].some(pr => pr.id === r.id)) pendingReviews[nextDay].push(r);
                });
            }
            continue;
        }

        // 1. Processar Revisões Pendentes (Geradas por Logs Passados ou Teoria Simulada Anterior)
        if (pendingReviews[day]) {
            pendingReviews[day].forEach(revSub => {
                dailyItems.push({ subject: revSub, type: 'REVIEW' });
            });
        }

        // 2. Preencher Vagas com Teoria (Simulação)
        let slotsForTheory = settings.subjectsPerDay - dailyItems.length;
        if (slotsForTheory < 0) slotsForTheory = 0;

        for (let i = 0; i < slotsForTheory; i++) {
            const selectedSubject = getNextSubject();
            if (!selectedSubject) break;

            const idx = subjectTopicCursors[selectedSubject.id];
            
            if (selectedSubject.topics && idx < selectedSubject.topics.length) {
                const topic = selectedSubject.topics[idx];
                
                // Avança o cursor simulado
                subjectTopicCursors[selectedSubject.id] = idx + 1;

                dailyItems.push({ subject: selectedSubject, type: 'THEORY', topic: topic });

                // Agenda revisões futuras (Assume-se que ao agendar teoria no futuro, ela será concluída neste dia)
                const intervals = getReviewIntervals(selectedSubject);
                intervals.forEach(interval => {
                    if (day + interval <= daysInMonth + 30) addReview(day + interval, selectedSubject);
                });
            } else {
                // Fim dos tópicos (Revisão Geral ou Estudo Livre)
                // Não gera novas revisões SRS pois não há tópico novo
                dailyItems.push({ subject: selectedSubject, type: 'THEORY' }); 
            }
        }

        // 3. Distribuir Tempo
        if (dailyItems.length > 0) {
            const totalWeight = dailyItems.reduce((acc, item) => acc + (item.type === 'REVIEW' ? 1 : 2), 0);
            dailyItems.forEach(item => {
                const weight = item.type === 'REVIEW' ? 1 : 2;
                item.durationMinutes = Math.round((weight / totalWeight) * dailyTimeMinutes);
            });
        }

        schedule[day] = dailyItems;
    }

    return schedule;
};