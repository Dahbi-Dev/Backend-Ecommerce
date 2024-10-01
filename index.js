const express = require("express");
require("dotenv").config();

const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs"); 

const path = require("path");
const bcrypt = require("bcrypt");
const saltRounds = 10;

const { error } = require("console");

app.use(express.json());
app.use(cors());

// Use environment variables
const port = process.env.PORT || 4000; // Fallback to 4000 if PORT is not set
const mongoUsername = process.env.MONGO_USERNAME;
const mongoPassword = process.env.MONGO_PASSWORD;
const jwtSecret = process.env.JWT_SECRET;

// Connect to MongoDB using environment variables
mongoose.connect(
  `mongodb+srv://${mongoUsername}:${mongoPassword}@cluster0.8wpmx.mongodb.net/e-commerce`
);

// API  Creation :
app.get("/", (req, res) => {
  res.send("Express App is Running");
});

// image storage engine
const storage = multer.diskStorage({
  destination: "./upload/images",
  filename: (req, file, cb) => {
    return cb(
      null,
      `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

const upload = multer({ storage: storage });

// creating upload endpoint for images
app.use("/images", express.static("upload/images"));
app.post("/upload", upload.single("product"), (req, res) => {
  res.json({
    success: 1,
    image_url: `https://backend-ecommerce-gibj.onrender.com/images/${req.file.filename}`,
  });
});

// schema for creating products

const Product = mongoose.model("Product", {
  id: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  new_price: {
    type: Number,
    required: true,
  },
  old_price: {
    type: Number,
    required: true,
  },
  description: { // New field for description
    type: String,
    required: false,
  },
 
  date: {
    type: Date,
    default: Date.now,
  },
  available: {
    type: Boolean,
    default: true,
  },
});


app.post("/addproduct", async (req, res) => {
  let products = await Product.find({});
  let id;
  if (products.length > 0) {
    let last_product_array = products.slice(-1);
    let last_product = last_product_array[0];
    id = last_product.id + 1;
  } else {
    id = 1;
  }
  const product = new Product({
    id: id,
    name: req.body.name,
    image: req.body.image,
    category: req.body.category,
    new_price: req.body.new_price,
    old_price: req.body.old_price,
  });
  // console.log(product);
  await product.save();
  console.log("Saved");
  res.json({
    success: true,
    name: req.body.name,
  });
});

// Deleting Products
app.post("/removeproduct", async (req, res) => {
  await Product.findOneAndDelete({ id: req.body.id });
  console.log("Removed");
  res.json({
    success: true,
    name: req.body.name,
  });
});

// Api For show All Products
app.get("/allproducts", async (req, res) => {
  let products = await Product.find({});
  // console.log("All Products Fetched");
  res.send(products);
});

//Schema creating for user Model

