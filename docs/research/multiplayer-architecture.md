# Research: Multiplayer Architecture for Dustfall

**Researched**: 2026-07-17
**Trigger**: Design decision support — GDD currently says "solo by design"; owner considering reversal
**Depth**: medium

## Summary

Dustfall's deterministic seeded-generation architecture is unusually well-suited to co-op multiplayer: clients generate identical worlds locally, so only player inputs, creature AI, and chunk-diff writes need network sync—not terrain. A 2-4 player MVP can use **P2P host-authoritative** (one player hosts, others join directly) with a **thin relay fallback** for NAT traversal, eliminating server infrastructure for hobby scale. For larger scope or persistence guarantees, **Colyseus** (hosted Node.js state server) or **nengi** (custom WebSocket) trade zero infrastructure cost for per-player frame-sync overhead; rollback netcode is overkill for co-op (reserved for fighting games).

## Key findings

1. **Deterministic world generation is the critical advantage** — Each client can locally generate identical terrain/POI/creatures from a shared seed, so bandwidth is inputs-only (~8–13 KBps per player with binary encoding). This is the same lockstep strategy used in RTS and strategy co-op games; Dustfall's existing `chunkDiffs` architecture maps cleanly to shared-world multiplayer. — [Daydreamsoft: Deterministic Simulation for Lockstep](https://www.daydreamsoft.com/blog/deterministic-simulation-for-lockstep-multiplayer-engines), [Mas-Bandwidth: Choosing Network Models](https://mas-bandwidth.com/choosing-the-right-network-model-for-your-multiplayer-game/)

2. **P2P host-authoritative (one player hosts) is zero-infrastructure for 2–4 players** — One player's client becomes the authoritative host for world state + creatures + diffs; others connect directly or via relay. Host migration (replacing the host if they disconnect) requires ~$15k/month dev cost to implement and adds complexity; better to just end session on host disconnect for MVP. — [Edgegap/Highwire: P2P vs Relay vs Dedicated Cost Analysis](https://edgegap.com/blog/live-multiplayer-games-p2p-host-migration-a-technical-cost-analysis-of-backend-infrastructures-presentation-by-michal-buras-(lead-network-engineer-at-highwire-games))

3. **Relay servers (not P2P direct) are practical for browser** — WebRTC peer-to-peer has 90%+ success rate *if* a TURN relay backs up failed direct connections. Browser clients can't always connect peer-to-peer due to NAT/firewalls. Relay introduces ~20–50ms extra latency but is acceptable for co-op. Epic Online Services or Xirsys provide STUN/TURN. — [Edgegap: WebRTC Relays](https://edgegap.com/blog/webrtc-relays-for-multiplayer-games), [AccelByte: P2P vs Relay vs Dedicated](https://accelbyte.io/blog/p2p-vs-relay-vs-dedicated-servers)

