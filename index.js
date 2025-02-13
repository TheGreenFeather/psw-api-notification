import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { SMTPClient } from "emailjs";
import bodyParser from "body-parser";
import express from "express";
import cors from "cors";

process.env.GOOGLE_APPLICATION_CREDENTIALS;

initializeApp({
  credential: applicationDefault(),
  projectId: process.env.FIREBASE_PROJECT_ID,
});

const client = new SMTPClient({
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASSWORD,
  host: "smtp.gmail.com",
  ssl: true,
});

const app = express();

app.use(express.json());
app.use(bodyParser.json());

app.use(
  cors({
    origin: "*",
    methods: ["POST"],
  })
);

app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json");
  next();
});

app.post("/api/push-notify", function (req, res) {
  const data = req.body;

  if (!data.fcmToken || !data.title || !data.body || !data.icon) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const message = {
    notification: {
      title: data.title,
      body: data.body,
      icon: data.icon,
    },
    token: data.fcmToken,
  };

  getMessaging()
    .sendEachForMulticast(message) // Use send instead of sendEachForMulticast
    .then((response) => {
      res.status(200).json({
        message: "Successfully sent message",
        token: receivedToken,
      });
      console.log("Successfully sent message:", response);
    })
    .catch((error) => {
      res.status(400).json({ error: error.message });
      console.log("Error sending message:", error);
    });
});

app.post("/api/email-notify", function (req, res) {
  const data = req.body;

  if (!data.text || !data.from || !data.to || !data.subject) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  client.send(
    {
      text: data.text,
      from: data.from,
      to: data.to,
      subject: data.subject,
    },
    (error, message) => {
      console.log(error || message);
      if (error) res.status(400).json({ error: error.message });
      res.status(200).json({
        message: "Successfully sent message",
        info: message,
      });
    }
  );
});

app.listen(8000, function () {
  console.log("Server started on http://localhost:8000");
});
