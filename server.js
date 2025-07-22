const express = require("express");
const fileUpload = require("express-fileupload");
const cloudinary = require("cloudinary").v2;
const mysql2 = require("mysql2");
const path = require("path");
const fs = require("fs");

const app = express();

const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI("AIzaSyCHiRlPfmoM90e6ksaxF3JPKupQKI2RIS4") 
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });


//  Cloudinary Config
cloudinary.config({
  cloud_name: "di8oy0cf1",
  api_key: "673232512889584",
  api_secret: "NCChczkaLxT6q5EhbbpR7Y17oew"
});

//  Aiven MySQL Connection
const dbUrl = "mysql://avnadmin:AVNS_iKfIhvHZMrzVGFs0d54@mysql-36893ef9-garg05shivam-bd50.c.aivencloud.com:12608/project_summer";
const mySqlVen = mysql2.createConnection(dbUrl);

mySqlVen.connect(err => {
  if (!err)
    console.log("✅ Aiven Connected Successfully!");
  else
    console.error("❌ DB Connection Error:", err.message);
});

//  Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());
app.use(express.static("public"));

//  Serve Homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/index.html"));
});

//  Signup Route
app.post("/signup", function (req, res) {
  // console.log("Signup request received:", req.body);
  const { emailid, pwd, utype } = req.body;
  const sql = "INSERT INTO users (emailid, pwd, utype, status, dos) VALUES (?, ?, ?, 1, CURRENT_DATE())";

  mySqlVen.query(sql, [emailid, pwd, utype], function (err) {
    if (!err)
      res.send("✅ User record saved successfully!");
    else
      res.status(500).send("❌ Signup Error: " + err.message);
  });
});

//  Login Route
app.post("/do-login", function (req, res) {
  const { emailid, pwd } = req.body;
  const sql = "SELECT * FROM users WHERE emailid = ? AND pwd = ?";
  
  mySqlVen.query(sql, [emailid, pwd], function (err, result) {
    if (err) {
      res.status(500).send("❌ Database error: " + err.message);
    } else if (result.length === 0) {
      res.status(401).send("❌ Invalid credentials");
    } else if (result[0].status === 0) {
      res.status(403).send("🚫 Account is blocked");
    } else {
      const userType = result[0].utype;
      const email = result[0].emailid; // ✅
      res.send({
        message: "✅ Login successful!",
        usertype: userType,
        emailid: email // ✅ Now available in frontend
      });
    }
  });
});




