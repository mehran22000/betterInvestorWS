var express = require('express');
var router = express.Router();

/* POST add a user */
router.post('/', function(req, res) {
	var db = req.db;
	var user_id = req.body.user_id;
	var email = req.body.email;
	var first_name = req.body.first_name;
	var last_name = req.body.last_name;
	var photo_url = req.body.photo_url;
	var friends = req.body.friends
	var cash = 20000;
	
	console.log('user_id:'+user_id);
	console.log('email:'+email);
	console.log('first_name:'+first_name);
	console.log('last_name:'+last_name);
	console.log('photo_url:'+photo_url);
	console.log('friends:'+friends);
	
	db.collection('users').findOne({'id':user_id},function (err, record) {
		if (!record) {
			var user = {"user_id":user_id,"email":email,"first_name":first_name,"last_name":last_name,"photo_url":photo_url,"friends":friends,"cash":cash}		
			db.collection('users').insert(new_user, function(err, result){
        		if (err == null) {
        			console.log('new user added');
        			res.json({'status':'200','response':'success','msg':'new user added'});
        		}
        		else {
        			console.log('err'+err);
        			res.json({'status':'500','response':err});	
        		}
        	});
        }	
        else {
        	record.email = email;
        	record.first_name = first_name;
        	record.last_name = last_name;
        	record.photo_url = photo_url;
        	record.friends = friends;
        	db.collection('users').remove({'id':user_id}, function(err, result){
        		if (err == null) {
        			db.collection('users').insert(record, function(err, result){
        				if (err == null) {
        					console.log('user info updated');
        					res.json({'status':'200','response':'success','msg':'user info updated'});
        				}
        				else {
        					console.log('err'+err);
        					res.json({'status':'500','response':err});
        				}
        			});
        		}
        		else {
        			console.log('err'+err);
        			res.json({'status':'500','response':err});	
        		}		
			});
		}
	})
});


module.exports = router;