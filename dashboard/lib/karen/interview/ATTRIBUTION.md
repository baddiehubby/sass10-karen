# Attribution — interview methodology

Portions of Karen’s interviewer engine adapt the conversational methodology from:

**interview-my-project**  
https://github.com/WarlCang/interview-my-project  
Copyright (c) 2026 Carl Wang  
Licensed under the MIT License

## What was adapted

From the reference skill (not vendored as markdown):

- Bounded context ingestion before questioning
- Ranked probe bank with discard-below-threshold
- Surface → Push → Floor follow-up ladder
- Honest weak-answer requeuing across sessions
- Per-session scorecard / readiness tracking

## What changed for Karen

- Domain remapped from “defend your codebase” to “daily life, habits, goals, excuses, commitments”
- Persona is Karen (sweet / sarcastic / annoyed / furious), not the skeptical staff interviewer
- Runs inside BuddieAI’s existing intelligence, memory, auth, and billing stack — no duplicate AI infrastructure
- Buddy remains the original warm companion; Karen is a distinct premium mode

## MIT License (required notice)

```
MIT License

Copyright (c) 2026 Carl Wang

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
