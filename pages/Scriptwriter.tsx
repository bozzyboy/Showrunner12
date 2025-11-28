import React, { useState, useEffect, useMemo } from 'react';
import { useShowrunnerStore } from '../store/showrunnerStore';
import { Episode, Act, Scene, GeminiModel, SceneAssets, Season, Sequel, ContinuityBrief } from '../types';
import { saveScript, saveContinuityBrief, loadContinuityBrief } from '../services/storageService';
import { geminiService } from '../services/geminiService';
import { EditableScreenplayViewer } from '../components/shared/Screenplay';
import { Download, Upload, Feather, BrainCircuit, RefreshCw, BotMessageSquare, User, MapPin, Package, AlertTriangle, Lock, Unlock, PlusCircle, BookLock, Sparkles, Wand2, Trash2, CheckCircle, ScanSearch, Check, Clock } from 'lucide-react';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const GlobalModelSelector: React.FC = () => {
    const { generationModel, setGenerationModel } = useShowrunnerStore();
    return (
        <div className="w-full max-w-xs">
            <label htmlFor="model-select" className="block text-sm font-medium text-primary-text mb-1">AI Model</label>
            <select
                id="model-select"
                value={generationModel}
                onChange={(e) => setGenerationModel(e.target.value as GeminiModel)}
                className="w-full bg-neutral-700 border-subtle rounded-md p-2 text-sm text-primary-text focus:ring-accent focus:border-accent"
            >
                <option value="gemini-3-pro-preview">Gemini 3.0 Pro (Complex/Reasoning)</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Standard)</option>
            </select>
        </div>
    );
};


const Scriptwriter: React.FC = () => {
    const { project, importScript } = useShowrunnerStore();
    
    if (!project) return null;
    
    const isEpisodic = project.format.type === 'EPISODIC';
    const firstItem = isEpisodic ? project.script.seasons?.[0] : project.script.sequels?.[0];
    const hasStructure = firstItem && (isEpisodic ? (firstItem as Season).episodes.length > 0 : (firstItem as Sequel).acts.length > 0);

    return (
        <div>
            <div className="flex justify-between items-center mb-2">
                <h1 className="text-3xl font-black text-primary">Scriptwriter</h1>
                <div className="flex gap-2">
                    <button onClick={() => project && saveScript(project)} disabled={!project.script} className="flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-panel text-primary-text rounded-md hover:bg-subtle transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        <Download size={14} /> Save .script
                    </button>
                    <button onClick={importScript} className="flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-panel text-primary-text rounded-md hover:bg-subtle transition-colors">
                        <Upload size={14} /> Load .script
                    </button>
                </div>
            </div>
            {hasStructure ? <ScriptEditor /> : <GenesisWorkflow />}
        </div>
    );
};

