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
  subject: "[MemoBloom] Your OTP for Signup",
  html: `
    <div style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 20px; color: #333;">
      <div style="max-width: 500px; margin: auto; background: white; border-radius: 8px; padding: 20px; border: 1px solid #e5e7eb;">
        
        <h2 style="text-align: center; color: #2563eb; margin-bottom: 10px;">
          Welcome to <span style="color: #10b981;">MemoBloom</span> 🌸
        </h2>

        <p style="font-size: 15px; line-height: 1.5;">
          Hi <strong>${fullname}</strong>,
        </p>
        
        <p style="font-size: 15px; line-height: 1.5;">
          We received a request to sign up for a MemoBloom account using your email.
        </p>

        <div style="background: #f0f9ff; border: 1px solid #bae6fd; padding: 15px; margin: 20px 0; text-align: center; border-radius: 6px;">
          <p style="margin: 0; font-size: 16px;">Your OTP code is:</p>
          <h1 style="margin: 5px 0; font-size: 32px; letter-spacing: 3px; color: #1d4ed8;">${otp}</h1>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">This OTP will expire in <strong>10 minutes</strong>.</p>
        </div>

        <p style="font-size: 14px; color: #6b7280;">
          If you did not request this, you can safely ignore this email.
        </p>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;" />

        <p style="text-align: center; font-size: 13px; color: #9ca3af;">
          © ${new Date().getFullYear()} MemoBloom. All rights reserved.
        </p>
      </div>
    </div>
  `,
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
    subject: "[MemoBloom] Your OTP for Signup",
  html: `
    <div style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 20px; color: #333;">
      <div style="max-width: 500px; margin: auto; background: white; border-radius: 8px; padding: 20px; border: 1px solid #e5e7eb;">
        
        <h2 style="text-align: center; color: #2563eb; margin-bottom: 10px;">
          Welcome to <span style="color: #10b981;">MemoBloom</span> 
        </h2>

        <p style="font-size: 15px; line-height: 1.5;">
          Hi <strong>${user.fullname}</strong>,
        </p>
        
        <p style="font-size: 15px; line-height: 1.5;">
          We received a request to sign up for a MemoBloom account using your email.
        </p>

        <div style="background: #f0f9ff; border: 1px solid #bae6fd; padding: 15px; margin: 20px 0; text-align: center; border-radius: 6px;">
          <p style="margin: 0; font-size: 16px;">Your OTP code is:</p>
          <h1 style="margin: 5px 0; font-size: 32px; letter-spacing: 3px; color: #1d4ed8;">${otp}</h1>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">This OTP will expire in <strong>10 minutes</strong>.</p>
        </div>

        <p style="font-size: 14px; color: #6b7280;">
          If you did not request this, you can safely ignore this email.
        </p>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;" />

        <p style="text-align: center; font-size: 13px; color: #9ca3af;">
          © ${new Date().getFullYear()} MemoBloom. All rights reserved.
        </p>
      </div>
    </div>
  `,
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

//forgot password
app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  console.log("Resending the otp to an email for forgot password", email);
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
  subject: "[MemoBloom] Your OTP for Password Reset",
  html: `
    <div style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 20px; color: #333;">
      <div style="max-width: 500px; margin: auto; background: white; border-radius: 8px; padding: 20px; border: 1px solid #e5e7eb;">
        
        <h2 style="text-align: center; color: #dc2626; margin-bottom: 10px;">
          Password Reset Request 🔒
        </h2>

        <p style="font-size: 15px; line-height: 1.5;">
          Hi <strong>${user.fullname}</strong>,
        </p>
        
        <p style="font-size: 15px; line-height: 1.5;">
          We received a request to reset your password for your <strong>MemoBloom</strong> account.
        </p>

        <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 15px; margin: 20px 0; text-align: center; border-radius: 6px;">
          <p style="margin: 0; font-size: 16px;">Your OTP code is:</p>
          <h1 style="margin: 5px 0; font-size: 32px; letter-spacing: 3px; color: #b91c1c;">${otp}</h1>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">This OTP will expire in <strong>10 minutes</strong>.</p>
        </div>

        <p style="font-size: 14px; color: #6b7280;">
          If you did not request this password reset, you can safely ignore this email. Your account will remain secure.
        </p>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;" />

        <p style="text-align: center; font-size: 13px; color: #9ca3af;">
          © ${new Date().getFullYear()} MemoBloom. All rights reserved.
        </p>
      </div>
    </div>
  `,
};

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log("Error sending the otp email", error);
      return res
        .status(500)
        .json({ error: true, message: "Falied to send otp email" });
    } else {
      console.log("Otp email sent again for forgot password", info.response);

      return res.status(201).json({ error: false, message: "Otp email sent again for forgot password" });
    }
  });
});
//update-passowrd
app.post("/update-password", async (req, res) => {
  const { email,password } = req.body;
  console.log(`updating the ${password} for email `,email);
  
  // Find user by email and update password
  const user = await User.findOneAndUpdate(
    { email: email }, // condition
    { password: password }, // new values
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
  subject: "[MemoBloom] Password Updated Successfully ✅",
  html: `
    <div style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 20px; color: #333;">
      <div style="max-width: 500px; margin: auto; background: white; border-radius: 8px; padding: 20px; border: 1px solid #e5e7eb;">
        
        <h2 style="text-align: center; color: #16a34a; margin-bottom: 10px;">
          Password Updated Successfully ✅
        </h2>

        <p style="font-size: 15px; line-height: 1.5;">
          Hi <strong>${user.fullname}</strong>,
        </p>
        
        <p style="font-size: 15px; line-height: 1.5;">
          This is to confirm that your <strong>MemoBloom</strong> account password was updated successfully.
        </p>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; margin: 20px 0; border-radius: 6px; text-align: center;">
          <p style="margin: 0; font-size: 14px; color: #166534;">
            If you made this change, you can safely ignore this email.
          </p>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #b91c1c;">
            If you did not change your password, please reset it immediately or contact our support team.
          </p>
        </div>

        <p style="font-size: 14px; color: #6b7280;">
          Keeping your account secure is our top priority.  
          Thank you for using MemoBloom!
        </p>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;" />

        <p style="text-align: center; font-size: 13px; color: #9ca3af;">
          © ${new Date().getFullYear()} MemoBloom. All rights reserved.
        </p>
      </div>
    </div>
  `,
};

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log("Error sending the otp email", error);
      return res
        .status(500)
        .json({ error: true, message: "Falied to send email" });
    } else {
      console.log("updated password email sent sucessfully", info.response);

      return res.status(201).json({ error: false, message: "password updated successfully" });
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
