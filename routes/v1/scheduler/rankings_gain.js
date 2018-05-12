var express = require('express');
var router = express.Router();
var Promise = require('bluebird');
var mongoClient = Promise.promisifyAll(require('mongodb')).MongoClient;
var db_url = "mongodb://mehran:mehrdad781@ds245755.mlab.com:45755/heroku_p0jvg7ms"
var schedule = require('node-schedule');
const sortBy = require('sort-array');
var market;
var _db;
var positive_gain_users;
/* scheduler to get the latest stock price every minute */


var j = schedule.scheduleJob('* * * * *', function(){
  var date = new Date().toISOString();
  console.log('Time to update ranking ' + date);
  calculate_gain_ranking();
});


// calculate_gain_ranking();



function calculate_gain_ranking(){
	var users, portfolio;
	var ranking_array = [];
	positive_gain_users = 0;
	
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
					gain = gain + (portfolio[p].qty * price - portfolio[p].cost);
				}
			}
			var gain_pct = gain / users[u].credit;				
			dic_user_gain[users[u].user_id] = gain_pct;
			
			if (gain > 0) {
				positive_gain_users = positive_gain_users + 1; 
			}
			
			ranking_array.push({'user_id':users[u].user_id,'gain':gain.toFixed(2), 'gain_pct':gain_pct.toFixed(4)});
		}
    	
    	// global rankings
    	ranking_array.sort(function (a, b) {
  			return b.gain_pct - a.gain_pct;
		});
    	for (var r in ranking_array) {
    		ranking_array[r].rank_global = ranking_array.length - r; 
    	}
    	
    	
    	
    	/*
    	for (var r in ranking_array) {
    		if ((ranking_array[r].friends != null) && (ranking_array[r].friends != '')){	
    			var friends_array = ranking_array[r].friends.split(',');
    			friends_array.push(ranking_array[r].user_id);
    			
    			// Clean Up Friends Array
    			var active_friends = [];
    			for (var f in friends_array) {
    				if (dic_user_gain[friends_array[f]] != null) {
    					active_friends.push(friends_array[f]);
    				}  
    			}
    			
    			friends_array = active_friends;
    			for (var i=0; i< friends_array.length - 1; i++){
    				for (var j = i+1; j< friends_array.length; j++) {
    					console.log(dic_user_gain[friends_array[i]] + '<' + dic_user_gain[friends_array[j]] );
    					if (dic_user_gain[friends_array[i]] < dic_user_gain[friends_array[j]]){
    						var temp = friends_array[i];
    						friends_array[i] = friends_array[j];
    						friends_array[j] = temp;
    					}
    				}
    			}
    				
    		ranking_array[r].friends = friends_array.toString();
    		}
    	}
		*/	
		console.log(ranking_array);
    	update_rankings(ranking_array);
    })
}





function update_rankings(_rankings) {
	
	var gain_array = [];
	var date = new Date();
	
	// Clear Rankings Table
	mongoClient.connectAsync(db_url)  
    .then(function(db) {
    	_db = db;
    	return _db.collection('rankings').remove();
    })

	.then(function(result){
	    console.log(_rankings.length);
		if (_rankings.length > 0) {
			return _db.collection('rankings').insert(_rankings);
		}
		else {
			return true;
		}
	})
	
	.then(function(result){
		console.log('rankings table updated!');
		update_gains(_rankings);
	})

} 



function update_gains(_rankings) {
 	var gain_array = [];
	var date = new Date();
	
	// Read all records
	mongoClient.connectAsync(db_url)  
    .then(function(db) {
    	_db = db;
    	return _db.collection('gains').find().toArray();
    })


	.then(function(gains){
		for (var u in _rankings) {
    		var i = find_gain_index (gains, _rankings[u].user_id);
    		if (i >= 0) {
    			var gain_str = gains[i].gain;
    			var new_gain = gain_str.includes(date.yyyymmdd());
    			var gain;
    			if (new_gain == false) {
    				gain_str = gain_str + ',{'+ date.yyyymmdd() +':'+ (_rankings[u].gain_pct)+'}'	
    				gain = {'user_id': _rankings[u].user_id,'gain':gain_str};
    			}
    			else {
    				gain = {'user_id': _rankings[u].user_id,'gain':gains[i].gain};
    			}		
  				gain_array.push(gain);
    		}
    		if (i < 0) {
    			gain_str = '{'+ date.yyyymmdd() +':'+ (_rankings[u].gain_pct)+'}'	
    			var gain = {'user_id': _rankings[u].user_id,'gain':gain_str};
    			gain_array.push(gain);
    		}
    	}
    	return _db.collection('gains').remove();
	})


	.then(function(result){
	
		if (gain_array.length > 0) {
			return _db.collection('gains').insert(gain_array);
		}
		else {
			return true;
		}
	})
	
	.then(function(result){
		console.log('gains table updated!');
		update_analytics();
	})

}


function update_analytics(){
	
	mongoClient.connectAsync(db_url)  
    .then(function(db) {
    	_db = db;
    	return _db.collection('stats').remove();
    })
    
    .then(function(result){
		return _db.collection('stats').insert({'positive_gain_users':positive_gain_users});
	})
	.then(function(result){
		console.log('stats update updated!');
	})
}



function find_gain_index (_gains, _user_id){

	for (var g in _gains){
	  	if (_gains[g].user_id == _user_id) {
	  		return g;
	  	}
	}
	return -1;
}

function get_user_friends (_users, _user_id){

	for (var u in _users){
	  	if (_users[u].user_id == _user_id) {
	  		return _users[u].friends;
	  	}
	}
	return -1;
}

function find_user_index(users_array,_user_id){

	for (var a in users_array) {
		if (users_array[a].user_id == _user_id) {
			return a;
		}
	}
	return -1;
}


function getStockPrice(symbol){	
	for (var s in market) {
		if (market[s].symbol === symbol){
			return market[s].price;
		}
	}
	return 0;
}


Date.prototype.yyyymmdd = function() {
  var mm = this.getMonth() + 1; // getMonth() is zero-based
  var dd = this.getDate();

  return [this.getFullYear(),
          (mm>9 ? '' : '0') + mm,
          (dd>9 ? '' : '0') + dd
         ].join('');
};




module.exports = router;