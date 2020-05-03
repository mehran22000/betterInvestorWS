var express = require('express');
var router = express.Router();
var Promise = require('bluebird');
var mongoClient = Promise.promisifyAll(require('mongodb')).MongoClient;

// Enter copied or downloaded access ID and secret key here
const ID = '<ID>';
const SECRET = '<Secret>';
const AWS = require('aws-sdk');
const s3 = new AWS.S3({
    accessKeyId: ID,
    secretAccessKey: SECRET
});


/* POST add a user */
router.post('/', function(req, res) {
	
	var db_url = req.db_url;
	var db = req.db;
	
	var user_id = req.body.user_id;
	var email = req.body.email;
	var first_name = req.body.first_name;
	var last_name = req.body.last_name;
	var photo_url = req.body.photo_url;
	
	// ToDo: investigate if there should be a callback here or not
	uploadProfilePhoto(photo_url,user_id);	
	
	var friends = req.body.friends
	var friends_pic = req.body.friends_pic
	
	/* parameters validation */	
	if (!user_id || isNaN(user_id)) {
		errCode = '400';
    	errMsg = 'user id parameter is invalid';
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
	var realized = 0;
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
    		var new_user = {"user_id":user_id,"email":email,"first_name":first_name,"last_name":last_name,"photo_url":photo_url,"friends":friends,"cash":cash,"credit":cash, "realized":realized}
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
    	
    	var friends_array, friends_pic_array;
    	
    	if (friends != null) {
    		friends_array = friends.split(',');
    	}
    	if (friends_pic != null) {
    		friends_pic_array = friends_pic.split(',');
    	}
    	
    	if ((friends_array != null) && (friends_pic_array != null)) {
    	
    		var search_key = ',' + user_id + ',';
    		for (f in friends_array) {
    			var friend_index = find_user_index(users,friends_array[f]);
    			if (friend_index >= 0) {
    				var user_info_changed = false;
    		    	var muser = users[friend_index];
    			
    				var sync_friend_str = ',' + users[friend_index].friends + ',';
    				if (sync_friend_str.indexOf(search_key) == -1) {
    					// add the user to the user's friend's friend list
    					if ((muser.friends !== null) && (muser.friends !== "")){
    						muser.friends = muser.friends + ',' ;
    					}
    					muser.friends = muser.friends + user_id;
    					user_info_changed = true;
    				}
    			
    				// update friend photo url if it is required
    				if (users[friend_index].photo_url !== friends_pic_array[f]) {
						muser.photo_url = friends_pic_array[f];
    					user_info_changed = true;
    				}
    			
    				if (user_info_changed == true) {
    					add_users.push(muser);
        				updated_users.push(users[friend_index]._id);
    				}
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

// Post add credit
router.post('/credit', function(req, res) {
	
	var db_url = req.db_url;
	var db = req.db;
	var user;
	var amount;
	var user_id = req.body.user_id;
	var source = req.body.source;
	
	if (source == "referral") {
		amount = 1000;
	} 
	else if (source == "20k_inapp_cash_credit") {
		amount = 20000;
	}
	else if (source == "50k_inapp_cash_credit") {
		amount = 50000;
	}
	else {
		amount = 0;
	}
	console.log('add ' + source + " amount:" + amount + " user:" + user_id);
	
	/* parameters validation */	
	if (!user_id || isNaN(user_id)) {
		errCode = '400';
    	errMsg = 'user id parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	if (!amount || isNaN(amount)) {
		errCode = '400';
    	errMsg = 'amount parameter is invalid';
    	console.log(errMsg);
    	throw new Error(errCode);
	}
	
	mongoClient.connectAsync(db_url)  
    .then(function(_db) {      
        db = _db;
        return db.collection('users').findOne({'user_id':user_id});
    })
    
    .then(function(_user) {
    	user = _user;
    	user.cash = user.cash + amount;	   	
    	return db.collection('users').remove({'user_id':user_id});
    })
    	
	.then(function(_result) {
		console.log('1.old user record is removed');
		return db.collection('users').insert(user);
	})
	
	.then(function(_result) {
		console.log('2.updated user record is inserted');
		var date = new Date();
		var log = {'user_id':user.user_id, 'date':date.yyyymmdd(), 'action':'credit ' + amount, 'source':source}
		return db.collection('logs').insert(log);
	})
	
	
	.then(function(_result) {
		console.log('3.log record is inserted');
		res.json({'status':'200','response':'success'});
	})
	
	.catch(function (err) {
		console.log(err);
	});
	
});


/* Auxiliary functions */

function uploadProfilePhoto(url,name) {
	console.log('uploadProfilePhoto');
	console.log(url);
	console.log(name);
	var https = require('https'),                                                
    Stream = require('stream').Transform,                                  
    fs = require('fs');                                                    

	https.request(url, function(response) {                                        
  		var data = new Stream();                                                    
  		response.on('data', function(chunk) {                                       
    		data.push(chunk);                                                         
  		});                                                                         
  		response.on('end', function() {                                             
			fs.writeFileSync(name, data.read()); 
			uploadFileToS3(name);                              
  		});                                                                         
	}).end();
}


const uploadFileToS3 = (fileName) => {
    // Read content from the file
	console.log('uploadFileeToS3');
	console.log(fileName);
	fs = require('fs');
	const fileContent = fs.readFileSync(fileName);

    // Setting up S3 upload parameters
    const params = {
        Bucket: 'socialtrader132303-prod',
        Key: 'public/' + fileName + '.jpg', // File name you want to save as in S3
        Body: fileContent
    };

    // Uploading files to the bucket
    s3.upload(params, function(err, data) {
        if (err) {
            throw err;
        }
        console.log(`File uploaded successfully. ${data.Location}`);
    });
};













function find_user_index(users_array,_user_id){

	for (var a in users_array) {
		if (users_array[a].user_id == _user_id) {
			return a;
		}
	}
	return -1;
}




module.exports = router;