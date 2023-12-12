# ROAR-query

This web app allows ROAR researcher to query ROAR data based on some simple
queries.

## Notes for maintainers

### Releases

This repository publishes three different kinds of releases:

- Development releases are published with temporary unique URLs for each
submitted pull request (PR).
- Staging releases are published to roar-staging.web.app on every commit to the
main branch.
- Production releases are published on every version tag. So in order to publish
a production release, you must run

```bash
npm version <major|minor|patch>
```

and the npm scripts should take care of the rest. Do this on the main branch
with a clean working directory after all of the changes that you would like to
incorporate have been merged. Therefore a typical workflow would be

1. Open a PR with changes that you would like to make.
2. Inspect those changes in the generated temporary PR link.
3. Merge changes into the main branch.
4. Repeat steps 1-3 for all of the changes that you would like to include in a release.
5. Test the consolidated changes on the staging release.
6. Once satisfied, publish the production release on the main branch using `npm version <major|minor|patch>`.
