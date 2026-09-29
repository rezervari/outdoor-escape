# OUTDOOR ESCAPE — GAME DESIGN SPECIFICATION

## Purpose

This document defines how the first Brașov game should be designed before implementation.

## 1. Game identity

Working title:
Tainele Breslei Pierdute din Kronstadt

Status:
WORKING TITLE — NOT FINAL

Genre:
Outdoor mystery hunt / digital escape room

Players:
2–4 per team

Target duration:
90–120 minutes

Target route:
2.5–3.5 km

## 2. Narrative principles

The story should:
- make players curious;
- create a reason to move through the city;
- reward observation;
- connect locations into one mystery;
- end with a satisfying resolution.

Avoid:
- generic tourist trivia;
- puzzles unrelated to the story;
- arbitrary walking between locations;
- clues that depend on temporary objects.

## 3. Location selection criteria

A location is suitable when:
- it is publicly accessible;
- it is reasonably safe;
- it is visually identifiable;
- important features are relatively permanent;
- GPS can be used with reasonable tolerance;
- players can stop without blocking pedestrian traffic;
- it works during the expected playing hours.

Avoid clues based on:
- parked cars;
- temporary signs;
- seasonal decorations;
- commercial advertisements;
- objects likely to disappear.

## 4. Puzzle principles

Puzzle types may include:
- visual observation;
- counting;
- sequence recognition;
- substitution cipher;
- anagram;
- orientation;
- spatial relationships;
- historical clue;
- symbol matching;
- wordplay.

Each puzzle must have:
- clear objective;
- answer;
- validation rule;
- hint 1;
- hint 2;
- optional answer reveal;
- penalty definition.

## 5. Difficulty curve

Early:
easy onboarding.

Middle:
moderate difficulty.

Late:
higher synthesis / combination.

The game should not depend on a single exceptionally difficult puzzle.

## 6. Hints

Hint 1:
small nudge.

Hint 2:
stronger direction.

Answer reveal:
complete solution.

Penalties should be documented and consistent.

## 7. Field-first rule

Every puzzle must be tested at the actual location.

The author must verify:
- what the player sees;
- whether the clue is readable;
- whether the clue is ambiguous;
- whether the feature is permanent;
- whether multiple interpretations exist.

## 8. Historical verification

Create a source note for each historical claim.

Example:

Claim:
[historical statement]

Source:
[reliable source]

Status:
VERIFIED / NEEDS VERIFICATION

## 9. Location record template

ID:
Name:
Coordinates:
GPS radius:
Player-visible landmark:
Narrative role:
Puzzle:
Hint 1:
Hint 2:
Answer:
Penalty:
Fallback:
Safety/access notes:
Historical claims:
Verification sources:

## 10. Pre-coding rule

The full game should be playable on paper before the software is considered complete.

This catches bad puzzle design before technical implementation.
