var express = require('express');
var mongo = require('mongoskin');
var bodyParser = require('./node_modules/body-parser');
var env = require.main.require('./env_config.json');
var db_url = env["db_url"];
var db = mongo.db(db_url, {native_parser:true});

var stock = require('./routes/v1/market/stock');
var app_logs = require('./routes/v1/logs/app');

var profile = require('./routes/v1/user/profile');
var portfolio = require('./routes/v1/user/portfolio');
var holders = require('./routes/v1/users/holders');
var scheduler = require('./routes/v1/scheduler/rankings_gain');
var test_data = require('./routes/v1/test_scripts/test_data');

var app = express();

app.set('port', (process.env.PORT || 30000));

app.use(express.static(__dirname + '/public'));

app.use(function(req, res, next){
  console.log('Received request: ' + req.originalUrl);
  req.db = db;
  req.db_url = db_url;
  res.set({'Access-Control-Allow-Origin': '*'});
  next();
});

app.listen(app.get('port'), function() {
  console.log('The Social Trader Staging services are running on port', app.get('port'));
});

app.use(bodyParser.json());

app.use('/services/v1/market/stock', stock);
app.use('/services/v1/user/profile', profile);
app.use('/services/v1/user/portfolio', portfolio);
app.use('/services/v1/users/holders', holders);
app.use('/services/v1/logs/app', app_logs);
// app.use('/services/v1/testscript/testdata', test_data);

module.exports = app;
