"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gamepad2,
  Brain,
  Coins,
  Zap,
  MessageSquare,
  Users,
  Sparkles,
  Lock,
  Unlock,
  TrendingUp,
  Target,
  RefreshCw,
  Play,
  Pause,
  Plus,
  Trash2,
  Copy,
  Download,
  Settings,
  ChevronRight,
  Hash,
  Layers,
  Network,
  Atom,
  Shuffle,
  Award,
  Timer,
  Volume2,
  VolumeX,
  Baby,
  GraduationCap,
  Briefcase,
  Microscope,
  Palette,
  BarChart3,
  Trophy,
  Star,
  Heart,
  Rocket,
  Wand2,
  BookOpen,
  Code2,
  Lightbulb,
  Puzzle,
  Music,
  Camera,
  Film,
  Edit3,
  Save,
  Share2,
  Eye,
  ThumbsUp,
  MessageCircle,
  Crown,
  Flame,
  Snowflake,
  Sun,
  Moon,
  Cloud,
  Droplet,
  Leaf,
  Flower2,
  TreePine,
  Bird,
  Fish,
  Bug,
  Ghost,
  Alien,
  Rocket as RocketIcon,
  Planet,
  Star as StarIcon,
  Galaxy,
  User,
  UserPlus,
  Settings2,
  PanelLeft,
  X,
  Check,
  AlertCircle,
  Info,
  HelpCircle,
  Coffee,
  Pizza,
  Apple,
  Cookie,
  Candy,
  Cake,
  Gift,
  PartyPopper,
  Confetti,
} from "lucide-react";
import Link from "next/link";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type UserRole = "kid" | "teen" | "developer" | "researcher" | "enterprise" | "educator" | "hobbyist" | "scientist" | "pm" | "artist";
type GameMode = "charades" | "word-chain" | "story-build" | "riddle-battle" | "emoji-translate" | "concept-map" | "debate" | "improv";
type DifficultyLevel = "beginner" | "intermediate" | "advanced" | "expert";

interface UserProfile {
  id: string;
  role: UserRole;
  displayName: string;
  avatar: string;
  level: number;
  xp: number;
  achievements: string[];
  preferences: UserPreferences;
  stats: UserStats;
}

interface UserPreferences {
  theme: "light" | "dark" | "auto";
  soundEnabled: boolean;
  animationsEnabled: boolean;
  language: string;
  difficulty: DifficultyLevel;
  aiAssistance: boolean;
  showTutorial: boolean;
}

interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  totalTokens: number;
  tokensSaved: number;
  idiomsCreated: number;
  favoriteMode: GameMode;
  streak: number;
  bestStreak: number;
}

interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: "actor" | "guesser" | "judge" | "observer" | "helper" | "challenger";
  personality: string;
  modelType: string;
  tokensUsed: number;
  wins: number;
  idioms: string[];
  color: string;
  unlocked: boolean;
  description: string;
}

interface Constraint {
  id: string;
  type: "rhyme" | "no-letter" | "roast" | "negative" | "haiku" | "emoji-only" | "one-syllable" | "alphabetical" | "pirate" | "shakespeare" | "custom";
  value: string;
  emoji: string;
  penalty: number;
  active: boolean;
  unlocked: boolean;
  category: "beginner" | "intermediate" | "advanced" | "expert";
  description: string;
}

interface GameRound {
  id: string;
  target: string;
  category: string;
  actors: string[];
  guessers: string[];
  judges: string[];
  constraints: Constraint[];
  messages: GameMessage[];
  status: "waiting" | "acting" | "guessing" | "judging" | "complete";
  winner?: string;
  tokenCost: number;
  timeElapsed: number;
  hints: string[];
  hintsUsed: number;
}

interface GameMessage {
  id: string;
  agentId: string;
  content: string;
  type: "description" | "guess" | "judgment" | "idiom-generated" | "hint" | "reaction" | "celebration";
  tokens: number;
  constraintApplied?: string;
  timestamp: number;
  reactions?: { emoji: string; count: number }[];
}

interface Idiom {
  id: string;
  shorthand: string;
  meaning: string;
  originAgents: string[];
  usageCount: number;
  tokenSavings: number;
  seed?: string;
  lockedToSeed: boolean;
  category: string;
  createdBy?: string;
}

interface TokenAnalysis {
  baselineCost: number;
  optimizedCost: number;
  savings: number;
  idiomEfficiency: number;
  attentionJustified: boolean;
  projectedSavings: number;
  efficiencyTrend: "up" | "down" | "stable";
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  emoji: string;
  unlocked: boolean;
  progress: number;
  total: number;
  category: "gameplay" | "social" | "creative" | "efficiency" | "learning";
  xpReward: number;
}

interface WordCategory {
  id: string;
  name: string;
  emoji: string;
  words: string[];
  difficulty: DifficultyLevel;
  unlocked: boolean;
}

// ============================================================================
// CONSTANTS & DATA
// ============================================================================

