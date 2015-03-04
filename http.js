/**
* A wrapper for mikeal's request module for Yakuza
* @module Http
* @author Rafael Vidaurre
*/

'use strict';

var _, request;

request = require('request');
_ = require('lodash');

/**
* @class
* @param {object} defaultCookies cookie jar for the class instance to be initialized with, defaults
* to a brand new cookie jar
*/
function Http (defaultCookies) {
  /**
  * Cookie jar for the Http instance
  * @private
  */
  this._cookieJar = defaultCookies || request.jar();

  /**
  * Instance of mikeal's request API with a default cookie jar set
  * @private
  */
  this._request = request.defaults({jar: this._cookieJar});

  /**
  * Array of requests logged
  * @private
  */
  this._log = [];
}

/**
* Pushes a response object to the request log and responds to passed callback
* @param {object} err Error object, is null if no error is present
* @param {object} res Request's response
* @param {string} body Request's response body only, is null if an error is present
* @param {function} callback Callback to be executed
* @private
*/
Http.prototype._interceptResponse = function (err, res, body, callback) {
  var cookieHost, cookieString;

  if (err) {
    callback(err, null, null);
    return;
  }

  cookieHost = res.request.uri.protocol + '//' + res.request.uri.hostname;
  cookieString = this._cookieJar.getCookieString(cookieHost);

  this._pushToLog({response: res, body: body, cookies: cookieString, request: res.request,
    url: res.request.href});

  if (_.isFunction(callback)) {
    callback(err, res, body);
  }
};

/**
* Pushes an entry to the class log
* @param {object} logEntry entry that represents a unit of the log
*/
Http.prototype._pushToLog = function (logEntry) {
  this._log.push(logEntry);
};

/**
* Pattern-matches parameters for request calls
* @param param1 First parameter (required)
* @param param2 Second parameter
* @param param3 Third parameter
* @return {object} parameters assigned to proper keys
* @private
*/
Http.prototype._initRequestParams = function (param1, param2, param3) {
  var callback, options, uri;

  if (_.isFunction(param2) && !param3) {
    callback = param2;
  }

  if (_.isObject(param2) && !_.isFunction(param2)) {
    options = param2;
    options.uri = param1;
    uri = param1;
    callback = param3;
  } else if (_.isString(param1)) {
    uri = param1;
    options = {uri: uri};
  } else {
    options = param1;
    uri = options.uri;
  }

  return {uri: uri, options: options, callback: callback};
};

Http.prototype.getCookieJar = function () {
  return this._cookieJar;
};

/**
* Delegate to request's `del` method
* @param param1 First parameter (required) can be options object or URI string
* @param param2 Second parameter can be options object or callback
* @param param3 Third parameter callback method
*/
Http.prototype.del = function (param1, param2, param3) {
  var _this, params;

  _this = this;
  params = this._initRequestParams(param1, param2, param3);

  this._request.del(params.uri, params.options, function (err, res, body) {
    _this._interceptResponse(err, res, body, params.callback);
  });
};

/**
* Delegate to request's `get` method
* @param param1 First parameter (required) can be options object or URI string
* @param param2 Second parameter can be options object or callback
* @param param3 Third parameter callback method
*/
Http.prototype.get = function (param1, param2, param3) {
  var _this, params;

  _this = this;
  params = this._initRequestParams(param1, param2, param3);

  this._request.get(params.uri, params.options, function (err, res, body) {
    _this._interceptResponse(err, res, body, params.callback);
  });
};

/**
* Delegate to request's `head` method
* @param param1 First parameter (required) can be options object or URI string
* @param param2 Second parameter can be options object or callback
* @param param3 Third parameter callback method
*/
Http.prototype.head = function (param1, param2, param3) {
  var _this, params;

  _this = this;
  params = this._initRequestParams(param1, param2, param3);

  this._request.head(params.uri, params.options, function (err, res, body) {
    _this._interceptResponse(err, res, body, params.callback);
  });
};

/**
* Delegate to request's `patch` method
* @param param1 First parameter (required) can be options object or URI string
* @param param2 Second parameter can be options object or callback
* @param param3 Third parameter callback method
*/
Http.prototype.patch = function (param1, param2, param3) {
  var _this, params;

  _this = this;
  params = this._initRequestParams(param1, param2, param3);

  this._request.patch(params.uri, params.options, function (err, res, body) {
    _this._interceptResponse(err, res, body, params.callback);
  });
};

/**
* Delegate to request's `post` method
* @param param1 First parameter (required) can be options object or URI string
* @param param2 Second parameter can be options object or callback
* @param param3 Third parameter callback method
*/
Http.prototype.post = function (param1, param2, param3) {
  var _this, params;

  _this = this;
  params = this._initRequestParams(param1, param2, param3);

  this._request.post(params.uri, params.options, function (err, res, body) {
    _this._interceptResponse(err, res, body, params.callback);
  });
};

/**
* Delegate to request's `put` method
* @param param1 First parameter (required) can be options object or URI string
* @param param2 Second parameter can be options object or callback
* @param param3 Third parameter callback method
*/
Http.prototype.put = function (param1, param2, param3) {
  var _this, params;

  _this = this;
  params = this._initRequestParams(param1, param2, param3);

  this._request.put(params.uri, params.options, function (err, res, body) {
    _this._interceptResponse(err, res, body, params.callback);
  });
};

/**
* Returns the current request log as an array
* @returns {array} current request log
*/
Http.prototype.getLog = function () {
  return this._log;
};

/**
* Clones a Mikeal's request jar, it is cloned this way because of the hideous way request's jar
* class is implemented
* @return cookie jar clone
* @static
*/
Http.cloneCookieJar = function (cookieJar) {
  var newJar, cookieString, cookieStore, domains, domainPaths, cookieUrl;

  newJar = request.jar();
  cookieStore = cookieJar._jar.store.idx;
  domains = _.keys(cookieStore);

  _.each(domains, function (domain) {
    domainPaths = _.keys(cookieStore[domain]);

    _.each(domainPaths, function (domainPath) {
      cookieUrl = 'http://' + domain + domainPath;
      cookieString = cookieJar.getCookieString(cookieUrl);

      newJar.setCookie(cookieString, cookieUrl);
    });
  });

  return newJar;
};

module.exports = Http;