const GenesisWorkflow: React.FC = () => {
    const { project, updateSynopsis, setGeneratedStructure, generationModel } = useShowrunnerStore();
    const [loading, setLoading] = useState<null | 'synopsis' | 'structure'>(null);
    const [error, setError] = useState<string | null>(null);

    if (!project) return null;
    
    const isSynopsisGenerated = !!project.bible.synopsis;

    const handleGenerateSynopsis = async () => {
        setLoading('synopsis');
        setError(null);
        try {
            const newSynopsis = await geminiService.generateSynopsis(project, generationModel);
            if (!newSynopsis) throw new Error("The AI returned an empty synopsis.");
            updateSynopsis(newSynopsis);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setLoading(null);
        }
    };

    const handleGenerateStructure = async () => {
        setLoading('structure');
        setError(null);
        try {
            const newStructure = await geminiService.generateInitialStructure(project, generationModel);
            if (!newStructure || newStructure.length === 0) throw new Error("The AI failed to generate a script structure.");
            setGeneratedStructure(newStructure);
        } catch (err) {
             setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="mt-6">
            <p className="text-muted max-w-3xl mb-8">
                Welcome to the Scriptwriter. First, let's create the narrative foundation for your project.
            </p>
            <div className="mb-8">
                <GlobalModelSelector />
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300">
                    <p className="font-bold">Generation Failed</p>
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {/* Step 1: Synopsis */}
            <div className="bg-surface border border-subtle rounded-xl p-6 mb-6">
                <h3 className="text-lg font-bold text-primary mb-2">Step 1: Create the Synopsis</h3>
                <p className="text-sm text-muted mb-4">Let's expand your logline into a full synopsis. You can generate one with AI and then edit it to perfection.</p>
                
                <textarea
                    value={project.bible.synopsis || project.logline}
                    onChange={(e) => updateSynopsis(e.target.value)}
                    rows={isSynopsisGenerated ? 8 : 2}
                    placeholder="Enter your synopsis here or generate one from your logline..."
                    className="w-full bg-panel border-subtle rounded-md p-3 text-primary-text focus:ring-accent focus:border-accent"
                    disabled={loading === 'synopsis' || loading === 'structure'}
                />
                <button 
                    onClick={handleGenerateSynopsis} 
                    disabled={loading === 'synopsis' || loading === 'structure'} 
                    className={`flex items-center justify-center gap-2 mt-4 px-5 py-2 text-sm font-bold rounded-md transition-colors disabled:bg-neutral-600 disabled:text-neutral-400 disabled:cursor-wait ${
                        isSynopsisGenerated 
                        ? 'bg-panel text-primary-text hover:bg-subtle' 
                        : 'text-neutral-900 bg-primary hover:bg-slate-200'
                    }`}
                >
                    {loading === 'synopsis' ? (
                        <><BrainCircuit className="animate-spin h-5 w-5 mr-2" /> Generating...</>
                    ) : isSynopsisGenerated ? (
                        <><RefreshCw size={14} className="mr-1"/> Regenerate Synopsis</>
                    ) : (
                        "Generate Synopsis"
                    )}
                </button>
            </div>

            {/* Step 2: Structure */}
            <div className={`bg-surface border border-subtle rounded-xl p-6 transition-opacity ${!isSynopsisGenerated || loading === 'synopsis' ? 'opacity-40' : ''}`}>
                <h3 className="text-lg font-bold text-primary mb-2">Step 2: Outline the Initial Script Structure</h3>
                <p className="text-sm text-muted mb-4">Once you're happy with the synopsis, the AI will create a high-level structure for your first season or story, broken into acts or episodes.</p>
                <button onClick={handleGenerateStructure} disabled={!isSynopsisGenerated || loading === 'structure' || loading === 'synopsis'} className="flex items-center justify-center gap-2 px-5 py-2 text-sm font-bold text-neutral-900 bg-primary rounded-md hover:bg-slate-200 disabled:bg-neutral-600 disabled:text-neutral-400 disabled:cursor-wait">
                    {loading === 'structure' ? <><BrainCircuit className="animate-spin h-5 w-5 mr-2" /> Generating...</> : "Generate Structure from Synopsis"}
                </button>
            </div>
        </div>
    );
};


const ScriptEditor: React.FC = () => {
    const { project, addSeason, addSequel, deleteSeason, deleteSequel } = useShowrunnerStore();
    const isEpisodic = project!.format.type === 'EPISODIC';
    const items = isEpisodic ? (project!.script.seasons || []) : (project!.script.sequels || []);
    const [activeTabId, setActiveTabId] = useState(items[0]?.id);
    
    useEffect(() => {
        if (items.length > 0 && !items.some(item => item.id === activeTabId)) {
            setActiveTabId(items[0]?.id);
        }
    }, [items, activeTabId]);


    if (!project) return null;

    const activeItem = items.find(item => item.id === activeTabId);

    const handleAddItem = () => {
        if(isEpisodic) {
            addSeason();
        } else {
            addSequel();
        }
    }
    
    const handleDeleteItem = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm("Are you sure you want to delete this entire season/part? All episodes/acts within it will be lost.")) {
            if (isEpisodic) {
                deleteSeason(id);
            } else {
                deleteSequel(id);
            }
        }
    }
    
    const canAddNextInstallment = () => {
        if (items.length === 0) return true;
        const lastInstallment = items[items.length -1];
        return !!lastInstallment.continuityBrief;
    }

    return (
        <div className="mt-8">
            <GlobalModelSelector />
            <div className="flex border-b border-subtle mt-4 items-center overflow-x-auto">
                {items.map(item => {
                     const title = isEpisodic ? `Season ${(item as Season).seasonNumber}` : `Part ${(item as Sequel).partNumber}`;
                     const isLocked = item.isLocked;
                     const isActive = activeTabId === item.id;
                     return (
                         <div key={item.id} className={`flex items-center group border-b-2 px-2 transition-colors ${isActive ? 'border-primary' : 'border-transparent hover:border-subtle'}`}>
                            <button 
                                onClick={() => setActiveTabId(item.id)} 
                                className={`flex items-center gap-2 px-2 py-2 text-sm font-medium ${isActive ? 'text-primary' : 'text-muted hover:text-primary-text'} ${isLocked ? 'text-red-400 hover:text-red-300' : ''}`}
                            >
                               {isLocked && <Lock size={12}/>} {title}
                            </button>
                            {isActive && (
                                <button onClick={(e) => handleDeleteItem(e, item.id)} className="p-1 ml-1 text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 size={12} />
                                </button>
                            )}
                         </div>
                     );
                })}
                 <div className="relative group">
                    <button 
                        onClick={handleAddItem} 
                        disabled={!canAddNextInstallment()}
                        className="ml-2 px-3 py-2 text-sm font-medium text-muted hover:text-primary-text rounded-md hover:bg-panel flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                        <PlusCircle size={14}/>
                    </button>
                    {!canAddNextInstallment() && (
                        <div className="absolute left-0 bottom-full mb-2 w-48 p-2 text-xs bg-panel border border-subtle rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                           Generate a Continuity Brief for the previous installment to add a new one.
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-6">
                {activeItem && <InstallmentView key={activeItem.id} installment={activeItem} allInstallments={items} />}
            </div>
        </div>
    )
};

const InstallmentView: React.FC<{ installment: Season | Sequel, allInstallments: (Season[] | Sequel[]) }> = ({ installment, allInstallments }) => {
    const { project, toggleInstallmentLock, generationModel, updateContinuityBrief, addEpisodeToSeason, addActToSequel, updateContinuityBrief: updateBriefInStore } = useShowrunnerStore();
    const [isLoading, setIsLoading] = useState<{brief?: boolean, newItem?: boolean}>({});
    const [error, setError] = useState<{brief?: string, newItem?: string}>({});

    if (!project) return null;

    const isEpisodic = 'episodes' in installment;
    const childItems = isEpisodic ? installment.episodes : installment.acts;

    const areAllScenesWritten = (installment: Season | Sequel): boolean => {
        const items = 'episodes' in installment ? installment.episodes : installment.acts;
        if (items.length === 0) return false;
        return items.every(item => 
            item.scenes.length > 0 && item.scenes.every(scene => scene.content.length > 0)
        );
    };

    const isLastChildItemComplete = () => {
        if (childItems.length === 0) return true;
        const lastChild = childItems[childItems.length - 1];
        if (lastChild.scenes.length === 0) return false;
        return lastChild.scenes.every(scene => scene.content.length > 0);
    }
    
    const isReadyForNewItem = useMemo(() => {
        // If it's the first item of this installment
        if (childItems.length === 0) {
            const currentInstallmentIndex = allInstallments.findIndex(i => i.id === installment.id);
            // If it's the very first season/sequel of the project, it's ready.
            if (currentInstallmentIndex === 0) return true;
            // Otherwise, it depends on the previous installment's brief.
            const previousInstallment = allInstallments[currentInstallmentIndex - 1];
            return !!previousInstallment?.continuityBrief;
        }
        // For subsequent items, it depends on the completeness of the last item.
        return isLastChildItemComplete();
    }, [childItems, installment, allInstallments]);


    const isInstallmentComplete = areAllScenesWritten(installment);

    const handleGenerateBrief = async () => {
        setIsLoading(prev => ({...prev, brief: true}));
        setError(prev => ({...prev, brief: undefined}));
        try {
            const briefData = await geminiService.generateContinuityBrief(installment, project, generationModel);
            updateContinuityBrief(installment.id, briefData);
        } catch (err: any) {
            setError(prev => ({...prev, brief: err.message}));
        } finally {
            setIsLoading(prev => ({...prev, brief: false}));
        }
    };
    
    const handleBriefChange = (field: keyof Omit<ContinuityBrief, 'id' | 'isLocked' | 'projectId' | 'installmentId' | 'installmentTitle' | 'generatedAt'>, value: string | string[]) => {
        updateContinuityBrief(installment.id, { [field]: value });
    }

    const handleLoadBrief = async () => {
        try {
            const brief = await loadContinuityBrief();
            if (!brief) return;

            if (brief.projectId !== project.metadata.id) {
                alert("Error: This Continuity Brief belongs to a different project.");
                return;
            }
            if (brief.installmentId !== installment.id) {
                alert(`Warning: This brief is for "${brief.installmentTitle}", not the current "${installment.title}". Loading anyway.`);
            }
            // We don't want to overwrite the existing ID or lock status from the file, just the content
            const { id, isLocked, ...briefData } = brief;
            updateBriefInStore(installment.id, briefData);
        } catch(err) {
            console.warn("User cancelled file load or an error occurred.", err);
        }
    }

    const handleAddItem = async () => {
        setIsLoading(prev => ({...prev, newItem: true}));
        setError(prev => ({...prev, newItem: undefined}));

        try {
            let briefForGeneration: ContinuityBrief | undefined | null = null;
            // If we are generating the VERY FIRST item in this installment...
            if (childItems.length === 0) {
                const currentInstallmentIndex = allInstallments.findIndex(i => i.id === installment.id);
                // ...and it's not the first installment of the whole project...
                if (currentInstallmentIndex > 0) {
                    // ...then we need the brief from the PREVIOUS installment.
                    const previousInstallment = allInstallments[currentInstallmentIndex - 1];
                    briefForGeneration = previousInstallment.continuityBrief;
                }
            }
            // For all subsequent items (Ep2, Ep3...), we pass no brief. The AI will use the previous episode summaries.
            
            const result = await geminiService.generateNextItemSynopsis(project, installment, generationModel, briefForGeneration);
            if (isEpisodic) {
                addEpisodeToSeason(installment.id, { title: result.title, logline: result.logline });
            } else {
                addActToSequel(installment.id, { title: result.title, summary: result.summary });
            }
        } catch(err: any) {
            setError(prev => ({...prev, newItem: err.message}));
        } finally {
            setIsLoading(prev => ({...prev, newItem: false}));
        }
    };

    return (
        <div>
            {/* Header and Lock */}
            <div className="flex justify-between items-center mb-6 bg-surface border border-subtle rounded-xl p-4">
                <div>
                     <h2 className="text-2xl font-black text-primary">{installment.title}</h2>
                     <p className="text-sm text-muted">{isEpisodic ? installment.logline : installment.summary}</p>
                </div>
                <button onClick={() => toggleInstallmentLock(installment.id)} className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${installment.isLocked ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'}`}>
                    {installment.isLocked ? <><Lock size={14} /> Locked</> : <><Unlock size={14} /> Unlocked</>}
                </button>
            </div>

            {/* Continuity Brief */}
            <div className="bg-surface border border-subtle rounded-xl p-6 mb-6">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-primary flex items-center gap-2"><BookLock size={20}/> Continuity Brief</h3>
                        <p className="text-sm text-muted mt-2 max-w-3xl">
                            This brief acts as the AI's "memory" for the *next* season/sequel. Generate it after this installment is complete to ensure narrative consistency.
                            {!isInstallmentComplete && <span className="block font-semibold text-amber-400/80 mt-1">All scenes in this installment must be written first.</span>}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={handleGenerateBrief} disabled={!isInstallmentComplete || isLoading.brief || installment.isLocked} className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-bold text-neutral-900 bg-primary rounded-md hover:bg-slate-200 disabled:bg-neutral-600 disabled:text-neutral-400 disabled:cursor-not-allowed">
                             {isLoading.brief ? <><BrainCircuit className="animate-spin h-4 w-4" /> Generating...</> : <><Sparkles size={14}/> Generate Brief</>}
                        </button>
                        <button onClick={() => saveContinuityBrief(project, installment)} disabled={!installment.continuityBrief} title="Save Brief" className="p-2 text-xs font-semibold bg-panel text-primary-text rounded-md hover:bg-subtle transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <Download size={14} />
                        </button>
                        <button onClick={handleLoadBrief} title="Load Brief" className="p-2 text-xs font-semibold bg-panel text-primary-text rounded-md hover:bg-subtle transition-colors">
                            <Upload size={14} />
                        </button>
                    </div>
                </div>

                {error.brief && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">{error.brief}</div>}
                
                {installment.continuityBrief || isLoading.brief ? (
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-semibold text-primary-text">Summary</label>
                            <textarea value={installment.continuityBrief?.summary || ''} onChange={(e) => handleBriefChange('summary', e.target.value)} rows={3} readOnly={installment.isLocked} className="mt-1 w-full bg-panel border-subtle rounded-md p-2 text-sm text-primary-text read-only:bg-neutral-800" />
                        </div>
                         <div>
                            <label className="text-sm font-semibold text-primary-text">Character Resolutions</label>
                            <textarea value={(installment.continuityBrief?.characterResolutions || []).join('\n')} onChange={(e) => handleBriefChange('characterResolutions', e.target.value.split('\n'))} rows={4} placeholder="One resolution per line..." readOnly={installment.isLocked} className="mt-1 w-full bg-panel border-subtle rounded-md p-2 text-sm text-primary-text read-only:bg-neutral-800" />
                        </div>
                         <div>
                            <label className="text-sm font-semibold text-primary-text">World State Changes</label>
                            <textarea value={(installment.continuityBrief?.worldStateChanges || []).join('\n')} onChange={(e) => handleBriefChange('worldStateChanges', e.target.value.split('\n'))} rows={3} placeholder="One change per line..." readOnly={installment.isLocked} className="mt-1 w-full bg-panel border-subtle rounded-md p-2 text-sm text-primary-text read-only:bg-neutral-800" />
                        </div>
                         <div>
                            <label className="text-sm font-semibold text-primary-text">Lingering Hooks</label>
                            <textarea value={(installment.continuityBrief?.lingeringHooks || []).join('\n')} onChange={(e) => handleBriefChange('lingeringHooks', e.target.value.split('\n'))} rows={3} placeholder="One hook per line..." readOnly={installment.isLocked} className="mt-1 w-full bg-panel border-subtle rounded-md p-2 text-sm text-primary-text read-only:bg-neutral-800" />
                        </div>
                    </div>
                ) : <p className="text-muted text-center py-4">No continuity brief has been generated for this installment yet.</p>}
            </div>


            {/* Episodes/Acts */}
            <div className="space-y-4">
                {childItems.map(item => <EpisodeActCard key={item.id} item={item} parentInstallment={installment} isParentLocked={installment.isLocked} />)}
                <div className="p-4 border-2 border-dashed border-subtle rounded-lg">
                    <button onClick={handleAddItem} disabled={!isReadyForNewItem || isLoading.newItem || installment.isLocked} className="w-full flex items-center justify-center gap-2 p-4 text-sm font-semibold text-muted bg-panel rounded-lg hover:bg-surface hover:text-primary-text hover:border-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        {isLoading.newItem ? <><BrainCircuit size={16} className="animate-spin"/> Generating Next...</> : <><PlusCircle size={16} /> Add {isEpisodic ? 'Episode' : 'Act'}</>}
                    </button>
                    {installment.isLocked && <p className="text-xs text-red-400/70 text-center mt-2">This {isEpisodic ? 'season' : 'part'} is locked. No new content can be added.</p>}
                    {!installment.isLocked && !isReadyForNewItem && childItems.length > 0 && <p className="text-xs text-amber-400/70 text-center mt-2">You must write all scenes in the previous {isEpisodic ? 'episode' : 'act'} before adding a new one.</p>}
                    {!installment.isLocked && !isReadyForNewItem && childItems.length === 0 && <p className="text-xs text-amber-400/70 text-center mt-2">A Continuity Brief must be generated for the previous {isEpisodic ? 'season' : 'part'} before starting this one.</p>}
                    {error.newItem && <p className="text-xs text-red-400/70 text-center mt-2">{error.newItem}</p>}
                </div>
            </div>
        </div>
    );
};

interface EpisodeActCardProps {
    item: Episode | Act;
    parentInstallment: Season | Sequel;
    isParentLocked: boolean;
}

const EpisodeActCard: React.FC<EpisodeActCardProps> = ({ item, parentInstallment, isParentLocked }) => {
    const { 
        project, generationModel, setAllScreenplaysForItem, setAnalyzedAssets,
        setScenesForItem, updateEpisode, updateAct, deleteEpisodeFromSeason, deleteActFromSequel,
        updateSceneSummary, lockSceneSummaries, toggleSceneContentLock, approveEpisodeActScreenplay
    } = useShowrunnerStore();
    const [isWriting, setIsWriting] = useState(false);
    const [writingError, setWritingError] = useState<string|null>(null);
    const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [sceneGenError, setSceneGenError] = useState<string | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    if (!project) return null;
    
    const isEpisodic = 'logline' in item;

    // Helper to calculate estimated runtime or show target
    const getEstimatedDuration = (item: Episode | Act, projectFormat: any) => {
        // 1. Calculate from written script if available
        let wordCount = 0;
        let hasContent = false;
        item.scenes.forEach(s => {
            s.content.forEach(c => {
                 wordCount += c.text.split(' ').length;
                 hasContent = true;
            });
        });

        if (hasContent) {
            // approx 180 words per minute for mixed action/dialogue (a bit faster than 150 normal speech to account for action lines)
            const minutes = Math.max(1, Math.round(wordCount / 180));
            return `Est. Runtime: ~${minutes} min${minutes !== 1 ? 's' : ''}`;
        }

        // 2. Fallback to Target Duration
        if (projectFormat.type === 'EPISODIC') {
             const epCount = projectFormat.episodeCount || 8;
             const target = Math.floor(parseInt(projectFormat.duration || '22') / 1); // User sets per ep duration in wizard for episodic, so just use it.
             // Wait, user inputs "duration" in wizard. 
             // If Episodic, wizard asks "Duration (mins)". Usually per episode.
             return `Target: ${projectFormat.duration} mins`;
        } else {
             // Single story split into acts. Total duration / count.
             const total = parseInt(projectFormat.duration) || 90;
             const actDuration = Math.round(total / (projectFormat.episodeCount || 3));
             return `Target: ~${actDuration} mins`;
        }
    }

    const durationLabel = getEstimatedDuration(item, project.format);

    const handleSynopsisUpdate = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (isEpisodic) {
            updateEpisode(item.id, { logline: e.target.value });
        } else {
            updateAct(item.id, { summary: e.target.value });
        }
    };

    const handleGenerateScenes = async () => {
        setIsGeneratingScenes(true);
        setSceneGenError(null);
        try {
            const newScenes = await geminiService.generateSceneSummariesForItem(item, project, generationModel);
            setScenesForItem(item.id, newScenes);
        } catch (err: any) {
            setSceneGenError(err.message);
        } finally {
            setIsGeneratingScenes(false);
        }
    };

    const handleDeleteSelf = () => {
        const itemType = isEpisodic ? 'episode' : 'act';
        if (window.confirm(`Are you sure you want to delete this ${itemType}? This action cannot be undone.`)) {
            if (isEpisodic) {
                deleteEpisodeFromSeason(parentInstallment.id, item.id);
            } else {
                deleteActFromSequel(parentInstallment.id, item.id);
            }
        }
    };
    
    const handleWriteAllScenes = async () => {
        setIsWriting(true);
        setWritingError(null);
        
        const scenesToWrite = item.scenes.filter(s => !s.isContentLocked);
        if (scenesToWrite.length === 0) {
             setIsWriting(false);
             alert("All scenes are locked. Unlock a scene to rewrite it.");
             return;
        }

        try {
            // Only send the unlocked scenes to the generator
            const screenplayResult = await geminiService.generateScreenplayForEpisodeOrAct(
                item, 
                project, 
                generationModel, 
                scenesToWrite.map(s => s.id)
            );

            if (!screenplayResult || screenplayResult.scenes.length === 0) {
                throw new Error("The AI returned a blank screenplay.");
            }
            // The store handles merging by ID, so we can just pass the result which only contains new scenes
            setAllScreenplaysForItem(item.id, screenplayResult);
        } catch(err: any) {
            setWritingError(err.message);
        } finally {
            setIsWriting(false);
        }
    };
    
    const handleAnalyzeAssets = async () => {
        setIsAnalyzing(true);
        setAnalysisError(null);
        try {
            // Only analyze scenes that are written
            const scenesToAnalyze = item.scenes.filter(s => s.content.length > 0);
            if (scenesToAnalyze.length === 0) {
                throw new Error("No scenes have content to analyze.");
            }
            const result = await geminiService.analyzeAssetsForEpisodeOrAct(
                item, 
                project, 
                generationModel, 
                scenesToAnalyze.map(s => s.id)
            );
            setAnalyzedAssets(item.id, result);
        } catch (err: any) {
            setAnalysisError(err.message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const allSummariesValid = item.scenes.every(s => s.summary.trim().length > 0);
    const allScenesWritten = item.sceneSummariesLocked && item.scenes.every(s => s.content.length > 0);
    const anyScenesUnlocked = item.scenes.some(s => !s.isContentLocked);

    return (
        <div className={`bg-surface border border-subtle rounded-xl p-6 ${isParentLocked ? 'opacity-70' : ''}`}>
            <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-xl font-bold text-primary">
                            {isEpisodic ? `Episode ${(item as Episode).episodeNumber}` : `Act ${(item as Act).actNumber}`}: {item.title}
                        </h3>
                         <span className="flex items-center gap-1 text-[10px] font-mono bg-panel px-2 py-0.5 rounded-full text-muted border border-subtle">
                            <Clock size={10} /> {durationLabel}
                        </span>
                    </div>
                    <p className="text-sm text-muted mt-1">{isEpisodic ? (item as Episode).logline : (item as Act).summary}</p>
                </div>
                 <div className="flex items-center gap-2">
                    {item.sceneSummariesLocked && !item.isScreenplayApproved && (
                        <button
                            onClick={handleWriteAllScenes}
                            disabled={isWriting || isParentLocked || !item.sceneSummariesLocked || !anyScenesUnlocked}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-neutral-900 bg-primary rounded-md hover:bg-slate-200 disabled:bg-neutral-600 disabled:text-neutral-400 disabled:cursor-not-allowed">
                            {isWriting ? <><BrainCircuit size={14} className="animate-spin"/> Writing...</> : <><BotMessageSquare size={14} /> Write {anyScenesUnlocked ? "Unlocked" : "All"} Scenes</>}
                        </button>
                    )}
                     <button onClick={handleDeleteSelf} disabled={isParentLocked} title={`Delete ${isEpisodic ? 'Episode' : 'Act'}`} className="p-2 text-muted hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {writingError && (
                 <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs">
                    <p><strong>Screenplay Generation Failed:</strong> {writingError}</p>
                 </div>
            )}
            
            {!item.scenes || item.scenes.length === 0 ? (
                <div>
                    <p className="text-sm text-muted mb-2">Review and edit the synopsis for this {isEpisodic ? 'episode' : 'act'}, then generate its scene breakdown.</p>
                    <textarea 
                        value={isEpisodic ? (item as Episode).logline : (item as Act).summary}
                        onChange={handleSynopsisUpdate}
                        rows={3}
                        className="w-full bg-panel border-subtle rounded-md p-2 text-sm text-primary-text focus:ring-accent focus:border-accent"
                        readOnly={isGeneratingScenes || isParentLocked}
                    />
                     <button onClick={handleGenerateScenes} disabled={isGeneratingScenes || isParentLocked} className="flex items-center justify-center gap-2 mt-2 px-4 py-2 text-sm font-bold text-neutral-900 bg-primary rounded-md hover:bg-slate-200 disabled:bg-neutral-600 disabled:text-neutral-400 disabled:cursor-wait">
                        {isGeneratingScenes ? <><BrainCircuit className="animate-spin h-5 w-5 mr-2" /> Generating...</> : <><Wand2 size={14} className="mr-1"/> Generate Scene Summaries</>}
                    </button>
                    {sceneGenError && <p className="text-xs text-red-400 mt-2">{sceneGenError}</p>}
                </div>
            ) : (
                <div className="space-y-4">
                    {item.scenes.map((scene) => {
                        const isWritten = scene.content.length > 0;
                        
                        return (
                            <div key={scene.id} className="bg-panel border border-subtle rounded-lg p-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <h4 className="font-bold text-primary-text mb-2 flex items-center gap-2">
                                            Scene {scene.sceneNumber}
                                            {scene.isContentLocked && <Lock size={12} className="text-red-400"/>}
                                        </h4>
                                        <textarea
                                            value={scene.summary}
                                            onChange={(e) => updateSceneSummary(item.id, scene.id, e.target.value)}
                                            readOnly={item.sceneSummariesLocked || isParentLocked}
                                            placeholder="Describe what happens in this scene..."
                                            rows={2}
                                            className="w-full bg-surface border-subtle rounded-md p-2 text-sm text-muted focus:ring-accent focus:border-accent read-only:bg-panel read-only:text-muted read-only:focus:ring-0 read-only:focus:border-subtle"
                                        />
                                    </div>
                                     {isWritten && (
                                        <button onClick={() => toggleSceneContentLock(item.id, scene.id)} disabled={isParentLocked || item.isScreenplayApproved} className="ml-4 p-2 text-muted hover:text-primary-text disabled:opacity-50 disabled:cursor-not-allowed">
                                            {scene.isContentLocked ? <Lock size={16} className="text-red-400" /> : <Unlock size={16} />}
                                        </button>
                                    )}
                                </div>
                                
                                {isWritten && (
                                    <div className="mt-4 border-t border-subtle pt-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="md:col-span-2">
                                                 <EditableScreenplayViewer
                                                    content={scene.content}
                                                    isEditable={!scene.isContentLocked && !isParentLocked && !item.isScreenplayApproved}
                                                    parentItemId={item.id}
                                                    sceneId={scene.id}
                                                />
                                            </div>
                                            <SceneAssetsViewer assets={scene.assets} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    <div className="flex justify-end items-center bg-panel border border-subtle rounded-lg p-2 mt-2 gap-2">
                       {!item.sceneSummariesLocked ? (
                            <button onClick={() => lockSceneSummaries(item.id)} disabled={!allSummariesValid || isParentLocked} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-neutral-900 bg-primary rounded-md hover:bg-slate-200 disabled:bg-neutral-600 disabled:text-neutral-400">
                                <CheckCircle size={14}/> Approve & Lock Summaries
                            </button>
                       ) : (
                           <>
                                <button onClick={handleAnalyzeAssets} disabled={!allScenesWritten || isAnalyzing || isParentLocked} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-neutral-900 bg-primary rounded-md hover:bg-slate-200 disabled:bg-neutral-600 disabled:text-neutral-400">
                                    {isAnalyzing ? <><BrainCircuit size={14} className="animate-spin"/> Analyzing...</> : <><ScanSearch size={14}/> Analyze Assets</>}
                                </button>
                                {!item.isScreenplayApproved && (
                                    <button onClick={() => approveEpisodeActScreenplay(item.id)} disabled={!allScenesWritten || isParentLocked} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-green-500/10 text-green-300 rounded-md hover:bg-green-500/20 disabled:bg-neutral-600 disabled:text-neutral-400">
                                        <Check size={14} /> Final Approve & Lock
                                    </button>
                                )}
                           </>
                       )}
                    </div>
                     {analysisError && (
                        <div className="mt-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs">
                           <p><strong>Asset Analysis Failed:</strong> {analysisError}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const SceneAssetsViewer: React.FC<{ assets?: SceneAssets }> = ({ assets }) => {
    if (!assets || (assets.characters.length === 0 && assets.locations.length === 0 && assets.props.length === 0)) {
        return (
            <div className="text-xs text-muted border-l border-subtle pl-4 flex items-center justify-center h-full">
                <div className="text-center">
                    <ScanSearch size={24} className="mx-auto text-subtle"/>
                    <p className="mt-2">Assets will be identified after analysis.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="text-xs border-l border-subtle pl-4 space-y-3">
             <div>
                <h5 className="font-bold text-muted flex items-center gap-1.5 mb-1"><User size={12}/> CHARACTERS</h5>
                <ul className="list-disc list-inside text-primary-text">
                    {assets.characters.map(c => <li key={c}>{c}</li>)}
                    {assets.characters.length === 0 && <li className="list-none text-muted">None</li>}
                </ul>
            </div>
            <div>
                <h5 className="font-bold text-muted flex items-center gap-1.5 mb-1"><MapPin size={12}/> LOCATIONS</h5>
                <ul className="list-disc list-inside text-primary-text">
                    {assets.locations.map(l => <li key={l}>{l}</li>)}
                     {assets.locations.length === 0 && <li className="list-none text-muted">None</li>}
                </ul>
            </div>
            <div>
                <h5 className="font-bold text-muted flex items-center gap-1.5 mb-1"><Package size={12}/> PROPS</h5>
                <ul className="list-disc list-inside text-primary-text">
                    {assets.props.map(p => <li key={p}>{p}</li>)}
                    {assets.props.length === 0 && <li className="list-none text-muted">None</li>}
                </ul>
            </div>
        </div>
    );
};


export default Scriptwriter;