const USER_ROLE_CONFIG: Record<UserRole, {
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
  defaultDifficulty: DifficultyLevel;
  features: string[];
}> = {
  kid: {
    label: "Young Explorer",
    icon: Baby,
    color: "#10B981",
    description: "Learn through play! Fun games and friendly AI helpers.",
    defaultDifficulty: "beginner",
    features: ["Friendly avatars", "Picture hints", "Celebration animations", "Simple words", "Voice support"]
  },
  teen: {
    label: "Challenger",
    icon: Flame,
    color: "#F59E0B",
    description: "Compete, create, and connect with friends!",
    defaultDifficulty: "intermediate",
    features: ["Leaderboards", "Multiplayer", "Custom games", "Social sharing", "Achievements"]
  },
  developer: {
    label: "Builder",
    icon: Code2,
    color: "#6366F1",
    description: "Build agents, APIs, and custom game logic.",
    defaultDifficulty: "advanced",
    features: ["Agent editor", "API access", "Debug mode", "Token analytics", "Export tools"]
  },
  researcher: {
    label: "Researcher",
    icon: Microscope,
    color: "#8B5CF6",
    description: "Study AI communication patterns and collect data.",
    defaultDifficulty: "advanced",
    features: ["Data export", "Pattern analysis", "Experiment builder", "Citation tools", "Privacy controls"]
  },
  enterprise: {
    label: "Enterprise",
    icon: Briefcase,
    color: "#0EA5E9",
    description: "Optimize business communication and train custom models.",
    defaultDifficulty: "intermediate",
    features: ["Team management", "Custom idioms", "Analytics dashboard", "SSO", "Support"]
  },
  educator: {
    label: "Educator",
    icon: BookOpen,
    color: "#EC4899",
    description: "Create lessons and track student progress.",
    defaultDifficulty: "intermediate",
    features: ["Lesson builder", "Student tracking", "Assignments", "Progress reports", "Curriculum tools"]
  },
  hobbyist: {
    label: "Enthusiast",
    icon: Wand2,
    color: "#14B8A6",
    description: "Experiment with AI and create fun experiences.",
    defaultDifficulty: "intermediate",
    features: ["Playground mode", "Experiment tools", "Community sharing", "Templates", "Tutorials"]
  },
  scientist: {
    label: "Data Scientist",
    icon: BarChart3,
    color: "#F97316",
    description: "Analyze patterns and build predictive models.",
    defaultDifficulty: "expert",
    features: ["Data pipelines", "ML tools", "Visualization", "Statistical analysis", "Export formats"]
  },
  pm: {
    label: "Product Manager",
    icon: Target,
    color: "#84CC16",
    description: "A/B test UX and gather insights.",
    defaultDifficulty: "intermediate",
    features: ["Experiment builder", "Metrics", "User recordings", "Heatmaps", "Feedback tools"]
  },
  artist: {
    label: "Creative",
    icon: Palette,
    color: "#D946EF",
    description: "Generate art, stories, and creative content.",
    defaultDifficulty: "beginner",
    features: ["Generative tools", "Style transfer", "Story mode", "Art prompts", "Gallery"]
  }
};

const GAME_MODES: Record<GameMode, {
  label: string;
  description: string;
  icon: React.ElementType;
  difficulty: DifficultyLevel;
  minPlayers: number;
  maxPlayers: number;
  avgTokens: number;
}> = {
  charades: {
    label: "Charades",
    description: "Classic guessing game - describe without saying the word!",
    icon: MessageSquare,
    difficulty: "beginner",
    minPlayers: 2,
    maxPlayers: 8,
    avgTokens: 150
  },
  "word-chain": {
    label: "Word Chain",
    description: "Each word must start with the last letter of the previous word.",
    icon: ChevronRight,
    difficulty: "beginner",
    minPlayers: 2,
    maxPlayers: 10,
    avgTokens: 80
  },
  "story-build": {
    label: "Story Builder",
    description: "Collaboratively create a story, one sentence at a time.",
    icon: BookOpen,
    difficulty: "intermediate",
    minPlayers: 2,
    maxPlayers: 6,
    avgTokens: 200
  },
  "riddle-battle": {
    label: "Riddle Battle",
    description: "Create and solve riddles competitively.",
    icon: Sparkles,
    difficulty: "intermediate",
    minPlayers: 2,
    maxPlayers: 4,
    avgTokens: 180
  },
  "emoji-translate": {
    label: "Emoji Translator",
    description: "Translate phrases using only emojis.",
    icon: Sun,
    difficulty: "beginner",
    minPlayers: 2,
    maxPlayers: 6,
    avgTokens: 60
  },
  "concept-map": {
    label: "Concept Mapping",
    description: "Build knowledge graphs through collaborative connections.",
    icon: Network,
    difficulty: "advanced",
    minPlayers: 2,
    maxPlayers: 4,
    avgTokens: 250
  },
  debate: {
    label: "AI Debate",
    description: "Structured debates with AI judges scoring arguments.",
    icon: MessageCircle,
    difficulty: "expert",
    minPlayers: 2,
    maxPlayers: 2,
    avgTokens: 400
  },
  improv: {
    label: "Improv Theater",
    description: "Spontaneous scenes and characters with audience suggestions.",
    icon: Palette,
    difficulty: "advanced",
    minPlayers: 2,
    maxPlayers: 8,
    avgTokens: 300
  }
};

const CONSTRAINT_TEMPLATES: Constraint[] = [
  { id: "1", type: "rhyme", value: "Your descriptions must rhyme!", emoji: "🎭", penalty: 1.2, active: false, unlocked: true, category: "beginner", description: "Make every line rhyme like a poem" },
  { id: "2", type: "no-letter", value: "Don't use the letter 'E'!", emoji: "🚫", penalty: 1.5, active: false, unlocked: true, category: "intermediate", description: "A lipogram challenge - avoid the most common letter" },
  { id: "3", type: "roast", value: "Roast your opponents playfully!", emoji: "🔥", penalty: 1.3, active: false, unlocked: true, category: "teen", description: "Give a funny burn and score it 0-100" },
  { id: "4", type: "negative", value: "Only describe what it's NOT", emoji: "➖", penalty: 1.4, active: false, unlocked: true, category: "beginner", description: "Reverse psychology - negatives only" },
  { id: "5", type: "haiku", value: "Speak only in haiku (5-7-5)", emoji: "🌸", penalty: 1.1, active: false, unlocked: true, category: "intermediate", description: "Traditional Japanese poetry format" },
  { id: "6", type: "emoji-only", value: "Only emojis, no words!", emoji: "😀", penalty: 1.6, active: false, unlocked: true, category: "beginner", description: "Pure visual communication" },
  { id: "7", type: "one-syllable", value: "One syllable words only!", emoji: "🎵", penalty: 1.3, active: false, unlocked: false, category: "intermediate", description: "Keep it simple, one beat at a time" },
  { id: "8", type: "alphabetical", value: "Each word starts with next letter!", emoji: "🔤", penalty: 1.7, active: false, unlocked: false, category: "advanced", description: "A-B-C-D... sequential speaking" },
  { id: "9", type: "pirate", value: "Talk like a pirate, matey!", emoji: "🏴‍☠️", penalty: 1.2, active: false, unlocked: false, category: "beginner", description: "Arrr, speak the seven seas way" },
  { id: "10", type: "shakespeare", value: "Speak like Shakespeare!", emoji: "🎭", penalty: 1.4, active: false, unlocked: false, category: "advanced", description: "Thee must speak in Olde English" },
];

