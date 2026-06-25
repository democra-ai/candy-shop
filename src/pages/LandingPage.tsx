import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, Heart, Zap, Package, Users, Shield } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { SKILLS_DATA, REGISTRY_STATS } from '../data/skillsData';
import { useLanguage } from '../contexts/LanguageContext';
import { OfficialCollections } from '../components/home/OfficialCollections';

const FEATURES = [
  {
    icon: Package,
    title: 'Publish Skills',
    titleKey: 'landing.feature.publish',
    description: 'Share your AI agent skills with the community. Upload, version, and manage skill packages.',
    descKey: 'landing.feature.publish.desc',
    color: 'text-info',
    bg: 'bg-info/10',
  },
  {
    icon: Heart,
    title: 'Post Cravings',
    titleKey: 'landing.feature.cravings',
    description: 'Request the skills you need. Post cravings and let skilled agents find you.',
    descKey: 'landing.feature.cravings.desc',
    color: 'text-error',
    bg: 'bg-error/10',
  },
  {
    icon: Zap,
    title: 'Sweet Match',
    titleKey: 'landing.feature.match',
    description: 'Intelligent matching connects candies with cravings. Find the perfect skill instantly.',
    descKey: 'landing.feature.match.desc',
    color: 'text-warning',
    bg: 'bg-warning/10',
  },
  {
    icon: Sparkles,
    title: 'AI-Powered Creation',
    titleKey: 'landing.feature.create',
    description: 'Create skills from files, GitHub repos, or manually. AI analyzes and generates configurations.',
    descKey: 'landing.feature.create.desc',
    color: 'text-accent',
    bg: 'bg-accent/10',
  },
  {
    icon: Users,
    title: 'Community Driven',
    titleKey: 'landing.feature.community',
    description: 'Star, rate, and review skills. Build on the community best practices.',
    descKey: 'landing.feature.community.desc',
    color: 'text-success',
    bg: 'bg-success/10',
  },
  {
    icon: Shield,
    title: 'Enterprise Ready',
    titleKey: 'landing.feature.enterprise',
    description: 'Self-hosted deployment, RBAC, audit logs, and namespace governance.',
    descKey: 'landing.feature.enterprise.desc',
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const popularSkills = SKILLS_DATA
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, 8);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />

        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 relative">
          <div className="text-center max-w-4xl mx-auto">
            <Badge variant="candy" size="lg" className="mb-6">
              {REGISTRY_STATS.totalSkills.toLocaleString()}+ Skills Available
            </Badge>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-candy leading-tight mb-6 text-primary">
              The Sweetest
              <br />
              <span className="text-foreground">AI Skills Marketplace</span>
            </h1>

            <p className="text-lg sm:text-xl text-foreground-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
              {t('hero.subtitle')}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                variant="candy"
                size="lg"
                onClick={() => navigate('/discover')}
                className="text-base px-8"
              >
                Browse Candies
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate('/discover?tab=craving')}
                className="text-base px-8"
              >
                Post a Craving
                <Heart className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              { value: `${(REGISTRY_STATS.totalSkills / 1000).toFixed(0)}K+`, label: 'Skills Indexed' },
              { value: `${(REGISTRY_STATS.totalInstalls / 1000000).toFixed(1)}M+`, label: 'Total Installs' },
              { value: `${(REGISTRY_STATS.totalRepos / 1000).toFixed(1)}K+`, label: 'Repositories' },
            ].map((stat) => (
              <Card key={stat.label} variant="glass" className="text-center py-6 px-4">
                <CardContent className="p-0">
                  <div className="text-3xl font-bold text-primary font-candy">{stat.value}</div>
                  <div className="text-sm text-foreground-secondary mt-1">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 relative">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold font-candy mb-4">
              Everything You Need
            </h2>
            <p className="text-lg text-foreground-secondary max-w-2xl mx-auto">
              A two-sided marketplace connecting AI skill makers with those who need them.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} variant="interactive" className="p-6">
                  <CardContent className="p-0">
                    <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-4`}>
                      <Icon className={`w-6 h-6 ${feature.color}`} />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-foreground-secondary leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Popular Skills */}
      <section className="py-20 bg-backgroundSecondary/50 relative">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold font-candy mb-2">Popular Candies</h2>
              <p className="text-foreground-secondary">Most installed skills across the ecosystem</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/discover')}>
              View All <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {popularSkills.map((skill) => (
              <Card
                key={skill.id}
                variant="interactive"
                className="p-5"
                onClick={() => navigate(`/candy/${skill.id}`)}
              >
                <CardContent className="p-0">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl">{skill.icon}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">{skill.name}</h3>
                      <Badge variant="secondary" size="sm" className="mt-1">
                        {skill.category}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-foreground-secondary line-clamp-2 mb-3">
                    {skill.description}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-foreground-tertiary">
                    <span>{(skill.popularity ?? 0).toLocaleString()} installs</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Official Collections */}
      <OfficialCollections compact />

      {/* CTA */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-primary/5" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <h2 className="text-3xl sm:text-4xl font-bold font-candy mb-4">
            Ready to Find Your Sweet Spot?
          </h2>
          <p className="text-lg text-foreground-secondary mb-8 max-w-2xl mx-auto">
            Join the marketplace where AI skills meet real demands. Whether you're a candy maker or have a craving, we've got you covered.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button variant="candy" size="lg" onClick={() => navigate('/discover')} className="px-8">
              Start Browsing <ArrowRight className="w-5 h-5" />
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate('/skills/create')} className="px-8">
              Create Your First Skill
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
