---
"hoshimi": minor
---

Filters are now active by presence, and any filter can be set — registered or not.

`FilterManager.data` used to start as a clone of `DefaultPlayerFilters` (a neutral `timescale: {1,1,1}`, an all-zero `karaoke`, a full `pluginFilters` tree...) and `commit()` stripped whatever still matched those shapes, deciding "active" through per-filter `isDefault` predicates. Never-set and set-to-something-neutral were indistinguishable on the wire. A key is now present only while its filter is active:

- `data` starts empty, so a fresh commit sends `{}`.
- `isEnabled(name)` is presence — `setVolume(1)` counts as active.
- `clear(name)` and `clearEQBands()` delete the key instead of neutralising it; `reset()` empties the payload.

New `FilterManager.set(name, payload, options?)`, the universal setter `apply(name, payload)` was trying to be. Filters the registry does not know need no registration at all — `SetFilterOptions` picks the envelope, and an explicit option overrides whatever the registry resolved:

```ts
await fm.set("myFilter", { gain: 2 });                              // pluginFilters.myFilter
await fm.set("boost", { gain: 2 }, { plugin: "my-plugin" });        // pluginFilters["my-plugin"].boost
await fm.set("forkEcho", { decay: 0.5 }, { top: true });            // filters.forkEcho
await fm.set(FilterType.Timescale, payload, { validate: false });   // skip the node check
```

`clear`, `isEnabled` and `has` take the same routing options. `apply()` keeps its no-arg commit meaning; the two-argument overload is deprecated in favour of `set`.

**Breaking changes**

- `DefaultPlayerFilters` is gone: with presence semantics there is no neutral payload. `DefaultFilterPreset` and `AudioOutputData` stay.
- Reading `data.timescale.speed` and friends yields `undefined` until the filter is set.
- `FilterRegistration.isDefault` and `defaultPayload` removed (the latter was never read by anything), and the interface is no longer generic.
- `FilterRegistry.isDefault`, `isDefaultFlatPlugin`, `isWireKey`, `getAll`, `getByScope` and `getByPlugin` removed. `isPluginName` and `isKnown` replace what the library actually needed.
- `FilterScope.Vendor`, `FilterRegistration.vendors`, `RegistryVendorName` and `CustomizableVendors` removed. Which server a player talks to is the node's concern: fork filters go top-level through `set(name, payload, { top: true })`, or by registering them with scope `Core`. Nothing is lost for Nodelink, whose filters were top-level already.
- `FilterType.AudioOutput` and `FilterType.Custom` removed: neither named a Lavalink filter nor was registered.
- `EnabledPlayerFilters`, `EnabledLavalinkFilters` and `EnabledDSPXPluginFilters` removed, dead since the toggle object was dropped.
- `defineFilter` is now a deprecated pass-through.
- `heartbeat.statsTimeout` removed from node and manager options. It was plumbed through types, defaults and validation, and documented as a stats watchdog, but nothing ever armed a timer — only the ping/pong heartbeat was implemented.
