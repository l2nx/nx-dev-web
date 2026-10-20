---
title: Zero-Tick Engine
description: The L2NX Core game loop that sleeps until something happens and then handles it at once, in a fixed order, on one thread per space.
---

## A world that doesn't tick. It reacts.

Every player action, every hit and every buff is handled the moment it happens: no ticks, no races, no idle work.

![Activity over time: a classic build works every 100 ms even when nothing happens, while Zero-Tick stays flat and works only when a hit lands, a buff ends or a player enters](./zero-tick-hero.svg)

**Status:** the engine core is in nx-l2 today, and the world moves onto it step by step. See the
[migration path](/core/architecture/#migration-path).

## Why Zero-Tick

### Faster

Timers, buffs and cooldowns cost several times less than in classic builds.

### No dupes

An item can't end up in two places: inventory changes happen one at a time, on the space's own thread.

![Selling an item to an NPC and trading it away at the same moment: in a classic build one missed lock lets both go through and dupes the item, on the Zero-Tick partition thread the sale runs first and the trade finds no item](./zero-tick-dupe.svg)

### No races

A hit and a Sleep that land at the same moment always resolve the same way, in arrival order. An attack wakes a
sleeping target, so the order decides the fight.

![A mage's Sleep and a warrior's hit on one monster: in a classic build two threads leave the result to chance, on the Zero-Tick partition thread they run in arrival order and the result is the same every time](./zero-tick-race.svg)

### Instant reaction

Nothing waits for "the next tick": an action is handled right away.

### No idle work

Every wake-up is a real event: no empty beats like tick builds, no tasks spinning on empty pools like pool
builds.

### See everything

Where it slows down, in which phase, in which pass: Prometheus metrics out of the box, ready for your Grafana.

### Every bug reproducible

A past fight can be replayed step by step: time and randomness come only from the pass, and the seed is logged.

## Zero-Tick vs classic builds

| Feature                              | Zero-Tick | L2J Mobius | aCis | L2J Server | L2-Scripts line | L2E (Elixir) | Rust rewrite |
| ------------------------------------ | :-------: | :--------: | :--: | :--------: | :-------------: | :----------: | :----------: |
| Wakes only on events, no polling     |     ✓     |     ✗      |  ✗   |     ✗      |        ✗        |      ✗       |      ✗       |
| No locks on game state, one writer   |     ✓     |     ✗      |  ✗   |     ✗      |        ✗        |      ✓       |      —       |
| Dupe-proof by design                 |     ✓     |     ✗      |  ✗   |     ✗      |        ✗        |      —       |      —       |
| Deterministic replay                 |     ✓     |     ✗      |  ✗   |     ✗      |        ✗        |      ✗       |      ✗       |
| Built-in Prometheus metrics          |     ✓     |     ✗      |  ✗   |     ✗      |        ✗        |      ✗       |      ✗       |
| Pass budget with per-phase breakdown |     ✓     |     ✗      |  ✗   |     ✗      |        ✗        |      ✗       |      ✗       |

By the public source code of each family; ✓ yes, ✗ no, — not established. The facts behind every cell are in the
[detailed comparison](#detailed-comparison) under the hood.

## Tick vs Zero-Tick

![A 100 ms tick wakes even when idle and makes an action wait up to 100 ms; Zero-Tick wakes only for real events and handles the action when it arrives](./zero-tick-tick.svg)

A classic server wakes on a fixed tick, for example every 100 ms, and handles whatever piled up since the last one.
It looks like "everything at once", but it is not. An action that arrives just after a tick waits up to 100 ms for the
next one. Inside the tick the events still run one after another, in whatever order they sit in the list. A faster
tick, even 100 times a second, only shortens the wait; it never makes two events simultaneous. Zero-Tick drops the
wait and keeps the order fixed: each event is handled when it arrives, in an order that is the same on every run.

**A tick makes the world wait. Zero-Tick doesn't.**

---

## Under the hood

### How a pass works

A space of the world (a partition) is an event loop on its own thread. Nothing polls it:

1. A Netty IO thread (epoll on Linux) decodes a client packet and puts it into the session's queue.
2. The session's ready flag goes up and the partition inbox receives "this session has input"; if the loop thread is
   parked, `LockSupport.unpark` wakes it.
3. With no input pending, the loop parks in `LockSupport.parkNanos` until the nearest deadline: the next timer or the
   next due periodic system. With nothing due at all, it stays parked.

When it wakes, the loop reads the clock once and runs one pass in a fixed order of six phases:

```mermaid
flowchart TB
  I[Inbox<br/>input and messages] --> D[Deadlines<br/>due timers]
  D --> S[Systems<br/>due periodic systems]
  S --> E[Side effects<br/>deaths, drops, stats]
  E --> R[Replication<br/>what each client sees]
  R --> F[Flush<br/>one write per connection]
```

- **One clock reading per pass.** Every mechanic in the pass sees the same "now", which is what makes a pass
  replayable.
- **Deterministic order.** Due timers run in `(deadline, sequence)` order; the sequence keeps registration order for
  equal deadlines. On an equal deadline a periodic tick (`TICK`) runs before the end of its effect (`END`), so the last
  damage tick of a poison is never lost to the poison expiring.
- **Bursts share a pass.** A pass has a minimum distance to the next one (`pass-min`, see
  [operations](/core/operations/)), so a burst of input arriving within it is handled in one pass instead of many.
- **Same-pass follow-ups.** Work triggered inside a pass (a triggered skill, a death caused by a damage tick) runs in
  the same pass, up to a depth limit, so a trigger chain cannot loop forever.

### Spaces

![The open world as one partition, each instance and olympiad match as its own partition, and global services such as clans, mail, auction and castles as single writers exchanging messages with them](./zero-tick-spaces.svg)

- **The open world is one partition.** It is not cut into regions: sieges load exactly the borders a split would
  create, and splitting a seamless world across writers is the approach that failed in practice.
- **Each instance and each olympiad match is a partition of its own.** They are separate spaces in the game already.
- **Global services** (clans, mail, auction, castles and the siege schedule) are single writers too, each with its own
  inbox. Partitions send them commands and read their state from published snapshots.

**Massive world battles don't slow down the Olympiad.** The world partition has a loop thread of its own, and there is
no global barrier between partitions, so a siege that fills the world pass does not hold up a match. The condition is
enough CPU cores: instances and matches share the remaining loop threads.

### Timer wheel

Timers live on Agrona's `DeadlineTimerWheel`, two per partition (game time and wall-clock time), with a 1 ms tick.
One turn of the wheel holds 1024 ticks, about a second. A deadline in a later turn waits in that turn's bucket, and
the occupied turns are ordered by a fastutil `LongHeapPriorityQueue`; a bucket enters the wheel whole when the cursor
reaches its turn.

The result is that `nextDeadline()` is always exact. An idle partition holding thousands of timers minutes ahead
(respawns, despawns, long buffs) runs no pass until the first of them is due. Cancelling a timer costs nothing on the
wheel: a stale entry is ignored when it fires.

### Input signal

- **One ready signal per session.** The producer enqueues, issues a full fence (`VarHandle.fullFence()`) and posts
  "has input" only when the session's flag was clear. The partition clears the flag once the queue is empty, issues a
  full fence and checks the queue again. With fences on both sides, an item offered while the flag is being cleared
  is never left in the queue unsignalled.
- **Strict arrival order per client,** with round-robin across sessions and a per-pass limit, so a flooding client
  delays only itself.
- **A failing item costs only itself.** The item is taken off the queue, recorded and then run; a handler that throws
  is reported and the rest of the pass goes on.
- **Recording never blocks game work.** If the recorder fails, the failure is reported and the work still runs; only
  the replay of that pass is incomplete.

### Benchmarks

Measured on an AMD Ryzen 5 5600X, JDK 25, Linux in Docker on WSL2, which is a virtual machine; absolute numbers on
bare metal differ, the ratios are what matters.

**Cost per timer,** scheduled and fired in a batch, ns per timer, with 1 000 / 100 000 / 1 000 000 other timers
pending:

| Scheduler                                                         | 1 000 | 100 000 | 1 000 000 |
| ----------------------------------------------------------------- | ----: | ------: | --------: |
| Zero-Tick timer wheel                                             |   253 |     254 |       255 |
| `ScheduledThreadPoolExecutor`, 1 worker                           |   436 |     501 |       569 |
| `ScheduledThreadPoolExecutor`, 4 workers                          |   549 |     623 |       739 |
| `ScheduledThreadPoolExecutor`, L2J Mobius default (4 per CPU, 24) |  4104 |    4215 |      3598 |

The wheel costs about 255 ns per timer whether 1 000 or 1 000 000 others are pending: about twice as cheap as a pool
tuned at its best (one worker) and 14–17 times cheaper than the L2J Mobius default of four workers per CPU, whose
workers fight over one queue lock. More workers make the pool slower, not faster; the same contention makes the
Mobius figure vary widely from run to run.

**Idle world:** no player online, each NPC holds a respawn-like timer due about once a minute (30–90 s).

| Scheduler   | Wake-ups/s, 1 000 NPCs | Wake-ups/s, 10 000 NPCs | CPU ms/s, 1 000 NPCs | CPU ms/s, 10 000 NPCs |
| ----------- | ---------------------: | ----------------------: | -------------------: | --------------------: |
| Zero-Tick   |                     16 |                     150 |                  1.0 |                   4.1 |
| L2J Mobius  |                     28 |                     275 |                  4.7 |                  16.9 |
| 100 ms tick |                     10 |                      10 |                 0.38 |                  0.55 |

Zero-Tick wakes once per due timer. L2J Mobius runs the same timers and adds 11 fixed-rate AI and movement tasks per
1 000 NPCs every second, firing on empty pools; it already parks the AI of an NPC with no player in sight, which keeps
that number small. A tick wakes 10 times a second regardless and is the cheapest when idle; it pays in latency.

**Firing lateness** of timers with spread deadlines, and CPU per fired timer:

| Scheduler       |     p50 |     p99 | CPU per timer |
| --------------- | ------: | ------: | ------------: |
| Zero-Tick       |  0.9 ms |  1.5 ms |        2.2 µs |
| L2J Mobius pool | 0.09 ms | 0.15 ms |       23.7 µs |
| 100 ms tick     |   50 ms |   99 ms |       0.19 µs |

Zero-Tick fires 0.9 ms late at p50 against 50 ms on a 100 ms tick. The Mobius pool fires closer, about 0.1 ms, at
about eleven times the CPU per timer; for a game, a millisecond is below perception.

How to run:

```sh
./gradlew :engine:core:jmhJar
java -jar engine/core/build/libs/engine-core-jmh.jar TimerComparisonBenchmark
java -jar engine/core/build/libs/engine-core-jmh.jar IdleWakeupBenchmark
java -cp engine/core/build/libs/engine-core-jmh.jar app.l2nx.engine.core.loop.LatenessHarness
```

`LatenessHarness` is a plain main class, not JMH: it reports a distribution of a value measured inside the run.
Run one scheduler per JVM with `scheduler=ZERO_TICK`, `MOBIUS_STPE` or `TICK_100MS`.

### Detailed comparison

| Family                          | Execution model                                                                                         | Polling periods                                                                                                        | Locking                                                   | Metrics                                   | Determinism                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------- | --------------------------------------- |
| Zero-Tick                       | one event loop per partition, timer wheel, single writer                                                | none: wakes on input, deadline or due system                                                                           | none on game state                                        | Micrometer per pass and phase, Prometheus | seeded RNG, clock per pass, replay      |
| L2J Mobius                      | shared `ScheduledThreadPoolExecutor` (4 threads per CPU) plus an instant pool, fixed-rate task managers | AI 1000 ms, movement 100 ms (creatures) and 50 ms (players), game time 10 ticks/s, decay, respawn and autosave 1000 ms | about 220 `synchronized` sites, region activity switching | none; a deadlock watcher                  | `ThreadLocalRandom`, no seed, no replay |
| aCis                            | one scheduled pool (one thread per CPU) on virtual threads, a fixed-rate task per object                | AI 1000 ms                                                                                                             | about 150 `synchronized` sites                            | none                                      | none                                    |
| L2J Server                      | four scheduled pools (effects, general, AI, events), a game-time thread                                 | 10 ticks/s for movement, AI task per attackable 1000 ms                                                                | `synchronized` in about 110 files                         | none                                      | none                                    |
| L2jFrozen-style Interlude forks | the L2J design: effects, general and AI pools plus packet pools                                         | timer thread 10 ticks/s, AI 1000 ms                                                                                    | `synchronized`                                            | pool dumps, deadlock detector             | none                                    |
| L2-Scripts line                 | a scheduled pool (4 threads per CPU) plus a worker pool, a stepping AI task manager                     | AI step 250 ms, NPC AI delay 1000 ms                                                                                   | `ReentrantLock` and `synchronized`                        | telnet status and pool dumps              | none                                    |
| L2E (Elixir)                    | a process per entity, `send_after` timers, message passing                                              | regeneration every 3 s                                                                                                 | none: no shared state                                     | none                                      | `:rand` without a seed                  |
| Rust rewrite                    | async per-client tasks on tokio                                                                         | 300 ms interval                                                                                                        | async tasks                                               | none                                      | none                                    |

No public tree of these families exports Micrometer, Prometheus or OpenTelemetry metrics, and none logs a seed or
replays a session.

### Honest limits

- **Cross-partition messages take one pass.** A command from the world to a global service is handled in that service's
  next pass, and its result in the world's next pass after that. The order is deterministic, but it is not
  simultaneous.
- **An overloaded pass slows its own partition.** A partition is one thread, so a heavy pass delays everything in it.
  The pass budget (`pass-budget`), the per-phase metrics and the over-budget counter exist to see that and fix it by
  profiling.
- **Open work:**
  - input ordered against due timers by arrival time ([#45](https://github.com/l2nx/nx-l2/issues/45));
  - replay recording in production ([#44](https://github.com/l2nx/nx-l2/issues/44));
  - runtime start between data load and port open ([#43](https://github.com/l2nx/nx-l2/issues/43)).
- **The world still runs on the imported Mobius threading model** while it migrates onto Zero-Tick. The
  [migration path](/core/architecture/#migration-path) shows the order: the open world becomes a single writer first,
  then subsystems move to partition deadlines one at a time, and instances and olympiad matches get their own
  partitions.

## Read more

- [Architecture](/core/architecture/): partitions, the entity model, replication, persistence and the migration path.
- [Engine research](/core/engine-research/): tick models, timer wheels, actors and how mature MMO servers are built.
