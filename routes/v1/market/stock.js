var express = require('express');
var router = express.Router()
var env = require.main.require('./env_config.json');
var db_url = env['db_url'];


var schedule = require('node-schedule');
var Promise = require('bluebird');
var mongoClient = Promise.promisifyAll(require('mongodb')).MongoClient;
// var iextrading_url = 'https://api.iextrading.com/1.0/stock/{symbol}/batch?types=quote&range=1m&last=1'
// var iextrading_symbol_url = 'https://api.iextrading.com/1.0/ref-data/symbols'
var iextrading_url = env["iextrading_url"];
var iextrading_symbol_url = env["iextrading_symbol_url"];

/* scheduler to get the latest stock price every minute */
var j = schedule.scheduleJob('* * * * *', function(){
  var date = new Date().toISOString();
  console.log('Time to update stock price ' + date);
  updateStockPrice();
});



function updateStockPrice(){
	
	console.log('UpdateStockPrice started.');
	
	const request = require("request");
	var url;
	var updated_quotes = new Map();
	mongoClient.connectAsync(db_url)  
    .then(function(db) {
    	_db = db;
    	return _db.collection('stock_price').find().toArray();
    })
	
	.then(function(stocks){
		var index = 0;
		for (var i in stocks){
			var symbol = stocks[i].symbol;
			url = iextrading_url.replace('SYM',symbol);
			request.get(url, (error, response, body) => {
    		    if (error || (body === "Not Found")){
					console.log('UpdateStockPrice Failed error= ' + error + ' body=' + body);
					
					// ToDo: partial quote update allowed. 
    		    	// Challenge: url parameter is overwritten each time and only show the last url
    		    	/* 
    		    	// extract symbol from url
    		    	   var start_index = request.url.search("/stock/") + "/stock/".length;
					   var end_index = request.url.search("/batch?");
					    var sym = request.url.substring(start_index,end_index);

    		    	// find prev stock price
    		    	   let prv_index = find_prv_price(stocks,sym);
    		    	   updated_quotes.set(sym, {'symbol':sym, 'price':stocks[prv_index].price, 'date_time':stocks[prv_index].date_time, 'latest_update':stocks[prv_index].latest_update});
    		    	   index = index + 1;
    		    	*/
    		    }
    		    else {
    		    	let data = JSON.parse(body);
					if (data != null) {
						if (data.length > 0) { 
    		    			let price = data[0]['lastSalePrice'];
							let res_symbol = data[0]['symbol'];
    		    			let latest_update = data[0]['lastUpdated'];		
 							if (price > 0){
 								var date = new Date().toISOString();
 								updated_quotes.set(res_symbol, {'symbol':res_symbol, 'price':price, 'date_time':date, 'latest_update':latest_update});
  							}
  							else {
  								console.log('Invalid Response: res_price');
  							}
						}
					}
					index = index + 1;	
					if (index == stocks.length) {
						_db.collection('stock_price').remove({}, function(err, result){
							_db.collection('stock_price').insert(Array.from(updated_quotes.values()), function(err, result){
        						if (err == null) {
        							console.log('UpdateStockPrice finished.');
        							console.log(Array.from(updated_quotes.values()));
        						}
  							})	
  						})
					}
				}
			})
			
		}
	})
	.catch(function (err) {
		console.log(err);
	});
}



