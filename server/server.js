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
  var gamesCount = gameList.length;
  var countPerRequest = 50;

  var callback = collectAllData(gamesCount, response);

  while (gameList.length > 0)
  {
    // to not spam with request we wait couple seconds between them
    _.delay(getGameDetailsForAppIds, 3000, 
        gameList.slice(0, countPerRequest), 
        callback
    );

    gameList = gameList.slice(countPerRequest);
  }
}

function collectAllData(gamesCount, response) {
  var  fetchedGames = [];
  var fetchedCount = 0;

  return function (statusCode, gamesDetails, appIdLibraryData) {
    if (statusCode !== 200) {
      response.writeHead(statusCode);
      response.end();
      return;
    }

    var numberOfGamesFetched = _.size(gamesDetails);
    fetchedCount += numberOfGamesFetched;

    var libraryData = _.indexBy(appIdLibraryData, 'appid');

    _.each(gamesDetails, function (value, key, list) {
      value.libraryData = libraryData[key];
    });

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

function getGameDetailsForAppIds(gameList, callback) {
  var commaSeparatedAppIdList = _.reduce(
      gameList, 
      function (memo, value) { return memo != '' ? memo + ',' + value.appid : value.appid }, 
      ''
  );

  var path = util.format('%s?appids=%s&cc=pl&l=english', 
    '/api/appdetails/',
    commaSeparatedAppIdList);

  console.log(util.format('sending request for %s appIds', gameList.length));
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
      callback(res.statusCode, object, gameList);
    });
  });
}

function getSteamUserLibraryList(steamUserId, response) {
  var path = util.format('%s?key=%s&steamid=%s&include_played_free_games=0&include_appinfo=1', 
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

  // TODO: Some validation of steamUserId would be usefull 17 characters etc
  // TODO: Some game appid request fail, store redirects them to other page
  // TODO: Add port where the server starts to server arguments
  // TODO: https://github.com/caolan/async use this?
  if (queryData.steamUserId) {
    getSteamUserLibraryList(queryData.steamUserId, res);
  } else {
    res.writeHead(403);
    res.end();
  }
}
