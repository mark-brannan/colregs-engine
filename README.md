# colregs-engine

Applicability evaluator over the
[colregs](https://github.com/mark-brannan/colregs) data package: predicates
over a fact record → applicable entries → relations resolved (`includes`,
`conditional_includes`, `in_lieu_of`, `excludes`, `exempts`) → the set of
complete lawful displays. Alternatives stay unresolved: every lawful option
is returned; the engine never picks one. Verified by replaying the package's
`fixtures/applicability-fixtures.json` verbatim.

**Status: name staked, not yet started.** The engine is being built inside
[searoom](https://github.com/mark-brannan/searoom) first and will be
extracted here once it earns a second consumer.
