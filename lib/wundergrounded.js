'use strict';

var NodeCache = require('node-cache');
var RateLimiter = require('limiter').RateLimiter;
var Request = require('request');

module.exports = function(debug) {

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
    _cache = new NodeCache({ stdTTL: stdTtl, checkperiod: checkperiod });
    return this;
  };

  var limit = function(numberPer, timePeriod) {
    var tokensPerInterval = numberPer || 10;
    var interval = timePeriod || 'minute';
    if(debug) log('Enabling request throttling; max ' + tokensPerInterval + ' requests made per ' + interval +  '.');
    _limiter = new RateLimiter(tokensPerInterval, interval);
    return this;
  };

  var alerts = function(query, callback) {
    apiEndpoint('alerts', query, callback);
    return this;
  };

  var almanac = function(query, callback) {
    apiEndpoint('almanac', query, callback);
    return this;
  };

  var astronomy = function(query, callback) {
    apiEndpoint('astronomy', query, callback);
    return this;
  };

  var conditions = function(query, callback) {
    apiEndpoint('conditions', query, callback);
    return this;
  };

  var currenthurricane = function(query, callback) {
    apiEndpoint('currenthurricane', query, callback);
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

  var history = function(date, query, callback) {
    if(date && date instanceof Date) {
      var format = function(value) {
        return value.getFullYear() + ('0' + (value.getMonth() + 1)).slice(-2) + ('0' + value.getDate()).slice(-2);
      };
      var dateString = format(date);
      apiEndpoint('history_' + dateString, query, callback);
    }
    else if(callback) {
      callback(error('The "date" parameter is required and must be a Date object.'));
    }
    else if(_debug) {
      log('The call to .history(...) is being ignored, as it requires the "date" parameter to be a Date object.');
    }
    return this;
  };

  var hourly = function(query, callback) {
    apiEndpoint('hourly', query, callback);
    return this;
  };

  var hourly10day = function(query, callback) {
    apiEndpoint('hourly10day', query, callback);
    return this;
  };

  var planner = function(start, end, query, callback) {
    if(start && end && start instanceof Date && end instanceof Date) {
      var format = function(value) {
        return ('0' + (value.getMonth() + 1)).slice(-2) + ('0' + value.getDate()).slice(-2);
      };
      var startString = format(start);
      var endString = format(end);
      apiEndpoint('planner_' + startString + endString, query, callback);
    }
    else if(callback) {
      callback(error('Both the "start" and "end" parameters are required and must be Date objects.'));
    }
    else if(_debug) {
      log('The call to .planner(...) is being ignored, as it requires both the "start" and "end" parameters to be Date objects.');
    }
    return this;
  };

  var rawtide = function(query, callback) {
    apiEndpoint('rawtide', query, callback);
    return this;
  };

  var satellite = function(query, callback) {
    apiEndpoint('satellite', query, callback);
    return this;
  };

  var tide = function(query, callback) {
    apiEndpoint('tide', query, callback);
    return this;
  };

  var webcams = function(query, callback) {
    apiEndpoint('webcams', query, callback);
    return this;
  };

  var yesterday = function(query, callback) {
    apiEndpoint('yesterday', query, callback);
    return this;
  };

  var apiEndpoint = function(service, query, callback) { 
    var requestExists = function(request) {
      for(var i = 0; i < _requests.length; i++) {
        var _request = _requests[i];
        if(_request === request) {
          return true;
        }
      }
      return false;
    };
    if(!requestExists(service)) {
      _requests.push(service);
    }
    if(query && callback) {
      request(query, callback);
    }
    return this;
  };

  var request = function(query, callback) {
    if(!callback || typeof callback !== 'function') {
      throw Error('No callback supplied for the request, make sure to supply a callback.');
    }
    else if(!query) {
      callback(error('No query was supplied for the request, make sure to supply a query.'));
    }
    else if(!_apiKey) {
      callback(error('An API key must be set via .apiKey(...) prior to making any requests.'));
    }
    else if(!_requests || _requests.length === 0) {
      callback(error('No requests were queued up, make sure to queue up requests prior to calling .request(...)'));
    }
    else {
      // Copy requests value and clear
      var services = _requests;
      _requests = [];
      // Function that actually does the request... used later
      var doRequest = function(_services, _query, _callback) {
        // Generate URL
        var url = 'http://api.wunderground.com/api/' + _apiKey + '/' + _services.join('/') + '/q/' + _query + '.json';
        // Try to pull the data from the cache
        if(_cache) {
          var json = _cache.get(url);
          if(json) {
            if(_debug) log('[' + url + '] Returning cached response.');
            _callback(false, json);
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
              _callback(false, json);
            }
            // If this is a sad-path response, return an error
            else {
              if(_debug) log('[' + url + '] Request failed!');
              _callback(json, 'An error occurred while communicating with the Weather Underground API.');
            }
          }
          // If the request returned an error, return that error
          else {
            if(_debug) log('[' + url + '] Request failed!');
            _callback(error, 'Received an error when trying to connect to ' + url);
          }
        });
      };
      // If throttling requests, make the request from inside of the RateLimiter
      if(_limiter) {
        _limiter.removeTokens(1, function(error) {
          if(!error) {
            doRequest(services, query, callback);
          }
        });
      }
      // If not throttling requests, just make the request
      else {
        doRequest(services, query, callback);
      }
    }
    return this;
  };

  var log = function(message) {
    if(typeof message === 'object') {
      console.log(JSON.stringify(message, null, 2));
    }
    else {
      console.log('Wundergrounded: ' + message);
    }
  };

  var error = function(message) {
    return {
      message: message
    };
  };

  // Public API
  return {
    apiKey: apiKey,
    cache: cache,
    limit: limit,
    request: request,
    // Wunderground endpoints
    alerts: alerts,
    almanac: almanac,
    astronomy: astronomy,
    conditions: conditions,
    currenthurricane: currenthurricane,
    forecast: forecast,
    forecast10day: forecast10day,
    geolookup: geolookup,
    history: history,
    hourly: hourly,
    hourly10day: hourly10day,
    planner: planner,
    rawtide: rawtide,
    satellite: satellite,
    tide: tide,
    webcams: webcams,
    yesterday: yesterday
  };

};
