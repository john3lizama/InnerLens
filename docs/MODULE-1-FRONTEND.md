# Module 1 — Frontend (React Native + Expo)

**Owners:** Mohammed (lead), Terina (components + screens)
**Location:** `reflect-xr/reflectxr-mobile/`

---

## 1. Initial Setup

```bash
npx create-expo-app reflectxr-mobile --template blank-typescript
cd reflectxr-mobile
npx expo install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npx expo install react-native-screens react-native-safe-area-context
npm install axios @react-native-async-storage/async-storage
```

Set `EXPO_PUBLIC_API_URL` in `.env` to point at John's running API (localhost for dev, deployed URL for staging).

---

## 2. Navigation Architecture

```
AppNavigator
├── AuthStack (when no token)
│   ├── LoginScreen
│   └── RegisterScreen
└── MainTabs (when authenticated)
    ├── HomeTab → HomeScreen
    ├── CreateTab → CreateStack
    │   ├── ConceptsScreen
    │   ├── PromptDesignScreen
    │   ├── PromptEditScreen
    │   ├── ResponseScreen
    │   └── ReflectScreen
    ├── ChatTab → ChatScreen
    │   └── ChatImageReveal (modal)
    ├── JournalTab → JournalStack
    │   ├── JournalListScreen
    │   └── JournalDetailScreen
    └── ProfileTab → ProfileScreen
```

Define all route params in `src/navigation/types.ts` so every screen is type-safe.

---

## 3. Screen Specifications

### HomeScreen
- Matches the sponsor's "Create" mockup (page 3 of the brief)
- Grid of cards: Create, Learn (placeholder), Reflect (links to journal), Creative Calm (placeholder)
- "Create" card navigates to ConceptsScreen
- MindMate entry point as a floating action button or card

### ConceptsScreen
- Fetches `GET /concepts` on mount via `conceptService.ts`
- Renders a grid of `ConceptCard` components (2 columns)
- Each card shows the concept title
- Tapping a card navigates to PromptDesignScreen with the concept data as a route param
- Must include ALL concepts from the brief (see README concept table)

### PromptDesignScreen
- Displays the concept's `prompt_template` with the `[DROPDOWN]` replaced by an actual dropdown component
- `dropdown_options` from the concept data populate the dropdown choices
- Second dropdown: "Pick a Style" — fetches `GET /styles` and groups them by category (Artistic Mediums, Mood/Tone, Other)
- "Next" button is disabled until both dropdowns have selections
- Navigates to PromptEditScreen with assembled prompt, selected style, and concept ID

### PromptEditScreen
- Shows the fully assembled prompt in an **editable** multi-line text input
- User can modify the prompt before submitting
- "Submit" button calls `generateService.generateImages(prompt, style, conceptId, 4)`
- Show loading spinner during generation (can take 10-20 seconds)
- On success, navigate to ResponseScreen with the array of image URLs

### ResponseScreen
- 2x2 grid of generated images (match the sponsor's "Response" mockup)
- Header shows concept title + "A safe space for emotions"
- "Select an image" label below the grid
- Tapping an image highlights it (border/overlay)
- Once selected, calls `generateService.selectImage(imageId, sessionId)`
- Navigate to ReflectScreen with selected image data

### ReflectScreen
- Selected image displayed large at the top
- Reflection question from concept data shown as a carousel (swipeable)
- Also include generic questions: "What sticks out to you most about your artwork?"
- Text input below for the journal entry
- Submit button calls `journalService.createJournal()`
- On success, show a confirmation and navigate back to Home or JournalList

### ChatScreen (MindMate)
- FlatList of message bubbles (inverted so newest at bottom)
- Text input + send button at bottom
- Calls `chatService.sendMessage(sessionId, message)`
- When `should_generate_image` is true in the response, show a "View your artwork" inline card
- Tapping it opens ChatImageReveal as a modal
- Show emotion tag chips below assistant messages
- First message creates a new session (sessionId starts null, returned in first response)

### ChatImageReveal
- Full-screen modal showing the auto-generated artwork
- Fade-in animation for the art reveal
- "Save to Journal" button → creates a journal entry linked to this image
- "Continue chatting" button → dismisses modal, returns to chat

### JournalListScreen
- Fetches `GET /journal` with pagination
- Each entry is a `JournalCard` showing: thumbnail image, first line of text, emotion tag chips, date
- Tap to navigate to JournalDetailScreen

### JournalDetailScreen
- Full image, full journal text, all emotion tags, date, concept used
- Optional: edit/delete (stretch — not required)

---

## 4. API Service Layer Contract

Every service file in `src/services/` maps 1:1 to a backend router. The request/response types are already defined in `src/types/`. Mohammed codes the frontend types to match John's Pydantic schemas exactly.

| Service File | Backend Router | Key Methods |
|-------------|---------------|-------------|
| `authService.ts` | `/auth` | `login(email, pw)`, `register(email, pw, name)`, `getMe()` |
| `conceptService.ts` | `/concepts` | `getConcepts()`, `getStyles()` |
| `generateService.ts` | `/generate` | `generateImages(prompt, style, conceptId, count)`, `selectImage(imageId, sessionId)` |
| `chatService.ts` | `/chat` | `sendMessage(sessionId, message)`, `generateFromChat(sessionId)` |
| `journalService.ts` | `/journal` | `getJournals(limit, offset)`, `getJournalById(id)`, `createJournal(imageId, sessionId, content, reflectionPrompt)` |

---

## 5. Component Library (Terina)

Build these in `src/components/ui/` first — every screen uses them.

| Component | Props | Notes |
|-----------|-------|-------|
| `Button` | `title, onPress, variant (primary/secondary/outline), disabled, loading` | Uses `colors.primary`. Loading shows a spinner. |
| `Card` | `children, onPress?, elevated?` | Rounded corners (`borderRadius.lg`), subtle shadow if elevated. |
| `Input` | `placeholder, value, onChangeText, multiline?, secureTextEntry?` | Border changes color on focus. Error state support. |
| `Dropdown` | `label, options, selectedValue, onSelect` | Modal picker on press. Grouped options for styles. |
| `LoadingSpinner` | `size?, color?` | Centered spinner. Used during image generation. |
| `EmotionTag` | `emotion, intensity?` | Colored chip using `colors.emotions[emotion]`. |
| `SafeAreaWrapper` | `children` | Wraps every screen with SafeAreaView + background color. |

---

## 6. State Management

Keep it simple — no Redux. Use React Context + hooks.

- `AuthContext`: stores JWT token + user object. `useAuth()` hook provides `login()`, `logout()`, `user`, `isLoading`.
- `ThemeContext`: light mode only for now. Provides `colors`, `typography`, `spacing`.
- Component-local state for everything else (each screen manages its own fetch + form state).

---

## 7. Error Handling Checklist

- [ ] 401 responses auto-clear token and redirect to LoginScreen (already in `api.ts` interceptor)
- [ ] Network errors show a user-friendly "Can't reach the server" message (not raw error)
- [ ] Image generation timeout (30s) shows "This is taking longer than expected" with retry button
- [ ] Empty states for: no journal entries, no concepts loaded, chat with no messages
- [ ] Loading skeletons on ConceptsScreen and JournalListScreen while data loads
