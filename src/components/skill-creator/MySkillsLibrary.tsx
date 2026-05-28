import { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Filter, Package } from 'lucide-react';
import { storageUtils } from '../../utils/storage';
import type { Skill, SkillCategory } from '../../types/skill-creator';
import { SKILLS_DATA } from '../../data/skillsData';
import { CandyCard } from '../home/CandyCard';
import { skillToCard } from '../../utils/skillToCard';
import { CreatorHeader } from './CreatorHeader';
import { EmptyJar } from '../illustrations';

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

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'created', label: 'Created' },
  { id: 'store', label: 'Purchased' },
  { id: 'liked', label: 'Liked' },
] as const;

const INPUT_CLS =
  'w-full h-10 px-3 bg-input border border-input-border rounded-xl text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring transition-colors';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-6">
      {/* Header */}
      <CreatorHeader
        eyebrow="the candy jar"
        title="My library"
        subtitle="Every candy you've made, bought or starred."
        onBack={onBack}
        action={
          <button
            onClick={onCreateNew}
            className="candy-btn btn-press inline-flex items-center gap-1.5 h-10 px-5 font-semibold rounded-2xl"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New skill</span>
          </button>
        }
      />

      {/* Feedback Messages */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-sm ${
            feedback.type === 'success'
              ? 'bg-success/10 border-success/30 text-success'
              : 'bg-error/10 border-error/30 text-error'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your candy…"
            className={`${INPUT_CLS} pl-9`}
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-foreground-tertiary shrink-0" />
          <select
            value={categoryFilter || ''}
            onChange={(e) => setCategoryFilter(e.target.value || null)}
            className={`${INPUT_CLS} cursor-pointer md:w-48`}
          >
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-200 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-ring rounded-t ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-foreground-secondary hover:text-foreground'
            }`}
            aria-pressed={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Skills Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredSkills.length === 0 ? (
        <div className="text-center py-20 rounded-3xl border border-dashed border-border bg-secondary/40">
          <div className="mx-auto mb-4 flex items-center justify-center">
            {searchQuery || categoryFilter ? (
              <div className="w-16 h-16 rounded-full bg-card border border-border flex items-center justify-center">
                <Package className="w-7 h-7 text-foreground-tertiary" />
              </div>
            ) : (
              <EmptyJar size={96} />
            )}
          </div>
          <h3 className="font-candy text-xl font-bold text-foreground mb-2">
            {searchQuery || categoryFilter
              ? 'No matching candy'
              : activeTab === 'liked'
                ? 'No starred candy yet'
                : 'Your jar is empty'}
          </h3>
          <p className="text-sm text-foreground-secondary mb-6 max-w-sm mx-auto">
            {searchQuery || categoryFilter
              ? 'Try adjusting your search or category.'
              : activeTab === 'liked'
                ? 'Star skills from the shop to keep them here.'
                : 'Make your first skill and it lands right here.'}
          </p>
          {!searchQuery && !categoryFilter && activeTab !== 'liked' && (
            <button
              onClick={onCreateNew}
              className="candy-btn btn-press inline-flex items-center gap-1.5 h-10 px-5 font-semibold rounded-2xl"
            >
              <Plus className="w-4 h-4" />
              Make your first candy
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredSkills.map((skill, index) => (
            <div key={skill.id} className="relative group/lib">
              <CandyCard
                skill={skillToCard({
                  id: skill.id,
                  name: skill.name,
                  description: skill.description,
                  category: skill.category,
                  icon: skill.icon,
                  tags: skill.tags,
                  popularity: skill.popularity,
                })}
                index={index}
                onSelect={() => onUseSkill(skill)}
                onRun={() => onUseSkill(skill)}
              />
              {/* Delete affordance — only for skills the user owns (not store/liked) */}
              {skill.origin !== 'store' && activeTab !== 'liked' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm(skill.id);
                  }}
                  className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-card/90 backdrop-blur-sm border border-border text-foreground-tertiary opacity-0 group-hover/lib:opacity-100 hover:text-error hover:border-error/40 transition-all flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-error/30"
                  aria-label={`Delete ${skill.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-card rounded-3xl p-6 max-w-md w-full border border-border shadow-candy-3 animate-zoom-in" role="dialog" aria-modal="true" aria-label="Confirm delete">
            <h3 className="font-candy text-lg font-bold text-foreground mb-2">
              Delete this candy?
            </h3>
            <p className="text-sm text-foreground-secondary mb-6">
              This removes the skill from your jar for good. This can't be undone.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 h-10 px-4 border border-border text-foreground font-semibold rounded-2xl hover:border-border-hover hover:shadow-candy-1 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="btn-press flex-1 h-10 px-4 bg-error text-error-foreground font-semibold rounded-2xl hover:bg-error/90 transition-colors shadow-candy-1"
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
