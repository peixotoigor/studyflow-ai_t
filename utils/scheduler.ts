
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

// Helper robusto para data local YYYY-MM-DD (previne erros de timezone)
const getLocalDateString = (dateInput: Date | string): string => {
    const date = new Date(dateInput);
    // Garante que estamos operando com a data local do navegador
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
    
    // Data de "Hoje" zerada para comparação precisa
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = getLocalDateString(today);

    // 2. Setup do Deck (Baralho Ponderado)
    const seedBase = year * 1000 + month;
    const random = seededRandom(seedBase);

    let cycleDeck: Subject[] = [];
    activeSubjects.forEach(sub => {
        const pWeight = sub.priority === 'HIGH' ? 3 : sub.priority === 'LOW' ? 1 : 2;
        const kWeight = sub.proficiency === 'BEGINNER' ? 3 : sub.proficiency === 'ADVANCED' ? 1 : 2;
        const totalWeight = Math.min(pWeight * kWeight, 9); 
        for(let k=0; k < totalWeight; k++) cycleDeck.push(sub);
    });

    // Shuffle Fisher-Yates com seed
    for (let i = cycleDeck.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [cycleDeck[i], cycleDeck[j]] = [cycleDeck[j], cycleDeck[i]];
    }
    
    // Remove repetições adjacentes excessivas
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
    
    // Popula contagem de erros para o algoritmo SRS
    errorLogs.forEach(log => {
        subjectErrorCounts[log.subjectId] = (subjectErrorCounts[log.subjectId] || 0) + 1;
    });

    // Inicializa cursores de tópicos (para saber qual o próximo tópico não estudado)
    activeSubjects.forEach(s => {
        const firstPendingIndex = s.topics.findIndex(t => !t.completed);
        subjectTopicCursors[s.id] = firstPendingIndex === -1 ? 0 : firstPendingIndex;
    });

    // Função para pegar próxima matéria do ciclo
    const getNextSubject = (excludeIds: Set<string>): Subject | null => {
        if (cycleDeck.length === 0) return null;
        
        let attempts = 0;
        let sub: Subject;
        
        // Tenta encontrar uma matéria que não foi estudada hoje ainda
        // Limita tentativas para evitar loop infinito se todas já foram estudadas
        do {
            sub = cycleDeck[globalDeckCursor % cycleDeck.length];
            globalDeckCursor++;
            attempts++;
        } while (excludeIds.has(sub.id) && attempts < cycleDeck.length);

        return sub;
    };

    const getReviewIntervals = (subject: Subject): number[] => {
        if (settings.srsMode === 'MANUAL') {
            if (settings.srsPace === 'ACCELERATED') return [1, 3, 7];
            if (settings.srsPace === 'RELAXED') return [3, 10, 20];
            return [1, 7, 14]; 
        }
        // Modo SMART: Mais erros = revisões mais curtas/intensas
        const subErrors = subjectErrorCounts[subject.id] || 0;
        if (subErrors > 3) return [1, 3, 7]; 
        return [1, 7, 14];
    };

    const addReview = (targetDay: number, subject: Subject) => {
        if (!useSRS) return;
        if (!pendingReviews[targetDay]) pendingReviews[targetDay] = [];
        // Evita duplicatas de revisão da mesma matéria no mesmo dia
        if (!pendingReviews[targetDay].some(s => s.id === subject.id)) {
            pendingReviews[targetDay].push(subject);
        }
    };

    // 4. Loop Principal (Dia a Dia)
    const limitDay = targetDayOnly || daysInMonth;

    // Se estamos gerando apenas um dia alvo, precisamos simular o estado até ele
    // Para simplificar e manter performance, se targetDayOnly for passado, assumimos simulação local ou cache
    // Mas para precisão, o ideal é rodar o loop. Aqui rodamos do dia 1.
    
    for (let day = 1; day <= daysInMonth; day++) {
        // Otimização: Se targetDayOnly existe e passamos dele, break.
        if (targetDayOnly && day > targetDayOnly) break;

        const currentDateObj = new Date(year, month, day);
        const currentDateStr = getLocalDateString(currentDateObj);
        const currentDayOfWeek = currentDateObj.getDay();
        const isDayActive = settings.activeWeekDays.includes(currentDayOfWeek);
        
        // Comparações temporais
        const isPastDate = currentDateStr < todayStr;
        const isToday = currentDateStr === todayStr;

        const dailyItems: ScheduleItem[] = [];
        const subjectsStudiedToday = new Set<string>();

        // -------------------------------------------------------------------------
        // ETAPA A: PROCESSAR LOGS REAIS (Passado E Presente)
        // A "Verdade" absoluta: O que está nos logs foi feito e ocupa o calendário.
        // -------------------------------------------------------------------------
        activeSubjects.forEach(sub => {
            if (sub.logs) {
                // Filtra logs deste dia específico
                const todaysLogs = sub.logs.filter(log => getLocalDateString(log.date) === currentDateStr);
                
                // Ordena para manter consistência visual
                todaysLogs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                todaysLogs.forEach(log => {
                    // Encontra o tópico real ou cria um placeholder
                    const realTopic = sub.topics.find(t => t.id === log.topicId);
                    const displayTopic = realTopic || { id: 'unknown', name: log.topicName, completed: true };
                    
                    dailyItems.push({
                        subject: sub,
                        type: 'THEORY', // Todo log é tratado como execução
                        topic: displayTopic as Topic,
                        durationMinutes: log.durationMinutes
                    });
                    
                    subjectsStudiedToday.add(sub.id);

                    // TRIGGER DO SRS: Só agenda revisões futuras se o tópico foi REALMENTE completado
                    // e se o dia processado é hoje ou passado (para projetar o futuro)
                    if (useSRS && realTopic && realTopic.completed) {
                        const intervals = getReviewIntervals(sub);
                        intervals.forEach(interval => {
                            const reviewDay = day + interval;
                            // Agenda apenas se cair dentro da visualização atual (+ margem)
                            if (reviewDay <= daysInMonth + 60) addReview(reviewDay, sub);
                        });
                    }
                });
            }
        });

        // Se for passado estrito (ontem para trás), o calendário é apenas o histórico.
        // Se for HOJE, queremos misturar o Histórico (já feito) com o Planejado (a fazer).
        if (isPastDate) {
            schedule[day] = dailyItems.length > 0 ? dailyItems : [];
            continue; 
        }

        // -------------------------------------------------------------------------
        // ETAPA B: SIMULAÇÃO (Hoje e Futuro)
        // Preenche o restante do tempo.
        // -------------------------------------------------------------------------
        
        if (!isDayActive) {
            // Se é dia de folga, mas o usuário estudou (log existe), mostramos o log.
            // Se não estudou, é null (folga).
            schedule[day] = dailyItems.length > 0 ? dailyItems : null;
            
            // Empurra revisões pendentes para o próximo dia (não perde a revisão)
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
                // Se eu JÁ estudei a matéria hoje (log real), considero que a revisão foi feita ou englobada.
                // Mas para ser estrito, se a modalidade do log não foi 'REVIEW', talvez devesse manter.
                // Por simplificação: Se tocou na matéria, conta como visto.
                if (!subjectsStudiedToday.has(revSub.id)) {
                    dailyItems.push({ subject: revSub, type: 'REVIEW' });
                    // Marca como "ocupado" para não sugerir teoria nova da mesma matéria no mesmo dia
                    // a menos que sobrem slots.
                    // subjectsStudiedToday.add(revSub.id); // Descomente para impedir Teoria+Revisão no mesmo dia
                }
            });
        }

        // 2. Preencher Vagas com Teoria Nova (Simulação)
        // Conta quantos slots de "Matérias Novas" ainda temos.
        // Se hoje eu já estudei 1 matéria (log), e minha meta é 2, o sistema sugere mais 1.
        const logsTheoryCount = dailyItems.filter(i => i.type === 'THEORY' && i.durationMinutes !== undefined).length;
        let slotsForTheory = settings.subjectsPerDay - logsTheoryCount;
        
        if (slotsForTheory < 0) slotsForTheory = 0;

        for (let i = 0; i < slotsForTheory; i++) {
            // Pega próxima matéria, tentando evitar as que já estão na lista de hoje (Logs ou Revisões)
            const selectedSubject = getNextSubject(subjectsStudiedToday);
            
            // Se não sobrou nenhuma matéria (todas estudadas ou deck vazio), para.
            if (!selectedSubject) break;

            // Marca que essa matéria foi "alocada" hoje para não repetir no loop
            subjectsStudiedToday.add(selectedSubject.id);

            const idx = subjectTopicCursors[selectedSubject.id];
            
            if (selectedSubject.topics && idx < selectedSubject.topics.length) {
                const topic = selectedSubject.topics[idx];
                
                // Simula o avanço do cursor para dias futuros
                subjectTopicCursors[selectedSubject.id] = idx + 1;

                dailyItems.push({ subject: selectedSubject, type: 'THEORY', topic: topic });
            } else {
                // Fim dos tópicos (Revisão Geral ou Finalizada)
                dailyItems.push({ subject: selectedSubject, type: 'THEORY' }); 
            }
        }

        // 3. Distribuir Tempo Restante
        // Calcula tempo apenas para itens simulados (sem durationMinutes)
        const itemsToSchedule = dailyItems.filter(i => !i.durationMinutes);
        
        if (itemsToSchedule.length > 0) {
            // Calcula quanto tempo já foi gasto com logs reais
            const timeSpent = dailyItems.reduce((acc, item) => acc + (item.durationMinutes || 0), 0);
            const timeRemaining = Math.max(0, dailyTimeMinutes - timeSpent);
            
            if (timeRemaining > 0) {
                const totalWeight = itemsToSchedule.reduce((acc, item) => acc + (item.type === 'REVIEW' ? 1 : 2), 0);
                
                itemsToSchedule.forEach(item => {
                    const weight = item.type === 'REVIEW' ? 1 : 2;
                    // Distribuição ponderada do tempo restante
                    item.durationMinutes = Math.max(15, Math.round((weight / totalWeight) * timeRemaining));
                });
            } else {
                // Se estourou o tempo com logs, os itens simulados ficam com tempo mínimo ou 0 (indicando extra)
                itemsToSchedule.forEach(item => item.durationMinutes = 15);
            }
        }

        schedule[day] = dailyItems;
    }

    return schedule;
};
