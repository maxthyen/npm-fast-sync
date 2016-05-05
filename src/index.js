import _ from 'lodash';
import childProcess from 'child_process';
import fs from 'fs';
import path from 'path';
import rimraf from 'rimraf';
import Rx from 'rx';
import semver from 'semver';
import assignPolyfill from 'es6-object-assign';

// polyfill Object.assign for legacy versions of node.
assignPolyfill.polyfill();

Rx.config.longStackSupport = true;

// Wrap some node functions to give observable versions.
const readFileRx = Rx.Observable.fromNodeCallback(fs.readFile);

const rimrafRx = Rx.Observable.fromNodeCallback(rimraf);

const spawnRx = (command, args) => Rx.Observable.create((o) => {
  let errored = false;
  childProcess.spawn(command, args, {env: process.env, stdio: 'inherit'})
  .on('error', (err) => {
    errored = true;
    o.onError(err);
  })
  .on('exit', (err) => {
    if (errored) {
      return;
    }
    if (err) {
      o.onError(err);
    }
    else {
      o.onNext(`✓ ${command} ${args.join(' ')}`);
      o.onCompleted();
    }
  });
});

const parseJson = (data) => JSON.parse(data);

// Take package data and spit out a merged version of all its deps.
const mergePackageDeps = (packageJson) =>
  Object.assign({}, packageJson.devDependencies, packageJson.dependencies);

const getPackageVersion = _.partial(_.get, _, 'version');

// Take a tuple of [moduleName, spec], and returns a tuple of [moduleName,
// installSpec, versionSpec], where installSpec is the arg to pass to
// `npm install` and versionSpec is the actual semver spec.
const validateSpec = ([moduleName, spec]) => {
  if (_.contains(spec, '#')) {
    return [moduleName, spec, semver.valid(spec.split('#')[1])];
  }
  return [moduleName, `${moduleName}@${spec}`, spec];
};

// Given a module name go into node_modules and return the installed module's
// version or `null` if it isn't installed.
const getDepVersion = ([moduleName]) =>
  readFileRx(path.join(
    process.cwd(),
    'node_modules',
    moduleName,
    'package.json'
  ))
  .catch(Rx.Observable.return(null))
  .select(parseJson)
  .select(getPackageVersion);

// Go through package.json and run `npm install` for all unsatisfied deps.
const installUnsatisfied = readFileRx(path.join(process.cwd(), 'package.json'))
.catch(err => {
  console.error('could not read package.json!', err);
  return Rx.Observable.empty();
})
.select(parseJson)
.select(mergePackageDeps)
.selectMany(_.pairs)
.select(validateSpec)
// Transform the versionSpec into a bool; true if the spec is satisfied.
.selectMany(
  getDepVersion,
  ([moduleName, installSpec, versionSpec], version) =>
    [moduleName, installSpec, semver.satisfies(version, versionSpec)]
)
.selectMany(
  ([moduleName, installSpec, satisfied]) =>
    satisfied ? [] : [[moduleName, installSpec]]
)
// "Uninstall" the module by wiping out the directory. This runs in parallel and
// is quite fast!
.selectMany(
  ([moduleName]) =>
    rimrafRx(path.join(process.cwd(), 'node_modules', moduleName)),
  (specs) => specs[1]
)
.reduce((acc, spec) => acc.concat(spec), [])
.selectMany(
  (specs) => specs.length > 0 ? spawnRx('npm', ['install'].concat(specs)) : []
);

spawnRx('npm', ['prune'])
.concat(installUnsatisfied)
.subscribe(
  console.log,
  (err) => console.error(err),
  () => console.log('Modules up to date.')
);
