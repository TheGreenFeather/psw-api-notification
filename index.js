import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { SMTPClient } from "emailjs";
import bodyParser from "body-parser";
import express from "express";
import cors from "cors";
import cron from "node-cron";
// import dotenv from "dotenv"

// dotenv.config({ path: '.env' })

// console.log(process.env)

process.env.GOOGLE_APPLICATION_CREDENTIALS;

const firebaseApp = initializeApp({
  credential: applicationDefault(),
  databaseURL:
    "https://g-edu-4c960-default-rtdb.asia-southeast1.firebasedatabase.app",
});

const messaging = getMessaging(firebaseApp);
const db = getFirestore(firebaseApp);

const client = new SMTPClient({
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASSWORD,
  host: "smtp.gmail.com",
  ssl: true,
});

const port = process.env.PORT || 8000;
const app = express();

let assignmentSchedules = {};
let preferredSchedules = {};
let suggestedSchedules = {};

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
        data: `<!DOCTYPE html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1.0" /><meta http-equiv="Content-Type" content="text/html; charset=UTF-8" /><title>Email Notifition</title><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /><link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet" /><style media="all" type="text/css">@media (max-width: 600px) {.container,.header,.footer,.download,.title,.copyright,.weblink,.webname {width: 20rem !important;}.content,.sincerely,.dear,.download,.webname {font-size: medium !important;}.title,.header {font-size: large !important;}.copyright {font-size: xx-small !important;}.weblink {font-size: small !important;}}</style></head><body style="background-color: #f4f7f8; font-family: 'Poppins', Arial, sans-serif"><table border="0" cellpadding="0" cellspacing="0" role="presentation" class="container" style="margin: auto; padding: 0; width: 36rem; background-color: white; border-radius: 0.75rem; overflow: hidden;"><tr><td class="header" style="color: white; padding: 1.5rem 2rem; font-size: x-large; font-weight: 600; width: 36rem; background-color: black;">G.Edu<hr /></td></tr><tr><td class="body"><table border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td class="title" style="color: black; padding: 1.5rem 2rem; font-size: x-large; font-weight: 600; width: 36rem; text-align: center;">${subject}</td></tr><tr><td><table border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td class="content" style="color: black; font-style: italic; padding: 1.5rem 2rem; font-size: large; font-weight: 500;">${content}</td></tr><tr><td class="sincerely" style="color: black; padding: 1.5rem 2rem; font-size: large; font-weight: 500;">Sincerely,<br />Ms. Giang</td></tr></table></td></tr></table></td></tr><tr><td class="footer" style="color: white; padding: 1.5rem 2rem; width: 36rem; background-color: black;"><hr /><table border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td class="webname" style="width: 36rem; font-size: large; font-weight: 600; padding-block: 0.25rem; text-align: center;">G.Edu</td></tr><tr><td class="weblink" style="width: 36rem; font-size: medium; font-weight: 500; padding-block: 0.25rem; text-align: center;">visit: <a href="https://g.edu.com" style="color: white">https://g.edu.com</a></td></tr><tr><td class="copyright" style="width: 36rem; font-size: x-small; font-weight: 500; padding-block: 0.25rem; text-align: center;">copyright ${new Date().getFullYear()} ©</td></tr></table></td></tr></table></body></html>`,
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

