"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import {
  Atom,
  Brain,
  Building2,
  Car,
  Cpu,
  Database,
  Earth,
  Eye,
  Factory,
  Flame,
  Heart,
  Home,
  Leaf,
  Microscope,
  Plane,
  Rocket,
  Server,
  Ship,
  Smartphone,
  Subscript,
  TowerControl,
  Train,
  Wrench,
  Zap,
  Bot,
  Layers,
  Grid3X3,
  Box,
  Search,
  Filter,
  ChevronRight,
  ChevronDown,
  BookOpen,
  GraduationCap,
  Sparkles,
  Target,
  Lightbulb,
  Workflow,
  Split,
  Merge,
  Eye as EyeIcon,
  ArrowRight,
  Play,
  Info,
  Star,
  Lock,
  Unlock,
  Trophy,
  Medal,
  Crown,
  Gem,
  Award,
  Flag,
  Compass,
  Map,
  MapPin,
  Globe,
  Globe2,
  Hexagon,
  Circle,
  Square,
  Triangle,
  Diamond,
  Octagon,
  Pentagon,
} from "lucide-react";

// ============================================================================
// VOXEL EXPLORER - STEPHEN BIESTY / DAVID MACAULAY INSPIRED LEARNING UNIVERSE
// ============================================================================

// Types
type DifficultyLevel = "beginner" | "intermediate" | "advanced" | "expert" | "master";
type WorldCategory = 
  | "human-body" 
  | "technology" 
  | "nature" 
  | "machines" 
  | "buildings" 
  | "transport" 
  | "science" 
  | "history"
  | "digital"
  | "cosmos";
type ViewType = "cross-section" | "exploded" | "cutaway" | "xray" | "annotated" | "animated";

interface TinyCharacter {
  name: string;
  role: string;
  description: string;
  location: string;
}

interface VoxelLevel {
  id: string;
  name: string;
  category: WorldCategory;
  difficulty: DifficultyLevel;
  description: string;
  tinyCharacters: TinyCharacter[];
  concepts: string[];
  funFacts: string[];
  viewTypes: ViewType[];
  ageRange: string;
  estimatedTime: string;
  unlockRequirement?: string;
  image?: string;
}

// ============================================================================
// HUNDREDS OF LEVEL CONCEPTS
// ============================================================================

