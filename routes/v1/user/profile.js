var express = require('express');
var router = express.Router();
var Promise = require('bluebird');
var mongoClient = Promise.promisifyAll(require('mongodb')).MongoClient;



/* POST add a user */
router.post('/', function(req, res) {
	
	var db_url = req.db_url;
	var db = req.db;
	
	var user_id = req.body.user_id;
	var email = req.body.email;
	var first_name = req.body.first_name;
	var last_name = req.body.last_name;
	var photo_url = req.body.photo_url;
	var friends = req.body.friends
	
	/* parameters validation */	
	if (!user_id || isNaN(user_id)) {
		errCode = '400';
    	errMsg = 'user id parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	if (email === null) {
		errCode = '400';
    	errMsg = 'email parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	if (first_name === null) {
		errCode = '400';
    	errMsg = 'first name parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	if (last_name === null) {
		errCode = '400';
    	errMsg = 'last name parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	
	var cash = 20000;
	var all_users = [];
	var add_users = [];
	var updated_users = [];
	var is_new_user = false;
	
	mongoClient.connectAsync(db_url)  
    .then(function(_db) {      
        db = _db;
        return db.collection('users').find().toArray();
    })
    
    .then(function(_users) {
    	users = _users;
    	var user_index = find_user_index(users,user_id);
    	
    	// create a new record for a new user
    	if (user_index < 0) {
    		is_new_user = true;
    		var new_user = {"user_id":user_id,"email":email,"first_name":first_name,"last_name":last_name,"photo_url":photo_url,"friends":friends,"cash":cash,"credit":cash}
    		console.log('new user is created:' + new_user);
    		add_users.push(new_user);
    	}
    	// check if user is returning user and just update its record
    	else {
    		var muser = users[user_index];
    		muser.email = email;
        	muser.first_name = first_name;
        	muser.last_name = last_name;
        	muser.photo_url = photo_url;
        	muser.friends = friends;
        	add_users.push(muser);
        	updated_users.push(users[user_index]._id);
    	}
    	
    	var friends_array = friends.split(',');
    	var search_key = ',' + user_id + ',';
    	for (f in friends_array) {
    		var friend_index = find_user_index(users,friends_array[f]);
    		if (friend_index >= 0) {
    			var sync_friend_str = ',' + users[friend_index].friends + ',';
    			if (sync_friend_str.indexOf(search_key) == -1) {
    				// add the user to the user's friend's friend list
    				var muser = users[friend_index];
    				if ((muser.friends !== null) && (muser.friends !== "")){
    					muser.friends = muser.friends + ',' ;
    				}
    				muser.friends = muser.friends + user_id;
    				add_users.push(muser);
        			updated_users.push(users[friend_index]._id);
    			}
    		}
    	}    	
    	return db.collection('users').remove(({'_id':{'$in':updated_users}}));
    })

	.then(function(_result) {
		console.log('updated users:');
		console.log(add_users);
		return db.collection('users').insert(add_users);
	})
	
	.then(function(_result) {
		res.json({'status':'200','response':'success'});
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