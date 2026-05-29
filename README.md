# WheelFit ♿

> AI-powered accessible furniture advisor for wheelchair users

WheelFit is an AI agent built at the Beat The Clock Agent Hack @ Wayfair HQ during Boston Tech Week 2026. It helps wheelchair users find furniture that actually works for their space — accounting for ADA clearance standards, wheelchair turning radius, and accessibility design.

## The Problem

People who use wheelchairs deserve a home that works for them, but furniture shopping offers almost no help. There's no easy way to know if a bed allows a safe transfer, if a dresser is reachable from a seated position, or if there's enough floor space to navigate after everything is placed. Most people figure it out after the furniture arrives — or don't buy at all.

WheelFit solves this before you buy.

## How It Works

1. **Room Details** — Enter your room dimensions, wheelchair type, and style preference
2. **Map Your Room** — Drag and drop doors, windows, heaters, and closets onto a visual floor plan. Move the wheelchair turning circle to check clearance
3. **Get Recommendations** — The agent searches Wayfair, scores every product for accessibility, and returns the best combinations for your specific space

## Accessibility Scoring System

Every product is scored out of 100:

| Criteria | Points | What It Measures |
|----------|--------|-----------------|
| Clearance Fit | 35 pts | Leaves 36" wheelchair pathway |
| Accessibility Design | 25 pts | Open base, correct height, no snag hazards |
| Floor Footprint | 20 pts | Smaller = more maneuvering room |
| Style Match | 15 pts | Matches user's aesthetic preference |
| Price / Value | 5 pts | Relative to category |

### ADA Rules Hardcoded Into Every Recommendation
- Minimum 36" pathway clearance beside every piece of furniture
- 60" × 60" turning zone must remain clear in the room
- Seat height 17–19" for chairs and sofas
- Storage max 48" tall for reachability from seated position
- Open/panel base preferred over 4-leg designs (footrests catch on legs)

## Tech Stack

- **Subconscious (TIM model)** — agent orchestration and multi-step tool calling
- **Anthropic Claude** — accessibility scoring engine
- **Next.js** — frontend and UI
- **FastAPI (Python)** — tool endpoints for search and scoring
- **Playwright** — live Wayfair product crawling


## Links

- [Subconscious Platform](https://www.subconscious.dev/platform) — API keys
- [Subconscious Docs](https://docs.subconscious.dev)
- [Vercel AI SDK — Agents](https://ai-sdk.dev/docs/agents/overview)
- [Subconscious skills repo](https://github.com/subconscious-systems/skills)
