import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Heart, Star, Package, Plus, ArrowRight } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { storageUtils } from '../utils/storage';
import { SKILLS_DATA } from '../data/skillsData';
import { cn } from '../utils/cn';

type DashboardTab = 'skills' | 'cravings' | 'starred';

interface DashboardPageProps {
  user: User | null;
  onOpenAuth: () => void;
}

export function DashboardPage({ user, onOpenAuth }: DashboardPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DashboardTab>('skills');

  const userSkills = useMemo(() => storageUtils.getSkills(), []);
  const userCravings = useMemo(() => storageUtils.getUserCravings(), []);
  const likedIds = useMemo(() => storageUtils.getLikes(), []);
  const starredSkills = useMemo(
    () => SKILLS_DATA.filter((s) => likedIds.includes(s.id)),
    [likedIds]
  );

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="text-5xl mb-4">🔐</div>
        <h1 className="text-2xl font-bold mb-2">Sign in to access your Dashboard</h1>
        <p className="text-foreground-secondary mb-6">
          Manage your skills, cravings, and starred items.
        </p>
        <Button onClick={onOpenAuth}>Sign In</Button>
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Profile Card */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full border-2 border-border" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">{displayName[0]?.toUpperCase()}</span>
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-xl font-bold">{displayName}</h1>
              <p className="text-sm text-foreground-secondary">{user.email}</p>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-xs text-foreground-tertiary">
                  {userSkills.length} skills created
                </span>
                <span className="text-xs text-foreground-tertiary">
                  {userCravings.length} cravings posted
                </span>
                <span className="text-xs text-foreground-tertiary">
                  {starredSkills.length} starred
                </span>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/skills/create')}>
              <Plus className="w-4 h-4" />
              Create Skill
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-foreground-secondary hover:text-foreground hover:border-border'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              <Badge variant="secondary" size="sm">{tab.count}</Badge>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'skills' && (
        <div>
          {userSkills.length === 0 ? (
            <div className="text-center py-16">
              <Sparkles className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No skills yet</h3>
              <p className="text-foreground-secondary mb-4">Create your first AI skill or browse the marketplace.</p>
              <div className="flex justify-center gap-3">
                <Button onClick={() => navigate('/skills/create')}>
                  <Plus className="w-4 h-4" /> Create Skill
                </Button>
                <Button variant="outline" onClick={() => navigate('/discover')}>
                  Browse Marketplace
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {userSkills.map((skill) => (
                <Card key={skill.id} variant="interactive" className="p-5">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{skill.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{skill.name}</h3>
                        <Badge variant={skill.status === 'active' ? 'success' : 'secondary'} size="sm">
                          {skill.status}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-foreground-secondary line-clamp-2">{skill.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'cravings' && (
        <div>
          {userCravings.length === 0 ? (
            <div className="text-center py-16">
              <Heart className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No cravings yet</h3>
              <p className="text-foreground-secondary mb-4">Post what you need and let makers find you.</p>
              <Button onClick={() => navigate('/discover?tab=craving')}>
                Post a Craving
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {userCravings.map((craving) => (
                <Card
                  key={craving.id}
                  variant="interactive"
                  className="p-5"
                  onClick={() => navigate(`/craving/${craving.id}`)}
                >
                  <CardContent className="p-0">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{craving.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{craving.title}</h3>
                        <Badge
                          variant={craving.status === 'open' ? 'success' : 'secondary'}
                          size="sm"
                        >
                          {craving.status}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-foreground-secondary line-clamp-2">{craving.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'starred' && (
        <div>
          {starredSkills.length === 0 ? (
            <div className="text-center py-16">
              <Star className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No starred skills</h3>
              <p className="text-foreground-secondary mb-4">Star skills you like to find them quickly.</p>
              <Button onClick={() => navigate('/discover')}>
                Discover Skills <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {starredSkills.map((skill) => (
                <Card
                  key={skill.id}
                  variant="interactive"
                  className="p-5"
                  onClick={() => navigate(`/candy/${skill.id}`)}
                >
                  <CardContent className="p-0">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{skill.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{skill.name}</h3>
                        <Badge variant="secondary" size="sm">{skill.category}</Badge>
                      </div>
                      <Star className="w-4 h-4 fill-warning text-warning" />
                    </div>
                    <p className="text-xs text-foreground-secondary line-clamp-2">{skill.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
