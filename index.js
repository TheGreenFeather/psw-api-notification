import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { SMTPClient } from "emailjs";
import bodyParser from "body-parser";
import express from "express";
import cors from "cors";
// import dotenv from "dotenv"

// dotenv.config({ path: '.env' })

// console.log(process.env)

process.env.GOOGLE_APPLICATION_CREDENTIALS;

const firebaseApp = initializeApp({
  credential: applicationDefault(),
  databaseURL: "https://g-edu-4c960-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const messaging = getMessaging(firebaseApp);

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

// Endpoint to send a message to a topic
app.post("/api/subscribe-push-notify", (req, res) => {
  const { tokens, topic } = req.body;

  if (!tokens || !topic) {
    return res.status(400).send({ success: false });
  }

  messaging
    .subscribeToTopic(tokens, topic)
    .then((subscribeResponse) => {
      console.log("Successfully subscribed topic:", subscribeResponse);
      res.status(200).send({ success: true, subscribeResponse });
    })
    .catch((error) => {
      console.error("Error subcribing topic:", error);
      res.status(500).send({ success: false, error });
    });
});

app.post("/api/send-push-notify", (req, res) => {
  const { notification, topic } = req.body;

  if (!notification || !topic) {
    return res.status(400).send({ success: false });
  }

  const message = {
    notification: {
      title: notification.title,
      body: notification.body,
    },
    topic: topic,
  };

  messaging
    .send(message)
    .then((sendResponse) => {
      console.log("Successfully sent push message:", sendResponse);
      res.status(200).send({
        success: true,
        response: { sendResponse },
      });
    })
    .catch((error) => {
      console.error("Error sending push message:", error);
      res.status(500).send({ success: false, error });
    });
});

app.post("/api/email-notify", function (req, res) {
  const { content, from, to, subject } = req.body;

  if (!content || !from || !to || !subject) {
    return res.status(400).send({ success: false });
  }

  const message = {
    text: content,
    from: from,
    to: to,
    subject: subject,
    attachment: [
      {
        data: `<!DOCTYPE html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1.0" /><meta http-equiv="Content-Type" content="text/html; charset=UTF-8" /><title>Email Notifition</title><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /><link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet" /><style media="all" type="text/css">@media (max-width: 600px) {.container,.header,.footer,.download,.title,.copyright,.weblink,.webname {width: 20rem !important;}.content,.sincerely,.dear,.download,.webname {font-size: medium !important;}.title,.header {font-size: large !important;}.copyright {font-size: xx-small !important;}.weblink {font-size: small !important;}}</style></head><body style="background-color: #f4f7f8; font-family: 'Poppins', Arial, sans-serif"><table border="0" cellpadding="0" cellspacing="0" role="presentation" class="container" style="margin: auto; padding: 0; width: 36rem; background-color: white; border-radius: 0.75rem; overflow: hidden;"><tr><td class="header" style="color: white; padding: 1.5rem 2rem; font-size: x-large; font-weight: 600; width: 36rem; background-color: black;">G.Edu<hr /></td></tr><tr><td class="body"><table border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td class="title" style="color: black; padding: 1.5rem 2rem; font-size: x-large; font-weight: 600; width: 36rem; text-align: center;">${subject}</td></tr><tr><td><table border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td class="content" style="color: black; font-style: italic; padding: 1.5rem 2rem; font-size: large; font-weight: 500;">${content}</td></tr><tr><td class="sincerely" style="color: black; padding: 1.5rem 2rem; font-size: large; font-weight: 500;">Sincerely,<br />Ms. Giang</td></tr></table></td></tr><tr><td class="download" style="padding: 1.5rem 2rem; font-size: large; font-weight: 500; width: 36rem; text-align: center;"><a href="#" style="color: black">Download Documents</a></td></tr></table></td></tr><tr><td class="footer" style="color: white; padding: 1.5rem 2rem; width: 36rem; background-color: black;"><hr /><table border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td class="webname" style="width: 36rem; font-size: large; font-weight: 600; padding-block: 0.25rem; text-align: center;">G.Edu</td></tr><tr><td class="weblink" style="width: 36rem; font-size: medium; font-weight: 500; padding-block: 0.25rem; text-align: center;">visit: <a href="https://g.edu.com" style="color: white">https://g.edu.com</a></td></tr><tr><td class="copyright" style="width: 36rem; font-size: x-small; font-weight: 500; padding-block: 0.25rem; text-align: center;">copyright ${new Date().getFullYear()} ©</td></tr></table></td></tr></table></body></html>`,
        alternative: true,
      },
    ],
  };

  client.send(message, (error, messageInfo) => {
    if (error) {
      console.log("Error sending email message:", error);
      res.status(500).send({ success: false, error });
    } else {
      console.log("Successfully sent email message:", messageInfo);
      res.status(200).send({ success: true, messageInfo });
    }
  });
});

const server = app.listen(port, function () {
  console.log(`Server listening on port ${port}`);
});

server.keepAliveTimeout = 1800 * 1000;
server.headersTimeout = 120 * 1000;
