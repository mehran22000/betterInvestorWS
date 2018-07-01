var express = require('express');
var Promise = require('bluebird');
var schedule = require('node-schedule');
const sortBy = require('sort-array');

var router = express.Router();
var mongoClient = Promise.promisifyAll(require('mongodb')).MongoClient;

var env = require.main.require('./env_config.json');
var db_url = env['db_url'];

var market;
var _db;

// analytics variables
// var positive_gain_users;
// calculate_gain_ranking();

/* scheduler to rank users daily */
var j = schedule.scheduleJob('0 * * * *', function(){
  var date = new Date().toISOString();
  console.log('Time to update ranking ' + date);
  calculate_gain_ranking();
});

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
			console.log('Calculate gain for user id =' +  users[u].user_id + ':'); 
			for (var p in portfolio) {
				if (users[u].user_id === portfolio[p].user_id){
					user_positions.push(portfolio[p]);
					// calculate gain
					var price = getStockPrice(portfolio[p].symbol);
					var stock_gain = portfolio[p].qty * price - portfolio[p].cost;
					gain = gain + stock_gain; 
					console.log('- symbol=' + portfolio[p].symbol+ ' price=' + price + ' qty=' + portfolio[p].qty + ' cost=' + portfolio[p].cost + ' gain=' + gain);
				}
			}
			var gain_pct = gain / users[u].credit;
			console.log('total gain=' + gain + ' ' + gain_pct);				
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
    		ranking_array[r].rank_global = Number(r) + 1; 
    	}
    	update_rankings(ranking_array);
    })
    
    .catch(function (err) {
		console.log(err);
	});
}





function update_rankings(_rankings) {
	
	if (_rankings.length > 0 ) {
		// Clear Rankings Table
		mongoClient.connectAsync(db_url)  
    	.then(function(db) {
    		_db = db;
    		return _db.collection('rankings').remove();
    	})

		.then(function(result){
			console.log('rankings table reset.');
			return _db.collection('rankings').insert(_rankings);
		})
		.then(function(result){
			console.log('rankings table updated.');
			console.log(_rankings);
			// Next step is to update the gains table
		    update_gains(_rankings);
		})
		.catch(function (err) {
			console.log(err);
		});
	}
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
    			var gain;
    			var gain_str = gains[i].gain;
    			var today_gain = gain_str.includes(date.yyyymmdd());
    			if (today_gain == false) {
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
    	
    	if (gain_array.length >= gains.length) {
    		return _db.collection('gains').remove();
    	}
    	else {
    		console.log('Error: gain_array is not completed.');
    		console.log('updated gain_array is:');
    		console.log(gain_array);
    		console.log('previous gain_array is');
    		console.log(gains);
    	}
	})


	.then(function(result){
		console.log('gains table reset.');
		return _db.collection('gains').insert(gain_array);
	})
	
	.then(function(result){
		console.log('gains table updated.');
		console.log(gain_array);
		// Next step is to update analytics
		update_analytics();
	})
	
	.catch(function (err) {
		console.log(err);
	})

}


function update_analytics(){
	
	mongoClient.connectAsync(db_url)  
    .then(function(db) {
    	_db = db;
    	return _db.collection('stats').remove();
    })
    
    .then(function(result){
    	console.log('stats table reset.');
		return _db.collection('stats').insert({'positive_gain_users':positive_gain_users});
	})
	.then(function(result){
		console.log('stats table updated.');
		console.log({'positive_gain_users':positive_gain_users});
	})
	
	.catch(function (err) {
		console.log(err);
	})
}


/* Auxiliary functions */
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
		if (market[s].symbol.toUpperCase() === symbol.toUpperCase()){
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