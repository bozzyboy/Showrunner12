import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { debounce } from 'lodash-es';
import { 
  Project, GeminiModel, Bible, Script, Season, Sequel, Episode, Act, 
  Scene, Shot, Character, Location, Prop, ContinuityBrief, 
  CharacterProfile, AssetType, ConsistencyMode, ScreenplayItem, AssetAnalysisResult,
  StateSnapshot, LocationBaseProfile, PropBaseProfile, ShotReferenceImage,
  Studio
} from '../types';
import { saveProjectToDB, loadProjectFromDB, selectAndLoadProjectFile, selectAndLoadBible, selectAndLoadScript, selectAndLoadStudio, selectAndLoadArtDept } from '../services/storageService';
import { migrateProjectImages } from '../services/migrationService';
import { geminiService } from '../services/geminiService';

const debouncedSave = debounce((project: Project) => {
    saveProjectToDB(project);
}, 2000);

const createDefaultCharacterProfile = (name: string): CharacterProfile => ({
    name,
    coreIdentity: { name, primaryNarrativeRole: 'Unknown', fullLegalName: { first: '', middle: '', last: '' }, nicknamesAliases: [], titleHonorific: '', secondarySupportingRoles: [], characterArchetypes: [] },
    persona: { backstory: { keyChildhoodEvents: [], keyAdultEvents: [], familyDynamics: '' }, motivations: { externalGoal: '', internalNeed: '', coreDrive: '' }, fears: { surfaceFear: '', deepFear: '' } },
    vocationalProfile: { currentOccupation: '', pastOccupations: [], hardSkills: [], softSkills: [], expertiseLevel: '', credentialsAwards: [] },
    visualDna: { age: { chronological: null, apparent: '' }, ethnicCulturalBackground: { ethnicity: '', nationalityRegion: '' }, eyes: { color: '', shape: '' }, hair: { color: '', texture: '', styleCut: '' }, buildPhysique: { height: '', weightFrame: '', posture: '', distinctiveTraits: [] }, uniqueIdentifiers: { scars: [], tattoos: [], other: { birthmarks: '', piercings: [], prosthetics: '' } } },
    outfitMatrix: { signatureLook: { headwear: '', tops: '', bottoms: '', footwear: '', accessories: [] }, contextSpecificVariants: { combatAction: { description: '', notes: '' }, formalCeremonial: { description: '', notes: '' }, incognitoCasual: { description: '', notes: '' }, weatherSpecific: { description: '', notes: '' } } },
    vocalProfile: { speakingPersona: '', timbre: '', pitchRange: '', speechPatterns: '', accentDialect: '', languageFluency: { native: [], learned: [], codeSwitching: false }, voiceNotes: { timbreDescription: '', pitchNotes: '', emotionCaptured: '', accentMarkers: '', deliveryStyle: '' } },
    catchphrases: { publicTagline: '', privateMantra: '', quotationNotes: { contextsUsed: '', frequency: '', originStory: '' } },
    additionalNotes: { moodBoard: { overallAesthetic: '', colorPalette: '', atmosphere: '' }, characterTimeline: { keyDates: [], arcProgression: '', flashbackTriggers: '' }, relationshipMap: { connectionTypes: '', tensionLevels: '', secrets: '' }, locationSetting: { keyPlaces: [], emotionalAssociations: '', frequencyOfVisits: '' }, researchNotes: { historicalEra: '', culturalDeepDive: '', techSpecs: '' }, miscellaneous: { playlist: '', fanArtInspiration: '', deletedScenes: '' } }
});

const createDefaultLocationBaseProfile = (name: string): LocationBaseProfile => ({
    identity: { name },
    narrative: { description: '', vibe: '' },
    visuals: { architectureStyle: '', keyElements: [], lighting: '', visualPrompt: '' },
    audioProfile: { voiceIdentity: { timbre: '', pitch: '' }, speechPatterns: { pacing: '', idioms: [] }, signatureSounds: [], quirks: [] }
});

const createDefaultPropBaseProfile = (name: string): PropBaseProfile => ({
    identity: { name },
    narrative: { description: '' },
    visuals: { material: '', era: '', markings: [], visualPrompt: '' },
    audioProfile: { voiceIdentity: { timbre: '', pitch: '' }, speechPatterns: { pacing: '', idioms: [] }, signatureSounds: [], quirks: [] }
});

interface ShowrunnerState {
  project: Project | null;
  isLoaded: boolean;
  generationModel: GeminiModel;

  // Lifecycle
  setProject: (project: Project) => void;
  createNewProject: (params: { name: string; logline: string; format: any; style: any; supportingText?: string }) => void;
  updateProject: (updates: Partial<Project>) => void;
  updateProjectName: (name: string) => void;
  closeProject: () => void;
  loadAutosave: () => void;
  importProject: () => void;
  importBible: () => void;
  importScript: () => void;
  importStudio: () => void; 
  importArtDept: () => void;

