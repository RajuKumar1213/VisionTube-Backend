import dotenv from 'dotenv';
import connectDB from './db/index.js';
import { app } from './app.js';

dotenv.config({ path: './.env' });

connectDB()
  .then(() => {
    app.listen(process.env.PORT || 8000, () => {
      console.log(`⚙️  Server is running on port ${process.env.PORT}`);
    });
    app.on('error', (error) => console.log('ERROR', error));
  })
  .catch((error) => {
    console.log('MONGODB CONNECTION ERROR', error);
  });

/*
// this is method 1 for connecting to mongodb, but we will not use this method for this project
(async () => {
  try {
    // conneting to mongodb
    mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);

    // if app unable to connect to db show this error
    app.on('error', (error) => console.log('Error', error));

    // if app successfully connected to db show this message
    app.listen(process.env.PORT, () =>
      console.log(`Listening on port ${process.env.PORT}`)
    );
  } catch (error) {
    console.error('Error', error);
    throw error;
  }
})();
*/
