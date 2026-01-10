
export enum Screen {
    DASHBOARD = 'DASHBOARD',
    STUDY_PLAYER = 'STUDY_PLAYER',
    SUBJECTS = 'SUBJECTS',
    IMPORTER = 'IMPORTER',
    DYNAMIC_SCHEDULE = 'DYNAMIC_SCHEDULE',
    ERROR_NOTEBOOK = 'ERROR_NOTEBOOK',
    SIMULATED_EXAMS = 'SIMULATED_EXAMS',
    SAVED_NOTES = 'SAVED_NOTES',
    HISTORY = 'HISTORY' // Nova Tela
}

export interface NavItem {
    id: Screen;
    label: string;
    icon: string;
}

export interface UserProfile {
    name: string;
    email: string;
    avatarUrl: string | null;
    openAiApiKey?: string;
    openAiModel?: string;
    dailyAvailableTimeMinutes?: number; 
    githubToken?: string; 
    backupGistId?: string; 
}

export interface StudyPlan {
    id: string;
    name: string;
    description?: string;
    color?: string; // Nova propriedade
    createdAt: Date;
}

export type StudyModality = 'PDF' | 'VIDEO' | 'QUESTIONS' | 'LEGISLATION' | 'REVIEW';

export interface StudyLog {
    id: string;
    date: Date;
    topicId: string;
    topicName: string;
    durationMinutes: number;
    questionsCount: number;
    correctCount: number;
    modalities?: StudyModality[]; // Alterado para Array
    notes?: string;
}

export interface SavedNote {
    id: string;
    content: string;
    subjectName: string;
    topicName: string;
    createdAt: Date;
    tags?: string[];
}

export interface Topic {
    id: string;
    name: string;
    completed: boolean;
}

export type PriorityLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type ProficiencyLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export interface Subject {
    id: string;
    planId: string;
    name: string;
    topics: Topic[];
    active: boolean;
    color?: string;
    weight?: number; // Nova propriedade: Peso no Edital
    priority?: PriorityLevel; 
    proficiency?: ProficiencyLevel;
    logs?: StudyLog[];
}

// Arquivos de edital vinculados a um plano
export interface EditalFile {
    id: string;
    planId: string;
    fileName: string; // Nome editável apresentado ao usuário
    dataUrl: string; // Conteúdo base64 para visualização/offline
    sizeBytes: number;
    mimeType: string;
    uploadedAt: Date;
}

export type SessionType = 'THEORY' | 'REVIEW';

export interface ScheduleItem {
    subject: Subject;
    topic?: Topic;
    type: SessionType;
    durationMinutes?: number;
}

// Tipos do Importador
export interface SyllabusTopic {
    nome: string;
}

export interface SyllabusSubject {
    nome: string;
    topicos: string[];
}

export interface SyllabusCategory {
    nome: string; 
    disciplinas: SyllabusSubject[];
}

export interface SyllabusData {
    cargo: string;
    categorias: SyllabusCategory[];
}

export type ImportStep = 'UPLOAD' | 'PROCESSING' | 'REVIEW' | 'SUCCESS';

export interface ImporterState {
    step: ImportStep;
    fileName: string;
    processingStatus: string;
    progress: number;
    syllabus: SyllabusData | null;
    selectedSubjects: Set<string>; 
}

// Tipos do Caderno de Erros
export type ErrorReason = 'KNOWLEDGE_GAP' | 'ATTENTION' | 'INTERPRETATION' | 'TRICK' | 'TIME';

export interface ErrorLog {
    id: string;
    subjectId: string;
    topicName: string;
    questionSource: string;
    reason: ErrorReason;
    description: string;
    correction: string;
    createdAt: Date;
    reviewCount: number;
}

// Novos Tipos para Simulados
export interface SimulatedExam {
    id: string;
    planId: string;
    title: string; // Ex: Simulado Nacional TRT
    institution: string; // Banca (FGV, Cebraspe, etc)
    date: Date;
    totalQuestions: number;
    correctAnswers: number;
    notes?: string;
}

export const getSubjectIcon = (subjectName: string): string => {
    const name = subjectName.toLowerCase();
    
    // Exatas
    if (name.includes('matem') || name.includes('calc') || name.includes('cálc') || name.includes('racioc') || name.includes('logi') || name.includes('exata') || name.includes('estat')) return 'calculate';
    if (name.includes('fisic') || name.includes('quim') || name.includes('biolo') || name.includes('cienc')) return 'science';
    
    // Tecnologia
    if (name.includes('inform') || name.includes('comput') || name.includes('ti') || name.includes('tec') || name.includes('dad') || name.includes('prog') || name.includes('sistem')) return 'terminal';
    
    // Direito / Legislação
    if (name.includes('direit') || name.includes('legis') || name.includes('lei') || name.includes('const') || name.includes('penal') || name.includes('civil') || name.includes('process') || name.includes('trab') || name.includes('eleit')) return 'balance';
    
    // Línguas / Humanas
    if (name.includes('portug') || name.includes('ingl') || name.includes('espa') || name.includes('ling') || name.includes('text') || name.includes('redac') || name.includes('leitura')) return 'auto_stories';
    if (name.includes('hist') || name.includes('geo') || name.includes('filo') || name.includes('socio') || name.includes('atual') || name.includes('human')) return 'public';
    
    // Saúde
    if (name.includes('bio') || name.includes('saud') || name.includes('med') || name.includes('enf') || name.includes('sus')) return 'medical_services';
    
    // Administrativo / Gestão
    if (name.includes('admin') || name.includes('gest') || name.includes('econ') || name.includes('contab') || name.includes('finan') || name.includes('arq')) return 'account_balance';
    
    // Artes
    if (name.includes('art') || name.includes('desen') || name.includes('mus')) return 'palette';
    
    // Padrão
    return 'menu_book';
};