const AGENT_TEMPLATES: Agent[] = [
  { id: "a1", name: "Riddler", emoji: "🧩", role: "actor", personality: "mysterious", modelType: "gpt-4", tokensUsed: 0, wins: 0, idioms: [], color: "#10B981", unlocked: true, description: "Loves cryptic clues and wordplay" },
  { id: "a2", name: "Oracle", emoji: "🔮", role: "guesser", personality: "wise", modelType: "claude-3", tokensUsed: 0, wins: 0, idioms: [], color: "#8B5CF6", unlocked: true, description: "Analytical and thoughtful" },
  { id: "a3", name: "Jester", emoji: "🃏", role: "actor", personality: "playful", modelType: "gemini-pro", tokensUsed: 0, wins: 0, idioms: [], color: "#F59E0B", unlocked: true, description: "Funny and unpredictable" },
  { id: "a4", name: "Sage", emoji: "🦉", role: "judge", personality: "fair", modelType: "gpt-4", tokensUsed: 0, wins: 0, idioms: [], color: "#EC4899", unlocked: true, description: "Balanced and encouraging" },
  { id: "a5", name: "Sparky", emoji: "⚡", role: "helper", personality: "energetic", modelType: "claude-3", tokensUsed: 0, wins: 0, idioms: [], color: "#FCD34D", unlocked: false, description: "Gives hints and encouragement" },
  { id: "a6", name: "Shadow", emoji: "🌑", role: "challenger", personality: "tricky", modelType: "gemini-pro", tokensUsed: 0, wins: 0, idioms: [], color: "#374151", unlocked: false, description: "Adds twists and challenges" },
  { id: "a7", name: "Buddy", emoji: "🤗", role: "helper", personality: "friendly", modelType: "gpt-4", tokensUsed: 0, wins: 0, idioms: [], color: "#FB923C", unlocked: false, description: "Perfect for kids - super supportive!" },
  { id: "a8", name: "Pixel", emoji: "👾", role: "actor", personality: "gamer", modelType: "claude-3", tokensUsed: 0, wins: 0, idioms: [], color: "#A855F7", unlocked: false, description: "Speaks in gaming terms" },
];

const WORD_CATEGORIES: WordCategory[] = [
  { id: "animals", name: "Animals", emoji: "🐾", words: ["ELEPHANT", "PENGUIN", "GIRAFFE", "DOLPHIN", "BUTTERFLY"], difficulty: "beginner", unlocked: true },
  { id: "food", name: "Food", emoji: "🍕", words: ["PIZZA", "BANANA", "CHOCOLATE", "SPAGHETTI", "ICE CREAM"], difficulty: "beginner", unlocked: true },
  { id: "nature", name: "Nature", emoji: "🌿", words: ["RAINBOW", "MOUNTAIN", "OCEAN", "VOLCANO", "WATERFALL"], difficulty: "beginner", unlocked: true },
  { id: "tech", name: "Technology", emoji: "💻", words: ["COMPUTER", "ROBOT", "SATELLITE", "ALGORITHM", "BLOCKCHAIN"], difficulty: "intermediate", unlocked: true },
  { id: "science", name: "Science", emoji: "🔬", words: ["GRAVITY", "MOLECULE", "ECOSYSTEM", "PHOTON", "EVOLUTION"], difficulty: "intermediate", unlocked: true },
  { id: "emotions", name: "Emotions", emoji: "💭", words: ["HAPPINESS", "CURIOSITY", "NOSTALGIA", "EXCITEMENT", "SURPRISE"], difficulty: "intermediate", unlocked: true },
  { id: "concepts", name: "Abstract Concepts", emoji: "🧠", words: ["FREEDOM", "JUSTICE", "INFINITY", "PARADOX", "SERENDIPITY"], difficulty: "advanced", unlocked: false },
  { id: "professions", name: "Jobs", emoji: "👔", words: ["ASTRONAUT", "ARCHITECT", "DETECTIVE", "INVENTOR", "PHILOSOPHER"], difficulty: "beginner", unlocked: true },
];

const ACHIEVEMENTS: Achievement[] = [
  { id: "first_game", name: "First Steps", description: "Complete your first game", emoji: "🎮", unlocked: false, progress: 0, total: 1, category: "gameplay", xpReward: 50 },
  { id: "win_streak_5", name: "On Fire!", description: "Win 5 games in a row", emoji: "🔥", unlocked: false, progress: 0, total: 5, category: "gameplay", xpReward: 200 },
  { id: "idiom_creator", name: "Language Inventor", description: "Create 10 idioms", emoji: "💡", unlocked: false, progress: 0, total: 10, category: "creative", xpReward: 150 },
  { id: "token_saver", name: "Efficiency Expert", description: "Save 1000 tokens", emoji: "💰", unlocked: false, progress: 0, total: 1000, category: "efficiency", xpReward: 100 },
  { id: "constraint_master", name: "Constraint Master", description: "Use all constraint types", emoji: "🏆", unlocked: false, progress: 0, total: 10, category: "gameplay", xpReward: 250 },
  { id: "social_butterfly", name: "Social Butterfly", description: "Play with 10 different friends", emoji: "🦋", unlocked: false, progress: 0, total: 10, category: "social", xpReward: 100 },
  { id: "quick_learner", name: "Quick Learner", description: "Guess correctly in under 3 turns", emoji: "⚡", unlocked: false, progress: 0, total: 5, category: "gameplay", xpReward: 150 },
  { id: "teacher", name: "Teacher", description: "Help others learn 5 new concepts", emoji: "📚", unlocked: false, progress: 0, total: 5, category: "learning", xpReward: 200 },
];

const SAMPLE_IDIOMS: Idiom[] = [
  { id: "i1", shorthand: "🧊💨", meaning: "Cold shoulder - ignore/dismiss", originAgents: ["a1", "a2"], usageCount: 47, tokenSavings: 142, lockedToSeed: false, category: "social" },
  { id: "i2", shorthand: "🎲→🎯", meaning: "Random becomes intentional", originAgents: ["a2", "a3"], usageCount: 23, tokenSavings: 89, lockedToSeed: true, seed: "seed_7x9_omega", category: "strategy" },
  { id: "i3", shorthand: "🌊🧠", meaning: "Deep thought / flow state", originAgents: ["a1", "a3"], usageCount: 156, tokenSavings: 312, lockedToSeed: false, category: "mental" },
  { id: "i4", shorthand: "🔥🧩", meaning: "Challenging but exciting", originAgents: ["a3", "a4"], usageCount: 34, tokenSavings: 78, lockedToSeed: false, category: "emotional" },
  { id: "i5", shorthand: "👀💡", meaning: "I see the idea now!", originAgents: ["a2", "a4"], usageCount: 89, tokenSavings: 167, lockedToSeed: false, category: "learning" },
];

