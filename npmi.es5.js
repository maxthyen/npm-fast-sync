'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _rimraf = require('rimraf');

var _rimraf2 = _interopRequireDefault(_rimraf);

var _rx = require('rx');

var _rx2 = _interopRequireDefault(_rx);

var _semver = require('semver');

var _semver2 = _interopRequireDefault(_semver);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_rx2.default.config.longStackSupport = true;

var readFile = _rx2.default.Observable.fromNodeCallback(_fs2.default.readFile);

var rmDir = _rx2.default.Observable.fromNodeCallback(_rimraf2.default);

var spawn = function spawn(command, args) {
  return _rx2.default.Observable.create(function (o) {
    var errored = false;
    _child_process2.default.spawn(command, args, { env: process.env, stdio: 'inherit' }).on('error', function (err) {
      errored = true;
      o.onError(err);
    }).on('exit', function (err) {
      if (errored) {
        return;
      }
      if (err) {
        o.onError(err);
      } else {
        o.onNext('✓ ' + command + ' ' + args.join(' '));
        o.onCompleted();
      }
    });
  });
};

var parseJson = function parseJson(data) {
  return JSON.parse(data);
};

var mergePackageDeps = function mergePackageDeps(packageJson) {
  return Object.assign({}, packageJson.devDependencies, packageJson.dependencies);
};

var getPackageVersion = _lodash2.default.partial(_lodash2.default.get, _lodash2.default, 'version');

var validateSpec = function validateSpec(_ref) {
  var _ref2 = _slicedToArray(_ref, 2);

  var moduleName = _ref2[0];
  var spec = _ref2[1];

  if (_lodash2.default.contains(spec, '#')) {
    return [moduleName, spec, _semver2.default.valid(spec.split('#')[1])];
  }
  return [moduleName, moduleName + '@' + spec, spec];
};

var getDepVersion = function getDepVersion(_ref3) {
  var _ref4 = _slicedToArray(_ref3, 1);

  var moduleName = _ref4[0];
  return readFile(_path2.default.join(process.cwd(), 'node_modules', moduleName, 'package.json')).catch(_rx2.default.Observable.return(null)).select(parseJson).select(getPackageVersion);
};

var installUnsatisfied = readFile(_path2.default.join(process.cwd(), 'package.json')).catch(function (err) {
  console.error('could not read package.json!', err);
  return _rx2.default.Observable.empty();
}).select(parseJson).select(mergePackageDeps).selectMany(_lodash2.default.pairs).select(validateSpec).selectMany(getDepVersion, function (_ref5, version) {
  var _ref6 = _slicedToArray(_ref5, 3);

  var moduleName = _ref6[0];
  var dep = _ref6[1];
  var spec = _ref6[2];
  return [moduleName, dep, _semver2.default.satisfies(version, spec)];
}).selectMany(function (_ref7) {
  var _ref8 = _slicedToArray(_ref7, 3);

  var moduleName = _ref8[0];
  var dep = _ref8[1];
  var satisfied = _ref8[2];
  return satisfied ? [] : [[moduleName, dep]];
}).selectMany(function (_ref9) {
  var _ref10 = _slicedToArray(_ref9, 1);

  var moduleName = _ref10[0];
  return rmDir(_path2.default.join(process.cwd(), 'node_modules', moduleName));
}, function (t) {
  return t[1];
}).reduce(function (acc, spec) {
  return acc.concat(spec);
}, []).selectMany(function (specs) {
  return specs.length > 0 ? spawn('npm', ['install'].concat(specs)) : [];
});

spawn('npm', ['prune']).concat(installUnsatisfied).subscribe(console.log, function (err) {
  return console.error(err);
}, function () {
  return console.log('Modules up to date.');
});
