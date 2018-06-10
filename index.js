var express = require('express');
var mongo = require('mongoskin');
var bodyParser = require('./node_modules/body-parser');

var db_url = "mongodb://mehran:mehrdad781@ds245755.mlab.com:45755/heroku_p0jvg7ms"
var db = mongo.db(db_url, {native_parser:true});

var stock = require('./routes/v1/market/stock');
var profile = require('./routes/v1/user/profile');
var portfolio = require('./routes/v1/user/portfolio');
var holders = require('./routes/v1/users/holders');
var scheduler = require('./routes/v1/scheduler/rankings_gain');
// var test_data = require('./routes/v1/test_scripts/test_data');

var app = express();

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

app.use(function(req, res, next){
  console.log('Received request: ' + req.originalUrl);
  req.db = db;
  req.db_url = db_url;
  res.set({'Access-Control-Allow-Origin': '*'});
  next();
});

app.listen(app.get('port'), function() {
  console.log('The Social Trader services are running on port', app.get('port'));
});

app.use(bodyParser.json());

app.use('/services/v1/market/stock', stock);
app.use('/services/v1/user/profile', profile);
app.use('/services/v1/user/portfolio', portfolio);
app.use('/services/v1/users/holders', holders);
// app.use('/services/v1/testscript/testdata', test_data);

module.exports = app;
