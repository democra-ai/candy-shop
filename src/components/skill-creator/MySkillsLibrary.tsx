import { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Play, Calendar, Filter, ArrowLeft, Package } from 'lucide-react';
import { storageUtils } from '../../utils/storage';
import type { Skill, SkillCategory } from '../../types/skill-creator';
import { SKILLS_DATA } from '../../data/skillsData';

interface MySkillsLibraryProps {
  onCreateNew: () => void;
  onUseSkill: (skill: Skill) => void;
  onBack?: () => void;
}

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  Knowledge: 'Knowledge',
  Analysis: 'Analysis',
  Development: 'Development',
  Design: 'Design',
  Marketing: 'Marketing',
  Productivity: 'Productivity',
  Tools: 'Tools',
  Research: 'Research',
  Mobile: 'Mobile',
  Writing: 'Writing',
  Custom: 'Custom',
};

export function MySkillsLibrary({ onCreateNew, onUseSkill, onBack }: MySkillsLibraryProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'created' | 'store' | 'liked'>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadSkills();
  }, [categoryFilter, activeTab]);

  const loadSkills = () => {
    setIsLoading(true);
    try {
      if (activeTab === 'liked') {
        // Load liked skills from store
        const likedIds = storageUtils.getLikes();
        const likedSkills = SKILLS_DATA.filter(skill => likedIds.includes(skill.id));
        let filtered = likedSkills;
        
        if (categoryFilter) {
          filtered = filtered.filter((s) => s.category === categoryFilter);
        }
        
        setSkills(filtered as any[]);
      } else if (activeTab === 'all') {
        // Load all skills: created + purchased + liked
        const createdAndPurchased = storageUtils.getSkills();
        const likedIds = storageUtils.getLikes();
        const likedSkills = SKILLS_DATA.filter(skill => likedIds.includes(skill.id));
        
        // Convert liked skills to Skill format for consistency
        const likedSkillsFormatted = likedSkills.map(skill => ({
          id: skill.id,
          userId: '',
          name: skill.name,
          description: skill.description,
          category: skill.category as SkillCategory,
          icon: skill.icon,
          color: skill.color,
          tags: [skill.category],
          config: {
            capabilities: [],
            systemPrompt: '',
            parameters: skill.config,
            tools: []
          },
          sourceFiles: [],
          analysisContext: {
            workDomain: [],
            technicalSkills: [],
            experiencePatterns: [],
            keyTopics: [],
            suggestedName: skill.name,
            suggestedDescription: skill.description,
            suggestedCategory: skill.category as SkillCategory,
            suggestedCapabilities: [],
            filesSummary: [],
            confidence: 0,
            systemPrompt: '',
          },
          installCommand: skill.installCommand,
          popularity: skill.popularity,
          status: 'active' as const,
          isPublic: false,
          origin: 'store' as const, // Liked skills are from store
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
        
        // Combine all skills
        let allSkills: Skill[] = [...createdAndPurchased, ...likedSkillsFormatted];
        
        // Remove duplicates (in case a skill is both purchased and liked)
        const uniqueSkills = Array.from(
          new Map(allSkills.map(skill => [skill.id, skill])).values()
        ) as Skill[];
        
        if (categoryFilter) {
          allSkills = uniqueSkills.filter((s: Skill) => s.category === categoryFilter);
        } else {
          allSkills = uniqueSkills;
        }
        
        setSkills(allSkills);
      } else {
        // Created or Purchased tab
        const data = storageUtils.getSkills();
        let filtered = data;
        
        if (categoryFilter) {
          filtered = filtered.filter((s: Skill) => s.category === categoryFilter);
        }

        filtered = filtered.filter((s: Skill) => s.origin === activeTab);
        
        setSkills(filtered);
      }
      setFeedback(null);
    } catch (error) {
      console.error('Failed to load skills:', error);
      setFeedback({ type: 'error', message: 'Failed to load skills' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (skillId: string) => {
    try {
      storageUtils.deleteSkill(skillId);
      setSkills(skills.filter(s => s.id !== skillId));
      setDeleteConfirm(null);
      setFeedback({ type: 'success', message: 'Skill deleted successfully' });
    } catch (error) {
      console.error('Failed to delete skill:', error);
      setFeedback({ type: 'error', message: 'Failed to delete skill' });
    }
  };

  const filteredSkills = skills.filter(skill => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      skill.name.toLowerCase().includes(query) ||
      skill.description.toLowerCase().includes(query)
    );
  });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-foreground-secondary hover:text-foreground transition-colors duration-200 cursor-pointer p-2 rounded-lg hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-primary/30"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Skills Library</h1>
            <p className="text-sm text-foreground-secondary mt-1">
              Manage all your created AI skills
            </p>
          </div>
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-primary-active text-white font-medium rounded-lg hover:from-primary-hover hover:to-primary-active transition-all shadow-md"
        >
          <Plus className="w-5 h-5" />
          Create New Skill
        </button>
      </div>

      {/* Feedback Messages */}
      {feedback && (
        <div className={`p-4 rounded-lg ${feedback.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <p className={`text-sm ${feedback.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
            {feedback.message}
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search skills..."
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-foreground-tertiary" />
          <select
            value={categoryFilter || ''}
            onChange={(e) => setCategoryFilter(e.target.value || null)}
            className="px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
          >
            <option value="">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      < div className="flex items-center gap-1 border-b border-border" >
        <button
          onClick={() => { setActiveTab('all'); loadSkills(); }}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 ${activeTab === 'all'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-secondary hover:text-foreground'
            }`}
          aria-label="All Skills"
          aria-pressed={activeTab === 'all'}
        >
          All Skills
        </button>
        <button
          onClick={() => { setActiveTab('created'); loadSkills(); }}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 ${activeTab === 'created'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-secondary hover:text-foreground'
            }`}
          aria-label="Created skills"
          aria-pressed={activeTab === 'created'}
        >
          Created
        </button>
        <button
          onClick={() => { setActiveTab('store'); loadSkills(); }}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 ${activeTab === 'store'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-secondary hover:text-foreground'
            }`}
          aria-label="Purchased skills"
          aria-pressed={activeTab === 'store'}
        >
          Purchased
        </button>
        <button
          onClick={() => { setActiveTab('liked'); loadSkills(); }}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 ${activeTab === 'liked'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-secondary hover:text-foreground'
            }`}
          aria-label="Liked skills"
          aria-pressed={activeTab === 'liked'}
        >
          Liked
        </button>
      </div>

      {/* Skills Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredSkills.length === 0 ? (
        <div className="text-center py-20">
          <Package className="w-16 h-16 text-foreground-secondary mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-medium text-foreground mb-2">
            {searchQuery || categoryFilter 
              ? 'No matching skills found' 
              : activeTab === 'liked' 
                ? 'No liked skills yet' 
                : 'No skills created yet'}
          </h3>
          <p className="text-foreground-secondary mb-6">
            {searchQuery || categoryFilter
              ? 'Try adjusting your search criteria'
              : activeTab === 'liked'
                ? 'Like skills from the home page to see them here'
                : 'Click the button above to create your first skill'}
          </p>
          {!searchQuery && !categoryFilter && (
            <button
              onClick={onCreateNew}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-primary-active text-primary-foreground font-medium rounded-lg hover:from-primary-hover hover:to-primary-active transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <Plus className="w-5 h-5" />
              Create Your First Skill
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSkills.map((skill) => (
            <div
              key={skill.id}
              className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group"
            >
              {/* Top Bar */}
              <div className="h-10 px-4 border-b border-border flex items-center bg-card relative">
                <div className="flex items-center gap-1.5 absolute left-4">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]"></div>
                </div>
                <div className="mx-auto text-xs font-mono text-foreground-tertiary font-medium">
                  {skill.id.slice(0, 8)}.ts
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="text-3xl">{skill.icon}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-foreground truncate">
                      {skill.name}
                    </h3>
                    <p className="text-xs text-foreground-tertiary">
                      {CATEGORY_LABELS[skill.category as SkillCategory]}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-foreground-secondary line-clamp-3 mb-4">
                  {skill.description}
                </p>

                <div className="flex items-center gap-2 text-xs text-foreground-tertiary mb-4">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {skill.createdAt 
                      ? `Created on ${new Date(skill.createdAt).toLocaleDateString('en-US')}`
                      : activeTab === 'liked' ? 'From Store' : 'Created recently'}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {activeTab === 'liked' ? (
                    <button
                      onClick={() => onUseSkill(skill as any)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-primary-active text-white text-sm font-medium rounded-lg hover:from-primary-hover hover:to-primary-active transition-all"
                    >
                      <Play className="w-4 h-4" />
                      View Details
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => onUseSkill(skill)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-primary-active text-white text-sm font-medium rounded-lg hover:from-primary-hover hover:to-primary-active transition-all"
                      >
                        <Play className="w-4 h-4" />
                        Use
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(skill.id)}
                        className="p-2.5 text-foreground-tertiary hover:text-error hover:bg-error/10 rounded-lg transition-colors duration-200 cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-error/30"
                        aria-label={`Delete ${skill.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-card rounded-xl p-6 max-w-md w-full border border-border shadow-2xl" role="dialog" aria-modal="true" aria-label="Confirm delete">
            <h3 className="text-lg font-bold text-foreground mb-2">
              Confirm Delete
            </h3>
            <p className="text-sm text-foreground-secondary mb-6">
              Are you sure you want to delete this skill? This action cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 border border-border text-foreground rounded-lg hover:bg-secondary transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2.5 bg-error text-error-foreground rounded-lg hover:bg-error/90 transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-error/50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
