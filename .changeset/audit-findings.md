---
"hoshimi": patch
---

Fixes from an audit of the whole client:

- **Voice**: a `VOICE_STATE_UPDATE` from any other guild member overwrote the player's session id with theirs, because the `user_id` check ran after the first `voice.patch()`. The next `VOICE_SERVER_UPDATE` then built its payload from a foreign session, which Lavalink closes with a 4006.
- **Player**: `move()` threw a `TypeError` whenever `queue.current` was `null` with a non-empty queue — the null filter was `t != null || typeof t !== "undefined"`, which is `true` for `null`. The source filter had the same shape and let `undefined` through into `sourceManagers.includes()`, reporting a missing source manager that did not exist.
- **Storage**: `QueueMemoryStorage.get()` read the raw key while `set`/`has`/`delete` went through `buildKey`, so it never found anything. `QueueUtils.sync()` always threw `StorageError`, which broke `resumeByLibrary` (swallowed as a `nodeError`).
- **Queue**: `save()` measured `tracks.length` to trim the history, dropping entries well within `maxHistory`. `move(track, 0)` sent the track to the end instead of the front. `toJSON()` only threw on invalid tracks when *every* track was invalid, and mutated `this.history` from inside a serializer. `splice()` duplicated the tracks it inserted into an empty queue, and `move()` cost three storage writes and three `queueUpdate` events.
- **Queue writes on track end** were not awaited under `LoopMode.Track`/`Queue`, racing the following `save()`.
- **Search**: a plain `http://host/file.mp3` reached Lavalink with its scheme stripped, because the registered `http` source was parsed off the front of it.
- **Autoplay**: the random index was computed over the unfiltered results and then indexed into the filtered list, so it frequently resolved to `undefined` and queued nothing.
- **Filters**: `commit()` read the advertised list as `info?.filters ?? []` and dropped every top-level filter missing from it, so on a node that had not answered `/v4/info` yet, `reset()`, `clear()`, `setEQBand()` and a bare `apply()` silently sent an empty payload.
- **Rest**: every request logged the `Authorization` header verbatim, putting the node password in the consumer's debug sink.
- **Player storage**: `values()` returned the `internal_*` bookkeeping keys that `keys()`, `entries()` and `all()` filter out.
- **Player**: `skip({ throwError: false })` on an empty queue threw a `ResolveError` — exactly the throw the caller opted out of.
- **Manager**: `init()` accepted the placeholder default client id `"0"`, connecting every node with `User-Id: 0` instead of failing with the intended `ManagerError`.
- **Validation**: numeric options only checked `typeof === "number"`, accepting `NaN`, `Infinity`, negatives and fractions. Those fail silently — `retryAmount: NaN` never reaches `0`, so a node reconnects forever. Ports are now range-checked too.
