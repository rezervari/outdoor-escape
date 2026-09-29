# OUTDOOR ESCAPE — TESTING PLAN

## 1. Local browser testing

Test:
- Chrome desktop;
- Chrome Android;
- Safari iPhone where available.

## 2. PWA tests

Verify:
- manifest;
- installability where supported;
- service worker registration;
- cache behavior;
- reload behavior;
- update behavior.

## 3. State persistence

Test:
- close browser;
- reopen;
- refresh;
- lose connection;
- return to previous screen.

Progress must not be lost unexpectedly.

## 4. GPS tests

Test:
- inside radius;
- outside radius;
- poor accuracy;
- denied permission;
- location unavailable;
- slow GPS acquisition.

Never leave the user without a recovery path.

## 5. Puzzle tests

For every puzzle:
- correct answer;
- incorrect answer;
- case differences;
- whitespace;
- accidental input;
- hint 1;
- hint 2;
- answer reveal;
- penalty;
- replay/reload.

## 6. Outdoor tests

Test in actual locations:
- daylight;
- evening;
- crowds;
- weather variation where practical;
- mobile network variation;
- battery impact.

## 7. UX tests

Observe a person who has not seen the app before.

Do not explain the interface.

Record:
- where they hesitate;
- what they misunderstand;
- where they look for the next action;
- where they ask for help.

## 8. Beta acceptance

A beta run is successful only if the team can complete the game without operator intervention.

Record:
- total time;
- completion rate;
- hints used;
- answer reveals;
- abandoned locations;
- GPS problems;
- unclear instructions;
- technical errors.

## 9. Critical bug definition

Critical:
- game cannot start;
- progress is permanently lost;
- a location cannot be completed;
- correct answer is rejected;
- player can bypass major paid access controls;
- application crashes repeatedly.

Critical bugs block release.
