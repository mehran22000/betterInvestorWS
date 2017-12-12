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
	
	console.log('user_id'+user_id);
	
	db.collection('users').findOne({'id':user_id},function (err, record) {
		if (!record) {
			var new_user = {"user_id":user_id,"email":email,"first_name":first_name,"last_name":last_name,"photo_url":photo_url,"friends":friends, "cash":cash}
			db.collection('users').insert(new_user, function(err, result){
        		if (err == null) {
        			console.log('new user added');
        			res.json({'status':'200','response':'success','msg':'new user added'});
        			}
        		});
        	}	
        	else {
        			console.log('duplicate user');
        			res.json({'status':'500','response':'error','msg':'duplicate user'});
        		}	
			})
		});


module.exports = router;