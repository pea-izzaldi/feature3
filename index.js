const express = require('express');
const cors = require('cors')
const {BigQuery} = require('@google-cloud/bigquery');
const {google} = require('googleapis');
const db = require('./firebaseConfig');
const app = express();
const port = 5555;
const cron = require('node-cron');

// disesuaikan path nya (Path BQ)
const SERVICE_ACCOUNT_FILE = '/Users/izzaldi/Documents/GitHub/testingtracker-2d31c-b22e98ec5aaf.json';
const PROJECT_ID = 'testingtracker-2d31c';

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/api', (req, res) => {
    res.json({message: 'Welcome to the API '});
});

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: 'https://www.googleapis.com/auth/analytics.readonly',
});

// ambil dari GA4
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

app.delete('/api/audiencesReport/:id', async(req, res) => {
    const id = req.params;

    try {
        await db.collection('Live Export').doc(id).delete();
        console.log(`delete ${id} berhasil`)
    } catch (error) {
        console.error("Error menghapus document: ", error);
        res.status(500).send({error: 'Gagal delete document'});
    }
});

cron.schedule('55 11 * * *', async () => {
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


// ambil dari firestore

app.get('/api/audiencesList', async (req, res) => {
    const dateParam = req.body.date
    
    const queryDate = dateParam ? new Date(dateParam) : new Date();
    queryDate.setHours(0, 0, 0, 0);
    const queryDate2 = new Date(queryDate)
    queryDate2.setDate(queryDate.getDate() + 1);
    console.log(queryDate)
    try {
        const querySnapshot = await db.collection('audiencesList')
            .where('getDate', '>=', queryDate)
            .where('getDate', '<', queryDate2)
            .get();
        
        if (querySnapshot.empty) {
            return res.status(404).json({message: 'No data found for this date'});
        }
        const data = [];
        querySnapshot.forEach(doc => {
            data.push({id: doc.id, ...doc.data()});
        });

        res.status(200).json(data);
    } catch (error) {
        console.error('Error retrieving data:', error);
        res.status(500).json({error: 'Failed to retrieve data'});
    }

});

// coba kirim parameter lain

// app.get('/api/audiencesga2', async(req, res) => {
//     try{
//         const analyticsData = google.analyticsdata('v1beta');
//         const authClient = await auth.getClient();
//         const today = new Date();

//         const response = await analyticsData.properties.runReport({
//             auth: authClient,
//             requestBody: {
//                 dimensions: [
//                     {name: 'audienceName'},
//                     {name: 'customUser:userId'},
//                     {name: 'city'},
//                 ],
//                 metrics: [{name: 'totalusers'}],
//                 dateRanges: [{startDate: '28daysAgo', endDate: 'today'}],
//                 "dimensionFilter": {
//                     "filter": {
//                         "fieldName": "audienceName",
//                         "stringFilter": {
//                         "matchType": "EXACT",
//                         "value": 'Purchasers'
//                         }
//                     }
//                 }
//             },
//             property: 'properties/387519606',
//         });
//         const rows = response.data.rows;

//         const transformedData = rows.map(item => {
//             return {
//               audienceName: item.dimensionValues[0].value,
//               userId: item.dimensionValues[1].value,
//               city: item.dimensionValues[2].value,
//               totalUser: item.metricValues[0].value,
//               getDate: today,
//             };
//           });
//           console.log(transformedData);
          
//         for(const data of transformedData){
//             await db.collection('audiencesListUserId').doc().set(data);
//         }

//         res.json(rows);
//     } catch(err){
//         console.log(' Error executing query:', err);
//         res.status(500).send('Internal Server Error');
//     }
// // });

//ambil dari bq

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