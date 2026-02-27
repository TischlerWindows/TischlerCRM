import awsLambdaFastify from 'aws-lambda-fastify';
import { buildApp } from './app';
const app = buildApp();
export const handler = awsLambdaFastify(app);