const LEVEL_CONCEPTS: VoxelLevel[] = [
  // ==================== HUMAN BODY WORLD ====================
  {
    id: "body-heart",
    name: "The Pumping Station",
    category: "human-body",
    difficulty: "beginner",
    description: "Explore the heart's four chambers with tiny workers managing blood flow valves",
    tinyCharacters: [
      { name: "Valve Vera", role: "Gatekeeper", description: "Opens and closes heart valves", location: "Between chambers" },
      { name: "Pulse Pete", role: "Rhythm Keeper", description: "Maintains the heartbeat timing", location: "SA Node control room" },
      { name: "O2 Oliver", role: "Oxygen Loader", description: "Loads oxygen onto red blood cells", location: "Pulmonary veins" },
      { name: "CO2 Carla", role: "Waste Collector", description: "Removes carbon dioxide", location: "Right atrium" },
    ],
    concepts: ["circulation", "oxygen transport", "heart valves", "cardiac cycle"],
    funFacts: ["Your heart beats 100,000 times per day", "Blood travels 12,000 miles daily in your body"],
    viewTypes: ["cross-section", "animated", "annotated"],
    ageRange: "8-12",
    estimatedTime: "20 min",
  },
  {
    id: "body-brain",
    name: "The Command Center",
    category: "human-body",
    difficulty: "intermediate",
    description: "Navigate the brain's neural networks with message runners and memory librarians",
    tinyCharacters: [
      { name: "Neuron Ned", role: "Signal Runner", description: "Carries electrical messages between regions", location: "Neural pathways" },
      { name: "Memory Mae", role: "Archivist", description: "Stores and retrieves memories", location: "Hippocampus library" },
      { name: "Logic Lou", role: "Processor", description: "Handles reasoning and decisions", location: "Frontal cortex" },
      { name: "Emotion Em", role: "Feeling Manager", description: "Processes emotions and reactions", location: "Amygdala station" },
    ],
    concepts: ["neural networks", "memory formation", "brain regions", "synaptic transmission"],
    funFacts: ["Your brain has 86 billion neurons", "Information travels at 268 mph in your brain"],
    viewTypes: ["cross-section", "xray", "animated"],
    ageRange: "10-14",
    estimatedTime: "35 min",
  },
  {
    id: "body-eye",
    name: "The Camera Obscura",
    category: "human-body",
    difficulty: "beginner",
    description: "Watch how light becomes vision with tiny projectionists and pixel processors",
    tinyCharacters: [
      { name: "Iris Irene", role: "Light Controller", description: "Adjusts pupil size", location: "Iris muscles" },
      { name: "Focus Fred", role: "Lens Adjuster", description: "Changes lens shape for clarity", location: "Ciliary body" },
      { name: "Rod Ralph", role: "Night Vision", description: "Detects low light", location: "Retina periphery" },
      { name: "Cone Connie", role: "Color Sensor", description: "Detects colors and detail", location: "Fovea centralis" },
    ],
    concepts: ["vision", "light refraction", "retina", "color perception"],
    funFacts: ["Your eyes can distinguish 10 million colors", "You blink 15-20 times per minute"],
    viewTypes: ["cross-section", "annotated", "xray"],
    ageRange: "8-12",
    estimatedTime: "25 min",
  },
  {
    id: "body-digestive",
    name: "The Food Factory",
    category: "human-body",
    difficulty: "beginner",
    description: "Follow food through the digestive assembly line with enzyme workers",
    tinyCharacters: [
      { name: "Enzyme Eddie", role: "Breakdown Specialist", description: "Breaks down food molecules", location: "Stomach and intestines" },
      { name: "Acid Anna", role: "Stomach Guardian", description: "Maintains stomach acid levels", location: "Stomach lining" },
      { name: "Villi Victor", role: "Nutrient Collector", description: "Absorbs nutrients into blood", location: "Small intestine walls" },
      { name: "Bacteria Bob", role: "Gut Helper", description: "Aids digestion and immunity", location: "Large intestine" },
    ],
    concepts: ["digestion", "enzymes", "nutrient absorption", "gut microbiome"],
    funFacts: ["Your digestive tract is 30 feet long", "Food takes 24-72 hours to pass through"],
    viewTypes: ["cross-section", "animated", "exploded"],
    ageRange: "8-12",
    estimatedTime: "30 min",
  },
  {
    id: "body-immune",
    name: "The Defense Force",
    category: "human-body",
    difficulty: "intermediate",
    description: "Command the immune system's army of defenders against invaders",
    tinyCharacters: [
      { name: "Macrophage Max", role: "Frontline Defender", description: "Engulfs invaders whole", location: "Tissues everywhere" },
      { name: "T-Cell Tina", role: "Special Ops", description: "Identifies and destroys infected cells", location: "Blood and lymph" },
      { name: "B-Cell Bob", role: "Weapon Factory", description: "Produces antibody missiles", location: "Lymph nodes" },
      { name: "Memory Mel", role: "Intelligence Officer", description: "Remembers past invaders", location: "Bone marrow reserve" },
    ],
    concepts: ["immune response", "antibodies", "vaccination", "pathogens"],
    funFacts: ["You make 1 billion new immune cells daily", "Your immune system has memory of past infections"],
    viewTypes: ["cross-section", "animated", "annotated"],
    ageRange: "10-14",
    estimatedTime: "40 min",
  },
  {
    id: "body-bones",
    name: "The Framework Factory",
    category: "human-body",
    difficulty: "beginner",
    description: "Discover how bones grow, heal, and produce blood cells",
    tinyCharacters: [
      { name: "Osteo Oliver", role: "Bone Builder", description: "Deposits calcium for strength", location: "Bone surface" },
      { name: "Marrow Mary", role: "Blood Maker", description: "Produces red and white blood cells", location: "Bone marrow center" },
      { name: "Cartilage Carl", role: "Cushion Keeper", description: "Maintains joint padding", location: "Joint surfaces" },
      { name: "Growth Gus", role: "Length Engineer", description: "Extends bones during growth", location: "Growth plates" },
    ],
    concepts: ["skeletal system", "bone marrow", "joints", "calcium"],
    funFacts: ["Babies have 300 bones, adults have 206", "Your femur is stronger than concrete"],
    viewTypes: ["cross-section", "exploded", "annotated"],
    ageRange: "8-12",
    estimatedTime: "25 min",
  },
  {
    id: "body-lungs",
    name: "The Air Exchange",
    category: "human-body",
    difficulty: "beginner",
    description: "See how breath becomes oxygen with alveoli balloon operators",
    tinyCharacters: [
      { name: "Diaphragm Dave", role: "Bellows Operator", description: "Creates breathing pressure", location: "Below lungs" },
      { name: "Bronchi Brian", role: "Air Traffic Controller", description: "Routes air to lung sections", location: "Bronchial tubes" },
      { name: "Alveoli Amy", role: "Gas Exchanger", description: "Swaps CO2 for oxygen", location: "Alveoli sacs" },
      { name: "Cilia Cindy", role: "Cleaning Crew", description: "Sweeps out dust and germs", location: "Airway lining" },
    ],
    concepts: ["respiration", "gas exchange", "diaphragm", "alveoli"],
    funFacts: ["You breathe 20,000 times per day", "Lungs have 300 million alveoli"],
    viewTypes: ["cross-section", "animated", "exploded"],
    ageRange: "8-12",
    estimatedTime: "25 min",
  },
  {
    id: "body-kidney",
    name: "The Filtration Plant",
    category: "human-body",
    difficulty: "intermediate",
    description: "Watch blood get cleaned by an army of tiny filter technicians",
    tinyCharacters: [
      { name: "Nephron Ned", role: "Filter Unit Manager", description: "Processes blood filtrate", location: "Millions of nephrons" },
      { name: "Glomerulus Grace", role: "Primary Filter", description: "First stage blood filtering", location: "Nephron entrance" },
      { name: "Tubule Tim", role: "Reabsorption Engineer", description: "Recovers useful substances", location: "Tubule passages" },
      { name: "Concentrator Kate", role: "Water Manager", description: "Adjusts urine concentration", location: "Collecting duct" },
    ],
    concepts: ["filtration", "kidney function", "urine formation", "homeostasis"],
    funFacts: ["Kidneys filter 200 liters of blood daily", "Each kidney has 1 million nephrons"],
    viewTypes: ["cross-section", "annotated", "xray"],
    ageRange: "10-14",
    estimatedTime: "30 min",
  },
  
  // ==================== TECHNOLOGY WORLD ====================
  {
    id: "tech-smartphone",
    name: "The Pocket Computer",
    category: "technology",
    difficulty: "intermediate",
    description: "Explode a smartphone to see tiny workers running every component",
    tinyCharacters: [
      { name: "CPU Charlie", role: "Brain Coordinator", description: "Manages all calculations", location: "Main processor" },
      { name: "Memory Mary", role: "Storage Keeper", description: "Holds apps and data", location: "RAM and storage chips" },
      { name: "Battery Ben", role: "Power Manager", description: "Distributes electricity", location: "Lithium cells" },
      { name: "Antenna Amy", role: "Signal Handler", description: "Connects to networks", location: "Various antennas" },
    ],
    concepts: ["processors", "memory", "battery technology", "wireless communication"],
    funFacts: ["Your phone has more computing power than Apollo 11", "Modern phones have 10+ antennas"],
    viewTypes: ["exploded", "cross-section", "annotated"],
    ageRange: "10-16",
    estimatedTime: "35 min",
  },
  {
    id: "tech-cpu",
    name: "The Silicon City",
    category: "technology",
    difficulty: "advanced",
    description: "Enter a CPU where billions of transistor workers process data",
    tinyCharacters: [
      { name: "Transistor Terry", role: "Switch Operator", description: "Flips on/off billions of times", location: "Everywhere" },
      { name: "ALU Alice", role: "Math Specialist", description: "Performs calculations", location: "Arithmetic units" },
      { name: "Cache Carl", role: "Fast Memory Keeper", description: "Holds frequently used data", location: "L1/L2/L3 caches" },
      { name: "Clock Claude", role: "Metronome Master", description: "Sets the timing rhythm", location: "Clock distribution" },
    ],
    concepts: ["transistors", "logic gates", "pipelining", "cache hierarchy"],
    funFacts: ["Modern CPUs have 10+ billion transistors", "Signals travel at nearly light speed"],
    viewTypes: ["cross-section", "exploded", "annotated"],
    ageRange: "12-18",
    estimatedTime: "45 min",
  },
  {
    id: "tech-internet",
    name: "The Network Weavers",
    category: "technology",
    difficulty: "intermediate",
    description: "Follow data packets through the global internet with delivery crews",
    tinyCharacters: [
      { name: "Packet Pete", role: "Data Courier", description: "Carries information chunks", location: "Fiber optic cables" },
      { name: "Router Rosie", role: "Traffic Director", description: "Routes packets to destinations", location: "Network junctions" },
      { name: "DNS Diana", role: "Address Translator", description: "Converts names to numbers", location: "DNS servers" },
      { name: "Server Sam", role: "Content Host", description: "Stores websites and services", location: "Data centers" },
    ],
    concepts: ["packet switching", "routing", "DNS", "client-server model"],
    funFacts: ["Internet traffic grows 25% per year", "Data centers use 1% of global electricity"],
    viewTypes: ["annotated", "animated", "cross-section"],
    ageRange: "10-16",
    estimatedTime: "40 min",
  },
  {
    id: "tech-database",
    name: "The Grand Library",
    category: "technology",
    difficulty: "intermediate",
    description: "Mammoths organize data in tables while query detectives find information",
    tinyCharacters: [
      { name: "Index Igor", role: "Catalog Keeper", description: "Maintains lookup indexes", location: "Index structures" },
      { name: "Query Quinn", role: "Search Detective", description: "Finds requested data", location: "Query processor" },
      { name: "Transaction Tina", role: "Safety Officer", description: "Ensures data integrity", location: "Transaction log" },
      { name: "Cache Chris", role: "Fast Access Manager", description: "Keeps popular data ready", location: "Buffer pool" },
    ],
    concepts: ["indexing", "queries", "ACID transactions", "normalization"],
    funFacts: ["Largest databases hold exabytes of data", "SQL was invented in 1974"],
    viewTypes: ["cross-section", "annotated", "exploded"],
    ageRange: "12-18",
    estimatedTime: "40 min",
  },
  {
    id: "tech-nn-chip",
    name: "The Neural Accelerator",
    category: "technology",
    difficulty: "advanced",
    description: "See how AI chips run neural networks with matrix multiplication factories",
    tinyCharacters: [
      { name: "MAC Mae", role: "Multiply-Accumulate Worker", description: "Does weight × input math", location: "MAC arrays" },
      { name: "Weight Walter", role: "Parameter Keeper", description: "Stores learned weights", location: "On-chip memory" },
      { name: "Activation Ava", role: "Function Applier", description: "Applies ReLU, sigmoid, etc.", location: "Activation units" },
      { name: "Gradient Gary", role: "Training Manager", description: "Computes weight updates", location: "Backprop circuits" },
    ],
    concepts: ["neural networks", "MAC operations", "inference vs training", "quantization"],
    funFacts: ["Neural chips are 100x more efficient than GPUs for AI", "BitNet uses only 1.58 bits per weight"],
    viewTypes: ["cross-section", "exploded", "annotated"],
    ageRange: "14-18",
    estimatedTime: "50 min",
  },
  
  // ==================== NATURE WORLD ====================
  {
    id: "nature-tree",
    name: "The Solar Collector",
    category: "nature",
    difficulty: "beginner",
    description: "Watch trees collect sunlight with leaf workers and root gatherers",
    tinyCharacters: [
      { name: "Chlorophyll Charlie", role: "Sunlight Catcher", description: "Captures solar energy", location: "Leaf cells" },
      { name: "Xylem Xena", role: "Water Pipeline", description: "Moves water upward", location: "Tree trunk" },
      { name: "Phloem Phil", role: "Sugar Transporter", description: "Distributes food", location: "Inner bark" },
      { name: "Root Rita", role: "Mineral Miner", description: "Gathers nutrients from soil", location: "Underground" },
    ],
    concepts: ["photosynthesis", "transpiration", "nutrient transport", "growth rings"],
    funFacts: ["Trees can live thousands of years", "One tree produces 260 pounds of oxygen per year"],
    viewTypes: ["cross-section", "annotated", "exploded"],
    ageRange: "8-12",
    estimatedTime: "25 min",
  },
  {
    id: "nature-cell",
    name: "The Microscopic City",
    category: "nature",
    difficulty: "intermediate",
    description: "Explore a cell with organelle workers running life's factory",
    tinyCharacters: [
      { name: "Mitochondria Mike", role: "Power Plant Worker", description: "Produces ATP energy", location: "Powerhouses" },
      { name: "Ribosome Rita", role: "Protein Builder", description: "Assembles proteins", location: "Floating factories" },
      { name: "DNA Dan", role: "Blueprint Keeper", description: "Stores genetic instructions", location: "Nucleus library" },
      { name: "Membrane Mary", role: "Border Guard", description: "Controls what enters/exits", location: "Cell boundary" },
    ],
    concepts: ["cell biology", "organelles", "protein synthesis", "cell division"],
    funFacts: ["Your body has 37 trillion cells", "Each cell has 2 meters of DNA"],
    viewTypes: ["cross-section", "exploded", "animated"],
    ageRange: "10-14",
    estimatedTime: "35 min",
  },
  {
    id: "nature-volcano",
    name: "The Pressure Cooker",
    category: "nature",
    difficulty: "intermediate",
    description: "Descend into a volcano with magma movers and gas handlers",
    tinyCharacters: [
      { name: "Magma Max", role: "Rock Melter", description: "Manages molten rock", location: "Magma chamber" },
      { name: "Vent Vicky", role: "Pressure Release", description: "Monitors eruption potential", location: "Main conduit" },
      { name: "Crust Carl", role: "Lid Keeper", description: "Tracks crust thickness", location: "Surface layers" },
      { name: "Gas Gus", role: "Bubble Handler", description: "Manages volcanic gases", location: "Throughout" },
    ],
    concepts: ["plate tectonics", "magma formation", "eruption types", "volcanic hazards"],
    funFacts: ["There are 1,500 active volcanoes on Earth", "Volcanic lightning is real"],
    viewTypes: ["cross-section", "annotated", "animated"],
    ageRange: "10-16",
    estimatedTime: "35 min",
  },
  {
    id: "nature-ocean",
    name: "The Deep Blue Layer Cake",
    category: "nature",
    difficulty: "intermediate",
    description: "Dive through ocean zones with creatures adapted to each layer",
    tinyCharacters: [
      { name: "Sunlight Sam", role: "Surface Dweller", description: "Lives in the light zone", location: "0-200m" },
      { name: "Twilight Tina", role: "Dim Light Specialist", description: "Survives in partial darkness", location: "200-1000m" },
      { name: "Midnight Mike", role: "Dark Zone Hunter", description: "Never sees sunlight", location: "1000-4000m" },
      { name: "Abyss Abby", role: "Deep Sea Adapter", description: "Withstands extreme pressure", location: "4000m+" },
    ],
    concepts: ["ocean zones", "pressure adaptation", "marine ecosystems", "bioluminescence"],
    funFacts: ["95% of the ocean is unexplored", "The deep sea has 300 atmospheres of pressure"],
    viewTypes: ["cross-section", "annotated", "exploded"],
    ageRange: "10-16",
    estimatedTime: "40 min",
  },
  
  // ==================== MACHINES WORLD ====================
  {
    id: "machine-car-engine",
    name: "The Combustion Dance",
    category: "machines",
    difficulty: "intermediate",
    description: "Watch pistons punch and valves waltz in perfect timing",
    tinyCharacters: [
      { name: "Piston Pete", role: "Power Puncher", description: "Converts explosion to motion", location: "Cylinders" },
      { name: "Valve Vera", role: "Air Traffic Control", description: "Times air/fuel intake and exhaust", location: "Cylinder heads" },
      { name: "Spark Sparky", role: "Fire Starter", description: "Ignites the fuel mixture", location: "Spark plugs" },
      { name: "Crankshaft Carl", role: "Motion Converter", description: "Turns up-down into round-round", location: "Engine bottom" },
    ],
    concepts: ["four-stroke cycle", "combustion", "torque", "efficiency"],
    funFacts: ["Engines run at 2,000-6,000 RPM", "Formula 1 engines rev to 15,000 RPM"],
    viewTypes: ["cross-section", "animated", "exploded"],
    ageRange: "10-16",
    estimatedTime: "35 min",
  },
  {
    id: "machine-jet-engine",
    name: "The Suck-Squeeze-Bang-Blow",
    category: "machines",
    difficulty: "advanced",
    description: "Follow air through the jet engine assembly line to thrust",
    tinyCharacters: [
      { name: "Fan Frank", role: "Air Puller", description: "Gathers incoming air", location: "Front intake" },
      { name: "Compressor Connie", role: "Air Squeezer", description: "Compresses air 40x", location: "Compressor stages" },
      { name: "Combustion Carl", role: "Fire Manager", description: "Burns fuel continuously", location: "Combustion chamber" },
      { name: "Turbine Tom", role: "Energy Extractor", description: "Powers the compressor", location: "Turbine section" },
    ],
    concepts: ["gas turbine cycle", "compression ratio", "thrust", "bypass ratio"],
    funFacts: ["Jet engines reach 3,000°F inside", "A 777 engine is as wide as a 737 fuselage"],
    viewTypes: ["cross-section", "exploded", "animated"],
    ageRange: "12-18",
    estimatedTime: "45 min",
  },
  {
    id: "machine-electric-motor",
    name: "The Magnetic Spinner",
    category: "machines",
    difficulty: "intermediate",
    description: "See invisible magnetic fields push the rotor around",
    tinyCharacters: [
      { name: "Stator Stan", role: "Field Creator", description: "Generates magnetic field", location: "Outer housing" },
      { name: "Rotor Rosie", role: "Spinner", description: "Rotates from magnetic push", location: "Center shaft" },
      { name: "Commutator Carl", role: "Current Switcher", description: "Reverses current direction", location: "Shaft contact" },
      { name: "Brush Betty", role: "Electrical Contact", description: "Transfers current to rotor", location: "Contact points" },
    ],
    concepts: ["electromagnetism", "Lorentz force", "AC vs DC motors", "efficiency"],
    funFacts: ["Electric motors are 90%+ efficient", "They were invented in 1834"],
    viewTypes: ["cross-section", "annotated", "animated"],
    ageRange: "10-16",
    estimatedTime: "30 min",
  },
  
  // ==================== BUILDINGS WORLD ====================
  {
    id: "building-skyscraper",
    name: "The Vertical City",
    category: "buildings",
    difficulty: "intermediate",
    description: "Climb through floors with elevator operators and HVAC handlers",
    tinyCharacters: [
      { name: "Foundation Fred", role: "Weight Bearer", description: "Distributes building load", location: "Underground" },
      { name: "Elevator Ellie", role: "Vertical Transport", description: "Moves people between floors", location: "Shafts" },
      { name: "HVAC Hank", role: "Climate Controller", description: "Manages heating and cooling", location: "Mechanical floors" },
      { name: "Window Wanda", role: "Light Manager", description: "Controls natural light and heat", location: "Curtain wall" },
    ],
    concepts: ["structural engineering", "load distribution", "elevator systems", "sustainability"],
    funFacts: ["Burj Khalifa has 163 floors", "Skyscrapers sway several feet in wind"],
    viewTypes: ["cross-section", "exploded", "annotated"],
    ageRange: "10-16",
    estimatedTime: "40 min",
  },
  {
    id: "building-dam",
    name: "The Water Stopper",
    category: "buildings",
    difficulty: "intermediate",
    description: "See how dams hold back lakes and generate power",
    tinyCharacters: [
      { name: "Gravity Gus", role: "Weight Holder", description: "Uses mass to resist water", location: "Dam body" },
      { name: "Turbine Tina", role: "Spin Starter", description: "Converts water flow to rotation", location: "Powerhouse" },
      { name: "Generator Gina", role: "Power Maker", description: "Turns rotation to electricity", location: "Powerhouse" },
      { name: "Spillway Sam", role: "Overflow Handler", description: "Releases excess water safely", location: "Dam top" },
    ],
    concepts: ["hydroelectric power", "arch gravity design", "water pressure", "renewable energy"],
    funFacts: ["Hoover Dam generates 4 billion kWh per year", "It contains enough concrete for a highway across the US"],
    viewTypes: ["cross-section", "annotated", "exploded"],
    ageRange: "10-16",
    estimatedTime: "35 min",
  },
  
  // ==================== TRANSPORT WORLD ====================
  {
    id: "transport-submarine",
    name: "The Underwater Explorer",
    category: "transport",
    difficulty: "advanced",
    description: "Navigate the depths with ballast tank managers and sonar operators",
    tinyCharacters: [
      { name: "Ballast Betty", role: "Buoyancy Controller", description: "Fills/empties tanks to dive/surface", location: "Ballast tanks" },
      { name: "Sonar Sam", role: "Sound Navigator", description: "Listens for objects", location: "Bow array" },
      { name: "Reactor Rick", role: "Power Source (nuclear)", description: "Generates electricity", location: "Reactor compartment" },
      { name: "Pressure Pete", role: "Hull Monitor", description: "Tracks stress on hull", location: "Throughout hull" },
    ],
    concepts: ["buoyancy", "nuclear propulsion", "pressure hull", "stealth"],
    funFacts: ["Nuclear subs can stay underwater 25 years", "They can dive to 800+ meters"],
    viewTypes: ["cross-section", "exploded", "annotated"],
    ageRange: "12-18",
    estimatedTime: "45 min",
  },
  {
    id: "transport-train",
    name: "The Steel Serpent",
    category: "transport",
    difficulty: "intermediate",
    description: "See how locomotives pull miles of cargo with wheel grippers",
    tinyCharacters: [
      { name: "Diesel Dan", role: "Power Generator", description: "Runs the prime mover", location: "Engine compartment" },
      { name: "Traction Tina", role: "Wheel Gripper", description: "Maximizes wheel-to-rail friction", location: "Trucks/bogies" },
      { name: "Brake Ben", role: "Stop Engineer", description: "Applies pneumatic brakes", location: "Each car" },
      { name: "Coupler Carl", role: "Connection Manager", description: "Links cars together", location: "Car ends" },
    ],
    concepts: ["diesel-electric transmission", "adhesion", "pneumatic brakes", "signaling"],
    funFacts: ["Trains are 3-4x more efficient than trucks", "The longest train was 7.3 km"],
    viewTypes: ["cross-section", "exploded", "annotated"],
    ageRange: "10-16",
    estimatedTime: "35 min",
  },
  
  // ==================== SCIENCE WORLD ====================
  {
    id: "science-atom",
    name: "The Quantum Playground",
    category: "science",
    difficulty: "advanced",
    description: "Zoom into atoms where electron clouds buzz around nucleus cores",
    tinyCharacters: [
      { name: "Proton Pete", role: "Positive Force", description: "Defines the element", location: "Nucleus" },
      { name: "Neutron Nancy", role: "Stabilizer", description: "Keeps nucleus together", location: "Nucleus" },
      { name: "Electron Eddie", role: "Orbital Dancer", description: "Moves in probability clouds", location: "Shells" },
      { name: "Quark Quinn", role: "Building Block", description: "Makes up protons/neutrons", location: "Inside nucleons" },
    ],
    concepts: ["atomic structure", "electron shells", "quantum mechanics", "elements"],
    funFacts: ["Atoms are 99.9999999% empty space", "You have atoms from stars in your body"],
    viewTypes: ["cross-section", "animated", "annotated"],
    ageRange: "12-18",
    estimatedTime: "40 min",
  },
  {
    id: "science-black-hole",
    name: "The Cosmic Drain",
    category: "science",
    difficulty: "expert",
    description: "Approach the event horizon where space and time twist",
    tinyCharacters: [
      { name: "Singularity Sid", role: "Infinite Density", description: "Where physics breaks", location: "Center" },
      { name: "Event Eva", role: "Point of No Return", description: "Marks the boundary", location: "Event horizon" },
      { name: "Accretion Ace", role: "Matter Swirler", description: "Spins around before falling in", location: "Accretion disk" },
      { name: "Hawking Hal", role: "Radiation Emitter", description: "Slowly evaporates the black hole", location: "Just outside horizon" },
    ],
    concepts: ["gravity", "spacetime curvature", "event horizon", "Hawking radiation"],
    funFacts: ["Black holes can spin at 99% light speed", "A teaspoon of neutron star weighs 6 billion tons"],
    viewTypes: ["cross-section", "animated", "annotated"],
    ageRange: "14-18",
    estimatedTime: "50 min",
  },
  
  // ==================== HISTORY WORLD ====================
  {
    id: "history-pyramid",
    name: "The Pharaoh's Staircase",
    category: "history",
    difficulty: "intermediate",
    description: "See how ancient engineers stacked 2 million stone blocks",
    tinyCharacters: [
      { name: "Quarry Quinn", role: "Stone Extractor", description: "Cuts limestone from quarries", location: "Quarry sites" },
      { name: "Transport Tina", role: "Block Mover", description: "Hauls stones on sledges", location: "Transport routes" },
      { name: "Ramp Rick", role: "Height Builder", description: "Constructs access ramps", location: "Pyramid sides" },
      { name: "Chisel Charlie", role: "Precision Carver", description: "Shapes blocks to fit perfectly", location: "Construction site" },
    ],
    concepts: ["simple machines", "ramp theory", "workforce organization", "ancient engineering"],
    funFacts: ["Pyramids were built in 20 years", "Workers were paid in beer and bread"],
    viewTypes: ["cross-section", "annotated", "exploded"],
    ageRange: "10-16",
    estimatedTime: "40 min",
  },
  {
    id: "history-castle",
    name: "The Medieval Fortress",
    category: "history",
    difficulty: "intermediate",
    description: "Explore every defense from moat to murder holes",
    tinyCharacters: [
      { name: "Portcullis Pete", role: "Gate Guardian", description: "Operates the iron gate", location: "Main entrance" },
      { name: "Archers Andy", role: "Defense Force", description: "Shoots from arrow slits", location: "Walls and towers" },
      { name: "Murder Molly", role: "Ambush Planner", description: "Drops things through ceiling holes", location: "Gate passages" },
      { name: "Well Wendy", role: "Water Keeper", description: "Guards the water supply", location: "Inner courtyard" },
    ],
    concepts: ["medieval warfare", "defensive architecture", "siege tactics", "daily castle life"],
    funFacts: ["Castles had latrine chutes called 'garderobes'", "Moats could be 30 feet deep"],
    viewTypes: ["cross-section", "exploded", "annotated"],
    ageRange: "10-16",
    estimatedTime: "40 min",
  },
  
  // ==================== DIGITAL WORLD ====================
  {
    id: "digital-algorithm",
    name: "The Recipe Machine",
    category: "digital",
    difficulty: "beginner",
    description: "Watch algorithms as cooking recipes with decision points",
    tinyCharacters: [
      { name: "Input Ian", role: "Ingredient Gatherer", description: "Collects starting data", location: "Algorithm start" },
      { name: "Condition Connie", role: "Decision Maker", description: "Chooses paths based on tests", location: "Branch points" },
      { name: "Loop Leo", role: "Repeater", description: "Does things multiple times", location: "Loop structures" },
      { name: "Output Olivia", role: "Result Presenter", description: "Delivers the answer", location: "Algorithm end" },
    ],
    concepts: ["algorithms", "control flow", "loops", "conditionals"],
    funFacts: ["Algorithms are everywhere - even in recipes", "Google's algorithm considers 200+ factors"],
    viewTypes: ["annotated", "animated", "cross-section"],
    ageRange: "8-14",
    estimatedTime: "30 min",
  },
  {
    id: "digital-neural-network",
    name: "The Brain Simulator",
    category: "digital",
    difficulty: "advanced",
    description: "See artificial neurons learn patterns with weight adjusters",
    tinyCharacters: [
      { name: "Neuron Nora", role: "Signal Processor", description: "Combines inputs and fires", location: "Network layers" },
      { name: "Weight Will", role: "Connection Strength", description: "Adjusts during learning", location: "Between neurons" },
      { name: "Bias Beth", role: "Threshold Setter", description: "Shifts activation points", location: "Each neuron" },
      { name: "Backprop Barry", role: "Teacher", description: "Corrects errors backward", location: "Training phase" },
    ],
    concepts: ["deep learning", "backpropagation", "activation functions", "gradient descent"],
    funFacts: ["GPT-4 has ~1 trillion parameters", "Training large models costs millions in electricity"],
    viewTypes: ["cross-section", "animated", "annotated"],
    ageRange: "14-18",
    estimatedTime: "50 min",
  },
  
  // ==================== COSMOS WORLD ====================
  {
    id: "cosmos-sun",
    name: "The Nuclear Furnace",
    category: "cosmos",
    difficulty: "advanced",
    description: "Watch hydrogen fuse into helium in the solar core",
    tinyCharacters: [
      { name: "Core Cole", role: "Fusion Zone Manager", description: "Where hydrogen becomes helium", location: "Sun's center" },
      { name: "Photon Phil", role: "Light Traveler", description: "Bounces for 170,000 years to surface", location: "Radiative zone" },
      { name: "Convective Connie", role: "Heat Transporter", description: "Carries heat by flowing plasma", location: "Convective zone" },
      { name: "Solar Stella", role: "Surface Erupter", description: "Launches solar flares", location: "Photosphere" },
    ],
    concepts: ["nuclear fusion", "stellar structure", "solar wind", "sunspots"],
    funFacts: ["The Sun is 4.6 billion years old", "Light takes 8 minutes to reach Earth"],
    viewTypes: ["cross-section", "annotated", "animated"],
    ageRange: "12-18",
    estimatedTime: "45 min",
  },
  {
    id: "cosmos-galaxy",
    name: "The Star City",
    category: "cosmos",
    difficulty: "advanced",
    description: "Navigate the Milky Way's spiral arms with stellar neighborhoods",
    tinyCharacters: [
      { name: "Sagittarius Sam", role: "Center Keeper", description: "Guards the supermassive black hole", location: "Galactic center" },
      { name: "Spiral Sarah", role: "Arm Resident", description: "Lives in star-forming regions", location: "Spiral arms" },
      { name: "Halo Hal", role: "Outer Guardian", description: "Orbits in the dark matter halo", location: "Galactic outskirts" },
      { name: "Globular Gina", role: "Cluster Member", description: "Lives in ancient star clusters", location: "Surrounding halo" },
    ],
    concepts: ["galactic structure", "dark matter", "star populations", "cosmic scale"],
    funFacts: ["The Milky Way has 100-400 billion stars", "It would take 200 million years to cross at light speed"],
    viewTypes: ["cross-section", "annotated", "exploded"],
    ageRange: "14-18",
    estimatedTime: "50 min",
  },
];

