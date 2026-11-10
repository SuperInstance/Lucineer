'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ============================================
// DESIGN SYSTEM - Cyberpunk-lite + Incredible Machine
// ============================================
const COLORS = {
  background: '#0a0f0d',
  card: '#141f1a',
  cardHover: '#1a2a24',
  primary: '#22d3a0',
  primaryDark: '#0d9668',
  secondary: '#6366f1',
  accent: {
    blue: '#3b82f6',
    purple: '#8b5cf6',
    amber: '#f59e0b',
    pink: '#ec4899',
    cyan: '#06b6d4',
    red: '#ef4444',
  },
  text: '#e8f5f0',
  textMuted: '#6b8f80',
  border: '#1f3d2f',
  glow: {
    green: '0 0 20px rgba(34, 211, 160, 0.4), 0 0 40px rgba(34, 211, 160, 0.2)',
    blue: '0 0 20px rgba(59, 130, 246, 0.4), 0 0 40px rgba(59, 130, 246, 0.2)',
    purple: '0 0 20px rgba(139, 92, 246, 0.4), 0 0 40px rgba(139, 92, 246, 0.2)',
    amber: '0 0 20px rgba(245, 158, 11, 0.4), 0 0 40px rgba(245, 158, 11, 0.2)',
  }
}

// ============================================
// ADVENTURE DATA
// ============================================
const ADVENTURES = [
  {
    id: 'octet_switcher',
    title: 'OCTET SWITCHER',
    subtitle: 'Binary by the Byte',
    description: 'Master 8 bits = 256 possibilities. Watch the gears turn!',
    icon: '🎛️',
    difficulty: 1,
    unlocked: true,
    color: COLORS.primary,
    glow: COLORS.glow.green,
    npc: 'Bitzy',
    npcEmoji: '🤖',
  },
  {
    id: 'logic_gates',
    title: 'LOGIC GATE WORKSHOP',
    subtitle: 'Where Gates Meet Greatness',
    description: 'Build AND, OR, NOT, XOR gates. See the electrons flow!',
    icon: '⚡',
    difficulty: 2,
    unlocked: true,
    color: COLORS.accent.amber,
    glow: COLORS.glow.amber,
    npc: 'Gary',
    npcEmoji: '🔌',
  },
  {
    id: 'chip_designer',
    title: 'CHIP DESIGNER LAB',
    subtitle: 'Silicon Dreams',
    description: 'Layout transistors on a wafer. Design your first CPU!',
    icon: '🔬',
    difficulty: 4,
    unlocked: true,
    color: COLORS.accent.cyan,
    glow: COLORS.glow.blue,
    npc: 'Sam',
    npcEmoji: '🧬',
  },
  {
    id: 'binary_calc',
    title: 'BINARY CALCULATOR',
    subtitle: 'Adders & Carriers',
    description: 'Build circuits that do math. Watch carries ripple!',
    icon: '🧮',
    difficulty: 3,
    unlocked: true,
    color: COLORS.accent.purple,
    glow: COLORS.glow.purple,
    npc: 'Cathy',
    npcEmoji: '📊',
  },
  {
    id: 'neural_net',
    title: 'NEURAL EXPLORER',
    subtitle: 'Brains in Silicon',
    description: 'Build and train neural networks. See AI learn!',
    icon: '🧠',
    difficulty: 4,
    unlocked: true,
    color: COLORS.accent.pink,
    glow: COLORS.glow.purple,
    npc: 'Nina',
    npcEmoji: '✨',
  },
]

// ============================================
// SILLY RESPONSES
// ============================================
const SILLY_RESPONSES: Record<string, { emoji: string; message: string }> = {
  '0': { emoji: '💤', message: 'Zzz... Wake me when you flip a switch!' },
  '1': { emoji: '🐣', message: 'A baby bit! So tiny, so cute!' },
  '8': { emoji: '🐙', message: '8 arms, 8 bits - OCTOPUS!' },
  '42': { emoji: '🌌', message: 'THE ANSWER! To everything!' },
  '64': { emoji: '🕹️', message: 'N64 memories loading...' },
  '100': { emoji: '💯', message: '100% PERFECT SCORE!' },
  '127': { emoji: '🌐', message: 'Max signed byte! Technical!' },
  '128': { emoji: '💾', message: 'Halfway to byte heaven!' },
  '255': { emoji: '🔥', message: 'MAXIMUM BYTE POWER!' },
}

const NPC_DIALOGUES = {
  Bitzy: {
    greeting: ["*beep boop* Let's get BIT-zy!", "01101000 01101001! That's HI in binary!", "Ready to flip, switch, and learn?"],
    encouragement: ["You're doing BIT-fully well!", "Binary wizards aren't born, they're MADE!", "Keep flipping those switches!"],
    jokes: ["Why do programmers prefer dark mode? Light attracts bugs!", "There are 10 types of people who understand binary...", "What's a computer's favorite beat? Algo-rhythms!"],
  },
  Gary: {
    greeting: ["Welcome to the GATE-way of learning!", "I'm GATE-fully excited to teach you!", "AND... here we go!"],
    encouragement: ["That's AND-credible work!", "You're NAND-erful at this!", "Your logic is SOUND!"],
    jokes: ["I told a joke to a NOT gate... it didn't get it.", "AND gates are so needy - they want ALL inputs high!", "NAND is my favorite Beatles song - All You Need Is NAND!"],
  },
  Sam: {
    greeting: ["Welcome to the silicon foundry!", "Let's etch some dreams into reality!", "Transistor by transistor, we build the future!"],
    encouragement: ["Your layout is CLEAN!", "That's some efficient routing!", "You're thinking like a chip designer!"],
    jokes: ["I'd tell you a joke about wafers, but it's too thin.", "Why did the transistor go to therapy? Too much resistance.", "What's a chip's favorite music? Silicon-valley punk!"],
  },
  Cathy: {
    greeting: ["Let's COUNT on having fun!", "Ready to add some excitement?", "Binary math: where 1+1=10!"],
    encouragement: ["You're really ADD-ing up skills!", "That's SUM excellent work!", "Carry on, my wayward bit!"],
    jokes: ["Why was 6 afraid of 7? Because 7 8 9... in binary!", "OCT 31 = DEC 25. Halloween = Christmas for programmers!", "There are 10 types of people: those who carry and those who don't!"],
  },
  Nina: {
    greeting: ["Welcome to the neural nexus!", "Let's build some BRAINS!", "Ready to train something amazing?"],
    encouragement: ["Your network is LEARNING!", "The weights are adjusting beautifully!", "That loss function is going DOWN!"],
    jokes: ["Why did the neural network go to therapy? Too many hidden layers!", "I asked my network a question... it gave a confidently wrong answer!", "Deep learning is just regular learning... but DEEPER!"],
  },
}

// ============================================
// PARTICLE SYSTEM - For celebrations
// ============================================
function generateParticles(count: number, color: string) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    size: Math.random() * 8 + 4,
    color,
    delay: Math.random() * 0.5,
    duration: 2 + Math.random() * 2,
  }))
}

