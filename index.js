var express = require('express');
var stock = require('./routes/v1/market/stock');
var profile = require('./routes/v1/user/profile');
var portfolio = require('./routes/v1/user/portfolio');
var mongo = require('mongoskin');
var bodyParser = require('./node_modules/body-parser');
var db_url = "mongodb://mehran:mehrdad781@ds245755.mlab.com:45755/heroku_p0jvg7ms"
var db = mongo.db(db_url, {native_parser:true});

var app = express();


app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));


// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');


app.use(function(req, res, next){
  console.log(req.originalUrl);
  req.db = db;
  req.db_url = db_url;
  res.set({'Access-Control-Allow-Origin': '*'});
  next();
});

app.listen(app.get('port'), function() {
  console.log('better investor services app is running on port', app.get('port'));
});

app.use(bodyParser.json());


app.use('/services/v1/market/stock', stock);
app.use('/services/v1/user/profile', profile);
app.use('/services/v1/user/portfolio', portfolio);

module.exports = app;
