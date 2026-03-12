"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import Link from "next/link";

// Types for LLN System
interface Agent {
  id: string;
  name: string;
  role: "actor" | "guesser" | "judge" | "observer";
  modelType: string;
  tokensUsed: number;
  wins: number;
  idioms: string[];
  color: string;
}

interface Constraint {
  id: string;
  type: "rhyme" | "no-letter" | "roast" | "negative" | "haiku" | "emoji-only" | "custom";
  value: string;
  penalty: number; // token penalty multiplier
  active: boolean;
}

interface GameRound {
  id: string;
  target: string;
  actors: string[];
  guessers: string[];
  judges: string[];
  constraints: Constraint[];
  messages: GameMessage[];
  status: "waiting" | "acting" | "guessing" | "judging" | "complete";
  winner?: string;
  tokenCost: number;
}

interface GameMessage {
  id: string;
  agentId: string;
  content: string;
  type: "description" | "guess" | "judgment" | "idiom-generated";
  tokens: number;
  constraintApplied?: string;
  timestamp: number;
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
}

interface TokenAnalysis {
  baselineCost: number;
  optimizedCost: number;
  savings: number;
  idiomEfficiency: number;
  attentionJustified: boolean;
}

// Sample constraints for the game
const CONSTRAINT_TEMPLATES: Constraint[] = [
  { id: "1", type: "rhyme", value: "Your descriptions must rhyme!", penalty: 1.2, active: false },
  { id: "2", type: "no-letter", value: "Don't use the letter 'E'!", penalty: 1.5, active: false },
  { id: "3", type: "roast", value: "Roast your opponents! Score 0-100", penalty: 1.3, active: false },
  { id: "4", type: "negative", value: "Only use negatives to describe", penalty: 1.4, active: false },
  { id: "5", type: "haiku", value: "Speak only in haiku (5-7-5)", penalty: 1.1, active: false },
  { id: "6", type: "emoji-only", value: "Only emojis, no words!", penalty: 1.6, active: false },
];

// Sample agents
const SAMPLE_AGENTS: Agent[] = [
  { id: "a1", name: "Riddler", role: "actor", modelType: "gpt-4", tokensUsed: 0, wins: 0, idioms: [], color: "#10B981" },
  { id: "a2", name: "Oracle", role: "guesser", modelType: "claude-3", tokensUsed: 0, wins: 0, idioms: [], color: "#8B5CF6" },
  { id: "a3", name: "Jester", role: "actor", modelType: "gemini-pro", tokensUsed: 0, wins: 0, idioms: [], color: "#F59E0B" },
  { id: "a4", name: "Sage", role: "judge", modelType: "gpt-4", tokensUsed: 0, wins: 0, idioms: [], color: "#EC4899" },
];

// Sample idioms (pre-generated from agent play)
const SAMPLE_IDIOMS: Idiom[] = [
  { id: "i1", shorthand: "🧊💨", meaning: "Cold shoulder - ignore/dismiss", originAgents: ["a1", "a2"], usageCount: 47, tokenSavings: 142, lockedToSeed: false },
  { id: "i2", shorthand: "🎲→🎯", meaning: "Random becomes intentional", originAgents: ["a2", "a3"], usageCount: 23, tokenSavings: 89, lockedToSeed: true, seed: "seed_7x9_omega" },
  { id: "i3", shorthand: "🌊🧠", meaning: "Deep thought / flow state", originAgents: ["a1", "a3"], usageCount: 156, tokenSavings: 312, lockedToSeed: false },
];

