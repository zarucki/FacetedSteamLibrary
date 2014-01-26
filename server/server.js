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

function getGamesDetails(gameList) {
    
}

function getSteamUserLibraryList(steamUserId, response) {
  response.setHeader("Content-Type", "application/json");

  var path = util.format('%s?key=%s&steamid=%s&include_played_free_games=0', 
      '/IPlayerService/GetOwnedGames/v0001/',
      steamApiKey,
      steamUserId);

  http.get({host: 'api.steampowered.com', port: 80, path: path}, function(res) {
    if(res.statusCode !== 200) {
      console.log(res.statusCode);
      response.writeHead(res.statusCode);
      response.end();
      return;
    }

    var result = '';
    response.writeHead(200);
    // TODO: should i worry about encoding?
    res.setEncoding('utf-8');

    res.on('data', function(chunk) {
      // encoding here is optional parameter
      result += chunk;
      //response.write(chunk)
    });

    res.on('end', function() {
      var object = JSON.parse(result);
      console.log('game count', object.response.game_count);
      console.log('first game from list', object.response.games[0]);
      console.log('done');
      response.end();
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
