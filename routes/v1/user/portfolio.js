var express = require('express');
var router = express.Router();
var Promise = require('bluebird');
var mongoClient = Promise.promisifyAll(require('mongodb')).MongoClient;


/* Get user portfolio */
router.get('/:user_id', function(req, res) {   
	var db_url = req.db_url;
	var db;
	var portfolio;
	var cash;
	var credit;
	var gain = 0, gain_pct = 0;
	var rank_global;
	
	/* parameters validation */	
	if (!req.params.user_id || isNaN(req.params.user_id)) {
		errCode = '400';
    	errMsg = 'user id parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	
	mongoClient.connectAsync(db_url)  
    .then(function(_db) {      
        db = _db;
        return db.collection('portfolio').find({'user_id':req.params.user_id}).toArray();
    })
    .then(function(_portfolio) {
    	portfolio = _portfolio;
    	return db.collection('users').findOne({'user_id':req.params.user_id});
		
    })
    .then(function(_user) {
    	cash = _user.cash;
    	credit = _user.credit;
    	return db.collection('rankings').findOne({'user_id':req.params.user_id});
		
    })
    .then(function(ranking) {
    	
    	if (ranking != null) {
    		gain = ranking.gain;
    		gain_pct = ranking.gain_pct;
    		rank_global = ranking.rank_global;
    		return;
    	}
    	// for new user, their global rank will be based on num of user with positive return
    	else {
    		return db.collection('stats').findOne();
    	}
    })
    
    .then(function(_stats) {
		
		if (rank_global == null) {
    		rank_global = _stats.positive_gain_users + 1;
    	}
		var data = {'portfolio':portfolio,'cash':cash,'gain':gain,'gain_pct':gain_pct,'rank_global':rank_global, 'credit':credit};
		console.log(data);
		res.json({'status':'200','data': data});
	})
	
    .catch(function(err) {
        throw err;
        console.log(err);
        return res.send({'status':'500','response':'error','msg':'generic error'});
    })
    
});

/* POST buy a stock */
router.post('/', function(req, res) {
	var db = req.db;

	/* parameters */
	var user_id = req.body.user_id;
	var symbol = req.body.symbol;
	var name = req.body.name;
	var qty = parseInt(req.body.qty);
	var price = parseFloat(req.body.price);
	var fee = parseFloat(req.body.fee);
	
	/* parameters validation */
	if (!qty || isNaN(qty)) {
		errCode = '400';
    	errMsg = 'qty parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	if (!price || isNaN(price)) {
		errCode = '400';
    	errMsg = 'price parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	if (!fee || isNaN(fee)) {
		errCode = '400';
    	errMsg = 'fee parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	if (!user_id || isNaN(user_id)) {
		errCode = '400';
    	errMsg = 'user id parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	if (symbol === null) {
		errCode = '400';
    	errMsg = 'symbol parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	console.log('Buy ' + qty + ' shares of ' + symbol + ' at price ' + price + ' plus fee ' + fee);
	
	
	var is_new_pos = true;
	var cost = qty * price + fee; 
	var db_url = req.db_url;
	var cur_pos, new_pos;
	var user_profile;
	var _db;
	var errCode,errMsg;
	
	mongoClient.connectAsync(db_url)  
    .then(function(db) {
        _db = db;
        console.log('1.find the user:'+user_id);
    	return (_db.collection('users').findOne({'user_id':user_id}));
    })
    
    .then(function(profile) {
        console.log(profile);
        console.log('2.check the cash balance:'+profile.cash + ' cost:'+cost);
    	if (profile.cash < cost) {
    		errCode = '501';
    		errMsg = 'insufficient funds';
    		throw new Error(errCode);
    	}
    	else { 
    		var new_cash = profile.cash - cost;
    		user_profile = profile;
    		user_profile.cash = new_cash;
    		console.log('3.remove the user record');
    		return (_db.collection('users').remove({'_id':profile._id}));
    	}
    })
    
    .then(function(result) {
    	console.log('4.insert the updated user profile');
    	return (_db.collection('users').insert(user_profile))
    })    
    
    .then(function(result) {
    	console.log('5.check user owns the stock');
    	return _db.collection('portfolio').findOne({'user_id':user_id, 'symbol':symbol});
    })
    
    .then(function(pos){
    	if (pos) {
    			console.log('6.user owns the stock then update it');
    			cur_pos = pos;
		    	is_new_pos = false;
		    	cost = pos.cost + cost;
		    	qty = pos.qty + qty;  
		}
		else {
				console.log('6.user does not own the stock');
		}
		
		console.log('7.insert the new or updated pos');	
    	new_pos = {"user_id":user_id,"symbol":symbol,"qty":qty,"cost":cost,"name":name}
    	return (_db.collection('portfolio').insert(new_pos));
    })      
	
	.then(function(result){
		if (is_new_pos == false) {
				console.log('8.remove the old pos');    
				return(_db.collection('portfolio').remove({'_id':cur_pos._id}))
		}
	})
	
	// check if stock symbol is available in stock_price table
	.then(function(result){
		return (_db.collection('stock_price').findOne({'symbol':symbol}));
	})
	
	
	// if the stock symbol is now, add it to the stock_price table
	.then(function(result){
		if (result) {
			console.log(symbol + 'added to stock_price table');
			return true;
		}
		else {
		      new_symbol = {"symbol":symbol, "price":price,"date_time":""};
			  return (_db.collection('stock_price').insert(new_symbol));
		}
	})
	
	.then(function(result){
		if (result) {
			console.log("stocK_price table updated successfully");
		}
		else {
			console.log("stocK_price table update failed");
		}
	})
	
		
	.catch(function(err) {
        if (!errCode){
        	errCode = '500';
        	errMsg = 'generic error';
        }
        
        console.log("errCode:"+errCode+" errMsg:"+errMsg);
        return res.send({'status':errCode,'msg':errMsg});
    })
    
    .finally(function() {
    	if (_db) {
    		_db.close();
    	}
    	if (!errCode){
			console.log('new pos added or updated successfully');
			res.send({'status':'200','msg':'new pos added or updated'});
		}			
	});
});

/* Put sell a stock */
router.put('/', function(req, res) {
	var db = req.db;
	
	/* parameters */
	var user_id = req.body.user_id;
	var symbol = req.body.symbol;
	var name = req.body.name;
	var qty = parseInt(req.body.qty);
	var price = parseFloat(req.body.price);
	var fee = parseFloat(req.body.fee);
	
	/* parameters validation */
	if (!qty || isNaN(qty)) {
		errCode = '400';
    	errMsg = 'qty parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	if (!price || isNaN(price)) {
		errCode = '400';
    	errMsg = 'price parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	if (!fee || isNaN(fee)) {
		errCode = '400';
    	errMsg = 'fee parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	if (!user_id || isNaN(user_id)) {
		errCode = '400';
    	errMsg = 'user id parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	if (symbol === null) {
		errCode = '400';
    	errMsg = 'symbol parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	console.log('Sell ' + qty + ' shares of ' + symbol + ' at price ' + price + ' plus fee ' + fee);
	
	
	var earn = qty * price - fee; 
	var db_url = req.db_url;
	var cur_pos, new_pos;
	var user_profile;
	var _db;
	var errCode,errMsg;
	var new_cost, partial_cost;
	var new_qty;
	
	mongoClient.connectAsync(db_url)  
    
    .then(function(db) {
    	_db = db;
    	console.log('1.check user owns the stock');
    	return _db.collection('portfolio').findOne({'user_id':user_id, 'symbol':symbol});
    })
    
    .then(function(pos){
    	if (pos) {
    			console.log('2.user owns the stock then check the qty');
    			
    			if (qty > pos.qty){
    				console.log('3.user wants to sell more shares than they own');
    				errCode = 503;
    				errMsg = 'insufficient qty';
    				throw new Error(errCode);
    			}
    			
    			cur_pos = pos;
		    	new_cost = pos.cost * (1  - qty/pos.qty)
		    	partial_cost = pos.cost * qty/pos.qty;
		    	new_qty = pos.qty - qty;  
		    	
		    	if (new_qty > 0) {
					console.log('3.insert the updated pos');	
    				new_pos = {"user_id":user_id,"symbol":symbol,"qty":new_qty,"cost":new_cost,"name":name}
    				return (_db.collection('portfolio').insert(new_pos));	
				}
		}
		else {
				console.log('3.user does not own the stock');
    			errCode = 504;
    			errMsg = 'no share to sell';
    			throw new Error(errCode);
    	}
	})
				
	.then(function(result){
		return(_db.collection('portfolio').remove({'_id':cur_pos._id}))
	})
	
	
	.then(function(db) {
        console.log('4.find the user to update their cash');
    	return (_db.collection('users').findOne({'user_id':user_id}));
    })	
    	
    	
    .then(function(profile) {
    	console.log('5.remove the old user profile');
    	user_profile = profile;
    	user_profile.cash = profile.cash + earn;
    	user_profile.realized = user_profile.realized + (earn - partial_cost); 
    	return (_db.collection('users').remove({'_id':profile._id}));
    	
    })
    
    .then(function(result) {
    	console.log('6.insert the updated user profile');
    	return (_db.collection('users').insert(user_profile))
    	
    })
      		
	.catch(function(err) {
		console.log(err);
        if (!errCode){
        	errCode = 500;
        	errMsg = 'generic error';
        }
        
        console.log("errCode:"+errCode+" errMsg:"+errMsg);
        return res.send({'status':errCode,'msg':errMsg});
    })
    
    .finally(function() {
    	if (_db) {
    		_db.close();
    	}
    	if (!errCode){
			console.log('a current pos removed or updated successfully');
			res.send({'status':'200','msg':'a current pos removed or updated'});
		}			
	});
});


// Get Gains
router.get('/gains/:user_id', function(req, res) {   
	var db_url = req.db_url;
	var user_id = req.params.user_id;
	
	/* parameters validation */	
	if (!user_id || isNaN(user_id)) {
		errCode = '400';
    	errMsg = 'user id parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	
	mongoClient.connectAsync(db_url)  
    .then(function(_db) {      
        db = _db;
        return db.collection('gains').findOne({'user_id':user_id});
    })
    
    .then(function(result) {
    
    	if (result != null) {
    		console.log('gains:'+result.gain);
    		res.json({'status':'200','data': {'user_id':user_id,'gain':result.gain}});
    	}
    	else {
    		console.log('gain:[]');
    		res.json({'status':'200','data': {'user_id':user_id,'gain':[]}})
    	}

    })
    
    .catch(function(err) {
        throw err;
        return res.send({'status':'500','response':'error','msg':'generic error'});
    })
    
    .finally(function() {
    	if (req.db) {
    		req.db.close();
    	}
	})
});
	
	
// Get Rankings Global
router.get('/rankings/global/:user_id/count/:count', function(req, res) {   
	var db_url = req.db_url;
	var user_id = req.params.user_id;
	var count = req.params.count;
	
	/* parameters validation */	
	if (!user_id || isNaN(user_id)) {
		errCode = '400';
    	errMsg = 'user id parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	if (!count || isNaN(count)) {
		errCode = '400';
    	errMsg = 'count is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	var rankings = [];
	var users = [];
	var result = [];
	
	mongoClient.connectAsync(db_url)  
    .then(function(_db) {      
        db = _db;
        return db.collection('rankings').find().toArray();
    })
    
    
    .then(function(_ranking) {      
        rankings = _ranking;
        return db.collection('users').find().toArray();
    })
    
    
    .then(function(_users) {
    	users = _users;
    	
    	var rank_index = find_user_index(rankings,user_id);
    	
    	// If no ranking record is found, return the top list up to count
    	if (rank_index < 0) {
    		rank_index = 1;
    	}
    	
    	var min_index = Math.max((rank_index - (parseInt(count)/2),0));
    	var max_index = Math.min(min_index + count, rankings.length);
    	
    	console.log('rank_index='+rank_index + " ,min_index=" + min_index + " ,max_index="+ max_index);
    	
    	for (var rank_index=min_index; rank_index < max_index; rank_index++)
    	{
     		var user_index = find_user_index(users,rankings[rank_index].user_id);		
    		var rank = {};
    		rank.user_id = rankings[rank_index].user_id;
    		rank.gain = rankings[rank_index].gain;
    		rank.gain_pct = rankings[rank_index].gain_pct;
			rank.photo_url = users[user_index].photo_url;
    		rank.rank_global = rank_index;
    		rank.first_name = users[user_index].first_name;
    		rank.last_name = users[user_index].last_name;
    		result.push(rank);
    	}
    	
    	console.log(result);
    	return res.send({'status':'200','data':{'ranking':result}});
    	
    })
    
    .catch(function(err) {
        throw err;
        return res.send({'status':'500','response':'error','msg':'generic error'});
    })
    
    .finally(function() {
    	if (req.db) {
    		req.db.close();
    	}
	})
});	


// Get Rankings Friends
router.get('/rankings/friends/:user_id', function(req, res) {   
	var db_url = req.db_url;
	var user_id = req.params.user_id;
	
	/* parameters validation */	
	if (!user_id || isNaN(user_id)) {
		errCode = '400';
    	errMsg = 'user id parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	var rankings = [];
	var users = [];
	var result = [];
	var stats = {};
	
	mongoClient.connectAsync(db_url)  
    .then(function(_db) {      
        db = _db;
        return db.collection('rankings').find().toArray();
    })
    
    .then(function(_ranking) {      
        rankings = _ranking;
        return db.collection('stats').findOne();
    })
    
    .then(function(_stats) {
    	stats = _stats;
    	return db.collection('users').find().toArray();
    })
    
    .then(function(_users) {
    	users = _users;
    	  
    	// Locate user in rankings array	
    	var user_index = find_user_index(users,user_id);
    	var user_friends_str = users[user_index].friends;
    	
    	
    	if (user_friends_str == null) {
    		return res.send({'status':'200','data':{'ranking':result}});
    	}
    	else {
    		var user_friends_array = user_friends_str.split(',');
    		var friends_no = user_friends_array.length + 1;
    	
    		var index = 0;
    		var user_friends_str_sync = ',' + user_id + ',' + user_friends_str + ',';
    		for (var u in users)
    		{
    			var search_key = ',' + users[u].user_id + ',';
    			if ((user_friends_str_sync.indexOf(search_key) !== -1) && (index < friends_no)) {
    			
    				// Increase index
    				index = index + 1;
    			
    				// Locate user friend in rankings array
    				var friend_rank_index = find_user_index(rankings,users[u].user_id);
    	
    				// Create user rank object
    				var user_rank = {};
    				user_rank.user_id   = users[u].user_id;
					user_rank.photo_url = users[u].photo_url;
    		    	user_rank.first_name = users[u].first_name;
    		    	user_rank.last_name = users[u].last_name;
    		    	if (friend_rank_index > -1) {
    					user_rank.gain = rankings[friend_rank_index].gain;
    		    		user_rank.gain_pct = rankings[friend_rank_index].gain_pct;
    		    		user_rank.rank_global = rankings[friend_rank_index].rank_global;
    		    	}
    		    	else {
    		    		user_rank.gain = '0';
    		    		user_rank.gain_pct = '0';
    		    		console.log('stats =' +  stats);
    		    		user_rank.rank_global = stats.positive_gain_users + 1;
    		    	}
    		    	// Add to the result
    				result.push(user_rank);
    			} 
    		}
    		
    		// Sort the result
    		result.sort(function (a, b) {
  				return b.gain - a.gain;
			})
			
			console.log(result);
    		return res.send({'status':'200','data':{'ranking':result}});
    	}
    	
    })
    
    .catch(function(err) {
        throw err;
        return res.send({'status':'500','response':'error','msg':'generic error'});
    })
    
    .finally(function() {
    	if (req.db) {
    		req.db.close();
    	}
	})
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

function find_user_ranking(ranking_array,_user_id){

	for (var r in ranking_array) {
		if (ranking_array[r] == _user_id) {
			return parseInt(r)+1;
		}
	}
	return -1;
}



			
module.exports = router;