/* GET the stock symbol list */
/* App calls this api to update its stock list if there is a newer version' */
router.get('/symbols/version/:version', function(req, res) {   
	var db = req.db;
	var res_price_dic = {};
	
	/* parameters validation */	
	if (!req.params.version || isNaN(req.params.version)) {
		errCode = '400';
    	errMsg = 'version parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	
	// Find the latest symbols file version
    db.collection('configurations').findOne({'key':'symbols_version'},function (err, doc) {
        // Skip if the client symbol list is up-to-date
        let cur_ver = doc.value;
        if  (cur_ver ==  req.params.version){
            res_price_dic['symbols'] = [];
        	res.json({'status':'204','data':res_price_dic});
        	console.log('app symbols version ' + cur_ver + ' is current');
        }
        // Else return the full symbol list
        else {
        	db.collection('symbols').find().toArray(function (err, items) {
        		res_price_dic[symbols] = items;
        		res_price_dic[version] = cur_ver;
        		res.json({'status':'200','data':res_price_dic});
        		console.log('app symbols will be updated to ' + cur_ver + ' version');
        	});
    	}
    	
    });
});


/* Get a single quote */
router.get('/quote/:symbol', function(req, res) {   
	const request = require("request");
	var symbol = req.params.symbol.toUpperCase();
	
	// parameter validation
	if (symbol === null) {
		errCode = '400';
    	errMsg = 'symbol parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	var url = iextrading_url.replace('{symbol}',symbol);
	var res_price_dic = {};
	request.get(url, (error, response, body) => {
    	if (error){
    		console.log(error);
    		res.json({'status':'500','msg':'price is unavailable'});
    	}
    	else {
    		let data = JSON.parse(body);
    		let price = data[0]['lastSalePrice'];
    		if (price > 0){
 				res_price_dic[symbol]=price;
    			res.json({'status':'200','data':res_price_dic});
    		}
    		else {
    			console.log('unexpected price response:' + price);
    			res.json({'status':'500','msg':'price is unavailable'});
    		}
		}
	});
});
		
	


/* GET the latest stock price for a comma separated list of stocks */
router.get('/quote/array/:array', function(req, res) {   
	const request = require("request");
	
	// parameter validation
	if (req.params.array === null) {
		errCode = '400';
    	errMsg = 'array parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	var req_symbols = req.params.array.split(',');
	
	if (req_symbols === null) {
		errCode = '400';
    	errMsg = 'symbol parameter invalid format';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	
	var res_price_dic = {};
	var db_price_dic = {};
	var unfound_array = [];
	var db = req.db;
	var stocks = [];
		
	mongoClient.connectAsync(req.db_url)  
    .then(function(db) {
    	return db.collection('stock_price').find().toArray();
    })
	
	.then(function(db_price_array){
		/* first search db to find the stock quote */
		if (db_price_array) {
    		for (var i in db_price_array) {
    			db_price_dic[db_price_array[i].symbol] = {'price':db_price_array[i].price};
    		}
    	}
    	for (var i in req_symbols)	{
      	    var rec = db_price_dic[req_symbols[i]]; 
      	    if (rec){
    	   		res_price_dic[req_symbols[i]] = rec.price;
    	   	}
    	   	else {
    	   		unfound_array.push(req_symbols[i]);
    	   	}   	
    	}
    	
    	if (unfound_array.length > 0 ) {
    		// fetch stock price for unfound stocks and add them to the table
    		var index = 0;
			for (var i in unfound_array){
				var symbol = unfound_array[i];
				url = iextrading_url.replace('SYM',symbol);
				request.get(url, (error, response, body) => {
    		    	if (error){
    		    		console.log(error);
    		    		index = index + 1;
    		    	}
    		    	else {
    		    		let data = JSON.parse(body);
						if (data.length > 0) { 
    		    			let price = data[0]['lastSalePrice'];
							let res_symbol = data[0]['symbol'];
    		    			let latest_update = data[0]['lastUpdated'];	
    		    			
 							if (price > 0){
 								var date = new Date().toISOString();
 								stocks.push({'symbol':res_symbol, 'price':price, 'date_time':date, 'latest_update':latest_update});
  								res_price_dic[res_symbol] = price;
  								console.log('updated price for ' + res_symbol + ' is ' + price + ' at ' + date);
  							}
  							else {
  								console.log('Invalid Response: res_price');
  							}
						}
  						index = index + 1;
					}
					if (index == unfound_array.length) {
						db.collection('stock_price').insert(stocks, function(err, result){
        					if (err == null) {
        						console.log('stock price updated');
        					}
        					res.json({'status':'200','data':res_price_dic});
  						})	
  					}
				})
			}	
    	}
    	else {
    		res.json({'status':'200','data':res_price_dic});
    	}
    	console.log(res_price_dic);
    })
});



/* Auxiliary services */
// post api to read symbols from a file and write it to a db table.
router.post('/updateSymbols/file', function (req, res){

	var file_symbols = require('./symbols.json');
	var _db;
	var new_symbols_array = new Array();
	
	mongoClient.connectAsync(req.db_url)  
    .then(function(db) {
    	_db = db;
    	return _db.collection('symbols').find().toArray();
    })
	
	.then(function(symbols){
		
		for (var i in file_symbols) {
				var found = false;
				for (var j in symbols){
					 if (file_symbols[i].Symbol == symbols[j].Symbol){
						found = true;
					 }
				}
				if (found == false) {
					var new_symbol = {'Symbol': file_symbols[i].Symbol, 'Name':file_symbols[i].Name};
					new_symbols_array.push(new_symbol)
				}
		}
		
		return _db.collection('symbols').insert(new_symbols_array);	
	})
	
	.then(function(result){
		res.json({'status':'200','data':'updating symbols table'});
	})

});


// post api to read symbol list for iextrading and write it to a local file.
router.post('/updateSymbols/service', function (req, res){

    const request = require("request");
	var _db = req.db;
	var symbols_array = new Array();
	const fs = require('fs');
	
	
	url = iextrading_symbol_url;
	request.get(url, (error, response, body) => {
    	if (error){
        	console.log('symbols updated failed');
        	console.log(error);
    	}
    	else {
    		let symbols = JSON.parse(body);
    		for (var s in symbols){
				var sym = {'Symbol': symbols[s].symbol, 'Name':symbols[s].name};
				symbols_array.push(sym)
			}
    	
    		_db.collection('symbols').remove({}, function(err, result){
  				_db.collection('symbols').insert(symbols_array, function(err, result){
        			if (err == null) {
        				console.log('symbols updated');
        				let data = JSON.stringify(symbols_array);  
						fs.writeFileSync('symbols_iex.json', data);  
        				res.json({'status':'200','data':'updating symbols table'});
        			}
        			else {
        				console.log('symbols updated failed');
        				res.json({'status':'500','err':'general error'});
        			}
  				})	
  			})
    	}
	})
});



/* Auxiliary functions */
function find_prv_price(stock_array,symbol){

	for (var s in stock_array) {
		if (stock_array[s].symbol == symbol) {
			return s;
		}
	}
	return -1;
}


module.exports = router;