app.post("/api/setschedule-assignment", async function (req, res) {
  const { from, student_ids, assignment_id } = req.body;

  if (!from || !student_ids || !assignment_id) {
    return res.status(400).send({ success: false });
  }

  const message = (content, from, subject, to) => ({
    text: content,
    from: from,
    to: to,
    subject: subject,
    attachment: [
      {
        data: `<!DOCTYPE html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1.0" /><meta http-equiv="Content-Type" content="text/html; charset=UTF-8" /><title>Email Notifition</title><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /><link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet" /><style media="all" type="text/css">@media (max-width: 600px) {.container,.header,.footer,.download,.title,.copyright,.weblink,.webname {width: 20rem !important;}.content,.sincerely,.dear,.download,.webname {font-size: medium !important;}.title,.header {font-size: large !important;}.copyright {font-size: xx-small !important;}.weblink {font-size: small !important;}}</style></head><body style="background-color: #f4f7f8; font-family: 'Poppins', Arial, sans-serif"><table border="0" cellpadding="0" cellspacing="0" role="presentation" class="container" style="margin: auto; padding: 0; width: 36rem; background-color: white; border-radius: 0.75rem; overflow: hidden;"><tr><td class="header" style="color: white; padding: 1.5rem 2rem; font-size: x-large; font-weight: 600; width: 36rem; background-color: black;">G.Edu<hr /></td></tr><tr><td class="body"><table border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td class="title" style="color: black; padding: 1.5rem 2rem; font-size: x-large; font-weight: 600; width: 36rem; text-align: center;">${subject}</td></tr><tr><td><table border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td class="content" style="color: black; font-style: italic; padding: 1.5rem 2rem; font-size: large; font-weight: 500;">${content}</td></tr><tr><td class="sincerely" style="color: black; padding: 1.5rem 2rem; font-size: large; font-weight: 500;">Sincerely,<br />Ms. Giang</td></tr></table></td></tr></table></td></tr><tr><td class="footer" style="color: white; padding: 1.5rem 2rem; width: 36rem; background-color: black;"><hr /><table border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td class="webname" style="width: 36rem; font-size: large; font-weight: 600; padding-block: 0.25rem; text-align: center;">G.Edu</td></tr><tr><td class="weblink" style="width: 36rem; font-size: medium; font-weight: 500; padding-block: 0.25rem; text-align: center;">visit: <a href="https://g.edu.com" style="color: white">https://g.edu.com</a></td></tr><tr><td class="copyright" style="width: 36rem; font-size: x-small; font-weight: 500; padding-block: 0.25rem; text-align: center;">copyright ${new Date().getFullYear()} ©</td></tr></table></td></tr></table></body></html>`,
        alternative: true,
      },
    ],
  });

  const assignmentRef = db.collection("assignments").doc(assignment_id);
  const assignmentDoc = await assignmentRef.get();
  if (!assignmentDoc.exists) {
    console.log("Assignment not found");
    res.status(404).send({ success: false, message: "Assignment not found" });
    return;
  }

  const assignmentData = assignmentDoc.data();
  const deadline = assignmentData.deadline;
  const assignmentName = assignmentData.name;

  res.status(200).send({ success: true });

  const threeDaysBefore = new Date(deadline);
  threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);
  threeDaysBefore.setHours(6, 0, 0, 0); // Set to 6:00 AM

  const oneDayBefore = new Date(deadline);
  oneDayBefore.setDate(oneDayBefore.getDate() - 1);
  oneDayBefore.setHours(6, 0, 0, 0); // Set to 6:00 AM

  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(6, 0, 0, 0); // Set to 6:00 AM

  const schedule3 = `${threeDaysBefore.getMinutes()} ${threeDaysBefore.getHours()} ${threeDaysBefore.getDate()} ${
    threeDaysBefore.getMonth() + 1
  } *`;
  const schedule1 = `${oneDayBefore.getMinutes()} ${oneDayBefore.getHours()} ${oneDayBefore.getDate()} ${
    oneDayBefore.getMonth() + 1
  } *`;

  const schedule0 = `${deadlineDate.getMinutes()} ${deadlineDate.getHours()} ${deadlineDate.getDate()} ${
    deadlineDate.getMonth() + 1
  } *`;

  if (
    assignmentSchedules[assignment_id] &&
    assignmentSchedules[assignment_id][2]
  )
    assignmentSchedules[assignment_id][2].stop();

  if (
    assignmentSchedules[assignment_id] &&
    assignmentSchedules[assignment_id][1]
  )
    assignmentSchedules[assignment_id][1].stop();

  if (
    assignmentSchedules[assignment_id] &&
    assignmentSchedules[assignment_id][0]
  )
    assignmentSchedules[assignment_id][0].stop();

  // Check if schedules are past
  const now = new Date();

  if (threeDaysBefore < now) {
    console.log("3 days before deadline has already passed");
  } else {
    assignmentSchedules[assignment_id][2] = cron.schedule(
      schedule3,
      async () => {
        const submissionsQuery = db
          .collection("submissions")
          .where("student_id", "in", student_ids)
          .where("assignment_id", "==", assignment_id);
        const submissionsSnapshot = await submissionsQuery.get();

        const studentsFinishSubmission = submissionsSnapshot.empty
          ? []
          : submissionsSnapshot.docs.map((doc) => doc.data().student_id);
        const studentsNotFinishSubmission = student_ids.filter(
          (student_id) => !studentsFinishSubmission.includes(student_id)
        );

        if (studentsNotFinishSubmission.length === 0) {
          console.log("All students have finished their submission");
          assignmentSchedules[assignment_id][2].stop();
          assignmentSchedules[assignment_id][2] = undefined;
          return;
        }

        const studentsQuery = db
          .collection("students")
          .where("student_id", "in", studentsNotFinishSubmission);
        const studentsSnapshot = await studentsQuery.get();

        const studentsEmail = studentsSnapshot.empty
          ? []
          : studentsSnapshot.docs.map((doc) => doc.data().email);

        const studentsId = studentsSnapshot.empty
          ? []
          : studentsSnapshot.docs.map((doc) => doc.data().student_id);

        console.log("Sending notification 3 days before deadline");

        db.runTransaction(async (transaction) => {
          const indexDocRef = db
            .collection("last_indices")
            .doc("notifications");
          const indexDocSnap = await transaction.get(indexDocRef);

          let lastIndex = 0;
          if (indexDocSnap.exists()) {
            lastIndex = indexDocSnap.data().last_index;
          }

          const newIndex = lastIndex + 1;
          const newId = `notifid_${newIndex}`;
          const docRef = db.collection("notifications").doc(newId);

          transaction.set(
            indexDocRef,
            { last_index: newIndex },
            { merge: true }
          );

          transaction.set(docRef, {
            teacher_id: null,
            student_ids: studentsId,
            title: `3 day lefts before the deadline of assignment "${assignmentName}"`,
            description: `Hey, \n\n You have 3 day left to finish your assignment "${assignmentName}".`,
            link: `/card-detail?id=${assignment_id}`,
            time_sent: new Date().toISOString(),
            notification_id: newId,
          });

          console.log("Notifications added successfully with ID:", newId);
          return newId;
        });

        client.send(
          message(
            `Hey, \n\n You have 3 day left to finish your assignment "${assignmentName}".`,
            from,
            `3 day lefts before the deadline of assignment "${assignmentName}"`,
            studentsEmail.map((email) => `<${email}>`).join(", ")
          ),
          (error, messageInfo) => {
            if (error) {
              console.log("Error sending email message:", error);
            } else {
              console.log("Successfully sent email message:", messageInfo);
            }
          }
        );
        assignmentSchedules[assignment_id][2].stop();
        assignmentSchedules[assignment_id][2] = undefined;
      },
      { timezone: "Asia/Bangkok" }
    );
  }
  if (oneDayBefore < now) {
    console.log("1 day before deadline has already passed");
  } else {
    assignmentSchedules[assignment_id][1] = cron.schedule(
      schedule1,
      async () => {
        const submissionsQuery = db
          .collection("submissions")
          .where("student_id", "in", student_ids)
          .where("assignment_id", "==", assignment_id);
        const submissionsSnapshot = await submissionsQuery.get();

        const studentsFinishSubmission = submissionsSnapshot.empty
          ? []
          : submissionsSnapshot.docs.map((doc) => doc.data().student_id);
        const studentsNotFinishSubmission = student_ids.filter(
          (student_id) => !studentsFinishSubmission.includes(student_id)
        );

        if (studentsNotFinishSubmission.length === 0) {
          console.log("All students have finished their submission");
          assignmentSchedules[assignment_id][1].stop();
          assignmentSchedules[assignment_id][1] = undefined;
          return;
        }

        const studentsQuery = db
          .collection("students")
          .where("student_id", "in", studentsNotFinishSubmission);
        const studentsSnapshot = await studentsQuery.get();

        const studentsEmail = studentsSnapshot.empty
          ? []
          : studentsSnapshot.docs.map((doc) => doc.data().email);

        const studentsId = studentsSnapshot.empty
          ? []
          : studentsSnapshot.docs.map((doc) => doc.data().student_id);

        console.log("Sending notification 1 days before deadline");

        db.runTransaction(async (transaction) => {
          const indexDocRef = db
            .collection("last_indices")
            .doc("notifications");
          const indexDocSnap = await transaction.get(indexDocRef);

          let lastIndex = 0;
          if (indexDocSnap.exists()) {
            lastIndex = indexDocSnap.data().last_index;
          }

          const newIndex = lastIndex + 1;
          const newId = `notifid_${newIndex}`;
          const docRef = db.collection("notifications").doc(newId);

          transaction.set(
            indexDocRef,
            { last_index: newIndex },
            { merge: true }
          );

          transaction.set(docRef, {
            teacher_id: null,
            student_ids: studentsId,
            title: `3 day lefts before the deadline of assignment "${assignmentName}"`,
            description: `Hey, \n\n You have 3 day left to finish your assignment "${assignmentName}".`,
            link: `/card-detail?id=${assignment_id}`,
            time_sent: new Date().toISOString(),
            notification_id: newId,
          });

          console.log("Notifications added successfully with ID:", newId);
          return newId;
        });

        client.send(
          message(
            `Hey, \n\n You have 1 day left to finish your assignment "${assignmentName}".`,
            from,
            `1 day left before the deadline of assignment "${assignmentName}"`,
            studentsEmail.map((email) => `<${email}>`).join(", ")
          ),
          (error, messageInfo) => {
            if (error) {
              console.log("Error sending email message:", error);
            } else {
              console.log("Successfully sent email message:", messageInfo);
            }
          }
        );
        assignmentSchedules[assignment_id][1].stop();
        assignmentSchedules[assignment_id][1] = undefined;
      },
      { timezone: "Asia/Bangkok" }
    );
  }

  if (deadlineDate < now) {
    console.log("Deadline has already passed");
  } else {
    assignmentSchedules[assignment_id][0] = cron.schedule(
      schedule0,
      async () => {
        const submissionsQuery = db
          .collection("submissions")
          .where("student_id", "in", student_ids)
          .where("assignment_id", "==", assignment_id);
        const submissionsSnapshot = await submissionsQuery.get();

        const studentsFinishSubmission = submissionsSnapshot.empty
          ? []
          : submissionsSnapshot.docs.map((doc) => doc.data().student_id);
        const studentsNotFinishSubmission = student_ids.filter(
          (student_id) => !studentsFinishSubmission.includes(student_id)
        );

        if (studentsNotFinishSubmission.length === 0) {
          console.log("All students have finished their submission");
          assignmentSchedules[assignment_id][0].stop();
          assignmentSchedules[assignment_id][0] = undefined;
          return;
        }

        const studentsQuery = db
          .collection("students")
          .where("student_id", "in", studentsNotFinishSubmission);
        const studentsSnapshot = await studentsQuery.get();

        const parentsEmail = studentsSnapshot.empty
          ? []
          : studentsSnapshot.docs.map((doc) => doc.data().parent_email);

        const studentsEmail = studentsSnapshot.empty
          ? []
          : studentsSnapshot.docs.map((doc) => doc.data().email);

        const studentsName = studentsSnapshot.empty
          ? []
          : studentsSnapshot.docs.map((doc) => doc.data().name);

        const studentsId = studentsSnapshot.empty
          ? []
          : studentsSnapshot.docs.map((doc) => doc.data().student_id);

        console.log("Sending notification on deadline");

        db.runTransaction(async (transaction) => {
          const indexDocRef = db
            .collection("last_indices")
            .doc("notifications");
          const indexDocSnap = await transaction.get(indexDocRef);

          let lastIndex = 0;
          if (indexDocSnap.exists()) {
            lastIndex = indexDocSnap.data().last_index;
          }

          const newIndex = lastIndex + 1;
          const newId = `notifid_${newIndex}`;
          const docRef = db.collection("notifications").doc(newId);

          transaction.set(
            indexDocRef,
            { last_index: newIndex },
            { merge: true }
          );

          transaction.set(docRef, {
            teacher_id: null,
            student_ids: studentsId,
            title: `3 day lefts before the deadline of assignment "${assignmentName}"`,
            description: `Hey, \n\n You have 3 day left to finish your assignment "${assignmentName}".`,
            link: `/card-detail?id=${assignment_id}`,
            time_sent: new Date().toISOString(),
            notification_id: newId,
          });

          console.log("Notifications added successfully with ID:", newId);
          return newId;
        });

        db.runTransaction(async (transaction) => {
          const indexDocRef = db
            .collection("last_indices")
            .doc("notifications");
          const indexDocSnap = await transaction.get(indexDocRef);

          let lastIndex = 0;
          if (indexDocSnap.exists()) {
            lastIndex = indexDocSnap.data().last_index;
          }

          const newIndex = lastIndex + 1;
          const newId = `notifid_${newIndex}`;
          const docRef = db.collection("notifications").doc(newId);

          transaction.set(
            indexDocRef,
            { last_index: newIndex },
            { merge: true }
          );

          transaction.set(docRef, {
            teacher_id: "tid_1",
            student_ids: null,
            title: `Assignment "${assignmentName}" has just been overdue.`,
            description: `${studentsName.join(
              ", "
            )} have just missed this asignment.`,
            link: `${assignment_id}`,
            time_sent: new Date().toISOString(),
            notification_id: newId,
          });

          console.log("Notifications added successfully with ID:", newId);
          return newId;
        });

        client.send(
          message(
            `Hey, \n\n You have missed your assignment "${assignmentName}".`,
            from,
            `Late assignment "${assignmentName}"`,
            studentsEmail.map((email) => `<${email}>`).join(", ")
          ),
          (error, messageInfo) => {
            if (error) {
              console.log("Error sending email message:", error);
            } else {
              console.log("Successfully sent email message:", messageInfo);
            }
          }
        );

        client.send(
          message(
            `Dear parents,\n\n Your child has missed the assignment "${assignmentName}".`,
            from,
            `Late assignment "${assignmentName}"`,
            parentsEmail.map((email) => `<${email}>`).join(", ")
          ),
          (error, messageInfo) => {
            if (error) {
              console.log("Error sending email message:", error);
            } else {
              console.log("Successfully sent email message:", messageInfo);
            }
          }
        );

        client.send(
          message(
            `${studentsName.join(", ")} have just missed this asignment.`,
            from,
            `Assignment "${assignmentName}" has just been overdue.`,
            from
          ),
          (error, messageInfo) => {
            if (error) {
              console.log("Error sending email message:", error);
            } else {
              console.log("Successfully sent email message:", messageInfo);
            }
          }
        );
        assignmentSchedules[assignment_id][0].stop();
        assignmentSchedules[assignment_id][0] = undefined;
      },
      { timezone: "Asia/Bangkok" }
    );
  }
});

