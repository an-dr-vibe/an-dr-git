# Project Philosophy

This is the highest-level decision filter for `an-dr-git`.

Use it to guide:

- product direction
- team behavior
- architecture choices
- implementation tradeoffs
- review decisions

## The Rules

0. Reasoning and evidence over tradition.
   Choose approaches because they are logical, current, and proven in practice.
   When modernity and maturity conflict, prefer the option with stronger evidence, lower risk, and clearer long-term maintainability.

1. Truth over convenience.
   The app must reflect real Git behavior, not a simplified fiction.

2. Depth over breadth.
   Make the core workflows excellent before adding more features.

3. Feedback over assumption.
   Every meaningful change must close a verification loop: implement, test, review, and document.

4. Quality is part of the feature.
   Code quality, UI quality, UX quality, and documentation quality are required work, not optional polish.

5. Clarity over complexity.
   Choose the simplest cross-platform solution that stays reliable, explainable, and maintainable.

## How To Use It

When choosing between options, prefer the one that better matches these rules.
