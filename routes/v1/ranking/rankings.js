var express = require('express');
var router = express.Router();
var Promise = require('bluebird');
var mongoClient = Promise.promisifyAll(require('mongodb')).MongoClient;
var db_url = "mongodb://mehran:mehrdad781@ds245755.mlab.com:45755/heroku_p0jvg7ms"
var schedule = require('node-schedule');
const sortBy = require('sort-array');
var market;
var _db;
/* scheduler to get the latest stock price every minute */

/*
var j = schedule.scheduleJob('0 17 * * *', function(){
  var date = new Date().toISOString();
  console.log('Time to update ranking ' + date);
  updateRankings();
});
*/

updateRankings();

function updateRankings(){
	var users, portfolio;
	var ranking_global = [];
	mongoClient.connectAsync(db_url)  
    
    .then(function(db) {
    	_db = db;
    	return _db.collection('stock_price').find().toArray();
    })
	
	.then(function(results){
		market = results;
		return _db.collection('users').find().toArray();
	})
	
	.then(function(results) {
		users = results;
		return _db.collection('portfolio').find().toArray();
    })
    
    .then(function(results) {
		portfolio = results;
		// calculate gains
		var dic_user_gain = {};
		for (var u in users) {
			var user_positions = [];
			var gain = 0;
			for (var p in portfolio) {
				if (users[u].user_id === portfolio[p].user_id){
					user_positions.push(portfolio[p]);
					// calculate gain
					var price = getStockPrice(portfolio[p].symbol);
					// console.log(portfolio[p].symbol + ' , ' + portfolio[p].qty + ' , ' + price + ' , ' + portfolio[p].cost); 
					gain = gain + (portfolio[p].qty * price - portfolio[p].cost);
				}
			}
			users[u].portfolio = user_positions;
			users[u].gain = gain;
			users[u].gain_precentage = gain / users[u].cash;
			dic_user_gain[users[u].user_id] = users[u].gain_precentage;
			ranking_global.push({'index':u,'gain':users[u].gain_precentage});
		}
    	
    	// global rankings
    	sortBy(ranking_global,'gain'); 	
    	for (var r in ranking_global) {
    		users[ranking_global[r].index].ranking_global = ranking_global.length - r; 
    	}
    	
    	// friends rankings
    	for (var u in users) {
    		var friends_rank = 1;
    		for (var f in users[u].friends) {
    			// console.log('user:'+ users[u].user_id + ' gain:' + users[u].gain_precentage + ' , friend:'+ users[u].friends[f] + ' gain: ' + dic_user_gain[users[u].friends[f]]);
    			if (users[u].gain_precentage < dic_user_gain[users[u].friends[f]]) {
    				friends_rank = friends_rank + 1;
    			}
    		}
    		users[u].ranking_friends = friends_rank;
    	}
    	
    	// Update user records in database
    	for (var u in users){
    		update_user(users[u]);
    	}			
    })
}

function update_user (new_user) {
	_db.collection('users').findOne({'user_id':new_user.user_id}, function(err,user_rec){  	
    	user_rec.gain = new_user.gain;
    	user_rec.gain_precentage = new_user.gain_precentage;
    	user_rec.ranking_global = new_user.ranking_global;
    	user_rec.ranking_friends = new_user.ranking_friends;
    	_db.collection('users').remove({'user_id':new_user.user_id}, function(err, result){
  			_db.collection('users').insert(user_rec, function(err, result){
        		if (err == null) {
        			console.log('user info for ' + new_user.user_id + ' updated ');
        		}
  			})
    	});
	})
}



function getStockPrice(symbol){	
	for (var s in market) {
		if (market[s].symbol === symbol){
			return market[s].price;
		}
	}
	return 0;
}



module.exports = router;