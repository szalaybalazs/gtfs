import { ApolloServer } from "@apollo/server";
import {
  handlers,
  startServerAndCreateLambdaHandler,
} from "@as-integrations/aws-lambda";
import type { APIGatewayProxyEventV2, Context } from "aws-lambda";
import { Resource } from "sst";
import { ensureDb } from "./db";
import { resolvers } from "./resolvers";
import { typeDefs } from "./schema";

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
});

const graphql = startServerAndCreateLambdaHandler(
  server,
  handlers.createAPIGatewayProxyEventV2RequestHandler()
);

export const handler = async (event: APIGatewayProxyEventV2, context: Context) => {
  await ensureDb(Resource.Gtfs.name);
  return graphql(event, context, () => {});
};
