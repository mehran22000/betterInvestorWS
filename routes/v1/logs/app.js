var express = require('express');
var router = express.Router();
var Promise = require('bluebird');
var mongoClient = Promise.promisifyAll(require('mongodb')).MongoClient;

/* POST buy a stock */
router.post('/', function(req, res) {
	var db = req.db;
	var db_url = req.db_url;

	/* parameters */
	var user_id = req.body.user_id;
	var source = req.body.source;
	var msg = req.body.msg;
	var date = new Date();
	var record = {'user_id':user_id, 'source':source, 'msg':msg, 'date':date.yyyymmdd()}
	var _db;

	/* parameters validation */
	if (!user_id || isNaN(user_id)) {
		errCode = '400';
    	errMsg = 'user id parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
		
	
	mongoClient.connectAsync(db_url)  
    .then(function(db) {
        _db = db;
       return db.collection('logs').insert(record);
	})
	
	
	.then(function(_result) {
		console.log('log record is inserted');
		res.json({'status':'200','response':'success'});
	})
	
	.catch(function (err) {
		console.log(err);
	});
});




			
module.exports = router;