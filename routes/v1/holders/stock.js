var express = require('express');
var router = express.Router();
var Promise = require('bluebird');
var mongoClient = Promise.promisifyAll(require('mongodb')).MongoClient;
var db_url = "mongodb://mehran:mehrdad781@ds245755.mlab.com:45755/heroku_p0jvg7ms"
var schedule = require('node-schedule');
const sortBy = require('sort-array');
var market;
var _db;


router.get('/global/:symbol', function(req, res) {
   var _db;
   var holders = [];
   var users = [];
   var rankings = [];
   var symbol = req.params.symbol;
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
		
		for (var h in holders)
    	{
    		console.log(holders[h]);
    		var user_index = find_user_index(users,holders[h].user_id);
    		var rank_index = find_user_index(rankings,holders[h].user_id);
    		if (user_index >= 0) {
    			console.log(user_index);
    			holders[h].first_name = users[user_index].first_name;
    			holders[h].last_name = users[user_index].last_name;
    			holders[h].photo_url = users[user_index].photo_url;
    			holders[h].global_ranking = rankings[rank_index].rank_global;
    			results.push(holders[h]);
    		}
    	}
    	
    	results.sort(function (a, b) {
  			return a.global_ranking - b.global_ranking;
		});
    	
    	return res.send({'status':'200','data':{'holders':results}});
	})


});


function find_user_index(users_array,_user_id){

	for (var a in users_array) {
		if (users_array[a].user_id == _user_id) {
			return a;
		}
	}
	return -1;
}





module.exports = router;