const Users = mongoose.model("Users", {
  name: {
    type: String,
  },
  email: {
    type: String,
    unique: true,
  },
  password: {
    type: String,
  },
  cartData: {
    type: Object,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

// creating EndPoint for registering the user

app.post("/signup", async (req, res) => {
  let check = await Users.findOne({ email: req.body.email });
  if (check) {
    console.log("This email already registered");
    return res.status(400).json({
      success: false,
      errors: "existing user found with the same email address",
    });
  }

  let cart = {};
  for (let i = 0; i < 300; i++) {
    cart[i] = 0;
  }

  // Hash the password before saving it
  const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);

  const user = new Users({
    name: req.body.username,
    email: req.body.email,
    password: hashedPassword, // Save hashed password
    cartData: cart,
  });

  await user.save();
  console.log("User created successfully");

  const data = {
    user: {
      id: user.id,
    },
  };

  const token = jwt.sign(data, "secret_ecom");
  res.json({ success: true, token });
});

// creating endpoint for the user login
app.post("/login", async (req, res) => {
  let user = await Users.findOne({ email: req.body.email });
  if (user) {
    // Compare the provided password with the hashed password in the database
    const passCompare = await bcrypt.compare(req.body.password, user.password);
    if (passCompare) {
      const data = {
        user: {
          id: user.id,
        },
      };

      const token = jwt.sign(data, "secret_ecom");
      res.json({ success: true, token });
    } else {
      res.status(403).json({ success: false, errors: "Wrong password" });
    }
  } else {
    res.status(400).json({ success: false, errors: "Wrong email address" });
  }
});

// creating  new end point for new Collection;
app.get("/newCollection", async (req, res) => {
  let products = await Product.find({});
  let newcollection = products.slice(1).slice(-8);
  console.log("NewCollection Fetched");
  res.send(newcollection);
});

// creating new endpoint for popular women
app.get("/popularwomen", async (req, res) => {
  let products = await Product.find({ category: "women" });
  let popular_women = products.slice(0, 4);
  console.log("popular women fetched");
  res.send(popular_women);
});
// Updated endpoint to fetch random related products by category
app.get("/relatedproduct/:category", async (req, res) => {
  const category = req.params.category;
  try {
    // Use MongoDB's aggregation to fetch random products from the given category
    let relatedProducts = await Product.aggregate([
      { $match: { category: category } }, // Filter by category
      { $sample: { size: 4 } }, // Get 4 random products
    ]);

    console.log(`Random related products for category: ${category} fetched`);
    res.json(relatedProducts);
  } catch (error) {
    res.status(500).send("Error fetching related products");
  }
});

//creating middleware to fetch user
// Middleware to protect routes
const fetchUser = async (req, res, next) => {
  const token = req.header("auth-token");
  if (!token) {
    return res
      .status(401)
      .send({ errors: "Please authenticate using a valid token" });
  }
  try {
    const data = jwt.verify(token, "secret_ecom");
    req.user = data.user;
    next();
  } catch (error) {
    return res
      .status(401)
      .send({ errors: "Please authenticate using a valid token" });
  }
};

// Example of a protected route
app.get("/allproducts", fetchUser, async (req, res) => {
  let products = await Product.find({});
  res.send(products);
});

// creating endpoint for adding products in cartdata

app.post("/addtocart", fetchUser, async (req, res) => {
  console.log("added to cart", req.body.itemId);

  let userData = await Users.findOne({ _id: req.user.id });
  userData.cartData[req.body.itemId] += 1;
  await Users.findOneAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData }
  );
  res.send("added");
});

// creating endpoint for removing cart items
app.post("/removefromcart", fetchUser, async (req, res) => {
  console.log("removed", req.body.itemId);
  let userData = await Users.findOne({ _id: req.user.id });
  if (userData.cartData[req.body.itemId] > 0)
    userData.cartData[req.body.itemId] -= 1;
  await Users.findOneAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData }
  );
  res.send("Removed");
});

// creating endpoint for geting cart items

app.post("/getcart", fetchUser, async (req, res) => {
  console.log("Get Cart");
  let userData = await Users.findOne({ _id: req.user.id });
  res.json(userData.cartData);
});

const Admin = mongoose.model("Admin", {
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    unique: true,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

app.post("/addadmin", async (req, res) => {
  let check = await Admin.findOne({ email: req.body.email });
  if (check) {
    console.log("This email is already registered");
    return res.status(400).json({
      success: false,
      errors: "An admin with this email already exists",
    });
  }

  const admin = new Admin({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
  });

  await admin.save();
  console.log("Admin created successfully");

  res.json({
    success: true,
    message: "Admin created successfully",
  });
});

// Admin login endpoint
app.post("/admin/login", async (req, res) => {
  let admin = await Admin.findOne({ email: req.body.email });
  if (admin) {
    const passCompare = await bcrypt.compare(req.body.password, admin.password);
    if (passCompare) {
      const data = {
        admin: {
          id: admin.id,
        },
      };
      const token = jwt.sign(data, jwtSecret);
      res.json({ success: true, token });
    } else {
      res.status(403).json({ success: false, errors: "Wrong password" });
    }
  } else {
    res.status(400).json({ success: false, errors: "Wrong email address" });
  }
});



// endpoint for deleting all products
app.delete("/deleteallproducts", async (req, res) => {
  try {
    // Step 1: Delete all products from the database
    await Product.deleteMany({});
    console.log("All products deleted from the database.");

    // Step 2: Remove all images from the upload/images directory
    const directory = "./upload/images";

    fs.readdir(directory, (err, files) => {
      if (err) throw err;

      // Loop through each file and delete it
      for (const file of files) {
        fs.unlink(path.join(directory, file), (err) => {
          if (err) throw err;
        });
      }
    });

    console.log("All images deleted from the upload/images folder.");

    res.json({
      success: true,
      message: "All products and images deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting products or images:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting products or images.",
    });
  }
});


app.listen(port, (error) => {
  if (!error) {
    console.log("Server Running on Port :" + port);
  } else {
    console.log("Error :" + error);
  }
});
