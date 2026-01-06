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

// --- SECURITY UTILS ---
// Ofuscação simples para evitar texto plano no LocalStorage (Legado)
const encrypt = (text?: string) => {
    if (!text) return '';
    try {
        return 'enc_' + btoa(text);
    } catch (e) {
        return text; // Fallback se falhar
    }
};

const decrypt = (text?: string) => {
    if (!text) return '';
    if (text.startsWith('enc_')) {
        try {
            return atob(text.slice(4));
        } catch (e) {
            return '';
        }
    }
    return text; // Suporte legado para chaves não encriptadas
};

// Base64 decode com suporte a UTF-8 para Magic Link
const fromBase64 = (str: string) => {
    try {
        return decodeURIComponent(escape(atob(str)));
    } catch(e) {
        return atob(str);
    }
};

// Função de Descriptografia AES-GCM (Nativa)
const decryptVault = async (encryptedBase64: string, password: string) => {
    try {
        const encryptedBytes = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
        
        // Extrair partes (Salt: 16 bytes, IV: 12 bytes, Data: Resto)
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

  // --- DATA MIGRATION & PERSISTENCE LAYER ---
  // 1. Plan Management State (Robust Load)
  const [plans, setPlans] = useState<StudyPlan[]>(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('studyflow_plans');
          if (saved) {
              try {
                  const parsed = JSON.parse(saved);
                  return parsed.map((p: any) => ({
                      id: p.id,
                      name: p.name,
                      description: p.description || '', 
                      color: p.color || 'blue',         
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
                  const migrated = parsed.map((s: any) => {
                      const planId = s.planId || DEFAULT_PLAN_ID;
                      let logs: StudyLog[] = [];
                      if (s.logs && Array.isArray(s.logs)) {
                          logs = s.logs.map((log: any) => ({
                              ...log,
                              date: new Date(log.date),
                              modality: log.modality || 'PDF' 
                          }));
                      }

                      return {
                          ...s,
                          planId: planId,
                          color: s.color || 'blue',
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
                     planId: exam.planId || 'current' 
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
                     tags: note.tags || []
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

  // --- VAULT DETECTION LOGIC (HYBRID: LOCAL + REMOTE + RAW FALLBACK) ---
  useEffect(() => {
      const checkVault = async () => {
          try {
              // 1. Tenta LocalStorage (Mais rápido)
              const localVault = localStorage.getItem('studyflow_secure_vault');
              if (localVault) {
                  console.log("Cofre encontrado no LocalStorage.");
                  setVaultEncryptedData(localVault);
                  setIsVaultLocked(true); 
                  setCheckingVault(false);
                  return;
              }

              // 2. Tenta buscar vault.json relativo (Deploy padrão)
              // Adiciona timestamp para evitar cache do browser
              try {
                  const response = await fetch(`./vault.json?t=${Date.now()}`);
                  if (response.ok) {
                      const json = await response.json();
                      if (json.data) {
                          console.log("Cofre remoto (vault.json) detectado via fetch relativo.");
                          setVaultEncryptedData(json.data);
                          localStorage.setItem('studyflow_secure_vault', json.data);
                          setIsVaultLocked(true);
                          setCheckingVault(false);
                          return;
                      }
                  }
              } catch (e) {
                  console.log("Fetch relativo falhou ou arquivo não encontrado, tentando fallback Raw...");
              }

              // 3. Fallback: Busca via Raw GitHub (para contornar cache ou 404 do Pages)
              // Detecta usuário e repo da URL: https://user.github.io/repo/
              const hostname = window.location.hostname;
              if (hostname.includes('github.io')) {
                  const user = hostname.split('.')[0];
                  // O pathname começa com /, então split dá ['', 'repo', '...']
                  const parts = window.location.pathname.split('/').filter(p => p); 
                  const repo = parts[0]; 

                  if (user && repo) {
                      // Tenta main e master pois o nome da branch padrão varia
                      const branches = ['main', 'master'];
                      for (const branch of branches) {
                          try {
                              const rawUrl = `https://raw.githubusercontent.com/${user}/${repo}/${branch}/vault.json?t=${Date.now()}`;
                              console.log(`Tentando resgate Raw: ${rawUrl}`);
                              const rawRes = await fetch(rawUrl);
                              if (rawRes.ok) {
                                  const rawJson = await rawRes.json();
                                  if (rawJson.data) {
                                      console.log(`Cofre recuperado via Raw GitHub (${branch}).`);
                                      setVaultEncryptedData(rawJson.data);
                                      localStorage.setItem('studyflow_secure_vault', rawJson.data);
                                      setIsVaultLocked(true);
                                      setCheckingVault(false);
                                      return;
                                  }
                              }
                          } catch (e) {
                              console.log(`Falha ao buscar branch ${branch}`);
                          }
                      }
                  }
              }
          } catch (e) {
              console.log("Nenhum cofre detectado após todas as tentativas.");
          } finally {
              setCheckingVault(false);
          }
      };
      
      checkVault();
  }, []);

  const handleRestoreData = async (gistId: string, token: string) => {
        try {
            const response = await fetch(`https://api.github.com/gists/${gistId}`, {
                headers: { 'Authorization': `token ${token}` }
            });
            
            if (!response.ok) throw new Error("Falha ao buscar backup.");
            
            const data = await response.json();
            const fileKey = Object.keys(data.files).find(key => key.includes('studyflow'));
            
            if (!fileKey) throw new Error("Arquivo de backup inválido.");
            
            const content = JSON.parse(data.files[fileKey].content);
            
            // Restauração de Estado (Sem Reload)
            if (content.subjects) {
                const hydratedSubjects = content.subjects.map((s: any) => ({
                    ...s,
                    logs: s.logs ? s.logs.map((l: any) => ({ ...l, date: new Date(l.date) })) : []
                }));
                setSubjects(hydratedSubjects);
            }
            if (content.plans) {
                const hydratedPlans = content.plans.map((p: any) => ({ ...p, createdAt: new Date(p.createdAt) }));
                setPlans(hydratedPlans);
            }
            if (content.errors) {
                const hydratedErrors = content.errors.map((e: any) => ({ ...e, createdAt: new Date(e.createdAt) }));
                setErrorLogs(hydratedErrors);
            }
            if (content.simulatedExams) {
                const hydratedExams = content.simulatedExams.map((e: any) => ({ ...e, date: new Date(e.date) }));
                setSimulatedExams(hydratedExams);
            }
            if (content.savedNotes) {
                const hydratedNotes = content.savedNotes.map((n: any) => ({ ...n, createdAt: new Date(n.createdAt) }));
                setSavedNotes(hydratedNotes);
            }
            if (content.currentPlanId) setCurrentPlanId(content.currentPlanId);
            
            if (content.user) {
                setUser(prev => ({
                    ...prev,
                    ...content.user, // Restaura Nome, Avatar e Configs do backup
                    // Preserva as chaves atuais (que vieram do cofre)
                    openAiApiKey: prev.openAiApiKey,
                    githubToken: prev.githubToken,
                    backupGistId: prev.backupGistId
                }));
            }
            
            alert("Dados e perfil restaurados com sucesso!");
        } catch (e: any) {
            alert("Erro ao restaurar dados: " + e.message);
        }
  };

  const handleUnlockVault = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!vaultEncryptedData) return;
      
      setVaultError('');
      setCheckingVault(true); // Usa loader enquanto processa
      
      try {
          const decryptedData = await decryptVault(vaultEncryptedData, vaultPasswordInput);
          
          // 1. Atualizar Estado do Usuário com as Chaves
          setUser(prev => ({
              ...prev,
              openAiApiKey: decryptedData.openAiApiKey || prev.openAiApiKey,
              githubToken: decryptedData.githubToken || prev.githubToken,
              backupGistId: decryptedData.backupGistId || prev.backupGistId
          }));
          
          // 2. Verificar se precisamos restaurar dados (Sessão Vazia + Backup Disponível)
          // Se subjects estiver vazio e tivermos um token e gist, oferecemos a restauração
          const hasBackup = decryptedData.backupGistId && decryptedData.githubToken;
          const isFreshSession = subjects.length === 0;

          setIsVaultLocked(false); // Desbloqueia a UI primeiro

          if (hasBackup && isFreshSession) {
              // Delay pequeno para garantir que a UI renderize o Dashboard vazio antes do prompt
              setTimeout(async () => {
                  if (window.confirm("Cofre desbloqueado! Detectamos um backup na nuvem e seu navegador está vazio.\n\nDeseja BAIXAR seus dados (Matérias, Perfil, Histórico) agora?")) {
                      await handleRestoreData(decryptedData.backupGistId, decryptedData.githubToken);
                  }
              }, 500);
          }
          
          setVaultPasswordInput('');
          
      } catch (err) {
          console.error(err);
          setVaultError("Senha incorreta ou cofre corrompido.");
      } finally {
          setCheckingVault(false);
      }
  };

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

  // Persistence with Encryption for sensitive keys (USER)
  useEffect(() => {
    // Se o cofre estiver ativo (local ou remoto), NÃO salvamos as chaves em texto plano
    // A presença da variável 'studyflow_secure_vault' indica que o modo cofre está ligado
    const isVaultActive = !!localStorage.getItem('studyflow_secure_vault');
    
    const secureUser = {
        ...user,
        openAiApiKey: isVaultActive ? '' : encrypt(user.openAiApiKey),
        githubToken: isVaultActive ? '' : encrypt(user.githubToken)
    };
    localStorage.setItem('studyflow_user', JSON.stringify(secureUser));
  }, [user]);

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
      setCurrentScreen(Screen.SUBJECTS); 
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
          setSubjects(prev => prev.filter(s => s.planId !== planId));
          setPlans(prev => prev.filter(p => p.id !== planId));
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
  };

  const handleDeleteSavedNote = (id: string) => {
      if (window.confirm("Remover esta nota salva?")) {
          setSavedNotes(prev => prev.filter(n => n.id !== id));
      }
  };

  // --- Handlers for Subjects ---
  const handleImportSubjects = (newSubjects: Subject[]) => {
      const subjectsWithPlan = newSubjects.map(s => ({
          ...s,
          planId: currentPlanId
      }));
      setSubjects(prevSubjects => [...prevSubjects, ...subjectsWithPlan]);
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
          const nextColor = AUTO_COLORS[subjects.length % AUTO_COLORS.length];
          const newSubject: Subject = {
              id: `manual-${Date.now()}`,
              planId: currentPlanId,
              name: name,
              active: true,
              color: nextColor,
              topics: [],
              priority: 'MEDIUM',
              proficiency: 'INTERMEDIATE',
              logs: []
          };
          setSubjects(prev => [...prev, newSubject]);
      }
  };

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
  };

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
                        Detectamos um cofre digital (local ou remoto). Digite sua senha para liberar o uso das APIs.
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
      case Screen.DASHBOARD:
        return <Dashboard onNavigate={setCurrentScreen} user={user} subjects={currentPlanSubjects} errorLogs={currentPlanErrorLogs} />;
      case Screen.STUDY_PLAYER:
        return <StudyPlayer apiKey={user.openAiApiKey} model={user.openAiModel} subjects={currentPlanSubjects} dailyAvailableTime={user.dailyAvailableTimeMinutes || 240} onSessionComplete={handleSessionComplete} onNavigate={setCurrentScreen} onSaveNote={handleAddSavedNote} />;
      case Screen.SUBJECTS:
        return <SubjectManager subjects={currentPlanSubjects} onDeleteSubject={handleDeleteSubject} onAddSubject={handleAddManualSubject} onToggleStatus={handleToggleSubjectStatus} onAddTopic={handleAddTopic} onRemoveTopic={handleRemoveTopic} onMoveTopic={handleMoveTopic} onUpdateSubject={handleUpdateSubject} onEditTopic={handleEditTopic} apiKey={user.openAiApiKey} model={user.openAiModel} />;
      case Screen.IMPORTER:
        return <Importer apiKey={user.openAiApiKey} model={user.openAiModel} onImport={handleImportSubjects} state={importerState} setState={setImporterState} />;
      case Screen.DYNAMIC_SCHEDULE:
        return <DynamicSchedule subjects={currentPlanSubjects} onUpdateSubject={handleUpdateSubject} user={user} onUpdateUser={setUser} errorLogs={currentPlanErrorLogs} />;
      case Screen.ERROR_NOTEBOOK:
        return <ErrorNotebook subjects={currentPlanSubjects} logs={currentPlanErrorLogs} onAddLog={handleAddErrorLog} onDeleteLog={handleDeleteErrorLog} />;
      case Screen.SIMULATED_EXAMS:
        return <SimulatedExams exams={currentPlanExams} onAddExam={handleAddSimulatedExam} onDeleteExam={handleDeleteSimulatedExam} />;
      case Screen.SAVED_NOTES:
        return <SavedNotes notes={savedNotes} onDeleteNote={handleDeleteSavedNote} />;
      default:
        return <Dashboard onNavigate={setCurrentScreen} user={user} subjects={currentPlanSubjects} errorLogs={currentPlanErrorLogs} />;
    }
  };

  const activePlanColor = plans.find(p => p.id === currentPlanId)?.color || 'blue';

  // Prevent flash of content if verifying vault
  if (checkingVault) {
      return (
          <div className="h-screen w-full flex items-center justify-center bg-background-light dark:bg-background-dark">
              <span className="material-symbols-outlined text-4xl text-primary animate-spin">sync</span>
          </div>
      );
  }

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
        onUpdatePlan={handleUpdatePlan} 
        onOpenProfile={() => setIsProfileOpen(true)} 
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