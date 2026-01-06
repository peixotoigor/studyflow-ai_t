import React from 'react';
import { Screen } from '../types';

interface BottomNavigationProps {
    currentScreen: Screen;
    onNavigate: (screen: Screen) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ currentScreen, onNavigate }) => {
    const navItems = [
        { id: Screen.DASHBOARD, label: 'Início', icon: 'dashboard' },
        { id: Screen.DYNAMIC_SCHEDULE, label: 'Plano', icon: 'calendar_month' },
        { id: Screen.STUDY_PLAYER, label: 'Foco', icon: 'play_circle' },
        { id: Screen.SAVED_NOTES, label: 'Insights', icon: 'lightbulb' }, // Novo item
        { id: Screen.SUBJECTS, label: 'Matérias', icon: 'menu_book' },
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1a1a2e] border-t border-border-light dark:border-border-dark z-40 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="flex justify-around items-center h-16">
                {navItems.map(item => {
                    const isActive = currentScreen === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            className={`flex flex-col items-center justify-center w-full h-full gap-1 active:scale-95 transition-transform ${
                                isActive 
                                    ? 'text-primary' 
                                    : 'text-text-secondary-light dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary'
                            }`}
                        >
                            <div className={`relative px-4 py-1 rounded-full transition-colors ${isActive ? 'bg-primary/10' : ''}`}>
                                <span className={`material-symbols-outlined text-[24px] ${isActive ? 'fill' : ''}`}>
                                    {item.icon}
                                </span>
                            </div>
                            <span className="text-[10px] font-medium leading-none">{item.label}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    );
};