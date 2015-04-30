'use strict';

var NodeCache = require('node-cache');
var RateLimiter = require('limiter').RateLimiter;

module.exports = function() {

  var PREPEND_OUTPUT = 'Wundergrounded: ';

  var _apiKey = false;
  var _cache = false;
  var _debug = false;
  var _limiter = false;
  var _requests = [];

  var apiKey = function(value) {
    _apiKey = value;
    return this;
  };

  var cache = function(secondsInCache, secondsBetweenChecks) {
    var stdTtl = secondsInCache || 300;
    var checkperiod = secondsBetweenChecks || 30;
    _cache = new NodeCache(stdTtl, checkperiod);
    return this;
  };

  var debug = function(value) {
    _debug = value;
    return this;
  };

  var limit = function(numberPer, timePeriod) {
    var tokensPerInterval = numberPer || 10;
    var interval = timePeriod || 'minute';
    _limiter = new RateLimiter(tokensPerInterval, interval);
    return this;
  };

  var request = function(query, callback) {
    if(!callback || typeof callback !== 'function') {
      error('No callback supplied for the request, make sure to supply a callback.');
    }
    else if(!_apiKey) {
      callback(true, 'An API key must be set via .apiKey(...) prior to making any requests.');
    }
    else if(!_requests || _requests.length === 0) {
      callback(true, 'No requests were queued up, make sure to queue up requests prior to calling .request(...)');
    }
    else if(!query) {
      callback(true, 'No query was supplied for the request, make sure to supply a query.');
    }
    else {
      var doRequest = function() {
        // Generate URL
        var url = 'http://api.wunderground.com/api/' + _apiKey + '/' + _requests.join('/') + 'q/ '+ query + '.json';
        // Clear requests queue
        _requests = [];
        // Try to pull the data from the cache
        if(_cache) {
          var json = cache.get(url);
          if(json) {
            if(debug) log('Returning cached response for ' + url).log(json);
            callback(false, json);
            return;
          }
        }
        // Make a request to the Wunderground API
        if(debug) log('Making a request to ' + url);
        request(url, function (error, response, body) {
          if(!error && response.statusCode === 200) {
            var json = JSON.parse(body);
            // If caching is enabled, store the response
            if(_cache) {
              _cache.set(url, json);
            }
            log('Received response from Weather Underground API:').log(json);
            callback(false, json);
          }
          else {
            log('Received error response from Weather Underground API:').log(error).log(response).log(body);
            callback(true, 'An error occurred while trying to reach the Weather Underground API.');
          }
        });
      };
      // If throttling requests, make the request from inside of the RateLimiter
      if(_limiter) {
        _limiter.removeTokens(1, function(error) {
          if(!error) {
            doRequest();
          }
        });
      }
      // If not throttling requests, just make the request
      else {
        doRequest();
      }
    }
    return this;
  };

  var log = function(message) {
    if(debug) {
      console.log(PREPEND_OUTPUT + message);
    }
    return this;
  };

  var error = function(message) {
    throw new Error(PREPEND_OUTPUT + message);
  };

  return {
    apiKey: apiKey,
    cache: cache,
    debug: debug,
    limit: limit,
    request: request
  };

};