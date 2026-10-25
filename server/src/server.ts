import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { openLocal } from "./db";
import { resolvers } from "./resolvers";
import { typeDefs } from "./schema";

openLocal(process.env.SQLITE_PATH ?? "timetable.sqlite");

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const port = Number(process.env.PORT || 4000);

const { url } = await startStandaloneServer(server, {
  listen: { port },
});

console.log(`🚀  Server ready at: ${url}`);