// ============================================================================
// CHILD COMPONENTS
// ============================================================================

// Role Selection Modal
function RoleSelectionModal({ onSelect, currentRole }: { onSelect: (role: UserRole) => void; currentRole?: UserRole }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-900 rounded-3xl p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-3xl font-bold text-white text-center mb-2">Welcome to LLN Playground!</h2>
        <p className="text-slate-400 text-center mb-8">Choose your adventure type to get started</p>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {(Object.entries(USER_ROLE_CONFIG) as [UserRole, typeof USER_ROLE_CONFIG[UserRole]][]).map(([role, config]) => (
            <motion.button
              key={role}
              onClick={() => onSelect(role)}
              className={`p-4 rounded-2xl border-2 transition-all ${
                currentRole === role
                  ? 'border-white bg-white/10'
                  : 'border-slate-700 hover:border-slate-500 bg-slate-800/50'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                style={{ backgroundColor: config.color + '30' }}
              >
                <config.icon className="w-6 h-6" style={{ color: config.color }} />
              </div>
              <h3 className="text-white font-semibold text-sm text-center">{config.label}</h3>
              <p className="text-slate-500 text-xs text-center mt-1 line-clamp-2">{config.description}</p>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// Game Mode Selector
function GameModeSelector({ 
  selectedMode, 
  onSelect, 
  userRole,
  unlockedOnly = true 
}: { 
  selectedMode: GameMode; 
  onSelect: (mode: GameMode) => void;
  userRole: UserRole;
  unlockedOnly?: boolean;
}) {
  const modes = Object.entries(GAME_MODES) as [GameMode, typeof GAME_MODES[GameMode]][];
  const roleConfig = USER_ROLE_CONFIG[userRole];
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {modes.map(([modeId, mode]) => (
        <motion.button
          key={modeId}
          onClick={() => onSelect(modeId)}
          className={`p-4 rounded-xl border-2 transition-all text-left ${
            selectedMode === modeId
              ? 'border-purple-500 bg-purple-500/20'
              : 'border-slate-700 hover:border-slate-500 bg-slate-800/50'
          }`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <mode.icon className="w-5 h-5 text-purple-400" />
            <span className="text-white font-medium text-sm">{mode.label}</span>
          </div>
          <p className="text-slate-500 text-xs line-clamp-2">{mode.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs px-2 py-0.5 rounded ${
              mode.difficulty === 'beginner' ? 'bg-green-500/20 text-green-400' :
              mode.difficulty === 'intermediate' ? 'bg-yellow-500/20 text-yellow-400' :
              mode.difficulty === 'advanced' ? 'bg-orange-500/20 text-orange-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {mode.difficulty}
            </span>
            <span className="text-xs text-slate-600">~{mode.avgTokens}t</span>
          </div>
        </motion.button>
      ))}
    </div>
  );
}

// Word Category Selector
function WordCategorySelector({
  selectedCategory,
  onSelect,
  userRole,
}: {
  selectedCategory: string;
  onSelect: (categoryId: string) => void;
  userRole: UserRole;
}) {
  const categories = WORD_CATEGORIES.filter(c => c.unlocked || userRole === 'developer');
  
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map(category => (
        <motion.button
          key={category.id}
          onClick={() => onSelect(category.id)}
          className={`px-4 py-2 rounded-xl border transition-all flex items-center gap-2 ${
            selectedCategory === category.id
              ? 'border-purple-500 bg-purple-500/20 text-white'
              : 'border-slate-700 hover:border-slate-500 bg-slate-800/50 text-slate-400'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="text-lg">{category.emoji}</span>
          <span className="text-sm">{category.name}</span>
        </motion.button>
      ))}
    </div>
  );
}

// Achievement Badge
function AchievementBadge({ achievement }: { achievement: Achievement }) {
  const progressPercent = (achievement.progress / achievement.total) * 100;
  
  return (
    <motion.div
      className={`p-4 rounded-xl border ${
        achievement.unlocked 
          ? 'border-amber-500/50 bg-amber-500/10' 
          : 'border-slate-700/50 bg-slate-800/50'
      }`}
      whileHover={{ scale: 1.02 }}
    >
      <div className="flex items-start gap-3">
        <div className={`text-3xl ${achievement.unlocked ? '' : 'grayscale opacity-50'}`}>
          {achievement.emoji}
        </div>
        <div className="flex-1">
          <h4 className={`font-medium ${achievement.unlocked ? 'text-amber-400' : 'text-slate-400'}`}>
            {achievement.name}
          </h4>
          <p className="text-slate-500 text-xs mt-0.5">{achievement.description}</p>
          {!achievement.unlocked && (
            <div className="mt-2">
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-purple-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs text-slate-600 mt-1">
                {achievement.progress}/{achievement.total}
              </span>
            </div>
          )}
        </div>
        <div className="text-xs text-amber-400">
          +{achievement.xpReward} XP
        </div>
      </div>
    </motion.div>
  );
}

// Kid-Friendly Game UI
function KidFriendlyUI({
  targetWord,
  messages,
  isPlaying,
  onPlay,
  agents,
  category,
}: {
  targetWord: string;
  messages: GameMessage[];
  isPlaying: boolean;
  onPlay: () => void;
  agents: Agent[];
  category: string;
}) {
  const categoryData = WORD_CATEGORIES.find(c => c.id === category);
  
  return (
    <div className="bg-gradient-to-br from-green-900/30 to-blue-900/30 rounded-3xl p-6 border-2 border-green-500/30">
      {/* Fun Header */}
      <div className="text-center mb-6">
        <motion.div
          className="text-6xl mb-4"
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {categoryData?.emoji || "🎮"}
        </motion.div>
        <h2 className="text-2xl font-bold text-white">Let's Play!</h2>
        <p className="text-green-300">Guess the secret word!</p>
      </div>

      {/* Friendly Agents */}
      <div className="flex justify-center gap-4 mb-6">
        {agents.filter(a => a.unlocked).slice(0, 3).map((agent, idx) => (
          <motion.div
            key={agent.id}
            className="text-center"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 1.5, delay: idx * 0.2, repeat: Infinity }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-2"
              style={{ backgroundColor: agent.color + '30' }}
            >
              {agent.emoji}
            </div>
            <span className="text-white text-sm">{agent.name}</span>
          </motion.div>
        ))}
      </div>

      {/* Messages in Kid-Friendly Style */}
      <div className="space-y-4 mb-6 max-h-60 overflow-y-auto">
        {messages.map(msg => {
          const agent = agents.find(a => a.id === msg.agentId);
          return (
            <motion.div
              key={msg.id}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`p-4 rounded-2xl ${
                msg.type === 'celebration'
                  ? 'bg-yellow-500/20 border-2 border-yellow-500'
                  : 'bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{agent?.emoji || "🤖"}</span>
                <div>
                  <span className="font-medium text-white">{agent?.name}: </span>
                  <span className="text-slate-300">{msg.content}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Play Button */}
      <motion.button
        onClick={onPlay}
        disabled={isPlaying}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-green-400 to-blue-500 text-white font-bold text-xl flex items-center justify-center gap-3 disabled:opacity-50"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {isPlaying ? (
          <>
            <RefreshCw className="w-6 h-6 animate-spin" />
            Playing...
          </>
        ) : (
          <>
            <Play className="w-6 h-6" />
            Start Game!
          </>
        )}
      </motion.button>

      {/* Celebration */}
      {messages.some(m => m.type === 'celebration') && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-6 p-6 bg-yellow-500/20 rounded-2xl text-center border-2 border-yellow-500"
        >
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="text-5xl mb-2"
          >
            🎉
          </motion.div>
          <h3 className="text-2xl font-bold text-yellow-400">You Got It!</h3>
          <p className="text-yellow-300">Amazing job! You're so smart!</p>
          <div className="flex justify-center gap-2 mt-4">
            <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
            <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
            <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Teen Competitive UI
function TeenCompetitiveUI({
  targetWord,
  messages,
  isPlaying,
  onPlay,
  agents,
  tokenCost,
  roundHistory,
  achievements,
}: {
  targetWord: string;
  messages: GameMessage[];
  isPlaying: boolean;
  onPlay: () => void;
  agents: Agent[];
  tokenCost: number;
  roundHistory: GameRound[];
  achievements: Achievement[];
}) {
  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            <span className="text-white font-bold">3 Streak</span>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span className="text-white">{roundHistory.filter(r => r.winner).length} Wins</span>
          </div>
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-400" />
            <span className="text-white">{tokenCost} Tokens</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {achievements.filter(a => a.unlocked).slice(0, 3).map(a => (
            <span key={a.id} className="text-xl" title={a.name}>{a.emoji}</span>
          ))}
        </div>
      </div>

      {/* Game Area */}
      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Battle Arena
          </h2>
          <motion.button
            onClick={onPlay}
            disabled={isPlaying}
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold flex items-center gap-2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isPlaying ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Battling...
              </>
            ) : (
              <>
                <Sword className="w-4 h-4" />
                Battle!
              </>
            )}
          </motion.button>
        </div>

        {/* Messages */}
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {messages.map(msg => {
            const agent = agents.find(a => a.id === msg.agentId);
            return (
              <motion.div
                key={msg.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className={`p-3 rounded-xl ${
                  msg.type === 'guess' ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-slate-900/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{agent?.emoji}</span>
                  <div className="flex-1">
                    <span className="font-medium text-white">{agent?.name}: </span>
                    <span className="text-slate-300">{msg.content}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {msg.reactions?.map(r => (
                      <span key={r.emoji} className="text-sm">{r.emoji} {r.count}</span>
                    ))}
                    <span className="text-xs text-amber-400">{msg.tokens}t</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Sword icon fallback
function Sword({ className }: { className?: string }) {
  return <span className={className}>⚔️</span>;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function LLNPlayground() {
  // User State
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showRoleSelector, setShowRoleSelector] = useState(true);
  
  // Game State
  const [selectedMode, setSelectedMode] = useState<GameMode>("charades");
  const [selectedCategory, setSelectedCategory] = useState("animals");
  const [agents, setAgents] = useState<Agent[]>(AGENT_TEMPLATES);
  const [constraints, setConstraints] = useState<Constraint[]>(CONSTRAINT_TEMPLATES);
  const [activeConstraints, setActiveConstraints] = useState<Constraint[]>([]);
  const [idioms, setIdioms] = useState<Idiom[]>(SAMPLE_IDIOMS);
  const [achievements, setAchievements] = useState<Achievement[]>(ACHIEVEMENTS);
  
  // Play State
  const [currentRound, setCurrentRound] = useState<GameRound | null>(null);
  const [messages, setMessages] = useState<GameMessage[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [roundHistory, setRoundHistory] = useState<GameRound[]>([]);
  const [useRealAI, setUseRealAI] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  
  // Analysis State
  const [tokenAnalysis, setTokenAnalysis] = useState<TokenAnalysis>({
    baselineCost: 1000,
    optimizedCost: 650,
    savings: 350,
    idiomEfficiency: 0.35,
    attentionJustified: true,
    projectedSavings: 500,
    efficiencyTrend: "up",
  });

  // Derived values
  const categoryWords = WORD_CATEGORIES.find(c => c.id === selectedCategory)?.words || [];
  const targetWord = categoryWords[Math.floor(Math.random() * categoryWords.length)] || "BANANA";

  // Handlers
  const handleRoleSelect = (role: UserRole) => {
    const config = USER_ROLE_CONFIG[role];
    setUserProfile({
      id: `user_${Date.now()}`,
      role,
      displayName: config.label,
      avatar: "🎮",
      level: 1,
      xp: 0,
      achievements: [],
      preferences: {
        theme: "dark",
        soundEnabled: true,
        animationsEnabled: true,
        language: "en",
        difficulty: config.defaultDifficulty,
        aiAssistance: false,
        showTutorial: true,
      },
      stats: {
        gamesPlayed: 0,
        gamesWon: 0,
        totalTokens: 0,
        tokensSaved: 0,
        idiomsCreated: 0,
        favoriteMode: "charades",
        streak: 0,
        bestStreak: 0,
      },
    });
    setShowRoleSelector(false);
  };

  const toggleConstraint = (constraint: Constraint) => {
    if (activeConstraints.find(c => c.id === constraint.id)) {
      setActiveConstraints(prev => prev.filter(c => c.id !== constraint.id));
    } else {
      setActiveConstraints(prev => [...prev, constraint]);
    }
  };

  const toggleIdiomLock = (idiom: Idiom) => {
    setIdioms(prev => prev.map(i =>
      i.id === idiom.id
        ? { ...i, lockedToSeed: !i.lockedToSeed, seed: i.lockedToSeed ? undefined : `seed_${Math.random().toString(36).substr(2, 9)}` }
        : i
    ));
  };

  // Game simulation
  const simulateRound = useCallback(async () => {
    if (!targetWord) return;

    const round: GameRound = {
      id: `round_${Date.now()}`,
      target: targetWord.toUpperCase(),
      category: selectedCategory,
      actors: agents.filter(a => a.role === "actor" && a.unlocked).map(a => a.id),
      guessers: agents.filter(a => a.role === "guesser" && a.unlocked).map(a => a.id),
      judges: agents.filter(a => a.role === "judge" && a.unlocked).map(a => a.id),
      constraints: activeConstraints,
      messages: [],
      status: "acting",
      tokenCost: 0,
      timeElapsed: 0,
      hints: [],
      hintsUsed: 0,
    };

    setCurrentRound(round);
    setMessages([]);
    setIsPlaying(true);

    const actors = agents.filter(a => a.role === "actor" && a.unlocked);
    const guessers = agents.filter(a => a.role === "guesser" && a.unlocked);

    // Generate descriptions
    for (const actor of actors) {
      await new Promise(resolve => setTimeout(resolve, 800));
      const desc = generateDescription(targetWord, activeConstraints, actor);
      const msg: GameMessage = {
        id: `msg_${Date.now()}`,
        agentId: actor.id,
        content: desc,
        type: "description",
        tokens: Math.floor(desc.length * 0.3 * (activeConstraints.length > 0 ? 1.3 : 1)),
        constraintApplied: activeConstraints[0]?.type,
        timestamp: Date.now(),
        reactions: [{ emoji: "👍", count: Math.floor(Math.random() * 5) + 1 }],
      };
      setMessages(prev => [...prev, msg]);
      setCurrentRound(prev => prev ? { ...prev, tokenCost: prev.tokenCost + msg.tokens } : null);
    }

    // Generate guesses
    await new Promise(resolve => setTimeout(resolve, 1000));
    round.status = "guessing";
    setCurrentRound({ ...round });

    for (const guesser of guessers) {
      await new Promise(resolve => setTimeout(resolve, 600));
      const guess = generateGuess(targetWord, activeConstraints);
      const msg: GameMessage = {
        id: `msg_${Date.now()}`,
        agentId: guesser.id,
        content: guess,
        type: "guess",
        tokens: Math.floor(guess.length * 0.25),
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, msg]);
      setCurrentRound(prev => prev ? { ...prev, tokenCost: prev.tokenCost + msg.tokens } : null);

      if (guess.toLowerCase().includes(targetWord.toLowerCase())) {
        round.winner = guesser.id;
        round.status = "complete";
        setCurrentRound({ ...round });

        // Celebration message
        const celebrationMsg: GameMessage = {
          id: `msg_${Date.now()}`,
          agentId: "system",
          content: `🎉 ${guesser.name} got it! The word was "${targetWord.toUpperCase()}"!`,
          type: "celebration",
          tokens: 0,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, celebrationMsg]);

        // Generate idiom
        if (activeConstraints.length > 0) {
          const newIdiom = generateIdiom(actors[0], guesser, targetWord);
          setIdioms(prev => [...prev, newIdiom]);
        }
        break;
      }
    }

    if (!round.winner) {
      round.status = "judging";
      setCurrentRound({ ...round });
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const judge = agents.find(a => a.role === "judge" && a.unlocked);
      if (judge) {
        const judgment = `The word was "${targetWord.toUpperCase()}". Great effort! Try again?`;
        const msg: GameMessage = {
          id: `msg_${Date.now()}`,
          agentId: judge.id,
          content: judgment,
          type: "judgment",
          tokens: 15,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, msg]);
      }
      round.status = "complete";
      setCurrentRound({ ...round });
    }

    setRoundHistory(prev => [...prev, round]);
    setIsPlaying(false);
  }, [targetWord, agents, activeConstraints, selectedCategory]);

  // Helper functions
  const generateDescription = (target: string, constraints: Constraint[], actor: Agent): string => {
    const descriptions: Record<string, string[]> = {
      "BANANA": ["Yellow curve that monkeys love!", "You peel it before eating!", "A fruit shaped like a smile!"],
      "ELEPHANT": ["Big gray friend with a trunk!", "Never forgets anything!", "Largest land animal!"],
      "PENGUIN": ["Wears a tuxedo everyday!", "Waddles on ice!", "Lives where it's super cold!"],
    };
    let base = descriptions[target]?.[Math.floor(Math.random() * 3)] || "Something fun and exciting!";
    
    for (const constraint of constraints) {
      switch (constraint.type) {
        case "rhyme":
          base = base.includes("love") ? "Yellow curve, monkeys love, fits like a glove!" : base + " - time to play!";
          break;
        case "emoji-only":
          base = "🍌🐒💛🎉";
          break;
        case "haiku":
          base = "Yellow curved shape\nMonkeys love to peel and eat\nSweet soft fruit inside";
          break;
      }
    }
    return base;
  };

  const generateGuess = (target: string, constraints: Constraint[]): string => {
    if (Math.random() > 0.4) {
      return `Is it... ${target.toUpperCase()}?`;
    }
    const wrongGuesses = ["Apple?", "Orange?", "Grape?", "Mango?"];
    return wrongGuesses[Math.floor(Math.random() * wrongGuesses.length)];
  };

  const generateIdiom = (actor: Agent, guesser: Agent, target: string): Idiom => {
    const idioms = [
      { shorthand: "🍌🎯", meaning: `Quick win - ${target} identified fast!` },
      { shorthand: "💡⚡", meaning: "Instant understanding!" },
      { shorthand: "🎪🏆", meaning: "Performance success!" },
    ];
    const chosen = idioms[Math.floor(Math.random() * idioms.length)];
    return {
      id: `idiom_${Date.now()}`,
      shorthand: chosen.shorthand,
      meaning: chosen.meaning,
      originAgents: [actor.id, guesser.id],
      usageCount: 1,
      tokenSavings: Math.floor(Math.random() * 50) + 20,
      lockedToSeed: false,
      category: selectedCategory,
    };
  };

  // Update token analysis
  useEffect(() => {
    const idiomSavings = idioms.reduce((acc, i) => acc + i.tokenSavings, 0);
    const constraintPenalty = activeConstraints.reduce((acc, c) => acc + c.penalty, 0);
    const baseline = 1000;
    const optimized = Math.max(100, baseline - idiomSavings + (constraintPenalty - 1) * 100);

    setTokenAnalysis({
      baselineCost: baseline,
      optimizedCost: Math.round(optimized),
      savings: Math.round(baseline - optimized),
      idiomEfficiency: idiomSavings / baseline,
      attentionJustified: (baseline - optimized) > 200,
      projectedSavings: Math.round(idiomSavings * 1.5),
      efficiencyTrend: baseline - optimized > 300 ? "up" : baseline - optimized > 200 ? "stable" : "down",
    });
  }, [idioms, activeConstraints]);

  // Render role-specific UI
  const renderRoleSpecificUI = () => {
    if (!userProfile) return null;

    switch (userProfile.role) {
      case "kid":
        return (
          <KidFriendlyUI
            targetWord={targetWord}
            messages={messages}
            isPlaying={isPlaying}
            onPlay={simulateRound}
            agents={agents}
            category={selectedCategory}
          />
        );
      case "teen":
        return (
          <TeenCompetitiveUI
            targetWord={targetWord}
            messages={messages}
            isPlaying={isPlaying}
            onPlay={simulateRound}
            agents={agents}
            tokenCost={currentRound?.tokenCost || 0}
            roundHistory={roundHistory}
            achievements={achievements}
          />
        );
      default:
        return renderDefaultUI();
    }
  };

  // Default UI for other roles
  const renderDefaultUI = () => (
    <div className="space-y-6">
      {/* Game Controls */}
      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Play className="w-5 h-5 text-green-400" />
            {GAME_MODES[selectedMode].label}
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={`text-xs ${!useRealAI ? 'text-slate-400' : 'text-slate-600'}`}>Sim</span>
              <button
                onClick={() => setUseRealAI(!useRealAI)}
                className={`relative w-12 h-6 rounded-full transition-colors ${useRealAI ? 'bg-purple-500' : 'bg-slate-700'}`}
              >
                <motion.div
                  className="absolute top-1 w-4 h-4 rounded-full bg-white"
                  animate={{ left: useRealAI ? '28px' : '4px' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
              <span className={`text-xs ${useRealAI ? 'text-purple-400' : 'text-slate-600'}`}>
                <Brain className="w-3 h-3 inline mr-1" />
                AI
              </span>
            </div>
            <motion.button
              onClick={simulateRound}
              disabled={isPlaying || aiLoading}
              className={`px-4 py-2 rounded-lg text-white font-medium flex items-center gap-2 disabled:opacity-50 ${
                useRealAI ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gradient-to-r from-green-500 to-emerald-500'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isPlaying || aiLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {useRealAI ? 'AI Playing...' : 'Playing...'}
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  {useRealAI ? 'Play with AI' : 'Play Round'}
                </>
              )}
            </motion.button>
          </div>
        </div>

        {/* Current Round Status */}
        {currentRound && (
          <div className="mb-4 p-4 rounded-xl bg-slate-900/50 border border-purple-500/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-purple-400 font-medium">Target:</span>
                <span className="text-white font-mono text-lg">{currentRound.target}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  currentRound.status === 'complete' ? 'bg-green-500/20 text-green-400' :
                  currentRound.status === 'acting' ? 'bg-blue-500/20 text-blue-400' :
                  currentRound.status === 'guessing' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-purple-500/20 text-purple-400'
                }`}>
                  {currentRound.status.toUpperCase()}
                </span>
                <span className="text-amber-400 text-sm flex items-center gap-1">
                  <Coins className="w-4 h-4" />
                  {currentRound.tokenCost}
                </span>
              </div>
            </div>
            {currentRound.constraints.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {currentRound.constraints.map(c => (
                  <span key={c.id} className="px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 text-xs">
                    {c.emoji} {c.type}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="h-80 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          <AnimatePresence>
            {messages.map(msg => {
              const agent = agents.find(a => a.id === msg.agentId);
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-xl ${
                    msg.type === 'celebration'
                      ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30'
                      : msg.type === 'idiom-generated'
                      ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30'
                      : msg.type === 'judgment'
                      ? 'bg-cyan-500/10 border border-cyan-500/30'
                      : msg.type === 'guess'
                      ? 'bg-slate-900/80 border border-slate-700/50'
                      : 'bg-slate-900/50 border border-slate-700/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {agent && (
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0"
                        style={{ backgroundColor: agent.color + '30' }}
                      >
                        {agent.emoji}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-medium text-sm ${
                          msg.type === 'celebration' ? 'text-yellow-300' :
                          msg.type === 'idiom-generated' ? 'text-purple-300' :
                          agent ? 'text-white' : 'text-slate-400'
                        }`}>
                          {msg.type === 'celebration' ? '🎉 Celebration!' :
                           msg.type === 'idiom-generated' ? '✨ System' :
                           agent?.name || 'System'}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          msg.type === 'description' ? 'bg-blue-500/20 text-blue-400' :
                          msg.type === 'guess' ? 'bg-amber-500/20 text-amber-400' :
                          msg.type === 'judgment' ? 'bg-cyan-500/20 text-cyan-400' :
                          'bg-purple-500/20 text-purple-400'
                        }`}>
                          {msg.type}
                        </span>
                        {msg.constraintApplied && (
                          <span className="text-xs text-pink-400">[{msg.constraintApplied}]</span>
                        )}
                      </div>
                      <p className="text-slate-300 text-sm">{msg.content}</p>
                    </div>
                    <div className="text-xs text-amber-400">
                      {msg.tokens}t
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {messages.length === 0 && (
            <div className="h-full flex items-center justify-center text-slate-500">
              <div className="text-center">
                <Gamepad2 className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>Click "Play Round" to start a game</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Main render
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900">
      {/* Role Selection Modal */}
      {showRoleSelector && (
        <RoleSelectionModal onSelect={handleRoleSelect} />
      )}

      {/* Header */}
      <header className="sticky top-16 z-40 bg-slate-900/80 backdrop-blur-lg border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center"
                animate={{ rotate: isPlaying ? 360 : 0 }}
                transition={{ duration: 2, repeat: isPlaying ? Infinity : 0, ease: "linear" }}
              >
                <Network className="w-6 h-6 text-white" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  LLN Playground
                  <span className="text-xs px-2 py-1 bg-purple-500/30 rounded-full text-purple-300">v0.2</span>
                </h1>
                <p className="text-purple-300 text-sm">Large Language Networks - Agents Learning Through Play</p>
              </div>
            </div>

            {/* User Profile Badge */}
            {userProfile && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowRoleSelector(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: USER_ROLE_CONFIG[userProfile.role].color + '30' }}
                  >
                    {(() => {
                      const IconComponent = USER_ROLE_CONFIG[userProfile.role].icon;
                      return <IconComponent className="w-4 h-4" style={{ color: USER_ROLE_CONFIG[userProfile.role].color }} />;
                    })()}
                  </div>
                  <div className="text-left">
                    <div className="text-white text-sm font-medium">{userProfile.displayName}</div>
                    <div className="text-slate-500 text-xs">Level {userProfile.level} • {userProfile.xp} XP</div>
                  </div>
                </button>
                <Link href="/agent-cells" className="text-purple-400 hover:text-purple-300 flex items-center gap-1 text-sm">
                  <Layers className="w-4 h-4" />
                  Agent Cells
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Token Cost Analysis Dashboard */}
        <section className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <motion.div
              className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50"
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Coins className="w-4 h-4 text-amber-400" />
                <span className="text-slate-400 text-xs">Baseline</span>
              </div>
              <div className="text-2xl font-bold text-white">{tokenAnalysis.baselineCost.toLocaleString()}</div>
            </motion.div>

            <motion.div
              className="bg-slate-800/50 rounded-2xl p-4 border border-green-500/30"
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-green-400" />
                <span className="text-slate-400 text-xs">Optimized</span>
              </div>
              <div className="text-2xl font-bold text-green-400">{tokenAnalysis.optimizedCost.toLocaleString()}</div>
            </motion.div>

            <motion.div
              className="bg-slate-800/50 rounded-2xl p-4 border border-purple-500/30"
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                <span className="text-slate-400 text-xs">Savings</span>
              </div>
              <div className="text-2xl font-bold text-purple-400">{tokenAnalysis.savings.toLocaleString()}</div>
            </motion.div>

            <motion.div
              className={`bg-slate-800/50 rounded-2xl p-4 border ${tokenAnalysis.attentionJustified ? 'border-cyan-500/30' : 'border-red-500/30'}`}
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Target className={`w-4 h-4 ${tokenAnalysis.attentionJustified ? 'text-cyan-400' : 'text-red-400'}`} />
                <span className="text-slate-400 text-xs">ROI</span>
              </div>
              <div className={`text-2xl font-bold ${tokenAnalysis.attentionJustified ? 'text-cyan-400' : 'text-red-400'}`}>
                {tokenAnalysis.attentionJustified ? 'YES' : 'NO'}
              </div>
            </motion.div>

            <motion.div
              className="bg-slate-800/50 rounded-2xl p-4 border border-amber-500/30"
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Star className="w-4 h-4 text-amber-400" />
                <span className="text-slate-400 text-xs">Projected</span>
              </div>
              <div className="text-2xl font-bold text-amber-400">+{tokenAnalysis.projectedSavings}</div>
            </motion.div>
          </div>
        </section>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel */}
          <div className="space-y-6">
            {/* Game Mode Selection */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Gamepad2 className="w-5 h-5 text-purple-400" />
                Game Mode
              </h2>
              <GameModeSelector
                selectedMode={selectedMode}
                onSelect={setSelectedMode}
                userRole={userProfile?.role || 'hobbyist'}
              />
            </div>

            {/* Word Category */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-amber-400" />
                Word Category
              </h2>
              <WordCategorySelector
                selectedCategory={selectedCategory}
                onSelect={setSelectedCategory}
                userRole={userProfile?.role || 'hobbyist'}
              />
            </div>

            {/* Constraints */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Puzzle className="w-5 h-5 text-pink-400" />
                  Constraints
                </h2>
                <span className="text-xs px-2 py-1 bg-pink-500/20 rounded-full text-pink-400">
                  {activeConstraints.length} active
                </span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {constraints.filter(c => c.unlocked || userProfile?.role === 'developer').map(constraint => (
                  <motion.button
                    key={constraint.id}
                    onClick={() => toggleConstraint(constraint)}
                    className={`w-full text-left p-3 rounded-xl transition-all ${
                      activeConstraints.find(c => c.id === constraint.id)
                        ? 'bg-pink-500/20 border-pink-500/50 border'
                        : 'bg-slate-900/50 border border-slate-700/30 hover:border-slate-600'
                    }`}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{constraint.emoji}</span>
                        <span className={`text-sm ${activeConstraints.find(c => c.id === constraint.id) ? 'text-pink-300' : 'text-slate-400'}`}>
                          {constraint.value}
                        </span>
                      </div>
                      <span className="text-xs text-amber-400">{constraint.penalty}x</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>

          {/* Center Panel */}
          <div className="lg:col-span-2">
            {renderRoleSpecificUI()}

            {/* Idioms Library */}
            <div className="mt-6 bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  Idiom Library
                  <span className="text-xs px-2 py-0.5 bg-amber-500/20 rounded-full text-amber-400">
                    {idioms.length} learned
                  </span>
                </h2>
                <button className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {idioms.map(idiom => (
                  <motion.div
                    key={idiom.id}
                    className={`p-4 rounded-xl bg-slate-900/50 border ${idiom.lockedToSeed ? 'border-cyan-500/50' : 'border-slate-700/30'}`}
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="text-2xl">{idiom.shorthand}</div>
                      <button
                        onClick={() => toggleIdiomLock(idiom)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          idiom.lockedToSeed ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-500 hover:text-slate-400'
                        }`}
                        title={idiom.lockedToSeed ? 'Locked to seed (SMPbot)' : 'Lock as SMPbot'}
                      >
                        {idiom.lockedToSeed ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-slate-400 text-sm mb-2">{idiom.meaning}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-green-400">{idiom.usageCount} uses</span>
                      <span className="text-amber-400">-{idiom.tokenSavings}t</span>
                    </div>
                    {idiom.lockedToSeed && idiom.seed && (
                      <div className="mt-2 text-xs text-cyan-400 flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        {idiom.seed}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Achievements */}
            <div className="mt-6 bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-yellow-400" />
                Achievements
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {achievements.slice(0, 6).map(achievement => (
                  <AchievementBadge key={achievement.id} achievement={achievement} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Custom Styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(30, 41, 59, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.5);
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