4. **Colyseus is the managed-server option** — Authoritative Node.js server handles world state + diffs + creature AI; clients send inputs and receive delta-compressed state snapshots. No bandwidth calculation given in docs, but server-driven architecture means server scales state across N players. Horizontal scaling via Redis; managed cloud available. Fits 8+ players better than P2P. — [Colyseus.io](https://colyseus.io/), [Colyseus Docs](https://docs.colyseus.io/)

5. **nengi is a lightweight WebSocket-first alternative** — Handles 100+ players or 50k+ entities on a 20-tick server. Lets you define exactly what to network per object (Entity protocol). Lower barrier than Colyseus if you want a custom-rolled solution without managed cloud. Stable branch on Node 14+; experimental branch (sixteen) uses uWS for newer Node. — [nengi on GitHub](https://github.com/timetocode/nengi), [nengi docs](https://timetocode.com/nengi)

6. **Player saves vs world saves need different ownership** — Palworld/Windrose pattern: character progress (inventory, stats) is player-owned and travels between worlds; world state (buildings, diffs, creature spawns) is world-owned. For Dustfall co-op: either one player's localStorage holds the world save (P2P), or the server does (Colyseus). Each player can have a solo profile + a co-op profile. — [Palworld migration guide](https://winternode.com/blog/palworld/palworld-server-migration-moving-from-local-to-dedicated-without), [Windrose multiplayer guide](https://egamersworld.com/blog/windrose-multiplayer-server-guide-co-op-dedicated--VCIzmoRLF)

7. **Rollback netcode is fighting-game overhead, not needed for co-op survival** — Rollback (predicting inputs, rolling back when corrected) adds CPU cost + complexity; it's essential for low-latency 1v1 fighting games. For co-op survival, occasional creature/physics hiccups on 100–200ms latency are acceptable. Use it only if targeting 50+ ms latency + twitch-combat required. — [Rollback Netcode Explained](https://easel.games/docs/learn/multiplayer/rollback-netcode), [Mas-Bandwidth: GGPO-Style Rollback](https://mas-bandwidth.com/choosing-the-right-network-model-for-your-multiplayer-game/)

## Actionable takeaways

For Dustfall's 2–4 player co-op MVP:

- **Start with P2P host-auth + relay.** One player's browser hosts the world + creatures + diffs. Use a WebRTC DataChannel or WebSocket relay (Epic Online Services, Xirsys, or a $5/mo Heroku dyno) for NAT fallback. No server maintenance, minimal dev cost.

- **Authority assignment:** Host owns world state (chunk generation, diffs, creature spawns, weather). Each client owns their own player transform/input + receives creature AI from host. Physics objects are host-authoritative (client inputs predict locally, host corrects). Diffs are host-authoritative and synced to all clients.

- **Persistence strategy:** World save lives in host's localStorage (P2P MVP) or server database (later scaling). Player profile (stats, inventory across sessions) is stored per-player locally + synced to host at join/save.

- **Bandwidth target:** Binary-encoded input + diff packets ~10 KBps per player (3–4 updates/sec). Creature updates delta-compressed from host. Aim for <50ms latency via relay.

- **Scale decision gate:** If you exceed ~16 players or want persistent worlds without a host player, migrate to Colyseus. If staying P2P, add host-migration as a post-MVP tier (expensive, deferred).

## Contrarian or surprising

- **Deterministic generation is actually an advantage**, not a constraint. Most multiplayer games must sync all terrain/object placement from server; Dustfall generates it locally on each client, eliminating that bandwidth. RTS games (StarCraft, Age of Empires) use this exact pattern.

- **Host migration is expensive and should be deferred.** Common assumption: P2P always needs host migration. Reality: Highwire Games (Insurgency: Sandstorm) found host migration requires $15k/month ongoing dev cost and still produces poor UX when host leaves. For casual co-op, session-end-on-host-disconnect is acceptable MVP.

- **Relay is better than direct P2P for browser.** WebRTC direct connection succeeds 90% of the time; the other 10% fail silently. Relay ensures 99%+ success at cost of ~20–50ms latency. This is why game consoles and browsers lean on relays, not P2P direct.

## Sources

- [Colyseus: Multiplayer Framework](https://colyseus.io/)
- [Colyseus Documentation](https://docs.colyseus.io/)
- [nengi.js Multiplayer Engine](https://timetocode.com/nengi)
- [nengi on GitHub](https://github.com/timetocode/nengi)
- [Daydreamsoft: Deterministic Simulation for Lockstep Multiplayer Engines](https://www.daydreamsoft.com/blog/deterministic-simulation-for-lockstep-multiplayer-engines)
- [Mas-Bandwidth: Choosing the Right Network Model for Multiplayer Games](https://mas-bandwidth.com/choosing-the-right-network-model-for-your-multiplayer-game/)
- [Edgegap: P2P vs Relay vs Dedicated Servers – Cost Analysis](https://edgegap.com/blog/live-multiplayer-games-p2p-host-migration-a-technical-cost-analysis-of-backend-infrastructures-presentation-by-michal-buras-(lead-network-engineer-at-highwire-games))
- [Edgegap: WebRTC Relays for Multiplayer Games](https://edgegap.com/blog/webrtc-relays-for-multiplayer-games)
- [AccelByte: P2P vs Relay vs Dedicated Servers](https://accelbyte.io/blog/p2p-vs-relay-vs-dedicated-servers)
- [Pusher: WebSockets in Real-Time Gaming](https://pusher.com/blog/websockets-realtime-gaming-low-latency/)
- [Playgama: WebSockets for Game Development](https://playgama.com/blog/general/understanding-websockets-a-beginners-guide-for-game-development/)
- [Rollback Netcode Explained](https://easel.games/docs/learn/multiplayer/rollback-netcode)
- [Palworld Server Migration Guide](https://winternode.com/blog/palworld/palworld-server-migration-moving-from-local-to-dedicated-without)
- [Windrose Multiplayer & Server Guide](https://egamersworld.com/blog/windrose-multiplayer-server-guide-co-op-dedicated--VCIzmoRLF)
