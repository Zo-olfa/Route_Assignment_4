// --- IMPORTS ---
const http = require("node:http");
const fs = require("node:fs");
const express = require("express");

// --- DOTENV ---
require("dotenv").config({
  path: "./.env.local",
});

// --- EXPRESS APP ---
const app = express();
const PORT = process.env.PORT || 80;

// --- MIDDLEWARES ---
const logRouteDetails = (request, response, next) => {
  console.log(`You requested ${request.method.toUpperCase()} ${request.url} Route`);
  next();
};

const checkRequiredPropertyInRequest = (request, response, next, { place, property }) => {
  if (typeof property === "object") {
    for (let i = 0; i < property.length; i++) {
      if (!request[place][property[i]]) {
        return response
          .status(422)
          .json({ status: 422, message: `Request ${place} is missing data` });
      }
    }
  } else if (typeof property === "string") {
    if (!request[place][property]) {
      return response
        .status(422)
        .json({ status: 422, message: `Request ${place} is missing data` });
    }
  }
  next();
};

// --- USING MIDDLEWARE ---
app.use(express.json());
app.use(logRouteDetails);

// --- REUSABLE DATA ---
const usersFileName = "users.json";

const getUsersListFromDB = (response) => {
  try {
    const data = fs.readFileSync(usersFileName, "utf8") || null;
    return JSON.parse(data) || [];
  } catch (err) {
    console.error("Error while read file:", err);
    response.status(400).json({
      status: 400,
      message: "Error while getting data from DB",
    });

    return [];
  }
};

const updateUsersListInDB = ({ list, newUser, flag, response }) => {
  try {
    const newUsersList = [];
    if (list && !flag && !newUser) {
      // if new users list update it
      newUsersList.push(...list);
    } else if (newUser) {
      const usersList = list || getUsersListFromDB(response) || [];
      if (flag === "add") {
        newUsersList.push(...usersList, newUser);
      } else if (flag === "update") {
        usersList.forEach((user) => {
          if (user.id === newUser.id) {
            Object.assign(user, newUser);
          }
        });
        newUsersList.push(...usersList);
      } else if (flag === "delete") {
        newUsersList.push(...usersList.filter((user) => user.id !== newUser.id));
      }
    }
    // update the file database
    return fs.writeFileSync(usersFileName, JSON.stringify(newUsersList));
  } catch (error) {
    console.error("Error while update file:", error);
    response.status(500).json({ status: 500, message: "Error updating user in file" });
    return;
  }
};

const getSingleUserByProperty = ({ prName, prValue, response, usersList }) => {
  const users = usersList || getUsersListFromDB(response) || [];
  return users.find((user) => user[prName] === prValue);
};

// --- ROUTES ---

// 1. Create an API that adds a new user to your users stored in a JSON file. (ensure that the email of the new user doesn’t exist before)(1 Grades)
app.post(
  "/user",
  (req, res, next) =>
    checkRequiredPropertyInRequest(req, res, next, {
      place: "body",
      property: ["name", "age", "email"],
    }),
  (request, response) => {
    const { name, age, email } = request.body || {};

    const usersList = getUsersListFromDB(response);
    const isEmailFound = getSingleUserByProperty({
      prName: "email",
      prValue: email,
      response,
      usersList,
    });
    if (isEmailFound) {
      return response.status(409).json({
        status: 409,
        message: "User email is already exists",
      });
    }
    const newUser = {
      id: usersList[usersList.length - 1]?.id + 1 || 1,
      name,
      age,
      email,
    };
    updateUsersListInDB({ list: usersList, flag: "add", newUser, response });
    response.status(200).json({ status: 200, message: "User added successfully" });
  },
);

// 2. Create an API that updates an existing user's name, age, or email by their ID. The user ID should be retrieved from the params. (1 Grade)
app.patch(
  "/user/:id",
  (req, res, next) =>
    checkRequiredPropertyInRequest(req, res, next, {
      place: "params",
      property: "id",
    }),
  (request, response) => {
    const userID = Number(request.params.id);
    const foundUser = getSingleUserByProperty({
      prName: "id",
      prValue: userID,
      response,
    });
    if (!foundUser) {
      return response.status(404).json({ status: 404, message: "User id not found" });
    }

    const { name, age, email } = request.body || {};

    if (email) {
      const isEmailFound = getSingleUserByProperty({
        prName: "email",
        prValue: email,
        response,
      });
      if (isEmailFound) {
        return response.status(409).json({
          status: 409,
          message: "User email is already exists",
        });
      }
    }

    Object.assign(foundUser, {
      name: name || foundUser.name,
      age: age || foundUser.age,
      email: email || foundUser.email,
    });
    updateUsersListInDB({ flag: "update", newUser: foundUser, response });

    response.status(200).json({ status: 200, message: "User updated successfully" });
  },
);

// 3. Create an API that deletes a User by ID. The user id should be retrieved from either the request body or optional params. (1 Grade)
app.delete("/user{/:id}", (request, response) => {
  const userID = Number(request.params.id) || Number(request.body.id) || null;
  if (!userID) {
    return response.status(422).json({ status: 422, message: "Required user id is missing" });
  }

  const foundUser = getSingleUserByProperty({ prName: "id", prValue: userID, response });
  if (!foundUser) {
    return response.status(404).json({ status: 404, message: "User id not found" });
  }

  updateUsersListInDB({ newUser: foundUser, flag: "delete", response });
  response.status(200).json({ status: 200, message: "User deleted successfully" });
});

// 4. Create an API that gets a user by their name. The name will be provided as a query parameter. (1 Grade)
app.get(
  "/user/getByName",
  (req, res, next) =>
    checkRequiredPropertyInRequest(req, res, next, {
      place: "query",
      property: "name",
    }),
  (request, response) => {
    const userName = request.query.name;
    const foundUser = getSingleUserByProperty({ prName: "name", prValue: userName, response });
    if (!foundUser) {
      return response.status(404).json({ status: 404, message: "User name not found" });
    }
    response.status(200).json({ status: 200, data: foundUser });
  },
);

// 5. Create an API that gets all users from the JSON file. (1 Grade)
app.get("/user", (request, response) => {
  const usersList = getUsersListFromDB(response);
  response.status(200).json({ status: 200, data: usersList });
});

// 6. Create an API that filters users by minimum age. (1 Grade)
// o URL: GET /user/filter
app.get(
  "/user/filter",
  (req, res, next) =>
    checkRequiredPropertyInRequest(req, res, next, {
      place: "query",
      property: "minAge",
    }),
  (request, response) => {
    const minAge = Number(request.query.minAge);
    const usersList = getUsersListFromDB(response);
    const filteredUsers = usersList.filter((user) => user.age >= minAge);
    if (!filteredUsers.length) {
      return response.status(404).json({ status: 404, message: "No user found" });
    }

    response.status(200).json({ status: 200, data: filteredUsers });
  },
);

// 7. Create an API that gets User by ID. (1 Grade)
app.get(
  "/user/:id",
  (req, res, next) =>
    checkRequiredPropertyInRequest(req, res, next, {
      place: "params",
      property: "id",
    }),
  (request, response) => {
    const userID = request.params.id;
    const foundUser = getSingleUserByProperty({
      prName: "id",
      prValue: Number(userID),
      response,
    });
    if (!foundUser) {
      return response.status(404).json({ status: 404, message: "User id not found" });
    }
    response.status(200).json({ status: 200, data: foundUser });
  },
);

// --- NOT FOUND HANDLER ---
app.all("/*dummy", (req, res) => {
  res.status(404).json({ status: 404, message: "Not Found Router!!" });
});

// --- SERVER LISTENER ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
