const express = require('express');
const cors = require('cors')
const {BigQuery} = require('@google-cloud/bigquery');
const {google} = require('googleapis');
const db = require('./firebaseConfig');
const app = express();
const port = 5555;
const cron = require('node-cron');

const SERVICE_ACCOUNT_FILE = '/Users/izzaldi/Documents/GitHub/testingtracker-2d31c-b22e98ec5aaf.json';
const DATASET_ID = 'testingtracker-2d31c.analytics_387519606';
const PROJECT_ID = 'testingtracker-2d31c';
const PROPERTY_ID = '387519606'
const TABLE_ID = 'testingtracker-2d31c.analytics_387519606.pseudonymous_users_20240806';

app.use(cors());
app.use(express.json());

const formatDate = () => {
    const date = new Date();
    const year = date.getFullyear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year+month+day;
}

// const get28DaysAgo = (date) => {
//     const newDate = new Date(date);
//     newDate.setDate(newDate.getDate() - 28);
//     return newDate;
// }

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/api', (req, res) => {
    const today = new Date();
    // formatDate(today);
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    console.log(year + month);
    res.json({message: 'Welcome to the API '});
});

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: 'https://www.googleapis.com/auth/analytics.readonly',
});

app.get('/api/audiencesga', async(req, res) => {
    try{
        const analyticsData = google.analyticsdata('v1beta');
        const authClient = await auth.getClient();

        const response = await analyticsData.properties.runReport({
            auth: authClient,
            requestBody: {
                dimensions: [{name: 'audienceName'}],
                metrics: [{name: 'totalusers'}],
                dateRanges: [{startDate: '28daysAgo', endDate: 'today'}],
            },
            property: 'properties/387519606',
        });
        const rows = response.data.rows;
        res.json(rows);
    } catch(err){
        console.log(' Error executing query:', err);
        res.status(500).send('Internal Server Error');
    }
});

// app.get('/api/audiencesga', async(req, res) => {
//     try{
//         const analyticsData = google.analyticsdata('v1beta');
//         const authClient = await auth.getClient();
//         const today = new Date();

//         const response = await analyticsData.properties.runReport({
//             auth: authClient,
//             requestBody: {
//                 dimensions: [{name: 'audienceName'}],
//                 metrics: [{name: 'totalusers'}],
//                 dateRanges: [{startDate: '28daysAgo', endDate: 'today'}],
//             },
//             property: 'properties/387519606',
//         });
//         const rows = response.data.rows;

//         const transformedData = rows.map(item => {
//             return {
//               audience: item.dimensionValues[0].value,
//               totalUser: item.metricValues[0].value,
//               getDate: today,
//             };
//           });

//           console.log(transformedData);
//         //   const batch = db.batch();
//         for(const data of transformedData){
//             await db.collection('audiencesList').doc().set(data);
//         }
//         res.send('sukses');

        
        
//         //   transformedData.array.forEach(element => {
//         //     const docRef = db.collection('audiencesList').doc();
//         //     batch.set(docRef, element);
//         //   });
//         //   await batch.commit();

//         //   const docref = await db.collection('audiencesList').add(transformedData);
//         //   res.send(docref.id);

//         // res.json(transformedData);
//     } catch(err){
//         console.log(' Error executing query:', err);
//         res.status(500).send('Internal Server Error');
//     }
// });

cron.schedule('45 23 * * *', async () => {
    try{
        const analyticsData = google.analyticsdata('v1beta');
        const authClient = await auth.getClient();
        const today = new Date();

        const response = await analyticsData.properties.runReport({
            auth: authClient,
            requestBody: {
                dimensions: [{name: 'audienceName'}],
                metrics: [{name: 'totalusers'}],
                dateRanges: [{startDate: '28daysAgo', endDate: 'today'}],
            },
            property: 'properties/387519606',
        });
        const rows = response.data.rows;

        const transformedData = rows.map(item => {
            return {
              audience: item.dimensionValues[0].value,
              totalUser: item.metricValues[0].value,
              getDate: today,
            };
          });

          console.log(transformedData);
        for(const data of transformedData){
            await db.collection('audiencesList').doc().set(data);
        }

    } catch(err){
        console.log(' Error executing query:', err);
    }
});

app.get('/api/audiencesga2', async(req, res) => {
    try{
        const analyticsData = google.analyticsdata('v1beta');
        const authClient = await auth.getClient();

        const response = await analyticsData.properties.runReport({
            auth: authClient,
            requestBody: {
                dimensions: [
                    {name: 'audienceName'},
                    {name: 'customUser:userId'},
                ],
                metrics: [{name: 'totalusers'}],
                dateRanges: [{startDate: '28daysAgo', endDate: 'today'}],
            },
            property: 'properties/387519606',
        });
        const rows = response.data.rows;
        res.json(rows);
    } catch(err){
        console.log(' Error executing query:', err);
        res.status(500).send('Internal Server Error');
    }
});

const bigquery = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: SERVICE_ACCOUNT_FILE,
});

app.get('/api/audiences', async(req, res) => {
    const query = "SELECT audiences.name AS audienceName, count(distinct pseudo_user_id) AS user_count FROM `testingtracker-2d31c.analytics_387519606.pseudonymous_users_*`, unnest(audiences) audiences where _table_suffix between '20240712' and '20240808' group by 1";
    try{
        const [rows] = await bigquery.query({query});
        res.json(rows);
    } catch (err) {
        console.log(' Error executing query:', err);
        res.status(500).send('Internal Server Error');
    }
})

app.listen(port, () => {
    console.log(`server running at localhost:${port}`);
});