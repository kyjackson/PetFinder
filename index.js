const express = require('express');
const app = express();
const mysql = require('mysql');
const fetch = require("node-fetch");
const https = require('https');
const axios = require('axios').default;
const petfinder = require("@petfinder/petfinder-js");
const client = new petfinder.Client({apiKey: "xGuOIWMLc2BR0zFXcMSdMoLPe5dko8hdHm7ncHJqmcVuBA7iHx", secret: "1ix8XcU6Ih4GLPwJCRWrVAKCJ2Fu68pyFIbLctvR"});
const session = require('express-session');
const pool = dbConnection();
//const querystring = require('querystring');
//const fs = require('fs');

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({extended: true}));

//---------------------------------------------Middleware and session setup---------------------------------------------------

//store user's info when they log in
var user = {
  userId: 0,
  username: ""
};

//function for authenticating user login
function isAuthenticated(req, res, next) {
  if(!req.session.authenticated) {
    res.redirect("/login");
  } else {
    next();
  }
}


//sessions
app.use(session({
  secret: "secret!",
  resave: false,
  saveUninitialized: true
}));

//--------------------------------------------------API post info--------------------------------------------------

getApiAuth();

var tokenType = "";
var expiresIn = 0;
var accessToken = "";

async function getApiAuth(){

  

  axios
    .post('https://api.petfinder.com/v2/oauth2/token', {
      grant_type: "client_credentials",
      client_id: "xGuOIWMLc2BR0zFXcMSdMoLPe5dko8hdHm7ncHJqmcVuBA7iHx",
      client_secret: "1ix8XcU6Ih4GLPwJCRWrVAKCJ2Fu68pyFIbLctvR"
    })
    .then((res) => {
      console.log(`statusCode: ${res.status}`)
      //console.log(res.data)

      tokenType = res.data.token_type;
      expiresIn = res.data.expires_in;
      accessToken = res.data.access_token;

      //console.log(`token type: ${tokenType}\nexpires in: ${expiresIn}\naccess token: ${accessToken}`);

      //getAnimals();

    })
    .catch((error) => {
      console.error(error)
    })

}



async function getAnimals() {

  axios
    .get('https://api.petfinder.com/v2/animals?type=dog', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })
    .then(function (res) {
      console.log(res.data.animals[0]);
    })
    .catch(function (error) {
      console.log(error);
    }) 
}

function getDogs() {
  let dogs = [];

  getApiAuth();

  axios
    .get('https://api.petfinder.com/v2/animals?type=dog', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })
    .then(function (response) {
      let i = 0;
      while (dogs.length < 3) {
        if (response.data.animals[i].photos.length > 0) {
          dogs.push(response.data.animals[i]);
          //i++;
        }
        i++;
      }

      //dogs = [response.data.animals[0], response.data.animals[1], response.data.animals[2]];
      console.log(dogs);
      return dogs;
      
      // res.render('home', {
      //   "dogs": dogs,
      //   authenticated: req.session.authenticated,
      //   user: user
      // });
    })
    .catch(function (error) {
      console.log(error);
    })
}



//--------------------------------------------------Routes--------------------------------------------------

//home route
app.get('/', function(req, res) {
  getApiAuth();
  let results = [];
  axios
    .get('https://api.petfinder.com/v2/animals?page=2', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })
    .then(function (response) {
      let i = 0;
      console.log(response.data);
      while (results.length < 10) {
        // if (response.data.animals[i].photos.length > 0 && response.data.animals[i].primary_photo_cropped != null) {
        //   results.push(response.data.animals[i]);
        //   //i++;
        // }
        results.push(response.data.animals[i]);
        i++;
      }

      
      
      res.render('home', {
        "results": results,
        authenticated: req.session.authenticated,
        user: user
      });
    })
    .catch(function (error) {
      console.log(error);
    })

  // res.render('home', {
  //   authenticated: req.session.authenticated,
  //   user: user
  // }); 
});

//login GET route
app.get("/login", function(req, res) {
  res.render('login', {
    error: "",
    authenticated: req.session.authenticated,
    user: user
  })
});

//login POST route
app.post('/login', async (req, res) => {
  req.session.authenticated = false;
  authenticated = req.session.authenticated;

  //check credentials here
  let password = "";
  
  //getting user input using POST method
  let usernameInput = req.body.username; 
  let passwordInput = req.body.password;

  //get username and password from database
  let sql = "SELECT * FROM pf_users WHERE username = ?";
  let rows = await executeSQL(sql, [usernameInput]);

  if(rows.length > 0) {
    password = rows[0].password; //value of password from database
  }

  //check if password input matches the username's associated password from the database
  let passwordMatch = (password == passwordInput);

  if(passwordMatch) {

    user.userId = rows[0].userId;
    user.username = rows[0].username;

    req.session.authenticated = true;
    // res.render("home", {
    //   authenticated: req.session.authenticated,
    //   user: user
    // });

    res.redirect("/");
    
  } else {

    user.userId = 0;
    user.username = "";

    res.render("login", {
      error: "Invalid credentials",
      authenticated: req.session.authenticated,
      user: user
    });

  }
});

