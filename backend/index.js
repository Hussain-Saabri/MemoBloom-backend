require("dotenv").config();
const config = require("./config.json");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
mongoose.connect(config.connectionString);
const app = express();
const jwt = require("jsonwebtoken");
const { authenticateToken } = require("./utilities");
const User = require("./models/user.model");
const nodemailer = require("nodemailer");
const Note = require("./models/note.model");

app.use(express.json());

app.use(cors({ origin: "*" }));
const port = 8000;
app.listen(port, () => {
  console.log(`Server started on server ${port}`);
});
app.get("/", (req, res) => {
  res.json({ data: "hello" });
});
//create an account
app.post("/create-account", async (req, res) => {
  console.log("Creating an account");
  const { fullname, email, password } = req.body;
  if (!fullname) {
    return res
      .status(400)
      .json({ error: true, message: "fullname is required" });
  }

  if (!email) {
    return res.status(400).json({ error: true, message: "enter the email" });
  }
  if (!password) {
    return res
      .status(400)
      .json({ error: true, message: "Please enter the password" });
  }

  const isUser = await User.findOne({ email: email });
  if (isUser) {
    return res.json({ error: true, message: "Email already exist" });
  }
  const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
  console.log("6 digit otp would be", otp);
  console.log("otp expirey will be", otpExpiry);
  const user = new User({
    fullname,
    email,
    password,
    otp,
    otpExpiry,
  });

  console.log("User data is ", user);
  const userData = await user.save();
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USERNAME, //email of my account
      pass: process.env.EMAIL_PASSWORD,
    },
  });
  //mailoptions for sending the email use by transporter
  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to: email,
    subject: "Your Otp for MemoBloom Signup",
    text: `Hello ${fullname} ,\n\nYour otp for signup is ${otp}. It will expire in 10 minutes. \n\nThank You!`,
  };
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log("Error sending the otp email", error);
      return res
        .status(500)
        .json({ error: true, message: "Falied to send otp email" });
    } else {
      console.log("Otp email sent", info.response);
      const accessToken = jwt.sign({ user }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "36000m",
      });
      return res
        .status(201)
        .json({
          error: false,
          message: "Created succesfully",
          accessToken,
          user: userData,
        });
    }
  });
});
// verify otp
app.post("/verify-otp", async (req, res) => {
  console.log("verifying the otp");
  const { email, otp } = req.body;
  if (!email) {
    return res.json({ error: true, message: "Email is required" });
  }
  if (!otp) {
    return res.json({ error: true, message: "otp is required" });
  }
  const isEmailExist = await User.findOne({ email: email });
  console.log("Email exist bro");
  if (!isEmailExist) {
    console.log("Email does not exist");
    return res.json({
      error: true,
      message: "Email does not exist/User does not found",
    });
  }
  const verifiedOtp = await User.findOne({ email: email, otp: otp });

  if (!verifiedOtp) {
    console.log("Otp doesnt not match");
    return res.json({ error: false, message: "Otp doesnot match" });
  }
  if (verifiedOtp.otpExpiry < new Date()) {
    console.log("Otp has been expired bro");
    return res.json({ error: false, message: "OTP has expired" });
  } else {
    console.log("Otp gets verified ");
     return res.json({ error: false, message: "otp verified" });
   
  }
});
//resend otp
app.post("/resend-otp", async (req, res) => {
  const { email } = req.body;
  console.log("Resending the otp to an email", email);
  const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

  console.log("6 digit otp would be", otp);
  console.log("otp expirey will be", otpExpiry);
  // Find user by email and update OTP & expiry
  const user = await User.findOneAndUpdate(
    { email: email }, // condition
    { otp: otp, otpExpiry: otpExpiry }, // new values
    { new: true } // return updated document
  );

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USERNAME, //email of my account
      pass: process.env.EMAIL_PASSWORD,
    },
  });
  //mailoptions for sending the email use by transporter
  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to: email,
    subject: "Your Otp for MemoBloom Signup",
    text: `Hello ${user.fullname} ,\n\nYour otp for signup is ${otp}. It will expire in 10 minutes. \n\nThank You!`,
  };
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log("Error sending the otp email", error);
      return res
        .status(500)
        .json({ error: true, message: "Falied to send otp email" });
    } else {
      console.log("Otp email sent again", info.response);

      return res.status(201).json({ error: false, message: "Otp send again" });
    }
  });
});
//login
app.post("/login", async (req, res) => {
  console.log("Logging");
  const { email, password } = req.body;
  if (!email) {
    return res.json({ error: true, message: "Email is required" });
  }
  if (!password) {
    return res.json({ error: true, message: "Password is required" });
  }
  const isEmailExist = await User.findOne({ email: email });
  if (!isEmailExist) {
    return res.json({
      error: true,
      message: "Email does not exist/User does not found",
    });
  }
  const isUser = await User.findOne({ email: email, password: password });

  if (isUser) {
    const accessToken = jwt.sign(
      { user: isUser },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "1h" }
    );

    return res.json({
      error: false,
      message: "Login successfully",
      accessToken,
      user: isUser,
    });
  }
  return res.json("Some error");
});

