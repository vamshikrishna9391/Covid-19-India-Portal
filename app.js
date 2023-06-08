const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "./covid19IndiaPortal.db");
let db = null;

const installDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running At Port : 3000");
    });
  } catch (e) {
    console.log(e.message);
  }
};

installDBAndServer();

// API 1

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const getUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(getUserQuery);

  if (dbUser !== undefined) {
    const authenticatePassword = await bcrypt.compare(
      password,
      dbUser.password
    );

    if (authenticatePassword) {
      const payload = { username: username };
      const jwtToken = await jwt.sign(payload, "MY_SECRET_TOKEN");
      console.log(jwtToken);

      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

const authenticateToken = async (request, response, next) => {
  let jwtToken;
  const authenticate = request.headers["authorization"];
  if (authenticate !== undefined) {
    jwtToken = authenticate.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    const payload = jwt.verify(
      jwtToken,
      "MY_SECRET_TOKEN",
      async (error, user) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          next();
        }
      }
    );
  }
};

// API 2

app.get("/states/", authenticateToken, async (request, response) => {
  const getStateQuery = `
    SELECT 
        state_id AS stateId,
        state_name AS stateName,
        population AS population
    FROM  
        state;
    `;

  const dbResponse = await db.all(getStateQuery);
  response.send(dbResponse);
});

// API 3. GET a state

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    SELECT 
        state_id AS stateId,
        state_name AS stateName,
        population
    FROM  
        state
    WHERE 
        state_id = ${stateId};
    `;

  const dbResponse = await db.get(getStateQuery);
  response.send(dbResponse);
});

// API 4. POST

app.post("/districts/", authenticateToken, async (request, response) => {
  const givenDistrictDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = givenDistrictDetails;
  const postQuery = `
    INSERT INTO 
        district(district_name,state_id,cases,cured,active,deaths)
    VALUES(
        '${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths}
    );
    `;

  await db.run(postQuery);
  response.send("District Successfully Added");
});

// API 5. GET a district

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT 
        district_id AS districtId,
        district_name AS districtName,
        state_id AS stateId,
        cases,
        cured,
        active,
        deaths
    FROM  
        district
    WHERE 
        district_id = ${districtId};
    `;
    const dbResponse = await db.get(getDistrictQuery);
    response.send(dbResponse);
  }
);

//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

// app.get("/districts/:districtId/state", async (request, response) => {
//   const { districtId } = request.params;

//   const getDistrictQuery = `
//     SELECT
//         district_id AS districtId,
//         district_name AS districtName,
//         state_id AS stateId,
//         cases,
//         cured,
//         active,
//         deaths
//     FROM
//         district
//     WHERE
//         state_id = ${districtId}
//     `;
//   const dbResponse = await db.all(getDistrictQuery);
//   response.send(dbResponse);
// });

//API 6. DELETE a district

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM 
        district 
    WHERE 
        district_id = ${districtId}
    `;

    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

// API 7. PUT

app.put(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const givenDistrictDetails = request.body;
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = givenDistrictDetails;
    const putQuery = `
    UPDATE 
        district
    SET
        district_name = '${districtName}',
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
    WHERE 
        district_id = ${districtId}
    ;
    `;

    await db.run(putQuery);
    response.send("District Details Updated");
  }
);

// API 8. GET

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getCasesQuery = `
    SELECT
     SUM(cases) AS totalCases,
     SUM(cured) AS totalCured,
     SUM(active) AS totalActive,
     SUM(deaths) AS totalDeaths
    FROM 
        district
    WHERE 
        state_id = ${stateId}
    `;
    const dbResponse = await db.get(getCasesQuery);
    response.send(dbResponse);
  }
);

// API 8. GET

// app.get("/districts/:districtId/details/", async (request, response) => {
//   const { districtId } = request.params;
//   const getDistrictQuery = `
//     SELECT
//         state_name AS stateName
//     FROM
//         district NATURAL JOIN state
//     WHERE
//         district_id = ${districtId}
//     `;

//   const dbResponse = await db.get(getDistrictQuery);
//   response.send(dbResponse);
// });
module.exports = app;
