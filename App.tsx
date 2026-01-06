import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { StudyPlayer } from './components/StudyPlayer';
import { SubjectManager } from './components/SubjectManager';
import { Importer } from './components/Importer';
import { DynamicSchedule } from './components/DynamicSchedule';
import { ErrorNotebook } from './components/ErrorNotebook';
import { SimulatedExams } from './components/SimulatedExams';
import { SavedNotes } from './components/SavedNotes'; // Nova Tela
import { ProfileModal } from './components/ProfileModal';
import { BottomNavigation } from './components/BottomNavigation';
import { Screen, UserProfile, Subject, ImporterState, Topic, ErrorLog, StudyLog, StudyPlan, SimulatedExam, SavedNote } from './types';

// Dados iniciais vazios
const INITIAL_SUBJECTS: Subject[] = [];
const DEFAULT_PLAN_ID = 'default-plan';

// Paleta de cores para rotação automática
const AUTO_COLORS = [
    'blue', 'orange', 'green', 'purple', 'red', 'teal', 'pink', 'indigo', 'cyan', 'rose', 'violet', 'emerald', 'amber', 'fuchsia', 'sky', 'lime'
];

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.DASHBOARD);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  // --- DATA MIGRATION & PERSISTENCE LAYER ---
  // A lógica abaixo garante que dados antigos ganhem novos campos automaticamente (ex: cor, planId)

  // 1. Plan Management State (Robust Load)
  const [plans, setPlans] = useState<StudyPlan[]>(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('studyflow_plans');
          if (saved) {
              try {
                  const parsed = JSON.parse(saved);
                  // Migração Defensiva: Garante que todo plano tenha cor e data válida
                  return parsed.map((p: any) => ({
                      id: p.id,
                      name: p.name,
                      description: p.description || '', // Novo campo default
                      color: p.color || 'blue',         // Novo campo default
                      createdAt: p.createdAt ? new Date(p.createdAt) : new Date()
                  }));
              } catch (e) { console.error("Erro ao carregar planos", e); }
          }
      }
      return [{ id: DEFAULT_PLAN_ID, name: 'Plano Principal', color: 'blue', createdAt: new Date() }];
  });

  const [currentPlanId, setCurrentPlanId] = useState<string>(() => {
      if (typeof window !== 'undefined') {
          return localStorage.getItem('studyflow_current_plan') || DEFAULT_PLAN_ID;
      }
      return DEFAULT_PLAN_ID;
  });

  // 2. State for Subjects (Robust Load + Date Revitalization)
  const [subjects, setSubjects] = useState<Subject[]>(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('studyflow_subjects');
          if (saved) {
              try {
                  const parsed = JSON.parse(saved);
                  // Revitalização Profunda
                  const migrated = parsed.map((s: any) => {
                      // Se o dado for muito antigo e não tiver ID de plano, atribui ao default
                      const planId = s.planId || DEFAULT_PLAN_ID;
                      
                      // Revitalização de Logs (Critical Fix for Charts)
                      let logs: StudyLog[] = [];
                      if (s.logs && Array.isArray(s.logs)) {
                          logs = s.logs.map((log: any) => ({
                              ...log,
                              date: new Date(log.date),
                              // Adiciona campos novos se faltarem
                              modality: log.modality || 'PDF' 
                          }));
                      }

                      return {
                          ...s,
                          planId: planId,
                          color: s.color || 'blue', // Default se não existir
                          priority: s.priority || 'MEDIUM',
                          proficiency: s.proficiency || 'INTERMEDIATE',
                          topics: s.topics || [],
                          logs: logs
                      };
                  });
                  return migrated;
              } catch (e) {
                  console.error("Erro ao carregar disciplinas (Corrompido)", e);
                  return INITIAL_SUBJECTS;
              }
          }
      }
      return INITIAL_SUBJECTS;
  });

  // Derived State: Filter subjects by current plan
  const currentPlanSubjects = subjects.filter(s => s.planId === currentPlanId);

  // 3. State for Error Logs
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('studyflow_errors');
          if (saved) {
             try {
                 const parsed = JSON.parse(saved);
                 return parsed.map((log: any) => ({
                     ...log,
                     createdAt: new Date(log.createdAt),
                     // Migração caso adicionemos novos campos ao log de erro
                     reviewCount: log.reviewCount || 0
                 }));
             } catch (e) { console.error("Erro ao carregar erros", e); }
          }
      }
      return [];
  });

  const currentPlanErrorLogs = errorLogs.filter(log => {
      const subject = subjects.find(s => s.id === log.subjectId);
      return subject ? subject.planId === currentPlanId : false;
  });

  // 4. State for Simulated Exams
  const [simulatedExams, setSimulatedExams] = useState<SimulatedExam[]>(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('studyflow_simulated_exams');
          if (saved) {
             try {
                 const parsed = JSON.parse(saved);
                 return parsed.map((exam: any) => ({
                     ...exam,
                     date: new Date(exam.date),
                     planId: exam.planId || 'current' // Retrocompatibilidade
                 }));
             } catch (e) { console.error("Erro ao carregar simulados", e); }
          }
      }
      return [];
  });

  const currentPlanExams = simulatedExams.filter(e => e.planId === currentPlanId || e.planId === 'current');

  // 5. State for Saved Notes
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('studyflow_saved_notes');
          if (saved) {
             try {
                 const parsed = JSON.parse(saved);
                 return parsed.map((note: any) => ({
                     ...note,
                     createdAt: new Date(note.createdAt),
                     tags: note.tags || [] // Default
                 }));
             } catch (e) { console.error("Error loading notes", e); }
          }
      }
      return [];
  });

  // 6. State for Importer Persistence
  const [importerState, setImporterState] = useState<ImporterState>(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('studyflow_importer');
          if (saved) {
              try {
                  const parsed = JSON.parse(saved);
                  return {
                      ...parsed,
                      selectedSubjects: new Set(parsed.selectedSubjects || [])
                  };
              } catch (e) {
                  console.error("Erro ao restaurar estado do importador", e);
              }
          }
      }
      return {
          step: 'UPLOAD',
          fileName: '',
          processingStatus: '',
          progress: 0,
          syllabus: null,
          selectedSubjects: new Set()
      };
  });

  // Persistence Effects (Salvar Automaticamente quando muda)
  useEffect(() => { localStorage.setItem('studyflow_subjects', JSON.stringify(subjects)); }, [subjects]);
  useEffect(() => { localStorage.setItem('studyflow_errors', JSON.stringify(errorLogs)); }, [errorLogs]);
  useEffect(() => { localStorage.setItem('studyflow_plans', JSON.stringify(plans)); }, [plans]);
  useEffect(() => { localStorage.setItem('studyflow_current_plan', currentPlanId); }, [currentPlanId]);
  useEffect(() => { localStorage.setItem('studyflow_simulated_exams', JSON.stringify(simulatedExams)); }, [simulatedExams]);
  useEffect(() => { localStorage.setItem('studyflow_saved_notes', JSON.stringify(savedNotes)); }, [savedNotes]);
  useEffect(() => {
      const stateToSave = { ...importerState, selectedSubjects: Array.from(importerState.selectedSubjects) };
      localStorage.setItem('studyflow_importer', JSON.stringify(stateToSave));
  }, [importerState]);

  // --- Handlers for Plans ---
  const handleAddPlan = (name: string) => {
      const newPlan: StudyPlan = {
          id: `plan-${Date.now()}`,
          name: name,
          color: 'blue',
          createdAt: new Date()
      };
      setPlans(prev => [...prev, newPlan]);
      setCurrentPlanId(newPlan.id);
      setCurrentScreen(Screen.SUBJECTS); // Leva para tela de disciplinas para começar a popular
  };

  const handleUpdatePlan = (updatedPlan: StudyPlan) => {
      setPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
  };

  const handleDeletePlan = (planId: string) => {
      if (plans.length <= 1) {
          alert("Você precisa ter pelo menos um plano de estudos.");
          return;
      }
      if (window.confirm("Tem certeza? Isso apagará todas as disciplinas e histórico deste plano.")) {
          // Remove disciplinas do plano
          setSubjects(prev => prev.filter(s => s.planId !== planId));
          // Remove o plano
          setPlans(prev => prev.filter(p => p.id !== planId));
          // Se apagou o atual, muda para o primeiro disponível
          if (currentPlanId === planId) {
              const nextPlan = plans.find(p => p.id !== planId) || plans[0];
              setCurrentPlanId(nextPlan.id);
          }
      }
  };

  // --- Handlers for Error Notebook ---
  const handleAddErrorLog = (log: ErrorLog) => {
      setErrorLogs(prev => [log, ...prev]);
  };

  const handleDeleteErrorLog = (id: string) => {
      if (window.confirm("Remover este registro do caderno de erros?")) {
          setErrorLogs(prev => prev.filter(e => e.id !== id));
      }
  };

  // --- Handlers for Simulated Exams ---
  const handleAddSimulatedExam = (exam: SimulatedExam) => {
      // Garante que o exame tenha o ID do plano atual
      const examWithPlan = { ...exam, planId: currentPlanId };
      setSimulatedExams(prev => [examWithPlan, ...prev]);
  };

  const handleDeleteSimulatedExam = (id: string) => {
      if (window.confirm("Remover este simulado?")) {
          setSimulatedExams(prev => prev.filter(e => e.id !== id));
      }
  };

  // --- Handlers for Saved Notes ---
  const handleAddSavedNote = (content: string, subjectName: string, topicName: string) => {
      const newNote: SavedNote = {
          id: Date.now().toString(),
          content,
          subjectName,
          topicName,
          createdAt: new Date()
      };
      setSavedNotes(prev => [newNote, ...prev]);
      // Opcional: Mostrar um toast de sucesso
  };

  const handleDeleteSavedNote = (id: string) => {
      if (window.confirm("Remover esta nota salva?")) {
          setSavedNotes(prev => prev.filter(n => n.id !== id));
      }
  };

  // --- Handlers for Subjects (Wrapped to use currentPlanId) ---

  const handleImportSubjects = (newSubjects: Subject[]) => {
      // Injeta o ID do plano atual nas disciplinas importadas
      const subjectsWithPlan = newSubjects.map(s => ({
          ...s,
          planId: currentPlanId
      }));

      console.log("Importando disciplinas para o plano:", currentPlanId, subjectsWithPlan);
      setSubjects(prevSubjects => [...prevSubjects, ...subjectsWithPlan]);
      
      // Limpar estado do importador após sucesso
      const resetImporter: ImporterState = {
          step: 'UPLOAD',
          fileName: '',
          processingStatus: '',
          progress: 0,
          syllabus: null,
          selectedSubjects: new Set()
      };
      setImporterState(resetImporter);
      localStorage.setItem('studyflow_importer', JSON.stringify({ ...resetImporter, selectedSubjects: [] }));

      setCurrentScreen(Screen.SUBJECTS);
  };

  const handleDeleteSubject = (id: string) => {
      if (window.confirm("Tem certeza que deseja remover permanentemente esta disciplina e todos os seus tópicos?")) {
          setSubjects(prev => prev.filter(s => s.id !== id));
      }
  };

  const handleToggleSubjectStatus = (id: string) => {
      setSubjects(prev => prev.map(s => {
          if (s.id === id) return { ...s, active: !s.active };
          return s;
      }));
  };

  const handleAddManualSubject = (name: string) => {
      if (name && name.trim()) {
          // Lógica de Cor Automática: Pega a próxima cor da lista baseado no total de disciplinas
          const nextColor = AUTO_COLORS[subjects.length % AUTO_COLORS.length];

          const newSubject: Subject = {
              id: `manual-${Date.now()}`,
              planId: currentPlanId, // Vínculo Importante
              name: name,
              active: true,
              color: nextColor, // Cor automática
              topics: [],
              priority: 'MEDIUM',
              proficiency: 'INTERMEDIATE',
              logs: []
          };
          setSubjects(prev => [...prev, newSubject]);
      }
  };

  // --- Topic Management Handlers ---

  const handleAddTopic = (subjectId: string, topicName: string) => {
      const newTopic: Topic = {
          id: `topic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: topicName,
          completed: false
      };
      setSubjects(prev => prev.map(s => {
          if (s.id === subjectId) return { ...s, topics: [...s.topics, newTopic] };
          return s;
      }));
  };

  const handleRemoveTopic = (subjectId: string, topicId: string) => {
      setSubjects(prev => prev.map(s => {
          if (s.id === subjectId) return { ...s, topics: s.topics.filter(t => t.id !== topicId) };
          return s;
      }));
  };

  const handleEditTopic = (subjectId: string, topicId: string, newName: string) => {
      setSubjects(prev => prev.map(s => {
          if (s.id !== subjectId) return s;
          return {
              ...s,
              topics: s.topics.map(t => t.id === topicId ? { ...t, name: newName } : t)
          };
      }));
  };

  // Nova função para suportar Drag and Drop (Move de Index A para Index B)
  const handleMoveTopic = (subjectId: string, fromIndex: number, toIndex: number) => {
      setSubjects(prev => prev.map(s => {
          if (s.id !== subjectId) return s;
          const newTopics = [...s.topics];
          const [movedTopic] = newTopics.splice(fromIndex, 1);
          newTopics.splice(toIndex, 0, movedTopic);
          return { ...s, topics: newTopics };
      }));
  };

  const handleUpdateSubject = (updatedSubject: Subject) => {
      setSubjects(prev => prev.map(s => s.id === updatedSubject.id ? updatedSubject : s));
  };

  const handleSessionComplete = (subjectId: string, topicId: string, duration: number, questions: number, correct: number, isFinished: boolean) => {
      setSubjects(prev => prev.map(sub => {
          if (sub.id !== subjectId) return sub;
          const updatedTopics = sub.topics.map(t => {
              if (t.id === topicId && isFinished) return { ...t, completed: true };
              return t;
          });
          const topicName = sub.topics.find(t => t.id === topicId)?.name || 'Tópico Geral';
          const newLog: StudyLog = {
              id: Date.now().toString(),
              date: new Date(),
              topicId,
              topicName,
              durationMinutes: duration,
              questionsCount: questions,
              correctCount: correct
          };
          const currentLogs = sub.logs || [];
          return { ...sub, topics: updatedTopics, logs: [newLog, ...currentLogs] };
      }));
      // Removida a limpeza automática do player state aqui para não perder a fila do dia.
  };

  // User State Management
  const [user, setUser] = useState<UserProfile>(() => {
    if (typeof window !== 'undefined') {
        try {
            const savedUser = localStorage.getItem('studyflow_user');
            if (savedUser) {
                const parsed = JSON.parse(savedUser);
                // Migração de Usuário
                return {
                    ...parsed,
                    openAiApiKey: parsed.openAiApiKey || '',
                    openAiModel: parsed.openAiModel || 'gpt-4o-mini',
                    dailyAvailableTimeMinutes: parsed.dailyAvailableTimeMinutes || 240,
                    githubToken: parsed.githubToken || '',
                    backupGistId: parsed.backupGistId || ''
                };
            }
        } catch (error) {
            console.error("Erro ao carregar usuário do localStorage:", error);
        }
    }
    return {
        name: 'Alex Lima',
        email: 'alex.lima@studyflow.ai',
        avatarUrl: null,
        openAiApiKey: '',
        openAiModel: 'gpt-4o-mini',
        dailyAvailableTimeMinutes: 240,
        githubToken: '',
        backupGistId: ''
    };
  });

  useEffect(() => {
    localStorage.setItem('studyflow_user', JSON.stringify(user));
  }, [user]);

  // Theme State
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem('theme');
        if (stored) return stored;
        return 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Render Logic
  // IMPORTANTE: Passar `currentPlanSubjects` ao invés de `subjects`
  const renderScreen = () => {
    switch (currentScreen) {
      case Screen.DASHBOARD:
        return <Dashboard 
                  onNavigate={setCurrentScreen} 
                  user={user} 
                  subjects={currentPlanSubjects} 
                  errorLogs={currentPlanErrorLogs} // Passando os logs de erro
               />;
      case Screen.STUDY_PLAYER:
        return (
          <StudyPlayer 
            apiKey={user.openAiApiKey} 
            model={user.openAiModel} 
            subjects={currentPlanSubjects} 
            dailyAvailableTime={user.dailyAvailableTimeMinutes || 240}
            onSessionComplete={handleSessionComplete}
            onNavigate={setCurrentScreen}
            onSaveNote={handleAddSavedNote} // Passando a função de salvar
          />
        );
      case Screen.SUBJECTS:
        return (
            <SubjectManager 
                subjects={currentPlanSubjects} 
                onDeleteSubject={handleDeleteSubject}
                onAddSubject={handleAddManualSubject}
                onToggleStatus={handleToggleSubjectStatus}
                onAddTopic={handleAddTopic}
                onRemoveTopic={handleRemoveTopic}
                onMoveTopic={handleMoveTopic} 
                onUpdateSubject={handleUpdateSubject} 
                onEditTopic={handleEditTopic} // Adicionado: Passando a função de edição
                apiKey={user.openAiApiKey}
                model={user.openAiModel}
            />
        );
      case Screen.IMPORTER:
        return (
            <Importer 
                apiKey={user.openAiApiKey} 
                model={user.openAiModel} 
                onImport={handleImportSubjects}
                state={importerState}
                setState={setImporterState}
            />
        );
      case Screen.DYNAMIC_SCHEDULE:
        return (
            <DynamicSchedule 
                subjects={currentPlanSubjects} 
                onUpdateSubject={handleUpdateSubject} 
                user={user}
                onUpdateUser={setUser}
                errorLogs={currentPlanErrorLogs} // ADICIONADO: Logs de erro para algoritmo SRS
            />
        );
      case Screen.ERROR_NOTEBOOK:
        return (
            <ErrorNotebook 
                subjects={currentPlanSubjects}
                logs={currentPlanErrorLogs}
                onAddLog={handleAddErrorLog}
                onDeleteLog={handleDeleteErrorLog}
            />
        );
      case Screen.SIMULATED_EXAMS:
        return (
            <SimulatedExams 
                exams={currentPlanExams}
                onAddExam={handleAddSimulatedExam}
                onDeleteExam={handleDeleteSimulatedExam}
            />
        );
      case Screen.SAVED_NOTES:
        return (
            <SavedNotes 
                notes={savedNotes}
                onDeleteNote={handleDeleteSavedNote}
            />
        );
      default:
        return <Dashboard onNavigate={setCurrentScreen} user={user} subjects={currentPlanSubjects} errorLogs={currentPlanErrorLogs} />;
    }
  };

  const getInitials = (fullName: string) => {
    const names = fullName.split(' ');
    if (names.length >= 2) return `${names[0][0]}${names[1][0]}`.toUpperCase();
    return fullName.slice(0, 2).toUpperCase();
  };

  const activePlanColor = plans.find(p => p.id === currentPlanId)?.color || 'blue';

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark">
      <Sidebar 
        currentScreen={currentScreen} 
        onNavigate={setCurrentScreen} 
        user={user} 
        plans={plans}
        currentPlanId={currentPlanId}
        onSwitchPlan={setCurrentPlanId}
        onAddPlan={handleAddPlan}
        onDeletePlan={handleDeletePlan}
        onUpdateUser={setUser}
        onUpdatePlan={handleUpdatePlan} // Nova Prop
        onOpenProfile={() => setIsProfileOpen(true)} // Nova Prop para abrir o modal via Sidebar
      />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden relative transition-colors duration-200">
        <header className="h-16 flex items-center justify-between px-6 border-b border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark flex-shrink-0 transition-colors duration-200 z-20">
            <div className="flex items-center gap-4">
                 <div className="flex md:hidden items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg">
                         <span className="material-symbols-outlined text-primary">school</span>
                    </div>
                    <h1 className="font-bold text-lg text-text-primary-light dark:text-text-primary-dark">StudyFlow AI</h1>
                 </div>
                 {/* Exibir nome do plano atual no header também para contexto mobile/desktop */}
                 <div className={`hidden md:flex items-center gap-2 px-3 py-1 bg-${activePlanColor}-50 dark:bg-${activePlanColor}-900/10 rounded-full border border-${activePlanColor}-100 dark:border-${activePlanColor}-900/30`}>
                     <span className={`material-symbols-outlined text-sm text-${activePlanColor}-500`}>folder_open</span>
                     <span className={`text-xs font-bold text-${activePlanColor}-700 dark:text-${activePlanColor}-300`}>
                         {plans.find(p => p.id === currentPlanId)?.name || 'Plano'}
                     </span>
                 </div>
            </div>

            <div className="flex items-center gap-3">
                <button 
                    onClick={toggleTheme}
                    className="flex items-center justify-center p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 text-text-secondary-light dark:text-text-secondary-dark transition-all focus:outline-none focus:ring-2 focus:ring-primary/50"
                    title={theme === 'dark' ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
                >
                    <span className="material-symbols-outlined fill">
                        {theme === 'dark' ? 'light_mode' : 'dark_mode'}
                    </span>
                </button>
                {/* Botão de Perfil Removido daqui conforme solicitado - agora acessível apenas pela Sidebar */}
            </div>
        </header>

        <div className="flex-1 overflow-hidden relative flex flex-col pb-16 md:pb-0">
             {renderScreen()}
        </div>

        <BottomNavigation currentScreen={currentScreen} onNavigate={setCurrentScreen} />

        <ProfileModal 
            isOpen={isProfileOpen} 
            onClose={() => setIsProfileOpen(false)} 
            user={user}
            onSave={setUser}
        />
      </main>
    </div>
  );
}

export default App;