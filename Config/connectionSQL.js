import mysql from 'mysql2/promise';
import 'dotenv/config';

const connection = mysql.createPool({
  host: process.env.HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.USER_BD,
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
  ssl: {
    rejectUnauthorized: false, 
  },
});


export default connection

