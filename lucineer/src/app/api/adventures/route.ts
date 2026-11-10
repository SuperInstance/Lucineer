import { NextRequest, NextResponse } from 'next/server'

// Adventure data
const ADVENTURES = [
  {
    adventure_id: 'octet_switcher',
    title: '🎛️ The Octet Switcher',
    category: 'BINARY',
    difficulty: 1,
    description: 'Learn how computers count using binary! 8 switches = 256 possibilities',
    objectives: [
      { id: 'reach_42', description: 'Find the Answer to Everything (42)', target_value: 42, reward_xp: 50 },
      { id: 'reach_128', description: 'Reach half of maximum (128)', target_value: 128, reward_xp: 30 },
      { id: 'reach_255', description: 'Reach maximum value (255)', target_value: 255, reward_xp: 50 },
      { id: 'discover_50', description: 'Discover 50 different numbers', target_value: 50, reward_xp: 75 },
      { id: 'discover_100', description: 'Discover 100 different numbers', target_value: 100, reward_xp: 100 },
      { id: 'discover_all', description: 'Master: Discover all 256 numbers!', target_value: 256, reward_xp: 500 },
    ],
    npc_guide: {
      name: 'Bitzy the Binary Bot',
      dialogue_style: 'silly_educational',
      personality: 'Enthusiastic, makes math fun with jokes and puns'
    },
    fun_facts: [
      "8 bits = 1 byte = 256 possible values!",
      "Your computer talks in binary all day!",
      "IP addresses are 4 octets like this!",
      "RGB colors use 3 octets (0-255 each)!",
      "ASCII characters fit in one octet!",
    ],
    special_numbers: {
      '0': { emoji: '😴', message: "Zzz... Nothing's on! Flip some switches!" },
      '1': { emoji: '🐣', message: "A baby number! So tiny and cute!" },
      '8': { emoji: '🐙', message: "OCTOPUS! 8 arms, 8 bits!" },
      '42': { emoji: '🌌', message: 'THE ANSWER TO EVERYTHING!' },
      '64': { emoji: '🕹️', message: 'NINTENDO 64 MEMORIES!' },
      '100': { emoji: '💯', message: 'ONE HUNDRED PERCENT!' },
      '127': { emoji: '🌐', message: 'MAX SIGNED BYTE!' },
      '128': { emoji: '💾', message: 'HALF WAY THERE! 128!' },
      '255': { emoji: '🔥', message: 'MAXIMUM POWER!' },
    },
    in_game_integration: {
      block_type: 'lucineer:octet_switcher_block',
      redstone_output: true,
      comparator_mode: true
    }
  },
  {
    adventure_id: 'logic_gate_builder',
    title: '⚡ Logic Gate Workshop',
    category: 'LOGIC_GATES',
    difficulty: 2,
    description: 'Build logic gates from transistors! AND, OR, NOT, XOR, and more!',
    objectives: [
      { id: 'build_and', description: 'Build an AND gate from transistors', target_value: 1, reward_xp: 60 },
      { id: 'build_or', description: 'Build an OR gate from transistors', target_value: 1, reward_xp: 60 },
      { id: 'build_not', description: 'Build a NOT gate (inverter)', target_value: 1, reward_xp: 40 },
      { id: 'build_xor', description: 'Build an XOR gate', target_value: 1, reward_xp: 100 },
      { id: 'build_nand', description: 'Build a NAND gate (universal gate!)', target_value: 1, reward_xp: 80 },
    ],
    npc_guide: {
      name: 'Gatekeeper Gary',
      dialogue_style: 'punny_technical',
      personality: 'Makes logic puns, gets excited about efficiency'
    },
    fun_facts: [
      "NAND gates are universal - you can build ANY circuit from just NANDs!",
      "Your CPU has BILLIONS of transistors!",
      "XOR is like a light switch - if both are on, it's off!",
      "The first transistor was invented in 1947!",
    ],
    in_game_integration: {
      block_type: 'lucineer:logic_workbench',
      redstone_output: true
    }
  },
  {
    adventure_id: 'chip_designer',
    title: '🔬 Chip Designer Lab',
    category: 'CHIP_DESIGN',
    difficulty: 4,
    description: 'Design your own silicon chips! Layout transistors and create working circuits!',
    objectives: [
      { id: 'design_inverter', description: 'Design a basic CMOS inverter', target_value: 1, reward_xp: 100 },
      { id: 'design_nand', description: 'Design a 2-input NAND gate', target_value: 1, reward_xp: 150 },
      { id: 'design_latch', description: 'Design a SR latch (memory bit!)', target_value: 1, reward_xp: 200 },
      { id: 'design_alu_bit', description: 'Design a 1-bit ALU slice', target_value: 1, reward_xp: 300 },
    ],
    npc_guide: {
      name: 'Silicon Sam',
      dialogue_style: 'technical_excited',
      personality: 'Former Intel engineer, loves optimization and clean layouts'
    },
    fun_facts: [
      "Modern chips have 10+ layers of metal wiring!",
      "A single CPU has over 10 billion transistors!",
      "Chip features are measured in nanometers!",
      "The first microprocessor had only 2,300 transistors!",
    ],
    in_game_integration: {
      block_type: 'lucineer:chip_design_station',
      special_dimension: 'lucineer:silicon_foundry'
    }
  },
  {
    adventure_id: 'binary_adder',
    title: '🧮 Binary Calculator',
    category: 'ALGORITHMS',
    difficulty: 3,
    description: 'Build a binary calculator! Add, subtract, and understand how computers do math!',
    objectives: [
      { id: 'half_adder', description: 'Build a half adder (adds 2 bits)', target_value: 1, reward_xp: 75 },
      { id: 'full_adder', description: 'Build a full adder (includes carry!)', target_value: 1, reward_xp: 100 },
      { id: 'ripple_adder', description: 'Build a 4-bit ripple carry adder', target_value: 1, reward_xp: 200 },
      { id: 'subtract', description: 'Implement subtraction using two\'s complement', target_value: 1, reward_xp: 150 },
    ],
    npc_guide: {
      name: 'Calc Cathy',
      dialogue_style: 'patient_educational',
      personality: 'Math teacher who loves showing how numbers work'
    },
    fun_facts: [
      "Computers add using XOR and AND gates!",
      "Two's complement is why -1 in 8-bit is 11111111!",
      "Ripple carry is slow but simple - better adders use lookahead!",
      "Your CPU can do BILLIONS of additions per second!",
    ],
    in_game_integration: {
      block_type: 'lucineer:adder_workbench',
      redstone_output: true,
      auto_test: true
    }
  },
  {
    adventure_id: 'neural_network',
    title: '🧠 Neural Network Explorer',
    category: 'ALGORITHMS',
    difficulty: 4,
    description: 'Build and train neural networks! See how AI learns from data!',
    objectives: [
      { id: 'single_neuron', description: 'Build a single artificial neuron', target_value: 1, reward_xp: 100 },
      { id: 'perceptron', description: 'Create a perceptron that learns AND', target_value: 1, reward_xp: 150 },
      { id: 'xor_network', description: 'Build a network that can learn XOR', target_value: 1, reward_xp: 250 },
      { id: 'deep_network', description: 'Build a 3-layer network', target_value: 1, reward_xp: 300 },
    ],
    npc_guide: {
      name: 'Neuro Nina',
      dialogue_style: 'scientific_wonder',
      personality: 'AI researcher who sees the magic in math'
    },
    fun_facts: [
      "Neural networks are inspired by real brains!",
      "Deep learning just means many layers!",
      "A single neuron does: output = activation(weights × inputs + bias)",
      "Backpropagation is how networks learn from mistakes!",
    ],
    in_game_integration: {
      block_type: 'lucineer:neural_workbench',
      special_dimension: 'lucineer:neural_synapse'
    }
  }
]

