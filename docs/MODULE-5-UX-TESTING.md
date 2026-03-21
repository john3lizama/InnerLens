# Module 5 — UX/UI Design + User Testing

**Owner:** Terina
**Supporting:** Mohammed (implementation), all team members (testing support)

---

## 1. Design System

### Color Palette (Defined in `src/theme/colors.ts`)

The sponsor brief requires a "calming, reflective, and accessible" experience. The palette is already defined in the codebase. Do not deviate from it without team discussion.

- **Primary:** `#6C63FF` (soft purple) — buttons, active states, links
- **Background:** `#F7F7FC` (off-white with subtle warmth)
- **Surface:** `#FFFFFF` — cards, modals
- **Text:** `#2D2D3A` primary, `#6B6B80` secondary
- **Emotions:** Each emotion has a specific color (see `colors.emotions` in the theme file)

### Typography (Defined in `src/theme/typography.ts`)
- H1: 28px/700 — screen titles
- H2: 22px/600 — section headers
- Body: 16px/400 — paragraph text, chat messages
- Caption: 12px/400 — timestamps, metadata

### Spacing (Defined in `src/theme/spacing.ts`)
- xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48
- Border radius: sm: 8, md: 12, lg: 16, xl: 24
- Use generous whitespace — this is a wellness app, not a dashboard

---

## 2. Figma Workflow

### Screens to Design (in priority order)

**Phase 1 (Week 1-2) — Design these FIRST so Mohammed can build:**
1. HomeScreen — matches sponsor's "Create" mockup
2. ConceptsScreen — grid of concept cards
3. PromptDesignScreen — template + dropdown + style picker
4. PromptEditScreen — editable text field + submit

**Phase 2 (Week 3-4):**
5. ResponseScreen — 2x2 image grid with selection
6. ReflectScreen — image + reflection question + journal input (MOST IMPORTANT design screen)

**Phase 3 (Week 5-6):**
7. ChatScreen — MindMate conversation UI
8. ChatImageReveal — art reveal modal
9. JournalListScreen — entry cards with emotion tags
10. JournalDetailScreen — full entry view

**Phase 4 (Week 7):**
11. LoginScreen / RegisterScreen
12. ProfileScreen

### Figma Organization
```
InnerLens (Figma Project)
├── Design System (page)
│   ├── Colors
│   ├── Typography
│   ├── Spacing + Grid
│   └── Components (Button, Card, Input, Dropdown, EmotionTag, ConceptCard, ChatBubble)
├── Screens (page)
│   ├── Home
│   ├── Create Flow (Concepts → Prompt → Edit → Response → Reflect)
│   ├── Chat Flow (Chat → Image Reveal)
│   ├── Journal Flow (List → Detail)
│   └── Auth (Login → Register)
└── Prototype (page)
    └── Clickable flow linking all screens
```

### Handoff to Mohammed
- Export spacing + sizing specs (or use Figma Dev Mode if available)
- Name layers clearly — they should map to component names (e.g., "ConceptCard", "EmotionTag")
- Provide assets as 2x and 3x PNGs or SVGs

---

## 3. Component Implementation (Terina Builds These)

You build the component library in `src/components/`. Mohammed builds the screens that use them.

### Priority Order

**Week 2:** `Button`, `Card`, `Input`, `Dropdown`, `SafeAreaWrapper`
**Week 3:** `ConceptCard`, `StylePicker`, `ImageGrid`, `ReflectionPrompt`
**Week 4:** `LoadingSpinner`, `EmotionTag`
**Week 5:** `ChatBubble`, `ChatInput`, `TypingIndicator`
**Week 6:** `JournalCard`, `EmotionTagList`

### Component Quality Checklist
For every component:
- [ ] Matches the Figma design exactly
- [ ] Uses theme tokens (colors, typography, spacing) — no hardcoded values
- [ ] Has a loading/disabled state where applicable
- [ ] Works on both iOS and Android (test both in Expo Go)
- [ ] Handles edge cases (long text, missing data, empty states)

---

## 4. Accessibility Requirements

The sponsor brief specifically calls out "accessible experience." At minimum:

- [ ] All interactive elements have a minimum tap target of 44x44 points
- [ ] Text meets WCAG AA contrast ratio (4.5:1 for body text, 3:1 for large text)
- [ ] Images have alt text (use `accessibilityLabel` in React Native)
- [ ] Font sizes are readable (minimum 14px for body text — already in the theme)
- [ ] Screen reader support: test with VoiceOver (iOS) or TalkBack (Android) at least once
- [ ] No information conveyed by color alone (emotion tags should have text labels, not just colored dots)

---

## 5. User Testing Plan (Required Deliverable — R8)

### Timeline
- **Week 7:** Conduct testing sessions
- **Week 8:** Compile insights and iterate on feedback

### Participants
- 3-5 testers (GMU students — ask classmates, friends)
- Mix of people who journal regularly and people who don't
- At least 1 person who has used mental health/wellness apps before

### Test Script

**Pre-test (2 min):**
- "Have you used any journaling or wellness apps before?"
- "How comfortable are you with AI-generated content?"

**Task 1 — Core Flow (5 min):**
- "Imagine you're feeling a bit overwhelmed. Open the app and use the Create feature to generate some artwork that reflects how you're feeling, then write a short reflection."
- Observe: Do they find the concepts screen? Can they use the dropdowns? Do they understand what the prompt edit screen is for? Do they know to select an image? Is the reflection screen intuitive?

**Task 2 — MindMate (5 min):**
- "Now try the MindMate chat. Just talk to it about how your day has been."
- Observe: Does the conversation feel natural? Do they notice the emotion tags? If art auto-generates, is the reveal clear?

**Task 3 — Journal Review (2 min):**
- "Go to your journal and find the entry you just created."
- Observe: Can they find it? Are the emotion tags meaningful to them?

**Post-test (3 min):**
- "What was your overall impression?"
- "What felt confusing or frustrating?"
- "What would you want to see added or changed?"
- "On a scale of 1-5, how calming did the experience feel?"

### Feedback Form Template

Save this in `docs/user-testing/feedback-form.md`:

```
Tester ID: ___
Date: ___

1. Were you able to complete the Create flow? (Yes / Partially / No)
   Notes:

2. Did the MindMate conversation feel natural? (1-5 scale)
   Notes:

3. Was the emotion tag system meaningful to you? (1-5 scale)
   Notes:

4. How calming did the overall experience feel? (1-5 scale)
   Notes:

5. What was the most confusing part?

6. What would you change?

7. Would you use this app regularly? (Yes / Maybe / No)
   Why:
```

### Insights Report Format

Save in `docs/user-testing/insights-report.md` after testing:

```
# User Testing Insights Report

## Summary
- N testers, dates, demographics

## Key Findings
1. [Finding] — observed by N/5 testers
2. [Finding] — observed by N/5 testers
...

## Positive Feedback
- [What worked well]

## Issues Found
| Issue | Severity (High/Med/Low) | Proposed Fix | Fixed? |
|-------|------------------------|-------------|--------|

## Recommendations for Future Development
1. ...
2. ...
```

---

## 6. Final Presentation (Required Deliverable — R10)

### Slide Deck Outline (8-10 slides)

1. **Title slide** — InnerLens / ReflectXR + MindMate, team names, Persistent Technology logo
2. **Problem** — Mental health stigma, lack of accessible creative wellness tools
3. **Solution** — ReflectXR: emotion → AI art → reflection. MindMate: conversation → auto art
4. **Live Demo** — (switch to live app, follow the 3-minute demo script from README)
5. **Architecture** — system diagram showing React Native → FastAPI → AI APIs → PostgreSQL
6. **Technical Highlights** — NLP emotion tagging, prompt template system, crisis safety
7. **User Testing Results** — key findings, quotes, metrics
8. **Team** — who built what, leveraging each person's strengths
9. **Future Vision** — Alexa integration, more concepts, therapist dashboard, mood tracking over time
10. **Q&A**

### 2-Page Project Summary Report (Required Deliverable)
Save in `docs/presentation/project-summary.md`. Must include:
- Project overview and objectives
- Technical architecture summary
- Features implemented
- User testing methodology and findings
- Challenges and how they were resolved
- Future recommendations
