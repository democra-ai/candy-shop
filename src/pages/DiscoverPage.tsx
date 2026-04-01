import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SkillsGrid } from '../components/home/SkillsGrid';
import { CravingsGrid } from '../components/home/CravingsGrid';
import { Categories } from '../components/home/Categories';
import { PostCravingModal } from '../components/home/PostCravingModal';
import { PostCandyModal } from '../components/home/PostCandyModal';
import { storageUtils } from '../utils/storage';
import { type Skill as StoreSkill } from '../data/skillsData';
import type { Craving } from '../data/cravingsData';
import type { User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { cn } from '../utils/cn';
import { Candy, Heart } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

type MarketplaceTab = 'candy' | 'craving';

interface DiscoverPageProps {
  user: User | null;
  cart: Set<string>;
  onToggleCart: (id: string) => void;
  onRunSkill: (skill: StoreSkill) => void;
}

export function DiscoverPage({ cart, onToggleCart, onRunSkill }: DiscoverPageProps) {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab: MarketplaceTab = rawTab === 'craving' ? 'craving' : 'candy';

  const [candySearch, setCandySearch] = useState('');
  const [candyTagFilter, setCandyTagFilter] = useState<string | null>(null);
  const [cravingSearch, setCravingSearch] = useState('');
  const [cravingTagFilter, setCravingTagFilter] = useState<string | null>(null);
  const [isPostCravingOpen, setIsPostCravingOpen] = useState(false);
  const [isPostCandyOpen, setIsPostCandyOpen] = useState(false);
  const [userCravings, setUserCravings] = useState<Craving[]>(() => storageUtils.getUserCravings());
  const [userCandies, setUserCandies] = useState<StoreSkill[]>(() => storageUtils.getUserCandies());

  const setActiveTab = (tab: MarketplaceTab) => {
    setSearchParams(tab === 'craving' ? { tab: 'craving' } : {});
  };

  const handleMatchCandy = (tags: string[]) => {
    setCandyTagFilter(tags[0] ?? null);
    setCandySearch('');
    setActiveTab('candy');
  };

  const handleMatchCraving = (tags: string[]) => {
    setCravingTagFilter(tags[0] ?? null);
    setCravingSearch('');
    setActiveTab('craving');
  };

  const handleOpenPostCraving = () => {
    setActiveTab('craving');
    setTimeout(() => setIsPostCravingOpen(true), 100);
  };

  const handleOpenPostCandy = () => {
    setActiveTab('candy');
    setTimeout(() => setIsPostCandyOpen(true), 100);
  };

  const handleSubmitCraving = (craving: Craving) => {
    storageUtils.saveUserCraving(craving);
    setUserCravings(storageUtils.getUserCravings());
    toast.success(`Craving "${craving.title}" posted!`);
  };

  const handleSubmitCandy = (candy: StoreSkill) => {
    storageUtils.saveUserCandy(candy);
    setUserCandies(storageUtils.getUserCandies());
    toast.success(`Candy "${candy.name}" is live!`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Tab Switcher */}
      <div className="flex items-center justify-center mb-8">
        <div className="inline-flex items-center bg-secondary rounded-lg p-1 gap-1">
          <button
            onClick={() => setActiveTab('candy')}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-all duration-200',
              activeTab === 'candy'
                ? 'bg-card text-primary shadow-sm'
                : 'text-foreground-secondary hover:text-foreground'
            )}
          >
            <Candy className="w-4 h-4" />
            {t('nav.candy.user') || 'Find Candy'}
          </button>
          <button
            onClick={() => setActiveTab('craving')}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-all duration-200',
              activeTab === 'craving'
                ? 'bg-card text-primary shadow-sm'
                : 'text-foreground-secondary hover:text-foreground'
            )}
          >
            <Heart className="w-4 h-4" />
            {t('nav.craving.user') || 'Find Craving'}
          </button>
        </div>
      </div>

      {/* Candy Tab */}
      {activeTab === 'candy' && (
        <>
          <Categories
            activeCategory={candyTagFilter}
            onSelectCategory={(tag: string | null) => {
              setCandyTagFilter(tag);
              setCandySearch('');
            }}
          />
          <SkillsGrid
            searchQuery={candySearch}
            setSearchQuery={setCandySearch}
            tagFilter={candyTagFilter}
            setTagFilter={setCandyTagFilter}
            cart={cart}
            onToggleCart={onToggleCart}
            onRunSkill={onRunSkill}
            onMatchCraving={handleMatchCraving}
            userCandies={userCandies}
            onPostCandy={handleOpenPostCandy}
            onPostCraving={handleOpenPostCraving}
          />
        </>
      )}

      {/* Craving Tab */}
      {activeTab === 'craving' && (
        <CravingsGrid
          searchQuery={cravingSearch}
          setSearchQuery={setCravingSearch}
          tagFilter={cravingTagFilter}
          setTagFilter={setCravingTagFilter}
          onMatchCandy={handleMatchCandy}
          onPostCraving={handleOpenPostCraving}
          onPostCandy={handleOpenPostCandy}
          userCravings={userCravings}
        />
      )}

      <PostCravingModal
        isOpen={isPostCravingOpen}
        onClose={() => setIsPostCravingOpen(false)}
        onSubmit={handleSubmitCraving}
      />
      <PostCandyModal
        isOpen={isPostCandyOpen}
        onClose={() => setIsPostCandyOpen(false)}
        onSubmit={handleSubmitCandy}
      />
    </div>
  );
}
