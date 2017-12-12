var express = require('express');
var router = express.Router();
var api_key = 'T7IA9S7QELE0FLVH'; 
var base_url = 'https://www.alphavantage.co/'
var Promise = require('bluebird');
var mongoClient = Promise.promisifyAll(require('mongodb')).MongoClient;
var db_url = "mongodb://mehran:mehrdad781@ds245755.mlab.com:45755/heroku_p0jvg7ms"
var schedule = require('node-schedule');

/* scheduler to get the latest stock price every minute */

var j = schedule.scheduleJob('* * * * *', function(){
  var date = new Date().toISOString();
  console.log('Time to update stock price ' + date);
  updateStockPrice();
});


function updateStockPrice(){
	const request = require("request");
	var url;
	
	mongoClient.connectAsync(db_url)  
    .then(function(db) {
    	_db = db;
    	return _db.collection('stock_price').find().toArray();
    })
	
	.then(function(stocks){
		for (var i in stocks){
			var symbol = stocks[i].symbol;
			url = base_url + 'query?function=TIME_SERIES_INTRADAY&symbol='+symbol+'&interval=1min&apikey='+api_key;
    		request.get(url, (error, response, body) => {
    		    if (error != null){
    		    	console.log(error);
    		    }
    		    else {
  					let data = JSON.parse(body);
  					let time_series = data['Time Series (1min)'];
  					let res_symbol = data['Meta Data']['2. Symbol'];
  					var keys = [];
  					for(var k in time_series) keys.push(k);
  					let res_price = time_series[keys[0]]['4. close'];
 					var date = new Date().toISOString();
  					var new_price = {'symbol':res_symbol,'price':res_price, 'date_time':date}
  					_db.collection('stock_price').remove({'symbol':res_symbol}, function(err, result){
  						_db.collection('stock_price').insert(new_price, function(err, result){
        					if (err == null) {
        						console.log('price for ' + res_symbol + ' is ' + new_price.price);
        					}
  						})	
  					})
  				}				
    		})
		}
	})
}



/* GET the latest Stock price. */
router.get('/quote/:symbol', function(req, res) {   
	const request = require("request");
	var url = base_url + 'query?function=TIME_SERIES_INTRADAY&symbol='+req.params.symbol+'&interval=1min&apikey='+api_key;
	console.log(url);
	request.get(url, (error, response, body) => {
  		let data = JSON.parse(body);
  		let time_series = data['Time Series (1min)'];
  		var keys = [];
  		for(var k in time_series) keys.push(k);
  		let price = time_series[keys[0]]['4. close'];
  		res.json({'status':'200','symbol':req.params.symbol,'price':price,'date':keys[0]});
	});
});

/* GET the stock symbol list */
router.get('/symbols/version/:version', function(req, res) {   
	var db = req.db;
	var msg = '';
	
	// Find the latest symbols file version
    db.collection('configurations').findOne({'key':'symbols_version'},function (err, doc) {
        // Skip if the client symbol list is up-to-date
        if  (doc.value ==  req.params.version){
            msg = 'symbol list is up-to-date'
        	res.json({'status':'200','symbols':'[]', 'msg':msg});
        	console.log(msg);
        }
        // Else return the full symbol list
        else {
        	db.collection('symbols').find().toArray(function (err, items) {
        	    msg = 'update local symbols';
        		res.json({'status':'200','symbols':items, 'msg':msg});
        		console.log(msg);
        	});
    	}
    	
    });
});


/* GET the latest Stock price. */
/*
router.get('/quote/array/:array', function(req, res) {   
	var req_symbols = req.params.array.split(',');
	var db_price_dic = {};
	var res_price_dic = {};

	var dict = {};
	var _db;
		
	mongoClient.connectAsync(req.db_url)  
    .then(function(db) {
    	_db = db;
    	return _db.collection('stock_price').find().toArray();
    })
	
	.then(function(db_price_array){
    	if (db_price_array) {
    		for (var i in db_price_array) {
    			db_price_dic[db_price_array[i].symbol] = {'price':db_price_array[i].price,'date':db_price_array[i].date_time};
    		}
    	}
    		
    	// iterate over req_symbols
    	var now  = new Date();
    	var index = 0;
    	var dateObj, validaDate;
    	
    	for (var i in req_symbols)	{
    	    var rec = db_price_dic[req_symbols[i]]; 
    	    var prvPriceFound = false;
    		if (rec != null) {
    			prvPriceFound = true;
    			dateObj = new Date(rec.date);
    			validDate = new Date(dateObj.setMinutes(dateObj.getMinutes() + 1));
    		}
    			
    		if ((prvPriceFound === true) && (validDate > now)){
    			console.log('price for' + req_symbols[i] + ' is ' + rec.price + ' and still valid');
    			res_price_dic[req_symbols[i]] = rec.price;
    			index = index + 1;
    			if (index === req_symbols.length){
  					res.json({'status':'200','data':res_price_dic});
  				}			
    		}
    		else {
    			console.log('invalid');
    			url = base_url + 'query?function=TIME_SERIES_INTRADAY&symbol='+req_symbols[i]+'&interval=1min&apikey='+api_key;
    			console.log(url);
  				request.get(url, (error, response, body) => {
  					let data = JSON.parse(body);
  					let time_series = data['Time Series (1min)'];
  					let res_symbol = data['Meta Data']['2. Symbol'];
  					var keys = [];
  					for(var k in time_series) keys.push(k);
  					let res_price = time_series[keys[0]]['4. close'];
  					dict[res_symbol] = res_price
 					var date = new Date().toISOString();
  					var new_price = {'symbol':res_symbol,'price':res_price, 'date_time':date}
  					_db.collection('stock_price').remove({'symbol':res_symbol}, function(err, result){
  						_db.collection('stock_price').insert(new_price, function(err, result){
        					if (err == null) {
        						console.log('price for ' + res_symbol + ' is ' + new_price + ' and still valid');
        						res_price_dic[res_symbol] = res_price;
        					}
        					index = index + 1;
  							if (index === req_symbols.length){
  								res.json({'status':'200','data':res_price_dic});
  							}
  						})	
  					})				
    			}) 
    		}
    	}
    })
});
*/

router.get('/quote/array/:array', function(req, res) {   
	var req_symbols = req.params.array.split(',');
	var res_price_dic = {};
	var db_price_dic = {};
	var _db;
		
	mongoClient.connectAsync(req.db_url)  
    .then(function(db) {
    	_db = db;
    	return _db.collection('stock_price').find().toArray();
    })
	
	.then(function(db_price_array){
		if (db_price_array) {
    		for (var i in db_price_array) {
    			db_price_dic[db_price_array[i].symbol] = {'price':db_price_array[i].price};
    		}
    	}
    		
    	for (var i in req_symbols)	{
      	    var rec = db_price_dic[req_symbols[i]]; 
    	   	res_price_dic[req_symbols[i]] = rec.price;
    	}
    	
    	res.json({'status':'200','data':res_price_dic});
    })
});


module.exports = router;