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

// Utilitários de encoding para evitar erros com caracteres especiais
const toBase64 = (str: string) => btoa(unescape(encodeURIComponent(str)));

// Utilitários de Criptografia Nativa (AES-GCM)
const generateVaultString = async (data: string, password: string): Promise<string> => {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt"]
    );

    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(data));
    
    const buffer = new Uint8Array(salt.byteLength + iv.byteLength + encrypted.byteLength);
    buffer.set(salt, 0);
    buffer.set(iv, salt.byteLength);
    buffer.set(new Uint8Array(encrypted), salt.byteLength + iv.byteLength);
    
    return btoa(String.fromCharCode(...buffer));
};

export const ProfileModal: React.FC<ProfileModalProps> = ({ user, isOpen, onClose, onSave }) => {
    const [activeTab, setActiveTab] = useState<'PROFILE' | 'KEYS' | 'VAULT'>('PROFILE');
    const [name, setName] = useState(user.name);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl);
    
    // AI Config State
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [hasSavedApiKey, setHasSavedApiKey] = useState(false);
    const [model, setModel] = useState(user.openAiModel || 'gpt-4o-mini');
    const [showApiKey, setShowApiKey] = useState(false);

    // GitHub Sync State
    const [githubTokenInput, setGithubTokenInput] = useState('');
    const [hasSavedGithubToken, setHasSavedGithubToken] = useState(false);
    const [backupGistId, setBackupGistId] = useState(user.backupGistId || '');
    const [showGithubToken, setShowGithubToken] = useState(false);
    const [syncStatus, setSyncStatus] = useState<string>('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);

    // Magic Link State
    const [magicLink, setMagicLink] = useState<string>('');

    // Vault Generation State
    const [vaultPassword, setVaultPassword] = useState('');
    const [isVaultActive, setIsVaultActive] = useState(false);
    const [isProcessingVault, setIsProcessingVault] = useState(false);
    
    // Cloud Vault State
    const [cloudStatus, setCloudStatus] = useState('');

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
            
            setHasSavedApiKey(!!user.openAiApiKey && user.openAiApiKey.length > 5);
            setApiKeyInput(''); 
            
            setHasSavedGithubToken(!!user.githubToken && user.githubToken.length > 5);
            setGithubTokenInput('');

            setModel(user.openAiModel || 'gpt-4o-mini');
            setBackupGistId(user.backupGistId || '');
            setShowApiKey(false);
            setShowGithubToken(false);
            setSyncStatus('');
            setTempImage(null); 
            setMagicLink('');
            setVaultPassword('');
            setCloudStatus('');
            
            // Check if vault exists (locally) with Try/Catch
            try {
                const localVault = localStorage.getItem('studyflow_secure_vault');
                setIsVaultActive(!!localVault);
                
                const savedDate = localStorage.getItem('studyflow_last_backup_date');
                if (savedDate) setLastBackupDate(new Date(savedDate).toLocaleString());
            } catch(e) {}
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
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - cropPos.x, y: e.clientY - cropPos.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setCropPos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
        }
    };

    const handleMouseUp = () => setIsDragging(false);

    const performCrop = () => {
        if (imgRef.current) {
            const canvas = document.createElement('canvas');
            const size = 300; 
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, size, size);
                const centerX = size / 2;
                const centerY = size / 2;
                ctx.translate(centerX, centerY);
                ctx.scale(cropScale, cropScale);
                ctx.translate(cropPos.x, cropPos.y);
                ctx.drawImage(imgRef.current, -imgRef.current.naturalWidth / 2, -imgRef.current.naturalHeight / 2);
                setAvatarUrl(canvas.toDataURL('image/jpeg', 0.7));
                setTempImage(null);
            }
        }
    };

    const cancelCrop = () => {
        setTempImage(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // --- SAVE LOGIC ---
    const handleSave = async () => {
        const finalApiKey = apiKeyInput.trim() ? apiKeyInput.trim().replace(/[^\x00-\x7F]/g, "") : user.openAiApiKey;
        const finalGithubToken = githubTokenInput.trim() ? githubTokenInput.trim().replace(/[^\x00-\x7F]/g, "") : user.githubToken;

        const updatedUser = { 
            ...user, 
            name, 
            avatarUrl,
            openAiApiKey: finalApiKey,
            openAiModel: model,
            githubToken: finalGithubToken,
            backupGistId
        };
        
        // --- AUTO UPDATE VAULT (SECURITY) ---
        if (isVaultActive) {
            try {
                const sessionPass = sessionStorage.getItem('studyflow_session_pass');
                if (sessionPass) {
                    const dataToEncrypt = JSON.stringify({
                        openAiApiKey: finalApiKey,
                        githubToken: finalGithubToken,
                        backupGistId: backupGistId
                    });
                    
                    const newVaultString = await generateVaultString(dataToEncrypt, sessionPass);
                    localStorage.setItem('studyflow_secure_vault', newVaultString);
                }
            } catch (e) {}
        }

        onSave(updatedUser);
        onClose();
    };

    // --- VAULT LOGIC (LOCAL & GIST) ---
    const handleCreateVault = async (target: 'LOCAL' | 'GIST') => {
        if (!vaultPassword || vaultPassword.length < 4) {
            alert("A senha deve ter pelo menos 4 caracteres.");
            return;
        }
        
        const activeApiKey = apiKeyInput.trim() || user.openAiApiKey;
        const activeGithubToken = githubTokenInput.trim() || user.githubToken;
        
        if (!activeApiKey && !activeGithubToken) {
            alert("Você não possui chaves cadastradas para proteger.");
            return;
        }

        setIsProcessingVault(true);
        setCloudStatus(target === 'GIST' ? 'Conectando ao GitHub...' : '');

        try {
            const dataToEncrypt = JSON.stringify({
                openAiApiKey: activeApiKey,
                githubToken: activeGithubToken,
                backupGistId: backupGistId || user.backupGistId
            });

            // 1. Criptografa
            const encryptedString = await generateVaultString(dataToEncrypt, vaultPassword);
            
            // 2. Salva
            if (target === 'LOCAL') {
                try {
                    localStorage.setItem('studyflow_secure_vault', encryptedString);
                    // Limpa do armazenamento inseguro
                    const currentUser = JSON.parse(localStorage.getItem('studyflow_user') || '{}');
                    const sanitizedUser = { ...currentUser, openAiApiKey: '', githubToken: '' };
                    localStorage.setItem('studyflow_user', JSON.stringify(sanitizedUser));
                } catch(e) {
                    alert("Atenção: O armazenamento local está bloqueado.");
                }
                
                try { sessionStorage.setItem('studyflow_session_pass', vaultPassword); } catch(e){}

                setIsVaultActive(true);
                alert("Cofre Local criado! Suas chaves estão protegidas neste navegador.");
                setVaultPassword('');
            } 
            else if (target === 'GIST') {
                // Validação
                if (!activeGithubToken) throw new Error("Token do GitHub necessário para salvar na nuvem.");

                // Envia para o GIST como 'studyflow_vault.json'
                // Isso torna o cofre recuperável apenas pelo Token, sem precisar saber o nome do Repo
                setCloudStatus('Salvando no Gist Seguro...');
                
                const files = {
                    "studyflow_vault.json": { content: JSON.stringify({ data: encryptedString }) }
                };

                // Cria um novo Gist ou atualiza se soubéssemos o ID (aqui criamos um novo para garantir)
                // Idealmente, poderíamos buscar um gist existente com esse nome, mas create é mais seguro para "Setup"
                const res = await fetch(`https://api.github.com/gists`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${activeGithubToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        description: "StudyFlow Secure Vault (Encrypted)",
                        public: false,
                        files: files
                    })
                });

                if (!res.ok) throw new Error("Falha ao salvar Gist.");

                setCloudStatus('Sucesso! ✅');
                alert("Cofre Salvo na Nuvem! \n\nAgora, ao usar a opção 'Já tenho conta' em um novo computador, o sistema encontrará este cofre automaticamente e pedirá sua senha.");
                setVaultPassword('');
                
                // Também ativa localmente
                try { localStorage.setItem('studyflow_secure_vault', encryptedString); } catch(e) {}
                try { sessionStorage.setItem('studyflow_session_pass', vaultPassword); } catch(e){}
                setIsVaultActive(true);
            }

        } catch (e: any) {
            console.error(e);
            alert(`Erro: ${e.message}`);
            setCloudStatus('Erro na operação.');
        } finally {
            setIsProcessingVault(false);
        }
    };

    const handleRemoveLocalVault = () => {
        if (!window.confirm("Tem certeza? Isso removerá a proteção por senha neste navegador.")) return;
        try { localStorage.removeItem('studyflow_secure_vault'); } catch(e) {}
        setIsVaultActive(false);
        alert("Proteção local removida.");
    };

    // --- GitHub Sync Logic ---
    const handleBackupToGithub = async () => {
        const tokenToUse = githubTokenInput.trim() || user.githubToken;
        if (!tokenToUse) {
            setSyncStatus("Erro: Token do GitHub não configurado.");
            return;
        }
        setIsSyncing(true);
        setSyncStatus("Preparando dados...");

        try {
            const getSafe = (k: string) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
            const getSafeObj = (k: string) => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch { return {}; } };
            const getSafeStr = (k: string) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };

            const backupData = {
                version: 2,
                timestamp: new Date().toISOString(),
                subjects: getSafe('studyflow_subjects'),
                plans: getSafe('studyflow_plans'),
                currentPlanId: getSafeStr('studyflow_current_plan'),
                errors: getSafe('studyflow_errors'),
                user: { 
                    ...user, 
                    githubToken: undefined, 
                    openAiApiKey: undefined 
                }, 
                simulatedExams: getSafe('studyflow_simulated_exams'),
                savedNotes: getSafe('studyflow_saved_notes'),
                scheduleSettings: getSafeObj('studyflow_schedule_settings'),
                scheduleSelection: getSafe('studyflow_schedule_selection'),
                importerState: getSafeObj('studyflow_importer'),
                playerState: getSafeObj('studyflow_player_state'),
                expandedSubjectId: getSafeStr('studyflow_expanded_subject_id') || null
            };

            const fileName = "studyflow_backup.json";
            const content = JSON.stringify(backupData, null, 2);
            const url = backupGistId ? `https://api.github.com/gists/${backupGistId}` : `https://api.github.com/gists`;
            const method = backupGistId ? 'PATCH' : 'POST';

            setSyncStatus("Enviando para o GitHub...");

            const response = await fetch(url, {
                method: method,
                headers: { 'Authorization': `token ${tokenToUse}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: `StudyFlow AI Backup (v2)`, public: false, files: { [fileName]: { content: content } } })
            });

            if (!response.ok) throw new Error("Falha na conexão com GitHub.");

            const data = await response.json();
            setBackupGistId(data.id);
            setSyncStatus("Backup realizado com sucesso! ✅");
            
            const now = new Date();
            try { localStorage.setItem('studyflow_last_backup_date', now.toISOString()); } catch(e){}
            setLastBackupDate(now.toLocaleString());

        } catch (error: any) {
            console.error(error);
            setSyncStatus(`Erro: ${error.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleRestoreFromGithub = async () => {
        const tokenToUse = githubTokenInput.trim() || user.githubToken;
        if (!tokenToUse || !backupGistId) return;
        if (!window.confirm("Isso substituirá seus dados atuais. Continuar?")) return;

        setIsSyncing(true);
        setSyncStatus("Baixando dados...");

        try {
            const response = await fetch(`https://api.github.com/gists/${backupGistId}`, { headers: { 'Authorization': `token ${tokenToUse}` } });
            if (!response.ok) throw new Error("Erro ao acessar backup.");
            const data = await response.json();
            const fileKey = Object.keys(data.files).find(key => key.includes('studyflow'));
            if (!fileKey) throw new Error("Arquivo de backup não encontrado.");
            const content = JSON.parse(data.files[fileKey].content);

            const safeSave = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch(e) {} };

            if (content.subjects) safeSave('studyflow_subjects', JSON.stringify(content.subjects));
            if (content.user) {
                let currentUser = {};
                try { currentUser = JSON.parse(localStorage.getItem('studyflow_user') || '{}'); } catch(e){}
                const mergedUser = { ...content.user, githubToken: tokenToUse, backupGistId: backupGistId };
                safeSave('studyflow_user', JSON.stringify(mergedUser));
            }
            
            setSyncStatus("Restauração completa! Recarregando...");
            setTimeout(() => window.location.reload(), 1000);
        } catch (error: any) {
            setSyncStatus(`Erro: ${error.message}`);
        } finally {
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
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50 sticky top-0 z-10 backdrop-blur-md">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Editar Perfil</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex flex-col">
                    {!tempImage && (
                        <div className="flex border-b border-gray-100 dark:border-gray-800 px-6">
                            <button onClick={() => setActiveTab('PROFILE')} className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors ${activeTab === 'PROFILE' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Perfil</button>
                            <button onClick={() => setActiveTab('KEYS')} className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors ${activeTab === 'KEYS' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Chaves & API</button>
                            <button onClick={() => setActiveTab('VAULT')} className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors ${activeTab === 'VAULT' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Segurança</button>
                        </div>
                    )}

                    <div className="p-6 flex flex-col gap-6">
                        {tempImage ? (
                            <div className="flex flex-col items-center gap-6 animate-in fade-in">
                                 <div className="relative size-64 bg-gray-900 rounded-lg overflow-hidden cursor-move border-2 border-primary/50" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <img ref={imgRef} src={tempImage} alt="Crop preview" style={{ transform: `translate(${cropPos.x}px, ${cropPos.y}px) scale(${cropScale})`, maxWidth: 'none', maxHeight: 'none' }} draggable={false}/>
                                    </div>
                                </div>
                                <div className="w-full max-w-xs flex items-center gap-4">
                                    <span className="material-symbols-outlined text-gray-400">zoom_out</span>
                                    <input type="range" min="0.5" max="3" step="0.1" value={cropScale} onChange={(e) => setCropScale(parseFloat(e.target.value))} className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700" />
                                    <span className="material-symbols-outlined text-gray-400">zoom_in</span>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={cancelCrop} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">Cancelar</button>
                                    <button onClick={performCrop} className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-primary hover:bg-blue-600">Confirmar</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {activeTab === 'PROFILE' && (
                                    <div className="flex flex-col gap-6 animate-in fade-in">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="relative group">
                                                <div className={`size-24 rounded-full overflow-hidden border-4 border-white dark:border-[#2d2d42] shadow-lg flex items-center justify-center ${!avatarUrl ? 'bg-primary/10 text-primary' : 'bg-gray-100'}`}>
                                                    {avatarUrl ? <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" /> : <span className="text-3xl font-bold">{getInitials(name)}</span>}
                                                </div>
                                                <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 bg-primary hover:bg-blue-600 text-white p-2 rounded-full shadow-md transition-transform transform hover:scale-105" title="Alterar foto">
                                                    <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                                                </button>
                                            </div>
                                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                                            {avatarUrl && (
                                                <button onClick={handleRemovePhoto} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[14px]">delete</span> Remover foto
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Nome Completo</label>
                                                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'KEYS' && (
                                    <div className="flex flex-col gap-6 animate-in fade-in">
                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="material-symbols-outlined text-primary text-xl">smart_toy</span>
                                                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">Configurações de IA</h3>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">OpenAI API Key</label>
                                                    {hasSavedApiKey && <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">check_circle</span> Salvo</span>}
                                                </div>
                                                <div className="relative">
                                                    <input type={showApiKey ? "text" : "password"} value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} className={`w-full pl-4 pr-10 py-2.5 rounded-lg border text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all font-mono text-sm ${hasSavedApiKey && !apiKeyInput ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800 placeholder-green-700 dark:placeholder-green-400' : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'}`} placeholder={hasSavedApiKey ? "••••••••••••••••••••" : "sk-..."} autoComplete="off" />
                                                    <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none"><span className="material-symbols-outlined text-[20px]">{showApiKey ? 'visibility_off' : 'visibility'}</span></button>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Modelo GPT</label>
                                                <div className="relative">
                                                    <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full appearance-none pl-4 pr-10 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all cursor-pointer">
                                                        {AI_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                                    </select>
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"><span className="material-symbols-outlined">expand_more</span></span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="h-px bg-gray-100 dark:bg-gray-800 w-full"></div>
                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="material-symbols-outlined text-gray-800 dark:text-white text-xl">cloud_sync</span>
                                                <div className="flex flex-col">
                                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">Nuvem Pessoal (GitHub)</h3>
                                                    {lastBackupDate && <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">Backup: {lastBackupDate}</span>}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">GitHub Token (Gist)</label>
                                                    {hasSavedGithubToken && <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">check_circle</span> Salvo</span>}
                                                </div>
                                                <div className="relative">
                                                    <input type={showGithubToken ? "text" : "password"} value={githubTokenInput} onChange={(e) => setGithubTokenInput(e.target.value)} className={`w-full pl-4 pr-10 py-2.5 rounded-lg border text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all font-mono text-sm ${hasSavedGithubToken && !githubTokenInput ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800 placeholder-green-700 dark:placeholder-green-400' : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'}`} placeholder={hasSavedGithubToken ? "••••••••••••••••••••" : "ghp_..."} autoComplete="off" />
                                                    <button type="button" onClick={() => setShowGithubToken(!showGithubToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none"><span className="material-symbols-outlined text-[20px]">{showGithubToken ? 'visibility_off' : 'visibility'}</span></button>
                                                </div>
                                            </div>
                                            {(hasSavedGithubToken || githubTokenInput) && (
                                                <div className="flex flex-col gap-3 mt-2 animate-in fade-in">
                                                    <div className="flex gap-3">
                                                        <button onClick={handleBackupToGithub} disabled={isSyncing} className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-800 dark:bg-white text-white dark:text-gray-900 rounded-lg font-bold text-xs hover:opacity-90 transition-opacity disabled:opacity-50"><span className="material-symbols-outlined text-sm">cloud_upload</span> Salvar Dados</button>
                                                        <button onClick={handleRestoreFromGithub} disabled={isSyncing || !backupGistId} className="flex-1 flex items-center justify-center gap-2 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-white rounded-lg font-bold text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"><span className="material-symbols-outlined text-sm">cloud_download</span> Restaurar</button>
                                                    </div>
                                                    {syncStatus && <p className={`text-xs text-center font-bold animate-pulse ${syncStatus.includes('Erro') ? 'text-red-500' : 'text-green-500'}`}>{syncStatus}</p>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'VAULT' && (
                                    <div className="flex flex-col gap-6 animate-in fade-in">
                                        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-200 text-sm">
                                            <div className="flex items-center gap-2 mb-2 font-bold uppercase text-xs">
                                                <span className="material-symbols-outlined text-amber-500">lock</span>
                                                Cofre Digital
                                            </div>
                                            <p className="leading-relaxed mb-2">
                                                Criptografe suas chaves API com uma senha. O cofre pode ser salvo localmente ou no Gist para facilitar a recuperação em outros dispositivos usando apenas seu Token.
                                            </p>
                                        </div>

                                        <div className="flex flex-col gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Senha de Proteção (Obrigatória)</label>
                                                <input 
                                                    type="password" 
                                                    value={vaultPassword} 
                                                    onChange={(e) => setVaultPassword(e.target.value)} 
                                                    placeholder="Crie uma senha forte..." 
                                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-card-dark text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500/50 outline-none"
                                                />
                                            </div>

                                            {/* Opção 1: Local */}
                                            <button 
                                                onClick={() => handleCreateVault('LOCAL')}
                                                disabled={isProcessingVault || !vaultPassword}
                                                className="w-full py-3 bg-white dark:bg-card-dark border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                                            >
                                                <span className="material-symbols-outlined">computer</span>
                                                Ativar Apenas no Navegador
                                            </button>

                                            <div className="relative flex py-1 items-center">
                                                <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                                                <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-bold uppercase">Ou Nuvem</span>
                                                <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                                            </div>

                                            {/* Opção 2: Gist (Fácil Recuperação) */}
                                            <button 
                                                onClick={() => handleCreateVault('GIST')}
                                                disabled={isProcessingVault || !vaultPassword || (!user.githubToken && !githubTokenInput)}
                                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                                            >
                                                {isProcessingVault ? 'Processando...' : 'Salvar Cofre no Gist'}
                                            </button>
                                            
                                            {cloudStatus && <p className="text-xs text-center font-bold text-blue-600 dark:text-blue-400 animate-pulse">{cloudStatus}</p>}
                                        </div>

                                        {isVaultActive && (
                                            <div className="mt-2 text-center">
                                                <p className="text-xs text-green-600 font-bold flex items-center justify-center gap-1 mb-2">
                                                    <span className="material-symbols-outlined text-sm">verified_user</span> 
                                                    Cofre Ativo Localmente
                                                </p>
                                                <button 
                                                    onClick={handleRemoveLocalVault}
                                                    className="text-xs text-red-500 hover:underline"
                                                >
                                                    Remover proteção deste navegador
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {!tempImage && (
                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 sticky bottom-0 z-10 backdrop-blur-md">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Fechar</button>
                        <button onClick={handleSave} className="px-6 py-2 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-blue-600 shadow-lg shadow-primary/25 transition-all transform active:scale-95">Salvar Alterações</button>
                    </div>
                )}
            </div>
        </div>
    );
};