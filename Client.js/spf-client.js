/*! @license MIT ©2013-2016 Ruben Verborgh, Ghent University - imec */
/* Main ldf-client module exports. */

// Replace local `require` by a lazy loader,
// so we can keep `require` calls for static analyzers such as browserify
var globalRequire = require;
require = function (path) { return function () { return require(path); } };

// Temporarily set lazy initializers as exports
var exports = module.exports = {
  SparqlIterator: require('./lib-spf/sparql/SparqlIterator.js'),
  FragmentsClient: require('./lib-spf/star-pattern-fragments/federated/FederatedFragmentsClient'),
  Logger: require('./lib-spf/util/Logger'),
  HttpClient: require('./lib-spf/util/HttpClient'),
  SparqlResultWriter: function () {
    var SparqlResultWriter = require('./lib-spf/writers/SparqlResultWriter');
    SparqlResultWriter.register('application/json', './JSONResultWriter');
    SparqlResultWriter.register('application/sparql-results+json', './SparqlJSONResultWriter');
    SparqlResultWriter.register('application/sparql-results+xml', './SparqlXMLResultWriter');
    SparqlResultWriter.register('debug',  './StatsResultWriter');
    SparqlResultWriter.register('simple', './SimpleResultWriter');
    SparqlResultWriter.register('table',  './TableResultWriter');
    return SparqlResultWriter;
  },
};

// Replace exports by properties that load on demand
Object.keys(exports).forEach(function (submodule) {
  var loadSubmodule = exports[submodule];
  Object.defineProperty(exports, submodule, {
    configurable: true,
    enumerable: true,
    get: function () {
      // Replace the (currently executing) lazy property handler by the actual module
      delete exports[submodule];
      return exports[submodule] = loadSubmodule();
    },
  });
});

// Restore original require
require = globalRequire;
