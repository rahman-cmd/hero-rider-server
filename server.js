const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;
const dotenv = require('dotenv').config();
const fileUpload = require('express-fileupload');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 5000; // important for deploy

var serviceAccount = require('./hero-rider-app-firebase-adminsdk-settings.json');

admin.initializeApp({
   credential: admin.credential.cert(serviceAccount),
});

// middleware
app.use(cors());
app.use(express.json({ limit: 2000000 }));
app.use(fileUpload());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cnelf.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
   useNewUrlParser: true,
   useUnifiedTopology: true,
});

const main = async () => {
   try {
      // Connect the client to the server       
      await client.connect();
      console.log('Connected successfully to Mongo');

      const database = client.db('hero-rider');
      const userCollection = database.collection('users');
      const packageCollection = database.collection('packages');

      // APIs

      // save users in database
      app.post('/saveUser', async (req, res) => {
         const { userProfileImage, userNidImage, userLicenseImage } = req.files;
         const otherUserData = req.body;

         const userProfileImageData = userProfileImage?.data;
         const encodedProfileImage = userProfileImageData.toString('base64');
         const profileImageBuffer = Buffer.from(encodedProfileImage, 'base64');

         const userNidImageData = userNidImage?.data;
         const encodedNidImage = userNidImageData.toString('base64');
         const nidImageBuffer = Buffer.from(encodedNidImage, 'base64');

         if (userLicenseImage) {
            const userLicenseImageData = userLicenseImage?.data;
            const encodedLicenseImage = userLicenseImageData.toString('base64');
            const licenseImageBuffer = Buffer.from(
               encodedLicenseImage,
               'base64'
            );

            const result = await userCollection.insertOne({
               ...otherUserData,
               images: {
                  profileImage: profileImageBuffer,
                  nidImage: nidImageBuffer,
                  licenseImage: licenseImageBuffer,
               },
            });
            res.json({
               message: 'User saved successfully',
               userId: result.insertedId,
            });
         } else {
            const result = await userCollection.insertOne({
               ...otherUserData,
               images: {
                  profileImage: profileImageBuffer,
                  nidImage: nidImageBuffer,
               },
            });
            res.json({
               message: 'User added successfully',
               userId: result.insertedId,
            });
         }
      });

      // get user profile data
      app.get('/userProfile/:email', async (req, res) => {
         const { email } = req.params;
         console.log(email);
         const result = await userCollection.findOne({ userEmail: email });
         res.json(result);
      });

      app.get('/checkAdmin/:email', async (req, res) => {
         const { email } = req.params;
         console.log(email);
         const result = await userCollection.findOne(
            { userEmail: email },
            { projection: { images: 0 } }
         );
         res.json(result);
      });

      // get all the users
      app.get('/users', async (req, res) => {
         const { page, size } = req.query;

         const cursor = userCollection.find({}, { projection: { images: 0 } });
         const count = await cursor.count();
         let users;

         console.log(page);

         if (page) {
            users = await cursor
               .skip((parseInt(page) - 1) * parseInt(size))
               .limit(parseInt(size))
               .toArray();
         } else {
            users = await cursor.toArray();
         }

         res.json({ users, count });
      });

      // delete an user
      app.delete('/user', async (req, res) => {
         const { uid, _id } = req.query;

         try {
            const result = await userCollection.deleteOne({
               _id: ObjectId(_id),
            });
            await admin.auth().deleteUser(uid);

            res.json(result);
         } catch (error) {
            res.json({ message: 'error deleting user' });
         }
      });

      app.delete('/users', async (req, res) => {
         const ids = req.body;
         const uidArray = [];
         const _idArray = [];
         ids.forEach((id) => {
            uidArray.push(id.uid);
            _idArray.push(ObjectId(id._id));
         });

         try {
            const result = await userCollection.deleteMany({
               _id: { $in: _idArray },
            });
            const deleteResult = await admin.auth().deleteUsers(uidArray);
            console.log(
               `Successfully deleted ${deleteResult.successCount} users`
            );

            result.deletedCountFromFirebase = deleteResult.successCount;
            res.json(result);
         } catch (error) {
            res.json({ message: 'error deleting users' });
         }
      });

      app.get('/packages', async (req, res) => {
         const cursor = packageCollection.find({});
         const result = await cursor.toArray();

         res.json(result);
      });

   } catch (err) {
      console.error(err);
   } finally {
      //   await client.close();
   }
};

main().catch((err) => console.dir);

app.get('/', (req, res) => {
   res.send('Hero Rider Server');
});

app.listen(port, () => {
   console.log(`Hero Rider's Server port http://localhost:${port}`);
});
