import { Subject, ScheduleItem, Topic, ErrorLog } from '../types';

export interface ScheduleSettings {
    subjectsPerDay: number;
    srsPace: 'ACCELERATED' | 'NORMAL' | 'RELAXED';
    srsMode: 'SMART' | 'MANUAL';
    activeWeekDays: number[];
    enableSRS?: boolean;
}

// Gerador de Números Pseudo-Aleatórios (Seeded)
const seededRandom = (seed: number) => {
    let state = seed;
    return () => {
        state = (state * 9301 + 49297) % 233280;
        return state / 233280;
    };
};

// Helper para obter data YYYY-MM-DD local
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
    const useSRS = settings.enableSRS !== false; 
    
    // 1. Normalização e Ordenação
    const activeSubjects = subjects.filter(s => s.active).sort((a, b) => a.id.localeCompare(b.id));
    if (activeSubjects.length === 0) return {};

    const year = viewingDate.getFullYear();
    const month = viewingDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Data de "Hoje" zerada para comparação
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = getLocalDateString(today);

    // 2. Setup do Deck (Baralho)
    const seedBase = year * 1000 + month;
    const random = seededRandom(seedBase);

    let cycleDeck: Subject[] = [];
    activeSubjects.forEach(sub => {
        const pWeight = sub.priority === 'HIGH' ? 3 : sub.priority === 'LOW' ? 1 : 2;
        const kWeight = sub.proficiency === 'BEGINNER' ? 3 : sub.proficiency === 'ADVANCED' ? 1 : 2;
        const totalWeight = Math.min(pWeight * kWeight, 9); 
        for(let k=0; k < totalWeight; k++) cycleDeck.push(sub);
    });

    for (let i = cycleDeck.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [cycleDeck[i], cycleDeck[j]] = [cycleDeck[j], cycleDeck[i]];
    }
    
    for (let i = 1; i < cycleDeck.length - 1; i++) {
        if (cycleDeck[i].id === cycleDeck[i-1].id) {
            [cycleDeck[i], cycleDeck[i+1]] = [cycleDeck[i+1], cycleDeck[i]];
        }
    }

    // 3. Variáveis de Estado
    let globalDeckCursor = 0;
    const pendingReviews: { [key: number]: Subject[] } = {};
    const subjectTopicCursors: Record<string, number> = {};
    const subjectErrorCounts: Record<string, number> = {};
    
    errorLogs.forEach(log => {
        subjectErrorCounts[log.subjectId] = (subjectErrorCounts[log.subjectId] || 0) + 1;
    });

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
        if (!useSRS) return;
        if (!pendingReviews[targetDay]) pendingReviews[targetDay] = [];
        if (!pendingReviews[targetDay].some(s => s.id === subject.id)) {
            pendingReviews[targetDay].push(subject);
        }
    };

    // 4. Loop Principal (Dia a Dia)
    const limitDay = targetDayOnly || daysInMonth;

    for (let day = 1; day <= limitDay; day++) {
        const currentDateObj = new Date(year, month, day);
        const currentDateStr = getLocalDateString(currentDateObj);
        const currentDayOfWeek = currentDateObj.getDay();
        const isDayActive = settings.activeWeekDays.includes(currentDayOfWeek);
        
        // Determina se é passado (histórico estático)
        const isPastDate = currentDateStr < todayStr;

        const dailyItems: ScheduleItem[] = [];
        const subjectsStudiedToday = new Set<string>();

        // -------------------------------------------------------------------------
        // ETAPA A: PROCESSAR LOGS REAIS (Passado E Presente)
        // Isso garante que se você estudou HOJE, a revisão é agendada para o futuro IMEDIATAMENTE.
        // -------------------------------------------------------------------------
        activeSubjects.forEach(sub => {
            if (sub.logs) {
                sub.logs.forEach(log => {
                    const logDateStr = getLocalDateString(new Date(log.date));
                    
                    if (logDateStr === currentDateStr) {
                        const realTopic = sub.topics.find(t => t.id === log.topicId);
                        const displayTopic = realTopic || { id: 'unknown', name: log.topicName, completed: true };
                        
                        dailyItems.push({
                            subject: sub,
                            type: 'THEORY', // Logs contam como execução
                            topic: displayTopic as Topic,
                            durationMinutes: log.durationMinutes
                        });
                        subjectsStudiedToday.add(sub.id);

                        // TRIGGER DO SRS: Só agenda se o tópico foi REALMENTE completado
                        if (useSRS && realTopic && realTopic.completed) {
                            const intervals = getReviewIntervals(sub);
                            intervals.forEach(interval => {
                                const reviewDay = day + interval;
                                // Adiciona na fila de revisões futuras
                                if (reviewDay <= daysInMonth + 60) addReview(reviewDay, sub);
                            });
                        }
                    }
                });
            }
        });

        // Se for passado, paramos aqui (apenas mostramos o que foi feito)
        if (isPastDate) {
            schedule[day] = dailyItems.length > 0 ? dailyItems : [];
            continue; 
        }

        // -------------------------------------------------------------------------
        // ETAPA B: SIMULAÇÃO (Apenas Hoje e Futuro)
        // Preenche o restante do tempo com Revisões Pendentes e Teoria Nova
        // -------------------------------------------------------------------------
        
        if (!isDayActive) {
            schedule[day] = null;
            // Empurra revisões pendentes para o próximo dia útil
            if (useSRS && pendingReviews[day]) {
                const nextDay = day + 1;
                if (!pendingReviews[nextDay]) pendingReviews[nextDay] = [];
                pendingReviews[day].forEach(r => {
                    if (!pendingReviews[nextDay].some(pr => pr.id === r.id)) pendingReviews[nextDay].push(r);
                });
            }
            continue;
        }

        // 1. Adicionar Revisões Pendentes (SRS)
        if (useSRS && pendingReviews[day]) {
            pendingReviews[day].forEach(revSub => {
                // Evita duplicata: Se eu já estudei a matéria hoje (log real), não mostra revisão de novo
                if (!subjectsStudiedToday.has(revSub.id)) {
                    dailyItems.push({ subject: revSub, type: 'REVIEW' });
                }
            });
        }

        // 2. Preencher Vagas com Teoria Nova (Simulação)
        // Conta quantos slots ainda temos baseados na configuração de matérias por dia
        let slotsForTheory = settings.subjectsPerDay - dailyItems.filter(i => i.type === 'THEORY').length; 
        // Nota: Revisões não consomem slots de 'Matérias Novas', elas são adicionais ou prioritárias.
        // Se quiser que revisões consumam o tempo, o limite é pelo tempo total abaixo.
        
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

                // AQUI ESTÁ A MUDANÇA: NÃO AGENDAMOS REVISÃO PARA TEORIA SIMULADA.
                // A revisão só será agendada quando este dia se tornar "Passado/Hoje" e houver um Log Real confirmando a conclusão.
            } else {
                // Fim dos tópicos
                dailyItems.push({ subject: selectedSubject, type: 'THEORY' }); 
            }
        }

        // 3. Distribuir Tempo (Calcula minutos apenas para itens simulados ou sem tempo definido)
        if (dailyItems.length > 0) {
            const totalWeight = dailyItems.reduce((acc, item) => acc + (item.type === 'REVIEW' ? 1 : 2), 0);
            dailyItems.forEach(item => {
                if (!item.durationMinutes) { // Mantém duração real se vier de Log
                    const weight = item.type === 'REVIEW' ? 1 : 2;
                    item.durationMinutes = Math.round((weight / totalWeight) * dailyTimeMinutes);
                }
            });
        }

        schedule[day] = dailyItems;
    }

    return schedule;
};