  setGenerationModel: (model: GeminiModel) => void;
  updateSynopsis: (synopsis: string) => void;
  setGeneratedStructure: (items: (Episode | Act)[]) => void;
  populateCharacterProfile: (id: string, profile: CharacterProfile) => void;
  updateCharacter: (updates: Partial<Character> & { id: string }) => void;
  updateLocation: (updates: Partial<Location> & { id: string }) => void;
  updateProp: (updates: Partial<Prop> & { id: string }) => void;
  updateAssetConsistency: (type: AssetType, id: string, mode: ConsistencyMode) => void;
  addSeason: () => void;
  deleteSeason: (id: string) => void;
  addSequel: () => void;
  deleteSequel: (id: string) => void;
  toggleInstallmentLock: (id: string) => void;
  updateContinuityBrief: (installmentId: string, updates: Partial<ContinuityBrief>) => void;
  addEpisodeToSeason: (seasonId: string, params: { title: string; logline: string }) => void;
  addActToSequel: (sequelId: string, params: { title: string; summary: string }) => void;
  updateEpisode: (id: string, updates: Partial<Episode>) => void;
  updateAct: (id: string, updates: Partial<Act>) => void;
  deleteEpisodeFromSeason: (seasonId: string, episodeId: string) => void;
  deleteActFromSequel: (sequelId: string, actId: string) => void;
  setScenesForItem: (itemId: string, scenes: Scene[]) => void; 
  updateSceneSummary: (itemId: string, sceneId: string, summary: string) => void;
  lockSceneSummaries: (itemId: string) => void;
  toggleSceneContentLock: (itemId: string, sceneId: string) => void;
  setAllScreenplaysForItem: (itemId: string, result: { scenes: { sceneId: string; screenplay: ScreenplayItem[] }[] }) => void;
  approveEpisodeActScreenplay: (itemId: string) => void;
  addScreenplayLine: (itemId: string, sceneId: string, index: number, type: ScreenplayItem['type']) => void;
  updateScreenplayLine: (itemId: string, sceneId: string, index: number, text: string) => void;
  deleteScreenplayLine: (itemId: string, sceneId: string, index: number) => void;
  setAnalyzedAssets: (itemId: string, result: AssetAnalysisResult) => void;
  addShot: (sceneId: string) => void;
  updateShot: (sceneId: string, shotId: string, updates: Partial<Shot>) => void;
  deleteShot: (sceneId: string, shotId: string) => void; 
  generateShotsForScene: (sceneId: string) => Promise<void>;
}

