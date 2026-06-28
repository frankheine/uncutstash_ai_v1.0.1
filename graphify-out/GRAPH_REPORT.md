# Graph Report - .  (2026-06-27)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 451 nodes · 499 edges · 59 communities (38 shown, 21 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 69 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `aad7222d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## God Nodes (most connected - your core abstractions)
1. `cn()` - 73 edges
2. `compilerOptions` - 19 edges
3. `compilerOptions` - 16 edges
4. `StreamingLoader` - 9 edges
5. `tailwind` - 6 edges
6. `aliases` - 6 edges
7. `scripts` - 6 edges
8. `BloomFilter` - 5 edges
9. `RAGCacheInterceptor` - 5 edges
10. `runWorker()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `AttachmentPreview()` --calls--> `cn()`  [INFERRED]
  src/components/assistant-ui/attachment.tsx → src/lib/utils.ts
- `AttachmentUI()` --calls--> `cn()`  [INFERRED]
  src/components/assistant-ui/attachment.tsx → src/lib/utils.ts
- `ReasoningFade()` --calls--> `cn()`  [INFERRED]
  src/components/assistant-ui/reasoning.tsx → src/lib/utils.ts
- `ReasoningTrigger()` --calls--> `cn()`  [INFERRED]
  src/components/assistant-ui/reasoning.tsx → src/lib/utils.ts
- `ReasoningContent()` --calls--> `cn()`  [INFERRED]
  src/components/assistant-ui/reasoning.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (59 total, 21 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (41): dependencies, @assistant-ui/react, @assistant-ui/react-markdown, bloom-filters, class-variance-authority, clsx, framer-motion, gsap (+33 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (20): CommandPaletteProps, DocumentDropzoneProps, getAvailableTargets(), getModelCatalog(), ModelPair, ModelSelector(), ModelSelectorProps, ragCache (+12 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (3): AssistantMessage(), BranchPicker(), TooltipContent()

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (21): compilerOptions, allowImportingTsExtensions, ignoreDeprecations, isolatedModules, jsx, lib, module, moduleResolution (+13 more)

### Community 5 - "Community 5"
Cohesion: 0.10
Nodes (20): devDependencies, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, playwright (+12 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (10): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+2 more)

### Community 8 - "Community 8"
Cohesion: 0.21
Nodes (7): AttachmentPreview(), AttachmentPreviewDialog(), AttachmentPreviewProps, AttachmentThumb(), AttachmentUI(), useAttachmentSrc(), useFileSrc()

### Community 9 - "Community 9"
Cohesion: 0.18
Nodes (9): Reasoning, ReasoningContent(), ReasoningFade(), ReasoningGroup, ReasoningRoot(), ReasoningRootProps, ReasoningText(), ReasoningTrigger() (+1 more)

### Community 10 - "Community 10"
Cohesion: 0.17
Nodes (11): statusIconMap, ToolFallback, ToolFallbackArgs(), ToolFallbackContent(), ToolFallbackError(), ToolFallbackImpl(), ToolFallbackResult(), ToolFallbackRoot() (+3 more)

### Community 11 - "Community 11"
Cohesion: 0.24
Nodes (9): cn(), Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage(), Slider() (+1 more)

### Community 12 - "Community 12"
Cohesion: 0.18
Nodes (6): DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay(), DialogTitle()

### Community 13 - "Community 13"
Cohesion: 0.18
Nodes (6): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle()

### Community 14 - "Community 14"
Cohesion: 0.18
Nodes (8): SelectContent(), SelectGroup(), SelectItem(), SelectLabel(), SelectScrollDownButton(), SelectScrollUpButton(), SelectSeparator(), SelectTrigger()

### Community 17 - "Community 17"
Cohesion: 0.25
Nodes (7): ToolGroup, ToolGroupComponent, ToolGroupContent(), ToolGroupRoot(), ToolGroupRootProps, ToolGroupTrigger(), toolGroupVariants

### Community 18 - "Community 18"
Cohesion: 0.22
Nodes (5): ChatMessage, ChatThread, hotStore, messagesStore, threadsStore

### Community 19 - "Community 19"
Cohesion: 0.25
Nodes (4): PopoverContent(), PopoverDescription(), PopoverHeader(), PopoverTitle()

### Community 20 - "Community 20"
Cohesion: 0.38
Nodes (3): CommsPanel(), SidebarMenuProps, ScrollArea

### Community 21 - "Community 21"
Cohesion: 0.29
Nodes (6): Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle

### Community 22 - "Community 22"
Cohesion: 0.40
Nodes (4): CodeHeader(), defaultComponents, MarkdownText, useCopyToClipboard()

### Community 24 - "Community 24"
Cohesion: 0.33
Nodes (3): App(), PanelGroup, setActiveProgressCallback()

### Community 25 - "Community 25"
Cohesion: 0.40
Nodes (5): Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger()

### Community 27 - "Community 27"
Cohesion: 0.40
Nodes (3): STYLE_OPTIONS, StyleOption, StyleSelectorProps

### Community 28 - "Community 28"
Cohesion: 0.67
Nodes (3): kill_processes_on_ports(), main(), Safely kills processes listening only on the provided list of target ports.

### Community 29 - "Community 29"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

## Knowledge Gaps
- **171 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+166 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Community 11` to `Community 32`, `Community 2`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 42`, `Community 12`, `Community 13`, `Community 14`, `Community 17`, `Community 19`, `Community 25`, `Community 31`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Community 5` to `Community 0`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Are the 67 inferred relationships involving `cn()` (e.g. with `AttachmentPreview()` and `AttachmentUI()`) actually correct?**
  _`cn()` has 67 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _172 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.047619047619047616 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._