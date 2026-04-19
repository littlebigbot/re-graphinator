# Fullstack TypeScript Interview Notes

> Quick reference for Wednesday's interview. Keep this open during prep.

---

## House Rx — Company Stack

- **Frontend**: React, TypeScript
- **Backend**: Node.js, TypeScript
- **Database**: PostgreSQL
- **APIs**: REST (they care about semantics, verbs, status codes)
- **Infra**: AWS, Airflow (MWAA)
- **Likely**: Express + Prisma (not confirmed; Hono/Drizzle are newer and less common)

---

## Your Accomplishments (Talking Points)

**Tech highlight**: Built a video platform from scratch—**the actual video technology**, not Twilio or off-the-shelf—that scaled to **15,000+ video calls/day** for MedStar (healthcare).

**Ownership**: Created and owned the entire frontend from day one; ran it through acquisition.

**Leadership**: Grew/guided the frontend team in a team lead capacity (technical direction, standards, mentoring—not formal people management).

**Cross-functional**: Worked closely with product; developed strong understanding of users (patients, nurses, doctors).

**"Tell me about yourself" opener**: "I built a video platform from scratch—the actual video technology—that scaled to 15,000 calls per day for a major health system."

---

## Intro Interview — Common Questions

- **Tell me about yourself** — 1–2 min: who you are, what you do, why House Rx. Lead with the video platform.
- **Why House Rx?** — Mission (specialty meds, patient access), healthcare + tech, meaningful impact.
- **Why leaving current role?** — Growth, mission fit; avoid negativity.
- **Project you're proud of?** — Use STAR. Focus on ownership, scale, healthcare context.
- **Technical challenge you solved?** — Real example; explain your approach.
- **How do you collaborate with product/design?** — Specific: tickets, reviews, handling ambiguity.
- **What are you looking for?** — Tie to what they offer: impact, ownership, modern stack.

**Questions to ask them:**

- What does a typical day look like for someone in this role?
- What's the biggest technical challenge you're facing right now?
- How does the team balance shipping fast with maintaining quality?
- What would success look like in the first 90 days?

---

## Backend Fundamentals

### HTTP Methods

| Method | Use case                          |
| ------ | --------------------------------- |
| GET    | Read data (idempotent, cacheable) |
| POST   | Create resource                   |
| PUT    | Replace entire resource           |
| PATCH  | Partial update                    |
| DELETE | Remove resource                   |

### Common Status Codes

- **2xx** Success: 200 OK, 201 Created, 204 No Content
- **3xx** Redirect: 301 Moved Permanently, 302 Found
- **4xx** Client error: 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 422 Unprocessable Entity
- **5xx** Server error: 500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable

### REST Design

- Resources as nouns: `/users`, `/users/:id`, `/posts/:id/comments`
- Versioning: `/api/v1/users` or Accept header
- Stateless: each request has everything needed; no server-side session storage required for auth (JWT in header is typical)

### Middleware

Functions that run before route handlers. Order matters. Typical flow:

1. Logging
2. CORS
3. Auth (parse JWT, attach user to request)
4. Rate limiting
5. Route handler

---

## TypeScript

### Common Types

```typescript
interface User {
  id: number;
  email: string;
  createdAt: Date;
}

type ApiResponse<T> = { data: T } | { error: string };

function identity<T>(x: T): T {
  return x;
}
```

### Generics

- `Array<T>`, `Promise<T>`, `Record<K, V>`
- Constraint: `function first<T extends { id: number }>(arr: T[]): T`

### Utility Types

- `Partial<T>` — all props optional
- `Required<T>` — all props required
- `Pick<T, K>` — subset of props
- `Omit<T, K>` — exclude props
- `ReturnType<F>` — return type of function

---

## Database & ORM

### Prisma Basics

```typescript
// schema
model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  posts Post[]
}
model Post {
  id       Int   @id @default(autoincrement())
  title    String
  authorId Int
  author   User  @relation(fields: [authorId], references: [id])
}

// queries
const users = await prisma.user.findMany({ include: { posts: true } })
const user = await prisma.user.create({ data: { email: "a@b.com" } })
const updated = await prisma.user.update({ where: { id: 1 }, data: { email: "new@b.com" } })
```

### Prisma vs Drizzle

|           | Prisma                 | Drizzle               |
| --------- | ---------------------- | --------------------- |
| Schema    | Separate `.prisma` DSL | TypeScript            |
| Queries   | OOP / fluent           | SQL-like              |
| Size      | Heavier                | Lighter               |
| Relations | First-class, polished  | Via relations API     |
| Best for  | Most apps, strong DX   | Edge, SQL familiarity |

