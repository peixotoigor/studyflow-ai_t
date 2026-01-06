import React, { useState, useRef, useEffect } from 'react';
import { UserProfile } from '../types';

interface ProfileModalProps {
    user: UserProfile;
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedUser: UserProfile) => void;
}

const AI_MODELS = [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini (Rápido/Econômico)' },
    { id: 'gpt-4o', label: 'GPT-4o (Inteligência Máxima)' },
    { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Legado)' },
    { id: 'o1-preview', label: 'o1 Preview (Raciocínio Avançado)' },
    { id: 'o1-mini', label: 'o1 Mini (Raciocínio Rápido)' }
];

export const ProfileModal: React.FC<ProfileModalProps> = ({ user, isOpen, onClose, onSave }) => {
    const [name, setName] = useState(user.name);
    // Email removido do state editável, usaremos user.email diretamente
    const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl);
    
    // AI Config State
    const [apiKey, setApiKey] = useState(user.openAiApiKey || '');
    const [model, setModel] = useState(user.openAiModel || 'gpt-4o-mini');
    const [showApiKey, setShowApiKey] = useState(false);

    // GitHub Sync State
    const [githubToken, setGithubToken] = useState(user.githubToken || '');
    const [backupGistId, setBackupGistId] = useState(user.backupGistId || '');
    const [showGithubToken, setShowGithubToken] = useState(false);
    const [syncStatus, setSyncStatus] = useState<string>('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);

    // Crop State
    const [tempImage, setTempImage] = useState<string | null>(null);
    const [cropScale, setCropScale] = useState(1);
    const [cropPos, setCropPos] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setName(user.name);
            setAvatarUrl(user.avatarUrl);
            setApiKey(user.openAiApiKey || '');
            setModel(user.openAiModel || 'gpt-4o-mini');
            setGithubToken(user.githubToken || '');
            setBackupGistId(user.backupGistId || '');
            setShowApiKey(false);
            setShowGithubToken(false);
            setSyncStatus('');
            setTempImage(null); // Reset crop
            
            // Carregar data do último backup
            const savedDate = localStorage.getItem('studyflow_last_backup_date');
            if (savedDate) setLastBackupDate(new Date(savedDate).toLocaleString());
        }
    }, [isOpen, user]);

    if (!isOpen) return null;

    // --- Image Handling ---

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setTempImage(reader.result as string);
                setCropScale(1);
                setCropPos({ x: 0, y: 0 });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemovePhoto = () => {
        setAvatarUrl(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Crop Logic
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - cropPos.x, y: e.clientY - cropPos.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setCropPos({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    };

    const handleMouseUp = () => setIsDragging(false);

    const performCrop = () => {
        if (imgRef.current) {
            const canvas = document.createElement('canvas');
            const size = 300; // Tamanho final do avatar
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            if (ctx) {
                // Preenche fundo branco (opcional, para transparência)
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, size, size);

                // Configurações de desenho baseadas na visualização CSS
                const centerX = size / 2;
                const centerY = size / 2;

                ctx.translate(centerX, centerY);
                ctx.scale(cropScale, cropScale);
                ctx.translate(cropPos.x, cropPos.y);
                
                // Desenha a imagem centralizada no contexto transformado
                ctx.drawImage(
                    imgRef.current, 
                    -imgRef.current.naturalWidth / 2, 
                    -imgRef.current.naturalHeight / 2
                );

                setAvatarUrl(canvas.toDataURL('image/jpeg', 0.9));
                setTempImage(null); // Sai do modo de crop
            }
        }
    };

    const cancelCrop = () => {
        setTempImage(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSave = () => {
        const cleanApiKey = apiKey.trim().replace(/[^\x00-\x7F]/g, "");
        const cleanGithubToken = githubToken.trim().replace(/[^\x00-\x7F]/g, "");

        onSave({ 
            ...user, 
            name, 
            // email mantido do user original
            avatarUrl,
            openAiApiKey: cleanApiKey,
            openAiModel: model,
            githubToken: cleanGithubToken,
            backupGistId
        });
        onClose();
    };

    // --- GitHub Sync Logic ---
    const handleBackupToGithub = async () => {
        if (!githubToken) {
            setSyncStatus("Erro: Token do GitHub não configurado.");
            return;
        }
        setIsSyncing(true);
        setSyncStatus("Preparando dados completos...");

        try {
            // Coleta dados do LocalStorage (ABRANGENTE)
            const backupData = {
                version: 2, // Incrementado para sinalizar nova estrutura
                timestamp: new Date().toISOString(),
                // Core Data
                subjects: JSON.parse(localStorage.getItem('studyflow_subjects') || '[]'),
                plans: JSON.parse(localStorage.getItem('studyflow_plans') || '[]'),
                currentPlanId: localStorage.getItem('studyflow_current_plan') || '',
                errors: JSON.parse(localStorage.getItem('studyflow_errors') || '[]'),
                user: { ...user, githubToken: undefined }, // Não salvar o token no backup por segurança
                
                // Feature Data
                simulatedExams: JSON.parse(localStorage.getItem('studyflow_simulated_exams') || '[]'),
                savedNotes: JSON.parse(localStorage.getItem('studyflow_saved_notes') || '[]'),
                
                // Context/State Data
                scheduleSettings: JSON.parse(localStorage.getItem('studyflow_schedule_settings') || '{}'),
                scheduleSelection: JSON.parse(localStorage.getItem('studyflow_schedule_selection') || '[]'),
                importerState: JSON.parse(localStorage.getItem('studyflow_importer') || 'null'),
                playerState: JSON.parse(localStorage.getItem('studyflow_player_state') || 'null'),
                expandedSubjectId: localStorage.getItem('studyflow_expanded_subject_id') || null
            };

            const fileName = "studyflow_backup.json";
            const content = JSON.stringify(backupData, null, 2);

            const url = backupGistId 
                ? `https://api.github.com/gists/${backupGistId}`
                : `https://api.github.com/gists`;
            
            const method = backupGistId ? 'PATCH' : 'POST';

            setSyncStatus("Enviando para o GitHub...");

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description: `StudyFlow AI Backup (v2) - ${new Date().toLocaleDateString()}`,
                    public: false,
                    files: {
                        [fileName]: {
                            content: content
                        }
                    }
                })
            });

            if (!response.ok) {
                if (response.status === 404) throw new Error("Gist não encontrado. Limpe o ID para criar um novo.");
                if (response.status === 401) throw new Error("Token do GitHub inválido.");
                throw new Error("Falha na conexão com GitHub.");
            }

            const data = await response.json();
            setBackupGistId(data.id);
            setSyncStatus("Backup TOTAL realizado com sucesso! ✅");
            
            const now = new Date();
            localStorage.setItem('studyflow_last_backup_date', now.toISOString());
            setLastBackupDate(now.toLocaleString());

        } catch (error: any) {
            console.error(error);
            setSyncStatus(`Erro: ${error.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleRestoreFromGithub = async () => {
        if (!githubToken || !backupGistId) {
            setSyncStatus("Erro: Token e Gist ID são obrigatórios para restaurar.");
            return;
        }
        if (!window.confirm("ATENÇÃO: Isso irá substituir TODOS os seus dados locais (Disciplinas, Planos, Notas, Progresso) pelos dados da nuvem. Deseja continuar?")) return;

        setIsSyncing(true);
        setSyncStatus("Baixando dados...");

        try {
            const response = await fetch(`https://api.github.com/gists/${backupGistId}`, {
                headers: {
                    'Authorization': `token ${githubToken}`
                }
            });

            if (!response.ok) throw new Error("Não foi possível acessar o backup.");

            const data = await response.json();
            const fileKey = Object.keys(data.files).find(key => key.includes('studyflow'));
            
            if (!fileKey) throw new Error("Arquivo de backup não encontrado neste Gist.");

            const content = JSON.parse(data.files[fileKey].content);

            // --- DATA MIGRATION & SANITIZATION LAYER ---
            // Esta camada garante que dados antigos recebam novos campos obrigatórios antes de salvar
            
            // 1. Migração de Planos
            const safePlans = (content.plans || []).map((p: any) => ({
                ...p,
                color: p.color || 'blue',
                description: p.description || '',
                createdAt: p.createdAt || new Date().toISOString()
            }));

            // 2. Migração de Disciplinas e Logs
            const safeSubjects = (content.subjects || []).map((s: any) => ({
                ...s,
                planId: s.planId || 'default-plan', // Garante associação com algum plano
                color: s.color || 'blue',
                priority: s.priority || 'MEDIUM',
                proficiency: s.proficiency || 'INTERMEDIATE',
                logs: (s.logs || []).map((l: any) => ({
                    ...l,
                    modality: l.modality || 'PDF' // Garante que logs tenham modalidade
                }))
            }));

            // 3. Migração de Simulados
            const safeExams = (content.simulatedExams || []).map((e: any) => ({
                ...e,
                planId: e.planId || 'current'
            }));

            // --- SAVE TO LOCAL STORAGE ---
            
            if (safeSubjects.length > 0) localStorage.setItem('studyflow_subjects', JSON.stringify(safeSubjects));
            if (safePlans.length > 0) localStorage.setItem('studyflow_plans', JSON.stringify(safePlans));
            if (content.currentPlanId) localStorage.setItem('studyflow_current_plan', content.currentPlanId);
            if (content.errors) localStorage.setItem('studyflow_errors', JSON.stringify(content.errors));
            
            // Feature Data
            if (safeExams.length > 0) localStorage.setItem('studyflow_simulated_exams', JSON.stringify(safeExams));
            if (content.savedNotes) localStorage.setItem('studyflow_saved_notes', JSON.stringify(content.savedNotes));
            
            // Context Data
            if (content.scheduleSettings) localStorage.setItem('studyflow_schedule_settings', JSON.stringify(content.scheduleSettings));
            if (content.scheduleSelection) localStorage.setItem('studyflow_schedule_selection', JSON.stringify(content.scheduleSelection));
            
            if (content.importerState) localStorage.setItem('studyflow_importer', JSON.stringify(content.importerState));
            if (content.playerState) localStorage.setItem('studyflow_player_state', JSON.stringify(content.playerState));
            if (content.expandedSubjectId) localStorage.setItem('studyflow_expanded_subject_id', content.expandedSubjectId);

            // User Profile (Higienização)
            if (content.user) {
                const currentUser = JSON.parse(localStorage.getItem('studyflow_user') || '{}');
                const mergedUser = { 
                    ...content.user, 
                    githubToken: githubToken || currentUser.githubToken, // Preserva token atual se válido
                    backupGistId: backupGistId || currentUser.backupGistId,
                    dailyAvailableTimeMinutes: content.user.dailyAvailableTimeMinutes || 240 // Default se faltar
                };
                localStorage.setItem('studyflow_user', JSON.stringify(mergedUser));
            }

            const now = new Date();
            localStorage.setItem('studyflow_last_backup_date', now.toISOString());

            setSyncStatus("Restauração completa e dados atualizados! Recarregando... 🔄");
            setTimeout(() => window.location.reload(), 1500);

        } catch (error: any) {
            console.error(error);
            setSyncStatus(`Erro ao restaurar: ${error.message}`);
            setIsSyncing(false);
        }
    };

    const getInitials = (fullName: string) => {
        const names = fullName.split(' ');
        if (names.length >= 2) return `${names[0][0]}${names[1][0]}`.toUpperCase();
        return fullName.slice(0, 2).toUpperCase();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
            <div className="bg-white dark:bg-[#1a1a2e] w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 transform transition-all scale-100 flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50 sticky top-0 z-10 backdrop-blur-md">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Editar Perfil</h2>
                    <button 
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col gap-8">
                    
                    {/* Image Cropper Mode */}
                    {tempImage ? (
                        <div className="flex flex-col items-center gap-6 animate-in fade-in">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">Ajustar Foto</h3>
                            
                            <div className="relative size-64 bg-gray-900 rounded-lg overflow-hidden cursor-move border-2 border-primary/50"
                                 onMouseDown={handleMouseDown}
                                 onMouseMove={handleMouseMove}
                                 onMouseUp={handleMouseUp}
                                 onMouseLeave={handleMouseUp}
                            >
                                {/* Imagem sendo manipulada */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <img 
                                        ref={imgRef}
                                        src={tempImage} 
                                        alt="Crop preview"
                                        style={{
                                            transform: `translate(${cropPos.x}px, ${cropPos.y}px) scale(${cropScale})`,
                                            maxWidth: 'none', // Permite que a imagem seja maior que o container
                                            maxHeight: 'none'
                                        }}
                                        draggable={false}
                                    />
                                </div>
                                
                                {/* Máscara Circular Visual */}
                                <div className="absolute inset-0 border-[30px] border-black/50 rounded-full pointer-events-none box-border"></div>
                                <div className="absolute inset-0 border-2 border-white/30 rounded-full pointer-events-none"></div>
                            </div>

                            <div className="w-full max-w-xs flex items-center gap-4">
                                <span className="material-symbols-outlined text-gray-400">zoom_out</span>
                                <input 
                                    type="range" 
                                    min="0.5" 
                                    max="3" 
                                    step="0.1" 
                                    value={cropScale}
                                    onChange={(e) => setCropScale(parseFloat(e.target.value))}
                                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                />
                                <span className="material-symbols-outlined text-gray-400">zoom_in</span>
                            </div>

                            <div className="flex gap-3">
                                <button 
                                    onClick={cancelCrop}
                                    className="px-4 py-2 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={performCrop}
                                    className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-primary hover:bg-blue-600"
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Normal Mode */
                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col items-center gap-4">
                                <div className="relative group">
                                    <div className={`size-24 rounded-full overflow-hidden border-4 border-white dark:border-[#2d2d42] shadow-lg flex items-center justify-center ${!avatarUrl ? 'bg-primary/10 text-primary' : 'bg-gray-100'}`}>
                                        {avatarUrl ? (
                                            <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-3xl font-bold">{getInitials(name)}</span>
                                        )}
                                    </div>
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute bottom-0 right-0 bg-primary hover:bg-blue-600 text-white p-2 rounded-full shadow-md transition-transform transform hover:scale-105"
                                        title="Alterar foto"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                                    </button>
                                </div>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleFileChange} 
                                    accept="image/*" 
                                    className="hidden" 
                                />
                                {avatarUrl && (
                                    <button 
                                        onClick={handleRemovePhoto}
                                        className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">delete</span>
                                        Remover foto
                                    </button>
                                )}
                            </div>

                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Nome Completo</label>
                                    <input 
                                        type="text" 
                                        value={name} 
                                        onChange={(e) => setName(e.target.value)}
                                        className="px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all"
                                        placeholder="Seu nome"
                                    />
                                </div>
                                {/* Campo de E-mail removido conforme solicitado */}
                            </div>
                        </div>
                    )}

                    <div className="h-px bg-gray-100 dark:bg-gray-800 w-full"></div>

                    {/* Section: AI Configuration */}
                    {!tempImage && (
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-primary text-xl">smart_toy</span>
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">Configurações de IA</h3>
                            </div>
                            
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 flex justify-between">
                                    OpenAI API Key
                                    <span className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400">
                                        <span className="material-symbols-outlined text-[12px]">lock</span>
                                        Armazenamento Local Seguro
                                    </span>
                                </label>
                                <div className="relative">
                                    <input 
                                        type={showApiKey ? "text" : "password"} 
                                        value={apiKey} 
                                        onChange={(e) => setApiKey(e.target.value)}
                                        className="w-full pl-4 pr-10 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all font-mono text-sm"
                                        placeholder="sk-..."
                                        autoComplete="off"
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setShowApiKey(!showApiKey)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none"
                                        title={showApiKey ? "Ocultar chave" : "Mostrar chave"}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">
                                            {showApiKey ? 'visibility_off' : 'visibility'}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Modelo GPT Preferido</label>
                                <div className="relative">
                                    <select 
                                        value={model} 
                                        onChange={(e) => setModel(e.target.value)}
                                        className="w-full appearance-none pl-4 pr-10 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all cursor-pointer"
                                    >
                                        {AI_MODELS.map(m => (
                                            <option key={m.id} value={m.id}>{m.label}</option>
                                        ))}
                                    </select>
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                                        <span className="material-symbols-outlined">expand_more</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {!tempImage && <div className="h-px bg-gray-100 dark:bg-gray-800 w-full"></div>}

                    {/* Section: GitHub Sync (New) */}
                    {!tempImage && (
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-gray-800 dark:text-white text-xl">cloud_sync</span>
                                <div className="flex flex-col">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">Nuvem Pessoal (GitHub)</h3>
                                    {lastBackupDate && (
                                        <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                                            Último backup: {lastBackupDate}
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30 text-xs text-blue-700 dark:text-blue-300">
                                Salve seus dados de forma segura e privada no seu próprio GitHub. Ideal para usar em vários dispositivos no GitHub Pages.
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">GitHub Personal Access Token (Gist)</label>
                                <div className="relative">
                                    <input 
                                        type={showGithubToken ? "text" : "password"} 
                                        value={githubToken} 
                                        onChange={(e) => setGithubToken(e.target.value)}
                                        className="w-full pl-4 pr-10 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all font-mono text-sm"
                                        placeholder="ghp_..."
                                        autoComplete="off"
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setShowGithubToken(!showGithubToken)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">
                                            {showGithubToken ? 'visibility_off' : 'visibility'}
                                        </span>
                                    </button>
                                </div>
                                <a href="https://github.com/settings/tokens/new?scopes=gist&description=StudyFlow+Backup" target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline mt-1 inline-flex items-center gap-1">
                                    Gerar Token (marque apenas 'gist')
                                    <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                                </a>
                            </div>

                            {githubToken && (
                                <div className="flex flex-col gap-3 mt-2 animate-in fade-in">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">ID do Backup (Gist ID)</label>
                                        <input 
                                            type="text" 
                                            value={backupGistId} 
                                            onChange={(e) => setBackupGistId(e.target.value)}
                                            placeholder="Será preenchido automaticamente ao salvar..."
                                            className="w-full px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-500 focus:ring-1 focus:ring-gray-300 outline-none text-xs font-mono"
                                        />
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleBackupToGithub}
                                            disabled={isSyncing}
                                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-800 dark:bg-white text-white dark:text-gray-900 rounded-lg font-bold text-xs hover:opacity-90 transition-opacity disabled:opacity-50"
                                        >
                                            <span className="material-symbols-outlined text-sm">cloud_upload</span>
                                            Salvar na Nuvem
                                        </button>
                                        <button
                                            onClick={handleRestoreFromGithub}
                                            disabled={isSyncing || !backupGistId}
                                            className="flex-1 flex items-center justify-center gap-2 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-white rounded-lg font-bold text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                                        >
                                            <span className="material-symbols-outlined text-sm">cloud_download</span>
                                            Restaurar
                                        </button>
                                    </div>
                                    {syncStatus && (
                                        <p className={`text-xs text-center font-bold animate-pulse ${syncStatus.includes('Erro') ? 'text-red-500' : 'text-green-500'}`}>
                                            {syncStatus}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                </div>

                {/* Footer */}
                {!tempImage && (
                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 sticky bottom-0 z-10 backdrop-blur-md">
                        <button 
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            Fechar
                        </button>
                        <button 
                            onClick={handleSave}
                            className="px-6 py-2 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-blue-600 shadow-lg shadow-primary/25 transition-all transform active:scale-95"
                        >
                            Salvar Alterações
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};