export default function LLNPlayground() {
  const [agents, setAgents] = useState<Agent[]>(SAMPLE_AGENTS);
  const [constraints, setConstraints] = useState<Constraint[]>(CONSTRAINT_TEMPLATES);
  const [activeConstraints, setActiveConstraints] = useState<Constraint[]>([]);
  const [idioms, setIdioms] = useState<Idiom[]>(SAMPLE_IDIOMS);
  const [currentRound, setCurrentRound] = useState<GameRound | null>(null);
  const [messages, setMessages] = useState<GameMessage[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [roundHistory, setRoundHistory] = useState<GameRound[]>([]);
  const [tokenAnalysis, setTokenAnalysis] = useState<TokenAnalysis>({
    baselineCost: 1000,
    optimizedCost: 650,
    savings: 350,
    idiomEfficiency: 0.35,
    attentionJustified: true,
  });
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [targetWord, setTargetWord] = useState("BANANA");
  const [useRealAI, setUseRealAI] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Simulate a game round
  const simulateRound = useCallback(async () => {
    if (!targetWord) return;

    const round: GameRound = {
      id: `round_${Date.now()}`,
      target: targetWord.toUpperCase(),
      actors: agents.filter(a => a.role === "actor").map(a => a.id),
      guessers: agents.filter(a => a.role === "guesser").map(a => a.id),
      judges: agents.filter(a => a.role === "judge").map(a => a.id),
      constraints: activeConstraints,
      messages: [],
      status: "acting",
      tokenCost: 0,
    };

    setCurrentRound(round);
    setMessages([]);
    setIsPlaying(true);

    // Simulate acting phase
    const actors = agents.filter(a => a.role === "actor");
    const guessers = agents.filter(a => a.role === "guesser");

    // Generate descriptions from actors
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

      // Check if correct
      if (guess.toLowerCase().includes(targetWord.toLowerCase())) {
        round.winner = guesser.id;
        round.status = "complete";
        setCurrentRound({ ...round });

        // Generate idiom
        if (activeConstraints.length > 0) {
          const newIdiom = generateIdiom(actors[0], guesser, targetWord);
          setIdioms(prev => [...prev, newIdiom]);

          const idiomMsg: GameMessage = {
            id: `msg_${Date.now()}`,
            agentId: "system",
            content: `New idiom created: "${newIdiom.shorthand}" = ${newIdiom.meaning}`,
            type: "idiom-generated",
            tokens: 0,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, idiomMsg]);
        }

        break;
      }
    }

    if (!round.winner) {
      round.status = "judging";
      setCurrentRound({ ...round });

      await new Promise(resolve => setTimeout(resolve, 800));
      const judge = agents.find(a => a.role === "judge");
      if (judge) {
        const judgment = `The target was "${targetWord.toUpperCase()}". Better luck next round!`;
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
  }, [targetWord, agents, activeConstraints]);

  // Play a round with real AI agents
  const playRoundWithAI = useCallback(async () => {
    if (!targetWord) return;

    const round: GameRound = {
      id: `round_${Date.now()}`,
      target: targetWord.toUpperCase(),
      actors: agents.filter(a => a.role === "actor").map(a => a.id),
      guessers: agents.filter(a => a.role === "guesser").map(a => a.id),
      judges: agents.filter(a => a.role === "judge").map(a => a.id),
      constraints: activeConstraints,
      messages: [],
      status: "acting",
      tokenCost: 0,
    };

    setCurrentRound(round);
    setMessages([]);
    setIsPlaying(true);
    setAiLoading(true);

    try {
      const actors = agents.filter(a => a.role === "actor");
      const guessers = agents.filter(a => a.role === "guesser");
      const constraintTypes = activeConstraints.map(c => c.type);

      // Generate descriptions from actors using real AI
      for (const actor of actors) {
        const response = await fetch('/api/lln-game', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'describe',
            targetWord,
            agentId: actor.id === 'a1' ? 'riddler' : 'jester',
            constraints: constraintTypes,
          }),
        });

        const data = await response.json();
        
        const msg: GameMessage = {
          id: `msg_${Date.now()}`,
          agentId: actor.id,
          content: data.content,
          type: "description",
          tokens: data.tokens,
          constraintApplied: constraintTypes[0],
          timestamp: Date.now(),
        };

        setMessages(prev => [...prev, msg]);
        setCurrentRound(prev => prev ? { ...prev, tokenCost: prev.tokenCost + msg.tokens } : null);
      }

      // Update round status
      round.status = "guessing";
      setCurrentRound({ ...round });

      // Get current messages for context
      let currentMessages: GameMessage[] = [];
      setMessages(prev => {
        currentMessages = prev;
        return prev;
      });

      // Generate guesses from guessers
      for (const guesser of guessers) {
        const response = await fetch('/api/lln-game', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'guess',
            targetWord,
            agentId: 'oracle',
            previousMessages: currentMessages.map(m => ({
              agent: agents.find(a => a.id === m.agentId)?.name || 'System',
              content: m.content,
            })),
          }),
        });

        const data = await response.json();
        
        const msg: GameMessage = {
          id: `msg_${Date.now()}`,
          agentId: guesser.id,
          content: data.content,
          type: "guess",
          tokens: data.tokens,
          timestamp: Date.now(),
        };

        setMessages(prev => [...prev, msg]);
        setCurrentRound(prev => prev ? { ...prev, tokenCost: prev.tokenCost + msg.tokens } : null);
        currentMessages.push(msg);

        // Check if guess is correct (simple check)
        const guessLower = data.content.toLowerCase();
        const targetLower = targetWord.toLowerCase();
        
        if (guessLower.includes(targetLower) || targetLower.includes(guessLower.replace('?', '').replace('is it', '').trim())) {
          round.winner = guesser.id;
          round.status = "complete";
          setCurrentRound({ ...round });

          // Generate idiom
          if (activeConstraints.length > 0) {
            const idiomResponse = await fetch('/api/lln-game', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'generate-idiom',
                targetWord,
                constraints: constraintTypes,
                previousMessages: currentMessages.map(m => ({
                  agent: agents.find(a => a.id === m.agentId)?.name || 'System',
                  content: m.content,
                })),
              }),
            });

            const idiomData = await idiomResponse.json();
            
            const newIdiom: Idiom = {
              id: `idiom_${Date.now()}`,
              shorthand: idiomData.idiom?.shorthand || "✨",
              meaning: idiomData.idiom?.meaning || "Success!",
              originAgents: [actors[0].id, guesser.id],
              usageCount: 1,
              tokenSavings: Math.floor(Math.random() * 50) + 20,
              lockedToSeed: false,
            };
            
            setIdioms(prev => [...prev, newIdiom]);

            const idiomMsg: GameMessage = {
              id: `msg_${Date.now()}`,
              agentId: "system",
              content: `New idiom created: "${newIdiom.shorthand}" = ${newIdiom.meaning}`,
              type: "idiom-generated",
              tokens: 0,
              timestamp: Date.now(),
            };
            setMessages(prev => [...prev, idiomMsg]);
          }

          break;
        }
      }

      if (!round.winner) {
        round.status = "judging";
        setCurrentRound({ ...round });

        const judge = agents.find(a => a.role === "judge");
        if (judge) {
          const judgment = `The target was "${targetWord.toUpperCase()}". Better luck next round!`;
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
    } catch (error) {
      console.error('AI gameplay error:', error);
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}`,
        agentId: "system",
        content: "Error connecting to AI agents. Try again or use simulation mode.",
        type: "judgment",
        tokens: 0,
        timestamp: Date.now(),
      }]);
    }

    setIsPlaying(false);
    setAiLoading(false);
  }, [targetWord, agents, activeConstraints]);

  // Unified play function
  const playRound = useCallback(async () => {
    if (useRealAI) {
      await playRoundWithAI();
    } else {
      await simulateRound();
    }
  }, [useRealAI, playRoundWithAI, simulateRound]);

  // Generate a description based on constraints
  const generateDescription = (target: string, constraints: Constraint[], actor: Agent): string => {
    const descriptions: Record<string, string[]> = {
      "BANANA": [
        "Yellow curve that monkeys love",
        "You peel it before eating",
        "A fruit that's also a phone shape",
      ],
      "ELEPHANT": [
        "Big gray friend with a trunk",
        "Never forgets, huge ears",
        "Largest land animal",
      ],
      "COMPUTER": [
        "Silicon brain on your desk",
        "Clicks and computes",
        "Electric thinker with a screen",
      ],
    };

    let base = descriptions[target]?.[Math.floor(Math.random() * 3)] || "Something mysterious...";

    // Apply constraints
    for (const constraint of constraints) {
      switch (constraint.type) {
        case "rhyme":
          base = base.includes("love") ? "Yellow curve, monkeys love, fits in glove" :
                 base.includes("trunk") ? "Big and gray, trunk does sway, ears display" :
                 base + " - time to play!";
          break;
        case "no-letter":
          if (constraint.value.includes("E")) {
            base = "Yellow thing, monkeys charish";
          }
          break;
        case "roast":
          base = `${base} (Your guessing skills are as dull as a plastic knife, Oracle! 45/100)`;
          break;
        case "negative":
          base = `Not red, not small, not metal, not quiet`;
          break;
        case "haiku":
          base = "Yellow curved shape\nMonkeys love to peel and eat\nSweet soft fruit inside";
          break;
        case "emoji-only":
          base = "🍌🐒💛👋";
          break;
      }
    }

    return base;
  };

  // Generate a guess
  const generateGuess = (target: string, constraints: Constraint[]): string => {
    // Simulate correct guess sometimes
    if (Math.random() > 0.3) {
      return `Is it... ${target.toUpperCase()}?`;
    }
    const wrongGuesses = ["Apple?", "Carrot?", "Moon?", "Book?"];
    return wrongGuesses[Math.floor(Math.random() * wrongGuesses.length)];
  };

  // Generate a new idiom from successful play
  const generateIdiom = (actor: Agent, guesser: Agent, target: string): Idiom => {
    const idioms = [
      { shorthand: "🍌🎯", meaning: `Quick win - ${target} identified fast` },
      { shorthand: "💬⚡", meaning: "Instant understanding" },
      { shorthand: "🎪🤝", meaning: "Performance partnership" },
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
    };
  };

  // Toggle constraint
  const toggleConstraint = (constraint: Constraint) => {
    if (activeConstraints.find(c => c.id === constraint.id)) {
      setActiveConstraints(prev => prev.filter(c => c.id !== constraint.id));
    } else {
      setActiveConstraints(prev => [...prev, constraint]);
    }
  };

  // Lock idiom to seed (SMPbot)
  const toggleIdiomLock = (idiom: Idiom) => {
    setIdioms(prev => prev.map(i =>
      i.id === idiom.id
        ? { ...i, lockedToSeed: !i.lockedToSeed, seed: i.lockedToSeed ? undefined : `seed_${Math.random().toString(36).substr(2, 9)}` }
        : i
    ));
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
    });
  }, [idioms, activeConstraints]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900">
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
                  <span className="text-xs px-2 py-1 bg-purple-500/30 rounded-full text-purple-300">v0.1</span>
                </h1>
                <p className="text-purple-300 text-sm">Large Language Networks - Agents Learning Through Play</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>
              <Link href="/agent-cells" className="text-purple-400 hover:text-purple-300 flex items-center gap-1 text-sm">
                <Layers className="w-4 h-4" />
                Agent Cells
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Token Cost Analysis Dashboard */}
        <section className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div
              className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50"
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center gap-3 mb-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <span className="text-slate-400 text-sm">Baseline Tokens</span>
              </div>
              <div className="text-3xl font-bold text-white">{tokenAnalysis.baselineCost.toLocaleString()}</div>
              <div className="text-xs text-slate-500 mt-1">Without optimization</div>
            </motion.div>

            <motion.div
              className="bg-slate-800/50 rounded-2xl p-6 border border-green-500/30"
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center gap-3 mb-2">
                <Zap className="w-5 h-5 text-green-400" />
                <span className="text-slate-400 text-sm">Optimized Cost</span>
              </div>
              <div className="text-3xl font-bold text-green-400">{tokenAnalysis.optimizedCost.toLocaleString()}</div>
              <div className="text-xs text-green-500/70 mt-1">With idioms & cells</div>
            </motion.div>

            <motion.div
              className="bg-slate-800/50 rounded-2xl p-6 border border-purple-500/30"
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-purple-400" />
                <span className="text-slate-400 text-sm">Token Savings</span>
              </div>
              <div className="text-3xl font-bold text-purple-400">{tokenAnalysis.savings.toLocaleString()}</div>
              <div className="text-xs text-purple-500/70 mt-1">
                {((tokenAnalysis.savings / tokenAnalysis.baselineCost) * 100).toFixed(1)}% efficiency
              </div>
            </motion.div>

            <motion.div
              className={`bg-slate-800/50 rounded-2xl p-6 border ${tokenAnalysis.attentionJustified ? 'border-cyan-500/30' : 'border-red-500/30'}`}
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center gap-3 mb-2">
                <Target className={`w-5 h-5 ${tokenAnalysis.attentionJustified ? 'text-cyan-400' : 'text-red-400'}`} />
                <span className="text-slate-400 text-sm">Attention ROI</span>
              </div>
              <div className={`text-3xl font-bold ${tokenAnalysis.attentionJustified ? 'text-cyan-400' : 'text-red-400'}`}>
                {tokenAnalysis.attentionJustified ? 'YES' : 'NO'}
              </div>
              <div className="text-xs text-slate-500 mt-1">Is optimization worth cost?</div>
            </motion.div>
          </div>
        </section>

        {/* Main Game Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Agents & Constraints */}
          <div className="space-y-6">
            {/* Agents */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  Agents
                </h2>
                <button className="p-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                {agents.map(agent => (
                  <motion.div
                    key={agent.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-700/30"
                    whileHover={{ x: 4 }}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: agent.color }}
                    >
                      {agent.name[0]}
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-medium">{agent.name}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{agent.role}</span>
                        <span>{agent.modelType}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-amber-400 text-sm">{agent.tokensUsed} tokens</div>
                      <div className="text-green-400 text-xs">{agent.wins} wins</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Constraints */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5 text-pink-400" />
                  Constraints
                </h2>
                <span className="text-xs px-2 py-1 bg-pink-500/20 rounded-full text-pink-400">
                  {activeConstraints.length} active
                </span>
              </div>

              <div className="space-y-2">
                {constraints.map(constraint => (
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
                      <span className={`text-sm ${
                        activeConstraints.find(c => c.id === constraint.id) ? 'text-pink-300' : 'text-slate-400'
                      }`}>
                        {constraint.value}
                      </span>
                      <span className="text-xs text-amber-400">
                        {constraint.penalty}x tokens
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>

          {/* Center Panel - Game Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Game Controls */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Play className="w-5 h-5 text-green-400" />
                  Charades Arena
                </h2>
                <div className="flex items-center gap-3">
                  {/* AI Mode Toggle */}
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${!useRealAI ? 'text-slate-400' : 'text-slate-600'}`}>Sim</span>
                    <button
                      onClick={() => setUseRealAI(!useRealAI)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        useRealAI ? 'bg-purple-500' : 'bg-slate-700'
                      }`}
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
                  <input
                    type="text"
                    value={targetWord}
                    onChange={(e) => setTargetWord(e.target.value)}
                    placeholder="Target word..."
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                  <motion.button
                    onClick={playRound}
                    disabled={isPlaying || aiLoading}
                    className={`px-4 py-2 rounded-lg text-white font-medium flex items-center gap-2 disabled:opacity-50 ${
                      useRealAI 
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500' 
                        : 'bg-gradient-to-r from-green-500 to-emerald-500'
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
                          {c.type}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Messages */}
              <div className="h-80 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                <AnimatePresence>
                  {messages.map((msg, idx) => {
                    const agent = agents.find(a => a.id === msg.agentId);
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-3 rounded-xl ${
                          msg.type === 'idiom-generated'
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
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                              style={{ backgroundColor: agent.color }}
                            >
                              {agent.name[0]}
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`font-medium text-sm ${
                                msg.type === 'idiom-generated' ? 'text-purple-300' :
                                agent ? 'text-white' : 'text-slate-400'
                              }`}>
                                {msg.type === 'idiom-generated' ? '✨ System' : agent?.name || 'System'}
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

            {/* Idioms Library */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
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
                    className={`p-4 rounded-xl bg-slate-900/50 border ${
                      idiom.lockedToSeed ? 'border-cyan-500/50' : 'border-slate-700/30'
                    }`}
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="text-2xl">{idiom.shorthand}</div>
                      <button
                        onClick={() => toggleIdiomLock(idiom)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          idiom.lockedToSeed
                            ? 'bg-cyan-500/20 text-cyan-400'
                            : 'bg-slate-800 text-slate-500 hover:text-slate-400'
                        }`}
                        title={idiom.lockedToSeed ? 'Locked to seed (SMPbot)' : 'Lock as SMPbot'}
                      >
                        {idiom.lockedToSeed ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-slate-400 text-sm mb-2">{idiom.meaning}</p>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-purple-400">
                          {idiom.originAgents.map(id => agents.find(a => a.id === id)?.name[0]).join('→')}
                        </span>
                        <span className="text-slate-600">|</span>
                        <span className="text-green-400">{idiom.usageCount} uses</span>
                      </div>
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

            {/* LLN Theory Panel */}
            <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-2xl p-6 border border-purple-500/20">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Brain className="w-5 h-5 text-purple-400" />
                LLN Theory - Large Language Networks
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-700/30">
                  <h3 className="text-purple-400 font-medium mb-2">🎮 Game-Based Fine-Tuning</h3>
                  <p className="text-slate-400">
                    Agents learn through constrained play. Constraints force creativity,
                    generating novel communication patterns and shortcuts.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-700/30">
                  <h3 className="text-pink-400 font-medium mb-2">💎 Idiom Compression</h3>
                  <p className="text-slate-400">
                    Inside jokes become shorthand. "🧊💨" saves 5+ tokens vs "cold shoulder treatment".
                    ML indexes these as reusable tiles.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-700/30">
                  <h3 className="text-cyan-400 font-medium mb-2">🔒 SMPbot Seeds</h3>
                  <p className="text-slate-400">
                    Lock idioms to deterministic seeds. Create Single Mastery Point bots
                    that reliably execute specific patterns.
                  </p>
                </div>
              </div>
              <div className="mt-4 p-4 rounded-xl bg-slate-900/30 border border-slate-700/20">
                <p className="text-slate-300 text-sm">
                  <span className="text-purple-400 font-medium">Key Insight:</span> LLN doesn't care what models are in it.
                  The community develops its own "vibe" - a shared language of idioms, constraints, and patterns.
                  Export agent firms that understand each other's shorthand and can synergize effectively.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Round History */}
        {roundHistory.length > 0 && (
          <section className="mt-8">
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Timer className="w-5 h-5 text-slate-400" />
                Round History
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 text-left border-b border-slate-700">
                      <th className="pb-2 font-medium">Round</th>
                      <th className="pb-2 font-medium">Target</th>
                      <th className="pb-2 font-medium">Constraints</th>
                      <th className="pb-2 font-medium">Tokens</th>
                      <th className="pb-2 font-medium">Winner</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {roundHistory.slice(-5).reverse().map((round, idx) => (
                      <tr key={round.id} className="border-b border-slate-800">
                        <td className="py-2">#{roundHistory.length - idx}</td>
                        <td className="py-2 font-mono">{round.target}</td>
                        <td className="py-2">
                          <div className="flex gap-1">
                            {round.constraints.map(c => (
                              <span key={c.id} className="px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 text-xs">
                                {c.type}
                              </span>
                            ))}
                            {round.constraints.length === 0 && <span className="text-slate-500">-</span>}
                          </div>
                        </td>
                        <td className="py-2 text-amber-400">{round.tokenCost}</td>
                        <td className="py-2">
                          {round.winner ? (
                            <span className="text-green-400">
                              {agents.find(a => a.id === round.winner)?.name}
                            </span>
                          ) : (
                            <span className="text-slate-500">None</span>
                          )}
                        </td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            round.status === 'complete' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {round.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Custom Scrollbar */}
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
      `}</style>
    </div>
  );
}
