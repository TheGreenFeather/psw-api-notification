  import { initializeApp, applicationDefault } from 'firebase-admin/app';
  import { getMessaging } from "firebase-admin/messaging";
  import express from "express";
  import cors from "cors";

  process.env.GOOGLE_APPLICATION_CREDENTIALS;

  const app = express();
  app.use(express.json());

  app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE", "UPDATE", "PUT", "PATCH"],
  }));

  app.use((req, res, next) => {
    res.setHeader("Content-Type", "application/json");
    next();
  });

  initializeApp({
    credential: applicationDefault(),
    projectId: 'chat-app-186d1',
  });

  app.post("/send", function (req, res) {
    const receivedToken = req.body.fcmToken;
    // const receivedToken = ["c7VmA-MD7bC29EhL3ZzsWM:APA91bF75gmX7fAmsOMSG6n-bvGaIjpeWaAtw_GnlNL8Zi-BU9GTxWmrgGFTBerL0egAcsdGOb36Kr9a7EaBjchhqSy7wtc0p6pFrQ8PxPvduetGn-3BgNo"]
    console.log(receivedToken);
    
    const message = {
      notification: {
        title: "Notif",
        body: 'This is a Test Notification'
      },
      tokens: receivedToken,  // Use a single token here
    };

    getMessaging()
      .sendEachForMulticast(message)  // Use send instead of sendEachForMulticast
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

  app.listen(8000, function () {
    console.log("Server started on http://localhost:8000/send");
  });