// Category definitions
const WORLD_CATEGORIES: Record<WorldCategory, { name: string; icon: typeof Atom; color: string; description: string }> = {
  "human-body": { name: "Human Body", icon: Heart, color: "text-rose-400", description: "Explore the incredible machine that is YOU" },
  "technology": { name: "Technology", icon: Cpu, color: "text-cyan-400", description: "Discover how our digital world works" },
  "nature": { name: "Nature", icon: Leaf, color: "text-green-400", description: "Uncover nature's engineering marvels" },
  "machines": { name: "Machines", icon: Wrench, color: "text-amber-400", description: "See engines and motors in action" },
  "buildings": { name: "Buildings", icon: Building2, color: "text-slate-400", description: "Climb through architectural wonders" },
  "transport": { name: "Transport", icon: Car, color: "text-blue-400", description: "Journey through vehicles of all kinds" },
  "science": { name: "Science", icon: Atom, color: "text-purple-400", description: "Zoom into the fundamental universe" },
  "history": { name: "History", icon: Castle, color: "text-amber-600", description: "Explore how ancients built wonders" },
  "digital": { name: "Digital", icon: Database, color: "text-violet-400", description: "Understand software and algorithms" },
  "cosmos": { name: "Cosmos", icon: Globe, color: "text-indigo-400", description: "Voyage through the universe" },
};

