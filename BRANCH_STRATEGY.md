## PMtool GitFlow Branch Strategy

| Branch | Purpose | Deploys To |
|--------|---------|------------|
| main | Production-ready code | Firebase Hosting (pmtool-3f8db) |
| develop | Integration branch | GitHub CI only (Emulator tests) |
| feature/* | Feature work | Local only |
| release/* | Release candidate | Firebase Hosting Preview Channel |
| hotfix/* | Emergency prod fix | Firebase Hosting (pmtool-3f8db) after PR |
