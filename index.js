import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { SMTPClient } from "emailjs";
import bodyParser from "body-parser";
import express from "express";
import cors from "cors";

// const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);

process.env.GOOGLE_APPLICATION_CREDENTIALS

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

const port = process.env.PORT || 8000;
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

  console.log("Received push notification request:", data.fcmToken);

  const message = {
    notification: {
      title: data.title,
      body: data.body,
      icon: data.icon,
    },
    tokens: data.fcmToken,
  };

  getMessaging()
    .sendEachForMulticast(message) // Use send instead of sendEachForMulticast
    .then((response) => {
      res.status(200).json({
        message: "Successfully sent push message",
        token: data.fcmToken,
      });
      if(response.failureCount > 0) {
        console.log("Error sending push message:", response.responses[0].error.message);
      } else {
        console.log("Successfully sent push message:", response);
      }
    })
    .catch((error) => {
      res.status(400).json({ error: error.message });
      console.log("Error sending push message:", error);
    });
});

app.post("/api/email-notify", function (req, res) {
  const data = req.body;

  if (!data.text || !data.from || !data.to || !data.subject) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const message = {
    text: data.text,
    from: data.from,
    to: data.to,
    subject: data.subject,
  };

  client.send(
    message,
    (error, messageInfo) => {
      if (error) {
        res.status(400).json({ error: error.message });
        console.log("Error sending email message:", error);
      } else {
        res.status(200).json({
          message: "Successfully sent email message",
          info: messageInfo,
        });
        console.log("Successfully sent email message:", messageInfo);
      }
    }
  );
});

const server = app.listen(port || 8000, function () {
  console.log(`Server listening on port ${port}`);
});

server.keepAliveTimeout = 1800 * 1000;
server.headersTimeout = 120 * 1000;