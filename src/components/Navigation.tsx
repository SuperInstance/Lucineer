"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  Cpu,
  ChevronDown,
  Box,
  Gamepad2,
  Music,
  Brain,
  BookOpen,
  Factory,
  Hexagon,
  Layers,
  Network,
  Puzzle,
  Table,
  Atom,
  Code2,
  DollarSign,
  GraduationCap,
  Sparkles,
  Users,
  Settings,
  Zap,
  Droplets,
  Activity,
  Radio,
  Clock,
  Database,
  Package,
  Shield,
  TestTube2,
  Battery,
  Grid3X3,
  Waves,
  ShieldAlert,
  GitFork,
  Signal,
} from "lucide-react";

// ── Menu structure: 4 top-level groups + About ──────────────────
const menuGroups = [
  {
    label: "Explore",
    items: [
      {
        label: "Voxel Explorer",
        href: "/voxel-explorer",
        icon: Box,
        description: "Cross-sections of chips, CPUs & networks",
        featured: true,
      },
      { label: "MIST Game",        href: "/mist",          icon: Gamepad2,     description: "AI through play, ages 5-10" },
      { label: "Math Universe",    href: "/math-universe", icon: Hexagon,      description: "Visualise AI maths" },
      { label: "Manufacturing",    href: "/manufacturing", icon: Factory,      description: "Sand → silicon walkthrough" },
      { label: "Music Playground", href: "/music",         icon: Music,        description: "Generative MIDI AI" },
      { label: "Learning Hub",     href: "/learning",      icon: BookOpen,     description: "Self-paced tutorials" },
    ],
  },
  {
    label: "Build",
    items: [
      { label: "LLN Playground", href: "/lln-playground",    icon: Network,  description: "Agents learning through play", featured: true },
      { label: "Agent Cells",    href: "/agent-cells",       icon: Layers,   description: "Hierarchical AI architecture" },
      { label: "Cell Builder",   href: "/cell-builder",      icon: Table,    description: "Spreadsheet-style neural nets" },
      { label: "LLN Tiles",      href: "/lln-tiles",         icon: Puzzle,   description: "Visual agent builder" },
      { label: "CRDT Lab",       href: "/crdt-lab",          icon: Atom,     description: "Conflict-free data types" },
    ],
  },
  {
    label: "Design",
    items: [
      { label: "Chip Studio",      href: "/professional",     icon: Cpu,          description: "Mask-locked inference chips", featured: true },
      { label: "RTL Studio",       href: "/rtl-studio",       icon: Code2,        description: "RTL → GDSII flow" },
      { label: "Tile Intelligence",href: "/tile-intelligence", icon: Sparkles,    description: "Inspectable AI concepts" },
      { label: "Tabula Rosa",      href: "/tabula-rosa",      icon: Brain,        description: "Blank-slate model research" },
      { label: "Thermal & Power",  href: "/thermal-power",    icon: Zap,          description: "Heat maps, PDN, junction temp" },
      { label: "Process Tech",     href: "/process-tech",     icon: Atom,         description: "FinFET scaling, I-V curves, doping" },
      { label: "Memory Hierarchy", href: "/memory-hierarchy", icon: Database,     description: "SRAM, cache AMAT, roofline model" },
      { label: "Clock & Timing",   href: "/clock-power",      icon: Clock,        description: "CTS, slack waterfall, PLL, gating" },
      { label: "Packaging",        href: "/packaging",        icon: Package,      description: "Flip-chip, TSV, chiplet topology" },
      { label: "Verification",     href: "/verification",     icon: Shield,       description: "FSM coverage, formal, timing closure" },
      { label: "DFT",              href: "/dft",              icon: TestTube2,    description: "Scan chains, BIST, ATPG, yield model" },
      { label: "Power Intent",     href: "/power-intent",     icon: Battery,      description: "UPF islands, retention, isolation, DVFS" },
      { label: "Physical Design",  href: "/physical-design",  icon: Grid3X3,      description: "Density, congestion, wirelength, DRC" },
      { label: "Analog & Mixed",   href: "/analog-mixed",     icon: Waves,        description: "Op-amp, ADC ENOB, charge pump, bandgap" },
      { label: "HW Security",      href: "/hw-security",      icon: ShieldAlert,  description: "Trojans, DPA/SPA, secure boot, PUF, fault injection" },
      { label: "Network-on-Chip",  href: "/network-on-chip",  icon: GitFork,      description: "Mesh/torus, flit routing, deadlock, NoC power" },
      { label: "High-Speed I/O",   href: "/high-speed-io",    icon: Signal,       description: "SerDes, CTLE/DFE, jitter budget, FEC, PAM4" },
      { label: "Fluid Cooling",    href: "/fluid-cooling",    icon: Droplets,     description: "Liquid cooling, heat pipes, vapor chambers" },
      { label: "HW-SW Co-Opt",     href: "/hw-sw-coopt",      icon: Activity,     description: "Timing, waveforms, quantization" },
      { label: "EM & Signal",      href: "/em-integrity",     icon: Radio,        description: "Parasitics, crosstalk, eye diagram, ESD" },
      { label: "Specs",            href: "/specs",            icon: GraduationCap,description: "Technical specifications" },
      { label: "Economics",        href: "/economics",        icon: DollarSign,   description: "Market simulation" },
    ],
  },
];

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group flex-shrink-0">
            <motion.div
              className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Cpu className="text-primary-foreground w-5 h-5" />
              <div className="absolute inset-0 rounded-xl bg-primary/20 animate-ping" style={{ animationDuration: "3s" }} />
            </motion.div>
            <div className="flex flex-col">
              <span className="font-bold text-lg gradient-text">Lucineer</span>
              <span className="text-xs text-muted-foreground hidden sm:block">Inference Chip Platform</span>
            </div>
          </Link>

          {/* Desktop Navigation — grouped dropdowns */}
          <div className="hidden lg:flex items-center gap-1">
            {menuGroups.map((group) => (
              <div
                key={group.label}
                className="relative"
                onMouseEnter={() => setActiveGroup(group.label)}
                onMouseLeave={() => setActiveGroup(null)}
              >
                <button
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeGroup === group.label
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {group.label}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeGroup === group.label ? "rotate-180" : ""}`} />
                </button>

                {/* Megamenu dropdown */}
                <AnimatePresence>
                  {activeGroup === group.label && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-2 w-72 bg-card rounded-2xl shadow-2xl border border-border overflow-hidden"
                    >
                      <div className="p-2">
                        {group.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors group ${
                              pathname === item.href
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-muted text-foreground"
                            } ${item.featured ? "border border-primary/20 mb-1" : ""}`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              item.featured ? "bg-primary/20" : "bg-muted"
                            }`}>
                              <item.icon className={`w-4 h-4 ${item.featured ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                            </div>
                            <div>
                              <p className={`text-sm font-medium ${item.featured ? "text-primary" : ""}`}>{item.label}</p>
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}

            {/* About — standalone */}
            <Link
              href="/about"
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === "/about"
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Users className="w-4 h-4" />
              About
            </Link>
          </div>

          {/* Desktop right: Voxel Explorer CTA + Settings */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/voxel-explorer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-sm font-semibold transition-colors"
            >
              <Box className="w-4 h-4" />
              Voxel Explorer
            </Link>
            <Link
              href="/settings"
              className={`p-2 rounded-lg transition-colors ${
                pathname === "/settings"
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? "Close menu" : "Open menu"}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden bg-card border-t border-border overflow-hidden"
          >
            <div className="px-4 py-4 space-y-1">
              {/* Voxel Explorer featured at top on mobile */}
              <Link
                href="/voxel-explorer"
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/20 text-primary font-semibold mb-3"
                onClick={() => setIsOpen(false)}
              >
                <Box className="w-5 h-5" />
                <div>
                  <p className="text-sm font-bold">Voxel Explorer</p>
                  <p className="text-xs text-primary/70">Cross-sections of chips & networks</p>
                </div>
              </Link>

              {menuGroups.map((group) => (
                <div key={group.label}>
                  <p className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {group.label}
                  </p>
                  {group.items
                    .filter((i) => i.href !== "/voxel-explorer") // already shown above
                    .map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                          pathname === item.href
                            ? "text-primary bg-primary/10"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                        onClick={() => setIsOpen(false)}
                      >
                        <item.icon className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm">{item.label}</span>
                      </Link>
                    ))}
                </div>
              ))}

              <div className="border-t border-border pt-3 mt-2 space-y-1">
                <Link
                  href="/about"
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  <Users className="w-4 h-4" />
                  <span className="text-sm">About</span>
                </Link>
                <Link
                  href="/settings"
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                    pathname === "/settings"
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  <Settings className="w-4 h-4" />
                  <span className="text-sm">Settings</span>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