export const useShowrunnerStore = create<ShowrunnerState>((set, get) => ({
  project: null,
  isLoaded: false,
  generationModel: 'gemini-2.5-flash',

  setProject: (project) => {
    set({ project, isLoaded: true });
    debouncedSave(project);
  },

  createNewProject: ({ name, logline, format, style, supportingText }) => {
    const newProject: Project = {
      metadata: {
        id: uuidv4(),
        name,
        author: 'User',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      logline,
      format,
      style,
      supportingText,
      bible: {
        synopsis: '',
        characters: [],
        locations: [],
        props: [],
        lore: {},
      },
      script: {
        seasons: format.type === 'EPISODIC' ? [] : undefined,
        sequels: format.type === 'SINGLE_STORY' ? [] : undefined,
      },
      art: {},
      studio: {
        shotsByScene: {},
      },
    };
    get().setProject(newProject);
  },

  updateProject: (updates) => {
    set((state) => {
      if (!state.project) return {};
      const updatedProject = { ...state.project, ...updates, metadata: { ...state.project.metadata, updatedAt: Date.now() } };
      debouncedSave(updatedProject);
      return { project: updatedProject };
    });
  },

  updateProjectName: (name) => {
    set((state) => {
        if (!state.project) return {};
        const updatedProject = { ...state.project, metadata: { ...state.project.metadata, name, updatedAt: Date.now() } };
        debouncedSave(updatedProject);
        return { project: updatedProject };
    });
  },

  closeProject: () => {
    set({ project: null });
  },

  loadAutosave: async () => {
    let project = await loadProjectFromDB();
    if (project) {
        project = await migrateProjectImages(project);
        set({ project, isLoaded: true });
        saveProjectToDB(project);
    } else {
        set({ isLoaded: true });
    }
  },

  importProject: async () => {
      const project = await selectAndLoadProjectFile();
      if (project) {
          const migrated = await migrateProjectImages(project);
          set({ project: migrated, isLoaded: true });
          debouncedSave(migrated);
      }
  },

  importBible: async () => {
      const bible = await selectAndLoadBible();
      if (bible) {
          const { project, updateProject } = get();
          if (project) updateProject({ bible });
      }
  },

  importScript: async () => {
      const script = await selectAndLoadScript();
      if (script) {
          const { project, updateProject } = get();
          if (project) updateProject({ script });
      }
  },

  importStudio: async () => {
      const studio = await selectAndLoadStudio();
      if (studio) {
          const { project, updateProject } = get();
          if (project) updateProject({ studio });
      }
  },

  importArtDept: async () => {
      const bible = await selectAndLoadArtDept();
      if (bible) {
           const { project, updateProject } = get();
           if (project) updateProject({ bible });
      }
  },

  setGenerationModel: (model) => set({ generationModel: model }),

  updateSynopsis: (synopsis) => {
    set((state) => {
        if (!state.project) return {};
        const updatedProject = {
            ...state.project,
            bible: { ...state.project.bible, synopsis }
        };
        debouncedSave(updatedProject);
        return { project: updatedProject };
    });
  },

  setGeneratedStructure: (items) => {
      set((state) => {
          if (!state.project) return {};
          const isEpisodic = state.project.format.type === 'EPISODIC';
          let seasons = state.project.script.seasons;
          let sequels = state.project.script.sequels;

          if (isEpisodic) {
              const season: Season = {
                  id: uuidv4(),
                  seasonNumber: 1,
                  title: "Season 1",
                  logline: state.project.bible.synopsis || "",
                  continuityBrief: undefined,
                  episodes: items as Episode[],
                  isLocked: false
              };
              seasons = [season];
          } else {
              const sequel: Sequel = {
                  id: uuidv4(),
                  partNumber: 1,
                  title: "Part 1",
                  summary: state.project.bible.synopsis || "",
                  continuityBrief: undefined,
                  acts: items as Act[],
                  isLocked: false
              };
              sequels = [sequel];
          }

          const updatedProject = {
              ...state.project,
              script: {
                  seasons: isEpisodic ? seasons : undefined,
                  sequels: !isEpisodic ? sequels : undefined,
              }
          };
          debouncedSave(updatedProject);
          return { project: updatedProject };
      });
  },

  populateCharacterProfile: (id, profile) => {
      set((state) => {
          if (!state.project) return {};
          const chars = state.project.bible.characters.map(c => 
             c.id === id ? { ...c, profile } : c
          );
          const updatedProject = {
              ...state.project,
              bible: { ...state.project.bible, characters: chars }
          };
          debouncedSave(updatedProject);
          return { project: updatedProject };
      });
  },

  updateCharacter: (updates) => {
      set((state) => {
          if (!state.project) return {};
          const chars = state.project.bible.characters.map(c => 
             c.id === updates.id ? { ...c, ...updates } : c
          );
          const updatedProject = {
              ...state.project,
              bible: { ...state.project.bible, characters: chars }
          };
          debouncedSave(updatedProject);
          return { project: updatedProject };
      });
  },

  updateLocation: (updates) => {
    set((state) => {
        if (!state.project) return {};
        const locs = state.project.bible.locations.map(l => 
           l.id === updates.id ? { ...l, ...updates } : l
        );
        const updatedProject = {
            ...state.project,
            bible: { ...state.project.bible, locations: locs }
        };
        debouncedSave(updatedProject);
        return { project: updatedProject };
    });
  },

  updateProp: (updates) => {
    set((state) => {
        if (!state.project) return {};
        const props = state.project.bible.props.map(p => 
           p.id === updates.id ? { ...p, ...updates } : p
        );
        const updatedProject = {
            ...state.project,
            bible: { ...state.project.bible, props }
        };
        debouncedSave(updatedProject);
        return { project: updatedProject };
    });
  },

  updateAssetConsistency: (type, id, mode) => {
    set((state) => {
        if (!state.project) return {};
        const updateList = <T extends { id: string, consistencyMode: ConsistencyMode }>(list: T[]) => 
            list.map(item => item.id === id ? { ...item, consistencyMode: mode } : item);

        const bible = { ...state.project.bible };
        if (type === 'character') bible.characters = updateList(bible.characters);
        if (type === 'location') bible.locations = updateList(bible.locations);
        if (type === 'prop') bible.props = updateList(bible.props);

        const updatedProject = { ...state.project, bible };
        debouncedSave(updatedProject);
        return { project: updatedProject };
    });
  },

  addSeason: () => {
      set(state => {
          if (!state.project || !state.project.script.seasons) return {};
          const nextNum = state.project.script.seasons.length + 1;
          const newSeason: Season = {
              id: uuidv4(),
              seasonNumber: nextNum,
              title: `Season ${nextNum}`,
              logline: '',
              episodes: [],
              isLocked: false
          };
          const updatedProject = {
              ...state.project,
              script: { ...state.project.script, seasons: [...state.project.script.seasons, newSeason] }
          };
          debouncedSave(updatedProject);
          return { project: updatedProject };
      });
  },

  deleteSeason: (id) => {
      set(state => {
          if (!state.project || !state.project.script.seasons) return {};
          const updatedSeasons = state.project.script.seasons.filter(s => s.id !== id);
          const renumbered = updatedSeasons.map((s, i) => ({ ...s, seasonNumber: i + 1, title: `Season ${i+1}` }));
          const updatedProject = {
              ...state.project,
              script: { ...state.project.script, seasons: renumbered }
          };
          debouncedSave(updatedProject);
          return { project: updatedProject };
      });
  },

  addSequel: () => {
    set(state => {
        if (!state.project || !state.project.script.sequels) return {};
        const nextNum = state.project.script.sequels.length + 1;
        const newSequel: Sequel = {
            id: uuidv4(),
            partNumber: nextNum,
            title: `Part ${nextNum}`,
            summary: '',
            acts: [],
            isLocked: false
        };
        const updatedProject = {
            ...state.project,
            script: { ...state.project.script, sequels: [...state.project.script.sequels, newSequel] }
        };
        debouncedSave(updatedProject);
        return { project: updatedProject };
    });
  },

  deleteSequel: (id) => {
      set(state => {
          if (!state.project || !state.project.script.sequels) return {};
          const updatedSequels = state.project.script.sequels.filter(s => s.id !== id);
          const renumbered = updatedSequels.map((s, i) => ({ ...s, partNumber: i + 1, title: `Part ${i+1}` }));
          const updatedProject = {
              ...state.project,
              script: { ...state.project.script, sequels: renumbered }
          };
          debouncedSave(updatedProject);
          return { project: updatedProject };
      });
  },

  toggleInstallmentLock: (id) => {
      set(state => {
          if (!state.project) return {};
          const isEpisodic = state.project.format.type === 'EPISODIC';
          let updatedProject;
          if (isEpisodic) {
               const seasons = state.project.script.seasons?.map(s => s.id === id ? { ...s, isLocked: !s.isLocked } : s);
               updatedProject = { ...state.project, script: { ...state.project.script, seasons } };
          } else {
               const sequels = state.project.script.sequels?.map(s => s.id === id ? { ...s, isLocked: !s.isLocked } : s);
               updatedProject = { ...state.project, script: { ...state.project.script, sequels } };
          }
          debouncedSave(updatedProject);
          return { project: updatedProject };
      });
  },

  updateContinuityBrief: (installmentId, updates) => {
      set(state => {
        if (!state.project) return {};
        const updateInstallment = (inst: Season | Sequel) => {
            if (inst.id !== installmentId) return inst;
            const existingBrief = inst.continuityBrief || {
                id: uuidv4(),
                projectId: state.project!.metadata.id,
                installmentId: inst.id,
                installmentTitle: inst.title,
                generatedAt: Date.now(),
                summary: '',
                characterResolutions: [],
                worldStateChanges: [],
                lingeringHooks: [],
                isLocked: false
            };
            return { ...inst, continuityBrief: { ...existingBrief, ...updates } };
        };
        const isEpisodic = state.project.format.type === 'EPISODIC';
        let updatedProject;
        if (isEpisodic) {
             const seasons = state.project.script.seasons?.map(updateInstallment as (s: Season) => Season);
             updatedProject = { ...state.project, script: { ...state.project.script, seasons } };
        } else {
             const sequels = state.project.script.sequels?.map(updateInstallment as (s: Sequel) => Sequel);
             updatedProject = { ...state.project, script: { ...state.project.script, sequels } };
        }
        debouncedSave(updatedProject);
        return { project: updatedProject };
      });
  },

  addEpisodeToSeason: (seasonId, { title, logline }) => {
      set(state => {
          if (!state.project || !state.project.script.seasons) return {};
          const seasons = state.project.script.seasons.map(season => {
              if (season.id !== seasonId) return season;
              const nextNum = season.episodes.length + 1;
              const newEpisode: Episode = { id: uuidv4(), episodeNumber: nextNum, title, logline, scenes: [], sceneSummariesLocked: false };
              return { ...season, episodes: [...season.episodes, newEpisode] };
          });
          const updatedProject = { ...state.project, script: { ...state.project.script, seasons } };
          debouncedSave(updatedProject);
          return { project: updatedProject };
      });
  },

  addActToSequel: (sequelId, { title, summary }) => {
    set(state => {
        if (!state.project || !state.project.script.sequels) return {};
        const sequels = state.project.script.sequels.map(sequel => {
            if (sequel.id !== sequelId) return sequel;
            const nextNum = sequel.acts.length + 1;
            const newAct: Act = { id: uuidv4(), actNumber: nextNum, title, summary, scenes: [], sceneSummariesLocked: false };
            return { ...sequel, acts: [...sequel.acts, newAct] };
        });
        const updatedProject = { ...state.project, script: { ...state.project.script, sequels } };
        debouncedSave(updatedProject);
        return { project: updatedProject };
    });
  },

  updateEpisode: (id, updates) => {
      set(state => {
          if (!state.project || !state.project.script.seasons) return {};
          const seasons = state.project.script.seasons.map(season => ({ ...season, episodes: season.episodes.map(ep => ep.id === id ? { ...ep, ...updates } : ep) }));
          const updatedProject = { ...state.project, script: { ...state.project.script, seasons } };
          debouncedSave(updatedProject);
          return { project: updatedProject };
      });
  },

  updateAct: (id, updates) => {
      set(state => {
          if (!state.project || !state.project.script.sequels) return {};
          const sequels = state.project.script.sequels.map(sequel => ({ ...sequel, acts: sequel.acts.map(act => act.id === id ? { ...act, ...updates } : act) }));
          const updatedProject = { ...state.project, script: { ...state.project.script, sequels } };
          debouncedSave(updatedProject);
          return { project: updatedProject };
      });
  },

  deleteEpisodeFromSeason: (seasonId, episodeId) => {
      set(state => {
          if (!state.project || !state.project.script.seasons) return {};
          const seasons = state.project.script.seasons.map(season => {
              if (season.id !== seasonId) return season;
              const filteredEpisodes = season.episodes.filter(ep => ep.id !== episodeId);
              const renumberedEpisodes = filteredEpisodes.map((ep, idx) => ({ ...ep, episodeNumber: idx + 1 }));
              return { ...season, episodes: renumberedEpisodes };
          });
          const updatedProject = { ...state.project, script: { ...state.project.script, seasons } };
          debouncedSave(updatedProject);
          return { project: updatedProject };
      });
  },

  deleteActFromSequel: (sequelId, actId) => {
      set(state => {
          if (!state.project || !state.project.script.sequels) return {};
          const sequels = state.project.script.sequels.map(sequel => {
              if (sequel.id !== sequelId) return sequel;
              const filteredActs = sequel.acts.filter(act => act.id !== actId);
              const renumberedActs = filteredActs.map((act, idx) => ({ ...act, actNumber: idx + 1 }));
              return { ...sequel, acts: renumberedActs };
          });
          const updatedProject = { ...state.project, script: { ...state.project.script, sequels } };
          debouncedSave(updatedProject);
          return { project: updatedProject };
      });
  },

  setScenesForItem: (itemId, scenes) => {
      set(state => {
          if (!state.project) return {};
          const isEpisodic = state.project.format.type === 'EPISODIC';
          let updatedProject;
          if (isEpisodic) {
              const seasons = state.project.script.seasons!.map(season => ({ ...season, episodes: season.episodes.map(ep => ep.id === itemId ? { ...ep, scenes } : ep) }));
              updatedProject = { ...state.project, script: { ...state.project.script, seasons } };
          } else {
              const sequels = state.project.script.sequels!.map(sequel => ({ ...sequel, acts: sequel.acts.map(act => act.id === itemId ? { ...act, scenes } : act) }));
               updatedProject = { ...state.project, script: { ...state.project.script, sequels } };
          }
          debouncedSave(updatedProject);
          return { project: updatedProject };
      });
  },

  updateSceneSummary: (itemId, sceneId, summary) => {
      set(state => {
          if (!state.project) return {};
          const updateScenes = (scenes: Scene[]) => scenes.map(s => s.id === sceneId ? { ...s, summary } : s);
          let updatedProject;
          if (state.project.format.type === 'EPISODIC') {
              const seasons = state.project.script.seasons!.map(s => ({ ...s, episodes: s.episodes.map(e => e.id === itemId ? { ...e, scenes: updateScenes(e.scenes) } : e) }));
               updatedProject = { ...state.project, script: { ...state.project.script, seasons } };
          } else {
              const sequels = state.project.script.sequels!.map(s => ({ ...s, acts: s.acts.map(a => a.id === itemId ? { ...a, scenes: updateScenes(a.scenes) } : a) }));
               updatedProject = { ...state.project, script: { ...state.project.script, sequels } };
          }
          debouncedSave(updatedProject);
          return { project: updatedProject };
      });
  },

  lockSceneSummaries: (itemId) => {
    set(state => {
        if (!state.project) return {};
        let updatedProject;
        if (state.project.format.type === 'EPISODIC') {
             const seasons = state.project.script.seasons!.map(s => ({ ...s, episodes: s.episodes.map(e => e.id === itemId ? { ...e, sceneSummariesLocked: true } : e) }));
             updatedProject = { ...state.project, script: { ...state.project.script, seasons } };
        } else {
             const sequels = state.project.script.sequels!.map(s => ({ ...s, acts: s.acts.map(a => a.id === itemId ? { ...a, sceneSummariesLocked: true } : a) }));
             updatedProject = { ...state.project, script: { ...state.project.script, sequels } };
        }
        debouncedSave(updatedProject);
        return { project: updatedProject };
    });
  },

  toggleSceneContentLock: (itemId, sceneId) => {
      set(state => {
          if (!state.project) return {};
          const updateScenes = (scenes: Scene[]) => scenes.map(s => s.id === sceneId ? { ...s, isContentLocked: !s.isContentLocked } : s);
           let updatedProject;
           if (state.project.format.type === 'EPISODIC') {
              const seasons = state.project.script.seasons!.map(s => ({ ...s, episodes: s.episodes.map(e => e.id === itemId ? { ...e, scenes: updateScenes(e.scenes) } : e) }));
               updatedProject = { ...state.project, script: { ...state.project.script, seasons } };
          } else {
              const sequels = state.project.script.sequels!.map(s => ({ ...s, acts: s.acts.map(a => a.id === itemId ? { ...a, scenes: updateScenes(a.scenes) } : a) }));
               updatedProject = { ...state.project, script: { ...state.project.script, sequels } };
          }
          debouncedSave(updatedProject);
          return { project: updatedProject };
      });
  },

  setAllScreenplaysForItem: (itemId, result) => {
      set(state => {
          if (!state.project) return {};
          const updateScenes = (scenes: Scene[]) => scenes.map(s => {
              const match = result.scenes.find(r => r.sceneId === s.id);
              if (match) return { ...s, content: match.screenplay };
              return s;
          });
          let updatedProject;
          if (state.project.format.type === 'EPISODIC') {
              const seasons = state.project.script.seasons!.map(s => ({ ...s, episodes: s.episodes.map(e => e.id === itemId ? { ...e, scenes: updateScenes(e.scenes) } : e) }));
               updatedProject = { ...state.project, script: { ...state.project.script, seasons } };
          } else {
              const sequels = state.project.script.sequels!.map(s => ({ ...s, acts: s.acts.map(a => a.id === itemId ? { ...a, scenes: updateScenes(a.scenes) } : a) }));
               updatedProject = { ...state.project, script: { ...state.project.script, sequels } };
          }
          debouncedSave(updatedProject);
          return { project: updatedProject };
      });
  },

  approveEpisodeActScreenplay: (itemId) => {
      set(state => {
          if (!state.project) return {};
           let updatedProject;
           if (state.project.format.type === 'EPISODIC') {
              const seasons = state.project.script.seasons!.map(s => ({ ...s, episodes: s.episodes.map(e => e.id === itemId ? { ...e, isScreenplayApproved: true } : e) }));
               updatedProject = { ...state.project, script: { ...state.project.script, seasons } };
          } else {
              const sequels = state.project.script.sequels!.map(s => ({ ...s, acts: s.acts.map(a => a.id === itemId ? { ...a, isScreenplayApproved: true } : a) }));
               updatedProject = { ...state.project, script: { ...state.project.script, sequels } };
          }
          debouncedSave(updatedProject);
          return { project: updatedProject };
      });
  },

  addScreenplayLine: (itemId, sceneId, index, type) => {
      set(state => {
          if (!state.project) return {};
          const updateScenes = (scenes: Scene[]) => scenes.map(s => {
              if (s.id !== sceneId) return s;
              const newContent = [...s.content];
              newContent.splice(index + 1, 0, { type, text: '' });
              return { ...s, content: newContent };
          });
           let updatedProject;
           if (state.project.format.type === 'EPISODIC') {
              const seasons = state.project.script.seasons!.map(s => ({ ...s, episodes: s.episodes.map(e => e.id === itemId ? { ...e, scenes: updateScenes(e.scenes) } : e) }));
               updatedProject = { ...state.project, script: { ...state.project.script, seasons } };
          } else {
              const sequels = state.project.script.sequels!.map(s => ({ ...s, acts: s.acts.map(a => a.id === itemId ? { ...a, scenes: updateScenes(a.scenes) } : a) }));
               updatedProject = { ...state.project, script: { ...state.project.script, sequels } };
          }
          debouncedSave(updatedProject);
          return { project: updatedProject };
      });
  },

  updateScreenplayLine: (itemId, sceneId, index, text) => {
      set(state => {
           if (!state.project) return {};
           const updateScenes = (scenes: Scene[]) => scenes.map(s => {
              if (s.id !== sceneId) return s;
              const newContent = [...s.content];
              newContent[index] = { ...newContent[index], text };
              return { ...s, content: newContent };
          });
           let updatedProject;
           if (state.project.format.type === 'EPISODIC') {
              const seasons = state.project.script.seasons!.map(s => ({ ...s, episodes: s.episodes.map(e => e.id === itemId ? { ...e, scenes: updateScenes(e.scenes) } : e) }));
               updatedProject = { ...state.project, script: { ...state.project.script, seasons } };
          } else {
              const sequels = state.project.script.sequels!.map(s => ({ ...s, acts: s.acts.map(a => a.id === itemId ? { ...a, scenes: updateScenes(a.scenes) } : a) }));
               updatedProject = { ...state.project, script: { ...state.project.script, sequels } };
          }
          debouncedSave(updatedProject);
          return { project: updatedProject };
      });
  },

  deleteScreenplayLine: (itemId, sceneId, index) => {
      set(state => {
           if (!state.project) return {};
           const updateScenes = (scenes: Scene[]) => scenes.map(s => {
              if (s.id !== sceneId) return s;
              const newContent = [...s.content];
              newContent.splice(index, 1);
              return { ...s, content: newContent };
          });
          let updatedProject;
          if (state.project.format.type === 'EPISODIC') {
              const seasons = state.project.script.seasons!.map(s => ({ ...s, episodes: s.episodes.map(e => e.id === itemId ? { ...e, scenes: updateScenes(e.scenes) } : e) }));
               updatedProject = { ...state.project, script: { ...state.project.script, seasons } };
          } else {
              const sequels = state.project.script.sequels!.map(s => ({ ...s, acts: s.acts.map(a => a.id === itemId ? { ...a, scenes: updateScenes(a.scenes) } : a) }));
               updatedProject = { ...state.project, script: { ...state.project.script, sequels } };
          }
          debouncedSave(updatedProject);
          return { project: updatedProject };
      });
  },

  setAnalyzedAssets: (itemId, result) => {
      set(state => {
          if (!state.project) return {};
          const bible = { ...state.project.bible };
          
          result.identifiedCharacters.forEach(newChar => {
              const exists = bible.characters.find(c => c.profile.name === newChar.profile.name);
              if (!exists) {
                   const defaultProfile = createDefaultCharacterProfile(newChar.profile.name);
                   const char: Character = { id: uuidv4(), profile: { ...defaultProfile, ...newChar.profile }, timeline: [], consistencyMode: newChar.consistencyMode || 'GENERATIVE', analysis: newChar.analysis, appearances: 0 };
                   bible.characters.push(char);
              }
          });

          result.identifiedLocations.forEach(newLoc => {
               const exists = bible.locations.find(l => l.baseProfile.identity.name === newLoc.baseProfile.identity.name);
               if (!exists) {
                   const defaultProfile = createDefaultLocationBaseProfile(newLoc.baseProfile.identity.name);
                   const loc: Location = { id: uuidv4(), baseProfile: { ...defaultProfile, ...newLoc.baseProfile }, timeline: [], consistencyMode: newLoc.consistencyMode || 'GENERATIVE', analysis: newLoc.analysis, appearances: 0 };
                   bible.locations.push(loc);
               }
          });

           result.identifiedProps.forEach(newProp => {
               const exists = bible.props.find(p => p.baseProfile.identity.name === newProp.baseProfile.identity.name);
               if (!exists) {
                   const defaultProfile = createDefaultPropBaseProfile(newProp.baseProfile.identity.name);
                   const prop: Prop = { id: uuidv4(), baseProfile: { ...defaultProfile, ...newProp.baseProfile }, timeline: [], consistencyMode: newProp.consistencyMode || 'GENERATIVE', analysis: newProp.analysis, appearances: 0 };
                   bible.props.push(prop);
               }
          });

          result.assetStateChanges.forEach(change => {
               const snapshot: StateSnapshot = { ...change.snapshot, id: uuidv4() };
               if (change.assetType === 'character') {
                   const asset = bible.characters.find(c => c.profile.name === change.assetName);
                   if (asset) asset.timeline.push(snapshot);
               } else if (change.assetType === 'location') {
                   const asset = bible.locations.find(l => l.baseProfile.identity.name === change.assetName);
                   if (asset) asset.timeline.push(snapshot);
               } else {
                   const asset = bible.props.find(p => p.baseProfile.identity.name === change.assetName);
                   if (asset) asset.timeline.push(snapshot);
               }
          });

          const updateScenes = (scenes: Scene[]) => scenes.map(s => {
              const map = result.sceneAssetMapping.find(m => m.sceneId === s.id);
              if (map) return { ...s, assets: map.assets };
              return s;
          });

          let script = state.project.script;
          if (state.project.format.type === 'EPISODIC') {
              const seasons = script.seasons!.map(s => ({ ...s, episodes: s.episodes.map(e => e.id === itemId ? { ...e, scenes: updateScenes(e.scenes) } : e) }));
              script = { ...script, seasons };
          } else {
              const sequels = script.sequels!.map(s => ({ ...s, acts: s.acts.map(a => a.id === itemId ? { ...a, scenes: updateScenes(a.scenes) } : a) }));
              script = { ...script, sequels };
          }

          const updatedProject = { ...state.project, bible, script };
          debouncedSave(updatedProject);
          return { project: updatedProject };
      });
  },

  addShot: (sceneId) => {
    set(state => {
        if (!state.project) return {};
        const currentShots = state.project.studio.shotsByScene[sceneId] || [];
        const nextNum = currentShots.length + 1;
        // Default locked upon creation, AND now origin: 'user'
        const newShot: Shot = { 
            id: uuidv4(), 
            shotNumber: nextNum, 
            description: "New shot", 
            isLocked: true,
            origin: 'user' // Added
        };
        const updatedShotsByScene = { ...state.project.studio.shotsByScene, [sceneId]: [...currentShots, newShot] };
        const updatedProject = { ...state.project, studio: { ...state.project.studio, shotsByScene: updatedShotsByScene } };
        debouncedSave(updatedProject);
        return { project: updatedProject };
    });
  },

  updateShot: (sceneId, shotId, updates) => {
      set(state => {
          if (!state.project) return {};
          const sceneShots = state.project.studio.shotsByScene[sceneId] || [];
          const updatedShots = sceneShots.map(shot => {
              if (shot.id === shotId) return { ...shot, ...updates };
              return shot;
          });
          const updatedProject = {
              ...state.project,
              studio: { ...state.project.studio, shotsByScene: { ...state.project.studio.shotsByScene, [sceneId]: updatedShots } },
              metadata: { ...state.project.metadata, updatedAt: Date.now() }
          };
          debouncedSave(updatedProject);
          return { project: updatedProject };
      });
  },

  deleteShot: (sceneId, shotId) => {
      set(state => {
          if (!state.project) return {};
          const currentShots = state.project.studio.shotsByScene[sceneId] || [];
          const updatedShots = currentShots.filter(s => s.id !== shotId);
          // Renumber shots
          const renumberedShots = updatedShots.map((s, idx) => ({ ...s, shotNumber: idx + 1 }));
          
          const updatedShotsByScene = { ...state.project.studio.shotsByScene, [sceneId]: renumberedShots };
          const updatedProject = { ...state.project, studio: { ...state.project.studio, shotsByScene: updatedShotsByScene } };
          debouncedSave(updatedProject);
          return { project: updatedProject };
      });
  },

  generateShotsForScene: async (sceneId) => {
      const state = get();
      if (!state.project) return;
      
      let targetScene: Scene | undefined;
      const isEpisodic = state.project.format.type === 'EPISODIC';
      if (isEpisodic) {
           for(const season of state.project.script.seasons || []) {
               for(const ep of season.episodes) {
                   const found = ep.scenes.find(s => s.id === sceneId);
                   if (found) { targetScene = found; break; }
               }
               if(targetScene) break;
           }
      } else {
          for(const sequel of state.project.script.sequels || []) {
               for(const act of sequel.acts) {
                   const found = act.scenes.find(s => s.id === sceneId);
                   if (found) { targetScene = found; break; }
               }
               if(targetScene) break;
           }
      }

      if (!targetScene) throw new Error("Scene not found.");

      const shotList = await geminiService.generateShotListForScene(targetScene, state.project, state.generationModel);
      
      const newShots: Shot[] = shotList.map((s, index) => {
          const refs: ShotReferenceImage[] = [];
          
          s.keyAssets.forEach(assetName => {
              const char = state.project!.bible.characters.find(c => c.profile.name.toLowerCase() === assetName.toLowerCase());
              if (char && char.profile.generatedImageUrl) {
                  refs.push({ id: uuidv4(), sourceType: 'character', url: char.profile.generatedImageUrl, isActive: true, name: char.profile.name });
                  return;
              }
              const loc = state.project!.bible.locations.find(l => l.baseProfile.identity.name.toLowerCase() === assetName.toLowerCase());
              if (loc && loc.baseProfile.visuals.generatedImageUrl) {
                   refs.push({ id: uuidv4(), sourceType: 'location', url: loc.baseProfile.visuals.generatedImageUrl, isActive: true, name: loc.baseProfile.identity.name });
                   return;
              }
              const prop = state.project!.bible.props.find(p => p.baseProfile.identity.name.toLowerCase() === assetName.toLowerCase());
              if (prop && prop.baseProfile.visuals.generatedImageUrl) {
                   refs.push({ id: uuidv4(), sourceType: 'prop', url: prop.baseProfile.visuals.generatedImageUrl, isActive: true, name: prop.baseProfile.identity.name });
                   return;
              }
          });

          return {
              id: uuidv4(),
              shotNumber: index + 1,
              description: s.description,
              visualPromptText: s.description,
              referenceImages: refs,
              isLocked: true, 
              origin: 'ai' // Added
          };
      });

      set(state => {
          if (!state.project) return {};
          const updatedShotsByScene = { ...state.project.studio.shotsByScene, [sceneId]: newShots };
           const updatedProject = { ...state.project, studio: { ...state.project.studio, shotsByScene: updatedShotsByScene } };
          debouncedSave(updatedProject);
          return { project: updatedProject };
      });
  }

}));