function Particle({ x, size, color, delay, duration }: { x: number; size: number; color: string; delay: number; duration: number }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{ 
        left: `${x}%`, 
        top: `-10%`,
        width: size,
        height: size,
        backgroundColor: color,
        boxShadow: `0 0 10px ${color}`,
      }}
      initial={{ y: 0, opacity: 1, rotate: 0 }}
      animate={{ 
        y: [0, typeof window !== 'undefined' ? window.innerHeight + 100 : 800],
        opacity: [1, 1, 0],
        rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)]
      }}
      transition={{ duration, delay, ease: 'linear' }}
    />
  )
}

// ============================================
// WIRES COMPONENT - Incredible Machine Style
// ============================================
function Wire({ from, to, active, color = COLORS.primary }: { 
  from: { x: number; y: number }
  to: { x: number; y: number }
  active: boolean
  color?: string 
}) {
  const midX = (from.x + to.x) / 2
  const controlOffset = Math.abs(to.x - from.x) * 0.3
  
  return (
    <svg className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 5 }}>
      <defs>
        <linearGradient id={`wire-gradient-${active ? 'on' : 'off'}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={active ? color : COLORS.border} />
          <stop offset="50%" stopColor={active ? color : COLORS.border} />
          <stop offset="100%" stopColor={active ? color : COLORS.border} />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <motion.path
        d={`M ${from.x} ${from.y} C ${from.x + controlOffset} ${from.y}, ${to.x - controlOffset} ${to.y}, ${to.x} ${to.y}`}
        fill="none"
        stroke={active ? color : COLORS.border}
        strokeWidth={3}
        strokeLinecap="round"
        filter={active ? 'url(#glow)' : undefined}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5 }}
      />
      {active && (
        <motion.circle
          r={4}
          fill={color}
          filter="url(#glow)"
          initial={{ offsetDistance: '0%' }}
          animate={{ offsetDistance: '100%' }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{ offsetPath: `path('M ${from.x} ${from.y} C ${from.x + controlOffset} ${from.y}, ${to.x - controlOffset} ${to.y}, ${to.x} ${to.y}')` }}
        />
      )}
    </svg>
  )
}

// ============================================
// GEAR COMPONENT - Mechanical feel
// ============================================
function Gear({ size, x, y, spinning, speed = 1, teeth = 8 }: {
  size: number
  x: number
  y: number
  spinning?: boolean
  speed?: number
  teeth?: number
}) {
  const toothAngle = 360 / teeth
  
  return (
    <motion.svg
      width={size}
      height={size}
      style={{ position: 'absolute', left: x, top: y }}
      animate={{ rotate: spinning ? 360 : 0 }}
      transition={{ duration: 4 / speed, repeat: spinning ? Infinity : 0, ease: 'linear' }}
    >
      <g transform={`translate(${size/2}, ${size/2})`}>
        {/* Gear teeth */}
        {Array.from({ length: teeth }).map((_, i) => (
          <rect
            key={i}
            x={-size * 0.08}
            y={-size * 0.5}
            width={size * 0.16}
            height={size * 0.15}
            fill={COLORS.border}
            transform={`rotate(${i * toothAngle})`}
            rx={2}
          />
        ))}
        {/* Main circle */}
        <circle r={size * 0.4} fill={COLORS.card} stroke={COLORS.primary} strokeWidth={2} />
        {/* Center hole */}
        <circle r={size * 0.1} fill={COLORS.background} stroke={COLORS.primary} strokeWidth={1} />
      </g>
    </motion.svg>
  )
}

// ============================================
// OCTET SWITCHER GAME
// ============================================
function OctetSwitcherGame({ onBack, addXP }: { onBack: () => void; addXP: (xp: number) => void }) {
  const [switches, setSwitches] = useState<boolean[]>([false, false, false, false, false, false, false, false])
  const [particles, setParticles] = useState<Array<{ id: number; x: number; size: number; color: string; delay: number; duration: number }>>([])
  const [discovered, setDiscovered] = useState<Set<number>>(new Set())
  const [dialogue, setDialogue] = useState(NPC_DIALOGUES.Bitzy.greeting[0])
  const [flips, setFlips] = useState(0)
  
  const bitValues = [128, 64, 32, 16, 8, 4, 2, 1]
  const value = switches.reduce((acc, bit, i) => acc + (bit ? bitValues[i] : 0), 0)
  const response = SILLY_RESPONSES[String(value)] || { emoji: '🔢', message: `${value} - You got this!` }
  const binary = switches.map(b => b ? '1' : '0').join('')
  const hex = value.toString(16).toUpperCase().padStart(2, '0')
  
  const toggleSwitch = (i: number) => {
    setSwitches(prev => {
      const next = [...prev]
      next[i] = !next[i]
      return next
    })
    setFlips(f => f + 1)
    
    // Random dialogue
    if (Math.random() > 0.7) {
      const pool = [...NPC_DIALOGUES.Bitzy.encouragement, ...NPC_DIALOGUES.Bitzy.jokes]
      setDialogue(pool[Math.floor(Math.random() * pool.length)])
    }
  }
  
  useEffect(() => {
    if (!discovered.has(value)) {
      setDiscovered(prev => new Set([...prev, value]))
      if (SILLY_RESPONSES[String(value)]) {
        setParticles(generateParticles(20, COLORS.primary))
        setTimeout(() => setParticles([]), 2500)
      }
      // XP for discoveries
      if (discovered.size === 49) addXP(75)
      if (discovered.size === 99) addXP(100)
    }
  }, [value])
  
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: COLORS.background }}>
      {/* Particles */}
      {particles.map(p => <Particle key={p.id} {...p} />)}
      
      {/* Background gears */}
      <Gear size={120} x={-30} y={50} spinning={true} speed={0.5} />
      <Gear size={80} x={-10} y={130} spinning={true} speed={0.8} teeth={6} />
      <Gear size={100} x="calc(100% - 70px)" y={100} spinning={true} speed={0.6} />
      
      {/* Grid background */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(${COLORS.primary}20 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.primary}20 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />
      
      <div className="container mx-auto px-4 py-6 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-lg border transition-all"
            style={{ background: COLORS.card, borderColor: COLORS.border, color: COLORS.textMuted }}
          >
            ← Back
          </button>
          <div className="flex items-center gap-4">
            <div className="text-sm" style={{ color: COLORS.textMuted }}>
              Discovered: <span style={{ color: COLORS.primary }}>{discovered.size}/256</span>
            </div>
            <div className="text-sm" style={{ color: COLORS.textMuted }}>
              Flips: <span style={{ color: COLORS.accent.amber }}>{flips}</span>
            </div>
          </div>
        </div>
        
        {/* Title */}
        <motion.div 
          className="text-center mb-6"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <h1 className="text-3xl font-bold mb-1" style={{ color: COLORS.primary }}>
            🎛️ OCTET SWITCHER
          </h1>
          <p className="text-sm" style={{ color: COLORS.textMuted }}>8 bits = 256 possibilities</p>
        </motion.div>
        
        {/* NPC Dialogue */}
        <motion.div
          className="max-w-md mx-auto mb-6 p-4 rounded-xl border"
          style={{ background: COLORS.card, borderColor: COLORS.primary }}
          key={dialogue}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">🤖</span>
            <div>
              <div className="text-xs font-bold" style={{ color: COLORS.primary }}>Bitzy</div>
              <p className="text-sm" style={{ color: COLORS.text }}>{dialogue}</p>
            </div>
          </div>
        </motion.div>
        
        {/* Main Display */}
        <motion.div 
          className="text-center mb-6"
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <motion.div
            className="text-7xl mb-2"
            key={value}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            {response.emoji}
          </motion.div>
          <p className="text-xl font-bold" style={{ color: COLORS.primary }}>{response.message}</p>
        </motion.div>
        
        {/* Value Displays */}
        <div className="flex justify-center gap-4 mb-6">
          {[
            { label: 'DECIMAL', value: value, color: COLORS.accent.blue },
            { label: 'BINARY', value: binary, color: COLORS.primary },
            { label: 'HEX', value: `0x${hex}`, color: COLORS.accent.purple },
          ].map(({ label, value: v, color }) => (
            <motion.div
              key={label}
              className="px-4 py-3 rounded-xl text-center"
              style={{ background: COLORS.card, border: `2px solid ${color}` }}
              whileHover={{ scale: 1.05, boxShadow: `0 0 20px ${color}40` }}
            >
              <div className="text-xs" style={{ color }}>{label}</div>
              <div className="text-2xl font-mono font-bold" style={{ color: COLORS.text }}>{v}</div>
            </motion.div>
          ))}
        </div>
        
        {/* Switches */}
        <div className="flex justify-center gap-3 mb-6">
          {switches.map((on, i) => (
            <motion.div
              key={i}
              className="flex flex-col items-center gap-2"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="text-xs font-mono" style={{ color: COLORS.textMuted }}>{bitValues[i]}</div>
              <motion.button
                onClick={() => toggleSwitch(i)}
                className="relative w-14 h-20 rounded-xl cursor-pointer"
                style={{
                  background: on 
                    ? `linear-gradient(180deg, ${COLORS.primary}, ${COLORS.primaryDark})`
                    : `linear-gradient(180deg, #2a3a32, #1a2a22)`,
                  boxShadow: on ? COLORS.glow.green : 'none',
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {/* Switch knob */}
                <motion.div
                  className="absolute left-1 right-1 h-8 rounded-lg flex items-center justify-center"
                  style={{ 
                    top: on ? 4 : 40,
                    background: 'linear-gradient(180deg, #fff, #ddd)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  <span className="text-lg">{on ? '⚡' : '○'}</span>
                </motion.div>
              </motion.button>
              <motion.div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xl font-bold"
                style={{
                  background: on ? COLORS.primary : COLORS.card,
                  color: on ? COLORS.background : COLORS.textMuted,
                  border: `2px solid ${on ? COLORS.primary : COLORS.border}`,
                }}
                animate={on ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                {on ? '1' : '0'}
              </motion.div>
            </motion.div>
          ))}
        </div>
        
        {/* Quick Actions */}
        <div className="flex justify-center gap-3 flex-wrap">
          {[0, 42, 128, 255].map(num => (
            <motion.button
              key={num}
              onClick={() => setSwitches(bitValues.map(b => (num & b) !== 0))}
              className="px-4 py-2 rounded-lg font-mono text-sm"
              style={{ 
                background: value === num ? COLORS.primary : COLORS.card,
                color: value === num ? COLORS.background : COLORS.text,
                border: `1px solid ${COLORS.border}`,
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              {num}
            </motion.button>
          ))}
          <motion.button
            onClick={() => setSwitches(Array.from({ length: 8 }, () => Math.random() > 0.5))}
            className="px-4 py-2 rounded-lg text-sm"
            style={{ background: COLORS.accent.amber, color: COLORS.background }}
            whileHover={{ scale: 1.1 }}
          >
            🎲 Random
          </motion.button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// LOGIC GATE WORKSHOP GAME
// ============================================
function LogicGateGame({ onBack, addXP }: { onBack: () => void; addXP: (xp: number) => void }) {
  const [gateType, setGateType] = useState<'AND' | 'OR' | 'NOT' | 'XOR' | 'NAND'>('AND')
  const [inputA, setInputA] = useState(false)
  const [inputB, setInputB] = useState(true)
  const [particles, setParticles] = useState<Array<{ id: number; x: number; size: number; color: string; delay: number; duration: number }>>([])
  const [dialogue, setDialogue] = useState(NPC_DIALOGUES.Gary.greeting[0])
  const [completedGates, setCompletedGates] = useState<Set<string>>(new Set())
  
  const computeOutput = () => {
    switch (gateType) {
      case 'AND': return inputA && inputB
      case 'OR': return inputA || inputB
      case 'NOT': return !inputA
      case 'XOR': return inputA !== inputB
      case 'NAND': return !(inputA && inputB)
      default: return false
    }
  }
  
  const output = computeOutput()
  
  const gateSymbols: Record<string, string> = {
    AND: '&',
    OR: '≥1',
    NOT: '1',
    XOR: '=1',
    NAND: '&̅',
  }
  
  const checkGate = () => {
    const key = `${gateType}-${inputA}-${inputB}`
    if (!completedGates.has(key)) {
      setCompletedGates(prev => new Set([...prev, key]))
      setParticles(generateParticles(15, COLORS.accent.amber))
      setTimeout(() => setParticles([]), 2000)
      addXP(20)
      setDialogue(NPC_DIALOGUES.Gary.encouragement[Math.floor(Math.random() * NPC_DIALOGUES.Gary.encouragement.length)])
    }
  }
  
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: COLORS.background }}>
      {particles.map(p => <Particle key={p.id} {...p} />)}
      
      {/* Circuit board pattern */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            radial-gradient(circle at 2px 2px, ${COLORS.accent.amber} 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      />
      
      <div className="container mx-auto px-4 py-6 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="px-4 py-2 rounded-lg border" style={{ background: COLORS.card, borderColor: COLORS.border, color: COLORS.textMuted }}>← Back</button>
          <div className="flex items-center gap-2">
            {['AND', 'OR', 'NOT', 'XOR', 'NAND'].map(g => (
              <button
                key={g}
                onClick={() => setGateType(g as any)}
                className="px-3 py-1 rounded-lg text-sm font-mono"
                style={{
                  background: gateType === g ? COLORS.accent.amber : COLORS.card,
                  color: gateType === g ? COLORS.background : COLORS.text,
                  border: `1px solid ${gateType === g ? COLORS.accent.amber : COLORS.border}`,
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        
        <motion.div className="text-center mb-6" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <h1 className="text-3xl font-bold mb-1" style={{ color: COLORS.accent.amber }}>⚡ LOGIC GATE WORKSHOP</h1>
          <p className="text-sm" style={{ color: COLORS.textMuted }}>Build circuits, see truth!</p>
        </motion.div>
        
        {/* NPC */}
        <motion.div
          className="max-w-md mx-auto mb-6 p-4 rounded-xl border"
          style={{ background: COLORS.card, borderColor: COLORS.accent.amber }}
          key={dialogue}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔌</span>
            <div>
              <div className="text-xs font-bold" style={{ color: COLORS.accent.amber }}>Gary</div>
              <p className="text-sm" style={{ color: COLORS.text }}>{dialogue}</p>
            </div>
          </div>
        </motion.div>
        
        {/* Gate Visualization */}
        <div className="flex justify-center items-center gap-8 my-12">
          {/* Input A */}
          <motion.div
            className="flex flex-col items-center gap-2"
            animate={{ scale: inputA ? [1, 1.1, 1] : 1 }}
          >
            <div className="text-sm" style={{ color: COLORS.textMuted }}>Input A</div>
            <motion.button
              onClick={() => setInputA(!inputA)}
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
              style={{
                background: inputA ? COLORS.primary : COLORS.card,
                color: inputA ? COLORS.background : COLORS.textMuted,
                border: `3px solid ${inputA ? COLORS.primary : COLORS.border}`,
                boxShadow: inputA ? COLORS.glow.green : 'none',
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              {inputA ? '1' : '0'}
            </motion.button>
          </motion.div>
          
          {/* Input B (hidden for NOT) */}
          {gateType !== 'NOT' && (
            <motion.div
              className="flex flex-col items-center gap-2"
              animate={{ scale: inputB ? [1, 1.1, 1] : 1 }}
            >
              <div className="text-sm" style={{ color: COLORS.textMuted }}>Input B</div>
              <motion.button
                onClick={() => setInputB(!inputB)}
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
                style={{
                  background: inputB ? COLORS.primary : COLORS.card,
                  color: inputB ? COLORS.background : COLORS.textMuted,
                  border: `3px solid ${inputB ? COLORS.primary : COLORS.border}`,
                  boxShadow: inputB ? COLORS.glow.green : 'none',
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                {inputB ? '1' : '0'}
              </motion.button>
            </motion.div>
          )}
          
          {/* The Gate */}
          <motion.div
            className="relative w-24 h-24 rounded-2xl flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${COLORS.card}, ${COLORS.cardHover})`,
              border: `3px solid ${COLORS.accent.amber}`,
              boxShadow: COLORS.glow.amber,
            }}
            animate={{ rotate: output ? [0, 5, -5, 0] : 0 }}
          >
            <span className="text-3xl font-bold" style={{ color: COLORS.accent.amber }}>{gateSymbols[gateType]}</span>
            <div className="absolute -top-6 text-xs" style={{ color: COLORS.textMuted }}>{gateType}</div>
          </motion.div>
          
          {/* Wire to output */}
          <div className="flex items-center">
            <motion.div
              className="w-12 h-2 rounded-full"
              style={{ background: output ? COLORS.primary : COLORS.border }}
              animate={output ? { opacity: [1, 0.5, 1] } : {}}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
            <motion.div
              className="w-0 h-0 border-t-8 border-b-8 border-l-12"
              style={{ borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: output ? COLORS.primary : COLORS.border }}
            />
          </div>
          
          {/* Output */}
          <motion.div
            className="flex flex-col items-center gap-2"
            animate={{ scale: output ? [1, 1.2, 1] : 1 }}
          >
            <div className="text-sm" style={{ color: COLORS.textMuted }}>Output</div>
            <motion.div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
              style={{
                background: output ? COLORS.primary : COLORS.card,
                color: output ? COLORS.background : COLORS.textMuted,
                border: `3px solid ${output ? COLORS.primary : COLORS.border}`,
                boxShadow: output ? COLORS.glow.green : 'none',
              }}
            >
              {output ? '1' : '0'}
            </motion.div>
          </motion.div>
        </div>
        
        {/* Check Button */}
        <div className="flex justify-center">
          <motion.button
            onClick={checkGate}
            className="px-8 py-3 rounded-xl font-bold text-lg"
            style={{ background: COLORS.accent.amber, color: COLORS.background }}
            whileHover={{ scale: 1.05, boxShadow: COLORS.glow.amber }}
            whileTap={{ scale: 0.95 }}
          >
            ✓ Check Gate
          </motion.button>
        </div>
        
        {/* Truth Table */}
        <motion.div 
          className="max-w-xs mx-auto mt-8 p-4 rounded-xl"
          style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
        >
          <div className="text-xs font-bold mb-2" style={{ color: COLORS.accent.amber }}>TRUTH TABLE</div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
            <div style={{ color: COLORS.textMuted }}>A</div>
            <div style={{ color: COLORS.textMuted }}>B</div>
            <div style={{ color: COLORS.textMuted }}>OUT</div>
            {gateType !== 'NOT' ? (
              <>
                {[false, true].map(a => [false, true].map(b => (
                  <motion.div
                    key={`${a}-${b}`}
                    className="px-2 py-1 rounded"
                    style={{
                      background: (a === inputA && b === inputB) ? COLORS.accent.amber + '30' : 'transparent',
                      color: (a === inputA && b === inputB) ? COLORS.accent.amber : COLORS.text,
                    }}
                  >
                    {a ? 1 : 0}
                  </motion.div>
                )))}
              </>
            ) : (
              <>
                {[false, true].map(a => (
                  <motion.div
                    key={a}
                    className="px-2 py-1 rounded"
                    style={{
                      background: (a === inputA) ? COLORS.accent.amber + '30' : 'transparent',
                      color: (a === inputA) ? COLORS.accent.amber : COLORS.text,
                    }}
                  >
                    {a ? 1 : 0}
                  </motion.div>
                ))}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// ============================================
// CHIP DESIGNER LAB GAME
// ============================================
function ChipDesignerGame({ onBack, addXP }: { onBack: () => void; addXP: (xp: number) => void }) {
  const [grid, setGrid] = useState<(null | 'NMOS' | 'PMOS' | 'WIRE' | 'VDD' | 'GND')[][]>(
    Array(8).fill(null).map(() => Array(8).fill(null))
  )
  const [tool, setTool] = useState<'NMOS' | 'PMOS' | 'WIRE' | 'VDD' | 'GND' | 'ERASE'>('NMOS')
  const [particles, setParticles] = useState<Array<{ id: number; x: number; size: number; color: string; delay: number; duration: number }>>([])
  const [dialogue, setDialogue] = useState(NPC_DIALOGUES.Sam.greeting[0])
  const [transistorCount, setTransistorCount] = useState(0)
  
  const toolColors: Record<string, string> = {
    NMOS: COLORS.accent.blue,
    PMOS: COLORS.accent.purple,
    WIRE: COLORS.textMuted,
    VDD: COLORS.accent.amber,
    GND: COLORS.accent.red,
  }
  
  const toolIcons: Record<string, string> = {
    NMOS: '⬇️',
    PMOS: '⬆️',
    WIRE: '➖',
    VDD: '⚡',
    GND: '⏚',
    ERASE: '🗑️',
  }
  
  const placeComponent = (row: number, col: number) => {
    setGrid(prev => {
      const next = prev.map(r => [...r])
      if (tool === 'ERASE') {
        next[row][col] = null
      } else {
        next[row][col] = tool
      }
      return next
    })
    
    // Count transistors
    const count = grid.flat().filter(c => c === 'NMOS' || c === 'PMOS').length
    setTransistorCount(count)
    
    if (count > 0 && count % 4 === 0) {
      addXP(10)
      setDialogue(NPC_DIALOGUES.Sam.encouragement[Math.floor(Math.random() * NPC_DIALOGUES.Sam.encouragement.length)])
    }
  }
  
  const clearGrid = () => {
    setGrid(Array(8).fill(null).map(() => Array(8).fill(null)))
    setTransistorCount(0)
  }
  
  const loadInverter = () => {
    const newGrid: (null | 'NMOS' | 'PMOS' | 'WIRE' | 'VDD' | 'GND')[][] = 
      Array(8).fill(null).map(() => Array(8).fill(null))
    newGrid[1][3] = 'VDD'
    newGrid[2][3] = 'PMOS'
    newGrid[3][3] = 'WIRE'
    newGrid[4][3] = 'NMOS'
    newGrid[5][3] = 'GND'
    setGrid(newGrid)
    setTransistorCount(2)
    setParticles(generateParticles(15, COLORS.accent.cyan))
    setTimeout(() => setParticles([]), 2000)
    setDialogue("Perfect! That's a CMOS inverter! 2 transistors, one function!")
    addXP(50)
  }
  
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: COLORS.background }}>
      {particles.map(p => <Particle key={p.id} {...p} />)}
      
      {/* Silicon wafer pattern */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            repeating-linear-gradient(0deg, transparent, transparent 7px, ${COLORS.accent.cyan}20 7px, ${COLORS.accent.cyan}20 8px),
            repeating-linear-gradient(90deg, transparent, transparent 7px, ${COLORS.accent.cyan}20 7px, ${COLORS.accent.cyan}20 8px)
          `,
          backgroundSize: '8px 8px',
        }}
      />
      
      <div className="container mx-auto px-4 py-6 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="px-4 py-2 rounded-lg border" style={{ background: COLORS.card, borderColor: COLORS.border, color: COLORS.textMuted }}>← Back</button>
          <div className="flex items-center gap-4">
            <div className="text-sm" style={{ color: COLORS.textMuted }}>
              Transistors: <span style={{ color: COLORS.accent.cyan }}>{transistorCount}</span>
            </div>
          </div>
        </div>
        
        <motion.div className="text-center mb-4" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <h1 className="text-3xl font-bold mb-1" style={{ color: COLORS.accent.cyan }}>🔬 CHIP DESIGNER LAB</h1>
          <p className="text-sm" style={{ color: COLORS.textMuted }}>Layout transistors, build silicon dreams</p>
        </motion.div>
        
        {/* NPC */}
        <motion.div
          className="max-w-md mx-auto mb-4 p-4 rounded-xl border"
          style={{ background: COLORS.card, borderColor: COLORS.accent.cyan }}
          key={dialogue}
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧬</span>
            <div>
              <div className="text-xs font-bold" style={{ color: COLORS.accent.cyan }}>Sam</div>
              <p className="text-sm" style={{ color: COLORS.text }}>{dialogue}</p>
            </div>
          </div>
        </motion.div>
        
        {/* Tool Palette */}
        <div className="flex justify-center gap-2 mb-6 flex-wrap">
          {(['NMOS', 'PMOS', 'WIRE', 'VDD', 'GND', 'ERASE'] as const).map(t => (
            <motion.button
              key={t}
              onClick={() => setTool(t)}
              className="px-4 py-2 rounded-lg flex items-center gap-2"
              style={{
                background: tool === t ? toolColors[t] || COLORS.card : COLORS.card,
                color: tool === t ? COLORS.background : COLORS.text,
                border: `2px solid ${tool === t ? toolColors[t] : COLORS.border}`,
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span>{toolIcons[t]}</span>
              <span className="text-sm">{t}</span>
            </motion.button>
          ))}
        </div>
        
        {/* Grid */}
        <div className="flex justify-center mb-6">
          <motion.div
            className="p-4 rounded-2xl"
            style={{ background: COLORS.card, border: `2px solid ${COLORS.accent.cyan}` }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="grid grid-cols-8 gap-1">
              {grid.map((row, ri) => row.map((cell, ci) => (
                <motion.button
                  key={`${ri}-${ci}`}
                  onClick={() => placeComponent(ri, ci)}
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                  style={{
                    background: cell ? toolColors[cell] || COLORS.cardHover : COLORS.background,
                    border: `1px solid ${COLORS.border}`,
                  }}
                  whileHover={{ scale: 1.1, boxShadow: `0 0 10px ${COLORS.accent.cyan}40` }}
                  whileTap={{ scale: 0.9 }}
                >
                  {cell && (cell === 'NMOS' ? '⬇️' : cell === 'PMOS' ? '⬆️' : cell === 'VDD' ? '⚡' : cell === 'GND' ? '⏚' : '—')}
                </motion.button>
              )))}
            </div>
          </motion.div>
        </div>
        
        {/* Actions */}
        <div className="flex justify-center gap-4">
          <motion.button
            onClick={loadInverter}
            className="px-6 py-2 rounded-lg font-bold"
            style={{ background: COLORS.accent.cyan, color: COLORS.background }}
            whileHover={{ scale: 1.05 }}
          >
            📥 Load Inverter
          </motion.button>
          <motion.button
            onClick={clearGrid}
            className="px-6 py-2 rounded-lg"
            style={{ background: COLORS.card, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
            whileHover={{ scale: 1.05 }}
          >
            🗑️ Clear
          </motion.button>
        </div>
        
        {/* Legend */}
        <motion.div 
          className="max-w-md mx-auto mt-6 p-4 rounded-xl"
          style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
        >
          <div className="text-xs font-bold mb-2" style={{ color: COLORS.accent.cyan }}>COMPONENT LEGEND</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span>⬆️ PMOS</span>
              <span style={{ color: COLORS.textMuted }}>- Pull-up (VDD to output)</span>
            </div>
            <div className="flex items-center gap-2">
              <span>⬇️ NMOS</span>
              <span style={{ color: COLORS.textMuted }}>- Pull-down (output to GND)</span>
            </div>
            <div className="flex items-center gap-2">
              <span>⚡ VDD</span>
              <span style={{ color: COLORS.textMuted }}>- Power supply</span>
            </div>
            <div className="flex items-center gap-2">
              <span>⏚ GND</span>
              <span style={{ color: COLORS.textMuted }}>- Ground</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// ============================================
// BINARY CALCULATOR GAME
// ============================================
function BinaryCalcGame({ onBack, addXP }: { onBack: () => void; addXP: (xp: number) => void }) {
  const [bitsA, setBitsA] = useState([false, false, false, false]) // 4-bit number A
  const [bitsB, setBitsB] = useState([false, false, false, false]) // 4-bit number B
  const [showCarry, setShowCarry] = useState(true)
  const [particles, setParticles] = useState<Array<{ id: number; x: number; size: number; color: string; delay: number; duration: number }>>([])
  const [dialogue, setDialogue] = useState(NPC_DIALOGUES.Cathy.greeting[0])
  const [operation, setOperation] = useState<'ADD' | 'SUB'>('ADD')
  
  const bitValues = [8, 4, 2, 1]
  const valueA = bitsA.reduce((acc, bit, i) => acc + (bit ? bitValues[i] : 0), 0)
  const valueB = bitsB.reduce((acc, bit, i) => acc + (bit ? bitValues[i] : 0), 0)
  
  // Calculate result with carry propagation visualization
  const calculateResult = () => {
    let result = operation === 'ADD' ? valueA + valueB : valueA - valueB
    if (result < 0) result = 16 + result // Two's complement wrap
    if (result > 15) result = result % 16 // Overflow
    return result
  }
  
  const result = calculateResult()
  const resultBits = bitValues.map(b => (result & b) !== 0)
  
  // Calculate carries for visualization
  const getCarries = () => {
    const carries = [false, false, false, false]
    let carry = false
    for (let i = 3; i >= 0; i--) {
      const sum = (bitsA[i] ? 1 : 0) + (bitsB[i] ? 1 : 0) + (carry ? 1 : 0)
      carries[i] = sum >= 2
      carry = sum >= 2
    }
    return carries
  }
  
  const carries = getCarries()
  
  const toggleBitA = (i: number) => {
    setBitsA(prev => {
      const next = [...prev]
      next[i] = !next[i]
      return next
    })
    if (Math.random() > 0.7) {
      setDialogue(NPC_DIALOGUES.Cathy.encouragement[Math.floor(Math.random() * NPC_DIALOGUES.Cathy.encouragement.length)])
    }
  }
  
  const toggleBitB = (i: number) => {
    setBitsB(prev => {
      const next = [...prev]
      next[i] = !next[i]
      return next
    })
  }
  
  const checkAnswer = () => {
    setParticles(generateParticles(20, COLORS.accent.purple))
    setTimeout(() => setParticles([]), 2000)
    addXP(25)
    setDialogue("Perfect! The carry propagated correctly! You're doing binary math!")
  }
  
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: COLORS.background }}>
      {particles.map(p => <Particle key={p.id} {...p} />)}
      
      <div className="container mx-auto px-4 py-6 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="px-4 py-2 rounded-lg border" style={{ background: COLORS.card, borderColor: COLORS.border, color: COLORS.textMuted }}>← Back</button>
          <div className="flex gap-2">
            <button
              onClick={() => setOperation('ADD')}
              className="px-4 py-1 rounded-lg text-sm font-mono"
              style={{
                background: operation === 'ADD' ? COLORS.accent.purple : COLORS.card,
                color: operation === 'ADD' ? COLORS.background : COLORS.text,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              +
            </button>
            <button
              onClick={() => setOperation('SUB')}
              className="px-4 py-1 rounded-lg text-sm font-mono"
              style={{
                background: operation === 'SUB' ? COLORS.accent.purple : COLORS.card,
                color: operation === 'SUB' ? COLORS.background : COLORS.text,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              −
            </button>
          </div>
        </div>
        
        <motion.div className="text-center mb-4" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <h1 className="text-3xl font-bold mb-1" style={{ color: COLORS.accent.purple }}>🧮 BINARY CALCULATOR</h1>
          <p className="text-sm" style={{ color: COLORS.textMuted }}>Watch carries ripple through the adder!</p>
        </motion.div>
        
        {/* NPC */}
        <motion.div
          className="max-w-md mx-auto mb-4 p-4 rounded-xl border"
          style={{ background: COLORS.card, borderColor: COLORS.accent.purple }}
          key={dialogue}
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">📊</span>
            <div>
              <div className="text-xs font-bold" style={{ color: COLORS.accent.purple }}>Cathy</div>
              <p className="text-sm" style={{ color: COLORS.text }}>{dialogue}</p>
            </div>
          </div>
        </motion.div>
        
        {/* Calculator Display */}
        <div className="max-w-lg mx-auto">
          {/* Number A */}
          <div className="mb-4">
            <div className="text-center text-sm mb-2" style={{ color: COLORS.textMuted }}>Number A: {valueA}</div>
            <div className="flex justify-center gap-2">
              {bitsA.map((bit, i) => (
                <motion.button
                  key={i}
                  onClick={() => toggleBitA(i)}
                  className="w-14 h-14 rounded-lg flex flex-col items-center justify-center"
                  style={{
                    background: bit ? COLORS.primary : COLORS.card,
                    border: `2px solid ${bit ? COLORS.primary : COLORS.border}`,
                    color: bit ? COLORS.background : COLORS.text,
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <span className="text-xl font-bold">{bit ? '1' : '0'}</span>
                  <span className="text-xs opacity-50">{bitValues[i]}</span>
                </motion.button>
              ))}
            </div>
          </div>
          
          {/* Operator */}
          <div className="text-center text-3xl mb-4" style={{ color: COLORS.accent.purple }}>
            {operation === 'ADD' ? '+' : '−'}
          </div>
          
          {/* Number B */}
          <div className="mb-4">
            <div className="text-center text-sm mb-2" style={{ color: COLORS.textMuted }}>Number B: {valueB}</div>
            <div className="flex justify-center gap-2">
              {bitsB.map((bit, i) => (
                <motion.button
                  key={i}
                  onClick={() => toggleBitB(i)}
                  className="w-14 h-14 rounded-lg flex flex-col items-center justify-center"
                  style={{
                    background: bit ? COLORS.accent.amber : COLORS.card,
                    border: `2px solid ${bit ? COLORS.accent.amber : COLORS.border}`,
                    color: bit ? COLORS.background : COLORS.text,
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <span className="text-xl font-bold">{bit ? '1' : '0'}</span>
                  <span className="text-xs opacity-50">{bitValues[i]}</span>
                </motion.button>
              ))}
            </div>
          </div>
          
          {/* Carry Row */}
          {showCarry && (
            <motion.div 
              className="mb-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="text-center text-xs mb-1" style={{ color: COLORS.accent.red }}>Carries</div>
              <div className="flex justify-center gap-2">
                {carries.map((carry, i) => (
                  <div
                    key={i}
                    className="w-14 h-6 rounded flex items-center justify-center text-xs font-mono"
                    style={{
                      background: 'transparent',
                      color: carry ? COLORS.accent.red : COLORS.textMuted,
                    }}
                  >
                    {carry ? '1' : '·'}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
          
          {/* Divider */}
          <div className="border-b-2 mb-4" style={{ borderColor: COLORS.accent.purple }} />
          
          {/* Result */}
          <div className="mb-4">
            <div className="text-center text-sm mb-2" style={{ color: COLORS.primary }}>Result: {result}</div>
            <div className="flex justify-center gap-2">
              {resultBits.map((bit, i) => (
                <motion.div
                  key={i}
                  className="w-14 h-14 rounded-lg flex flex-col items-center justify-center"
                  style={{
                    background: bit ? COLORS.accent.purple : COLORS.card,
                    border: `2px solid ${bit ? COLORS.accent.purple : COLORS.border}`,
                    color: bit ? COLORS.background : COLORS.text,
                  }}
                  animate={bit ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  <span className="text-xl font-bold">{bit ? '1' : '0'}</span>
                  <span className="text-xs opacity-50">{bitValues[i]}</span>
                </motion.div>
              ))}
            </div>
          </div>
          
          {/* Formula */}
          <motion.div 
            className="text-center p-4 rounded-xl mb-4"
            style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
          >
            <span className="font-mono" style={{ color: COLORS.text }}>
              {valueA} {operation === 'ADD' ? '+' : '−'} {valueB} = <span style={{ color: COLORS.primary }}>{result}</span>
            </span>
            <span className="text-xs ml-2" style={{ color: COLORS.textMuted }}>
              (0b{valueA.toString(2).padStart(4, '0')} {operation === 'ADD' ? '+' : '−'} 0b{valueB.toString(2).padStart(4, '0')} = 0b{result.toString(2).padStart(4, '0')})
            </span>
          </motion.div>
          
          {/* Check Button */}
          <div className="flex justify-center">
            <motion.button
              onClick={checkAnswer}
              className="px-8 py-3 rounded-xl font-bold"
              style={{ background: COLORS.accent.purple, color: COLORS.background }}
              whileHover={{ scale: 1.05, boxShadow: COLORS.glow.purple }}
              whileTap={{ scale: 0.95 }}
            >
              ✓ Check Result
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// NEURAL NETWORK EXPLORER GAME
// ============================================
function NeuralNetGame({ onBack, addXP }: { onBack: () => void; addXP: (xp: number) => void }) {
  const [layers, setLayers] = useState<number[]>([2, 3, 1]) // neurons per layer
  const [weights, setWeights] = useState<number[][][]>([[[
    Math.random(), Math.random(), Math.random(),
    Math.random(), Math.random(), Math.random()
  ], [
    Math.random(), Math.random(), Math.random()
  ]]])
  const [inputValues, setInputValues] = useState([0.5, 0.5])
  const [particles, setParticles] = useState<Array<{ id: number; x: number; size: number; color: string; delay: number; duration: number }>>([])
  const [dialogue, setDialogue] = useState(NPC_DIALOGUES.Nina.greeting[0])
  const [isTraining, setIsTraining] = useState(false)
  const [epoch, setEpoch] = useState(0)
  const [loss, setLoss] = useState(1.0)
  
  const colors = [COLORS.accent.blue, COLORS.accent.purple, COLORS.accent.pink, COLORS.accent.amber]
  
  const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))
  
  // Forward pass
  const forwardPass = () => {
    let activations = [...inputValues]
    
    for (let l = 0; l < layers.length - 1; l++) {
      const newActivations: number[] = []
      for (let j = 0; j < layers[l + 1]; j++) {
        let sum = 0
        for (let i = 0; i < layers[l]; i++) {
          sum += activations[i] * (weights[l]?.[j]?.[i] ?? 0.5)
        }
        newActivations.push(sigmoid(sum))
      }
      activations = newActivations
    }
    
    return activations
  }
  
  const output = forwardPass()
  
  const train = () => {
    setIsTraining(true)
    let e = 0
    const interval = setInterval(() => {
      e++
      setEpoch(e)
      setLoss(prev => Math.max(0.01, prev * 0.95))
      
      // Randomly adjust weights
      setWeights(prev => prev.map(layer => 
        layer.map(neuron => 
          neuron.map(w => w + (Math.random() - 0.5) * 0.1)
        )
      ))
      
      if (e >= 20) {
        clearInterval(interval)
        setIsTraining(false)
        setParticles(generateParticles(30, COLORS.accent.pink))
        setTimeout(() => setParticles([]), 2500)
        addXP(50)
        setDialogue("Amazing! The network learned! The loss is going DOWN!")
      }
    }, 200)
  }
  
  const addLayer = () => {
    if (layers.length < 5) {
      setLayers(prev => [...prev.slice(0, -1), 3, prev[prev.length - 1]])
      setDialogue(NPC_DIALOGUES.Nina.encouragement[0])
    }
  }
  
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: COLORS.background }}>
      {particles.map(p => <Particle key={p.id} {...p} />)}
      
      {/* Neural pulse background */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 50%, ${COLORS.accent.pink} 0%, transparent 50%)
          `,
          backgroundSize: '100px 100px',
        }}
      />
      
      <div className="container mx-auto px-4 py-6 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="px-4 py-2 rounded-lg border" style={{ background: COLORS.card, borderColor: COLORS.border, color: COLORS.textMuted }}>← Back</button>
          <div className="flex items-center gap-4">
            <div className="text-sm" style={{ color: COLORS.textMuted }}>
              Epoch: <span style={{ color: COLORS.accent.pink }}>{epoch}</span>
            </div>
            <div className="text-sm" style={{ color: COLORS.textMuted }}>
              Loss: <span style={{ color: loss < 0.5 ? COLORS.primary : COLORS.accent.red }}>{loss.toFixed(3)}</span>
            </div>
          </div>
        </div>
        
        <motion.div className="text-center mb-4" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <h1 className="text-3xl font-bold mb-1" style={{ color: COLORS.accent.pink }}>🧠 NEURAL EXPLORER</h1>
          <p className="text-sm" style={{ color: COLORS.textMuted }}>Build and train your own neural network!</p>
        </motion.div>
        
        {/* NPC */}
        <motion.div
          className="max-w-md mx-auto mb-4 p-4 rounded-xl border"
          style={{ background: COLORS.card, borderColor: COLORS.accent.pink }}
          key={dialogue}
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">✨</span>
            <div>
              <div className="text-xs font-bold" style={{ color: COLORS.accent.pink }}>Nina</div>
              <p className="text-sm" style={{ color: COLORS.text }}>{dialogue}</p>
            </div>
          </div>
        </motion.div>
        
        {/* Network Visualization */}
        <div className="relative h-64 mb-6 flex items-center justify-center">
          <svg className="absolute inset-0" style={{ zIndex: 1 }}>
            {/* Draw connections */}
            {layers.map((neuronCount, layerIdx) => {
              if (layerIdx === layers.length - 1) return null
              const x1 = 100 + layerIdx * 150
              const x2 = 100 + (layerIdx + 1) * 150
              
              return Array.from({ length: neuronCount }).map((_, i) => 
                Array.from({ length: layers[layerIdx + 1] }).map((_, j) => (
                  <motion.line
                    key={`${layerIdx}-${i}-${j}`}
                    x1={x1}
                    y1={150 + i * 50 - (neuronCount - 1) * 25}
                    x2={x2}
                    y2={150 + j * 50 - (layers[layerIdx + 1] - 1) * 25}
                    stroke={colors[layerIdx % colors.length]}
                    strokeWidth={isTraining ? 2 + Math.random() * 2 : 2}
                    opacity={0.5}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: layerIdx * 0.2 }}
                  />
                ))
              )
            })}
          </svg>
          
          {/* Neurons */}
          <div className="flex gap-32 relative z-10">
            {layers.map((neuronCount, layerIdx) => (
              <div key={layerIdx} className="flex flex-col gap-4">
                <div className="text-xs text-center" style={{ color: COLORS.textMuted }}>
                  {layerIdx === 0 ? 'Input' : layerIdx === layers.length - 1 ? 'Output' : `Hidden ${layerIdx}`}
                </div>
                <div className="flex flex-col gap-6 items-center">
                  {Array.from({ length: neuronCount }).map((_, i) => {
                    const activation = layerIdx === 0 
                      ? inputValues[i] ?? 0.5
                      : layerIdx === layers.length - 1 
                        ? output[i] ?? 0.5 
                        : 0.5
                    
                    return (
                      <motion.div
                        key={i}
                        className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{
                          background: `linear-gradient(135deg, ${colors[layerIdx % colors.length]}, ${colors[(layerIdx + 1) % colors.length]})`,
                          boxShadow: `0 0 ${20 + activation * 20}px ${colors[layerIdx % colors.length]}80`,
                          color: COLORS.background,
                        }}
                        animate={isTraining ? { scale: [1, 1.2, 1] } : {}}
                        transition={{ duration: 0.3, repeat: isTraining ? Infinity : 0 }}
                      >
                        {activation.toFixed(1)}
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Input Controls */}
        <div className="flex justify-center gap-4 mb-6">
          {inputValues.map((val, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="text-xs" style={{ color: COLORS.textMuted }}>Input {i + 1}</div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={val}
                onChange={(e) => setInputValues(prev => {
                  const next = [...prev]
                  next[i] = parseFloat(e.target.value)
                  return next
                })}
                className="w-24"
                style={{ accentColor: COLORS.accent.blue }}
              />
              <div className="text-sm font-mono" style={{ color: COLORS.accent.blue }}>{val.toFixed(1)}</div>
            </div>
          ))}
        </div>
        
        {/* Actions */}
        <div className="flex justify-center gap-4">
          <motion.button
            onClick={train}
            disabled={isTraining}
            className="px-8 py-3 rounded-xl font-bold"
            style={{ 
              background: isTraining ? COLORS.textMuted : COLORS.accent.pink, 
              color: COLORS.background 
            }}
            whileHover={!isTraining ? { scale: 1.05, boxShadow: COLORS.glow.purple } : {}}
            whileTap={!isTraining ? { scale: 0.95 } : {}}
          >
            {isTraining ? '🔄 Training...' : '🚂 Train Network'}
          </motion.button>
          <motion.button
            onClick={addLayer}
            className="px-6 py-3 rounded-xl"
            style={{ background: COLORS.card, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
            whileHover={{ scale: 1.05 }}
          >
            + Add Layer
          </motion.button>
        </div>
        
        {/* Architecture Info */}
        <motion.div 
          className="max-w-md mx-auto mt-6 p-4 rounded-xl"
          style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
        >
          <div className="text-xs font-bold mb-2" style={{ color: COLORS.accent.pink }}>NETWORK ARCHITECTURE</div>
          <div className="flex items-center justify-center gap-2">
            {layers.map((n, i) => (
              <span key={i} className="flex items-center gap-2">
                <span className="px-2 py-1 rounded" style={{ background: colors[i % colors.length] + '30', color: colors[i % colors.length] }}>
                  {n}
                </span>
                {i < layers.length - 1 && <span style={{ color: COLORS.textMuted }}>→</span>}
              </span>
            ))}
          </div>
          <div className="text-xs mt-2 text-center" style={{ color: COLORS.textMuted }}>
            {layers.reduce((a, b) => a + b, 0)} neurons total
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// ============================================
// MAIN PAGE - Adventure Menu
// ============================================
export default function LucineerGames() {
  const [currentGame, setCurrentGame] = useState<string | null>(null)
  const [totalXP, setTotalXP] = useState(0)
  
  const addXP = useCallback((xp: number) => {
    setTotalXP(prev => prev + xp)
  }, [])
  
  const goBack = () => setCurrentGame(null)
  
  // Render current game
  if (currentGame === 'octet_switcher') {
    return <OctetSwitcherGame onBack={goBack} addXP={addXP} />
  }
  if (currentGame === 'logic_gates') {
    return <LogicGateGame onBack={goBack} addXP={addXP} />
  }
  if (currentGame === 'chip_designer') {
    return <ChipDesignerGame onBack={goBack} addXP={addXP} />
  }
  if (currentGame === 'binary_calc') {
    return <BinaryCalcGame onBack={goBack} addXP={addXP} />
  }
  if (currentGame === 'neural_net') {
    return <NeuralNetGame onBack={goBack} addXP={addXP} />
  }
  
  // Main menu
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: COLORS.background }}>
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(${COLORS.primary}20 1px, transparent 1px),
              linear-gradient(90deg, ${COLORS.primary}20 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
        
        {/* Floating gears */}
        <Gear size={200} x={-80} y={100} spinning={true} speed={0.3} />
        <Gear size={150} x="calc(100% - 75px)" y={200} spinning={true} speed={0.4} teeth={6} />
        <Gear size={100} x={100} y="calc(100% - 100px)" spinning={true} speed={0.5} />
      </div>
      
      <div className="container mx-auto px-4 py-12 relative z-10">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <motion.div
            className="text-6xl mb-4"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🎮
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-bold mb-2">
            <span style={{ background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.accent.cyan}, ${COLORS.accent.purple})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              LUCINEER LEARNING LAB
            </span>
          </h1>
          <p style={{ color: COLORS.textMuted }} className="text-lg">
            Cyberpunk-lite STEM Adventures for Future Engineers
          </p>
        </motion.div>
        
        {/* XP Display */}
        <motion.div
          className="flex justify-center mb-8"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <div 
            className="px-6 py-3 rounded-full flex items-center gap-3"
            style={{ background: COLORS.card, border: `2px solid ${COLORS.primary}`, boxShadow: COLORS.glow.green }}
          >
            <span className="text-2xl">⭐</span>
            <span className="text-xl font-bold" style={{ color: COLORS.primary }}>{totalXP} XP</span>
          </div>
        </motion.div>
        
        {/* Adventure Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {ADVENTURES.map((adventure, i) => (
            <motion.div
              key={adventure.id}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => adventure.unlocked && setCurrentGame(adventure.id)}
              className={`relative p-6 rounded-2xl cursor-pointer transition-all ${
                adventure.unlocked ? 'hover:scale-[1.02]' : 'opacity-50 cursor-not-allowed'
              }`}
              style={{
                background: `linear-gradient(135deg, ${COLORS.card}, ${COLORS.cardHover})`,
                border: `2px solid ${adventure.unlocked ? adventure.color : COLORS.border}`,
                boxShadow: adventure.unlocked ? adventure.glow : 'none',
              }}
              whileHover={adventure.unlocked ? { y: -5 } : {}}
              whileTap={adventure.unlocked ? { scale: 0.98 } : {}}
            >
              {/* Lock overlay */}
              {!adventure.unlocked && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50">
                  <span className="text-4xl">🔒</span>
                </div>
              )}
              
              {/* Icon */}
              <div className="text-4xl mb-4">{adventure.icon}</div>
              
              {/* Title */}
              <h3 className="text-xl font-bold mb-1" style={{ color: adventure.color }}>
                {adventure.title}
              </h3>
              <p className="text-sm mb-2" style={{ color: COLORS.textMuted }}>{adventure.subtitle}</p>
              
              {/* Description */}
              <p className="text-sm mb-4" style={{ color: COLORS.text }}>{adventure.description}</p>
              
              {/* Difficulty */}
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <span key={j} style={{ color: j < adventure.difficulty ? adventure.color : COLORS.border }}>★</span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{adventure.npcEmoji}</span>
                  <span className="text-xs" style={{ color: COLORS.textMuted }}>{adventure.npc}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        
        {/* Footer */}
        <motion.div
          className="text-center mt-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <p className="text-sm" style={{ color: COLORS.textMuted }}>
            🎓 Learn binary, logic gates, chip design, and neural networks through play!
          </p>
          <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
            "Incredible Machine meets Minecraft meets AI Education"
          </p>
        </motion.div>
      </div>
    </div>
  )
}
