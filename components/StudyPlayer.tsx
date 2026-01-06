import React, { useState, useEffect, useRef } from 'react';
import { AiTutorChat } from './AiTutorChat';
import { Subject, ScheduleItem, Topic, StudyModality, Screen } from '../types';

interface StudyPlayerProps {
    apiKey?: string;
    model?: string;
    subjects?: Subject[];
    dailyAvailableTime?: number; // minutos
    onSessionComplete?: (subjectId: string, topicId: string, duration: number, questions: number, correct: number, isFinished: boolean) => void;
    onNavigate?: (screen: Screen) => void;
    onSaveNote?: (content: string, subject: string, topic: string) => void;
}

interface PersistedPlayerState {
    todaysQueue: ScheduleItem[];
    currentItemIndex: number;
    timeLeft: number;
    initialTime: number;
    elapsedTime: number;
    date: string;
}

export const StudyPlayer: React.FC<StudyPlayerProps> = ({ apiKey, model, subjects = [], dailyAvailableTime = 240, onSessionComplete, onNavigate, onSaveNote }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    
    // Estado da Playlist do Dia
    const [todaysQueue, setTodaysQueue] = useState<ScheduleItem[]>([]);
    const [currentItemIndex, setCurrentItemIndex] = useState(0);

    // Estado do Timer
    const [timeLeft, setTimeLeft] = useState(25 * 60); 
    const [initialTime, setInitialTime] = useState(25 * 60); // Para resetar a barra de progresso se tiver
    const [elapsedTime, setElapsedTime] = useState(0);
    const timerRef = useRef<number | null>(null);

    // Estados do Relatório (Feedback)
    const [sessionTopicId, setSessionTopicId] = useState<string>('');
    const [sessionDuration, setSessionDuration] = useState<number>(0);
    const [questionsDone, setQuestionsDone] = useState(0);
    const [questionsCorrect, setQuestionsCorrect] = useState(0);
    const [isTopicFinished, setIsTopicFinished] = useState(false);
    
    // Novo Estado de Modalidade
    const [selectedModality, setSelectedModality] = useState<StudyModality>('PDF');

    // --- CARREGAR ESTADO PERSISTIDO ---
    useEffect(() => {
        const savedState = localStorage.getItem('studyflow_player_state');
        if (savedState) {
            try {
                const parsed: PersistedPlayerState = JSON.parse(savedState);
                const today = new Date().toISOString().split('T')[0];
                
                // Só restaura se for do mesmo dia
                if (parsed.date === today && parsed.todaysQueue.length > 0) {
                    // Restaurar referencias de Subject que podem ter sido atualizadas no App
                    const rehydratedQueue = parsed.todaysQueue.map(item => {
                        const freshSubject = subjects.find(s => s.id === item.subject.id) || item.subject;
                        const freshTopic = item.topic ? freshSubject.topics.find(t => t.id === item.topic?.id) : undefined;
                        return { ...item, subject: freshSubject, topic: freshTopic || item.topic };
                    });

                    setTodaysQueue(rehydratedQueue);
                    setCurrentItemIndex(parsed.currentItemIndex);
                    setTimeLeft(parsed.timeLeft);
                    setInitialTime(parsed.initialTime);
                    setElapsedTime(parsed.elapsedTime);
                    return; 
                }
            } catch (e) {
                console.error("Erro ao carregar estado do player", e);
            }
        }
        
        generateDailyQueue();
    }, [subjects, dailyAvailableTime]);

    // --- SALVAR ESTADO PERSISTIDO (Auto-save) ---
    useEffect(() => {
        if (todaysQueue.length > 0) {
            const stateToSave: PersistedPlayerState = {
                todaysQueue,
                currentItemIndex,
                timeLeft,
                initialTime,
                elapsedTime,
                date: new Date().toISOString().split('T')[0]
            };
            localStorage.setItem('studyflow_player_state', JSON.stringify(stateToSave));
        }
    }, [todaysQueue, currentItemIndex, timeLeft, initialTime, elapsedTime]);

    // --- AUDIO ALARM ---
    const playAlarm = () => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) {
            console.error("Audio playback failed", e);
        }
    };

    const generateDailyQueue = () => {
        if (subjects.length === 0) return;
        const activeSubjects = subjects.filter(s => s.active);
        if (activeSubjects.length === 0) { setTodaysQueue([]); return; }

        const todaysSelection = activeSubjects.slice(0, 4); 
        const weightedItems = todaysSelection.map(sub => {
            const priorityWeight = sub.priority === 'HIGH' ? 3 : sub.priority === 'LOW' ? 1 : 2;
            const proficiencyWeight = sub.proficiency === 'BEGINNER' ? 3 : sub.proficiency === 'ADVANCED' ? 1 : 2;
            const nextTopic = sub.topics.find(t => !t.completed);
            return { subject: sub, topic: nextTopic, weight: priorityWeight * proficiencyWeight };
        });

        const totalDailyWeight = weightedItems.reduce((acc, item) => acc + item.weight, 0);
        const queue: ScheduleItem[] = weightedItems.map(item => {
            let duration = Math.round((item.weight / totalDailyWeight) * dailyAvailableTime);
            if (duration < 15) duration = 15;
            return { subject: item.subject, topic: item.topic, type: 'THEORY', durationMinutes: duration };
        });

        setTodaysQueue(queue);
        if (queue.length > 0) {
            const duration = (queue[0].durationMinutes || 25) * 60;
            setTimeLeft(duration);
            setInitialTime(duration);
        }
    };

    // Timer Logic
    useEffect(() => {
        if (isPlaying && timeLeft > 0) {
            timerRef.current = window.setInterval(() => {
                setTimeLeft((prev) => prev - 1);
                setElapsedTime((prev) => prev + 1);
            }, 1000);
        } else if (timeLeft === 0 && isPlaying) {
            setIsPlaying(false);
            if (timerRef.current) clearInterval(timerRef.current);
            playAlarm();
            handleFinishSession();
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [isPlaying, timeLeft]);

    const togglePlay = () => { setIsPlaying(!isPlaying); };

    const handleSetTime = (minutes: number) => {
        setIsPlaying(false);
        setElapsedTime(0);
        const seconds = minutes * 60;
        setTimeLeft(seconds);
        setInitialTime(seconds);
    };

    const handleFinishSession = () => {
        setIsPlaying(false);
        const calculatedDuration = Math.max(1, Math.round(elapsedTime / 60));
        setSessionDuration(calculatedDuration);
        setSessionTopicId(currentItem.topic?.id || '');
        setQuestionsDone(0);
        setQuestionsCorrect(0);
        setIsTopicFinished(false);
        setIsReportOpen(true);
    };

    const submitReport = () => {
        if (onSessionComplete && currentItem) {
            const finalTopicId = sessionTopicId || (currentItem.topic ? currentItem.topic.id : '');
            
            // Aqui poderíamos passar a modalidade também no futuro se alterarmos a assinatura do onSessionComplete
            onSessionComplete(
                currentItem.subject.id,
                finalTopicId, 
                sessionDuration,
                questionsDone,
                questionsCorrect,
                isTopicFinished
            );
        }

        setIsReportOpen(false);
        setElapsedTime(0);

        if (currentItemIndex < todaysQueue.length - 1) {
            const nextIndex = currentItemIndex + 1;
            const nextDur = (todaysQueue[nextIndex].durationMinutes || 25) * 60;
            
            setCurrentItemIndex(nextIndex);
            setTimeLeft(nextDur);
            setInitialTime(nextDur);

            const stateToSave: PersistedPlayerState = {
                todaysQueue,
                currentItemIndex: nextIndex,
                timeLeft: nextDur,
                initialTime: nextDur,
                elapsedTime: 0,
                date: new Date().toISOString().split('T')[0]
            };
            localStorage.setItem('studyflow_player_state', JSON.stringify(stateToSave));

        } else {
            alert("Parabéns! Você completou a fila de hoje.");
            localStorage.removeItem('studyflow_player_state');
            setTodaysQueue([]);
        }
    };

    const handlePrevItem = () => {
        if (currentItemIndex > 0) {
            const prevIndex = currentItemIndex - 1;
            setCurrentItemIndex(prevIndex);
            setIsPlaying(false);
            const prevDur = (todaysQueue[prevIndex].durationMinutes || 25) * 60;
            setTimeLeft(prevDur);
            setInitialTime(prevDur);
            setElapsedTime(0);
        }
    };
    
    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return { h, m, s };
    };

    const time = formatTime(timeLeft);
    const currentItem = todaysQueue[currentItemIndex];

    if (todaysQueue.length === 0) {
         return (
             <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
                 <div className="bg-white dark:bg-card-dark p-8 md:p-12 rounded-3xl shadow-xl shadow-primary/5 border border-border-light dark:border-border-dark text-center max-w-lg w-full flex flex-col items-center animate-in zoom-in-95 duration-300">
                     <div className="bg-primary/10 w-24 h-24 rounded-full flex items-center justify-center mb-6 ring-8 ring-primary/5">
                        <span className="material-symbols-outlined text-5xl text-primary">auto_schedule</span>
                     </div>
                     
                     <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-3 leading-tight">
                         Vamos planejar o foco de hoje?
                     </h2>
                     
                     <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed text-sm md:text-base">
                         O algoritmo não encontrou atividades pendentes para agora. Você pode gerar uma nova fila baseada nas prioridades atuais ou ajustar seu cronograma.
                     </p>
                     
                     <div className="flex flex-col sm:flex-row gap-3 w-full">
                        <button 
                            onClick={generateDailyQueue} 
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-primary hover:bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95"
                        >
                             <span className="material-symbols-outlined">refresh</span>
                             Gerar Fila Agora
                         </button>
                         
                         {onNavigate && (
                             <button 
                                onClick={() => onNavigate(Screen.DYNAMIC_SCHEDULE)} 
                                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-xl text-sm font-bold transition-all active:scale-95"
                            >
                                 <span className="material-symbols-outlined">calendar_month</span>
                                 Ajustar Plano
                             </button>
                         )}
                     </div>
                 </div>
             </div>
         );
    }

    const modalities: {id: StudyModality, label: string, icon: string}[] = [
        { id: 'PDF', label: 'PDF / Leitura', icon: 'picture_as_pdf' },
        { id: 'VIDEO', label: 'Videoaula', icon: 'play_lesson' },
        { id: 'QUESTIONS', label: 'Questões', icon: 'quiz' },
        { id: 'LEGISLATION', label: 'Lei Seca', icon: 'gavel' },
        { id: 'REVIEW', label: 'Revisão', icon: 'cached' },
    ];

    return (
        <div className="flex-1 flex justify-center p-4 md:p-8 overflow-y-auto relative">
            <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
                <div className="lg:col-span-8 flex flex-col gap-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-1">Modo Foco</h1>
                            <div className="flex items-center gap-2 text-primary font-medium">
                                <span className="relative flex h-3 w-3">
                                    <span className={`absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 ${isPlaying ? 'animate-ping' : ''}`}></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                                </span>
                                <span>{isPlaying ? 'Fluxo Ativo' : 'Pausado'}</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <div className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">
                                 {currentItemIndex + 1} de {todaysQueue.length}
                             </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-[#1e1e2d] rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 md:p-10 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                        
                        {/* Quick Timer Presets */}
                        <div className="absolute top-4 left-4 flex gap-2 z-20">
                            {[
                                { min: 25, label: 'Pomodoro' },
                                { min: 50, label: '50min' },
                                { min: 90, label: '90min' }
                            ].map(preset => (
                                <button
                                    key={preset.min}
                                    onClick={() => handleSetTime(preset.min)}
                                    className="px-3 py-1 text-[10px] font-bold uppercase rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-transparent hover:border-slate-300 dark:hover:border-slate-600"
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>

                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1/2 bg-primary/5 blur-[100px] rounded-full pointer-events-none"></div>
                        <div className="relative z-10 w-full max-w-2xl">
                            <div className="mb-6 mt-6">
                                <h2 className="text-slate-500 dark:text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Matéria Atual</h2>
                                <p className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2">{currentItem.subject.name}</p>
                                <div className="flex items-center justify-center gap-2">
                                     {currentItem.topic ? (
                                        <div className="bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full flex items-center gap-2 text-primary text-sm">
                                            <span className="material-symbols-outlined text-[16px]">layers</span>
                                            <span className="font-medium truncate max-w-[300px]">{currentItem.topic.name}</span>
                                        </div>
                                     ) : (
                                        <div className="bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full flex items-center gap-2 text-gray-500 text-sm">
                                             <span className="material-symbols-outlined text-[16px]">all_inclusive</span>
                                             <span>Estudo Geral / Revisão</span>
                                        </div>
                                     )}
                                </div>
                            </div>

                            {/* Modality Selector */}
                            <div className="flex justify-center gap-2 mb-8">
                                {modalities.map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => setSelectedModality(m.id)}
                                        className={`flex flex-col items-center gap-1 p-2 w-20 rounded-lg border transition-all ${
                                            selectedModality === m.id 
                                            ? 'bg-primary/10 border-primary text-primary' 
                                            : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <span className="material-symbols-outlined">{m.icon}</span>
                                        <span className="text-[9px] font-bold">{m.label}</span>
                                    </button>
                                ))}
                            </div>
                            
                            {/* TIMER DISPLAY */}
                            <div className="flex items-center justify-center gap-2 sm:gap-4 mb-10 font-mono">
                                <div className="flex flex-col gap-2">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-6 md:px-8 md:py-8 min-w-[100px] md:min-w-[140px] border border-slate-100 dark:border-slate-700/50 transition-colors">
                                        <span className="text-5xl md:text-7xl font-bold text-slate-900 dark:text-white tracking-tighter">
                                            {time.h.toString().padStart(2, '0')}
                                        </span>
                                    </div>
                                    <span className="text-xs text-slate-400 uppercase font-medium">Horas</span>
                                </div>
                                <span className="text-4xl md:text-6xl font-bold text-slate-300 dark:text-slate-600 pb-8 animate-pulse">:</span>
                                <div className="flex flex-col gap-2">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-6 md:px-8 md:py-8 min-w-[100px] md:min-w-[140px] border border-slate-100 dark:border-slate-700/50 transition-colors">
                                        <span className="text-5xl md:text-7xl font-bold text-primary tracking-tighter">
                                            {time.m.toString().padStart(2, '0')}
                                        </span>
                                    </div>
                                    <span className="text-xs text-slate-400 uppercase font-medium">Minutos</span>
                                </div>
                                <span className="text-4xl md:text-6xl font-bold text-slate-300 dark:text-slate-600 pb-8 animate-pulse">:</span>
                                <div className="flex flex-col gap-2">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-6 md:px-8 md:py-8 min-w-[100px] md:min-w-[140px] border border-slate-100 dark:border-slate-700/50 transition-colors">
                                        <span className="text-5xl md:text-7xl font-bold text-slate-900 dark:text-white tracking-tighter">
                                            {time.s.toString().padStart(2, '0')}
                                        </span>
                                    </div>
                                    <span className="text-xs text-slate-400 uppercase font-medium">Segundos</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-center gap-4">
                                <button 
                                    onClick={handlePrevItem}
                                    disabled={currentItemIndex === 0}
                                    className="size-14 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-transparent hover:border-slate-300 dark:hover:border-slate-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed" 
                                    title="Anterior"
                                >
                                    <span className="material-symbols-outlined text-2xl">skip_previous</span>
                                </button>
                                <button 
                                    onClick={togglePlay}
                                    className={`h-16 px-12 rounded-full ${isPlaying ? 'bg-amber-500 hover:bg-amber-600' : 'bg-primary hover:bg-blue-600'} text-white shadow-lg hover:shadow-primary/30 flex items-center gap-3 transition-all transform hover:scale-105 active:scale-95`}
                                >
                                    <span className="material-symbols-outlined text-3xl">{isPlaying ? 'pause' : 'play_arrow'}</span>
                                    <div className="flex flex-col items-start leading-none">
                                        <span className="text-lg font-bold">{isPlaying ? 'Pausar' : 'Iniciar'}</span>
                                        <span className="text-[10px] opacity-80 font-medium tracking-wide uppercase">
                                            {isPlaying ? 'Focando' : 'Iniciar Sessão'}
                                        </span>
                                    </div>
                                </button>
                                <button 
                                    onClick={handleFinishSession}
                                    className="size-14 rounded-full flex items-center justify-center bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-all border border-green-200 dark:border-green-800 active:scale-95" 
                                    title="Finalizar e Registrar Detalhes"
                                >
                                    <span className="material-symbols-outlined text-2xl">check</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 dark:from-primary/20 dark:to-purple-500/20 rounded-xl p-1 border border-primary/20">
                        <div className="bg-white dark:bg-[#1e1e2d] rounded-lg p-4 flex flex-col sm:flex-row items-center gap-4">
                            <div className="bg-primary/10 p-3 rounded-full shrink-0">
                                <span className="material-symbols-outlined text-primary text-2xl">smart_toy</span>
                            </div>
                            <div className="flex-1 w-full text-center sm:text-left">
                                <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1">Dúvidas no conteúdo?</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-xs">Peça uma explicação rápida ao Tutor IA sem perder o foco.</p>
                            </div>
                            <button 
                                onClick={() => setIsChatOpen(true)}
                                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-sm hover:opacity-90 transition-opacity whitespace-nowrap active:scale-95"
                            >
                                Consultar Tutor IA
                            </button>
                        </div>
                    </div>
                </div>

                {/* FILA DE ESTUDOS DO DIA */}
                <div className="lg:col-span-4 flex flex-col gap-6 h-full">
                    <div className="bg-white dark:bg-[#1e1e2d] rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-5">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold text-slate-900 dark:text-white">Progresso Diário</h3>
                            <span className="text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-1 rounded">
                                {(dailyAvailableTime / 60).toFixed(1)}h Meta
                            </span>
                        </div>
                        <div className="relative pt-1">
                            {/* Barra de progresso fake apenas para ilustrar */}
                            <div className="overflow-hidden h-2 mb-2 text-xs flex rounded bg-primary/10">
                                <div className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary rounded" style={{width: `${Math.round(((currentItemIndex) / todaysQueue.length) * 100)}%`}}></div>
                            </div>
                            <p className="text-xs text-right text-gray-500">{currentItemIndex} de {todaysQueue.length} blocos completados</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-[#1e1e2d] rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col flex-1 min-h-[400px]">
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">queue_music</span>
                                Fila de Hoje
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            <ul className="flex flex-col gap-2">
                                {todaysQueue.map((item, idx) => {
                                    const isActive = idx === currentItemIndex;
                                    const isCompleted = idx < currentItemIndex;
                                    
                                    return (
                                        <li 
                                            key={idx} 
                                            onClick={() => {
                                                setCurrentItemIndex(idx);
                                                setIsPlaying(false);
                                                const dur = (item.durationMinutes || 25) * 60;
                                                setTimeLeft(dur);
                                                setInitialTime(dur);
                                                setElapsedTime(0);
                                            }}
                                            className={`group flex items-start gap-3 p-3 rounded-lg transition-all cursor-pointer border ${
                                                isActive 
                                                    ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20' 
                                                    : isCompleted 
                                                        ? 'bg-gray-50 dark:bg-gray-800/50 border-transparent opacity-60'
                                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-transparent'
                                            }`}
                                        >
                                            <div className="relative flex items-center pt-0.5">
                                                <div className={`size-5 rounded flex items-center justify-center border ${
                                                    isActive 
                                                        ? 'bg-primary border-primary' 
                                                        : isCompleted 
                                                            ? 'bg-green-500 border-green-500' 
                                                            : 'border-slate-300 dark:border-slate-600'
                                                }`}>
                                                    {(isActive || isCompleted) && (
                                                        <span className={`material-symbols-outlined text-xs text-white ${isActive ? 'animate-pulse' : ''}`}>
                                                            {isActive ? 'play_arrow' : 'check'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col w-full">
                                                <div className="flex items-center justify-between w-full mb-1">
                                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-[3px] uppercase tracking-wide text-[10px] ${
                                                        item.subject.priority === 'HIGH' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                                                    }`}>
                                                        {item.subject.priority === 'HIGH' ? 'Alta Prioridade' : 'Normal'}
                                                    </span>
                                                    {isActive && <span className="flex size-1.5 rounded-full bg-primary animate-pulse"></span>}
                                                </div>
                                                <span className={`text-sm font-bold ${isActive ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>
                                                    {item.subject.name}
                                                </span>
                                                <div className="flex items-center justify-between mt-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="material-symbols-outlined text-[14px] text-slate-400">schedule</span>
                                                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                                                            {item.durationMinutes} min
                                                        </span>
                                                    </div>
                                                    {item.topic ? (
                                                        <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[100px]">
                                                            {item.topic.name}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-400 lowercase italic">
                                                            geral
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chat Overlay */}
            <AiTutorChat 
                isOpen={isChatOpen} 
                onClose={() => setIsChatOpen(false)} 
                subject={currentItem.subject.name}
                topic={currentItem.topic?.name || "Geral"}
                apiKey={apiKey}
                model={model}
                onSaveNote={onSaveNote}
            />

            {/* Modal de Relatório da Sessão */}
            {isReportOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-card-dark w-full max-w-md rounded-2xl shadow-2xl border border-border-light dark:border-border-dark flex flex-col transform scale-100 transition-all max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-border-light dark:border-border-dark bg-gray-50/50 dark:bg-gray-900/50 sticky top-0 backdrop-blur z-10">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-green-500">task_alt</span>
                                Registro da Sessão
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Confirme ou ajuste os detalhes antes de salvar.
                            </p>
                        </div>
                        
                        <div className="p-6 flex flex-col gap-6">
                            
                            {/* Modalidade (Somente Leitura para confirmação visual) */}
                             <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <div className="bg-primary/10 text-primary p-2 rounded">
                                    <span className="material-symbols-outlined">{modalities.find(m => m.id === selectedModality)?.icon}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs uppercase text-slate-400 font-bold">Modalidade Realizada</span>
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">{modalities.find(m => m.id === selectedModality)?.label}</span>
                                </div>
                            </div>

                            {/* Seleção do Tópico Estudado (Novo Design) */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[16px]">topic</span>
                                    Tópico Estudado
                                </label>
                                <div className="relative">
                                    <select 
                                        value={sessionTopicId} 
                                        onChange={(e) => setSessionTopicId(e.target.value)}
                                        className="w-full appearance-none pl-4 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 text-sm font-medium transition-all shadow-sm cursor-pointer hover:border-primary/50"
                                    >
                                        <option value="">Geral / Revisão (Sem Tópico Específico)</option>
                                        {currentItem.subject.topics.map(t => (
                                            <option key={t.id} value={t.id}>
                                                {t.name} {t.completed ? '(Concluído)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 flex items-center">
                                        <span className="material-symbols-outlined">expand_more</span>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400 px-1">
                                    Selecione o tópico específico para atualizar seu progresso na disciplina.
                                </p>
                            </div>

                            {/* Duração Manual */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Duração (Minutos)</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        min="1"
                                        value={sessionDuration}
                                        onChange={(e) => setSessionDuration(parseInt(e.target.value) || 0)}
                                        className="w-full pl-10 rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50"
                                    />
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">timer</span>
                                </div>
                            </div>

                            {/* Checkbox de Conclusão */}
                            {sessionTopicId && (
                                <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
                                    <div className="relative flex items-center">
                                        <input 
                                            type="checkbox" 
                                            checked={isTopicFinished}
                                            onChange={(e) => setIsTopicFinished(e.target.checked)}
                                            className="size-5 rounded border-gray-300 text-primary focus:ring-primary/50 cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-900 dark:text-white">Marcar Tópico como Concluído?</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                            {currentItem.subject.topics.find(t => t.id === sessionTopicId)?.name || "Tópico Selecionado"}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Inputs de Questões (Apenas se a modalidade for QUESTÕES ou REVISÃO, ou se o usuário quiser preencher) */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Questões Feitas</label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        value={questionsDone}
                                        onChange={(e) => setQuestionsDone(parseInt(e.target.value) || 0)}
                                        className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Acertos</label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        max={questionsDone}
                                        value={questionsCorrect}
                                        onChange={(e) => setQuestionsCorrect(parseInt(e.target.value) || 0)}
                                        className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500/50"
                                    />
                                </div>
                            </div>
                            
                            {questionsDone > 0 && (
                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Taxa de Acerto</span>
                                    <span className={`text-lg font-black ${
                                        (questionsCorrect/questionsDone) >= 0.8 ? 'text-green-500' : (questionsCorrect/questionsDone) >= 0.6 ? 'text-yellow-500' : 'text-red-500'
                                    }`}>
                                        {Math.round((questionsCorrect / questionsDone) * 100)}%
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-border-light dark:border-border-dark flex justify-end gap-3 bg-gray-50/50 dark:bg-gray-900/50 rounded-b-2xl sticky bottom-0 z-10 backdrop-blur">
                            <button 
                                onClick={() => setIsReportOpen(false)}
                                className="px-4 py-2 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={submitReport}
                                className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-primary hover:bg-blue-600 shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[18px]">save</span>
                                Registrar Detalhes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};