//  Submit New Organization
app.post("/submit", async (req, res) => {
  let picurl = "nopic.jpg";

  try {
    if (req.files?.regCert) {
      const filePath = path.join(__dirname, "/public/uploads/", req.files.regCert.name);
      await req.files.regCert.mv(filePath);

      try {
        const cloudRes = await cloudinary.uploader.upload(filePath);
        picurl = cloudRes.secure_url;
        fs.unlinkSync(filePath);
      } catch (uploadErr) {
        return res.status(500).json({ success: false, message: "❌ Cloudinary Upload Error", error: uploadErr.message });
      }
    }

    const {
      txtemailid, txtorgname, txtregnumber, txtaddress, txtcity,
      txtsports, txtwebsite, txtinsta, txtorghead, txtcontactnumber,
      txtotherinfo
    } = req.body;

    const sql = `INSERT INTO organizations 
      (emailid, orgname, regnumber, address, city, sports, website, insta, orghead, contactnumber, picurl, other_info)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
      txtemailid, txtorgname, txtregnumber, txtaddress, txtcity,
      txtsports, txtwebsite, txtinsta, txtorghead, txtcontactnumber,
      picurl, txtotherinfo
    ];

    mySqlVen.query(sql, values, function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: "❌ DB Insert Error", error: err.message });
      }

      return res.json({ success: true, message: "✅ Organization record saved successfully!" });
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "❌ Internal Server Error", error: err.message });
  }
});


//  Get Organization by Email
app.get("/get-org", function (req, res) {
  const emailid = req.query.txtemailid;
  const sql = "SELECT * FROM organizations WHERE emailid = ?";

  mySqlVen.query(sql, [emailid], function (err, results) {
    if (err)
      res.status(500).send("❌ DB Error: " + err.message);
    else
      res.json(results);
  });
});

//  Modify Organization
app.post("/modify-org", async function (req, res) {
  let picurl = req.body.existingPic || "nopic.jpg";

  if (req.files?.regCert) {
    const filePath = path.join(__dirname, "/public/uploads/", req.files.regCert.name);
    await req.files.regCert.mv(filePath);

    try {
      const cloudRes = await cloudinary.uploader.upload(filePath);
      picurl = cloudRes.secure_url;
      fs.unlinkSync(filePath);
    } catch (err) {
      return res.status(500).send("❌ Cloudinary Upload Error: " + err.message);
    }
  }

  const {
    txtemailid, txtorgname, txtregnumber, txtaddress, txtcity,
    txtsports, txtwebsite, txtinsta, txtorghead, txtcontactnumber,
    txtotherinfo
  } = req.body;

  const sql = "UPDATE organizations SET orgname = ?, regnumber = ?, address = ?, city = ?, sports = ?, website = ?, insta = ?, orghead = ?, contactnumber = ?,  picurl = ?, other_info = ? WHERE emailid = ?";

  const values = [
    txtorgname, txtregnumber, txtaddress, txtcity, txtsports,
    txtwebsite, txtinsta, txtorghead, txtcontactnumber,
    picurl, txtotherinfo, txtemailid
  ];

  mySqlVen.query(sql, values, function (err) {
    if (!err)
      res.send("✅ Organization record modified successfully!");
    else
      res.status(500).send("❌ Update Error: " + err.message);
  });
});

// ✅ Email Availability Check Route
app.get("/chk-email", (req, res) => {
  const email = req.query.txtEmail;
  const sql = "SELECT * FROM users WHERE emailid = ?";

  mySqlVen.query(sql, [email], (err, results) => {
    if (err) {
      return res.status(500).send("❌ DB Error: " + err.message);
    }

    if (results.length === 0)
      res.send("Available...");
    else
      res.send("Already Taken...");
  });
});
app.post("/post-tournament", function (req, res) {
  let {emailid,event,doe,toe,address,city,sports,minage,maxage,lastdate,fee,prize,contact} = req.body;

  // ✅ Convert Dates to yyyy-mm-dd
  doe = convertDateFormat(doe);
  lastdate = convertDateFormat(lastdate);

  const sql = `INSERT INTO tournaments (
    rid, emailid, event, doe, toe, address, city, sports, 
    minage, maxage, lastdate, fee, prize, contact
  ) VALUES (
    NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
  )`;

  const values = [
    emailid, event, doe, toe, address, city, sports,
    minage, maxage, lastdate, fee, prize, contact
  ];

  mySqlVen.query(sql, values, function (err) {
    if (!err)
      res.send("✅ Tournament Saved Successfully!");
    else
      res.status(500).send("❌ DB Error: " + err.message);
  });

  // Date conversion helper
  function convertDateFormat(dob) {
    const parts = dob.split("/");
    if (parts.length === 3) {
      const date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      date.setDate(date.getDate() + 1); // 👈 Fix timezone shift
      return date.toISOString().split("T")[0];
    }
    return dob;
  }
});

//----Angular JS -----
app.get("/do-fetch-all-tournament", function(req, res) {
  const email = req.query.emailid;
  const sql = "SELECT * FROM tournaments WHERE emailid = ?";
  mySqlVen.query(sql, [email], function(err, results) {
    if (err) res.status(500).send(err.message);
    else res.json(results);
  });
});

app.get("/delete-tournament", function(req, res) {
  const rid = req.query.rid;
  const sql = "DELETE FROM tournaments WHERE rid = ?";
  mySqlVen.query(sql, [rid], function(err) {
    if (err) res.status(500).send(err.message);
    else res.send("Tournament deleted successfully!");
  });
});

async function extractAadharData(imgurl) {
  const prompt = "Read the text on picture and tell all the information in adhaar card and give output STRICTLY in JSON format {aadhaar_number:'', name:'', gender:'', dob: ''}. Don't give output as string.";

  const imageResp = await fetch(imgurl).then(res => res.arrayBuffer());
  const result = await model.generateContent([
    {
      inlineData: {
        data: Buffer.from(imageResp).toString("base64"),
        mimeType: "image/jpeg"
      }
    },
    prompt
  ]);

  const raw = result.response.text();
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

// 📤 Upload Player Profile (with AI Aadhaar Read)
app.post("/upload-player-profile", async (req, res) => {
  let acardpicurl = "nopic.jpg";
  let profilepicurl = "nopic.jpg";

  try {
    const { emailid, address, contact, game, otherinfo } = req.body;

    if (!req.files?.aadharpic) return res.status(400).send("❌ Aadhaar image required!");

    // 🖼️ Save Aadhaar Pic Temporarily
    const aadharFile = req.files.aadharpic;
    const aadharPath = path.join(__dirname, "/public/uploads/", aadharFile.name);
    await aadharFile.mv(aadharPath);

    // ☁️ Upload Aadhaar Pic to Cloudinary
    const aadharCloud = await cloudinary.uploader.upload(aadharPath);
    acardpicurl = aadharCloud.secure_url;
    if (fs.existsSync(aadharPath)) fs.unlinkSync(aadharPath);

    // 🤖 Extract Aadhaar Data via Gemini
    const jsonData = await extractAadharData(acardpicurl);
    let { aadhaar_number, name, dob, gender } = jsonData;

    // 🔁 Fix DOB (Timezone bug)
    function convertDateFormat(dob) {
      const parts = dob.split("/");
      if (parts.length === 3) {
        const date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        date.setDate(date.getDate() + 1); // 👈 Timezone adjustment
        return date.toISOString().split("T")[0]; // yyyy-mm-dd
      }
      return dob;
    }

    dob = convertDateFormat(dob); // ✅ corrected DOB

    // 📸 Upload Profile Pic
    if (req.files?.profilepic) {
      const profilePath = path.join(__dirname, "/public/uploads/", req.files.profilepic.name);
      await req.files.profilepic.mv(profilePath);
      const profileCloud = await cloudinary.uploader.upload(profilePath);
      profilepicurl = profileCloud.secure_url;
      if (fs.existsSync(profilePath)) fs.unlinkSync(profilePath);
    }

    // 🗃️ Insert into DB
    const sql = `
      INSERT INTO players 
      (emailid, aadhaar_number, name, dob, gender, acardpicurl, profilepicurl, address, contact, game, otherinfo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [emailid,aadhaar_number,name,dob,gender,acardpicurl,profilepicurl,address,contact,game,otherinfo];

    mySqlVen.query(sql, values, (err) => {
      if (err) return res.status(500).send("❌ DB Insert Error: " + err.message);
      res.send("✅ Player profile uploaded successfully with Aadhaar AI!");
    });

  } catch (err) {
    res.status(500).send("❌ Upload Error: " + err.message);
  }
});

//  Modify Player Profile (No Images)
app.post("/modify-player-profile", (req, res) => {
  const { emailid, address, contact, game, otherinfo } = req.body;

  const sql = `
    UPDATE players 
    SET address = ?, contact = ?, game = ?, otherinfo = ? 
    WHERE emailid = ?
  `;
  const values = [address, contact, game, otherinfo, emailid];

  mySqlVen.query(sql, values, (err) => {
    if (err) return res.status(500).send("❌ Update Error: " + err.message);
    res.send("✅ Player profile modified successfully!");
  });
});

//  Fetch Profile By Email
app.get("/get-player-data", (req, res) => {
  const emailid = req.query.emailid;

  const sql = "SELECT * FROM players WHERE emailid = ?";
  mySqlVen.query(sql, [emailid], (err, results) => {
    if (err) return res.status(500).send("❌ DB Fetch Error: " + err.message);
    if (results.length === 0) return res.status(404).send("⚠️ No player found.");
    res.send(results[0]);
  });
});


//  Route: Get All Users for Admin Dashboard
app.get("/get-all-users", (req, res) => {
  const sql = "SELECT emailid, utype, status FROM users";
  
  mySqlVen.query(sql, (err, results) => {
    if (err) {
      console.error("❌ DB Error (get-all-users):", err.message);
      return res.status(500).send(err.message);
    }
    res.json(results); // ✅ Return all user records
  });
});

//  Route: Block a User (status = 0)
app.post("/block-user", (req, res) => {
  const { emailid } = req.body;

  const sql = "UPDATE users SET status = 0 WHERE emailid = ?";
  
  mySqlVen.query(sql, [emailid], (err) => {
    if (err) {
      console.error("❌ DB Error (block-user):", err.message);
      return res.status(500).send(err.message);
    }
    res.send("🟥 User blocked successfully.");
  });
});

// ✅Route: Resume a User (status = 1)
app.post("/resume-user", (req, res) => {
  const { emailid } = req.body;

  const sql = "UPDATE users SET status = 1 WHERE emailid = ?";
  
  mySqlVen.query(sql, [emailid], (err) => {
    if (err) {
      console.error("❌ DB Error (resume-user):", err.message);
      return res.status(500).send(err.message);
    }
    res.send("🟩 User resumed successfully.");
  });
});


//ROUTE: to get all player in admin consol
app.get("/get-all-players", (req, res) => {
  const query = "SELECT emailid, name, game, contact, gender, dob FROM players";
  mySqlVen.query(query, (err, results) => {
    if (err) return res.status(500).send("❌ DB Error: " + err.message);
    res.json(results);
  });
});

// ROut: admin consoole organisation ddrtails
app.get("/get-all-organizations", (req, res) => {
  mySqlVen.query("SELECT * FROM organizations", (err, results) => {
    if (err) return res.status(500).send("❌ DB Error: " + err.message);
    res.json(results);
  });
});


//-- new application for tournament finder
// 🚀 Fetch All Tournaments
// app.get("/fetch-all-tournaments", (req, res) => {
//   mySqlVen.query("SELECT * FROM tournaments", (err, result) => {
//     if (err) return res.status(500).send("❌ DB Error");
//     res.json(result);
//   });
// });

// Fetch tournaments by city and sport (game)
app.get("/fetch-all-tournaments", function (req, resp) {
    // console.log("🎯 Fetching tournaments with filters:", req.query);

    const { kuchCity, kuchGame } = req.query;

    const sql = "SELECT * FROM tournaments WHERE city = ? AND sports = ?";
    mySqlVen.query(sql, [kuchCity, kuchGame], function (err, allRecords) {
        if (err) {
            console.error("❌ MySQL Error:", err);
            resp.status(500).send("Error fetching tournaments");
        } else {
            // console.log("✅ Tournaments found:", allRecords.length);
            resp.send(allRecords);
        }
    });
});
// Fetch distinct cities from tournaments table
app.get("/do-fetch-all-cities", function (req, resp) {
    const sql = "SELECT DISTINCT city FROM tournaments";
    mySqlVen.query(sql, function (err, allRecords) {
        if (err) {
            console.error("❌ MySQL Error:", err);
            resp.status(500).send("Error fetching cities");
        } else {
            resp.send(allRecords);
        }
    });
});

// ---------- update player password
app.post("/update-password", function (req, res) {
  const { emailid, oldpwd, newpwd } = req.body;

  const checkSql = "SELECT * FROM users WHERE emailid = ? AND pwd = ? AND utype = 'Player'";
  mySqlVen.query(checkSql, [emailid, oldpwd], function (err, result) {
    if (err) {
      res.status(500).send("❌ DB Error: " + err.message);
    } else if (result.length === 0) {
      res.status(401).send("❌ Invalid email or old password");
    } else {
      const updateSql = "UPDATE users SET pwd = ? WHERE emailid = ?";
      mySqlVen.query(updateSql, [newpwd, emailid], function (err2) {
        if (err2) {
          res.status(500).send("❌ Failed to update password: " + err2.message);
        } else {
          res.send("✅ Password updated successfully!");
        }
      });
    }
  });
});

// ---------- update organiser password
app.post("/update-password-organiser", function (req, res) {
  const { emailid, oldpwd, newpwd } = req.body;

  const checkSql = "SELECT * FROM users WHERE emailid = ? AND pwd = ? AND utype = 'Organizer'";
  mySqlVen.query(checkSql, [emailid, oldpwd], function (err, result) {
    if (err) {
      res.status(500).send("❌ DB Error: " + err.message);
    } else if (result.length === 0) {
      res.status(401).send("❌ Invalid email or old password");
    } else {
     
      const updateSql = "UPDATE users SET pwd = ? WHERE emailid = ?";
      mySqlVen.query(updateSql, [newpwd, emailid], function (err2) {
        if (err2) {
          res.status(500).send("❌ Failed to update password: " + err2.message);
        } else {
          res.send("✅ Password updated successfully!");
        }
      });
      
    }
  });
});


// 🚀 Start Server
app.listen(2004, () => {
  console.log("🚀 Server Started at Port 2004");
});