// Get the user
app.get("/get-user", authenticateToken, async (req, res) => {
  const { user } = req.user;
  const userId = user._id;
  const isUser = await User.findOne({ _id: userId });
  if (!isUser) {
    return res.json({ error: true, message: "User Not Found" });
  }
  return res.json({
    error: false,
    user: { fullname: isUser.fullname, email: isUser.email },
    message: "User details",
  });
});

//update the name and the email
app.put("/update-profile", authenticateToken, async (req, res) => {
  const { fullname, email } = req.body || {};
  const { user } = req.user;
  const userId = user._id;
  if (!fullname) {
    return res.json({ error: true, message: "Enter the fullname" });
  }
  if (!email) {
    return res.json({ error: true, message: "Enter the email" });
  }
  try {
    const isUser = await User.findOne({ _id: userId });
    if (!isUser) {
      return res.json({ error: true, message: "Unauthorized" });
    }

    isUser.fullname = fullname;
    isUser.email = email;

    await isUser.save();

    return res.json({
      error: true,
      isUser,
      message: "Updated details successfully",
    });
  } catch (error) {
    return res.json({ error: true, message: "Internal server error" });
  }
});

// Add new note
app.post("/add-note", authenticateToken, async (req, res) => {
  const { title, content, tags } = req.body;
  const { user } = req.user;

  if (!title) {
    return res.status(400).json({ error: true, message: "Title is required" });
  }

  if (!content) {
    return res
      .status(400)
      .json({ error: true, message: "Content is required" });
  }

  try {
    const note = new Note({
      title,
      content,
      tags: tags || [],
      userId: user._id,
    });

    await note.save();

    return res.json({
      error: false,
      note,
      message: "Note added successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
    });
  }
});
//Edit Notes
app.put("/edit-note/:noteId", authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  const { title, content, tags, isPinned } = req.body;
  const { user } = req.user;

  if (!title && !content && !tags) {
    return res
      .status(400)
      .json({ error: true, message: "No changes provided" });
  }

  try {
    const note = await Note.findOne({ _id: noteId, userId: user._id });

    if (!note) {
      return res.status(404).json({ error: true, message: "Note not found" });
    }

    if (title) note.title = title;
    if (content) note.content = content;
    if (tags) note.tags = tags;
    if (isPinned) note.isPinned = isPinned;

    await note.save();

    return res.json({
      error: false,
      note,
      message: "Note updated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
    });
  }
});
// get all notes
app.get("/get-note", authenticateToken, async (req, res) => {
  const { user } = req.user;
  const userID = user._id;
  //use find to get all the
  try {
    const note = await Note.find({ userId: user._id });
    return res.json({
      error: false,
      note,
      message: "All the notes retrived succesfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
    });
  }
});

//delete the note
app.delete("/delete-note/:noteID", authenticateToken, async (req, res) => {
  const { user } = req.user;
  const userId = user._id;
  const noteId = req.params.noteID;

  try {
    const note = await Note.findOne({ _id: noteId, userId: userId });
    if (!note) {
      return res.json({ error: true, message: "Note not found" });
    }
    await Note.deleteOne({ _id: noteId, userId: userId });

    return res.json({ error: false, message: "deleted successfully" });
  } catch (error) {
    return res.json({ error: true, message: "Internal server error" });
  }
});
//update the pin
app.put("/update-note-pin/:noteId", authenticateToken, async (req, res) => {
  const { isPinned } = req.body;
  const { user } = req.user;
  const userId = user._id;
  const noteId = req.params.noteId;
  try {
    const note = await Note.findOne({ _id: noteId, userId: userId });
    if (!note) {
      return res.json({ error: true, message: "Note not found" });
    }
    if (isPinned) {
      note.isPinned = isPinned;
      await note.save();
      return res.json({
        error: false,
        note,
        message: "Updated The Pin Succesfully",
      });
    }
  } catch (error) {
    return res.json({ error: true, message: "Inernal Server error" });
  }
});

module.exports = app;