### Drawbacks of TS for schema (Drizzle-style)

- Two-way sync: schema and migrations can drift; DSL enforces single source of truth
- Tooling: harder to introspect/parse TS than a simple DSL
- Circular deps: relations in TS can get tricky
- Non-TS use: harder to consume from other languages/tools

### SQL Concepts (if asked)

- Primary key, foreign key, unique constraint
- Indexes for frequently queried columns
- JOINs: INNER, LEFT, RIGHT
- Transactions for multi-step operations that must succeed or fail together

---

## Frontend–Backend Integration

### Fetch Pattern

```typescript
const res = await fetch(`${import.meta.env.VITE_API_URL}/api/users`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ email, password }),
});
if (!res.ok) throw new Error(await res.text());
const data = await res.json();
```

### CORS

- Browsers block cross-origin requests by default
- Backend must send `Access-Control-Allow-Origin` (and related headers) for your frontend origin
- Preflight (OPTIONS) for non-simple requests (custom headers, non-GET/POST)

### Env vars

- `VITE_` prefix for client-visible vars in Vite
- Never expose secrets (API keys, DB URLs) to the client

### Axios vs Fetch

- **Axios**: Auto-parses JSON, throws on 4xx/5xx, interceptors for auth/logging, built-in timeout, progress events, smaller API surface
- **Fetch**: Native, no deps, smaller bundle; need manual `.json()`, custom error handling, `AbortController` for timeout/cancel
- Use axios when you want interceptors and nicer defaults without writing helpers

---

## Auth

### JWT

- Payload: `{ sub: userId, exp: timestamp }` + optional claims
- Stored in `localStorage` or `sessionStorage`, or cookie (HttpOnly for security)
- Sent as `Authorization: Bearer <token>`
- Stateless: server verifies signature, extracts user; no DB lookup per request (unless you add it)

### Session vs JWT

- **Session**: server stores session ID; client has cookie. Server looks up session in DB/cache.
- **JWT**: client has token; server validates signature. No server storage for the token itself.

### Common flows

- Login: POST credentials → validate → return JWT
- Protected route: middleware checks JWT, attaches user to `req`
- Logout: client discards token (or, if using refresh tokens, invalidate on server)

---

## Express Quick Reference

```typescript
import express from 'express';
const app = express();
app.use(express.json());
app.use(cors());

app.get('/users/:id', async (req, res) => {
  const { id } = req.params;
  const user = await db.user.findUnique({ where: { id: +id } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

app.post('/users', async (req, res) => {
  const user = await db.user.create({ data: req.body });
  res.status(201).json(user);
});

app.listen(3001);
```

---

## Terms

- **DX** = Developer experience (setup ease, docs, errors, iteration speed)
- **DSL** = Domain-specific language (e.g. Prisma schema, SQL, regex—focused on one problem)
- **Edge** = Code runs close to users (geographic distribution); lower latency; constrained runtimes (Cloudflare Workers, Vercel Edge); not full Node.js APIs

---

## Hono Quick Reference (if they use it)

Small, fast framework built on Web Standards. Multi-runtime (Node, Cloudflare Workers, Vercel Edge, Deno, Bun). Unlikely at House Rx (Express more common for healthcare), but easy to pick up.

```typescript
import { Hono } from 'hono';
const app = new Hono();
app.get('/', (c) => c.json({ ok: true }));
app.get('/users/:id', (c) => {
  const id = c.req.param('id');
  return c.json({ id });
});
app.post('/users', async (c) => {
  const body = await c.req.json();
  return c.json(body, 201);
});
export default app;
```

- Uses Web Standards (Request/Response)
- `c.req`, `c.res`, `c.json()`, `c.text()`, `c.redirect()`
- Middleware: `app.use('/*', cors())`

---

## Likely Interview Questions

1. **How would you structure an API for X?** — RESTful resources, status codes, error shape
2. **How do you handle auth?** — JWT vs session, where to store, middleware
3. **TypeScript: when use interface vs type?** — Interfaces for object shapes, extensible; types for unions, primitives, mapped types
4. **How do you prevent XSS/CSRF?** — Sanitize output, CSP, CSRF tokens for state-changing requests, HttpOnly cookies
5. **N+1 problem?** — Eager loading (`include` in Prisma), or batch queries
6. **Error handling?** — Try/catch in route handlers, global error middleware, consistent error response shape

---

## If You're Stuck

- Clarify the question: "So you're asking about how I'd design the API contract, or the implementation?"
- Talk through your thinking out loud
- Start simple, then add: "First I'd do X, then we could add caching, validation, etc."

---

## Mock Interview — Questions & Polished Answers

### 1. Tell me about yourself

