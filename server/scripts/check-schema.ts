// Runs before every deploy (predeploy): a schema that doesn't parse takes the
// whole API down at Lambda start-up, so stop the deploy here instead.
import { buildASTSchema, parse } from "graphql";
import { typeDefs } from "../src/schema";

const src = typeof typeDefs === "string" ? typeDefs : ((typeDefs as any).loc?.source?.body ?? String(typeDefs));
buildASTSchema(parse(src));
console.log("GraphQL schema OK");
