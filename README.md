# npmi
> Incremental npm install with downgrade support.

This script is a *much* faster alternative to `npm install` when you want to keep your **node_modules** folder up to date.

## Installing

```shell
npm install -g git+ssh://git@github.com/onefinancial/npmi.git
```

## Usage

Just run `npmi` and this script will take care of the rest!

```shell
cd ~/my/node/project
npmi
```


## Technical details

- The script will first run `npm prune` to clean out unused dependencies.
- For each dependency in `dependencies` and `devDependencies`, it will evaluate if the installed version satisfies the spec. This works for git dependencies that use a version tag!
- All the unsatisfied dependencies are collected together with their specs into a single `npm install` command. For example if the **no-op** and **lodash** modules need updating: `npm install no-op@1.0.0 lodash@^3.0.0`.
