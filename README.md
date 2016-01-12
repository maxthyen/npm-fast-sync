# npm-fast-sync
> Incremental npm install with downgrade support.

This script is a *much* faster alternative to `npm install` when you want to keep your **node_modules** folder up to date.

It will upgrade/downgrade all modules in **dependencies** and **devDependencies** that do not satisfy the [semver](http://semver.org/) spec. This also works for git dependencies that are tagged with the version number like so:

```
git+ssh://git@github.com/private-company/private-module.git#3.2.1
```

## Installing

```shell
npm install -g git+ssh://git@github.com/onefinancial/npm-fast-sync.git
```

## Usage

Just run `npm-fast-sync` and this script will take care of the rest!

```shell
cd ~/my/node/project
npm-fast-sync
```


## Technical details

- The script will first run `npm prune` to clean out unused dependencies.
- For each dependency in `dependencies` and `devDependencies`, it will evaluate if the installed version satisfies the spec.
- All the unsatisfied dependencies are collected together with their specs into a single `npm install` command. For example if the **no-op** and **lodash** modules need updating: `npm install no-op@1.0.0 lodash@^3.0.0`.
