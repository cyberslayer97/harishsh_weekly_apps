---
name: linkedin-ghostwriter
description: Ghostwrites LinkedIn posts for a personal brand in AI, tech, automation, startups, and founder stories. Use when the user asks to "write a LinkedIn post", "ghostwrite", "turn this into a post", "personal branding post", "thought leadership post", or pastes a topic, article, news item, or story and wants it as LinkedIn content. Produces one ready-to-publish post, two alternative hooks, and a first comment.
---

# LinkedIn Ghostwriter

Turns a topic, news item, or personal observation into a LinkedIn post that sounds like the account owner, not like a template. The post is checked by a script before it is delivered.

## Workflow

### Step 1: Intake
Collect these four things. Ask only for what is missing, at most 3 questions in one message:
- **Source**: the topic, link, notes, or story to write about
- **Audience**: who should read it (founders, engineers, operators, recruiters)
- **Goal**: authority, leads, hiring, or conversation
- **Angle**: first-person observation (my take) or third-person story (a company or founder)

### Step 2: Fact gate
Use only facts the user gave you or sources they can verify. Never invent statistics, quotes, revenue numbers, dates, or company claims. If a claim is useful but unverified, keep it and tag it `[VERIFY]` so the user checks it before posting.

### Step 3: Pick the structure
Read `references/post-structures.md` and choose the one structure that fits the source and goal. State the choice in one line.

### Step 4: Draft in the owner's voice
Read `references/voice-guide.md` and follow it. If `references/examples.md` has posts by the owner, match their rhythm and word choice over the defaults.

### Step 5: Check
Save the draft to a file and run:
```bash
python3 scripts/post_check.py draft.txt
```
Fix every FAIL and rerun until clean. WARN items are judgment calls: fix them unless the voice guide says otherwise.

### Step 6: Deliver
Output, in this order:
1. **Post**: final text, ready to paste
2. **Two alternative hooks**: different angles, not rewordings
3. **First comment**: one useful addition (a source, a number, or a question), not "thoughts?"
4. **Open items**: every `[VERIFY]` tag and any assumption you made

## Hard rules
- No invented facts, ever.
- The first line must stand alone as a reason to click "see more".
- Maximum 3 hashtags, usually 0 to 2, at the end.
- No engagement bait ("Agree?", "Comment YES", "Tag someone").
- No filler openers ("I'm thrilled to announce", "In today's fast-paced world").
- Write about one idea per post.
