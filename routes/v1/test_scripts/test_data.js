var express = require('express');
var router = express.Router();
var Promise = require('bluebird');
var mongoClient = Promise.promisifyAll(require('mongodb')).MongoClient;

var router = express.Router();
// var db_url = "mongodb://mehran:mehrdad781@ds245755.mlab.com:45755/heroku_p0jvg7ms"
var env = require.main.require('./env_config.json');
var db_url = env['db_url'];


// 0. Add remove Test Data (user_id < 1000)





// 1. Add User Test 

router.post('/users/', function(req, res) {
	
	var count = req.body.count;
	var minimum = 1;
	var maximum = 1000;
	
	var users = [];
	for (i = 0; i< count; i++){
	
		var r = Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;	
		var user = {'user_id':r.toString(), 
					'email': r.toString() + "@test.com",
					'first_name' : "test fname " + r.toString(),
					'last_name' : "test lname " + r.toString(),
					'photo_url' : "",
					'friends' : "",
					'cash':20000,
					'credit':20000}
		console.log(user);
		users.push(user);
	}
	
	console.log(users);
	
	mongoClient.connectAsync(db_url)  
    .then(function(db) {
    	_db = db;
    	return _db.collection('users').insert(users);
    })
    
    .then(function(result){
		console.log('test users added!');
		res.json({'status':'200','response':'success'});	
	})	
});


router.put('/users/', function(req, res) {
	
	var real_users = [];
	
	mongoClient.connectAsync(db_url)  
    .then(function(db) {
    	_db = db;
    	return _db.collection('users').find().toArray();
    })
    
    .then(function(users) {
    	for (var u in users) {
			if (u.user_id > 1000) {
    			real_users.push(users[u])
    		}
    	}
    	return _db.collection('users').remove();
    })
            
    .then(function(result) {
    	return _db.collection('users').insert(real_users);
    })
	
	.then(function(result) {
    	console.log('test users removed');
    	res.json({'status':'200','response':'success'});
    })
});



// 2. Add Test Positions for each user

router.post('/portfolio/', function(req, res) {
	
	var count = req.body.count;
	var symbols = ['msft','aapl','amd','intc','ibm','vrx','baba','td','rbc','fb'];
	var names = ['microsoft','Apple','AMD','INTC','IBM','Vualent','Alibaba','Toronto Dominin Bank','Royal Bank of Canada','Facebook'];
	var prices = [91.00,170,12,43,152,18,183,56,98,175];
	
	var test_pos = [];

	mongoClient.connectAsync(db_url)  
        
    .then(function(db) {
    	_db = db;
    	return _db.collection('users').find().toArray();
    })

	.then(function(users){
		for (var c=0; c<count; c++){
			for (var u in users) {
				if (parseInt(users[u].user_id) < 1000) {
					var minimum = 1;
					var maximum = symbols.length - 1;
					var r = Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
					var new_pos = {"user_id":users[u].user_id,"symbol":symbols[r],"qty":r*10,"cost":r*10*prices[r],"name":names[r]}	
					test_pos.push(new_pos);
				}
			}
		}	
		return _db.collection('portfolio').insert(test_pos);	
	})
	
	.then(function(result) {
    	console.log('test positions added to portfolio.');
    	res.json({'status':'200','response':'success'});
    })
});

router.put('/portfolio/', function(req, res) {
	
	var valid_positions = [];
	mongoClient.connectAsync(db_url)  
    
    .then(function(db) {
    	_db = db;
    	return _db.collection('portfolio').find().toArray();
    })
    
    .then(function(positions) {
    	for (var p in positions) {
			if (positions[p].user_id > 1000) {
    			valid_positions.push(positions[p])
    		}
    	}
    	return _db.collection('portfolio').remove();
    })
    
        
    .then(function(result) {
    	return _db.collection('portfolio').insert(valid_positions);
    })
	
	.then(function(result) {
    	console.log('test positions removed');
    	res.json({'status':'200','response':'success'});
    })
});







module.exports = router;