// NPC Dialogues
const NPC_DIALOGUES: Record<string, Record<string, string[]>> = {
  'Bitzy': {
    greeting: [
      "Hey there, bit-wrangler! Ready to flip some switches? 🎛️",
      "Welcome to the Octet Dimension! Where 0 and 1 are your best friends!",
      "*beep boop* I mean... hello! Let's count in binary!",
      "01001000 01101001! That's 'Hi' in binary! Let's play!",
    ],
    encouragement: [
      "You're doing BIT-fully well! Get it? BIT-fully? 😄",
      "Keep flipping! Every switch is a step toward mastery!",
      "Ooh, that's a good number! But can you find the special ones?",
      "Binary wizards aren't born, they're MADE... one flip at a time!",
    ],
    hints: [
      "Psst... the leftmost switch is worth 128! That's the big one!",
      "Each switch doubles in value: 1, 2, 4, 8, 16, 32, 64, 128!",
      "Want 42? That's 32 + 8 + 2! Can you figure out which switches?",
      "The sum of all switches ON gives you your number!",
    ],
    jokes: [
      "Why do programmers prefer dark mode? Because light attracts bugs! 🐛",
      "There are 10 types of people: those who understand binary, and those who don't!",
      "What's a computer's favorite beat? The algo-rhythm! 🎵",
    ],
    milestone: [
      "🎉 MILESTONE REACHED! You've discovered {count} numbers!",
      "⭐ Amazing! You're {percent}% of the way to octet mastery!",
      "🏆 Achievement unlocked! The Binary Explorer badge!",
    ],
  },
  'Gary': {
    greeting: [
      "Gatekeeper Gary here! And I'm GATE-fully excited to teach you!",
      "Welcome to the Logic Gate Workshop! AND you're going to love it!",
      "Ready to build some gates? I promise it won't be OR-nery!",
    ],
    encouragement: [
      "You're AND-credible at this! Get it? AND? ...I'll stop now.",
      "That's a NAND-erful design! Keep it up!",
      "Your logic is sound! Like a well-tuned circuit!",
    ],
    hints: [
      "Remember: AND needs ALL inputs high! It's picky like that.",
      "OR is the friendly one - any input high makes it happy!",
      "NAND is universal! You can make ANY gate from NANDs alone!",
    ],
    jokes: [
      "I told my friend a logic gate joke... he didn't get it. Must have been a NOT gate!",
      "Why did the AND gate go to therapy? It had commitment issues!",
    ],
  },
  'Nina': {
    greeting: [
      "Welcome to the Neural Nexus! Where brains meet bytes!",
      "I'm Nina, and I think neural networks are just... *chef's kiss*",
      "Ready to see how machines learn? It's actually kind of magical!",
    ],
    encouragement: [
      "Your network is learning! It's like watching a baby take its first steps!",
      "Each training step brings it closer to understanding!",
      "You're literally building intelligence! How cool is that?!",
    ],
    hints: [
      "Each neuron takes inputs, weights them, and decides if it should fire!",
      "Backpropagation is just the network learning from its mistakes!",
      "More layers = more complexity, but also more learning power!",
    ],
    jokes: [
      "Why did the neural network go to therapy? It had too many hidden layers!",
      "Deep learning is just regular learning... but deeper! 🧠",
    ],
  },
  'Cathy': {
    greeting: [
      "Welcome to the Calculator Corner! Let's do some MATH!",
      "I'm Cathy, and numbers are my passion. Binary numbers, specifically!",
      "Ready to see how computers add? It's simpler than you think!",
    ],
    encouragement: [
      "That's the way! Carry that bit with pride!",
      "Your adder is sum-thing special! Get it? Sum?",
      "You're really adding up the skills now!",
    ],
    hints: [
      "Half adder: XOR for sum, AND for carry. That's it!",
      "Full adder needs to handle the carry IN too!",
      "Ripple carry: each bit's carry feeds the next. Simple but slow!",
    ],
    jokes: [
      "Why was the math book sad? It had too many problems!",
      "Why do programmers get Halloween and Christmas confused? OCT 31 = DEC 25!",
    ],
  },
}

