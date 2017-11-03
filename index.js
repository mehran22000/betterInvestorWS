var express = require('express');
var stock = require('./routes/v1/market/stock');
var mongo = require('mongoskin');
var db = mongo.db("mongodb://mehran:mehrdad781@ds245755.mlab.com:45755/heroku_p0jvg7ms", {native_parser:true});

var app = express();


app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));


// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');


app.use(function(req, res, next){
  console.log(req.originalUrl);
  req.db = db;
  res.set({'Access-Control-Allow-Origin': '*'});
  next();
});

app.listen(app.get('port'), function() {
  console.log('better investor services app is running on port', app.get('port'));
});

app.use('/services/v1/market/stock', stock);


module.exports = app;
