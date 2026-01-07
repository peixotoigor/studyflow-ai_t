import React, { useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Subject, ImporterState, SyllabusData } from '../types';

// Função auxiliar para garantir acesso correto à biblioteca independente do ambiente de build
const getPdfJs = () => {
    const lib = (pdfjsLib as any).default || pdfjsLib;
    // Configurar worker se ainda não estiver configurado
    if (!lib.GlobalWorkerOptions.workerSrc) {
        lib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs';
    }
    return lib;
};

// Paleta para distribuição automática no importador
const IMPORT_COLORS = [
    'blue', 'orange', 'green', 'purple', 'red', 'teal', 'pink', 'indigo', 'cyan', 'rose', 'violet', 'emerald', 'amber', 'fuchsia', 'sky', 'lime'
];

interface ImporterProps {
    apiKey?: string;
    model?: string;
    onImport?: (subjects: Subject[]) => void;
    state: ImporterState;
    setState: React.Dispatch<React.SetStateAction<ImporterState>>;
}

export const Importer: React.FC<ImporterProps> = ({ apiKey, model = 'gpt-4o-mini', onImport, state, setState }) => {
    const { step, fileName, processingStatus, progress, syllabus, selectedSubjects } = state;
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Configuração inicial do worker ao montar o componente
    useEffect(() => {
        try {
            const lib = getPdfJs();
            console.log("PDF.js inicializado", lib.version);
        } catch (e) {
            console.error("Erro ao inicializar PDF.js", e);
        }
    }, []);

    // Função para extrair texto do PDF (limite de 100 páginas)
    const extractTextFromPdf = async (file: File): Promise<string> => {
        const lib = getPdfJs();
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        
        try {
            const loadingTask = lib.getDocument({ data });
            
            // Tratamento específico para Senha e Erros de Carregamento
            loadingTask.onPassword = (updatePassword: any, reason: any) => {
                throw new Error("O arquivo PDF está protegido por senha. Por favor, remova a proteção antes de importar.");
            };

            const pdf = await loadingTask.promise;
            const maxPages = Math.min(pdf.numPages, 100); 
            let fullText = '';

            // Alocamos 40% do progresso total para a leitura do PDF
            const PROGRESS_ALLOCATION = 40;

            for (let i = 1; i <= maxPages; i++) {
                // Cálculo granular do progresso baseada na página atual
                const currentProgress = Math.round((i / maxPages) * PROGRESS_ALLOCATION);
                
                setState(prev => ({
                    ...prev, 
                    processingStatus: `Lendo página ${i} de ${maxPages}...`,
                    progress: currentProgress
                }));
                
                try {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map((item: any) => item.str).join(' ');
                    fullText += pageText + '\n';
                } catch (pageError) {
                    console.warn(`Erro ao ler página ${i}`, pageError);
                }
            }

            // Verificação de PDF Escaneado (Imagem)
            if (fullText.trim().length < 50 && pdf.numPages > 0) {
                 throw new Error("O texto extraído é muito curto. O PDF parece ser uma imagem escaneada (sem OCR). Este importador requer PDFs com texto selecionável.");
            }

            return fullText;
        } catch (e: any) {
            console.error("Erro interno no PDF.js:", e);
            if (e.name === 'PasswordException' || e.message.includes('password')) {
                throw new Error("O arquivo PDF está protegido por senha.");
            }
            if (e.name === 'InvalidPDFException') {
                throw new Error("O arquivo parece estar corrompido ou não é um PDF válido.");
            }
            throw new Error(e.message || "Falha ao ler o arquivo PDF.");
        }
    };

    const processFile = async (file: File) => {
        if (!apiKey) {
            alert("Por favor, configure sua OpenAI API Key no perfil antes de importar.");
            return;
        }

        const cleanApiKey = apiKey.trim().replace(/[^\x00-\x7F]/g, "");

        setState(prev => ({
            ...prev,
            step: 'PROCESSING',
            fileName: file.name,
            processingStatus: 'Inicializando leitura do PDF...',
            progress: 0
        }));

        try {
            // 1. Extração do PDF (Vai de 0% a 40%)
            const fullText = await extractTextFromPdf(file);
            
            // =================================================================================
            // ETAPA 1: FILTRAGEM DE CONTEXTO (Locating the Syllabus)
            // =================================================================================
            setState(prev => ({
                ...prev,
                processingStatus: 'Analisando edital e localizando conteúdo...',
                progress: 45 // Avança um pouco após a leitura
            }));

            const filterPrompt = `
                Analise o documento fornecido. Sua ÚNICA tarefa é encontrar e retornar o texto referente ao "CONTEÚDO PROGRAMÁTICO" (Syllabus) ou "ANEXO DE DISCIPLINAS".
                
                Regras:
                1. O documento é um edital longo. Ignore regras de inscrição, datas, isenções, etc.
                2. Vá direto para a parte onde as matérias (Português, Direito, etc.) são listadas.
                3. Se houver múltiplos cargos, identifique o cargo de NÍVEL SUPERIOR ou o primeiro cargo listado que tenha um conteúdo completo e RETORNE O CONTEÚDO DELE.
                4. Retorne APENAS o texto bruto dessa seção, do início ao fim das disciplinas. Não formate, não resuma. Quero o texto original recortado.
            `;

            // Limite de caracteres para evitar "Failed to fetch" por payload excessivo
            const MAX_CHARS_FOR_FILTER = 150000;
            const textForFilter = fullText.substring(0, MAX_CHARS_FOR_FILTER);

            const filterResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cleanApiKey}`
                },
                body: JSON.stringify({
                    model: model, // Pode usar gpt-4o-mini aqui pois é tarefa de leitura extensa
                    messages: [
                        { role: "system", content: "Você é um assistente especialista em filtrar textos de editais." },
                        { role: "user", content: filterPrompt + "\n\n--- DOCUMENTO ---\n" + textForFilter }
                    ],
                    temperature: 0.1
                })
            });

            if (!filterResponse.ok) {
                const errorBody = await filterResponse.text();
                throw new Error(`Erro API (${filterResponse.status}): ${errorBody}`);
            }
            
            const filterData = await filterResponse.json();
            const relevantText = filterData.choices?.[0]?.message?.content;

            if (!relevantText || relevantText.length < 100) {
                console.warn("IA não encontrou seção específica, usando texto completo.");
                // Fallback: se a IA não achar nada específico, usamos o texto todo, mas cortado
            } else {
                console.log("Contexto isolado com sucesso. Tamanho:", relevantText.length);
            }

            const textToProcess = (relevantText && relevantText.length > 100) ? relevantText : fullText.substring(0, 50000);

            // =================================================================================
            // ETAPA 2: ESTRUTURAÇÃO (JSON Extraction)
            // =================================================================================
            setState(prev => ({
                ...prev,
                processingStatus: 'Estruturando disciplinas e tópicos (Isso pode levar alguns segundos)...',
                progress: 75 // Salto significativo após localizar o texto
            }));

            const extractionPrompt = `
                Com base no texto recortado do edital abaixo, extraia o conteúdo programático estruturado.
                
                CRITÉRIOS RIGOROSOS DE EXTRAÇÃO:
                1. Identifique o Cargo (se mencionado no texto).
                2. Separe TODAS as disciplinas encontradas (Ex: Português, Informática, Dir. Constitucional, etc).
                3. DENTRO DE CADA DISCIPLINA:
                   - O texto costuma vir em blocos densos (ex: "Conceito de ADM; Poderes; Atos.").
                   - VOCÊ DEVE QUEBRAR ESSES BLOCOS EM UMA LISTA DE TÓPICOS INDIVIDUAIS.
                   - Use pontuação (., ;) para separar os itens.
                
                Saída OBRIGATÓRIA em JSON:
                {
                    "cargo": "Nome do Cargo",
                    "categorias": [
                        {
                            "nome": "Conhecimentos Gerais",
                            "disciplinas": [
                                { "nome": "Língua Portuguesa", "topicos": ["Interpretação", "Gramática", "..."] }
                            ]
                        },
                        {
                            "nome": "Conhecimentos Específicos",
                            "disciplinas": [
                                { "nome": "Nome da Disciplina", "topicos": ["Tópico 1", "Tópico 2", "..."] }
                            ]
                        }
                    ]
                }
                
                Se não houver distinção explícita de Gerais/Específicos, coloque tudo em "Conteúdo Programático".
            `;

            const structureResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cleanApiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: "system", content: "Você é um extrator JSON preciso." },
                        { role: "user", content: extractionPrompt + "\n\n--- TEXTO DO CONTEÚDO ---\n" + textToProcess }
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.1
                })
            });

            if (!structureResponse.ok) throw new Error("Erro ao contatar a IA (Etapa de Estruturação).");

            const structureData = await structureResponse.json();
            const aiContent = structureData.choices?.[0]?.message?.content;

            setState(prev => ({
                ...prev,
                progress: 95, // Quase lá
                processingStatus: 'Finalizando...'
            }));

            if (aiContent) {
                try {
                    const parsedData: SyllabusData = JSON.parse(aiContent);
                    
                    // Validação básica
                    if (!parsedData.categorias || !Array.isArray(parsedData.categorias)) {
                         throw new Error("JSON incompleto retornado pela IA.");
                    }

                    // Pré-selecionar todas
                    const allSubjects = new Set<string>();
                    parsedData.categorias.forEach((cat, catIdx) => {
                        cat.disciplinas.forEach((_, subIdx) => {
                            allSubjects.add(`${catIdx}-${subIdx}`);
                        });
                    });

                    setState(prev => ({
                        ...prev,
                        syllabus: parsedData,
                        selectedSubjects: allSubjects,
                        step: 'REVIEW',
                        progress: 100
                    }));
                } catch (parseError) {
                    console.error("JSON Inválido:", aiContent);
                    throw new Error("Falha ao processar o formato da resposta da IA.");
                }
            } else {
                throw new Error("A IA retornou uma resposta vazia.");
            }

        } catch (error: any) {
            console.error(error);
            let errMsg = error.message;
            if (errMsg.includes('Failed to fetch')) {
                errMsg = "Falha de Conexão (Failed to fetch). Verifique se você possui AdBlock ativo ou restrições de rede.";
            }
            alert(`Erro na Importação: ${errMsg}`);
            setState(prev => ({ 
                ...prev, 
                step: 'UPLOAD',
                processingStatus: '',
                progress: 0
            }));
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const toggleSubject = (uniqueId: string) => {
        const newSet = new Set(selectedSubjects);
        if (newSet.has(uniqueId)) {
            newSet.delete(uniqueId);
        } else {
            newSet.add(uniqueId);
        }
        setState(prev => ({ ...prev, selectedSubjects: newSet }));
    };

    const toggleCategory = (catIdx: number, select: boolean) => {
        const newSet = new Set(selectedSubjects);
        syllabus?.categorias[catIdx].disciplinas.forEach((_, subIdx) => {
            const id = `${catIdx}-${subIdx}`;
            if (select) newSet.add(id);
            else newSet.delete(id);
        });
        setState(prev => ({ ...prev, selectedSubjects: newSet }));
    };

    const handleFinalImport = () => {
        if (!syllabus || !onImport) return;

        const newSubjects: Subject[] = [];
        let globalSubjectIndex = 0; 
        
        // Embaralha a paleta para garantir variedade única a cada importação
        const shuffledPalette = [...IMPORT_COLORS].sort(() => Math.random() - 0.5);

        syllabus.categorias.forEach((cat, catIdx) => {
            cat.disciplinas.forEach((sub, subIdx) => {
                const uniqueId = `${catIdx}-${subIdx}`;
                
                if (selectedSubjects.has(uniqueId)) {
                    // Determinar prioridade baseada na categoria
                    const isSpecific = cat.nome.toLowerCase().includes('específico') || cat.nome.toLowerCase().includes('especial');
                    const priority = isSpecific ? 'HIGH' : 'MEDIUM';
                    
                    // Cor baseada na paleta embaralhada
                    const color = shuffledPalette[globalSubjectIndex % shuffledPalette.length];
                    globalSubjectIndex++;

                    newSubjects.push({
                        id: `imported-${Date.now()}-${uniqueId}`,
                        planId: '', // Placeholder, será preenchido pelo App.tsx
                        name: sub.nome, // Opcional: `${cat.nome} - ${sub.nome}` se quiser prefixo
                        active: true,
                        color: color, 
                        priority: priority,
                        topics: sub.topicos.map((t, tIdx) => ({
                            id: `topic-${Date.now()}-${uniqueId}-${tIdx}`,
                            name: t,
                            completed: false
                        }))
                    });
                }
            });
        });

        setState(prev => ({ ...prev, step: 'SUCCESS' }));
        
        setTimeout(() => {
            onImport(newSubjects);
        }, 800);
    };

    return (
        <div className="flex-1 w-full max-w-[1600px] mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-65px)] overflow-hidden">
            <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto h-full pr-2">
                <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark p-5">
                    <h1 className="text-xl font-black leading-tight tracking-tight text-text-primary-light dark:text-white mb-2">Importador Inteligente</h1>
                    <p className="text-text-secondary-light dark:text-gray-400 text-xs leading-relaxed">
                        Sistema de análise em duas etapas: 1. Localização do conteúdo no PDF. 2. Estruturação detalhada de disciplinas e tópicos.
                    </p>
                </div>
                
                {/* Upload Area */}
                {step === 'UPLOAD' && (
                    <div 
                        className="flex-1 bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border-2 border-dashed border-border-light dark:border-border-dark hover:border-primary/50 transition-colors flex flex-col items-center justify-center p-8 text-center cursor-pointer min-h-[300px]"
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="application/pdf"
                            onChange={handleFileChange}
                        />
                        <div className="bg-primary/10 p-4 rounded-full mb-4">
                            <span className="material-symbols-outlined text-primary text-4xl">upload_file</span>
                        </div>
                        <h3 className="text-lg font-bold text-text-primary-light dark:text-white">Upload do Edital (PDF)</h3>
                        <p className="text-sm text-text-secondary-light dark:text-gray-400 mt-2">
                            Arraste e solte ou clique para selecionar.
                        </p>
                        {!apiKey && (
                            <p className="text-xs text-red-500 mt-4 font-bold bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full">
                                Chave OpenAI necessária (Configure no Perfil)
                            </p>
                        )}
                    </div>
                )}

                {/* Processing State */}
                {step === 'PROCESSING' && (
                    <div className="flex-1 bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
                        <div className="relative size-20 mb-6">
                            <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                                <path className="text-gray-200 dark:text-gray-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" />
                                <path className="text-primary transition-all duration-300 ease-linear" strokeDasharray={`${progress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" />
                            </svg>
                            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-bold">{progress}%</span>
                        </div>
                        <h3 className="text-lg font-bold text-text-primary-light dark:text-white mb-2">Processando...</h3>
                        <p className="text-sm text-text-secondary-light dark:text-gray-400 animate-pulse">{processingStatus}</p>
                    </div>
                )}

                {/* Status Sidebar for Review */}
                {(step === 'REVIEW' || step === 'SUCCESS') && (
                    <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark p-0 overflow-hidden flex-1">
                        <div className="p-4 border-b border-border-light dark:border-border-dark bg-gray-50/50 dark:bg-gray-900/50">
                            <h3 className="text-sm font-bold text-text-primary-light dark:text-white">Resumo da Extração</h3>
                        </div>
                        <div className="p-6">
                            <div className="flex gap-4 mb-6">
                                <div className="size-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center border-2 border-green-500 dark:border-green-500 shadow-sm flex-shrink-0">
                                    <span className="material-symbols-outlined text-sm font-bold fill">smart_toy</span>
                                </div>
                                <div className="pt-1">
                                    <p className="text-sm font-bold text-text-primary-light dark:text-gray-200">Cargo Identificado</p>
                                    <p className="text-xs text-text-secondary-light dark:text-gray-400 mt-0.5 font-semibold text-primary">{syllabus?.cargo}</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className={`size-8 rounded-full ${step === 'SUCCESS' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 border-green-500' : 'bg-primary text-white border-blue-100 dark:border-blue-900'} flex items-center justify-center border-2 shadow-sm flex-shrink-0`}>
                                    <span className="text-xs font-bold">{selectedSubjects.size}</span>
                                </div>
                                <div className="pt-1">
                                    <p className="text-sm font-bold text-text-primary-light dark:text-gray-200">Disciplinas Selecionadas</p>
                                    <p className="text-xs text-text-secondary-light dark:text-gray-400 mt-1">
                                        {step === 'SUCCESS' ? 'Importação Concluída com Sucesso!' : 'Revise a seleção ao lado.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="lg:col-span-8 flex flex-col h-full bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden relative">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-900/30">
                    <div>
                        <h2 className="text-lg font-bold text-text-primary-light dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">account_tree</span>
                            Conteúdo Estruturado
                        </h2>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 bg-background-light dark:bg-[#0c0c1d] pb-24 relative">
                    {!syllabus && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-50">
                            <span className="material-symbols-outlined text-6xl mb-2">preview</span>
                            <p>O conteúdo do edital aparecerá aqui.</p>
                        </div>
                    )}

                    {syllabus && syllabus.categorias.map((category, catIdx) => (
                        <div key={catIdx} className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="flex items-center justify-between mb-4 sticky top-0 bg-background-light/95 dark:bg-[#0c0c1d]/95 backdrop-blur z-20 py-2 border-b border-dashed border-gray-300 dark:border-gray-700">
                                <h3 className="text-lg font-black text-text-primary-light dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">
                                        {category.nome.toLowerCase().includes('específico') ? 'stars' : 'public'}
                                    </span>
                                    {category.nome}
                                </h3>
                                <div className="flex gap-2 text-xs">
                                    <button onClick={() => toggleCategory(catIdx, true)} className="hover:text-primary">Todos</button>
                                    <span className="text-gray-400">|</span>
                                    <button onClick={() => toggleCategory(catIdx, false)} className="hover:text-red-500">Nenhum</button>
                                </div>
                            </div>

                            <div className="pl-2 border-l-2 border-gray-200 dark:border-gray-800 ml-2">
                                {category.disciplinas.map((subject, subIdx) => {
                                    const uniqueId = `${catIdx}-${subIdx}`;
                                    const isSelected = selectedSubjects.has(uniqueId);
                                    
                                    return (
                                        <div key={uniqueId} className={`mb-4 group/subject transition-all ${isSelected ? 'opacity-100' : 'opacity-60'}`}>
                                            <div 
                                                className={`flex items-center gap-3 bg-white dark:bg-surface-dark border ${isSelected ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border-light dark:border-border-dark'} rounded-lg p-3 mb-2 shadow-sm hover:border-primary/50 transition-all cursor-pointer relative z-10`}
                                                onClick={() => toggleSubject(uniqueId)}
                                            >
                                                <div className={`flex items-center justify-center size-6 rounded border transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800'}`}>
                                                    {isSelected && <span className="material-symbols-outlined text-white text-sm">check</span>}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-bold text-text-primary-light dark:text-white text-sm md:text-base">{subject.nome}</h4>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-1 rounded-full">{subject.topicos.length} Tópicos</span>
                                            </div>
                                            
                                            {isSelected && (
                                                <div className="pl-9 relative flex flex-col gap-1.5 mt-2">
                                                     {subject.topicos.slice(0, 5).map((topic, tIndex) => (
                                                        <div key={tIndex} className="flex items-start gap-2 text-xs text-text-secondary-light dark:text-gray-400">
                                                            <span className="material-symbols-outlined text-[14px] text-gray-300 mt-0.5">subdirectory_arrow_right</span>
                                                            <span className="line-clamp-1">{topic}</span>
                                                        </div>
                                                     ))}
                                                     {subject.topicos.length > 5 && (
                                                         <div className="text-[10px] text-gray-400 pl-6 italic">... e mais {subject.topicos.length - 5} tópicos</div>
                                                     )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Flutuante na Área de Visualização */}
                {step === 'REVIEW' && (
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-surface-dark/90 border-t border-border-light dark:border-border-dark backdrop-blur-sm z-20 flex justify-end">
                        <button 
                            onClick={handleFinalImport}
                            className="bg-primary hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined">save_alt</span>
                            Confirmar e Importar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};