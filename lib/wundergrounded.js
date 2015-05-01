'use strict';

var NodeCache = require('node-cache');
var RateLimiter = require('limiter').RateLimiter;
var Request = require('request');

module.exports = function(debug) {

  var PREPEND_OUTPUT = 'Wundergrounded: ';

  var _apiKey = process.env.WUNDERGROUND_API_KEY || false;
  var _cache = false;
  var _debug = debug || false;
  var _limiter = false;
  var _requests = [];

  var apiKey = function(value) {
    _apiKey = value;
    return this;
  };

  var cache = function(secondsInCache, secondsBetweenChecks) {
    var stdTtl = secondsInCache || 300;
    var checkperiod = secondsBetweenChecks || 30;
    if(debug) log('Enabling results cache; seconds in cache = ' + stdTtl + ', seconds between eviction checks = ' + checkperiod + '.');
    _cache = new NodeCache(stdTtl, checkperiod);
    return this;
  };

  var limit = function(numberPer, timePeriod) {
    var tokensPerInterval = numberPer || 10;
    var interval = timePeriod || 'minute';
    if(debug) log('Enabling request throttling; max ' + tokensPerInterval + ' requests made per ' + interval +  '.');
    _limiter = new RateLimiter(tokensPerInterval, interval);
    return this;
  };

  var almanac = function(query, callback) {
    apiEndpoint('almanac', query, callback);
    return this;
  };

  var autocomplete = function(query, callback) {
    apiEndpoint('autocomplete', query, callback);
    return this;
  };

  var conditions = function(query, callback) {
    apiEndpoint('conditions', query, callback);
    return this;
  };

  var forecast = function(query, callback) {
    apiEndpoint('forecast', query, callback);
    return this;
  };

  var forecast10day = function(query, callback) {
    apiEndpoint('forecast10day', query, callback);
    return this;
  };

  var geolookup = function(query, callback) {
    apiEndpoint('geolookup', query, callback);
    return this;
  };

  var hourly = function(query, callback) {
    apiEndpoint('hourly', query, callback);
    return this;
  };

  var hourly7day = function(query, callback) {
    apiEndpoint('hourly7day', query, callback);
    return this;
  };

  var hourly10day = function(query, callback) {
    apiEndpoint('hourly10day', query, callback);
    return this;
  };

  var yesterday = function(query, callback) {
    apiEndpoint('yesterday', query, callback);
    return this;
  };

  var apiEndpoint = function(service, query, callback) {
    _requests.push(service);
    if(query && callback) {
      request(query, callback);
    }
    return this;
  };

  var request = function(query, callback) {
    if(!callback || typeof callback !== 'function') {
      throw Error('No callback supplied for the request, make sure to supply a callback.');
    }
    else if(!_apiKey) {
      callback({message: 'An API key must be set via .apiKey(...) prior to making any requests.'});
    }
    else if(!_requests || _requests.length === 0) {
      callback({message: 'No requests were queued up, make sure to queue up requests prior to calling .request(...)'});
    }
    else if(!query) {
      callback({message: 'No query was supplied for the request, make sure to supply a query.'});
    }
    else {
      var doRequest = function() {
        // Generate URL
        var url = 'http://api.wunderground.com/api/' + _apiKey + '/' + _requests.join('/') + '/q/' + query + '.json';
        // Clear requests queue
        _requests = [];
        // Try to pull the data from the cache
        if(_cache) {
          var json = _cache.get(url);
          if(json) {
            if(_debug) log('[' + url + '] Returning cached response.');
            callback(false, json);
            return this;
          }
        }
        // Make a request to the Wunderground API
        if(_debug) log('[' + url + '] Making request to Wunderground API...');
        Request(url, function (error, response, body) {
          if(!error && response.statusCode === 200) {
            var json = JSON.parse(body);
            // If this is a happy-path response...
            if(!json.response.error) {
              // ...store the response in the cache (if caching is enabled)
              if(_cache) {
                if(_debug) log('[' + url + '] Caching API response...');
                _cache.set(url, json);
              }
              // ...return the responses
              if(_debug) log('[' + url + '] Returning API response.');
              callback(false, json);
            }
            // If this is a sad-path response, return an error
            else {
              if(_debug) log('[' + url + '] Request failed!');
              callback(json, 'An error occurred while communicating with the Weather Underground API.');
            }
          }
          // If the request returned an error, return that error
          else {
            if(_debug) log('[' + url + '] Request failed!');
            callback(response, 'Received an error when trying to connect to ' + url);
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
    if(typeof message === 'object') {
      console.log(JSON.stringify(message, null, 2));
    }
    else {
      console.log(PREPEND_OUTPUT + message);
    }
  };

  // Public API
  return {
    apiKey: apiKey,
    cache: cache,
    limit: limit,
    request: request,
    // Wunderground endpoints
    alamanac: almanac,
    autocomplete: autocomplete,
    conditions: conditions,
    forecast: forecast,
    forecast10day: forecast10day,
    geolookup: geolookup,
    hourly: hourly,
    hourly7day: hourly7day,
    hourly10day: hourly10day,
    yesterday: yesterday
  };

};