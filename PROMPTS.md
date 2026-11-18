# Prompt log

Prompts used to build this project with Claude Code, in order and verbatim.

---

## 1. Plan, data model and AI engineering rules

**Prompt**

```text
Read docs/REQUIREMENTS.md and the assessment brief. Before writing any code, create docs/PLAN.md covering:

* The tech stack : frontend -> React.js; backend -> Node.js & Express.js; Keep language as typescript. In React, use functional components. For global states, use Redux.
* The data model - employees, salary components, append-only salary history, the single HR Manager account, countries with currencies and USD rates . Use PostgreSQL database with Prisma for communicating with it.
* Key design decisions with trade-offs, and a test-first build order.
* Also create CLAUDE.md with the engineering rules the AI must follow for the rest of the project. 
* I will review everything thoroughly, so be precise and stick to the requirements and assessment docs.
* NOTE: Don’t write application code yet.
```

**Outcome:** `docs/PLAN.md` (tech stack, data model, design decisions with trade-offs, test-first build order) and `CLAUDE.md` (engineering rules for the AI). No application code.

**Commit(s):** _to be added_
