declare module 'aws-lambda-fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      sub: string;
      role: string;
      exp: number;
    };
  }
}
