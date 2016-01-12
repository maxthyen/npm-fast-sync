import _ from 'lodash';
import childProcess from 'child_process';
import fs from 'fs';
import path from 'path';
import rimraf from 'rimraf';
import Rx from 'rx';
import semver from 'semver';

Rx.config.longStackSupport = true;

const readFile = Rx.Observable.fromNodeCallback(fs.readFile);

const rmDir = Rx.Observable.fromNodeCallback(rimraf);

const spawn = (command, args) => Rx.Observable.create((o) => {
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

const mergePackageDeps = (packageJson) => Object.assign({}, packageJson.devDependencies, packageJson.dependencies);

const getPackageVersion = _.partial(_.get, _, 'version');

const validateSpec = ([moduleName, spec]) => {
  if (_.contains(spec, '#')) {
    return [moduleName, spec, semver.valid(spec.split('#')[1])];
  }
  return [moduleName, `${moduleName}@${spec}`, spec];
};

const getDepVersion = ([moduleName]) => readFile(path.join(process.cwd(), 'node_modules', moduleName, 'package.json'))
.catch(Rx.Observable.return(null))
.select(parseJson)
.select(getPackageVersion);

const installUnsatisfied = readFile(path.join(process.cwd(), 'package.json'))
.catch(err => {
  console.error('could not read package.json!', err);
  return Rx.Observable.empty();
})
.select(parseJson)
.select(mergePackageDeps)
.selectMany(_.pairs)
.select(validateSpec)
.selectMany(getDepVersion, ([moduleName, dep, spec], version) => [moduleName, dep, semver.satisfies(version, spec)])
.selectMany(([moduleName, dep, satisfied]) => satisfied ? [] : [[moduleName, dep]])
.selectMany(
  ([moduleName]) => rmDir(path.join(process.cwd(), 'node_modules', moduleName)),
  (t) => t[1]
)
.reduce((acc, spec) => acc.concat(spec), [])
.selectMany((specs) => specs.length > 0 ? spawn('npm', ['install'].concat(specs)) : []);

spawn('npm', ['prune'])
.concat(installUnsatisfied)
.subscribe(
  console.log,
  (err) => console.error(err),
  () => console.log('Modules up to date.')
);
