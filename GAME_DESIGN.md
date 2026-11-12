# Ace of the Front

**There are plenty of good pilots. Then you meet an ace.**

A brisk, browser-based side-scroller set over a fictional Western Front in
1917. You fly a British biplane, knock down German aircraft, slip beneath
barrage balloons, and skim rolling, tree-lined hills. Surviving the patrol
earns you a duel with someone who flies very differently.

## The promise

Regular pilots test your reactions. Aces test your nerve and your ability to
read an opponent. Every ace must feel formidable, but fair: a visible wind-up,
a recognizable attack, and a chance to dodge and return fire. No unavoidable
hits, surprise instant kills, or historical knowledge required.

## Moment to moment

- The world scrolls left; your plane stays toward the left of the screen.
  Up/down or W/S change altitude. Hold Space to fire forward.
- Fight ordinary aircraft while choosing a safe corridor between balloons
  above and hills and trees below. Balloon cables are decorative in this
  prototype; only balloon bodies collide.
- Shots are unlimited. Staying lined up scores hits, but staying still makes
  you an easy target. Your aircraft has five hull points, a short grace
  period after damage, and a clear damage flash.
- Patrols last roughly 40–50 seconds. A warning introduces the ace; escorts,
  bullets, and balloons clear so the duel is about the rival, not clutter.
- Beat the ace to bank your score, repair two hull points, and choose to
  launch the next mission. On defeat, immediately retry the same mission
  with full hull and your previously banked score.

## First four missions

| Mission | Patrol lesson | Fictional ace | Signature |
| --- | --- | --- | --- |
| 1. First light | Altitude, gunnery, and generous gaps | Otto “Needle” Weiss | A deliberate, telegraphed aimed shot |
| 2. Balloon alley | Tighter gaps and tougher patrols | Emil “Rook” Adler | Three-shot fan; move through the openings |
| 3. Low country | Faster escorts and more terrain pressure | Kurt “Viper” Falk | A locked-direction burst; dodge once, hold your nerve |
| 4. The red horizon | Combine everything learned | The Crimson Baron | Alternates aimed volleys and broad fans |

After mission four, repeat the roster as veteran sorties with higher pressure.
Spawn rates, shot speed, enemy durability, and ace health scale with mission,
but speed and density are capped to retain readable, survivable play. Ace
health has a second-half enrage: shorter recovery, not an unannounced new rule.

## Ace encounter grammar

1. **Arrival:** a short introduction, name, and tell. Time to reposition.
2. **Read:** amber aiming lines lock the intended firing direction.
3. **React:** a bright muzzle flash releases the advertised pattern.
4. **Punish:** the ace recovers while you seek a firing line.
5. **Adapt:** below half hull, the same patterns come faster.

Movement profiles differ as well as weapon patterns. Higher-tier aces move
farther and faster vertically. There is always room above the terrain and
below the balloon belt to evade. Hitboxes are intentionally smaller than
the plane illustrations.

## Rewards and difficulty

Ordinary aircraft: 100 points, armored aircraft: 175. An ace earns 1,000 plus
250 per mission. A perfect patrol is its own advantage: more hull remains
for the duel. A browser-local best score supplies a replay target without
accounts, leaderboards, or network dependencies.

The opening mission is an onboarding flight, not a tutorial wall. Early
enemies wait before shooting. Retry is unlimited; there are no lives to buy,
grinding, or progress penalties beyond unbanked points. A new campaign
starts from mission one on page reload; only the best score is persisted.

## Prototype boundary

Included: keyboard play, synthesized placeholder sound, vector silhouettes,
four ace patterns, endless capped progression, scoring, hull, repairs,
retry, pause, automatic pause on focus loss, and local best score.

Not yet: touch controls, authentic aircraft art or audio, historical aces,
campaign saves, gamepad support, upgrades, cloud services, or multiplayer.
This is an arcade interpretation, not a flight or historical simulation.
There are no ground targets or depictions of casualties.

## Technical shape

Python serves packaged static assets with its standard-library HTTP server,
launched and managed through `uv`. The browser runs the frame-by-frame game
using Canvas and native ES modules; sending gameplay frames through Python
would add latency without helping this single-player game.

The simulation is independent of drawing and audio, accepts a seeded random
source for tests, and emits events for presentation. Rendering uses a fixed
logical 1100×620 playfield, scaled to the viewport. No external art, fonts,
CDNs, runtime libraries, or internet connection are required after setup.

## Playtest questions

Can a new pilot understand the first ace's tell after one attempt? Does
moving for a firing line feel worth the risk? Are deaths attributable to a
visible threat? Tune patrol length, warning time, and ace recovery before
investing in final assets. The next design milestone is playtesting all four
duels, then adding mission variety rather than more controls.
