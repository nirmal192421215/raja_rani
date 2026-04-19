const mongoose = require('mongoose');

const uri = "mongodb+srv://nirmalkumar00727_db_user:multiplayer@cluster0.ccvk8a4.mongodb.net/multiplayer_game?retryWrites=true&w=majority&appName=Cluster0";

console.log("Attempting to connect...");
mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log("✅ SUCCESS! Connected to MongoDB Atlas.");
    process.exit(0);
  })
  .catch(err => {
    console.error("❌ FAILED:", err.message);
    process.exit(1);
  });
