# Project Guidelines

## Versioning

**NEVER bump the `version` field in `package.json` manually.**

The CI/CD release workflow uses `npm version from-git` to derive the version from git tags. The git tag (e.g., `v0.0.4`) is the single source of truth for published versions.

To release a new version:
1. Push changes to `main` and wait for CI to pass
2. Create a GitHub release with the appropriate tag (e.g., `v0.0.5`)
3. The publish workflow will automatically set the version from the tag and publish to npm
