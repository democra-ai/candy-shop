import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Star, Package, Plus, ArrowRight } from 'lucide-react';
import type { User } from '../lib/supabaseAuth';
import { storageUtils } from '../utils/storage';
import { SKILLS_DATA } from '../data/skillsData';
import { cn } from '../utils/cn';
import { CandyCard } from '../components/home/CandyCard';
import { skillToCard } from '../utils/skillToCard';
import { useIsDark } from '../hooks/useIsDark';
import { getFlavor } from '../utils/candyShells';
import { getCandyEmoji } from '../utils/candy';

type DashboardTab = 'skills' | 'cravings' | 'starred';

interface DashboardPageProps {
  user: User | null;
  onOpenAuth: () => void;
}

export function DashboardPage({ user, onOpenAuth }: DashboardPageProps) {
  const navigate = useNavigate();
  const isDark = useIsDark();
  const [activeTab, setActiveTab] = useState<DashboardTab>('skills');

  const userSkills = useMemo(() => storageUtils.getSkills(), []);
  const userCravings = useMemo(() => storageUtils.getUserCravings(), []);
  const likedIds = useMemo(() => storageUtils.getLikes(), []);
  const starredSkills = useMemo(
    () => SKILLS_DATA.filter((s) => likedIds.includes(s.id)),
    [likedIds]
  );

  // ── Sign-in gate — charming, on-brand empty state ──
  if (!user) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-20 md:py-28">
        <div className="max-w-md mx-auto text-center">
          <div className="mx-auto mb-6 flex items-center justify-center text-7xl leading-none" aria-hidden="true">
            🔒
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground-tertiary mb-2">
            your counter
          </p>
          <h1 className="font-candy font-bold tracking-tight leading-[1.1] text-3xl text-foreground mb-3">
            Sign in to your candy counter
          </h1>
          <p className="text-foreground-secondary mb-7">
            Keep your made candies, cravings and starred jars in one tidy place.
          </p>
          <button
            onClick={onOpenAuth}
            className="candy-btn btn-press inline-flex items-center justify-center h-11 px-7 font-semibold rounded-2xl"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Agent';

  const tabs = [
    { id: 'skills' as const, label: 'My Candies', icon: Package, count: userSkills.length },
    { id: 'cravings' as const, label: 'My Cravings', icon: Heart, count: userCravings.length },
    { id: 'starred' as const, label: 'Starred', icon: Star, count: starredSkills.length },
  ];

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-8 md:py-12">
      {/* Profile Card */}
      <div className="mb-8 bg-card rounded-3xl border border-border shadow-candy-1 p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full border border-border object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-2xl font-bold font-candy text-primary">{displayName[0]?.toUpperCase()}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-candy text-xl font-bold text-foreground truncate">{displayName}</h1>
            <p className="text-sm text-foreground-secondary truncate">{user.email}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 font-mono text-xs text-foreground-tertiary">
              <span>{userSkills.length} made</span>
              <span aria-hidden className="opacity-50">·</span>
              <span>{userCravings.length} cravings</span>
              <span aria-hidden className="opacity-50">·</span>
              <span>{starredSkills.length} starred</span>
            </div>
          </div>
          <button
            onClick={() => navigate('/skills/create')}
            className="inline-flex items-center gap-1.5 h-10 px-5 border border-border bg-card text-foreground font-semibold rounded-2xl hover:border-border-hover hover:shadow-candy-1 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            New skill
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border mb-6 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-ring rounded-t',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-foreground-secondary hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-secondary text-foreground-secondary text-[11px] font-mono">
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'skills' && (
        <div>
          {userSkills.length === 0 ? (
            <EmptyState
              title="No candies yet"
              body="Make your first AI skill or browse the shop for inspiration."
              primary={{ label: 'Make a skill', onClick: () => navigate('/skills/create') }}
              secondary={{ label: 'Browse the shop', onClick: () => navigate('/') }}
            />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {userSkills.map((skill, index) => (
                <CandyCard
                  key={skill.id}
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
                  onSelect={() => navigate('/skills/library')}
                  onRun={() => navigate('/skills/library')}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'cravings' && (
        <div>
          {userCravings.length === 0 ? (
            <EmptyState
              title="No cravings yet"
              body="Post what you wish existed and let makers find you."
              primary={{ label: 'Post a craving', onClick: () => navigate('/?tab=craving') }}
            />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {userCravings.map((craving) => {
                const f = getFlavor(craving.category ?? craving.tags?.[0], isDark);
                return (
                  <button
                    key={craving.id}
                    onClick={() => navigate(`/craving/${craving.id}`)}
                    className="group text-left rounded-2xl p-4 md:p-5 bg-card border border-border shadow-candy-1 candy-lift hover:shadow-candy-2 hover:border-border-hover focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="inline-flex items-center justify-center w-9 h-9 rounded-xl text-xl leading-none shrink-0"
                        style={{ background: f.tint }}
                        aria-hidden="true"
                      >
                        {getCandyEmoji(craving.id)}
                      </span>
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest"
                        style={{ backgroundColor: f.tint, color: f.ink }}
                      >
                        {craving.status}
                      </span>
                    </div>
                    <h3 className="font-candy font-bold text-base leading-[1.15] line-clamp-2 text-foreground">
                      {craving.title}
                    </h3>
                    <p className="mt-1.5 text-xs leading-snug line-clamp-2 text-foreground-secondary">
                      {craving.description}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'starred' && (
        <div>
          {starredSkills.length === 0 ? (
            <EmptyState
              title="No starred candy"
              body="Star skills you love to find them again in a snap."
              primary={{ label: 'Discover skills', onClick: () => navigate('/'), icon: true }}
            />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {starredSkills.map((skill, index) => (
                <CandyCard
                  key={skill.id}
                  skill={skill}
                  index={index}
                  onSelect={() => navigate(`/candy/${skill.id}`)}
                  onRun={() => navigate(`/candy/${skill.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Shared empty-state block ──
interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: boolean;
}

function EmptyState({
  title,
  body,
  primary,
  secondary,
}: {
  title: string;
  body: string;
  primary: EmptyStateAction;
  secondary?: EmptyStateAction;
}) {
  return (
    <div className="text-center py-16 rounded-3xl border border-dashed border-border bg-secondary/40">
      <div className="mx-auto mb-4 flex items-center justify-center text-5xl leading-none" aria-hidden="true">
        🍬
      </div>
      <h3 className="font-candy text-xl font-bold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-foreground-secondary mb-6 max-w-sm mx-auto">{body}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={primary.onClick}
          className="candy-btn btn-press inline-flex items-center gap-1.5 h-10 px-5 font-semibold rounded-2xl"
        >
          {!primary.icon && <Plus className="w-4 h-4" />}
          {primary.label}
          {primary.icon && <ArrowRight className="w-4 h-4" />}
        </button>
        {secondary && (
          <button
            onClick={secondary.onClick}
            className="inline-flex items-center h-10 px-5 border border-border bg-card text-foreground font-semibold rounded-2xl hover:border-border-hover hover:shadow-candy-1 transition-all"
          >
            {secondary.label}
          </button>
        )}
      </div>
    </div>
  );
}
