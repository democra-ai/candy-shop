import type { Skill } from '../types/skill-creator';

const SKILLS_KEY = 'user_skills';

export const storageUtils = {
  // Skills management
  getSkills: (): Skill[] => {
    try {
      return JSON.parse(localStorage.getItem(SKILLS_KEY) || '[]');
    } catch {
      return [];
    }
  },

  saveSkill: (skill: Partial<Skill>): void => {
    try {
      const skills = storageUtils.getSkills();
      const skillWithTimestamp: Skill = {
        id: skill.id || `skill-${Date.now()}`,
        userId: skill.userId || '',
        name: skill.name || 'Untitled Skill',
        description: skill.description || '',
        category: skill.category || 'Custom',
        icon: skill.icon || '✨',
        color: skill.color || 'bg-indigo-100',
        tags: skill.tags || [skill.category || 'Custom'],
        config: skill.config || { capabilities: [], systemPrompt: '', parameters: {} },
        sourceFiles: skill.sourceFiles || [],
        analysisContext: skill.analysisContext || {
          workDomain: [],
          technicalSkills: [],
          experiencePatterns: [],
          keyTopics: [],
          suggestedName: skill.name || 'Untitled',
          suggestedDescription: skill.description || '',
          suggestedCategory: skill.category || 'Custom',
          suggestedCapabilities: [],
          filesSummary: [],
          confidence: 0,
          systemPrompt: '',
        },
        installCommand: skill.installCommand || '',
        popularity: skill.popularity || 0,
        status: skill.status || 'draft',
        isPublic: skill.isPublic || false,
        origin: skill.origin || 'created',
        createdAt: skill.createdAt instanceof Date ? skill.createdAt : new Date(skill.createdAt || Date.now()),
        updatedAt: new Date(),
      };
      skills.push(skillWithTimestamp);
      localStorage.setItem(SKILLS_KEY, JSON.stringify(skills));
    } catch (error) {
      console.error('Failed to save skill:', error);
      throw error;
    }
  },

  deleteSkill: (skillId: string): void => {
    try {
      const skills = storageUtils.getSkills();
      const filtered = skills.filter(s => s.id !== skillId);
      localStorage.setItem(SKILLS_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to delete skill:', error);
      throw error;
    }
  },

  updateSkill: (skillId: string, updates: Partial<Skill>): void => {
    try {
      const skills = storageUtils.getSkills();
      const index = skills.findIndex(s => s.id === skillId);
      if (index !== -1) {
        skills[index] = {
          ...skills[index],
          ...updates,
          updatedAt: new Date(),
        };
        localStorage.setItem(SKILLS_KEY, JSON.stringify(skills));
      }
    } catch (error) {
      console.error('Failed to update skill:', error);
      throw error;
    }
  },

  getSkillById: (skillId: string): Skill | undefined => {
    const skills = storageUtils.getSkills();
    return skills.find(s => s.id === skillId);
  },

  // Execution history
  saveExecutionHistory: (skillId: string, input: string, output: string, duration: number): void => {
    try {
      const historyKey = `skill_history_${skillId}`;
      const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
      history.push({
        id: `exec-${Date.now()}`,
        input,
        output,
        timestamp: new Date().toISOString(),
        duration,
      });
      // Keep only last 50 executions
      if (history.length > 50) {
        history.shift();
      }
      localStorage.setItem(historyKey, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save execution history:', error);
    }
  },

  getExecutionHistory: (skillId: string) => {
    try {
      const historyKey = `skill_history_${skillId}`;
      return JSON.parse(localStorage.getItem(historyKey) || '[]');
    } catch {
      return [];
    }
  },

  // Likes management
  getLikes: (): string[] => {
    try {
      return JSON.parse(localStorage.getItem('liked_skills') || '[]');
    } catch {
      return [];
    }
  },

  saveLike: (skillId: string): void => {
    try {
      const likes = storageUtils.getLikes();
      if (!likes.includes(skillId)) {
        likes.push(skillId);
        localStorage.setItem('liked_skills', JSON.stringify(likes));
      }
    } catch (error) {
      console.error('Failed to save like:', error);
      throw error;
    }
  },

  removeLike: (skillId: string): void => {
    try {
      const likes = storageUtils.getLikes();
      const filtered = likes.filter(id => id !== skillId);
      localStorage.setItem('liked_skills', JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to remove like:', error);
      throw error;
    }
  },

  isLiked: (skillId: string): boolean => {
    const likes = storageUtils.getLikes();
    return likes.includes(skillId);
  },
};
