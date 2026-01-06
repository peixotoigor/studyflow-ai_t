import React, { useState, useRef, useEffect } from 'react';
import { Screen, UserProfile, StudyPlan } from '../types';

interface SidebarProps {
    currentScreen: Screen;
    onNavigate: (screen: Screen) => void;
    user: UserProfile;
    plans?: StudyPlan[];
    currentPlanId?: string;
    onSwitchPlan?: (planId: string) => void;
    onAddPlan?: (name: string) => void;
    onDeletePlan?: (planId: string) => void;
    onUpdateUser?: (user: UserProfile) => void;
    onUpdatePlan?: (plan: StudyPlan) => void;
    onOpenProfile?: () => void; // Novo Prop para abrir o modal
}

const PLAN_COLORS = ['blue', 'red', 'green', 'purple', 'orange', 'teal', 'pink'];

export const Sidebar: React.FC<SidebarProps> = ({ 
    currentScreen, 
    onNavigate, 
    user,
    plans = [],
    currentPlanId,
    onSwitchPlan,
    onAddPlan,
    onDeletePlan,
    onUpdateUser,
    onUpdatePlan,
    onOpenProfile
}) => {
    const [isPlanDropdownOpen, setIsPlanDropdownOpen] = useState(false);
    const [isAddingPlan, setIsAddingPlan] = useState(false);
    const [newPlanName, setNewPlanName] = useState('');
    
    // States for Plan Editing
    const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
    const [editPlanName, setEditPlanName] = useState('');
    const [editPlanColor, setEditPlanColor] = useState('blue');

    const dropdownRef = useRef<HTMLDivElement>(null);

    const navItems = [
        { id: Screen.DASHBOARD, label: 'Dashboard', icon: 'dashboard' },
        { id: Screen.DYNAMIC_SCHEDULE, label: 'Plano de Estudo', icon: 'calendar_month' },
        { id: Screen.STUDY_PLAYER, label: 'Modo Foco', icon: 'play_circle' },
        { id: Screen.HISTORY, label: 'Histórico', icon: 'history' }, // Novo Item
        { id: Screen.SIMULATED_EXAMS, label: 'Simulados', icon: 'history_edu' }, 
        { id: Screen.ERROR_NOTEBOOK, label: 'Caderno de Erros', icon: 'assignment_late' }, 
        { id: Screen.SAVED_NOTES, label: 'Insights IA', icon: 'lightbulb' }, 
        { id: Screen.SUBJECTS, label: 'Disciplinas', icon: 'menu_book' },
        { id: Screen.IMPORTER, label: 'Importador', icon: 'vertical_split' },
    ];

    // Gera iniciais se não houver avatar
    const getInitials = (fullName: string) => {
        const names = fullName.split(' ');
        if (names.length >= 2) return `${names[0][0]}${names[1][0]}`.toUpperCase();
        return fullName.slice(0, 2).toUpperCase();
    };

    // Fechar dropdown ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsPlanDropdownOpen(false);
                setIsAddingPlan(false);
                setEditingPlanId(null); // Fecha edição se sair
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCreatePlan = (e: React.FormEvent) => {
        e.preventDefault();
        if (newPlanName.trim() && onAddPlan) {
            onAddPlan(newPlanName);
            setNewPlanName('');
            setIsAddingPlan(false);
            setIsPlanDropdownOpen(false);
        }
    };

    const handleStartEditingPlan = (plan: StudyPlan, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingPlanId(plan.id);
        setEditPlanName(plan.name);
        setEditPlanColor(plan.color || 'blue');
    };

    const handleSavePlanEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (editingPlanId && editPlanName.trim() && onUpdatePlan) {
            const originalPlan = plans.find(p => p.id === editingPlanId);
            if (originalPlan) {
                onUpdatePlan({ 
                    ...originalPlan, 
                    name: editPlanName, 
                    color: editPlanColor 
                });
            }
        }
        setEditingPlanId(null);
    };

    const activePlan = plans.find(p => p.id === currentPlanId);
    const activeColor = activePlan?.color || 'blue';

    return (
        <aside className="hidden md:flex flex-col w-64 h-full bg-card-light dark:bg-card-dark border-r border-border-light dark:border-border-dark flex-shrink-0 transition-colors duration-200">
            <div className="flex flex-col h-full p-4 justify-between">
                <div className="flex flex-col gap-6">
                    {/* User Profile Header (Agora clicável para editar) */}
                    <button 
                        onClick={onOpenProfile}
                        className="flex gap-3 items-center px-2 group hover:bg-gray-50 dark:hover:bg-white/5 p-2 rounded-lg transition-colors text-left"
                        title="Editar Perfil e Configurações"
                    >
                        <div className="relative">
                            <div className={`flex items-center justify-center aspect-square rounded-full size-10 ring-2 ring-primary/20 overflow-hidden ${!user.avatarUrl ? 'bg-primary/10 text-primary' : ''}`}>
                                {user.avatarUrl ? (
                                    <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="font-bold text-xs">{getInitials(user.name)}</span>
                                )}
                            </div>
                            <div className="absolute -bottom-1 -right-1 bg-white dark:bg-card-dark rounded-full p-0.5 shadow-sm border border-gray-100 dark:border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="material-symbols-outlined text-[12px] text-primary">settings</span>
                            </div>
                        </div>
                        <div className="flex flex-col overflow-hidden w-full relative justify-center">
                            <h1 className="text-text-primary-light dark:text-text-primary-dark text-sm font-bold leading-normal truncate group-hover:text-primary transition-colors">
                                {user.name}
                            </h1>
                        </div>
                    </button>

                    {/* Plan Switcher */}
                    <div className="relative" ref={dropdownRef}>
                        <button 
                            onClick={() => setIsPlanDropdownOpen(!isPlanDropdownOpen)}
                            className={`w-full flex items-center justify-between p-2.5 bg-gray-50 dark:bg-white/5 border border-border-light dark:border-border-dark rounded-lg hover:border-${activeColor}-500/50 transition-colors group`}
                        >
                            <div className="flex items-center gap-2 overflow-hidden">
                                <div className={`size-6 bg-${activeColor}-100 dark:bg-${activeColor}-900/30 rounded flex items-center justify-center text-${activeColor}-600 group-hover:bg-${activeColor}-500 group-hover:text-white transition-colors`}>
                                    <span className="material-symbols-outlined text-[16px]">folder_open</span>
                                </div>
                                <div className="flex flex-col items-start truncate">
                                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Edital Atual</span>
                                    <span className="text-sm font-bold text-text-primary-light dark:text-white truncate max-w-[120px]">
                                        {activePlan?.name || 'Selecione...'}
                                    </span>
                                </div>
                            </div>
                            <span className="material-symbols-outlined text-gray-400">unfold_more</span>
                        </button>

                        {/* Dropdown Menu */}
                        {isPlanDropdownOpen && (
                            <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-[#1a1a2e] border border-border-light dark:border-border-dark rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="p-2 border-b border-gray-100 dark:border-gray-800">
                                    <p className="text-[10px] text-gray-400 font-bold px-2 py-1 uppercase">Seus Planos</p>
                                </div>
                                
                                <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                    {plans.map(plan => {
                                        const isEditing = editingPlanId === plan.id;
                                        const pColor = plan.color || 'blue';
                                        
                                        return (
                                            <div 
                                                key={plan.id}
                                                className={`group flex flex-col p-2 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors border-b border-transparent ${isEditing ? 'bg-gray-50 dark:bg-white/5' : ''}`}
                                                onClick={() => {
                                                    if (!isEditing && onSwitchPlan) {
                                                        onSwitchPlan(plan.id);
                                                        setIsPlanDropdownOpen(false);
                                                    }
                                                }}
                                            >
                                                {isEditing ? (
                                                    <div className="flex flex-col gap-2 p-1" onClick={(e) => e.stopPropagation()}>
                                                        <input 
                                                            autoFocus
                                                            type="text" 
                                                            value={editPlanName}
                                                            onChange={(e) => setEditPlanName(e.target.value)}
                                                            className="w-full text-xs p-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-black/20 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                                        />
                                                        <div className="flex gap-1 justify-between items-center">
                                                            <div className="flex gap-1">
                                                                {PLAN_COLORS.slice(0, 5).map(c => (
                                                                    <button 
                                                                        key={c}
                                                                        onClick={() => setEditPlanColor(c)}
                                                                        className={`size-4 rounded-full bg-${c}-500 ${editPlanColor === c ? 'ring-2 ring-offset-1 ring-gray-400 dark:ring-offset-gray-800' : 'opacity-70 hover:opacity-100'}`}
                                                                    />
                                                                ))}
                                                            </div>
                                                            <div className="flex gap-1">
                                                                <button onClick={handleSavePlanEdit} className="p-1 bg-green-500 text-white rounded hover:bg-green-600"><span className="material-symbols-outlined text-[14px]">check</span></button>
                                                                <button onClick={() => setEditingPlanId(null)} className="p-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"><span className="material-symbols-outlined text-[14px]">close</span></button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-between w-full">
                                                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                                                            {currentPlanId === plan.id && <div className={`w-1 h-6 bg-${pColor}-500 rounded-full`}></div>}
                                                            <span className={`material-symbols-outlined text-[16px] ${currentPlanId === plan.id ? `text-${pColor}-500` : 'text-gray-300'}`}>
                                                                {currentPlanId === plan.id ? 'radio_button_checked' : 'radio_button_unchecked'}
                                                            </span>
                                                            <span className={`text-sm truncate ${currentPlanId === plan.id ? `font-bold text-${pColor}-600 dark:text-${pColor}-400` : 'text-gray-600 dark:text-gray-300'}`}>
                                                                {plan.name}
                                                            </span>
                                                        </div>
                                                        
                                                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                                             <button 
                                                                onClick={(e) => handleStartEditingPlan(plan, e)}
                                                                className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                                                title="Editar nome/cor"
                                                            >
                                                                <span className="material-symbols-outlined text-[14px]">edit</span>
                                                            </button>
                                                            {plans.length > 1 && (
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (onDeletePlan) onDeletePlan(plan.id);
                                                                    }}
                                                                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                                                    title="Apagar plano"
                                                                >
                                                                    <span className="material-symbols-outlined text-[14px]">delete</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="p-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-black/20">
                                    {isAddingPlan ? (
                                        <form onSubmit={handleCreatePlan} className="flex flex-col gap-2">
                                            <input 
                                                autoFocus
                                                type="text" 
                                                value={newPlanName}
                                                onChange={(e) => setNewPlanName(e.target.value)}
                                                placeholder="Nome (ex: TJ-SP)"
                                                className="w-full text-xs p-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-black/20 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                            />
                                            <div className="flex gap-2">
                                                <button type="submit" disabled={!newPlanName.trim()} className="flex-1 bg-primary text-white text-[10px] font-bold py-1.5 rounded hover:bg-blue-600 disabled:opacity-50">Criar</button>
                                                <button type="button" onClick={() => setIsAddingPlan(false)} className="px-2 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-bold rounded hover:bg-gray-300">X</button>
                                            </div>
                                        </form>
                                    ) : (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsAddingPlan(true);
                                            }}
                                            className="w-full flex items-center gap-2 p-2 rounded text-sm text-gray-500 hover:text-primary hover:bg-white dark:hover:bg-white/10 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">add_circle</span>
                                            <span>Novo Plano</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex flex-col gap-2">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.id)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all w-full text-left ${
                                    currentScreen === item.id
                                        ? `bg-${activeColor}-50 dark:bg-${activeColor}-900/20 text-${activeColor}-600 dark:text-${activeColor}-400`
                                        : 'text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-white/5 hover:text-text-primary-light dark:hover:text-text-primary-dark'
                                }`}
                            >
                                <span className={`material-symbols-outlined text-[24px] ${currentScreen === item.id ? 'fill' : ''}`}>{item.icon}</span>
                                <p className="text-sm font-medium leading-normal">{item.label}</p>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="px-2">
                    <button 
                        onClick={() => alert("Funcionalidade de sair seria implementada aqui.")}
                        className="flex items-center gap-3 px-3 py-2 w-full text-left rounded-lg text-text-secondary-light dark:text-text-secondary-dark hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 transition-all"
                    >
                        <span className="material-symbols-outlined text-[24px]">logout</span>
                        <p className="text-sm font-medium leading-normal">Sair</p>
                    </button>
                </div>
            </div>
        </aside>
    );
};