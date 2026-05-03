---
title: "The Forgetting Curve and N+2 Review — Meeting Material Just Before You Forget"
date: "2026-05-03"
description: "Ebbinghaus's forgetting curve has been validated for over a century. Here is how the principle translates to note-recognition learning, and what an N+2 re-presentation logic is designed to achieve."
keywords: ["forgetting curve", "Ebbinghaus", "spaced repetition", "music learning", "note recognition"]
slug: "forgetting-curve-and-spaced-repetition"
category: "Music Tech"
day: 4
---

That learning fades after a delay is intuitively familiar. Words memorized yesterday don't surface today. Musical patterns rehearsed last month feel half-absent when a new piece arrives. Every learner has lived through this.

What matters here is that the pattern of forgetting is not random. It has a shape, and once that shape is known, learning schedules can be designed around it.

![Ebbinghaus forgetting curve](https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Ebbinghaus_curve.png/330px-Ebbinghaus_curve.png)
*Figure 1: The Ebbinghaus forgetting curve — steepest immediately after learning, flattening over time. Source: Wikimedia Commons / Public Domain*

## 📉 What Ebbinghaus found

In 1885 the German psychologist Hermann Ebbinghaus published *Über das Gedächtnis* (English translation: *Memory: A Contribution to Experimental Psychology*, 1913), in which he tested himself on nonsense syllables and measured recall accuracy after various time intervals.

The findings:

- **Forgetting is fastest right after learning** — about 40% or more of newly learned material is lost within twenty minutes.
- **The forgetting rate slows over time** — material that survives a day fades more slowly the next day, even more slowly after a week.
- **Re-learning effect** — restudying near the point of forgetting flattens subsequent forgetting. Each successive review yields a slower decay curve.

These results have been confirmed for over a century across language learning, mental arithmetic, and motor patterns. Cepeda et al. (2006), in a meta-analysis of distributed practice, reported a consistent advantage for spaced repetition over massed practice.

## 🎯 Translating this to music

Applying the forgetting curve to music learning raises specific questions:

- After a note position is learned, when should it next appear for greatest effect?
- Too soon? — forgetting hasn't begun, so the re-learning gain is small.
- Too late? — the position is already largely forgotten and must be relearned from scratch.

The aim is to encounter the material **just as forgetting starts but before it has consolidated**. That window is where learning efficiency peaks. Every spaced-repetition system targets this point, in some form.

## 🔢 The N+2 logic

A simple form usable in note-recognition training is **N+2 re-presentation**.

- The learner answers note position A (time N).
- The next two questions (B and C) cover different positions.
- The third question (time N+2) returns to position A.

This logic has practical advantages:

- **Not too close** — at N+1, the learner could answer from short-term memory, providing little automatization gain.
- **Not too far** — at N+5 or N+10, intervening information dilutes the targeted re-exposure.
- **Guaranteed exposure for weak positions** — when a learner meets a weak note, the N+2 follow-up rapidly raises automatization for that position.

This is why the same note does not appear back-to-back in a Noteflex session, yet returns within a few questions.

## 🧠 Combined with weight-based prioritization

N+2 alone is not enough. Applying N+2 uniformly to every position wastes time on already-automatic positions. Weighting helps:

- **Slower response time → higher weight** — a position averaging 1.5 seconds is re-presented more often than one at 0.4 seconds.
- **Wrong answer → additional weight** — positions where errors occur get priority on the next N+2 cycle.
- **Automatic positions → reduced weight** — once a position drops below a target average response time, its presentation frequency falls automatically.

Where the forgetting curve meets weighted exposure, personalized note training becomes possible. The presentation distribution fits the individual learner rather than the average.

## ⚠️ Limits and honest scope

The N+2 logic is useful but not universal.

- **Not for musical flow training** — real pieces present notes in a musical sequence. N+2 logic is optimized for single-note automatization; learning musical flow requires different approaches.
- **Doesn't cover the full forgetting curve** — N+2 is short-interval review. Genuine spaced-repetition systems (Anki, SuperMemo's SM-2 algorithm) handle day-, week-, and month-scale intervals as well. Noteflex focuses primarily on short-term automatization, with longer-term spacing as a future area.
- **Individual variation is large** — forgetting rates differ across learners. The same N+2 spacing may be short for one user and well-tuned for another. Personalization through accumulated data is the next step.

The forgetting curve is a discovery from over a century ago, but it remains a useful starting point for learning-tool design. Choosing when a note is presented again based on a forgetting pattern, rather than at random, is one of the foundations of data-informed learning.

## References

1. Ebbinghaus, H. (1913). *Memory: A Contribution to Experimental Psychology* (H. A. Ruger & C. E. Bussenius, Trans.). Teachers College, Columbia University. (Original work published 1885)

2. Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. *Psychological Bulletin*, 132(3), 354–380.

### Image credits
- Figure 1: Wikimedia Commons / Public Domain — Ebbinghaus forgetting curve
