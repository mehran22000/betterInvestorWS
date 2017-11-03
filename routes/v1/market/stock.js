var express = require('express');
var router = express.Router();
var api_key = 'T7IA9S7QELE0FLVH'; 
var base_url = 'https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=MSFT&interval=1min&apikey=demo'

/* GET the latest Stock price. */
router.get('/quote/:symbol', function(req, res) {   
	const request = require("request");
	var url = base_url + 'query?function=TIME_SERIES_INTRADAY&symbol='+req.params.symbol+'&interval=1min&apikey='+api_key;
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




module.exports = router;