// In-memory progress storage (would be database in production)
const playerProgress: Map<string, {
  discovered_values: number[]
  completed_objectives: string[]
  total_xp: number
  switch_flips: number
}> = new Map()

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const adventureId = searchParams.get('adventure_id')
  const playerId = searchParams.get('player_id') || 'default'
  
  if (adventureId) {
    const adventure = ADVENTURES.find(a => a.adventure_id === adventureId)
    if (!adventure) {
      return NextResponse.json({ error: 'Adventure not found' }, { status: 404 })
    }
    
    const progress = playerProgress.get(`${playerId}:${adventureId}`) || {
      discovered_values: [],
      completed_objectives: [],
      total_xp: 0,
      switch_flips: 0
    }
    
    return NextResponse.json({
      adventure,
      progress
    })
  }
  
  return NextResponse.json({ adventures: ADVENTURES })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { action, player_id = 'default', adventure_id, value } = body
  
  if (action === 'update_value') {
    const adventure = ADVENTURES.find(a => a.adventure_id === adventure_id)
    if (!adventure) {
      return NextResponse.json({ error: 'Adventure not found' }, { status: 404 })
    }
    
    const key = `${player_id}:${adventure_id}`
    const progress = playerProgress.get(key) || {
      discovered_values: [],
      completed_objectives: [],
      total_xp: 0,
      switch_flips: 0
    }
    
    // Track discovery
    const isNewDiscovery = !progress.discovered_values.includes(value)
    if (isNewDiscovery) {
      progress.discovered_values.push(value)
    }
    
    progress.switch_flips++
    
    // Check for special number dialogue
    let dialogue: { emoji: string; message: string } | null = null
    if (adventure.special_numbers?.[String(value)]) {
      dialogue = adventure.special_numbers[String(value)]
    }
    
    // Check objectives
    const completedObjectives: string[] = []
    let xpGained = 0
    
    for (const objective of adventure.objectives) {
      if (progress.completed_objectives.includes(objective.id)) continue
      
      let completed = false
      
      if (objective.id.startsWith('reach_')) {
        completed = value === objective.target_value
      } else if (objective.id.startsWith('discover_')) {
        completed = progress.discovered_values.length >= objective.target_value
      }
      
      if (completed) {
        progress.completed_objectives.push(objective.id)
        completedObjectives.push(objective.id)
        progress.total_xp += objective.reward_xp
        xpGained += objective.reward_xp
      }
    }
    
    playerProgress.set(key, progress)
    
    return NextResponse.json({
      success: true,
      new_discovery: isNewDiscovery,
      dialogue,
      completed_objectives: completedObjectives,
      xp_gained: xpGained,
      total_xp: progress.total_xp,
      discovered_count: progress.discovered_values.length,
      discovery_percent: (progress.discovered_values.length / 256 * 100).toFixed(1)
    })
  }
  
  if (action === 'get_dialogue') {
    const { npc_name, context, variables } = body
    const dialogues = NPC_DIALOGUES[npc_name] || NPC_DIALOGUES['Bitzy']
    const pool = dialogues[context] || dialogues['greeting']
    let dialogue = pool[Math.floor(Math.random() * pool.length)]
    
    // Replace variables
    if (variables) {
      for (const [key, val] of Object.entries(variables)) {
        dialogue = dialogue.replace(`{${key}}`, String(val))
      }
    }
    
    return NextResponse.json({ dialogue })
  }
  
  if (action === 'get_progress') {
    const progress = playerProgress.get(`${player_id}:${adventure_id}`) || {
      discovered_values: [],
      completed_objectives: [],
      total_xp: 0,
      switch_flips: 0
    }
    
    return NextResponse.json({ progress })
  }
  
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
