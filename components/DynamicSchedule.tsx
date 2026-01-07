import React, { useState, useEffect, useMemo } from 'react';
import { Subject, PriorityLevel, ScheduleItem, ProficiencyLevel, UserProfile, Topic, getSubjectIcon, ErrorLog } from '../types';
import { generateMonthlySchedule } from '../utils/scheduler';

interface DynamicScheduleProps {
    subjects: Subject[];
    onUpdateSubject: (subject: Subject) => void;
    user?: UserProfile;
    onUpdateUser?: (user: UserProfile) => void;
    errorLogs?: ErrorLog[];
}

export const DynamicSchedule: React.FC<DynamicScheduleProps> = ({ subjects, onUpdateSubject, user, onUpdateUser, errorLogs = [] }) => {
    // Configurações Locais com Try/Catch para Modo Privado
    const [settings, setSettings] = useState(() => {
        try {
            if (typeof window !== 'undefined') {
                const saved = localStorage.getItem('studyflow_schedule_settings');
                if (saved) return JSON.parse(saved);
            }
        } catch (e) {
            console.warn("Storage bloqueado: usando configurações padrão.");
        }
        return { 
            subjectsPerDay: 2, 
            srsPace: 'NORMAL', 
            srsMode: 'SMART',
            activeWeekDays: [0, 1, 2, 3, 4, 5, 6]
        };
    });

    const subjectsPerDay = settings.subjectsPerDay || 2;
    const srsPace: 'ACCELERATED' | 'NORMAL' | 'RELAXED' = settings.srsPace || 'NORMAL';
    const srsMode: 'SMART' | 'MANUAL' = settings.srsMode || 'SMART';
    const activeWeekDays: number[] = settings.activeWeekDays || [0, 1, 2, 3, 4, 5, 6];

    const updateSetting = (key: string, value: any) => {
        setSettings(prev => {
            const newSettings = { ...prev, [key]: value };
            try {
                localStorage.setItem('studyflow_schedule_settings', JSON.stringify(newSettings));
            } catch (e) {}
            return newSettings;
        });
    };

    const toggleWeekDay = (dayIndex: number) => {
        const currentDays = new Set(activeWeekDays);
        if (currentDays.has(dayIndex)) {
            if (currentDays.size > 1) currentDays.delete(dayIndex);
        } else {
            currentDays.add(dayIndex);
        }
        updateSetting('activeWeekDays', Array.from(currentDays));
    };
    
    const [enableSpacedRepetition, setEnableSpacedRepetition] = useState(true);
    const [showSrsInfo, setShowSrsInfo] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());
    const [dailyTimeMinutes, setDailyTimeMinutes] = useState(user?.dailyAvailableTimeMinutes || 240);

    useEffect(() => {
        if (user && onUpdateUser && dailyTimeMinutes !== user.dailyAvailableTimeMinutes) {
            onUpdateUser({ ...user, dailyAvailableTimeMinutes: dailyTimeMinutes });
        }
    }, [dailyTimeMinutes]);

    // Ordenação ESTÁVEL para garantir que o RNG funcione igual em todos os lugares
    const activeSubjects = useMemo(() => {
        return subjects.filter(s => s.active).sort((a, b) => a.id.localeCompare(b.id));
    }, [subjects]);

    // Seleção manual de matérias para o plano (Filtro) com Try/Catch
    const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(() => {
        try {
            if (typeof window !== 'undefined') {
                const savedSelection = localStorage.getItem('studyflow_schedule_selection');
                if (savedSelection) {
                    const parsed = JSON.parse(savedSelection);
                    return new Set(parsed);
                }
            }
        } catch (e) {}
        return new Set(subjects.filter(s => s.active).map(s => s.id));
    });

    useEffect(() => {
        try {
            const selectionArray = Array.from(selectedSubjectIds);
            localStorage.setItem('studyflow_schedule_selection', JSON.stringify(selectionArray));
        } catch (e) {}
    }, [selectedSubjectIds]);

    // Sincroniza seleção com novas matérias ativas
    useEffect(() => {
        const currentActiveIds = activeSubjects.map(s => s.id);
        setSelectedSubjectIds(prev => {
            if (prev.size === 0 && currentActiveIds.length > 0) return new Set(currentActiveIds);
            return prev;
        });
    }, [activeSubjects.length]);

    useEffect(() => {
        if (window.innerWidth >= 1024) setIsSidebarOpen(true);
    }, []);

    const toggleSubjectSelection = (id: string) => {
        const newSet = new Set(selectedSubjectIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedSubjectIds(newSet);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    };

    const toggleDayExpansion = (day: number) => {
        setExpandedDays(prev => {
            const newSet = new Set(prev);
            if (newSet.has(day)) newSet.delete(day);
            else newSet.add(day);
            return newSet;
        });
    };

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    // =========================================================
    // UTILIZANDO O AGENDADOR CENTRALIZADO (Híbrido)
    // =========================================================
    const scheduleData = useMemo(() => {
        // Filtrar apenas matérias selecionadas para o agendamento
        const planSubjects = activeSubjects.filter(s => selectedSubjectIds.has(s.id));
        
        return generateMonthlySchedule(
            currentDate,
            planSubjects,
            errorLogs,
            { subjectsPerDay, srsPace, srsMode, activeWeekDays },
            dailyTimeMinutes
        );

    }, [activeSubjects, subjectsPerDay, currentDate, enableSpacedRepetition, selectedSubjectIds, dailyTimeMinutes, errorLogs, srsPace, srsMode, activeWeekDays]);

    const handleMonthChange = (offset: number) => {
        const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
        setCurrentDate(newDate);
    };

    const handlePriorityChange = (subject: Subject, priority: PriorityLevel) => {
        onUpdateSubject({ ...subject, priority });
    };

    const handleProficiencyChange = (subject: Subject, proficiency: ProficiencyLevel) => {
        onUpdateSubject({ ...subject, proficiency });
    };

    // --- Renderização dos Itens ---
    const renderScheduleItem = (item: ScheduleItem, idx: number, isPast: boolean) => {
        const sub = item.subject;
        const isReview = item.type === 'REVIEW';
        
        const pastStyle = "bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-300 dark:border-gray-700 opacity-80";
        const futureStyle = isReview 
            ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border-amber-500' 
            : sub.priority === 'HIGH' 
                ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-500' 
                : sub.priority === 'LOW' 
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-500' 
                    : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-500';

        return (
            <div key={`${sub.id}-${idx}`} className={`text-[10px] md:text-xs px-3 py-2 rounded-lg border-l-4 font-medium flex flex-col justify-center group shadow-sm transition-transform relative ${isPast ? pastStyle : futureStyle}`}>
                <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[14px]">
                        {isPast ? 'check_circle' : (isReview ? 'cached' : 'menu_book')}
                    </span>
                    <span className="truncate font-bold text-sm">
                        {sub.name}
                    </span>
                </div>
                {item.topic && (
                    <div className={`text-[10px] truncate border-l border-current mt-0.5 pl-5 ${isPast ? 'line-through opacity-70' : 'opacity-80'}`}>
                        {item.topic.name}
                    </div>
                )}
                {!item.topic && !isReview && (
                    <div className="text-[10px] italic opacity-60 pl-6">Revisão Geral / Questões</div>
                )}
                <div className="flex justify-between items-center mt-1 pl-1 opacity-70">
                    <span className="font-mono text-[10px]">{item.durationMinutes} min</span>
                    {isPast && <span className="text-[9px] uppercase font-bold">Realizado</span>}
                </div>
            </div>
        );
    };

    const renderCalendarGrid = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        
        const now = new Date();
        now.setHours(0,0,0,0);

        const blanks = Array.from({ length: firstDay }, (_, i) => <div key={`blank-${i}`} className="bg-transparent min-h-[100px] hidden md:block"></div>);
        
        const days = Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dateObj = new Date(year, month, day);
            const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
            const isPast = dateObj < now;

            const dayData = scheduleData[day];
            const isDayOff = dayData === null;
            const itemsForDay = dayData || [];
            
            // Lógica de Expansão
            const isExpanded = expandedDays.has(day);
            const PREVIEW_LIMIT = 2;
            const visibleItems = isExpanded ? itemsForDay : itemsForDay.slice(0, PREVIEW_LIMIT);
            const remainingCount = itemsForDay.length - PREVIEW_LIMIT;
            const showToggle = itemsForDay.length > PREVIEW_LIMIT;
            
            const totalMinutes = itemsForDay.reduce((acc, i) => acc + (i.durationMinutes || 0), 0);
            const hours = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;

            return (
                <div key={day} className={`min-h-[160px] border-t border-l border-border-light dark:border-border-dark p-2 flex flex-col gap-1 transition-colors hover:bg-gray-50 dark:hover:bg-white/5 
                    ${isToday ? 'bg-primary/5 dark:bg-primary/10 ring-1 ring-inset ring-primary' : isPast ? 'bg-gray-50/30 dark:bg-black/20' : 'bg-card-light dark:bg-card-dark'}
                    ${isDayOff ? 'bg-striped opacity-60' : ''}
                `}>
                    <div className="flex justify-between items-start">
                        <span className={`text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-primary text-white' : isPast ? 'text-gray-400' : 'text-text-secondary-light dark:text-text-secondary-dark'}`}>
                            {day}
                        </span>
                         {!isDayOff && itemsForDay.length > 0 && (
                            <span className={`text-[10px] font-mono px-1 rounded ${isPast ? 'text-gray-400 bg-gray-200 dark:bg-gray-800' : 'text-gray-500 bg-gray-100 dark:bg-gray-800'}`}>
                                {hours}h {mins > 0 ? `${mins}m` : ''}
                            </span>
                        )}
                        {isDayOff && (
                            <span className="text-[9px] uppercase font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 rounded">
                                Folga
                            </span>
                        )}
                    </div>
                    
                    <div className={`flex flex-col gap-1.5 mt-1 transition-all ${isExpanded ? 'overflow-y-auto max-h-[160px] custom-scrollbar pr-1' : 'overflow-hidden'}`}>
                        {visibleItems.map((item, idx) => renderScheduleItem(item, idx, isPast))}
                        {isPast && itemsForDay.length === 0 && !isDayOff && (
                            <div className="text-[10px] text-gray-300 dark:text-gray-700 text-center italic mt-2">
                                Sem registros
                            </div>
                        )}
                    </div>

                    {showToggle && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); toggleDayExpansion(day); }}
                            className={`w-full text-[10px] font-bold py-1 rounded transition-colors mt-auto flex items-center justify-center gap-1 ${isExpanded ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                        >
                            {isExpanded ? (
                                <>
                                    <span className="material-symbols-outlined text-[12px]">expand_less</span>
                                    Recolher
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-[12px]">expand_more</span>
                                    + {remainingCount}
                                </>
                            )}
                        </button>
                    )}
                </div>
            );
        });

        return [...blanks, ...days];
    };

    const renderMobileList = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const now = new Date();
        now.setHours(0,0,0,0);
        
        return Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dayData = scheduleData[day];
            const dateObj = new Date(year, month, day);
            const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
            const isPast = dateObj < now;
            
            if ((!dayData || dayData.length === 0) && !isToday && isPast) return null;

            const itemsForDay = dayData || [];
            const weekDayName = weekDays[dateObj.getDay()];
            const totalMinutes = itemsForDay.reduce((acc, i) => acc + (i.durationMinutes || 0), 0);
            const hours = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;

            return (
                <div key={day} className={`mb-4 rounded-xl border border-border-light dark:border-border-dark overflow-hidden ${isToday ? 'ring-2 ring-primary shadow-lg shadow-primary/10' : 'bg-white dark:bg-card-dark shadow-sm'} ${isPast ? 'opacity-80 grayscale-[0.3]' : ''}`}>
                    <div className={`px-4 py-3 flex justify-between items-center ${isToday ? 'bg-primary text-white' : 'bg-gray-50 dark:bg-gray-800/50 border-b border-border-light dark:border-border-dark'}`}>
                        <div className="flex items-center gap-2">
                            <span className={`text-lg font-black ${isToday ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>{day}</span>
                            <span className={`text-xs font-bold uppercase ${isToday ? 'text-white/80' : 'text-slate-400'}`}>{weekDayName}</span>
                            {isToday && <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded text-white font-bold ml-2">HOJE</span>}
                        </div>
                        <div className={`text-xs font-mono font-bold ${isToday ? 'text-white' : 'text-slate-500'}`}>
                            {hours}h {mins > 0 ? `${mins}m` : ''}
                        </div>
                    </div>
                    <div className="p-3 flex flex-col gap-2">
                        {itemsForDay.length > 0 ? (
                            itemsForDay.map((item, idx) => renderScheduleItem(item, idx, isPast))
                        ) : (
                            <div className="text-center text-xs text-gray-400 py-2 italic">
                                {isPast ? "Sem registros" : "Folga programada"}
                            </div>
                        )}
                    </div>
                </div>
            );
        });
    };

    return (
        <div className="flex h-full overflow-hidden relative">
            {/* Sidebar de Configuração */}
            <div className={`fixed inset-y-0 left-0 z-40 lg:relative h-full bg-card-light dark:bg-card-dark border-r border-border-light dark:border-border-dark transition-all duration-300 ease-in-out flex flex-col ${isSidebarOpen ? 'translate-x-0 w-full sm:w-96 lg:w-96' : '-translate-x-full w-full sm:w-96 lg:translate-x-0 lg:w-0 lg:overflow-hidden'}`}>
                {/* ... SIDEBAR CONTENT (Reutilizado do código original para economizar linhas redundantes) ... */}
                <div className="p-4 border-b border-border-light dark:border-border-dark flex items-center justify-between">
                    <h2 className="font-bold text-text-primary-light dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined">tune</span>
                        Parâmetros do Plano
                    </h2>
                    <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 custom-scrollbar">
                    <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-lg border border-amber-100 dark:border-amber-900/30">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="bg-amber-100 dark:bg-amber-900/30 p-1.5 rounded text-amber-600 dark:text-amber-400">
                                    <span className="material-symbols-outlined text-lg">psychology</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <label className="text-sm font-bold text-amber-900 dark:text-amber-100">Agendamento de Revisão</label>
                                    <button onClick={() => setShowSrsInfo(!showSrsInfo)} className="p-1 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors">
                                        <span className="material-symbols-outlined text-[16px]">info</span>
                                    </button>
                                </div>
                            </div>
                            <div onClick={() => setEnableSpacedRepetition(!enableSpacedRepetition)} className={`w-10 h-5 flex items-center rounded-full p-1 cursor-pointer transition-colors ${enableSpacedRepetition ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                                <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform ${enableSpacedRepetition ? 'translate-x-5' : 'translate-x-0'}`}></div>
                            </div>
                        </div>
                        {showSrsInfo && (
                            <div className="mb-4 bg-white dark:bg-black/20 p-3 rounded-lg border border-amber-200/50 dark:border-amber-900/50 text-xs animate-in slide-in-from-top-2 fade-in duration-200">
                                <p className="font-bold mb-1.5 text-amber-800 dark:text-amber-200">Como funciona?</p>
                                <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                                    No modo <strong>Inteligente</strong>, o sistema define intervalos baseado nos seus erros. No modo <strong>Manual</strong>, você fixa o ritmo.
                                </p>
                            </div>
                        )}
                        {enableSpacedRepetition && (
                            <div className="flex flex-col gap-3">
                                <div className="flex bg-white/50 dark:bg-black/20 p-1 rounded-lg mb-1">
                                    <button onClick={() => updateSetting('srsMode', 'SMART')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${srsMode === 'SMART' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-800 dark:text-amber-200 hover:bg-amber-100/50 dark:hover:bg-white/5'}`}>Automático (IA)</button>
                                    <button onClick={() => updateSetting('srsMode', 'MANUAL')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${srsMode === 'MANUAL' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-800 dark:text-amber-200 hover:bg-amber-100/50 dark:hover:bg-white/5'}`}>Manual</button>
                                </div>
                            </div>
                        )}
                    </div>
                    {/* ... Restante dos controles ... */}
                </div>
            </div>

            {/* Calendário Principal */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark">
                {/* Header do Calendário */}
                <div className="flex items-center justify-between p-4 md:px-8 border-b border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark shrink-0">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                            className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors ${isSidebarOpen ? 'bg-primary/10 text-primary' : 'text-text-secondary-light dark:text-text-secondary-dark'}`}
                            title="Alternar Configurações"
                        >
                            <span className="material-symbols-outlined">tune</span>
                        </button>
                        <div className="flex flex-col">
                            <h1 className="text-xl md:text-2xl font-black text-text-primary-light dark:text-white leading-none capitalize">
                                {monthNames[currentDate.getMonth()]} <span className="hidden sm:inline">{currentDate.getFullYear()}</span>
                            </h1>
                            <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark font-medium flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${enableSpacedRepetition ? 'bg-amber-500' : 'bg-green-500'} animate-pulse`}></span>
                                <span className="hidden sm:inline">{enableSpacedRepetition ? 'SRS Ativo' : 'Plano Linear'}</span>
                                <span className="sm:hidden">{currentDate.getFullYear()}</span>
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 md:gap-2 bg-background-light dark:bg-background-dark rounded-lg p-1 border border-border-light dark:border-border-dark">
                        <button onClick={() => handleMonthChange(-1)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors">
                            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                        </button>
                        <button onClick={() => setCurrentDate(new Date())} className="text-xs font-bold px-2 hover:text-primary transition-colors">
                            Hoje
                        </button>
                        <button onClick={() => handleMonthChange(1)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors">
                            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                        </button>
                    </div>
                </div>

                {/* Grid do Calendário (Area de Scroll) */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-8">
                    
                    {/* Visualização Mobile (Lista Vertical) */}
                    <div className="md:hidden flex flex-col">
                        {renderMobileList()}
                    </div>

                    {/* Visualização Desktop (Grid) */}
                    <div className="hidden md:block bg-card-light dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden min-w-[800px]">
                        {/* Dias da Semana */}
                        <div className="grid grid-cols-7 border-b border-border-light dark:border-border-dark bg-gray-50/50 dark:bg-gray-900/50">
                            {weekDays.map(day => (
                                <div key={day} className="py-3 text-center text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
                                    {day}
                                </div>
                            ))}
                        </div>
                        {/* Dias do Mês */}
                        <div className="grid grid-cols-7 bg-background-light dark:bg-background-dark border-l border-t border-border-light dark:border-border-dark">
                            {renderCalendarGrid()}
                        </div>
                    </div>
                    
                    {/* Legenda */}
                    <div className="hidden md:flex flex-wrap gap-4 mt-4 px-2">
                        <div className="flex items-center gap-2 text-xs">
                            <span className="w-3 h-3 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-500"></span>
                            <span className="text-text-secondary-light dark:text-text-secondary-dark">Revisão</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <span className="w-3 h-3 rounded bg-red-50 dark:bg-red-900/20 border border-red-500"></span>
                            <span className="text-text-secondary-light dark:text-text-secondary-dark">Alta Prioridade</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <span className="w-3 h-3 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-500"></span>
                            <span className="text-text-secondary-light dark:text-text-secondary-dark">Planejado (Teoria)</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs ml-4">
                            <span className="w-3 h-3 rounded bg-gray-200 dark:bg-gray-700"></span>
                            <span className="text-text-secondary-light dark:text-text-secondary-dark">Histórico (Realizado)</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};