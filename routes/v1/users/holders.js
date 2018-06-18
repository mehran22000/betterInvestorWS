var express = require('express');
var schedule = require('node-schedule');
const sortBy = require('sort-array');
var Promise = require('bluebird');
var router = express.Router();
var mongoClient = Promise.promisifyAll(require('mongodb')).MongoClient;
var db_url = "mongodb://mehran:mehrdad781@ds245755.mlab.com:45755/heroku_p0jvg7ms"
var market;
var _db;


router.get('/:symbol/global/:global/userid/:userid', function(req, res) {
   
   var symbol = req.params.symbol;
   var global = req.params.global;
   var user_id = req.params.userid;
   
   /* parameters validation */	
	if (!user_id || isNaN(user_id)) {
		errCode = '400';
    	errMsg = 'user id parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	if (!symbol) {
		errCode = '400';
    	errMsg = 'symbol parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
   
   
   if ((global != 'false') && (global != 'true')) {
		errCode = '400';
    	errMsg = 'global parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
   
   var holders = [];
   var users = [];
   var rankings = [];
   var friends_str_sync;
   var results = [];
   	 		
    mongoClient.connectAsync(req.db_url)  
    .then(function(db) {
    	_db = db;
    	return _db.collection('portfolio').find({'symbol':symbol}).toArray();
    })
	
	.then(function(_holders) {
		holders = _holders;
		return _db.collection('users').find().toArray();
	})

	.then(function(_users) {
		users = _users;
		return _db.collection('rankings').find().toArray();
	})

	.then(function(_rankings) {
		rankings = _rankings;
		// ',' added to friends_str to be synchronous. search key will include two commas. 
		if (global == 'false') {
			var user_index = find_user_index(users,user_id);
			friends_str_sync = ',' + users[user_index].friends + ',';
		}
		
		for (var h in holders)
    	{
    		var user_index = find_user_index(users,holders[h].user_id);
    		var rank_index = find_user_index(rankings,holders[h].user_id);
    		if (user_index >= 0) {
    			holders[h].first_name = users[user_index].first_name;
    			holders[h].last_name = users[user_index].last_name;
    			holders[h].photo_url = users[user_index].photo_url;
    			holders[h].global_ranking = rankings[rank_index].rank_global;
    			
    			if (global == 'false') {
    				var search_key = ',' + users[user_index].user_id + ',';
    				if (friends_str_sync.indexOf(search_key) !== -1) {
    					results.push(holders[h]);
       				}
    			}
    			else {
    				results.push(holders[h]);
    			}
    		}
    	}
    	
    	results.sort(function (a, b) {
  			return a.global_ranking - b.global_ranking;
		});
		var response = {'status':'200','data':{'holders':results}};
		console.log(response);
    	return res.send(response);
	})
	.catch(function (err) {
		console.log(err);
	});
});


/* Auxiliary functions */
function find_user_index(users_array,_user_id){

	for (var a in users_array) {
		if (users_array[a].user_id == _user_id) {
			return a;
		}
	}
	return -1;
}





module.exports = router;