"I'm a full-stack developer with about 10 years on video platforms. At BlueStream, I built the video platform from scratch—the actual video technology itself, not something like Twilio—that scaled to 15,000 calls per day for health systems like MedStar and NYCHHC. I owned the frontend from day one and led the team through our acquisition by eVisit.

I'm interested in House Rx for a few reasons. The all-TypeScript stack really appeals to me—my mind works best when the frontend and backend share the same language. I also have people in my network who work there and have spoken highly of the company and how you build. On top of that, the mission around specialty medication and patient access lines up with the kind of impact I want to have in healthcare."

### 2. Why House Rx over other healthcare companies?

"Eric Thomas and Austin Hammer have both spoken really highly of the company and how you work. On top of that, the idea of going all-in on TypeScript front and back is appealing—my mind just works well in TypeScript, and it's great to have that consistency across the stack."

### 3. Tell me about a project you're proud of

"The project I'm most proud of is BlueStream's video platform—I built it from scratch and maintained it for about 10 years. Within that, one piece I'm especially proud of is the highly configurable frontend we built for NYCHHC during COVID. The backend sent configuration as JSON, and the frontend rendered a customizable experience for their providers and patients. We delivered the initial version in a few weeks, then added configuration so other health systems could reuse it. For NYCHHC specifically, it was deployed across the city within months and integrated with the 911 system—it's now part of how the city delivers care."

### 4. Describe a technical challenge you solved

"One of the harder challenges was getting our video platform to run on custom TV operating systems—basically TVs running 10-year-old Chrome. Two main problems: first, performance—we had to drastically reduce what the TV had to render and load. Second, WebRTC compatibility—the old browser's WebRTC had to talk to newer versions on laptops and phones. We had to compare specs, debug signaling, and find a minimal feature set both sides supported. We ended up editing the SDPs directly—Session Description Protocol, the format WebRTC uses—which goes against the usual advice, but it worked and continues to work today. It was tough in the moment but solving it was really rewarding."

### 5. Why are you leaving your current role?

"I'm looking for a few things: more hands-on coding, an all-TypeScript stack, and harder technical problems. I still find my current role rewarding, but post-acquisition my role has evolved toward more coordination and process—which makes sense—but I want to spend more of my time building. House Rx's focus on full-stack and backend work fits that."

### 6. How do you collaborate with product and design?

"I love working with design—I came from a web agency where everything was pixel-perfect, and I like building smooth, responsive components that match the spec. With product, I like that they help me understand how the app is actually used—not just how it works—so I can build toward real user behavior. There's often some back-and-forth, and I try to find solutions that work for everyone.

For example, the customizable front door we built for NYCHHC—now used by them and other customers—had very open requirements. We built it to be flexible so we could iterate. Last year we revamped the whole front door to align with eVisit's style guide post-acquisition, and it was a less-than-a-sprint lift because of how we'd architected it."

### 7. Do you have any questions for us?

- "What's the biggest technical challenge the team is tackling right now, and how are you approaching it?"
- "What would success look like for someone in this role in the first 90 days?"
- "How is the engineering team structured? I saw you have pods—how does that work in practice?"

### 8. Describe a time you disagreed with a teammate

"I tend to be a peacemaker and see other perspectives easily, so strong disagreements don't come up often. When they do, it's usually around DX versus speed. At BlueStream, I sometimes wanted to invest in better structure and extensibility, while the team needed to ship quickly for customers. I shared my concerns but deferred to the faster path because I agreed the customer need came first. I kept notes on what I'd do differently. When we rebuilt the video layer later, I used those lessons and made it more extensible—so we chose speed in the moment, and I got to apply my ideas when we had the chance to rebuild."

### 9. Tell me about a time you failed or made a mistake

"A few months ago we hit a bug: a transformation of a backend payload hadn't been adjusted correctly in an earlier change, and a new release uncovered it. I found the fix in a couple of hours, but then spent about four hours making sure it didn't introduce new issues—adding tests and stepping through the flow. That reinforced something I'd seen before: when we ship fast under sev-1 pressure, we make mistakes. Since then I've pushed to add more tests and lints so we catch those before they ship. I'd rather invest in that up front than scramble to fix things after."

### 10. What are you looking for in your next role?

"I'm a puzzle solver—I like to build things, that's why I started making websites in middle school and haven't stopped. I love the moment when it all comes together and you picture all the possible puzzles that figuring out _this_ puzzle just unlocked. I also thrive on team—I learn the most from my coworkers and love seeing how their brains work in their code. I'm looking for more of that: hands-on building, hard problems, and a team I can learn from. House Rx seems to offer that—complex workflows, full-stack ownership, and people who care about building well."
