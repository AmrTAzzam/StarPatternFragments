/*! @license MIT ©2014-2016 Ruben Verborgh, Ghent University - imec */

var N3 = require('../n3'),
    _ = require('lodash');

var genidMatcher = /^https?:\/\/[^\/]+\/\.well-known\/genid\/([^]+)$/;

/**
 * Utility functions for working with URIs, triples, variables, and patterns.
 * @exports RdfUtil
 * @extends N3.Util
 */
var util = module.exports = new N3.Util({});

/* Methods for URIs */

/** Checks whether two URIs are equal after decoding, to make up for encoding differences. **/
util.decodedURIEquals = function (URIa, URIb) {
  if (URIa === URIb) return true;
  try { return decodeURI(URIa) === decodeURI(URIb); }
  catch (error) { return false; }
};

/** Transforms a skolemized URI into a blank node. */
util.deskolemize = function (URI) {
  return URI && URI.replace(genidMatcher, function (URI, id) {
    return '_:' + id.replace(/\W/g, '_');
  });
};


/* Methods for triples */

/** Creates a triple object from the components. */
util.triple = function (subject, predicate, object) {
  return { subject: subject, predicate: predicate, object: object };
};


/* Methods for variables and triple patterns */

/** Creates a quick string representation of a triple or triple component. */
util.toQuickString = function (triple) {
  // Empty object means empty string
  if (!triple)
    return '';
  // Convert a triple component by abbreviating it
  if (typeof triple === 'string') {
    if (util.isVariableOrBlank(triple))
      return triple;
    if (util.isLiteral(triple))
      return '"' + util.getLiteralValue(triple) + '"';
    var match = triple.match(/([a-zA-Z\(\)_\.,'0-9]+)[^a-zAZ]*?$/);
    return match ? match[1] : triple;
  }
  // Convert a triple by converting its components
  return util.toQuickString(triple.subject) + ' ' +
         util.toQuickString(triple.predicate) + ' ' +
         util.toQuickString(triple.object) + '.';
};

/** Checks whether the entity represents a variable. */
util.isVariable = function (entity) {
  return (typeof entity !== 'string') || (entity[0] === '?');
};

/** Checks whether the triple pattern has variables. */
util.hasVariables = function (pattern) {
  return !!pattern && (util.isVariable(pattern.subject) ||
                       util.isVariable(pattern.predicate) ||
                       util.isVariable(pattern.object));
};

/** Returns all variables in the triple pattern. */
util.getVariables = function (pattern) {
  var variables = [];
  if (!Array.isArray(pattern)) {
    if (util.isVariable(pattern.subject)) variables.push(pattern.subject);
    if (util.isVariable(pattern.predicate)) variables.push(pattern.predicate);
    if (util.isVariable(pattern.object)) variables.push(pattern.object);
  }
  else {
    if (util.isVariable(pattern[0].subject)) variables.push(pattern[0].subject);
    pattern.forEach(function (item) {
      if (util.isVariable(item.predicate)) variables.push(item.predicate);
      if (util.isVariable(item.object)) variables.push(item.object);
    });
  }
  return variables;
};

util.getVariableNames = function (pattern) {
  var variables = {};
  if (!Array.isArray(pattern)) {
    if (util.isVariable(pattern.subject)) variables[pattern.subject] = '?subject';
    if (util.isVariable(pattern.predicate)) variables[pattern.predicate] = '?predicate';
    if (util.isVariable(pattern.object)) variables[pattern.object] = '?object';
  }
  else {
    if (util.isVariable(pattern[0].subject)) variables[pattern[0].subject] = '?subject';
    var i = 1;
    pattern.forEach(function (item) {
      if (util.isVariable(item.predicate)) variables[item.predicate] = '?p' + i;
      if (util.isVariable(item.object)) variables[item.object] = '?o' + i;
      i++;
    });
  }
  return variables;
};

/** Checks whether the entity represents a variable or blank node. */
util.isVariableOrBlank = function (entity) {
  return (typeof entity !== 'string') || (entity[0] === '?') ||
                                         (entity[0] === '_' && entity[1] === ':');
};

/** Checks whether the triple pattern has variables or blanks. */
util.hasVariablesOrBlanks = function (pattern) {
  return !!pattern && (util.isVariableOrBlank(pattern.subject) ||
                       util.isVariableOrBlank(pattern.predicate) ||
                       util.isVariableOrBlank(pattern.object));
};

/** Creates a filter for triples that match the given pattern. */
util.tripleFilter = function (triplePattern) {
  var pattern = triplePattern || {},
      subject   = util.isVariableOrBlank(pattern.subject)   ? null : pattern.subject,
      predicate = util.isVariableOrBlank(pattern.predicate) ? null : pattern.predicate,
      object    = util.isVariableOrBlank(pattern.object)    ? null : pattern.object;
  return function (triple) {
    return (subject === null   || subject   === triple.subject) &&
           (predicate === null || predicate === triple.predicate) &&
           (object === null    || object    === triple.object);
  };
};

/** Applies the given bindings to the triple or graph pattern, returning a bound copy thereof. */
util.applyBindings = function (bindings, pattern) {
  // Bind a graph pattern
  if (typeof pattern.map === 'function')
    return pattern.map(function (p) { return util.applyBindings(bindings, p); });
  // Bind a triple pattern
  return {
    subject:   bindings[pattern.subject]   || pattern.subject,
    predicate: bindings[pattern.predicate] || pattern.predicate,
    object:    bindings[pattern.object]    || pattern.object,
  };
};

/** Finds the bindings that transform the pattern into the triple. */
util.findBindings = function (triplePattern, boundTriple) {
  return util.extendBindings(null, triplePattern, boundTriple);
};

/** Finds the bindings that transform the pattern into the triple. */
util.findRelevantBindings = function (pattern, bindings) {
  if (bindings.length === 0) return '';
  var relevantBindings = [],
      vars = this.getVariables(pattern),
      varNames = this.getVariableNames(pattern),
      relVars = [],
      b = bindings[0],
      cache = [],
      str = '(';

  vars.forEach(function (item) {
    if (b[item] !== undefined) {
      relVars.push(item);
      str += varNames[item];
    }
  });

  str += '){';

  bindings.forEach(function (binding) {
    var relBind = {},
        bindStr = '(';
    relVars.forEach(function (item) {
      relBind[item] = binding[item];
      if (binding[item].match(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g))
        bindStr += '<' + binding[item] + '>';
      else
        bindStr += '"' + binding[item] + '"';
    });

    if (!cache.includes(JSON.stringify(relBind))) {
      relevantBindings.push(relBind);
      cache.push(JSON.stringify(relBind));
      bindStr += ')';
      str += bindStr;
    }
  });

  str += '}';

  return str;
};

/** Creates augmented bindings that include bindings to transform the pattern into the triple. */
util.isUri = function (str) {
   // fragment locator
  return !!ptn.test(str);
};

/** Creates augmented bindings that include bindings to transform the pattern into the triple. */
util.extendBindings = function (bindings, triplePattern, boundTriple) {
  var newBindings = Object.create(null);
  for (var binding in bindings)
    newBindings[binding] = bindings[binding];
  util.addBinding(newBindings, triplePattern.subject,   boundTriple.subject);
  util.addBinding(newBindings, triplePattern.predicate, boundTriple.predicate);
  util.addBinding(newBindings, triplePattern.object,    boundTriple.object);
  return newBindings;
};

/** Creates augmented bindings that include bindings to transform the pattern into the star. */
util.extendBindingsBindings = function (bindings, triplePattern, boundTriple) {
  var newBindings = [];
  for (var i = 0; i < bindings.length; i++) {
    if (this.matchesTripleBinding(bindings[i], triplePattern, boundTriple))
      newBindings.push(this.extendBindings(bindings[i], triplePattern, boundTriple));
  }
  return newBindings;
};

/** Creates augmented bindings that include bindings to transform the pattern into the star. */
util.extendBindingsStar = function (bindings, starPattern, boundStar) {
  if (!Array.isArray(starPattern)) {
    return this.extendBindings(bindings, starPattern,
      { subject : boundStar.subject, predicate : boundStar.star[0].predicate, object : boundStar.star[0].object });
  }

  var newBindings = Object.create(null);
  for (var binding in bindings)
    newBindings[binding] = bindings[binding];
  util.addBinding(newBindings, starPattern[0].subject,   boundStar.subject);
  for (var i = 0; i < starPattern.length; i++) {
    var ptn = starPattern[i];
    for (var j = 0; j < boundStar.star.length; j++) {
      var triple = { subject : boundStar.subject, predicate : boundStar.star[j].predicate, object : boundStar.star[j].object };
      if (util.matchesTriple(triple, ptn)) {
        util.addBinding(newBindings, ptn.predicate, triple.predicate);
        util.addBinding(newBindings, ptn.object,    triple.object);
      }
    }
  }

  return newBindings;
};

/** Creates augmented bindings that include bindings to transform the pattern into the star. */
util.extendBindingsStarBindings = function (bindings, starPattern, boundStar) {
  if (!Array.isArray(starPattern)) {
    return this.extendBindingsBindings(bindings, starPattern,
      { subject: boundStar.subject, predicate: boundStar.star[0].predicate, object: boundStar.star[0].object });
  }

  var newBindings = [];
  for (var i = 0; i < bindings.length; i++) {
    if (this.matchesStarBinding(bindings[i], starPattern, boundStar))
      newBindings.push(this.extendBindingsStar(bindings[i], starPattern, boundStar));
  }
  return newBindings;
};

util.matchesTripleBinding = function (bindings, triplePattern, boundTriple) {
  var subj = triplePattern.subject;
  var pred = triplePattern.predicate;
  var obj = triplePattern.object;

  if (this.isVariable(subj) && bindings[subj] !== undefined && bindings[subj] !== boundTriple.subject) return false;
  if (this.isVariable(pred) && bindings[pred] !== undefined && bindings[pred] !== boundTriple.predicate) return false;
  if (this.isVariable(obj) && bindings[obj] !== undefined && bindings[obj] !== boundTriple.object) return false;

  return true;
};

util.matchesStarBinding = function (bindings, starPattern, boundStar) {
  var subj = starPattern[0].subject;

  if (this.isVariable(subj) && bindings[subj] !== undefined && bindings[subj] !== boundStar.subject) return false;

  for (var i = 0; i < starPattern.length; i++) {
    var tp = starPattern[i], bs = boundStar.star[i];
    if (this.isVariable(tp.predicate) && bindings[tp.predicate] !== undefined && bindings[tp.predicate] !== bs.predicate) return false;
    if (this.isVariable(tp.object) && bindings[tp.object] !== undefined && bindings[tp.object] !== bs.object) return false;
  }
  return true;
};

/** Checks whether a triple pattern and triple matches */
util.matchesTriple = function (triple, triplePattern) {
  return (util.isVariable(triplePattern.subject) || (triplePattern.subject === triple.subject)) &&
    (util.isVariable(triplePattern.predicate) || (triplePattern.predicate === triple.predicate)) &&
    (util.isVariable(triplePattern.object) || (triplePattern.object === triple.object));
};

/** Extends the bindings with a binding that binds the left component to the right. */
util.addBinding = function (bindings, left, right) {
  // The left side may be variable; the right side may not
  if (util.isVariableOrBlank(right))
    throw new Error('Right-hand side must not be variable.');
  // If the left one is the variable
  if (util.isVariableOrBlank(left)) {
    // Add it to the bindings if it wasn't already bound
    if (!(left in bindings))
      bindings[left] = right;
    // The right-hand side should be consistent with the binding
    else if (right !== bindings[left]) {
      throw new Error([
        'Cannot bind', left, 'to', right,
        'because it was already bound to', bindings[left] + '.'].join(' '));
    }
  }
  // Both are constants, so they should be equal for a successful binding
  else if (left !== right)
    throw new Error(['Cannot bind', left, 'to', right].join(' '));
  // Return the extended bindings
  return bindings;
};

/** Verifies whether the child pattern is a bound version of the parent pattern. */
util.isBoundPatternOf = function (child, parent) {
  return (util.isVariable(parent.subject)   || (parent.subject   === child.subject))   &&
         (util.isVariable(parent.predicate) || (parent.predicate === child.predicate)) &&
         (util.isVariable(parent.object)    || (parent.object    === child.object));
};


/* Methods for graph patterns */

/** Finds connected subpatterns within the possibly disconnected graph pattern. */
util.findConnectedPatterns = function (graphPattern) {
  // Zero or single-triple patterns have exactly one cluster
  if (graphPattern.length <= 1)
    return [graphPattern];

  // Initially consider all individual triple patterns as disconnected clusters
  var clusters = graphPattern.map(function (triple) {
        return {
          triples:  [triple],
          variables: _.values(triple).filter(util.isVariableOrBlank),
        };
      }), commonVar;

  // Continue clustering as long as different clusters have common variables
  do {
    // Find a variable that occurs in more than one subpattern
    var allVariables = _.flatten(_.pluck(clusters, 'variables'));
    if (commonVar = _.find(allVariables, hasDuplicate)) {
      // Partition the subpatterns by whether they contain that common variable
      var hasCommon = _.groupBy(clusters,
                                function (c) { return _.contains(c.variables, commonVar); });
      // Replace the subpatterns with a common variable by a subpattern that combines them
      clusters = hasCommon.false || [];
      clusters.push({
        triples:   _.union.apply(_, _.pluck(hasCommon.true, 'triples')),
        variables: _.union.apply(_, _.pluck(hasCommon.true, 'variables')),
      });
    }
  } while (commonVar);

  // The subpatterns consist of the triples of each cluster
  return _.pluck(clusters, 'triples');
};

// Array filter that finds values occurring more than once
function hasDuplicate(value, index, array) {
  return index !== array.lastIndexOf(value);
}

/* Common RDF namespaces and URIs */

namespace('rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', [
  'type', 'subject', 'predicate', 'object',
]);

namespace('void', 'http://rdfs.org/ns/void#', [
  'triples',
]);

namespace('hydra', 'http://www.w3.org/ns/hydra/core#', [
  'search', 'template', 'mapping', 'property', 'variable', 'totalItems',
]);

namespace('foaf', 'http://xmlns.com/foaf/0.1/');

namespace('dbpedia', 'http://dbpedia.org/resource/');
namespace('dbpedia-owl', 'http://dbpedia.org/ontology/');

function namespace(prefix, base, names) {
  var key = prefix.replace(/[^a-z]/g, '').toUpperCase();
  util[key] = base;
  names && names.forEach(function (name) {
    util[key + '_' + name.toUpperCase()] = base + name;
  });
}

Object.freeze(util);
