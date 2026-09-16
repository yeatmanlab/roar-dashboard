---
title: OpenFGA CLI Usage
impact: HIGH
impactDescription: validation workflow
tags: testing, cli, validation, workflow
---

## OpenFGA CLI Usage

Use the OpenFGA CLI to validate and test your models.

**MANDATORY**: Always run `fga model test` after creating or modifying any `.fga` or `.fga.yaml` file. Do not consider any OpenFGA task complete until tests pass.

Use the OpenFGA CLI to validate and test your models.

**Installation:**

```bash
# macOS
brew install openfga/tap/fga

# Debian
sudo apt install ./fga_<version>_linux_<arch>.deb

# Docker
docker pull openfga/cli
docker run -it openfga/cli
```

**Validate model syntax:**

```bash
fga model validate --file model.fga
```

**Run tests:**

```bash
fga model test --tests model.fga.yaml
```

**Transform between formats:**

```bash
# DSL to JSON
fga model transform --input model.fga --output model.json

# JSON to DSL
fga model transform --input model.json --output model.fga
```

**Example test run:**

```bash
$ fga model test --tests authorization.fga.yaml
# Test Summary #
Tests 1/1 passing
Checks 5/5 passing
```

**CI/CD integration:**

```bash
# Fail the build if tests don't pass
fga model test --tests authorization.fga.yaml || exit 1
```

You can also use the [OpenFGA Model Test GitHub actions](https://github.com/marketplace/actions/openfga-model-testing-action). 

**Verbose output for debugging:**

```bash
fga model test --tests authorization.fga.yaml --verbose
```