//logout route
app.get('/logout', (req, res) => {
  user.userId = 0;
  user.username = "";

  req.session.destroy();
  res.redirect("/");
});

//register GET route
app.get("/register", function(req, res) {
  res.render('register', {
    authenticated: req.session.authenticated,
    user: user
  });
});

//register POST route
app.post('/register', async (req, res) => {
  let rowAffected = false;
  if(req.body.username){
    let sql = "INSERT INTO pf_users (username, password) VALUES (?,?)";
    let params = [req.body.username, req.body.password];
    var rows = await executeSQL(sql, params);

    if (rows.affectedRows == 1) {
      rowAffected = true;
    }
  }

  res.render('register', {
    "userAdded": rowAffected,
    authenticated: req.session.authenticated,
    user: user
  });
});

//search route
app.get("/search", async function(req, res) {
  
  res.render('search', {
    authenticated: req.session.authenticated,
    user: user
  })
});

//results route
app.get("/results", async function(req, res) {

  let params = `https://api.petfinder.com/v2/animals?page=2&`;
  let zipcode = req.query.zipcode;
  let type = req.query.type;

  if (req.query.zipcode) { //if zip code was entered
    params += `location=${zipcode}&`;
  }

  if (req.query.type) { //if type was selected
    params += `type=${type}&`;
    //params.push(req.query.time);
  }

  axios
    .get(params, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })
    .then(function (response) {
      let results = response.data;
      console.log(response.data);

      console.log(results.animals[0]);

      res.render('results', {
        "results": results,
        authenticated: req.session.authenticated,
        user: user
      });
    })
    .catch(function (error) {
      console.log(error);
    })
});

//adoption route
app.get("/adoption", function(req, res) {
  res.render('adoption');
});

//--------------------------------------------------Endpoints--------------------------------------------------

app.get('/animals/:animalId', async (req, res) => {
  const animalId = req.params.animalId;

  getApiAuth();

  axios
    .get(`https://api.petfinder.com/v2/animals/${animalId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })
    .then(function (response) {
      let data = response.data;
      console.log(response.data);

      res.render('petProfile', {
        "data": data,
        authenticated: req.session.authenticated,
        user: user
      });
      
    })
    .catch(function (error) {
      console.log(error);
    })
    
})

//--------------------------------------------------SQL database and server start functions--------------------------------------------------

//use this function to retrieve data from the SQL database
async function executeSQL(sql, params) {
  return new Promise(function(resolve, reject) {
    //let conn = dbConnection();

    pool.query(sql, params, function(err, rows, fields) {
      if (err) throw err;
      resolve(rows);
    });
  });
}

//database
function dbConnection() {

  const pool = mysql.createPool({
    connectionLimit: 1000,
    host: "wiad5ra41q8129zn.cbetxkdyhwsb.us-east-1.rds.amazonaws.com",
    user: "qf7d0xcoxx04dr6v",
    password: "a0twz7veq2mv2s8a",
    database: "yto45t25jp313qtq"
  });

  return pool;

} //dbConnection

app.listen(3000, () => {
  console.log('server started');
});











//--------------------------------------------------Old Code--------------------------------------------------

//let dogs = [];

  // getApiAuth();

  // axios
  //   .get('https://api.petfinder.com/v2/animals', {
  //     headers: {
  //       Authorization: `Bearer ${accessToken}`
  //     }
  //   })
  //   .then(function (response) {
  //     let i = 0;
  //     console.log(response.data);
  //     while (dogs.length < 4) {
  //       if (response.data.animals[i].photos.length > 0) {
  //         dogs.push(response.data.animals[i]);
  //         //i++;
  //       }
  //       i++;
  //     }

      
      
  //     res.render('home', {
  //       "dogs": dogs,
  //       authenticated: req.session.authenticated,
  //       user: user
  //     });
  //   })
  //   .catch(function (error) {
  //     console.log(error);
  //   })


  // client.animal.search()
  // .then(resp => {
  //   //console.log(resp.data);

  //   let i = 0;
  //   while (dogs.length < 8) {
  //     if (resp.data.animals[i] != undefined && resp.data.animals[i].primary_photo_cropped != null) {
  //       dogs.push(resp.data.animals[i]);
  //       //console.log(resp.data.animals[i]);
  //       //i++;
  //     }
  //     i++;
  //   }
  //   console.log(dogs);

  //   res.render('home', {
  //     "dogs": dogs,
  //     authenticated: req.session.authenticated,
  //     user: user
  //   });
  // })
  // .catch(function (error) {
  //   console.log(error);
  // })