// Difficulty colors
const DIFFICULTY_COLORS: Record<DifficultyLevel, string> = {
  beginner: "bg-green-500/10 text-green-400 border-green-500/30",
  intermediate: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  advanced: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  expert: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  master: "bg-rose-500/10 text-rose-400 border-rose-500/30",
};

// ============================================================================
// COMPONENTS
// ============================================================================

function LevelCard({ level, onClick }: { level: VoxelLevel; onClick: () => void }) {
  const category = WORLD_CATEGORIES[level.category];
  const CategoryIcon = category.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-card border border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/30 transition-colors"
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg bg-muted ${category.color}`}>
              <CategoryIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">{level.name}</h3>
              <p className="text-xs text-muted-foreground">{category.name}</p>
            </div>
          </div>
          <span className={`text-xs px-2 py-1 rounded border ${DIFFICULTY_COLORS[level.difficulty]}`}>
            {level.difficulty}
          </span>
        </div>

        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{level.description}</p>

        <div className="flex flex-wrap gap-1 mb-3">
          {level.tinyCharacters.slice(0, 3).map((char) => (
            <span key={char.name} className="text-xs px-2 py-0.5 bg-muted rounded-full">
              {char.name.split(" ")[0]}
            </span>
          ))}
          {level.tinyCharacters.length > 3 && (
            <span className="text-xs px-2 py-0.5 bg-muted/50 rounded-full">
              +{level.tinyCharacters.length - 3}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{level.ageRange}</span>
          <span>{level.estimatedTime}</span>
        </div>

        <div className="flex gap-1 mt-2">
          {level.viewTypes.map((type) => (
            <span key={type} className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">
              {type}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function LevelDetail({ level, onClose }: { level: VoxelLevel; onClose: () => void }) {
  const category = WORLD_CATEGORIES[level.category];
  const CategoryIcon = category.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-card rounded-2xl border border-border max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-border">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl bg-muted ${category.color}`}>
                <CategoryIcon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{level.name}</h2>
                <p className="text-muted-foreground">{category.name}</p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-lg border ${DIFFICULTY_COLORS[level.difficulty]}`}>
              {level.difficulty}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <p className="text-muted-foreground">{level.description}</p>
          </div>

          {/* Tiny Characters */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Bot className="w-4 h-4 text-cyan-400" />
              Tiny Characters (Functions as Characters)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {level.tinyCharacters.map((char) => (
                <div key={char.name} className="p-3 bg-muted/30 rounded-lg border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-sm">{char.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded">
                      {char.role}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{char.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">📍 {char.location}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Concepts */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              Concepts You'll Learn
            </h3>
            <div className="flex flex-wrap gap-2">
              {level.concepts.map((concept) => (
                <span key={concept} className="px-3 py-1 bg-muted rounded-full text-sm">
                  {concept}
                </span>
              ))}
            </div>
          </div>

          {/* Fun Facts */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Fun Facts
            </h3>
            <ul className="space-y-2">
              {level.funFacts.map((fact, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-purple-400">•</span>
                  {fact}
                </li>
              ))}
            </ul>
          </div>

          {/* View Types */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-400" />
              Ways to Explore
            </h3>
            <div className="flex flex-wrap gap-2">
              {level.viewTypes.map((type) => (
                <span key={type} className="px-3 py-2 bg-blue-500/10 text-blue-400 rounded-lg text-sm capitalize">
                  {type.replace("-", " ")}
                </span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              <Play className="w-4 h-4" />
              Enter Voxel World
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-muted hover:bg-muted/80 rounded-xl font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================
export default function VoxelExplorerPage() {
  const [selectedLevel, setSelectedLevel] = useState<VoxelLevel | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<WorldCategory | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLevels = useMemo(() => {
    return LEVEL_CONCEPTS.filter((level) => {
      if (selectedCategory && level.category !== selectedCategory) return false;
      if (selectedDifficulty && level.difficulty !== selectedDifficulty) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          level.name.toLowerCase().includes(query) ||
          level.description.toLowerCase().includes(query) ||
          level.concepts.some((c) => c.toLowerCase().includes(query)) ||
          level.tinyCharacters.some((c) => c.name.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [selectedCategory, selectedDifficulty, searchQuery]);

  const levelCounts = useMemo(() => {
    const counts: Record<WorldCategory, number> = {
      "human-body": 0,
      "technology": 0,
      "nature": 0,
      "machines": 0,
      "buildings": 0,
      "transport": 0,
      "science": 0,
      "history": 0,
      "digital": 0,
      "cosmos": 0,
    };
    LEVEL_CONCEPTS.forEach((level) => {
      counts[level.category]++;
    });
    return counts;
  }, []);

  return (
    <>
      <Head>
        <title>Voxel Explorer | Lucineer - Stephen Biesty Inspired Learning</title>
        <meta
          name="description"
          content="Explore the universe through Stephen Biesty cross-sections and David Macaulay illustrations. Tiny characters reveal how everything works."
        />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-background via-background to-cyan-500/5">
        {/* Hero Section */}
        <section className="py-12 px-4 sm:px-6 lg:px-8 border-b border-border">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-4 py-2 mb-6">
                <BookOpen className="w-4 h-4 text-amber-400" />
                <span className="text-amber-400 text-sm font-medium">
                  Inspired by Stephen Biesty & David Macaulay
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4">
                <span className="bg-gradient-to-r from-amber-400 via-rose-400 to-purple-400 bg-clip-text text-transparent">
                  Voxel Explorer
                </span>
              </h1>

              <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-6">
                Cross-sections, exploded views, and tiny characters reveal how everything works.
                From atoms to galaxies, from heartbeats to CPUs—explore it all in voxel reality.
              </p>

              <p className="text-lg text-muted-foreground/80 max-w-2xl mx-auto">
                <strong className="text-foreground">Naming is power:</strong> Every concept gets a name,
                even a nickname. That name becomes a tile in your thinking—a shortcut to understanding.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Filters */}
        <section className="py-6 px-4 sm:px-6 lg:px-8 bg-muted/20 border-b border-border">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              {/* Search */}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search levels, characters, concepts..."
                  className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Category Pills */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    !selectedCategory
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  All ({LEVEL_CONCEPTS.length})
                </button>
                {(Object.entries(WORLD_CATEGORIES) as [WorldCategory, typeof WORLD_CATEGORIES[WorldCategory]][]).map(([key, cat]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedCategory(selectedCategory === key ? null : key)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                      selectedCategory === key
                        ? `bg-current/20 ${cat.color}`
                        : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    <cat.icon className="w-3.5 h-3.5" />
                    {cat.name} ({levelCounts[key]})
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty Filter */}
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                onClick={() => setSelectedDifficulty(null)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  !selectedDifficulty ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                All Levels
              </button>
              {(["beginner", "intermediate", "advanced", "expert", "master"] as DifficultyLevel[]).map((diff) => (
                <button
                  key={diff}
                  onClick={() => setSelectedDifficulty(selectedDifficulty === diff ? null : diff)}
                  className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                    selectedDifficulty === diff
                      ? DIFFICULTY_COLORS[diff]
                      : "bg-muted border-transparent"
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Level Grid */}
        <section className="py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">
                {selectedCategory ? WORLD_CATEGORIES[selectedCategory].name : "All Levels"}
              </h2>
              <p className="text-muted-foreground">
                {filteredLevels.length} learning adventures available
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredLevels.map((level) => (
                <LevelCard key={level.id} level={level} onClick={() => setSelectedLevel(level)} />
              ))}
            </div>
          </div>
        </section>

        {/* Character Philosophy Section */}
        <section className="py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-amber-500/10 via-rose-500/5 to-purple-500/10 border-y border-border">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-bold mb-6 text-center">
                Characters as Functions
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto text-center mb-8">
                Inspired by Stephen Biesty's incredible cross-sections and David Macaulay's mammoth workers,
                every system has tiny characters performing specific functions. This makes complex systems
                memorable and namable—you remember "Valve Vera" and suddenly understand heart valves.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card rounded-xl border border-border p-6">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
                    <Bot className="w-6 h-6 text-amber-400" />
                  </div>
                  <h3 className="font-semibold mb-2">Name It to Claim It</h3>
                  <p className="text-sm text-muted-foreground">
                    Every function gets a character name. "Transistor Terry" is easier to remember than
                    "field-effect transistor switch." The name becomes a tile for rapid thinking.
                  </p>
                </div>

                <div className="bg-card rounded-xl border border-border p-6">
                  <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center mb-4">
                    <Target className="w-6 h-6 text-rose-400" />
                  </div>
                  <h3 className="font-semibold mb-2">Location Matters</h3>
                  <p className="text-sm text-muted-foreground">
                    Each character has a workplace. Knowing where "Magma Max" hangs out helps you
                    understand the magma chamber's location and purpose simultaneously.
                  </p>
                </div>

                <div className="bg-card rounded-xl border border-border p-6">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4">
                    <Workflow className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="font-semibold mb-2">Function Stories</h3>
                  <p className="text-sm text-muted-foreground">
                    Characters work together. Watch "Packet Pete" hand off to "Router Rosie" and
                    suddenly packet switching makes narrative sense, not just technical sense.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* View Types Explanation */}
        <section className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 text-center">Ways to Explore</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Split className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-semibold">Cross-Section</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Slice through the middle. See inside a heart, a CPU, a volcano. Everything revealed
                  in place, showing relationships between parts.
                </p>
              </div>

              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Box className="w-5 h-5 text-amber-400" />
                  <h3 className="font-semibold">Exploded View</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Pull components apart in 3D space. See how a smartphone, a laptop, or a jet engine
                  assembles and disassembles.
                </p>
              </div>

              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Eye className="w-5 h-5 text-purple-400" />
                  <h3 className="font-semibold">X-Ray Vision</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  See through layers. Toggle visibility to reveal hidden systems like bones under skin
                  or circuits under chips.
                </p>
              </div>

              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Play className="w-5 h-5 text-green-400" />
                  <h3 className="font-semibold">Animated</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Watch processes in motion. Blood flowing, pistons pumping, data traveling. See the
                  system in action.
                </p>
              </div>

              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Info className="w-5 h-5 text-blue-400" />
                  <h3 className="font-semibold">Annotated</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Labels and explanations everywhere. Click any part for deep dives. Every character
                  has a story to tell.
                </p>
              </div>

              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Layers className="w-5 h-5 text-rose-400" />
                  <h3 className="font-semibold">Layer Peeling</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Remove layers one by one. Go deeper into a building from roof to foundation, or
                  a cell from membrane to nucleus.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-card/50">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                The Universe is a Puzzle You Can Take Apart
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Every system—from a cell to a star—has workers inside making it run.
                Learn their names, see their jobs, understand how everything connects.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="/cell-builder"
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity"
                >
                  <Grid3X3 className="w-5 h-5" />
                  Cell-Based Builder
                </Link>
                <Link
                  href="/agent-cells"
                  className="flex items-center gap-2 px-6 py-3 bg-card border border-border rounded-xl font-medium hover:border-primary/50 transition-colors"
                >
                  <Layers className="w-5 h-5" />
                  Agent Hierarchy
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </div>

      {/* Level Detail Modal */}
      <AnimatePresence>
        {selectedLevel && (
          <LevelDetail level={selectedLevel} onClose={() => setSelectedLevel(null)} />
        )}
      </AnimatePresence>
    </>
  );
}
