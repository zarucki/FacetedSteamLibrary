var http = require('http');
var util = require('util');
var url = require('url');
var _ = require('underscore');

var app = http.createServer(handler);
app.listen(89);

var steamApiKey = getSteamApiKey();

function getSteamApiKey()
{
  var fs = require('fs');
  var contentsOfFile = fs.readFileSync('steam_api_key', { encoding: 'utf8' });
  return contentsOfFile.replace(/[^a-zA-Z0-9]/g, '');
}

function getGamesDetails(gameList, response) {
  var appIdsToFetch = _.pluck(gameList, 'appid');
  var gameDetails = {};
  var gamesCount = appIdsToFetch.length;
  var countPerRequest = 50;

  var callback = collectAllData(gamesCount, response);

  while (appIdsToFetch.length > 0)
  {
    // to not spam with request we wait couple seconds between them
    _.delay(getGameDetailsForAppIds, 3000, 
        appIdsToFetch.slice(0, countPerRequest), 
        callback
    );

    appIdsToFetch = appIdsToFetch.slice(countPerRequest);
  }
}

function collectAllData(gamesCount, response) {
  var  fetchedGames = [];
  var fetchedCount = 0;

  return function (statusCode, gamesDetails) {
    if (statusCode !== 200) {
      response.writeHead(statusCode);
      response.end();
      return;
    }

    var numberOfGamesFetched = _.size(gamesDetails);
    fetchedCount += numberOfGamesFetched;
    console.log(util.format('just got %s, together got %s/%s', numberOfGamesFetched, fetchedCount, gamesCount));
    fetchedGames.push(gamesDetails);

    if (fetchedCount == gamesCount) {
      console.log('done');
      var finalResult = _.reduce(fetchedGames, function (memo, value) { return _.extend(memo, value); }, {});
      response.setHeader("Content-Type", "application/json");
      response.writeHead(200);
      response.end(JSON.stringify(finalResult))
    }
  };
}

function getGameDetailsForAppIds(appIds, callback) {
  var commaSeparatedAppIdList = _.reduce(
      appIds, 
      function (memo, value) { return memo != '' ? memo + ',' + value : value }, 
      ''
  );

  var path = util.format('%s?appids=%s&cc=pl&l=english', 
    '/api/appdetails/',
    commaSeparatedAppIdList);

  console.log(util.format('sending request for %s appIds', appIds.length));
  http.get({ host: 'store.steampowered.com', port: 80, path: path }, function (res) {
    if(res.statusCode !== 200) {
      callback(res.statusCode, null);
      return;
    }

    var result = '';
    res.setEncoding('utf-8');

    res.on('data', function(chunk) {
      result += chunk;
    });

    res.on('end', function() {
      var object = JSON.parse(result);
      callback(res.statusCode, object);
    });
  });
}

function getSteamUserLibraryList(steamUserId, response) {
  var path = util.format('%s?key=%s&steamid=%s&include_played_free_games=0', 
    '/IPlayerService/GetOwnedGames/v0001/',
    steamApiKey,
    steamUserId);

  http.get({host: 'api.steampowered.com', port: 80, path: path}, function (res) {
    if(res.statusCode !== 200) {
      response.writeHead(res.statusCode);
      response.end();
      return;
    }

    var result = '';
    res.setEncoding('utf-8');

    res.on('data', function(chunk) {
      result += chunk;
    });

    res.on('end', function() {
      var object = JSON.parse(result);
      console.log('game count', object.response.game_count);

      getGamesDetails(object.response.games, response);
    });

  });
}

function handler (req, res) {
  var queryData = url.parse(req.url, true).query;
  console.log(queryData);

  // I don't give a fuck origin policy for testing purposes, when actually hosted you would
  // rather like to limit it to your own site so noone abuses your service
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (queryData.steamUserId) {
    getSteamUserLibraryList(queryData.steamUserId, res);
  } else {
    res.writeHead(403);
    res.end();
  }
}