app.get("/api/setschedule-preferredtime", async function (req, res) {
  const { from, student_id } = req.body;

  if (!from || !student_id) {
    return res.status(400).send({ success: false });
  }

  const message = (content, from, subject, to) => ({
    text: content,
    from: from,
    to: to,
    subject: subject,
    attachment: [
      {
        data: `<!DOCTYPE html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1.0" /><meta http-equiv="Content-Type" content="text/html; charset=UTF-8" /><title>Email Notifition</title><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /><link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet" /><style media="all" type="text/css">@media (max-width: 600px) {.container,.header,.footer,.download,.title,.copyright,.weblink,.webname {width: 20rem !important;}.content,.sincerely,.dear,.download,.webname {font-size: medium !important;}.title,.header {font-size: large !important;}.copyright {font-size: xx-small !important;}.weblink {font-size: small !important;}}</style></head><body style="background-color: #f4f7f8; font-family: 'Poppins', Arial, sans-serif"><table border="0" cellpadding="0" cellspacing="0" role="presentation" class="container" style="margin: auto; padding: 0; width: 36rem; background-color: white; border-radius: 0.75rem; overflow: hidden;"><tr><td class="header" style="color: white; padding: 1.5rem 2rem; font-size: x-large; font-weight: 600; width: 36rem; background-color: black;">G.Edu<hr /></td></tr><tr><td class="body"><table border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td class="title" style="color: black; padding: 1.5rem 2rem; font-size: x-large; font-weight: 600; width: 36rem; text-align: center;">${subject}</td></tr><tr><td><table border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td class="content" style="color: black; font-style: italic; padding: 1.5rem 2rem; font-size: large; font-weight: 500;">${content}</td></tr><tr><td class="sincerely" style="color: black; padding: 1.5rem 2rem; font-size: large; font-weight: 500;">Sincerely,<br />Ms. Giang</td></tr></table></td></tr></table></td></tr><tr><td class="footer" style="color: white; padding: 1.5rem 2rem; width: 36rem; background-color: black;"><hr /><table border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td class="webname" style="width: 36rem; font-size: large; font-weight: 600; padding-block: 0.25rem; text-align: center;">G.Edu</td></tr><tr><td class="weblink" style="width: 36rem; font-size: medium; font-weight: 500; padding-block: 0.25rem; text-align: center;">visit: <a href="https://g.edu.com" style="color: white">https://g.edu.com</a></td></tr><tr><td class="copyright" style="width: 36rem; font-size: x-small; font-weight: 500; padding-block: 0.25rem; text-align: center;">copyright ${new Date().getFullYear()} ©</td></tr></table></td></tr></table></body></html>`,
        alternative: true,
      },
    ],
  });

  const studentRef = db.collection("students").doc(student_id);
  const studentDoc = await studentRef.get();
  if (!studentDoc.exists) {
    console.log("Student not found");
    res.status(404).send({ success: false, message: "Student not found" });
    return;
  }
  const studentData = studentDoc.data();

  const learningPlanRef = db.collection("learning_plans").doc(student_id);
  const learningPlanDoc = await learningPlanRef.get();
  if (!learningPlanDoc.exists) {
    console.log("Learning plan not found");
    res.status(404).send({
      success: false,
      message: "Learning plan not found",
    });
    return;
  }
  const learningPlanData = learningPlanDoc.data();

  res.status(200).send({ success: true });

  const studentEmail = studentData.email;
  const studyTimeStart = learningPlanData.study_time?.start;

  const fithteenMinutes = studyTimeStart
    .split(":")
    .map((item) => parseInt(item));
  fithteenMinutes[1] -= 15;
  if (fithteenMinutes[1] < 60) {
    fithteenMinutes[1] = 60 + fithteenMinutes[1];
    fithteenMinutes[0] -= 1;
  }
  if (fithteenMinutes[0] < 0) {
    fithteenMinutes[0] = 24 - fithteenMinutes[0];
  }

  if (preferredSchedules[student_id]) preferredSchedules[student_id].stop();

  preferredSchedules[student_id] = cron.schedule(
    `${fithteenMinutes[1]} ${fithteenMinutes[0]} * * *`,
    async () => {
      const learningPlanRef = db.collection("learning_plans").doc(student_id);
      const learningPlanDoc = await learningPlanRef.get();
      if (!learningPlanDoc.exists) return;

      const learningPlanData = learningPlanDoc.data();

      const studyHours = learningPlanData.study_hours;
      const studyHourCurrent = studyHours[studyHours.length - 1];

      if (studyHourCurrent > 0) {
        console.log("Student has started study hour");
        return;
      }

      db.runTransaction(async (transaction) => {
        const indexDocRef = db.collection("last_indices").doc("notifications");
        const indexDocSnap = await transaction.get(indexDocRef);

        let lastIndex = 0;
        if (indexDocSnap.exists()) {
          lastIndex = indexDocSnap.data().last_index;
        }

        const newIndex = lastIndex + 1;
        const newId = `notifid_${newIndex}`;
        const docRef = db.collection("notifications").doc(newId);

        transaction.set(indexDocRef, { last_index: newIndex }, { merge: true });

        transaction.set(docRef, {
          teacher_id: null,
          student_ids: [student_id],
          title: `15 minutes before your preferred study time`,
          description: `Hey, \n\n This is a reminder that your preferred study time is about to start in 15 minutes.`,
          link: `/assignment`,
          time_sent: new Date().toISOString(),
          notification_id: newId,
        });

        console.log("Notifications added successfully with ID:", newId);
        return newId;
      });

      client.send(
        message(
          `Hey, \n\n This is a reminder that your preferred study time is about to start in 15 minutes.`,
          from,
          `15 minutes before your preferred study time`,
          `<${studentEmail}>`
        ),
        (error, messageInfo) => {
          if (error) {
            console.log("Error sending email message:", error);
          } else {
            console.log("Successfully sent email message:", messageInfo);
          }
        }
      );
    },
    { timezone: "Asia/Bangkok" }
  );

  if (!suggestedSchedules[student_id])
    suggestedSchedules[student_id] = cron.schedule(
      "0 6 * * *",
      async () => {
        const learningPlanRef = db.collection("learning_plans").doc(student_id);
        const learningPlanDoc = await learningPlanRef.get();
        if (!learningPlanDoc.exists) return;

        const learningPlanData = learningPlanDoc.data();

        const currentDate = new Date();
        const examTime = new Date(learningPlanData.exam_date);

        const millisecondsPerDay = 1000 * 60 * 60 * 24;
        const remainingDays = Math.ceil(
          (examTime - currentDate) / millisecondsPerDay
        );
        const hoursNeeded =
          0.3 *
          (learningPlanData.target_score - learningPlanData.initial_score);

        if (remainingDays <= 0) return 0; // Avoid division by zero or negative days

        const suggestedStudyTime = Math.min(
          Math.round((hoursNeeded / remainingDays) * 10) / 10,
          8
        );

        const docRef = db.collection("learning_plans").doc(student_id);
        await docRef.update({
          suggested_study_time: suggestedStudyTime,
        });
      },
      { timezone: "Asia/Bangkok" }
    );
});

const server = app.listen(port, function () {
  console.log(`Server listening on port ${port}`);
});

server.keepAliveTimeout = 1800 * 1000;
server.headersTimeout = 120 * 1000;
