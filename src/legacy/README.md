# Legacy modules

Files here are **not imported by the active app**. They are kept for
reference only — historical search orchestrators, source planners, and
ranking experiments that were superseded by the consolidated pipeline:

```
DiscoverPage → useDiscoverSearch
   → discover-cache-selector (DB-first, hard category lock, jitter)
   → search-runner (live append, multi-source)
   → rankResults.enforceDiversity (35% source / 30% brand caps)
   → discover-feed.composeDiscoverGrid (visible window)
```

Do not re-import from `src/legacy/`. If you need behavior from one of
these files, port the relevant function into the active path and delete
the legacy copy on your way out.
