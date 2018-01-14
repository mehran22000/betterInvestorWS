var express = require('express');
var router = express.Router();
var Promise = require('bluebird');
var mongoClient = Promise.promisifyAll(require('mongodb')).MongoClient;


/* Get user portfolio */
router.get('/:user_id', function(req, res) {   
	var db_url = req.db_url;
	
	mongoClient.connectAsync(db_url)  
    .then(function(db) {      
        return db.collection('portfolio').find({'user_id':req.params.user_id}).toArray();
    })
    .then(function(portfolio) {
		res.json({'status':'200','data':portfolio});
    })
    .catch(function(err) {
        throw err;
        return res.send({'status':'500','response':'error','msg':'generic error'});
    })
    .finally(function() {
    	if (req.db) {
    		req.db.close();
    	}
	});
});

/* POST buy a stock */
router.post('/', function(req, res) {
	var db = req.db;
	var user_id = req.body.user_id;
	var symbol = req.body.symbol;
	var qty = parseInt(req.body.qty);
	var price = parseFloat(req.body.price);
	var fee = parseFloat(req.body.fee);

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
    		errCode = 501;
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
    	new_pos = {"user_id":user_id,"symbol":symbol,"qty":qty,"cost":cost}
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
			console.log('new pos added or updated successfully');
			res.send({'status':'200','msg':'new pos added or updated'});
		}			
	});
});

/* Put sell a stock */
router.put('/', function(req, res) {
	var db = req.db;
	var user_id = req.body.user_id;
	var symbol = req.body.symbol;
	var qty = parseInt(req.body.qty);
	var price = parseFloat(req.body.price);
	var fee = parseFloat(req.body.fee);

	var earn = qty * price - fee; 
	var db_url = req.db_url;
	var cur_pos, new_pos;
	var user_profile;
	var _db;
	var errCode,errMsg;
	
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
		    	new_qty = pos.qty - qty;  
		    	if (qty > 0) {
					console.log('3.insert the updated pos');	
    				new_pos = {"user_id":user_id,"symbol":symbol,"qty":new_qty,"cost":new_cost}
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


			
module.exports = router;