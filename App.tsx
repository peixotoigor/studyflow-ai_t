import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { StudyPlayer } from './components/StudyPlayer';
import { SubjectManager } from './components/SubjectManager';
import { Importer } from './components/Importer';
import { DynamicSchedule } from './components/DynamicSchedule';
import { ErrorNotebook } from './components/ErrorNotebook';
import { SimulatedExams } from './components/SimulatedExams';
import { SavedNotes } from './components/SavedNotes'; 
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

// --- SECURITY UTILS ---
const encrypt = (text?: string) => {
    if (!text) return '';
    try { return 'enc_' + btoa(text); } catch (e) { return text; }
};

const decrypt = (text?: string) => {
    if (!text) return '';
    if (text.startsWith('enc_')) {
        try { return atob(text.slice(4)); } catch (e) { return ''; }
    }
    return text; 
};

const fromBase64 = (str: string) => {
    try { return decodeURIComponent(escape(atob(str))); } catch(e) { return atob(str); }
};

// Função de Descriptografia AES-GCM (Nativa)
const decryptVault = async (encryptedBase64: string, password: string) => {
    try {
        const encryptedBytes = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
        const salt = encryptedBytes.slice(0, 16);
        const iv = encryptedBytes.slice(16, 28);
        const data = encryptedBytes.slice(28);

        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
        const key = await crypto.subtle.deriveKey(
            { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
            keyMaterial, { name: "AES-GCM", length: 256 }, false, ["decrypt"]
        );

        const decryptedBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
        const dec = new TextDecoder();
        return JSON.parse(dec.decode(decryptedBuffer));
    } catch (e) {
        throw new Error("Senha incorreta ou dados corrompidos.");
    }
};

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.DASHBOARD);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  // Vault States
  const [isVaultLocked, setIsVaultLocked] = useState(false);
  const [vaultEncryptedData, setVaultEncryptedData] = useState<string | null>(null);
  const [vaultPasswordInput, setVaultPasswordInput] = useState('');
  const [vaultError, setVaultError] = useState('');
  const [checkingVault, setCheckingVault] = useState(true);
  
  // Auto-Save State (SYNCING = Baixando, SAVING = Subindo)
  const [syncState, setSyncState] = useState<'IDLE' | 'SAVING' | 'SAVED' | 'ERROR' | 'SYNCING'>('IDLE');
  
  // Flag para evitar loop de save ao restaurar
  const isRestoring = useRef(false);

  // --- User State Management ---
  const [user, setUser] = useState<UserProfile>(() => {
    if (typeof window !== 'undefined') {
        try {
            const savedUser = localStorage.getItem('studyflow_user');
            if (savedUser) {
                const parsed = JSON.parse(savedUser);
                return {
                    ...parsed,
                    openAiApiKey: decrypt(parsed.openAiApiKey) || '',
                    openAiModel: parsed.openAiModel || 'gpt-4o-mini',
                    dailyAvailableTimeMinutes: parsed.dailyAvailableTimeMinutes || 240,
                    githubToken: decrypt(parsed.githubToken) || '',
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

  // --- DATA STATES ---
  const [plans, setPlans] = useState<StudyPlan[]>(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('studyflow_plans');
          if (saved) return JSON.parse(saved).map((p: any) => ({ ...p, createdAt: new Date(p.createdAt) }));
      }
      return [{ id: DEFAULT_PLAN_ID, name: 'Plano Principal', color: 'blue', createdAt: new Date() }];
  });

  const [currentPlanId, setCurrentPlanId] = useState<string>(() => {
      if (typeof window !== 'undefined') return localStorage.getItem('studyflow_current_plan') || DEFAULT_PLAN_ID;
      return DEFAULT_PLAN_ID;
  });

  const [subjects, setSubjects] = useState<Subject[]>(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('studyflow_subjects');
          if (saved) {
              const parsed = JSON.parse(saved);
              return parsed.map((s: any) => ({
                  ...s,
                  planId: s.planId || DEFAULT_PLAN_ID,
                  logs: s.logs ? s.logs.map((l: any) => ({ ...l, date: new Date(l.date) })) : []
              }));
          }
      }
      return INITIAL_SUBJECTS;
  });

  const currentPlanSubjects = subjects.filter(s => s.planId === currentPlanId);

  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('studyflow_errors');
          if (saved) return JSON.parse(saved).map((l: any) => ({ ...l, createdAt: new Date(l.createdAt) }));
      }
      return [];
  });

  const currentPlanErrorLogs = errorLogs.filter(log => {
      const subject = subjects.find(s => s.id === log.subjectId);
      return subject ? subject.planId === currentPlanId : false;
  });

  const [simulatedExams, setSimulatedExams] = useState<SimulatedExam[]>(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('studyflow_simulated_exams');
          if (saved) return JSON.parse(saved).map((e: any) => ({ ...e, date: new Date(e.date) }));
      }
      return [];
  });

  const currentPlanExams = simulatedExams.filter(e => e.planId === currentPlanId || e.planId === 'current');

  const [savedNotes, setSavedNotes] = useState<SavedNote[]>(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('studyflow_saved_notes');
          if (saved) return JSON.parse(saved).map((n: any) => ({ ...n, createdAt: new Date(n.createdAt) }));
      }
      return [];
  });

  const [importerState, setImporterState] = useState<ImporterState>(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('studyflow_importer');
          if (saved) {
              const parsed = JSON.parse(saved);
              return { ...parsed, selectedSubjects: new Set(parsed.selectedSubjects || []) };
          }
      }
      return { step: 'UPLOAD', fileName: '', processingStatus: '', progress: 0, syllabus: null, selectedSubjects: new Set() };
  });

  // --- VAULT DETECTION LOGIC ---
  useEffect(() => {
      const checkVault = async () => {
          try {
              let encryptedData: string | null = localStorage.getItem('studyflow_secure_vault');

              // Se não achou local, tenta remoto
              if (!encryptedData) {
                  try {
                      const response = await fetch(`./vault.json?t=${Date.now()}`);
                      if (response.ok) {
                          const json = await response.json();
                          if (json.data) {
                              encryptedData = json.data;
                              localStorage.setItem('studyflow_secure_vault', json.data);
                          }
                      }
                  } catch (e) { console.log("Sem cofre remoto."); }
              }

              // Se achou dados criptografados
              if (encryptedData) {
                  setVaultEncryptedData(encryptedData);
                  
                  // TENTA AUTO-UNLOCK VIA SESSION STORAGE
                  const sessionPass = sessionStorage.getItem('studyflow_session_pass');
                  if (sessionPass) {
                      try {
                          const decryptedData = await decryptVault(encryptedData, sessionPass);
                          setUser(prev => ({
                              ...prev,
                              openAiApiKey: decryptedData.openAiApiKey || prev.openAiApiKey,
                              githubToken: decryptedData.githubToken || prev.githubToken,
                              backupGistId: decryptedData.backupGistId || prev.backupGistId
                          }));
                          setIsVaultLocked(false);
                          setCheckingVault(false);
                          return;
                      } catch (e) {
                          // Se falhar (ex: senha mudou), limpa sessão e bloqueia
                          sessionStorage.removeItem('studyflow_session_pass');
                      }
                  }
                  
                  setIsVaultLocked(true); 
              } else {
                  setIsVaultLocked(false);
              }
          } catch (e) {
              console.log("Erro ao verificar cofre.");
          } finally {
              setCheckingVault(false);
          }
      };
      
      checkVault();
  }, []);

  // --- AUTO SAVE LOGIC ---
  // Debounce ref
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Efeito que monitora mudanças e dispara o save
  useEffect(() => {
      // Só salva se tiver token e ID
      if (!user.githubToken || !user.backupGistId || isVaultLocked) return;
      if (isRestoring.current) return; // Evita salvar se estiver restaurando (loop prevention)

      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);

      // Não mostra "Salvando" se estiver "Baixando" (Syncing)
      if (syncState !== 'SYNCING') setSyncState('SAVING'); 

      autoSaveTimeoutRef.current = setTimeout(async () => {
          await performAutoSave();
      }, 5000); // 5 segundos de espera após a última alteração

      return () => {
          if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
      };
  }, [subjects, plans, errorLogs, simulatedExams, savedNotes, currentPlanId, user]); // User adicionado às dependências

  const performAutoSave = async () => {
      try {
          if (syncState === 'SYNCING') return; // Evita salvar enquanto baixa
          setSyncState('SAVING');
          
          const backupData = {
              version: 2,
              timestamp: new Date().toISOString(),
              subjects,
              plans,
              currentPlanId,
              errors: errorLogs,
              // Enviamos o User completo, exceto as chaves, para garantir que Nome/Avatar sejam salvos
              user: { 
                  name: user.name,
                  email: user.email,
                  avatarUrl: user.avatarUrl,
                  openAiModel: user.openAiModel,
                  dailyAvailableTimeMinutes: user.dailyAvailableTimeMinutes,
                  // Chaves NÃO vão para o backup
                  githubToken: undefined, 
                  openAiApiKey: undefined 
              }, 
              simulatedExams,
              savedNotes,
              scheduleSettings: JSON.parse(localStorage.getItem('studyflow_schedule_settings') || '{}'),
              scheduleSelection: JSON.parse(localStorage.getItem('studyflow_schedule_selection') || '[]'),
              importerState: JSON.parse(localStorage.getItem('studyflow_importer') || 'null'),
              playerState: JSON.parse(localStorage.getItem('studyflow_player_state') || 'null'),
              expandedSubjectId: localStorage.getItem('studyflow_expanded_subject_id') || null
          };

          const fileName = "studyflow_backup.json";
          const content = JSON.stringify(backupData, null, 2);
          
          await fetch(`https://api.github.com/gists/${user.backupGistId}`, {
              method: 'PATCH',
              headers: { 
                  'Authorization': `token ${user.githubToken}`, 
                  'Content-Type': 'application/json' 
              },
              body: JSON.stringify({ 
                  description: `StudyFlow AI Auto-Backup (${new Date().toLocaleString()})`, 
                  files: { [fileName]: { content: content } } 
              })
          });

          setSyncState('SAVED');
          setTimeout(() => setSyncState('IDLE'), 3000); // Limpa status após 3s
          
      } catch (e) {
          console.error("Auto-save falhou", e);
          setSyncState('ERROR');
      }
  };

  const handleRestoreData = async (gistId: string, token: string, silent = false) => {
        try {
            isRestoring.current = true; // Seta flag para bloquear auto-save
            if (silent) setSyncState('SYNCING');

            const response = await fetch(`https://api.github.com/gists/${gistId}`, {
                headers: { 'Authorization': `token ${token}` }
            });
            
            if (!response.ok) throw new Error("Falha ao buscar backup.");
            
            const data = await response.json();
            const fileKey = Object.keys(data.files).find(key => key.includes('studyflow'));
            if (!fileKey) throw new Error("Arquivo de backup inválido.");
            
            const content = JSON.parse(data.files[fileKey].content);
            
            // Restauração de Estado
            if (content.subjects) {
                const hydratedSubjects = content.subjects.map((s: any) => ({
                    ...s,
                    logs: s.logs ? s.logs.map((l: any) => ({ ...l, date: new Date(l.date) })) : []
                }));
                setSubjects(hydratedSubjects);
            }
            if (content.plans) setPlans(content.plans.map((p: any) => ({ ...p, createdAt: new Date(p.createdAt) })));
            if (content.errors) setErrorLogs(content.errors.map((e: any) => ({ ...e, createdAt: new Date(e.createdAt) })));
            if (content.simulatedExams) setSimulatedExams(content.simulatedExams.map((e: any) => ({ ...e, date: new Date(e.date) })));
            if (content.savedNotes) setSavedNotes(content.savedNotes.map((n: any) => ({ ...n, createdAt: new Date(n.createdAt) })));
            if (content.currentPlanId) setCurrentPlanId(content.currentPlanId);
            
            // Lógica de Restauração do Usuário Reforçada
            if (content.user) {
                console.log("Restaurando perfil do usuário:", content.user.name);
                setUser(prev => ({
                    ...prev,
                    // Prioriza dados da nuvem, usa fallback local se vazio
                    name: content.user.name || prev.name,
                    email: content.user.email || prev.email,
                    avatarUrl: content.user.avatarUrl || prev.avatarUrl,
                    openAiModel: content.user.openAiModel || prev.openAiModel,
                    dailyAvailableTimeMinutes: content.user.dailyAvailableTimeMinutes || prev.dailyAvailableTimeMinutes,
                    
                    // SEGURANÇA: Mantém chaves locais (vindas do cofre), ignorando o que vem da nuvem (que deve ser undefined)
                    // Importante: As chaves locais já foram setadas pelo handleUnlockVault no 'prev'
                    openAiApiKey: prev.openAiApiKey, 
                    githubToken: prev.githubToken,
                    backupGistId: prev.backupGistId
                }));
            }
            
            if (!silent) alert("Dados e perfil restaurados com sucesso!");
            setSyncState('SAVED');
            setTimeout(() => setSyncState('IDLE'), 3000);

        } catch (e: any) {
            console.error("Restore error:", e);
            if (!silent) alert("Erro ao restaurar dados: " + e.message);
            setSyncState('ERROR');
        } finally {
            // Libera o auto-save após um breve período
            setTimeout(() => { isRestoring.current = false; }, 2000);
        }
  };

  const handleUnlockVault = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!vaultEncryptedData) return;
      
      setVaultError('');
      setCheckingVault(true); 
      
      try {
          const decryptedData = await decryptVault(vaultEncryptedData, vaultPasswordInput);
          
          // SALVA NA SESSÃO PARA REFRESH AUTOMÁTICO
          sessionStorage.setItem('studyflow_session_pass', vaultPasswordInput);

          setUser(prev => ({
              ...prev,
              openAiApiKey: decryptedData.openAiApiKey || prev.openAiApiKey,
              githubToken: decryptedData.githubToken || prev.githubToken,
              backupGistId: decryptedData.backupGistId || prev.backupGistId
          }));
          
          setIsVaultLocked(false);

          // LÓGICA DE SYNC AUTOMÁTICO:
          // Se tiver backup configurado E for uma sessão "nova" (sem dados locais), puxa da nuvem automaticamente.
          const hasBackupCreds = decryptedData.backupGistId && decryptedData.githubToken;
          const isFreshSession = subjects.length === 0;

          if (hasBackupCreds && isFreshSession) {
              console.log("Sessão nova detectada. Iniciando download automático...");
              // Chama o restore em modo silencioso
              handleRestoreData(decryptedData.backupGistId, decryptedData.githubToken, true);
          }
          
          setVaultPasswordInput('');
          
      } catch (err) {
          console.error(err);
          setVaultError("Senha incorreta ou cofre corrompido.");
      } finally {
          setCheckingVault(false);
      }
  };

  // Persistence Effects (LocalStorage)
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

  useEffect(() => {
    const isVaultActive = !!localStorage.getItem('studyflow_secure_vault');
    const secureUser = {
        ...user,
        openAiApiKey: isVaultActive ? '' : encrypt(user.openAiApiKey),
        githubToken: isVaultActive ? '' : encrypt(user.githubToken)
    };
    localStorage.setItem('studyflow_user', JSON.stringify(secureUser));
  }, [user]);

  // Handlers (Simplified)
  const handleAddPlan = (name: string) => {
      const newPlan: StudyPlan = { id: `plan-${Date.now()}`, name, color: 'blue', createdAt: new Date() };
      setPlans(prev => [...prev, newPlan]);
      setCurrentPlanId(newPlan.id);
      setCurrentScreen(Screen.SUBJECTS); 
  };
  const handleUpdatePlan = (updatedPlan: StudyPlan) => setPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
  const handleDeletePlan = (planId: string) => {
      if (plans.length <= 1) return alert("Mantenha pelo menos um plano.");
      if (window.confirm("Apagar plano e dados associados?")) {
          setSubjects(prev => prev.filter(s => s.planId !== planId));
          setPlans(prev => prev.filter(p => p.id !== planId));
          if (currentPlanId === planId) setCurrentPlanId(plans.find(p => p.id !== planId)?.id || plans[0].id);
      }
  };
  const handleAddErrorLog = (log: ErrorLog) => setErrorLogs(prev => [log, ...prev]);
  const handleDeleteErrorLog = (id: string) => { if(window.confirm("Apagar?")) setErrorLogs(prev => prev.filter(e => e.id !== id)); };
  const handleAddSimulatedExam = (exam: SimulatedExam) => setSimulatedExams(prev => [{ ...exam, planId: currentPlanId }, ...prev]);
  const handleDeleteSimulatedExam = (id: string) => { if(window.confirm("Apagar?")) setSimulatedExams(prev => prev.filter(e => e.id !== id)); };
  const handleAddSavedNote = (content: string, sName: string, tName: string) => setSavedNotes(prev => [{ id: Date.now().toString(), content, subjectName: sName, topicName: tName, createdAt: new Date() }, ...prev]);
  const handleDeleteSavedNote = (id: string) => { if(window.confirm("Apagar?")) setSavedNotes(prev => prev.filter(n => n.id !== id)); };
  
  const handleImportSubjects = (newSubjects: Subject[]) => {
      setSubjects(prev => [...prev, ...newSubjects.map(s => ({ ...s, planId: currentPlanId }))]);
      const reset = { step: 'UPLOAD', fileName: '', processingStatus: '', progress: 0, syllabus: null, selectedSubjects: new Set() };
      setImporterState(reset as ImporterState);
      localStorage.setItem('studyflow_importer', JSON.stringify({ ...reset, selectedSubjects: [] }));
      setCurrentScreen(Screen.SUBJECTS);
  };
  
  const handleDeleteSubject = (id: string) => { if(window.confirm("Apagar disciplina?")) setSubjects(prev => prev.filter(s => s.id !== id)); };
  const handleToggleSubjectStatus = (id: string) => setSubjects(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));
  const handleAddManualSubject = (name: string) => {
      if (name?.trim()) setSubjects(prev => [...prev, { id: `manual-${Date.now()}`, planId: currentPlanId, name, active: true, color: AUTO_COLORS[subjects.length % AUTO_COLORS.length], topics: [], priority: 'MEDIUM', proficiency: 'INTERMEDIATE', logs: [] }]);
  };
  const handleAddTopic = (sId: string, name: string) => setSubjects(prev => prev.map(s => s.id === sId ? { ...s, topics: [...s.topics, { id: `topic-${Date.now()}-${Math.random()}`, name, completed: false }] } : s));
  const handleRemoveTopic = (sId: string, tId: string) => setSubjects(prev => prev.map(s => s.id === sId ? { ...s, topics: s.topics.filter(t => t.id !== tId) } : s));
  const handleEditTopic = (sId: string, tId: string, name: string) => setSubjects(prev => prev.map(s => s.id === sId ? { ...s, topics: s.topics.map(t => t.id === tId ? { ...t, name } : t) } : s));
  const handleMoveTopic = (sId: string, from: number, to: number) => {
      setSubjects(prev => prev.map(s => {
          if (s.id !== sId) return s;
          const nt = [...s.topics]; const [m] = nt.splice(from, 1); nt.splice(to, 0, m);
          return { ...s, topics: nt };
      }));
  };
  const handleUpdateSubject = (us: Subject) => setSubjects(prev => prev.map(s => s.id === us.id ? us : s));
  const handleSessionComplete = (sId: string, tId: string, d: number, q: number, c: number, finished: boolean) => {
      setSubjects(prev => prev.map(s => {
          if (s.id !== sId) return s;
          const log: StudyLog = { id: Date.now().toString(), date: new Date(), topicId: tId, topicName: s.topics.find(t => t.id === tId)?.name || 'Geral', durationMinutes: d, questionsCount: q, correctCount: c };
          return { ...s, topics: s.topics.map(t => t.id === tId && finished ? { ...t, completed: true } : t), logs: [log, ...(s.logs || [])] };
      }));
  };

  const [theme, setTheme] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('theme') || 'light' : 'light'));
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); localStorage.setItem('theme', theme); }, [theme]);
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  // --- RENDER ---
  const renderScreen = () => {
    if (isVaultLocked) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 animate-in fade-in">
                <div className="bg-white dark:bg-card-dark p-8 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-md text-center">
                    <div className="size-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="material-symbols-outlined text-3xl text-amber-600 dark:text-amber-400">lock</span>
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Chaves Bloqueadas</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                        Detectamos um cofre digital. Digite sua senha para liberar o uso das APIs.
                    </p>
                    <form onSubmit={handleUnlockVault} className="flex flex-col gap-4">
                        <input 
                            autoFocus
                            type="password" 
                            placeholder="Senha do Cofre"
                            value={vaultPasswordInput}
                            onChange={(e) => setVaultPasswordInput(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-black/20 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500/50 outline-none transition-all"
                        />
                        {vaultError && <p className="text-red-500 text-xs font-bold">{vaultError}</p>}
                        <button 
                            type="submit"
                            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold shadow-lg shadow-amber-500/20 transition-all active:scale-95"
                        >
                            {checkingVault ? 'Verificando...' : 'Desbloquear Acesso'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    switch (currentScreen) {
      case Screen.DASHBOARD: return <Dashboard onNavigate={setCurrentScreen} user={user} subjects={currentPlanSubjects} errorLogs={currentPlanErrorLogs} />;
      case Screen.STUDY_PLAYER: return <StudyPlayer apiKey={user.openAiApiKey} model={user.openAiModel} subjects={currentPlanSubjects} dailyAvailableTime={user.dailyAvailableTimeMinutes || 240} onSessionComplete={handleSessionComplete} onNavigate={setCurrentScreen} onSaveNote={handleAddSavedNote} />;
      case Screen.SUBJECTS: return <SubjectManager subjects={currentPlanSubjects} onDeleteSubject={handleDeleteSubject} onAddSubject={handleAddManualSubject} onToggleStatus={handleToggleSubjectStatus} onAddTopic={handleAddTopic} onRemoveTopic={handleRemoveTopic} onMoveTopic={handleMoveTopic} onUpdateSubject={handleUpdateSubject} onEditTopic={handleEditTopic} apiKey={user.openAiApiKey} model={user.openAiModel} />;
      case Screen.IMPORTER: return <Importer apiKey={user.openAiApiKey} model={user.openAiModel} onImport={handleImportSubjects} state={importerState} setState={setImporterState} />;
      case Screen.DYNAMIC_SCHEDULE: return <DynamicSchedule subjects={currentPlanSubjects} onUpdateSubject={handleUpdateSubject} user={user} onUpdateUser={setUser} errorLogs={currentPlanErrorLogs} />;
      case Screen.ERROR_NOTEBOOK: return <ErrorNotebook subjects={currentPlanSubjects} logs={currentPlanErrorLogs} onAddLog={handleAddErrorLog} onDeleteLog={handleDeleteErrorLog} />;
      case Screen.SIMULATED_EXAMS: return <SimulatedExams exams={currentPlanExams} onAddExam={handleAddSimulatedExam} onDeleteExam={handleDeleteSimulatedExam} />;
      case Screen.SAVED_NOTES: return <SavedNotes notes={savedNotes} onDeleteNote={handleDeleteSavedNote} />;
      default: return <Dashboard onNavigate={setCurrentScreen} user={user} subjects={currentPlanSubjects} errorLogs={currentPlanErrorLogs} />;
    }
  };

  const activePlanColor = plans.find(p => p.id === currentPlanId)?.color || 'blue';

  if (checkingVault) return <div className="h-screen w-full flex items-center justify-center bg-background-light dark:bg-background-dark"><span className="material-symbols-outlined text-4xl text-primary animate-spin">sync</span></div>;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark">
      <Sidebar currentScreen={currentScreen} onNavigate={setCurrentScreen} user={user} plans={plans} currentPlanId={currentPlanId} onSwitchPlan={setCurrentPlanId} onAddPlan={handleAddPlan} onDeletePlan={handleDeletePlan} onUpdateUser={setUser} onUpdatePlan={handleUpdatePlan} onOpenProfile={() => setIsProfileOpen(true)} />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden relative transition-colors duration-200">
        <header className="h-16 flex items-center justify-between px-6 border-b border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark flex-shrink-0 transition-colors duration-200 z-20">
            <div className="flex items-center gap-4">
                 <div className="flex md:hidden items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg">
                         <span className="material-symbols-outlined text-primary">school</span>
                    </div>
                    <h1 className="font-bold text-lg text-text-primary-light dark:text-text-primary-dark">StudyFlow AI</h1>
                 </div>
                 <div className={`hidden md:flex items-center gap-2 px-3 py-1 bg-${activePlanColor}-50 dark:bg-${activePlanColor}-900/10 rounded-full border border-${activePlanColor}-100 dark:border-${activePlanColor}-900/30`}>
                     <span className={`material-symbols-outlined text-sm text-${activePlanColor}-500`}>folder_open</span>
                     <span className={`text-xs font-bold text-${activePlanColor}-700 dark:text-${activePlanColor}-300`}>
                         {plans.find(p => p.id === currentPlanId)?.name || 'Plano'}
                     </span>
                 </div>
                 {/* Auto-Save Indicator */}
                 {user.backupGistId && (
                     <div className={`hidden md:flex items-center gap-2 text-[10px] font-bold px-2 py-1 rounded transition-all ${syncState === 'SAVING' ? 'bg-yellow-50 text-yellow-600' : syncState === 'SAVED' ? 'bg-green-50 text-green-600' : syncState === 'ERROR' ? 'bg-red-50 text-red-600' : syncState === 'SYNCING' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 opacity-50'}`}>
                         {syncState === 'SAVING' && <span className="material-symbols-outlined text-[12px] animate-spin">sync</span>}
                         {syncState === 'SYNCING' && <span className="material-symbols-outlined text-[12px] animate-spin">cloud_download</span>}
                         {syncState === 'SAVED' && <span className="material-symbols-outlined text-[12px]">cloud_done</span>}
                         {syncState === 'ERROR' && <span className="material-symbols-outlined text-[12px]">cloud_off</span>}
                         {syncState === 'IDLE' && <span className="material-symbols-outlined text-[12px]">cloud_queue</span>}
                         <span className="uppercase">
                             {syncState === 'SAVING' ? 'Salvando...' : 
                              syncState === 'SYNCING' ? 'Baixando...' : 
                              syncState === 'SAVED' ? 'Sincronizado' : 
                              syncState === 'ERROR' ? 'Erro Sync' : 'Nuvem Ativa'}
                         </span>
                     </div>
                 )}
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