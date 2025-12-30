# CLAUDE.md - AI Assistant Guide for NGX Flash UI

## Project Overview

**NGX Flash UI** is a web application that rapidly generates UI designs from text prompts, images, and voice dictation using Google's Gemini API (Gemini 3.0 Flash and Pro models). Users can describe a UI concept and receive three unique styled HTML/CSS implementations in real-time via streaming.

## Technology Stack

- **Frontend:** React 19.0.0, TypeScript 5.8
- **Build Tool:** Vite 6.2.0
- **AI Integration:** Google Generative AI SDK (`@google/genai` ^0.7.0)
- **Models Used:** `gemini-3-flash-preview`, `gemini-3-pro-preview`
- **Module System:** ES Modules

## Project Structure

```
/
├── index.html          # HTML entry point, loads fonts and CDN imports
├── index.tsx           # Main React app component (~450 lines)
├── index.css           # Global styles and design system (263 lines)
├── types.ts            # TypeScript type definitions
├── constants.ts        # Application constants (placeholder texts)
├── utils.ts            # Utility functions (ID generation)
├── vite.config.ts      # Vite configuration with env vars
├── tsconfig.json       # TypeScript configuration
├── package.json        # Dependencies and scripts
├── metadata.json       # App metadata for AI Studio
└── components/
    ├── ArtifactCard.tsx        # Renders generated HTML in sandboxed iframe
    ├── DottedGlowBackground.tsx # Animated canvas background
    ├── Icons.tsx               # SVG icon library
    └── SideDrawer.tsx          # Modal drawer for code display
```

## Key Files and Their Purposes

| File | Purpose |
|------|---------|
| `index.tsx` | Main application logic, state management, Gemini API integration, generation pipeline |
| `index.css` | Design system, theming, responsive layout, animations |
| `types.ts` | TypeScript interfaces: `Artifact`, `Session`, `ComponentVariation`, `LayoutOption` |
| `components/ArtifactCard.tsx` | Isolated iframe rendering of generated HTML with streaming preview |
| `components/DottedGlowBackground.tsx` | GPU-accelerated animated dot grid effect using Canvas |

## Development Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server at localhost:3000
npm run build      # Production build to dist/
npm run preview    # Preview production build
```

## Environment Setup

The app requires a Gemini API key. Set it via environment variable:
```bash
# In .env.local or shell environment
GEMINI_API_KEY=your_api_key_here
```

The key is loaded in `vite.config.ts` and exposed as `process.env.API_KEY`.

## Core Architecture

### State Management (React Hooks in `index.tsx`)

- `sessions` - Array of generation sessions persisted to localStorage (`ngx_sessions`)
- `currentSessionIndex` - Active session being viewed
- `focusedArtifactIndex` - Which artifact is in fullscreen view (null for grid)
- `generationMode` - `'flash'` or `'a2ui'`
- `selectedModel` - Gemini model choice
- `isLoading` - Generation in progress
- `isListening` - Voice recognition active
- `selectedImage` - Base64 image for inspiration

### Generation Pipeline

1. User provides prompt (text/voice/image)
2. **Phase 1:** Gemini generates 3 distinct style names
3. **Phase 2:** Parallel streaming generation of 3 HTML/CSS artifacts
4. Real-time UI updates as chunks stream in
5. Auto-cleanup of markdown code fences

### Key Data Types

```typescript
interface Artifact {
  id: string;
  styleName: string;      // e.g., "Modern Clean"
  html: string;           // Generated HTML/CSS/JS
  status: 'streaming' | 'complete' | 'error';
}

interface Session {
  id: string;
  prompt: string;
  timestamp: number;
  artifacts: Artifact[];  // Always 3 variations
}
```

## Code Conventions

### React Patterns
- Functional components with hooks (no class components)
- `React.memo()` for expensive renders (e.g., `ArtifactCard`)
- `useCallback` for stable function references
- Controlled inputs with state

### TypeScript Patterns
- Separate `types.ts` for shared interfaces
- Props interfaces named with `Props` suffix
- Union types for enums: `'streaming' | 'complete' | 'error'`

### CSS Patterns
- CSS variables for theming
- Glassmorphism via `backdrop-filter: blur()`
- CSS Grid with `auto-fill` for responsive layouts
- Mobile breakpoint at 768px
- Z-index layers: background (0) → content (10) → ui-layer (100) → overlay (2000)

### API Integration
- Async/await for Gemini calls
- `Promise.all()` for parallel generation
- Streaming via async iteration
- Try-catch with fallback defaults

## Design System

### Colors
- Brand: `#6D00FF` (violet)
- Background: `#050507` (near-black)
- Sidebar: `#0a0a0f`
- Text primary: `#ffffff`
- Text secondary: `#94a3b8`
- Border: `rgba(255, 255, 255, 0.08)`

### Key UI Elements
- Sidebar: Fixed 280px left panel
- Grid: Auto-fill cards with 320px minimum, 32px gap
- Artifact cards: 16:10 aspect ratio
- Input: Frosted glass, 760px max-width
- Buttons: Glassmorphism with backdrop blur

## Security Considerations

- API key loaded from environment (never hardcode)
- Generated HTML runs in sandboxed iframes with `sandbox` attribute
- React escapes content by default (XSS prevention)
- Image files converted to base64 client-side

## Testing

No testing framework is currently configured. When adding tests:
- Consider Vitest (aligns with Vite tooling)
- Focus on generation pipeline and state management
- Mock Gemini API responses for predictable testing

## Common Tasks

### Adding a new icon
Edit `components/Icons.tsx` and add a new functional component following the existing pattern with `1em` size.

### Modifying placeholders
Edit `constants.ts` → `INITIAL_PLACEHOLDERS` array.

### Changing Gemini models
Update model options in `index.tsx` where `selectedModel` is used.

### Adding new artifact actions
Look for the action bar rendering in `index.tsx` near the focus overlay logic.

### Persisting new state
Add to the `useEffect` that syncs to localStorage with key `ngx_sessions`.

## Gotchas

- Voice recognition is hardcoded to Spanish (`es-ES`)
- Artifacts are sandboxed - some JavaScript may not work
- Always 3 artifacts per generation (hardcoded)
- No backend - all processing is client-side
- CDN imports in `index.html` for React and Gemini SDK

## Git Workflow

Current branch: `claude/add-claude-documentation-YC9L2`

Recent commits:
- `c5bc3e7` - feat: Add new project button and update sidebar styles
- `7f137f5` - feat: Initialize NGX Flash UI project
- `1d67652` - Initial commit

## Contributing Guidelines

1. Keep components focused and single-purpose
2. Use TypeScript strictly - avoid `any`
3. Follow existing naming conventions
4. Test generation pipeline changes manually with various prompts
5. Maintain the glassmorphism design aesthetic
6. Ensure mobile responsiveness at 768px breakpoint
