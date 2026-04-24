"""
Router modules for the Eros FastAPI backend.

Pragmatic "late-binding" pattern: each module imports `api_router` (and any
shared helpers it needs) from `server` and registers its routes via the
`@api_router.<verb>` decorators.

Because Python caches modules in `sys.modules`, and these modules are only
imported AFTER `server.py` has defined all its helpers (at the very bottom of
the file), there is no circular import problem.

This is an intentional first step in an incremental refactor: it lets us
split the ~6400 line monolith into focused files WITHOUT untangling shared
helpers (db, auth, audit, moderation, …) all at once. Further refactors can
later migrate helpers into dedicated services modules.
"""
