const express = require('express');
const { rejectUnauthenticated } = require('../modules/authentication-middleware');
const encryptLib = require('../modules/encryption');
const pool = require('../modules/pool');
const userStrategy = require('../strategies/user.strategy');

const router = express.Router();

// Handles Ajax request for admin information if admin is authenticated
router.get('/', rejectUnauthenticated, (req, res) => {
  // Send back user object from the session (previously queried from the database)
  res.send(req.user);
});

router.post('/register', async (req, res, next) => {
  console.log('register admin req.body:', req.body)
  const connection = await pool.connect()
  try{
    await connection.query('BEGIN');
    const addAdmin = 'INSERT INTO "admin" (username, password) VALUES ($1, $2) RETURNING id'; 
    const username = req.body.username;
    const password = encryptLib.encryptPassword(req.body.password);
    const result = await connection.query(addAdmin, [username, password])
    //save the id of the admin we're creating to use in next insert
    const adminId = result.rows[0].id;
    const addAdminContact = `INSERT INTO "admin_contact" ("admin_id", "first_name", "last_name", "title", "organization", "phone_number", "email_address", "street_address", "street_address2", "city", "state", "zipcode")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`;
    const contactValues = [adminId, req.body.firstName, req.body.lastName, req.body.title, req.body.organization, req.body.phoneNumber, req.body.emailAddress, req.body.streetAddress, req.body.streetAddressTwo, req.body.city, req.body.state, req.body.zipcode]
    await connection.query(addAdminContact, contactValues);
    await connection.query('COMMIT');
    res.sendStatus(200);
  }catch(error){
		//if any of the above steps fail, abort the entire transaction so no bad info gets into database
		await connection.query('ROLLBACK');
		console.log('Transaction error - rolling back review entry:', error);
		res.sendStatus(500);
	}finally{
		connection.release()
	}
});

// Handles login form authenticate/login POST
// userStrategy.authenticate('local') is middleware that we run on this route
// this middleware will run our POST if successful or send a 404 if not successful
router.post('/login', userStrategy.authenticate('local'), (req, res) => {
  res.sendStatus(200);
});

// clear all server session information about this admin
router.post('/logout', (req, res) => {
  // Use passport's built-in method to log out the admin
  req.logout();
  res.sendStatus(200);
});

module.exports = router;
